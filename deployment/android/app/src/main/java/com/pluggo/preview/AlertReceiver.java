package com.pluggo.preview;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;

/** Shows a scheduled charging alert when its alarm fires. */
public class AlertReceiver extends BroadcastReceiver {
    @Override public void onReceive(Context context, Intent intent) {
        String tag = intent.getStringExtra("tag");
        if (tag == null) return;
        Alerts.show(context, tag, String.valueOf(intent.getStringExtra("title")), String.valueOf(intent.getStringExtra("body")));
    }
}
