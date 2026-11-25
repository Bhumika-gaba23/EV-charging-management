package com.pluggo.preview;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.os.Handler;
import android.os.Looper;
import androidx.webkit.JavaScriptReplyProxy;
import java.util.concurrent.CopyOnWriteArrayList;
import org.json.JSONArray;
import org.json.JSONObject;

/**
 * The live charging picture the page shares with the rest of the phone: the ongoing notification
 * (progress bar, Pause and Stop buttons) and the car screen (Android Auto). The page posts
 * {type: "live", session, stations} every few seconds; buttons here are sent back to the page as
 * {type: "command", action, session}, so every action still goes through the page and the server.
 */
final class LiveState {
    private static final String CHANNEL = "pluggo-live";
    private static final String TAG = "pluggo-live";
    private static JSONObject session;            // the active or just-finished session, or null
    private static JSONArray stations = new JSONArray();
    private static JavaScriptReplyProxy page;     // the page's message channel, while Pluggo is open
    private static final CopyOnWriteArrayList<Runnable> listeners = new CopyOnWriteArrayList<>();
    private static final Handler main = new Handler(Looper.getMainLooper());

    private LiveState() { }

    static synchronized JSONObject session() { return session; }
    static synchronized JSONArray stations() { return stations; }
    static boolean pageOpen() { return page != null; }

    static void addListener(Runnable listener) { listeners.add(listener); }
    static void removeListener(Runnable listener) { listeners.remove(listener); }

    /** A "live" message from the page. */
    static void update(Context context, JSONObject message, JavaScriptReplyProxy reply) {
        synchronized (LiveState.class) {
            page = reply;
            session = message.optJSONObject("session");
            JSONArray list = message.optJSONArray("stations");
            if (list != null) stations = list;
        }
        showNotification(context.getApplicationContext());
        for (Runnable listener : listeners) main.post(listener);
    }

    static void pageClosed() { page = null; }

    /** Sends a button press (stop, pause, resume, open) to the page. Returns false if Pluggo is closed. */
    static boolean command(String action) {
        JavaScriptReplyProxy target = page;
        JSONObject current = session();
        if (target == null) return false;
        try {
            JSONObject message = new JSONObject().put("type", "command").put("action", action)
                .put("session", current == null ? "" : current.optString("id"));
            main.post(() -> { try { target.postMessage(message.toString()); } catch (Exception ignored) { } });
            return true;
        } catch (Exception error) { return false; }
    }

    // ----- Ongoing notification: battery progress while charging, with Pause/Resume and Stop. -----
    private static void showNotification(Context context) {
        NotificationManager manager = context.getSystemService(NotificationManager.class);
        JSONObject s = session();
        if (s == null || !"charging".equals(s.optString("status")) && !"paused".equals(s.optString("status"))) {
            manager.cancel(TAG, 1);
            return;
        }
        if (manager.getNotificationChannel(CHANNEL) == null) {
            NotificationChannel channel = new NotificationChannel(CHANNEL, "Charging in progress", NotificationManager.IMPORTANCE_LOW);
            channel.setDescription("Live battery level while your vehicle charges");
            manager.createNotificationChannel(channel);
        }
        if (!Alerts.permitted(context)) return;
        boolean paused = "paused".equals(s.optString("status"));
        int soc = (int) Math.round(s.optDouble("soc", 0));
        String title = (paused ? "Paused · " : "Charging · ") + soc + "% → " + s.optInt("target", 80) + "%";
        String body = s.optString("station") + " · " + s.optString("connector") + " · "
            + String.format(java.util.Locale.ENGLISH, "%.1f kW · %.2f kWh · ₹%.0f", s.optDouble("kw", 0), s.optDouble("kwh", 0), s.optDouble("cost", 0))
            + (paused ? "" : minutesText(s));
        Intent open = new Intent(context, MainActivity.class).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        Notification notification = new Notification.Builder(context, CHANNEL)
            .setSmallIcon(R.drawable.ic_notification)
            .setContentTitle(title)
            .setContentText(body)
            .setStyle(new Notification.BigTextStyle().bigText(body))
            .setProgress(100, Math.max(0, Math.min(100, soc)), false)
            .setOngoing(true)
            .setOnlyAlertOnce(true)
            .setCategory(Notification.CATEGORY_PROGRESS)
            .setContentIntent(PendingIntent.getActivity(context, 40, open, PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT))
            .addAction(new Notification.Action.Builder(null, paused ? "Resume" : "Pause", action(context, paused ? "resume" : "pause", 41)).build())
            .addAction(new Notification.Action.Builder(null, "Stop charging", action(context, "stop", 42)).build())
            .build();
        manager.notify(TAG, 1, notification);
    }

    static String minutesText(JSONObject s) {
        double minutes = s.optDouble("minutesLeft", -1);
        if (minutes < 0) return "";
        return minutes < 1 ? " · almost done" : " · " + Math.round(minutes) + " min left";
    }

    private static PendingIntent action(Context context, String name, int code) {
        Intent intent = new Intent(context, Receiver.class).setAction("com.pluggo.preview.LIVE_" + name.toUpperCase());
        return PendingIntent.getBroadcast(context, code, intent, PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT);
    }

    /** Notification buttons. If Pluggo was closed, open it so the driver can act there. */
    public static final class Receiver extends BroadcastReceiver {
        @Override public void onReceive(Context context, Intent intent) {
            String action = intent.getAction() == null ? "" : intent.getAction().replace("com.pluggo.preview.LIVE_", "").toLowerCase();
            if (!command(action)) {
                context.startActivity(new Intent(context, MainActivity.class).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK));
            }
        }
    }
}
