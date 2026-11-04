import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:chargeflow_mobile/demo/demo_store.dart';
import 'package:chargeflow_mobile/demo/models.dart';
import 'package:chargeflow_mobile/screens/scanner.dart';

void main() {
  late DemoStore store;
  final start = DateTime(2026, 11, 2, 12);
  setUp(() => store = DemoStore(persist: false, automaticTimer: false));
  tearDown(() => store.dispose());

  test('two-wheelers reject car connectors and use vehicle power limit', () {
    store.selectVehicle(demoVehicles[1]);
    final station = demoStations.first;
    expect(
        () => store.start(station, station.connectors.first,
            targetSoc: 80, budget: 100, now: start),
        throwsStateError);
    final session = store.start(station, station.connectors.last,
        targetSoc: 80, budget: 100, now: start);
    expect(session.powerKw, 1.5);
    store.refresh(now: start.add(const Duration(seconds: 10)));
    expect(session.deliveredKwh, closeTo(0.25, 0.00001));
  });

  test('target completes automatically and keeps delivered energy capped', () {
    final station = demoStations.first;
    final session = store.start(station, station.connectors.first,
        targetSoc: 80, budget: 1000, now: start);
    store.refresh(now: start.add(const Duration(hours: 2)));
    expect(session.soc, closeTo(80, 0.00001));
    expect(session.deliveredKwh, 22);
    expect(session.reason, 'Charge target reached');
    expect(store.active, isNull);
    expect(session.endedAt!.difference(start).inMilliseconds, 26400);
    expect(session.settled, false);
    store.settle(session);
    expect(session.settled, true);
  });

  test('budget cap wins over target without overcharging', () {
    final station = demoStations.first;
    final session = store.start(station, station.connectors.first,
        targetSoc: 100, budget: 50, now: start);
    store.refresh(now: start.add(const Duration(minutes: 10)));
    expect(session.cost, closeTo(50, 0.00001));
    expect(session.soc, lessThan(100));
    expect(session.reason, 'Budget limit reached');
  });

  test('one active session and pending checkout prevent double starts', () {
    final station = demoStations.first;
    final session = store.start(station, station.connectors.first,
        targetSoc: 80, budget: 100, now: start);
    expect(
        () => store.start(station, station.connectors.first,
            targetSoc: 80, budget: 100),
        throwsStateError);
    expect(() => store.settle(session), throwsStateError);
    store.stop(session, now: start.add(const Duration(seconds: 1)));
    expect(session.deliveredKwh, closeTo(50 / 60, 0.00001));
    expect(
        () => store.start(station, station.connectors.first,
            targetSoc: 80, budget: 100),
        throwsStateError);
    store.settle(session);
    expect(
        store
            .start(station, station.connectors.first,
                targetSoc: 80, budget: 100)
            .endedAt,
        isNull);
  });

  test('occupied connectors and invalid targets cannot start', () {
    expect(
        () => store.start(demoStations[2], demoStations[2].connectors.first,
            targetSoc: 80, budget: 100),
        throwsStateError);
    for (final target in [25.0, 110.0, double.nan]) {
      expect(
          () => store.start(
              demoStations.first, demoStations.first.connectors.first,
              targetSoc: target, budget: 100),
          throwsArgumentError);
    }
  });

  test('saved profiles, favourites and sessions survive restart', () async {
    SharedPreferences.setMockInitialValues({});
    final first = DemoStore(automaticTimer: false);
    await first.restore();
    first.selectVehicle(demoVehicles.last);
    first.toggleFavourite('CP');
    final session = first.start(
        demoStations.first, demoStations.first.connectors.last,
        targetSoc: 80, budget: 100, now: start);
    first.stop(session, now: start.add(const Duration(seconds: 2)));
    first.settle(session);
    await Future<void>.delayed(Duration.zero);
    first.dispose();
    final restored = DemoStore(automaticTimer: false);
    await restored.restore();
    expect(restored.vehicle.id, 'bike');
    expect(restored.favourites, contains('CP'));
    expect(restored.sessions.single.settled, true);
    expect(restored.sessions.single.deliveredKwh, closeTo(0.1, 0.00001));
    restored.dispose();
  });

  test('QR accepts demo, URL and prefixed payloads', () {
    expect(parseChargerCode(' cp-01 '), 'CP-01');
    expect(parseChargerCode('CHARGEFLOW:CP-01'), 'CP-01');
    expect(parseChargerCode('https://example.com/charger/CP-01'), 'CP-01');
    expect(parseChargerCode('https://example.com/connect?chargerId=CP-01'),
        'CP-01');
    expect(parseChargerCode(''), '');
  });
}
