package com.pluggo.preview;

import android.app.AlarmManager;
import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.os.Build;
import java.util.regex.Pattern;
import org.json.JSONObject;

/**
 * Charging alerts for the web app: "charge complete", booking reminders and report updates.
 * The page sends small JSON messages through the PluggoNative bridge; scheduled alerts use
 * AlarmManager so they fire even when Pluggo is closed. Alarms do not survive a reboot.
 */
final class Alerts {
    static final String CHANNEL = "pluggo-alerts";
    private static final Pattern TAG = Pattern.compile("[A-Za-z0-9:_-]{1,80}");
    private static final long MAX_AHEAD = 48L * 3600 * 1000;

    private Alerts() { }

    static void createChannel(Context context) {
        NotificationChannel channel = new NotificationChannel(CHANNEL, "Charging alerts", NotificationManager.IMPORTANCE_HIGH);
        channel.setDescription("Charge complete, booking reminders and updates on problems you reported");
        context.getSystemService(NotificationManager.class).createNotificationChannel(channel);
    }

    static boolean permitted(Context context) {
        return Build.VERSION.SDK_INT < 33
            || context.checkSelfPermission(android.Manifest.permission.POST_NOTIFICATIONS) == PackageManager.PERMISSION_GRANTED;
    }

    /** Handles one bridge message. Returns false for "permission", which the activity answers itself. */
    static boolean handle(Context context, String data) {
        try {
            JSONObject message = new JSONObject(data);
            String type = message.optString("type");
            if ("permission".equals(type)) return false;
            String tag = message.optString("tag");
            if (!TAG.matcher(tag).matches()) return true;
            String title = clip(message.optString("title"), 80), body = clip(message.optString("body"), 240);
            if ("notify".equals(type)) show(context, tag, title, body);
            else if ("schedule".equals(type)) {
                long at = message.optLong("at");
                long now = System.currentTimeMillis();
                if (at > now && at < now + MAX_AHEAD) {
                    context.getSystemService(AlarmManager.class).setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, at, alarm(context, tag, title, body, PendingIntent.FLAG_UPDATE_CURRENT));
                }
            } else if ("cancel".equals(type)) {
                PendingIntent pending = alarm(context, tag, "", "", PendingIntent.FLAG_NO_CREATE);
                if (pending != null) { context.getSystemService(AlarmManager.class).cancel(pending); pending.cancel(); }
            }
        } catch (Exception ignored) { }
        return true;
    }

    static void show(Context context, String tag, String title, String body) {
        if (!permitted(context)) return;
        createChannel(context);
        Intent open = new Intent(context, MainActivity.class).addFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        PendingIntent tap = PendingIntent.getActivity(context, tag.hashCode(), open, PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT);
        // On Android Auto the same alert pops up on the car screen; tapping it opens Pluggo there.
        androidx.car.app.notification.CarAppExtender car = new androidx.car.app.notification.CarAppExtender.Builder()
            .setContentTitle(title).setContentText(body).setSmallIcon(R.drawable.ic_notification)
            .setImportance(NotificationManager.IMPORTANCE_HIGH)
            .setContentIntent(androidx.car.app.notification.CarPendingIntent.getCarApp(context, tag.hashCode(),
                new Intent(Intent.ACTION_VIEW).setComponent(new android.content.ComponentName(context, PluggoCarService.class)), 0))
            .build();
        Notification notification = new androidx.core.app.NotificationCompat.Builder(context, CHANNEL)
            .setSmallIcon(R.drawable.ic_notification)
            .setContentTitle(title)
            .setContentText(body)
            .setStyle(new androidx.core.app.NotificationCompat.BigTextStyle().bigText(body))
            .setPriority(androidx.core.app.NotificationCompat.PRIORITY_HIGH)
            .setAutoCancel(true)
            .setContentIntent(tap)
            .extend(car)
            .build();
        context.getSystemService(NotificationManager.class).notify(tag, 0, notification);
    }

    // One PendingIntent per tag: the tag is in the intent's data, which makes the intents distinct.
    private static PendingIntent alarm(Context context, String tag, String title, String body, int flags) {
        Intent intent = new Intent(context, AlertReceiver.class)
            .setData(Uri.parse("pluggo-alert:" + Uri.encode(tag)))
            .putExtra("tag", tag).putExtra("title", title).putExtra("body", body);
        return PendingIntent.getBroadcast(context, 0, intent, flags | PendingIntent.FLAG_IMMUTABLE);
    }

    private static String clip(String value, int length) {
        return value.length() <= length ? value : value.substring(0, length);
    }
}
