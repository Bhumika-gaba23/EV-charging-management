import 'dart:async';
import 'dart:convert';
import 'dart:math' as math;
import 'package:flutter/foundation.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'models.dart';

class DemoStore extends ChangeNotifier {
  DemoStore({this.persist = true, this.automaticTimer = true});
  final bool persist, automaticTimer;
  DemoVehicle vehicle = demoVehicles.first;
  bool onboarded = false;
  final Set<String> favourites = {};
  final List<DemoSession> sessions = [];
  Timer? _timer;
  SharedPreferences? _preferences;
  String? storageMessage;

  DemoSession? get active =>
      sessions.where((s) => s.endedAt == null).firstOrNull;

  Future<void> restore() async {
    if (!persist) return;
    try {
      _preferences = await SharedPreferences.getInstance();
      final raw = _preferences!.getString('chargeflow.demo.v1');
      if (raw != null) {
        final data = jsonDecode(raw) as Map<String, dynamic>;
        vehicle = demoVehicles.firstWhere((v) => v.id == data['vehicle']);
        onboarded = data['onboarded'] as bool;
        favourites.addAll((data['favourites'] as List).cast<String>());
        sessions.addAll((data['sessions'] as List).map(
            (s) => DemoSession.fromJson(Map<String, dynamic>.from(s as Map))));
        // Reject incompatible old/corrupt fixture references before rendering.
        for (final session in sessions) {
          session.vehicle;
          session.station;
        }
      }
    } catch (_) {
      sessions.clear();
      favourites.clear();
      vehicle = demoVehicles.first;
      onboarded = false;
      storageMessage = 'Saved demo could not be loaded. A fresh demo is ready.';
    }
    refresh();
    _startTimer();
  }

  Future<void> _save() async {
    if (!persist) return;
    try {
      _preferences ??= await SharedPreferences.getInstance();
      final saved = await _preferences!.setString(
          'chargeflow.demo.v1',
          jsonEncode({
            'vehicle': vehicle.id,
            'onboarded': onboarded,
            'favourites': favourites.toList(),
            'sessions': sessions.map((s) => s.toJson()).toList(),
          }));
      if (!saved) throw StateError('Storage unavailable');
    } catch (_) {
      storageMessage =
          'Device storage is unavailable. This demo may not survive a restart.';
      notifyListeners();
    }
  }

  void selectVehicle(DemoVehicle value) {
    vehicle = value;
    onboarded = true;
    unawaited(_save());
    notifyListeners();
  }

  void toggleFavourite(String id) {
    favourites.contains(id) ? favourites.remove(id) : favourites.add(id);
    unawaited(_save());
    notifyListeners();
  }

  DemoSession start(DemoStation station, DemoConnector connector,
      {required double targetSoc, required double budget, DateTime? now}) {
    if (active != null) throw StateError('A demo session is already running.');
    if (sessions.any((s) => s.endedAt != null && !s.settled)) {
      throw StateError(
          'Complete the previous demo checkout in Sessions first.');
    }
    if (!station.connectors.contains(connector) ||
        !connector.available ||
        !connector.supports(vehicle)) {
      throw StateError('Choose an available connector for your vehicle.');
    }
    if (!targetSoc.isFinite ||
        !budget.isFinite ||
        targetSoc <= 25 ||
        targetSoc > 100 ||
        budget <= 0) {
      throw ArgumentError('Choose a valid charging target and budget.');
    }
    final startedAt = now ?? DateTime.now();
    final session = DemoSession(
      id: 'CF-${startedAt.microsecondsSinceEpoch}',
      stationId: station.id,
      connectorId: connector.id,
      vehicleId: vehicle.id,
      startedAt: startedAt,
      targetSoc: targetSoc,
      budget: budget,
      powerKw: math.min(connector.kw, vehicle.maxKw),
    );
    sessions.insert(0, session);
    _startTimer();
    unawaited(_save());
    notifyListeners();
    return session;
  }

  void _startTimer() {
    if (!automaticTimer || active == null || _timer != null) return;
    _timer = Timer.periodic(const Duration(seconds: 1), (_) => refresh());
  }

  /// 60x demo clock: one real second equals one simulated charging minute.
  /// Timestamp-based calculation survives backgrounding and app restarts.
  void refresh({DateTime? now}) {
    final session = active;
    if (session == null) {
      _timer?.cancel();
      _timer = null;
      return;
    }
    final elapsed = math.max(
        0,
        (now ?? DateTime.now()).difference(session.startedAt).inMilliseconds /
            1000);
    session.deliveredKwh =
        math.min(elapsed * session.powerKw / 60, session.maximumEnergy);
    if (session.deliveredKwh >= session.maximumEnergy) {
      final realSeconds = session.maximumEnergy / session.powerKw * 60;
      session.endedAt = session.startedAt
          .add(Duration(milliseconds: (realSeconds * 1000).round()));
      session.reason = session.cost >= session.budget - 0.001
          ? 'Budget limit reached'
          : 'Charge target reached';
      _timer?.cancel();
      _timer = null;
      unawaited(_save());
    }
    notifyListeners();
  }

  void stop(DemoSession session, {DateTime? now}) {
    if (session.endedAt != null) return;
    refresh(now: now);
    if (session.endedAt == null) {
      session.endedAt = now ?? DateTime.now();
      session.reason = 'Stopped by you';
    }
    _timer?.cancel();
    _timer = null;
    unawaited(_save());
    notifyListeners();
  }

  void settle(DemoSession session) {
    if (session.endedAt == null) {
      throw StateError('Stop charging before checkout.');
    }
    session.settled = true;
    unawaited(_save());
    notifyListeners();
  }

  void reset() {
    _timer?.cancel();
    _timer = null;
    sessions.clear();
    favourites.clear();
    vehicle = demoVehicles.first;
    onboarded = false;
    storageMessage = null;
    unawaited(_save());
    notifyListeners();
  }

  @override
  void dispose() {
    _timer?.cancel();
    super.dispose();
  }
}
