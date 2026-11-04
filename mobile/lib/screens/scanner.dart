import 'package:flutter/material.dart';
import 'package:mobile_scanner/mobile_scanner.dart';
import 'package:provider/provider.dart';
import '../demo/demo_store.dart';
import '../demo/models.dart';
import '../theme.dart';
import '../widgets/common.dart';
import 'charging.dart';

String parseChargerCode(String raw) {
  final input = raw.trim();
  final uri = Uri.tryParse(input);
  if (uri != null && (uri.scheme == 'https' || uri.scheme == 'http')) {
    return (uri.queryParameters['chargerId'] ??
            uri.pathSegments.lastOrNull ??
            '')
        .trim()
        .toUpperCase();
  }
  return input
      .replaceFirst(RegExp(r'^CHARGEFLOW:', caseSensitive: false), '')
      .trim()
      .toUpperCase();
}

class ChargerScanner extends StatefulWidget {
  const ChargerScanner({super.key, required this.station});
  final DemoStation station;
  @override
  State<ChargerScanner> createState() => _ChargerScannerState();
}

class _ChargerScannerState extends State<ChargerScanner> {
  final input = TextEditingController();
  final camera = MobileScannerController(autoStart: false);
  bool scanning = false, handling = false;
  String? error;

  Future<void> verify(String raw) async {
    if (handling) return;
    final id = parseChargerCode(raw);
    final connector =
        widget.station.connectors.where((c) => c.id == id).firstOrNull;
    final vehicle = context.read<DemoStore>().vehicle;
    if (connector == null ||
        !connector.supports(vehicle) ||
        !connector.available) {
      setState(() => error = connector == null
          ? 'Unknown code for this station. Try one of the listed demo IDs.'
          : 'This connector is occupied or incompatible with your vehicle.');
      return;
    }
    handling = true;
    if (scanning) await camera.stop();
    if (!mounted) return;
    await Navigator.pushReplacement(
        context,
        MaterialPageRoute(
            builder: (_) =>
                ChargeSetup(station: widget.station, connector: connector)));
  }

  @override
  void dispose() {
    input.dispose();
    camera.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => Scaffold(
        appBar: AppBar(title: const Text('Connect to a charger')),
        body: ListView(padding: const EdgeInsets.all(20), children: [
          const SectionTitle('Scan. Connect. Charge.',
              subtitle: 'Camera access is optional. A demo code works too.'),
          if (scanning)
            SizedBox(
                height: 260,
                child: ClipRRect(
                  borderRadius: BorderRadius.circular(22),
                  child: MobileScanner(
                    controller: camera,
                    onDetect: (capture) {
                      final raw = capture.barcodes.firstOrNull?.rawValue;
                      if (raw != null) verify(raw);
                    },
                    errorBuilder: (context, exception, child) => const Center(
                        child: Padding(
                            padding: EdgeInsets.all(20),
                            child: Text(
                                'Camera unavailable or permission denied. Enter a demo code below.',
                                textAlign: TextAlign.center))),
                  ),
                ))
          else
            const Surface(
                child: SizedBox(
                    height: 160,
                    child: Center(
                        child: Icon(Icons.qr_code_scanner,
                            size: 80, color: muted)))),
          const SizedBox(height: 12),
          OutlinedButton.icon(
              onPressed: () async {
                if (scanning) {
                  await camera.stop();
                  if (mounted) setState(() => scanning = false);
                } else {
                  setState(() => scanning = true);
                  // MobileScanner starts the controller when attached to the widget.
                  WidgetsBinding.instance.addPostFrameCallback((_) async {
                    try {
                      await camera.start();
                    } catch (_) {
                      if (mounted) {
                        setState(() => error =
                            'Camera unavailable. Use a demo code instead.');
                      }
                    }
                  });
                }
              },
              icon: Icon(scanning
                  ? Icons.stop_circle_outlined
                  : Icons.camera_alt_outlined),
              label: Text(scanning ? 'Stop camera' : 'Start camera')),
          const SizedBox(height: 22),
          TextField(
              controller: input,
              textCapitalization: TextCapitalization.characters,
              onSubmitted: verify,
              decoration: const InputDecoration(
                  labelText: 'Charger code', hintText: 'e.g. CP-01')),
          if (error != null)
            Padding(
                padding: const EdgeInsets.only(top: 12),
                child: Text(error!,
                    style:
                        TextStyle(color: Theme.of(context).colorScheme.error))),
          const SizedBox(height: 12),
          FilledButton(
              onPressed: () => verify(input.text),
              child: const Text('Verify connector')),
          const SizedBox(height: 24),
          const Text('DEMO CODES AT THIS STATION',
              style: TextStyle(color: muted, fontSize: 11, letterSpacing: 1.4)),
          const SizedBox(height: 8),
          Wrap(spacing: 8, runSpacing: 8, children: [
            for (final connector in widget.station.connectors)
              ActionChip(
                  label: Text(connector.id),
                  onPressed: () => setState(() => input.text = connector.id)),
          ]),
          const SizedBox(height: 24),
          const DemoNotice(),
        ]),
      );
}
