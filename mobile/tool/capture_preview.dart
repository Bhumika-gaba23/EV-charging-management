// Regenerate with: flutter test tool/capture_preview.dart --update-goldens
import 'dart:convert';
import 'dart:io';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:chargeflow_mobile/main.dart';
import 'package:chargeflow_mobile/demo/demo_store.dart';
import 'package:chargeflow_mobile/demo/models.dart';

void main() {
  setUpAll(() async {
    // Widget tests normally use the Ahem square font. Load the SDK's actual
    // fonts so these review images resemble Android rather than test goldens.
    final configFile = File('.dart_tool/package_config.json');
    final config =
        jsonDecode(await configFile.readAsString()) as Map<String, dynamic>;
    final packages = config['packages'] as List;
    final flutter = packages.cast<Map<String, dynamic>>().firstWhere(
      (p) => p['name'] == 'flutter',
    );
    final packageRoot = configFile.absolute.uri.resolve(
      flutter['rootUri'] as String,
    );
    final fonts = Directory.fromUri(packageRoot).uri.resolve(
      '../../bin/cache/artifacts/material_fonts/',
    );
    for (final entry in {
      'Roboto': 'Roboto-Regular.ttf',
      'MaterialIcons': 'MaterialIcons-Regular.otf',
    }.entries) {
      final bytes = await File.fromUri(
        fonts.resolve(entry.value),
      ).readAsBytes();
      await (FontLoader(
        entry.key,
      )..addFont(Future.value(ByteData.sublistView(bytes)))).load();
    }
  });
  testWidgets('Capture Android demo previews', (tester) async {
    tester.view.physicalSize = const Size(420, 960);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);
    final store = DemoStore(persist: false, automaticTimer: false);
    const preview = Key('preview');
    await tester.pumpWidget(
      RepaintBoundary(
        key: preview,
        child: ChargeFlowApp(store: store),
      ),
    );
    await tester.pumpAndSettle();
    await expectLater(
      find.byKey(preview),
      matchesGoldenFile('../docs/screenshots/01-vehicle.png'),
    );
    store.selectVehicle(demoVehicles.first);
    await tester.pumpAndSettle();
    await expectLater(
      find.byKey(preview),
      matchesGoldenFile('../docs/screenshots/02-discover.png'),
    );
    await tester.tap(find.byTooltip('Central Circle · Demo'));
    await tester.pumpAndSettle();
    await expectLater(
      find.byKey(preview),
      matchesGoldenFile('../docs/screenshots/03-station.png'),
    );
    await tester.pageBack();
    await tester.pumpAndSettle();
    final session = store.start(
      demoStations.first,
      demoStations.first.connectors.first,
      targetSoc: 80,
      budget: 300,
    );
    store.refresh(now: session.startedAt.add(const Duration(seconds: 10)));
    await tester.tap(find.text('Sessions'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('View live session'));
    await tester.pumpAndSettle();
    await expectLater(
      find.byKey(preview),
      matchesGoldenFile('../docs/screenshots/04-charging.png'),
    );
    await tester.pumpWidget(const SizedBox());
    store.dispose();
  });
}
