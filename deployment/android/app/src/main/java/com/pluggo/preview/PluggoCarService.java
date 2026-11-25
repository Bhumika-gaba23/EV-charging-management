package com.pluggo.preview;

import android.content.Intent;
import android.graphics.Bitmap;
import android.graphics.Canvas;
import android.graphics.Color;
import android.graphics.Paint;
import android.graphics.RectF;
import android.graphics.Typeface;
import android.net.Uri;
import android.text.SpannableString;
import android.text.Spanned;
import androidx.annotation.DrawableRes;
import androidx.annotation.NonNull;
import androidx.car.app.CarAppService;
import androidx.car.app.CarContext;
import androidx.car.app.CarToast;
import androidx.car.app.Screen;
import androidx.car.app.Session;
import androidx.car.app.model.Action;
import androidx.car.app.model.ActionStrip;
import androidx.car.app.model.CarColor;
import androidx.car.app.model.CarIcon;
import androidx.car.app.model.CarLocation;
import androidx.car.app.model.Distance;
import androidx.car.app.model.DistanceSpan;
import androidx.car.app.model.ItemList;
import androidx.car.app.model.MessageTemplate;
import androidx.car.app.model.Metadata;
import androidx.car.app.model.Pane;
import androidx.car.app.model.PaneTemplate;
import androidx.car.app.model.Place;
import androidx.car.app.model.PlaceListMapTemplate;
import androidx.car.app.model.PlaceMarker;
import androidx.car.app.model.Row;
import androidx.car.app.model.Template;
import androidx.car.app.validation.HostValidator;
import androidx.core.graphics.drawable.IconCompat;
import androidx.lifecycle.DefaultLifecycleObserver;
import androidx.lifecycle.LifecycleOwner;
import java.util.Locale;
import org.json.JSONArray;
import org.json.JSONObject;

/**
 * Pluggo on the car's screen (Android Auto, and Android Automotive with the same library).
 * Home: a map of nearby chargers with the charge in progress on top. Charging: a battery gauge,
 * live figures and big Pause/Resume and Stop buttons. Data and actions go through the phone app.
 */
public final class PluggoCarService extends CarAppService {
    static final CarColor GREEN = CarColor.createCustom(0xFF1FBF6A, 0xFF1FBF6A);
    static final CarColor AMBER = CarColor.createCustom(0xFFF5A524, 0xFFF5A524);

    @NonNull @Override public HostValidator createHostValidator() {
        // Test build: accept any Android Auto host, including the Desktop Head Unit used for demos.
        return HostValidator.ALLOW_ALL_HOSTS_VALIDATOR;
    }

    @NonNull @Override public Session onCreateSession() {
        return new Session() {
            @NonNull @Override public Screen onCreateScreen(@NonNull Intent intent) {
                CarEnergy.start(getCarContext(), getLifecycle()); // the car's battery, range and ports
                // Opened from a car notification while charging: go straight to the charge.
                HomeScreen home = new HomeScreen(getCarContext());
                if (PluggoCarService.active(LiveState.session())) {
                    getCarContext().getCarService(androidx.car.app.ScreenManager.class).push(home);
                    return new ChargingScreen(getCarContext());
                }
                return home;
            }
        };
    }

    static CarIcon icon(CarContext context, @DrawableRes int res, CarColor tint) {
        CarIcon.Builder builder = new CarIcon.Builder(IconCompat.createWithResource(context, res));
        if (tint != null) builder.setTint(tint);
        return builder.build();
    }

