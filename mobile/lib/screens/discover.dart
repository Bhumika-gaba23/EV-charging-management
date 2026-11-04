import 'package:flutter/material.dart';
import 'package:geolocator/geolocator.dart';
import 'package:provider/provider.dart';
import '../demo/demo_store.dart';
import '../demo/models.dart';
import '../theme.dart';
import '../widgets/common.dart';
import '../widgets/station_map.dart';
import 'home.dart';
import 'station_details.dart';

class DiscoverPage extends StatefulWidget {
  const DiscoverPage({super.key});
  @override
  State<DiscoverPage> createState() => _DiscoverPageState();
}

class _DiscoverPageState extends State<DiscoverPage> {
  String query = '';
  bool availableOnly = false, savedOnly = false, locating = false;
  double latitude = 28.6315, longitude = 77.2167;
  bool deviceLocation = false;

  Future<void> locate() async {
    setState(() => locating = true);
    try {
      if (!await Geolocator.isLocationServiceEnabled()) {
        throw StateError(
            'Location services are off. Enable them or use the New Delhi demo starting point.');
      }
      var permission = await Geolocator.checkPermission();
      if (permission == LocationPermission.denied) {
        permission = await Geolocator.requestPermission();
      }
      if (permission == LocationPermission.denied ||
          permission == LocationPermission.deniedForever) {
        throw StateError(
            'Location permission was not granted. You can still explore the New Delhi demo.');
      }
      final position = await Geolocator.getCurrentPosition(
          locationSettings: const LocationSettings(
              accuracy: LocationAccuracy.high,
              timeLimit: Duration(seconds: 15)));
      if (!mounted) return;
      setState(() {
        latitude = position.latitude;
        longitude = position.longitude;
        deviceLocation = true;
      });
    } catch (error) {
      if (mounted) {
        showMessage(
            context,
            error is StateError
                ? error.message
                : 'Could not get your location. The demo starting point is still available.');
      }
    } finally {
      if (mounted) setState(() => locating = false);
    }
  }

  void openStation(DemoStation station) => Navigator.push(context,
      MaterialPageRoute(builder: (_) => StationDetails(station: station)));

  @override
  Widget build(BuildContext context) {
    final store = context.watch<DemoStore>();
    final stations = demoStations
        .where((s) =>
            s.supports(store.vehicle) &&
            (!availableOnly || s.availableFor(store.vehicle)) &&
            (!savedOnly || store.favourites.contains(s.id)) &&
            '${s.name} ${s.area}'
                .toLowerCase()
                .contains(query.toLowerCase().trim()))
        .toList()
      ..sort((a, b) => a
          .distanceFrom(latitude, longitude)
          .compareTo(b.distanceFrom(latitude, longitude)));
    return ListView(
        padding: const EdgeInsets.fromLTRB(20, 8, 20, 20),
        children: [
          const DemoNotice(compact: true),
          const SizedBox(height: 20),
          const Text('Find your\nnext charge.',
              style: TextStyle(
                  fontSize: 36,
                  fontWeight: FontWeight.w700,
                  height: 1.08,
                  letterSpacing: -1.3)),
          const SizedBox(height: 20),
          Surface(
              padding: 0,
              child: ListTile(
                leading: Icon(vehicleIcon(store.vehicle.kind), size: 30),
                title: Text(store.vehicle.kind,
                    style: const TextStyle(fontWeight: FontWeight.w700)),
                subtitle: const Text('Change vehicle',
                    style: TextStyle(color: muted, fontSize: 12)),
                trailing: const Icon(Icons.keyboard_arrow_down),
                onTap: () => showModalBottomSheet<void>(
                    context: context,
                    isScrollControlled: true,
                    builder: (sheetContext) => SafeArea(
                            child: SingleChildScrollView(
                                child: Padding(
                          padding: const EdgeInsets.all(20),
                          child:
                              Column(mainAxisSize: MainAxisSize.min, children: [
                            const SectionTitle('Choose your vehicle'),
                            for (final vehicle in demoVehicles)
                              Padding(
                                padding: const EdgeInsets.only(bottom: 12),
                                child: VehicleOption(
                                    vehicle: vehicle,
                                    selected: vehicle == store.vehicle,
                                    onTap: () {
                                      store.selectVehicle(vehicle);
                                      Navigator.pop(sheetContext);
                                    }),
                              ),
                          ]),
                        )))),
              )),
          const SizedBox(height: 16),
          TextField(
              onChanged: (value) => setState(() => query = value),
              decoration: const InputDecoration(
                  hintText: 'Search New Delhi demo stations',
                  prefixIcon: Icon(Icons.search),
                  contentPadding: EdgeInsets.all(16))),
          const SizedBox(height: 12),
          Row(children: [
            const Icon(Icons.near_me_outlined, size: 15, color: muted),
            const SizedBox(width: 6),
            Expanded(
                child: Text(
                    deviceLocation
                        ? 'Using your device location'
                        : 'Starting point: Connaught Place (demo)',
                    style: const TextStyle(color: muted, fontSize: 11))),
            IconButton(
                onPressed: locating ? null : locate,
                tooltip: 'Use my location',
                icon: locating
                    ? const SizedBox(
                        width: 18,
                        height: 18,
                        child: CircularProgressIndicator(strokeWidth: 2))
                    : const Icon(Icons.my_location, size: 20)),
          ]),
          if (deviceLocation)
            Align(
                alignment: Alignment.centerLeft,
                child: TextButton(
                    onPressed: () => setState(() {
                          latitude = 28.6315;
                          longitude = 77.2167;
                          deviceLocation = false;
                        }),
                    child: const Text('Use New Delhi demo starting point'))),
          StationMap(
              stations: stations,
              onStation: openStation,
              latitude: latitude,
              longitude: longitude,
              deviceLocation: deviceLocation),
          const SizedBox(height: 14),
          Wrap(spacing: 8, runSpacing: 6, children: [
            FilterChip(
                label: const Text('Available now'),
                selected: availableOnly,
                onSelected: (value) => setState(() => availableOnly = value)),
            FilterChip(
                label: const Text('Saved'),
                selected: savedOnly,
                onSelected: (value) => setState(() => savedOnly = value)),
          ]),
          const SizedBox(height: 16),
          Row(children: [
            const Expanded(
                child: Text('Nearby stations',
                    style:
                        TextStyle(fontSize: 21, fontWeight: FontWeight.w700))),
            Text('${stations.length} compatible',
                style: const TextStyle(fontSize: 11, color: muted)),
          ]),
          const SizedBox(height: 7),
          const Text('Fictional stations · sorted by straight-line distance',
              style: TextStyle(fontSize: 11, color: muted)),
          const SizedBox(height: 16),
          if (stations.isEmpty)
            const Surface(
                child: Text(
                    'No matching stations. Try another area, switch vehicle, or turn off a filter.',
                    style: TextStyle(color: muted, height: 1.6))),
          for (final station in stations)
            StationTile(
                station: station,
                vehicle: store.vehicle,
                distance: station.distanceFrom(latitude, longitude),
                onTap: () => openStation(station),
                favourite: store.favourites.contains(station.id),
                onFavourite: () => store.toggleFavourite(station.id)),
          const SizedBox(height: 8),
          const DemoNotice(),
        ]);
  }
}
