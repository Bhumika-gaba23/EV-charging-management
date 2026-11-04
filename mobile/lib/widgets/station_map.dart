import 'package:flutter/material.dart';
import 'package:google_maps_flutter/google_maps_flutter.dart';
import '../demo/models.dart';
import '../theme.dart';

const mapsKey = String.fromEnvironment('GOOGLE_MAPS_API_KEY');
const darkMapStyle = '''[
 {"elementType":"geometry","stylers":[{"color":"#202126"}]},
 {"elementType":"labels.text.stroke","stylers":[{"color":"#202126"}]},
 {"elementType":"labels.text.fill","stylers":[{"color":"#b5b7bf"}]},
 {"featureType":"poi","stylers":[{"visibility":"off"}]},
 {"featureType":"road","elementType":"geometry","stylers":[{"color":"#393b43"}]},
 {"featureType":"water","elementType":"geometry","stylers":[{"color":"#111217"}]}
]''';

class StationMap extends StatelessWidget {
  const StationMap(
      {super.key,
      required this.stations,
      required this.onStation,
      required this.latitude,
      required this.longitude,
      required this.deviceLocation});
  final List<DemoStation> stations;
  final ValueChanged<DemoStation> onStation;
  final double latitude, longitude;
  final bool deviceLocation;
  @override
  Widget build(BuildContext context) => ClipRRect(
        borderRadius: BorderRadius.circular(24),
        child: SizedBox(
            height: 290,
            child: mapsKey.isNotEmpty
                ? GoogleMap(
                    key: ValueKey('$latitude,$longitude'),
                    initialCameraPosition: CameraPosition(
                        target: LatLng(latitude, longitude), zoom: 12),
                    style: darkMapStyle,
                    zoomControlsEnabled: false,
                    myLocationEnabled: deviceLocation,
                    myLocationButtonEnabled: false,
                    mapToolbarEnabled: false,
                    markers: {
                      Marker(
                          markerId: const MarkerId('origin'),
                          position: LatLng(latitude, longitude),
                          infoWindow: InfoWindow(
                              title: deviceLocation
                                  ? 'Your location'
                                  : 'Demo starting point')),
                      ...stations.map((station) => Marker(
                            markerId: MarkerId(station.id),
                            position: LatLng(station.lat, station.lng),
                            icon: BitmapDescriptor.defaultMarkerWithHue(
                                BitmapDescriptor.hueAzure),
                            infoWindow: InfoWindow(
                                title: '${station.name} · DEMO',
                                snippet: station.area),
                            onTap: () => onStation(station),
                          )),
                    },
                  )
                : _IllustratedMap(stations: stations, onStation: onStation)),
      );
}

class _IllustratedMap extends StatelessWidget {
  const _IllustratedMap({required this.stations, required this.onStation});
  final List<DemoStation> stations;
  final ValueChanged<DemoStation> onStation;
  @override
  Widget build(BuildContext context) => Container(
        color: const Color(0xFF191B20),
        child: LayoutBuilder(
            builder: (context, bounds) => Stack(children: [
                  const Positioned.fill(child: CustomPaint(painter: _Roads())),
                  const Positioned(
                      left: 18,
                      top: 16,
                      child: Text('NEW DELHI',
                          style: TextStyle(
                              color: muted, letterSpacing: 3, fontSize: 11))),
                  const Positioned(
                      right: 14,
                      top: 12,
                      child: Chip(
                          avatar: Icon(Icons.layers_outlined, size: 15),
                          label:
                              Text('Demo map', style: TextStyle(fontSize: 10)),
                          visualDensity: VisualDensity.compact)),
                  for (final station in stations)
                    Positioned(
                      left: _x(station.lng, bounds.maxWidth),
                      top: _y(station.lat),
                      child: Tooltip(
                          message: '${station.name} · Demo',
                          child: Material(
                            color: silver,
                            borderRadius: BorderRadius.circular(14),
                            child: InkWell(
                                borderRadius: BorderRadius.circular(14),
                                onTap: () => onStation(station),
                                child: Padding(
                                    padding: const EdgeInsets.all(9),
                                    child: Icon(Icons.bolt,
                                        color: Colors.black, size: 20))),
                          )),
                    ),
                  const Positioned(
                      left: 14,
                      bottom: 14,
                      right: 14,
                      child: Text(
                          'Illustration · not GPS or a route\nGoogle Maps appears when configured.',
                          style: TextStyle(
                              color: muted, fontSize: 10, height: 1.6))),
                ])),
      );
  double _x(double lng, double width) =>
      ((lng - 77.205) / 0.04 * (width - 64)).clamp(16, width - 50).toDouble();
  double _y(double lat) =>
      ((28.65 - lat) / 0.15 * 180 + 25).clamp(50, 205).toDouble();
}

class _Roads extends CustomPainter {
  const _Roads();
  @override
  void paint(Canvas canvas, Size size) {
    final minor = Paint()
      ..color = const Color(0xFF24262C)
      ..strokeWidth = 9;
    for (double x = -80; x < size.width + 100; x += 53) {
      canvas.drawLine(Offset(x, 0), Offset(x + 90, size.height), minor);
    }
    for (double y = 40; y < size.height; y += 57) {
      canvas.drawLine(Offset(0, y), Offset(size.width, y - 50), minor);
    }
    final ring = Paint()
      ..color = const Color(0xFF3A3C44)
      ..strokeWidth = 12
      ..style = PaintingStyle.stroke;
    canvas.drawCircle(Offset(size.width * 0.42, 100), 48, ring);
    canvas.drawLine(Offset(size.width * 0.5, 145),
        Offset(size.width * 0.7, size.height), ring);
  }

  @override
  bool shouldRepaint(covariant CustomPainter oldDelegate) => false;
}
