package com.pluggo.preview;

import android.content.Intent;
import android.net.Uri;
import androidx.annotation.NonNull;
import androidx.car.app.CarAppService;
import androidx.car.app.CarContext;
import androidx.car.app.CarToast;
import androidx.car.app.Screen;
import androidx.car.app.Session;
import androidx.car.app.model.Action;
import androidx.car.app.model.ActionStrip;
import androidx.car.app.model.CarColor;
import androidx.car.app.model.ItemList;
import androidx.car.app.model.ListTemplate;
import androidx.car.app.model.MessageTemplate;
import androidx.car.app.model.Pane;
import androidx.car.app.model.PaneTemplate;
import androidx.car.app.model.Row;
import androidx.car.app.model.SectionedItemList;
import androidx.car.app.model.Template;
import androidx.car.app.validation.HostValidator;
import androidx.lifecycle.DefaultLifecycleObserver;
import androidx.lifecycle.LifecycleOwner;
import java.util.Locale;
import org.json.JSONArray;
import org.json.JSONObject;

/**
 * Pluggo on the car's screen (Android Auto, and Android Automotive with the same library).
 * Shows the live charge with Pause/Resume and Stop, and nearby Pluggo chargers with navigation.
 * The data comes from the Pluggo app on the phone (LiveState); actions go back through it.
 */
public final class PluggoCarService extends CarAppService {
    @NonNull @Override public HostValidator createHostValidator() {
        // Test build: accept any Android Auto host, including the Desktop Head Unit used for demos.
        return HostValidator.ALLOW_ALL_HOSTS_VALIDATOR;
    }

    @NonNull @Override public Session onCreateSession() {
        return new Session() {
            @NonNull @Override public Screen onCreateScreen(@NonNull Intent intent) { return new HomeScreen(getCarContext()); }
        };
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
    }

    static boolean active(JSONObject s) {
        String status = s == null ? "" : s.optString("status");
        return "charging".equals(status) || "paused".equals(status);
    }

    /** Home: the charge in progress (if any), then nearby chargers. */
    static final class HomeScreen extends LiveScreen {
        HomeScreen(CarContext context) { super(context); }

        @NonNull @Override public Template onGetTemplate() {
            JSONObject s = LiveState.session();
            JSONArray stations = LiveState.stations();
            if (s == null && stations.length() == 0) {
                return new MessageTemplate.Builder("Open Pluggo on your phone to see chargers and your charge here.")
                    .setTitle("Pluggo").setHeaderAction(Action.APP_ICON).build();
            }
            ListTemplate.Builder template = new ListTemplate.Builder().setTitle("Pluggo").setHeaderAction(Action.APP_ICON);
            if (s != null) {
                Row.Builder row = new Row.Builder()
                    .setTitle(active(s) ? (("paused".equals(s.optString("status")) ? "Paused · " : "Charging · ") + Math.round(s.optDouble("soc")) + "% → " + s.optInt("target") + "%")
                                        : "Charge finished · " + Math.round(s.optDouble("soc")) + "%")
                    .addText(s.optString("model") + " · " + s.optString("station") + " · " + s.optString("connector"))
                    .addText(String.format(Locale.ENGLISH, "%.1f kW · %.2f kWh · ₹%.0f", s.optDouble("kw"), s.optDouble("kwh"), s.optDouble("cost")) + (active(s) ? LiveState.minutesText(s) : ""))
                    .setOnClickListener(() -> getScreenManager().push(new ChargingScreen(getCarContext())));
                template.addSectionedList(SectionedItemList.create(new ItemList.Builder().addItem(row.build()).build(), active(s) ? "Charging now" : "Last charge"));
            }
            ItemList.Builder list = new ItemList.Builder();
            int shown = 0;
            for (int i = 0; i < stations.length() && shown < (s == null ? 6 : 5); i++, shown++) {
                JSONObject st = stations.optJSONObject(i);
                if (st == null) continue;
                list.addItem(new Row.Builder()
                    .setTitle(st.optString("name"))
                    .addText(st.optString("area") + String.format(Locale.ENGLISH, " · %.1f km", st.optDouble("km")))
                    .addText(st.optInt("free") + " of " + st.optInt("total") + " plugs free · ₹" + st.optString("rate") + "/kWh")
                    .setOnClickListener(() -> navigate(st))
                    .build());
            }
            if (shown > 0) template.addSectionedList(SectionedItemList.create(list.build(), "Nearby chargers"));
            return template.build();
        }

        private void navigate(JSONObject st) {
            Uri place = Uri.parse("geo:" + st.optDouble("lat") + "," + st.optDouble("lng") + "?q=" + Uri.encode(st.optString("name")));
            try { getCarContext().startCarApp(new Intent(CarContext.ACTION_NAVIGATE, place)); }
            catch (Exception error) { CarToast.makeText(getCarContext(), "No navigation app available", CarToast.LENGTH_SHORT).show(); }
        }
    }

    /** The live charge: battery, power, energy, cost, time left; Pause/Resume and Stop. */
    static final class ChargingScreen extends LiveScreen {
        ChargingScreen(CarContext context) { super(context); }

        @NonNull @Override public Template onGetTemplate() {
            JSONObject s = LiveState.session();
            if (s == null) {
                return new MessageTemplate.Builder("No charge in progress.").setTitle("Charging").setHeaderAction(Action.BACK).build();
            }
            boolean live = active(s), paused = "paused".equals(s.optString("status"));
            Pane.Builder pane = new Pane.Builder()
                .addRow(new Row.Builder().setTitle("Battery").addText(Math.round(s.optDouble("soc")) + "% now · stopping at " + s.optInt("target") + "%"
                    + (s.optBoolean("carReading") ? " · read from your car" : "")).build())
                .addRow(new Row.Builder().setTitle(live ? (paused ? "Paused" : "Charging") : "Finished")
                    .addText(live ? (paused ? "Tap Resume to continue" : LiveState.minutesText(s).replace(" · ", "").replace("min left", "minutes left"))
                                  : s.optString("reason", "Charging stopped")).build())
                .addRow(new Row.Builder().setTitle("Power and energy")
                    .addText(String.format(Locale.ENGLISH, "%.1f kW · %.2f kWh added", s.optDouble("kw"), s.optDouble("kwh"))).build())
                .addRow(new Row.Builder().setTitle("Cost so far")
                    .addText(String.format(Locale.ENGLISH, "₹%.2f · %s, %s", s.optDouble("cost"), s.optString("station"), s.optString("connector"))).build());
            if (live) {
                pane.addAction(new Action.Builder().setTitle(paused ? "Resume" : "Pause")
                    .setOnClickListener(() -> send(paused ? "resume" : "pause", paused ? "Resuming…" : "Pausing…")).build());
                pane.addAction(new Action.Builder().setTitle("Stop charging").setBackgroundColor(CarColor.RED)
                    .setOnClickListener(() -> send("stop", "Stopping…")).build());
            }
            return new PaneTemplate.Builder(pane.build()).setTitle(s.optString("model", "Your charge")).setHeaderAction(Action.BACK)
                .setActionStrip(new ActionStrip.Builder().addAction(new Action.Builder().setTitle("Open on phone")
                    .setOnClickListener(() -> {
                        getCarContext().startActivity(new Intent(getCarContext(), MainActivity.class).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK));
                        CarToast.makeText(getCarContext(), "Opened on your phone", CarToast.LENGTH_SHORT).show();
                    }).build()).build())
                .build();
        }
    }
}
