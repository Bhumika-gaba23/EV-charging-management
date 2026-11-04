import 'package:flutter/material.dart';
import '../demo/models.dart';
import '../theme.dart';

IconData vehicleIcon(String kind) => switch (kind) {
      'EV Scooter' => Icons.electric_scooter_rounded,
      'EV Bike' => Icons.electric_bike_rounded,
      _ => Icons.electric_car_rounded,
    };

class Surface extends StatelessWidget {
  const Surface({super.key, required this.child, this.padding = 18});
  final Widget child;
  final double padding;
  @override
  Widget build(BuildContext context) => Material(
        color: panel,
        shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(22),
            side: const BorderSide(color: edge)),
        clipBehavior: Clip.antiAlias,
        child: Padding(padding: EdgeInsets.all(padding), child: child),
      );
}

class DemoNotice extends StatelessWidget {
  const DemoNotice({super.key, this.compact = false});
  final bool compact;
  @override
  Widget build(BuildContext context) => Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Icon(Icons.science_outlined, size: 16, color: muted),
          const SizedBox(width: 8),
          Expanded(
              child: Text(
                  compact
                      ? 'COLLEGE DEMO · NEW DELHI'
                      : 'Demo only. Stations and charging are simulated. No real money is charged.',
                  style: TextStyle(
                      color: muted,
                      fontSize: compact ? 10 : 12,
                      height: 1.5,
                      letterSpacing: compact ? 1.6 : 0))),
        ],
      );
}

class SectionTitle extends StatelessWidget {
  const SectionTitle(this.title, {super.key, this.subtitle});
  final String title;
  final String? subtitle;
  @override
  Widget build(BuildContext context) => Padding(
        padding: const EdgeInsets.only(bottom: 16, top: 8),
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Text(title,
              style: const TextStyle(
                  fontSize: 24,
                  fontWeight: FontWeight.w700,
                  letterSpacing: -0.7)),
          if (subtitle != null) ...[
            const SizedBox(height: 6),
            Text(subtitle!, style: const TextStyle(color: muted, height: 1.5)),
          ],
        ]),
      );
}

class StationTile extends StatelessWidget {
  const StationTile(
      {super.key,
      required this.station,
      required this.vehicle,
      required this.distance,
      required this.onTap,
      required this.favourite,
      required this.onFavourite});
  final DemoStation station;
  final DemoVehicle vehicle;
  final double distance;
  final VoidCallback onTap, onFavourite;
  final bool favourite;
  @override
  Widget build(BuildContext context) {
    final available = station.availableFor(vehicle);
    final supported = station.supports(vehicle);
    return Padding(
      padding: const EdgeInsets.only(bottom: 12),
      child: Material(
        color: panel,
        shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(22),
            side: const BorderSide(color: edge)),
        clipBehavior: Clip.antiAlias,
        child: InkWell(
            onTap: onTap,
            child: Padding(
              padding: const EdgeInsets.fromLTRB(16, 12, 10, 16),
              child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(children: [
                      Container(
                          padding: const EdgeInsets.all(10),
                          decoration: BoxDecoration(
                              color: const Color(0xFF292B31),
                              borderRadius: BorderRadius.circular(13)),
                          child:
                              const Icon(Icons.ev_station_outlined, size: 23)),
                      const SizedBox(width: 12),
                      Expanded(
                          child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                            Text(station.name,
                                style: const TextStyle(
                                    fontWeight: FontWeight.w700, fontSize: 16)),
                            const SizedBox(height: 3),
                            Text(station.area,
                                style: const TextStyle(
                                    color: muted, fontSize: 12)),
                          ])),
                      IconButton(
                          onPressed: onFavourite,
                          tooltip: favourite
                              ? 'Remove saved station'
                              : 'Save station',
                          icon: Icon(favourite
                              ? Icons.bookmark
                              : Icons.bookmark_border)),
                    ]),
                    const SizedBox(height: 16),
                    Wrap(spacing: 12, runSpacing: 8, children: [
                      Text(
                          supported
                              ? available
                                  ? '● Available'
                                  : '◷ In use'
                              : 'Incompatible',
                          style: TextStyle(
                              fontSize: 12, color: available ? silver : muted)),
                      Text('${distance.toStringAsFixed(1)} km away',
                          style: const TextStyle(color: muted, fontSize: 12)),
                      Text('₹${station.rate.toStringAsFixed(0)}/kWh',
                          style: const TextStyle(fontSize: 12)),
                      Text(
                          station.connectors
                              .map((c) => c.type)
                              .toSet()
                              .join(' · '),
                          style: const TextStyle(color: muted, fontSize: 12)),
                    ]),
                  ]),
            )),
      ),
    );
  }
}

void showMessage(BuildContext context, String message) =>
    ScaffoldMessenger.of(context)
        .showSnackBar(SnackBar(content: Text(message)));
