import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:url_launcher/url_launcher.dart';
import '../demo/demo_store.dart';
import '../demo/models.dart';
import '../theme.dart';
import '../widgets/common.dart';
import 'charging.dart';
import 'scanner.dart';

class StationDetails extends StatelessWidget {
  const StationDetails({super.key, required this.station});
  final DemoStation station;
  @override
  Widget build(BuildContext context) {
    final store = context.watch<DemoStore>();
    return Scaffold(
      appBar: AppBar(title: const Text('Station details'), actions: [
        IconButton(
            onPressed: () => store.toggleFavourite(station.id),
            tooltip: 'Save station',
            icon: Icon(store.favourites.contains(station.id)
                ? Icons.bookmark
                : Icons.bookmark_border)),
      ]),
      body: ListView(padding: const EdgeInsets.all(20), children: [
        Container(
            height: 140,
            alignment: Alignment.center,
            decoration: BoxDecoration(
                borderRadius: BorderRadius.circular(24),
                gradient: const LinearGradient(
                    colors: [Color(0xFF373941), Color(0xFF15161B)]),
                border: Border.all(color: edge)),
            child: const Icon(Icons.ev_station_rounded, size: 86)),
        const SizedBox(height: 24),
        const DemoNotice(compact: true),
        SectionTitle(station.name, subtitle: '${station.area}, New Delhi'),
        Wrap(spacing: 8, runSpacing: 8, children: [
          for (final amenity in station.amenities)
            Chip(label: Text(amenity, style: const TextStyle(fontSize: 11))),
        ]),
        const SizedBox(height: 14),
        Surface(
            child: Row(children: [
          const Icon(Icons.currency_rupee),
          const SizedBox(width: 12),
          Expanded(
              child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                Text('₹${station.rate.toStringAsFixed(0)} / kWh',
                    style: const TextStyle(
                        fontSize: 22, fontWeight: FontWeight.w700)),
                const Text('Fictional tariff · no extra demo fees',
                    style: TextStyle(color: muted, fontSize: 12)),
              ])),
        ])),
        const SizedBox(height: 16),
        OutlinedButton.icon(
            icon: const Icon(Icons.directions_outlined),
            label: const Text('Open demo location in Google Maps'),
            onPressed: () async {
              final uri = Uri.https('www.google.com', '/maps/dir/', {
                'api': '1',
                'destination': '${station.lat},${station.lng}',
                'travelmode': 'driving',
              });
              try {
                final launched =
                    await launchUrl(uri, mode: LaunchMode.externalApplication);
                if (!launched && context.mounted) {
                  showMessage(
                      context, 'Google Maps could not open. Please try again.');
                }
              } catch (_) {
                if (context.mounted) {
                  showMessage(context, 'No maps app or browser is available.');
                }
              }
            }),
        const SizedBox(height: 6),
        const Text(
            'This is a fictional station pin. Do not travel here expecting a real charger.',
            style: TextStyle(color: muted, fontSize: 12, height: 1.5)),
        const SizedBox(height: 24),
        SectionTitle('Choose a connector',
            subtitle: 'Selected vehicle: ${store.vehicle.kind}'),
        for (final connector in station.connectors)
          Padding(
            padding: const EdgeInsets.only(bottom: 12),
            child: Surface(
                child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                  Row(children: [
                    const Icon(Icons.power_outlined),
                    const SizedBox(width: 10),
                    Expanded(
                        child: Text('${connector.type} · ${connector.kw} kW',
                            style: const TextStyle(
                                fontWeight: FontWeight.w700, fontSize: 16))),
                    Text(connector.id,
                        style: const TextStyle(color: muted, fontSize: 11)),
                  ]),
                  const SizedBox(height: 10),
                  Text(
                      !connector.supports(store.vehicle)
                          ? 'Not compatible with this demo vehicle'
                          : connector.available
                              ? 'Available · simulation only'
                              : 'In use · try another connector',
                      style: const TextStyle(color: muted, fontSize: 12)),
                  const SizedBox(height: 14),
                  SizedBox(
                      width: double.infinity,
                      child: FilledButton(
                        onPressed: connector.supports(store.vehicle) &&
                                connector.available
                            ? () => Navigator.push(
                                context,
                                MaterialPageRoute(
                                    builder: (_) => ChargeSetup(
                                        station: station,
                                        connector: connector)))
                            : null,
                        child: const Text('Try demo charging'),
                      )),
                ])),
          ),
        const SizedBox(height: 6),
        OutlinedButton.icon(
            onPressed: () => Navigator.push(
                context,
                MaterialPageRoute(
                    builder: (_) => ChargerScanner(station: station))),
            icon: const Icon(Icons.qr_code_scanner),
            label: const Text('Scan or enter charger code')),
        const SizedBox(height: 20),
        const DemoNotice(),
      ]),
    );
  }
}
