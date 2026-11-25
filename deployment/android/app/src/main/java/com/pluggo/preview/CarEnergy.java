package com.pluggo.preview;

import android.content.pm.PackageManager;
import androidx.annotation.NonNull;
import androidx.car.app.CarContext;
import androidx.car.app.hardware.CarHardwareManager;
import androidx.car.app.hardware.common.CarValue;
import androidx.car.app.hardware.common.OnCarDataAvailableListener;
import androidx.car.app.hardware.info.CarInfo;
import androidx.car.app.hardware.info.EnergyLevel;
import androidx.car.app.hardware.info.EnergyProfile;
import androidx.car.app.hardware.info.Model;
import androidx.core.content.ContextCompat;
import androidx.lifecycle.DefaultLifecycleObserver;
import androidx.lifecycle.Lifecycle;
import androidx.lifecycle.LifecycleOwner;
import java.util.Collections;
import java.util.List;
import java.util.concurrent.Executor;
import org.json.JSONArray;
import org.json.JSONObject;

/**
 * Reads the car's own energy data through Android Auto / Android Automotive: battery %, range,
 * the low-battery warning, its charging ports and its make and model. The driver allows it once
 * ("car energy data"); the readings go to the Pluggo page through LiveState.
 */
final class CarEnergy {
    static final String PERMISSION = "com.google.android.gms.permission.CAR_FUEL";
    private CarEnergy() { }

    static void start(CarContext context, Lifecycle lifecycle) {
        if (ContextCompat.checkSelfPermission(context, PERMISSION) == PackageManager.PERMISSION_GRANTED) { subscribe(context, lifecycle); return; }
        try {
            context.requestPermissions(Collections.singletonList(PERMISSION), (granted, rejected) -> {
                if (granted.contains(PERMISSION)) subscribe(context, lifecycle);
            });
        } catch (Exception unsupported) { }
    }

    private static <T> T value(CarValue<T> carValue) {
        return carValue != null && carValue.getStatus() == CarValue.STATUS_SUCCESS ? carValue.getValue() : null;
    }

    private static void subscribe(CarContext context, Lifecycle lifecycle) {
        CarInfo info;
        try { info = context.getCarService(CarHardwareManager.class).getCarInfo(); }
        catch (Exception unavailable) { return; }
        Executor main = ContextCompat.getMainExecutor(context);
        JSONObject car = new JSONObject();
        OnCarDataAvailableListener<EnergyLevel> energy = level -> {
            try {
                Float battery = value(level.getBatteryPercent()), range = value(level.getRangeRemainingMeters());
                Boolean low = value(level.getEnergyIsLow());
                car.put("connected", true);
                car.put("battery", battery == null ? JSONObject.NULL : Math.round(battery * 10) / 10.0);
                car.put("rangeKm", range == null ? JSONObject.NULL : Math.round(range / 100) / 10.0);
                car.put("low", low != null && low);
                LiveState.carUpdate(context, car);
            } catch (Exception ignored) { }
        };
        try {
            info.fetchEnergyProfile(main, profile -> {
                try {
                    List<Integer> ports = value(profile.getEvConnectorTypes());
                    JSONArray types = new JSONArray();
                    if (ports != null) for (int port : ports) {
                        if (port == EnergyProfile.EVCONNECTOR_TYPE_COMBO_2) types.put("CCS2");
                        else if (port == EnergyProfile.EVCONNECTOR_TYPE_MENNEKES) types.put("Type 2");
                    }
                    car.put("connectors", types);
                    LiveState.carUpdate(context, car);
                } catch (Exception ignored) { }
            });
        } catch (Exception ignored) { }
        try {
            info.fetchModel(main, (Model model) -> {
                try {
                    String make = value(model.getManufacturer()), name = value(model.getName());
                    car.put("name", ((make == null ? "" : make + " ") + (name == null ? "" : name)).trim());
                    LiveState.carUpdate(context, car);
                } catch (Exception ignored) { }
            });
        } catch (Exception ignored) { }
        try { info.addEnergyLevelListener(main, energy); } catch (Exception unavailable) { return; }
        lifecycle.addObserver(new DefaultLifecycleObserver() {
            @Override public void onDestroy(@NonNull LifecycleOwner owner) {
                try { info.removeEnergyLevelListener(energy); } catch (Exception ignored) { }
                LiveState.carDisconnected();
            }
        });
    }
}