    /** Opens Pluggo on the phone's own screen (never on the car display, which Android forbids). */
    static void openPhone(CarContext context) {
        try {
            context.getApplicationContext().startActivity(new Intent(context.getApplicationContext(), MainActivity.class).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK));
            CarToast.makeText(context, "Opened on your phone", CarToast.LENGTH_SHORT).show();
        } catch (Exception blocked) {
            CarToast.makeText(context, "Open Pluggo on your phone", CarToast.LENGTH_LONG).show();
        }
    }

    static boolean active(JSONObject s) {
        String status = s == null ? "" : s.optString("status");
        return "charging".equals(status) || "paused".equals(status);
    }

    static String money(double value) { return String.format(Locale.ENGLISH, "₹%.0f", value); }

    /** A battery gauge drawn for the car screen: the charge so far, the target mark and the %. */
    static CarIcon gauge(JSONObject s) {
        int size = 480;
        Bitmap bitmap = Bitmap.createBitmap(size, size, Bitmap.Config.ARGB_8888);
        Canvas canvas = new Canvas(bitmap);
        double soc = Math.max(0, Math.min(100, s.optDouble("soc"))), target = s.optDouble("target", 80);
        boolean paused = "paused".equals(s.optString("status")), finished = !active(s);
        float stroke = 44, pad = stroke / 2 + 8;
        RectF ring = new RectF(pad, pad, size - pad, size - pad);
        Paint track = new Paint(Paint.ANTI_ALIAS_FLAG);
        track.setStyle(Paint.Style.STROKE); track.setStrokeWidth(stroke); track.setColor(0xFF2A2A2A); track.setStrokeCap(Paint.Cap.ROUND);
        canvas.drawArc(ring, 135, 270, false, track);
        Paint fill = new Paint(track);
        fill.setColor(paused ? 0xFFF5A524 : 0xFF1FBF6A);
        canvas.drawArc(ring, 135, (float) (270 * soc / 100), false, fill);
        // Target mark.
        Paint mark = new Paint(Paint.ANTI_ALIAS_FLAG);
        mark.setColor(Color.WHITE); mark.setStrokeWidth(8); mark.setStrokeCap(Paint.Cap.ROUND);
        double angle = Math.toRadians(135 + 270 * target / 100);
        float cx = size / 2f, cy = size / 2f, r1 = ring.width() / 2 - stroke / 2 - 4, r2 = ring.width() / 2 + stroke / 2 + 4;
        canvas.drawLine(cx + (float) (r1 * Math.cos(angle)), cy + (float) (r1 * Math.sin(angle)), cx + (float) (r2 * Math.cos(angle)), cy + (float) (r2 * Math.sin(angle)), mark);
        Paint big = new Paint(Paint.ANTI_ALIAS_FLAG);
        big.setColor(Color.WHITE); big.setTextAlign(Paint.Align.CENTER); big.setTextSize(150); big.setTypeface(Typeface.create(Typeface.DEFAULT, Typeface.BOLD));
        canvas.drawText(Math.round(soc) + "%", cx, cy + 40, big);
        Paint small = new Paint(Paint.ANTI_ALIAS_FLAG);
        small.setColor(0xFFA6A6A6); small.setTextAlign(Paint.Align.CENTER); small.setTextSize(44);
        canvas.drawText(finished ? "done" : paused ? "paused" : "to " + Math.round(target) + "%", cx, cy + 110, small);
        return new CarIcon.Builder(IconCompat.createWithBitmap(bitmap)).build();
    }

    /** Base screen that redraws whenever the phone app shares new live data. */
    abstract static class LiveScreen extends Screen {
        private final Runnable refresh = this::invalidate;
        LiveScreen(CarContext context) {
            super(context);
            getLifecycle().addObserver(new DefaultLifecycleObserver() {
                @Override public void onStart(@NonNull LifecycleOwner owner) { LiveState.addListener(refresh); }
                @Override public void onStop(@NonNull LifecycleOwner owner) { LiveState.removeListener(refresh); }
            });
        }
        void send(String action, String done) {
            boolean sent = LiveState.command(action);
            CarToast.makeText(getCarContext(), sent ? done : "Open Pluggo on your phone", CarToast.LENGTH_SHORT).show();
        }
        Action openOnPhone() {
            return new Action.Builder().setIcon(icon(getCarContext(), R.drawable.ic_car_phone, null)).setOnClickListener(() -> openPhone(getCarContext())).build();
        }
    }

    /** Home: the map of nearby chargers, with the charge in progress as the first row. */
    static final class HomeScreen extends LiveScreen {
        HomeScreen(CarContext context) { super(context); }

        @NonNull @Override public Template onGetTemplate() {
            JSONObject s = LiveState.session();
            JSONArray stations = LiveState.stations();
            if (s == null && stations.length() == 0) {
                return new MessageTemplate.Builder("Open Pluggo on your phone to see chargers and your charge here.")
                    .setTitle("Pluggo").setHeaderAction(Action.APP_ICON)
                    .setIcon(icon(getCarContext(), R.drawable.ic_car_station, GREEN))
                    .addAction(new Action.Builder().setTitle("Open on phone").setOnClickListener(() -> openPhone(getCarContext())).build())
                    .build();
            }
            ItemList.Builder list = new ItemList.Builder();
            int rows = 0;
            if (s != null) {
                JSONObject at = find(stations, s.optString("station"));
                boolean paused = "paused".equals(s.optString("status"));
                String title = active(s) ? ((paused ? "Paused · " : "Charging · ") + Math.round(s.optDouble("soc")) + "% → " + s.optInt("target") + "%")
                                         : "Charge finished · " + Math.round(s.optDouble("soc")) + "%";
                Row.Builder row = new Row.Builder().setTitle(title)
                    .addText(String.format(Locale.ENGLISH, "%s · %.1f kW · %s", s.optString("model"), s.optDouble("kw"), money(s.optDouble("cost")))
                        + (active(s) && !paused ? LiveState.minutesText(s) : ""))
                    .setOnClickListener(() -> getScreenManager().push(new ChargingScreen(getCarContext())));
                if (at != null) row.setMetadata(place(at, "⚡", paused ? AMBER : GREEN));
                list.addItem(row.build());
                rows++;
            }
            for (int i = 0; i < stations.length() && rows < 6; i++) {
                JSONObject st = stations.optJSONObject(i);
                if (st == null) continue;
                int free = st.optInt("free");
                SpannableString distance = new SpannableString("  " + st.optString("area"));
                distance.setSpan(DistanceSpan.create(Distance.create(st.optDouble("km"), Distance.UNIT_KILOMETERS)), 0, 1, Spanned.SPAN_INCLUSIVE_INCLUSIVE);
                list.addItem(new Row.Builder()
                    .setTitle(st.optString("name"))
                    .addText(distance)
                    .addText((free > 0 ? free + " of " + st.optInt("total") + " plugs free" : "All plugs in use") + " · ₹" + st.optString("rate") + "/kWh")
                    .setMetadata(place(st, String.valueOf(rows + (s == null ? 1 : 0)), free > 0 ? GREEN : CarColor.DEFAULT))
                    .setOnClickListener(() -> navigate(st))
                    .build());
                rows++;
            }
            ActionStrip.Builder strip = new ActionStrip.Builder().addAction(openOnPhone());
            if (active(s)) strip.addAction(new Action.Builder().setTitle("Charging").setOnClickListener(() -> getScreenManager().push(new ChargingScreen(getCarContext()))).build());
            JSONObject car = LiveState.car();
            String heading = "Pluggo";
            if (car != null && !car.isNull("battery")) heading += " · Car " + Math.round(car.optDouble("battery")) + "%"
                + (car.isNull("rangeKm") ? "" : " · " + Math.round(car.optDouble("rangeKm")) + " km");
            return new PlaceListMapTemplate.Builder().setTitle(heading).setHeaderAction(Action.APP_ICON)
                .setItemList(list.build()).setActionStrip(strip.build()).build();
        }

        private static JSONObject find(JSONArray stations, String name) {
            for (int i = 0; i < stations.length(); i++) { JSONObject st = stations.optJSONObject(i); if (st != null && name.equals(st.optString("name"))) return st; }
            return null;
        }

        private static Metadata place(JSONObject st, String label, CarColor color) {
            return new Metadata.Builder().setPlace(new Place.Builder(CarLocation.create(st.optDouble("lat"), st.optDouble("lng")))
                .setMarker(new PlaceMarker.Builder().setLabel(label).setColor(color).build()).build()).build();
        }

        private void navigate(JSONObject st) {
            Uri place = Uri.parse("geo:" + st.optDouble("lat") + "," + st.optDouble("lng") + "?q=" + Uri.encode(st.optString("name")));
            try { getCarContext().startCarApp(new Intent(CarContext.ACTION_NAVIGATE, place)); }
            catch (Exception error) { CarToast.makeText(getCarContext(), "No navigation app available", CarToast.LENGTH_SHORT).show(); }
        }
    }

    /** The live charge: battery gauge, power, energy, cost, time left; Pause/Resume and Stop. */
    static final class ChargingScreen extends LiveScreen {
        ChargingScreen(CarContext context) { super(context); }

        @NonNull @Override public Template onGetTemplate() {
            JSONObject s = LiveState.session();
            if (s == null) {
                return new MessageTemplate.Builder("No charge in progress.").setTitle("Charging").setHeaderAction(Action.BACK)
                    .setIcon(icon(getCarContext(), R.drawable.ic_car_bolt, null)).build();
            }
            CarContext c = getCarContext();
            boolean live = active(s), paused = "paused".equals(s.optString("status"));
            Pane.Builder pane = new Pane.Builder().setImage(gauge(s))
                .addRow(new Row.Builder().setImage(icon(c, R.drawable.ic_car_time, live && !paused ? GREEN : AMBER))
                    .setTitle(!live ? "Finished" : paused ? "Paused" : "Charging")
                    .addText(!live ? s.optString("reason", "Charging stopped") : paused ? "Resume when you're ready" : LiveState.minutesText(s).replace(" · ", "")).build())
                .addRow(new Row.Builder().setImage(icon(c, R.drawable.ic_car_bolt, null))
                    .setTitle(String.format(Locale.ENGLISH, "%.1f kW · %.2f kWh", s.optDouble("kw"), s.optDouble("kwh")))
                    .addText("Cost so far " + money(s.optDouble("cost"))).build())
                .addRow(new Row.Builder().setImage(icon(c, R.drawable.ic_car_station, null))
                    .setTitle(s.optString("station") + " · " + s.optString("connector"))
                    .addText(s.optBoolean("carReading") ? "Battery read from your car" : "Stops at " + s.optInt("target") + "%").build());
            if (live) {
                pane.addAction(new Action.Builder().setTitle(paused ? "Resume" : "Pause")
                    .setIcon(icon(c, paused ? R.drawable.ic_car_play : R.drawable.ic_car_pause, null))
                    .setBackgroundColor(paused ? GREEN : AMBER)
                    .setOnClickListener(() -> send(paused ? "resume" : "pause", paused ? "Resuming…" : "Pausing…")).build());
                pane.addAction(new Action.Builder().setTitle("Stop")
                    .setIcon(icon(c, R.drawable.ic_car_stop, null))
                    .setBackgroundColor(CarColor.RED)
                    .setOnClickListener(() -> send("stop", "Stopping…")).build());
            }
            return new PaneTemplate.Builder(pane.build()).setTitle(s.optString("model", "Your charge")).setHeaderAction(Action.BACK)
                .setActionStrip(new ActionStrip.Builder().addAction(openOnPhone()).build()).build();
        }
    }
}
