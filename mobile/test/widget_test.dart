import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:chargeflow_mobile/main.dart';
import 'package:chargeflow_mobile/demo/demo_store.dart';
import 'package:chargeflow_mobile/demo/models.dart';

void main() {
  testWidgets('vehicle onboarding uses the black and silver theme',
      (tester) async {
    tester.view.physicalSize = const Size(420, 960);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);
    final store = DemoStore(persist: false, automaticTimer: false);
    await tester.pumpWidget(ChargeFlowApp(store: store));
    expect(find.text('EV Car'), findsOneWidget);
    expect(find.text('EV Bike'), findsOneWidget);
    expect(find.text('EV Scooter'), findsOneWidget);
    final material = tester.widget<MaterialApp>(find.byType(MaterialApp));
    expect(material.theme!.brightness, Brightness.dark);
    await tester.tap(find.text('EV Car'));
    await tester.pumpAndSettle();
    expect(find.text('Find your\nnext charge.'), findsOneWidget);
    expect(find.text('Demo map'), findsOneWidget);
    expect(tester.takeException(), isNull);
    await tester.pumpWidget(const SizedBox());
    store.dispose();
  });

  testWidgets('demo charge reaches zero-money checkout and receipt',
      (tester) async {
    tester.view.physicalSize = const Size(420, 960);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);
    final store = DemoStore(persist: false, automaticTimer: false);
    store.selectVehicle(demoVehicles.first);
    await tester.pumpWidget(ChargeFlowApp(store: store));
    // Tap the first demo station marker in the offline map.
    await tester.tap(find.byTooltip('Central Circle · Demo'));
    await tester.pumpAndSettle();
    await tester.scrollUntilVisible(find.text('Try demo charging').first, 250,
        scrollable: find.byType(Scrollable).last);
    await tester.tap(find.text('Try demo charging').first);
    await tester.pumpAndSettle();
    await tester.scrollUntilVisible(find.text('Start simulated charging'), 250,
        scrollable: find.byType(Scrollable).last);
    await tester.tap(find.text('Start simulated charging'));
    await tester.pumpAndSettle();
    expect(store.active, isNotNull);
    final session = store.active!;
    store.refresh(now: session.startedAt.add(const Duration(minutes: 1)));
    await tester.pumpAndSettle();
    await tester.scrollUntilVisible(find.text('Continue to demo checkout'), 250,
        scrollable: find.byType(Scrollable).last);
    await tester.tap(find.text('Continue to demo checkout'));
    await tester.pumpAndSettle();
    expect(find.text('Amount collected'), findsOneWidget);
    expect(find.text('₹0.00'), findsOneWidget);
    await tester.scrollUntilVisible(
        find.text('Complete demo payment · ₹0'), 200,
        scrollable: find.byType(Scrollable).last);
    await tester.tap(find.text('Complete demo payment · ₹0'));
    await tester.pumpAndSettle();
    expect(session.settled, true);
    expect(find.text('Demo receipt'), findsOneWidget);
    expect(tester.takeException(), isNull);
    await tester.pumpWidget(const SizedBox());
    store.dispose();
  });
}
