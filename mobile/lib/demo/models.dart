import 'dart:math' as math;

/// Fictional profiles and stations. No operator or manufacturer claims.
class DemoVehicle {
  const DemoVehicle(this.id, this.name, this.kind, this.batteryKwh, this.maxKw,
      this.connectors);
  final String id, name, kind;
  final double batteryKwh, maxKw;
  final List<String> connectors;
}

const demoVehicles = [
  DemoVehicle('car', 'My electric car', 'EV Car', 40, 50, ['CCS2', 'Type 2']),
  DemoVehicle(
      'scooter', 'My electric scooter', 'EV Scooter', 3, 1.5, ['Demo AC']),
  DemoVehicle('bike', 'My electric bike', 'EV Bike', 5, 3, ['Demo AC']),
];

class DemoConnector {
  const DemoConnector(this.id, this.type, this.kw, {this.available = true});
  final String id, type;
  final double kw;
  final bool available;
  bool supports(DemoVehicle vehicle) => vehicle.connectors.contains(type);
}

class DemoStation {
  const DemoStation(this.id, this.name, this.area, this.lat, this.lng,
      this.rate, this.connectors, this.amenities);
  final String id, name, area;
  final double lat, lng, rate;
  final List<DemoConnector> connectors;
  final List<String> amenities;
  bool supports(DemoVehicle v) => connectors.any((c) => c.supports(v));
  bool availableFor(DemoVehicle v) =>
      connectors.any((c) => c.supports(v) && c.available);
  double distanceFrom(double latitude, double longitude) {
    double radians(double d) => d * math.pi / 180;
    final a = math.pow(math.sin(radians(lat - latitude) / 2), 2) +
        math.cos(radians(latitude)) *
            math.cos(radians(lat)) *
            math.pow(math.sin(radians(lng - longitude) / 2), 2);
    return 6371 * 2 * math.asin(math.sqrt(a.clamp(0, 1)));
  }
}

const demoStations = [
  DemoStation('CP', 'Central Circle', 'Connaught Place', 28.6328, 77.2197, 18, [
    DemoConnector('CP-01', 'CCS2', 50),
    DemoConnector('CP-02', 'Type 2', 22),
    DemoConnector('CP-03', 'Demo AC', 3.3),
  ], [
    'Open 24/7',
    'Café',
    'Parking'
  ]),
  DemoStation('MH', 'Mandi House Hub', 'Mandi House', 28.6259, 77.2344, 16, [
    DemoConnector('MH-01', 'CCS2', 30),
    DemoConnector('MH-02', 'Demo AC', 3.3),
  ], [
    'Open 24/7',
    'Metro nearby'
  ]),
  DemoStation('IG', 'Garden Charge', 'India Gate', 28.6129, 77.2295, 20, [
    DemoConnector('IG-01', 'CCS2', 60, available: false),
    DemoConnector('IG-02', 'Type 2', 7.4, available: false),
  ], [
    'Open 24/7',
    'Parking'
  ]),
  DemoStation('LB', 'Lodhi Green', 'Lodhi Road', 28.5918, 77.2250, 14, [
    DemoConnector('LB-01', 'Type 2', 22),
    DemoConnector('LB-02', 'Demo AC', 3.3),
  ], [
    'Open 24/7',
    'Restroom',
    'Café'
  ]),
  DemoStation('SC', 'South Link', 'Saket', 28.5286, 77.2190, 15, [
    DemoConnector('SC-01', 'CCS2', 50),
    DemoConnector('SC-02', 'Demo AC', 3.3, available: false),
  ], [
    'Open 24/7',
    'Shopping',
    'Parking'
  ]),
];

class DemoSession {
  DemoSession(
      {required this.id,
      required this.stationId,
      required this.connectorId,
      required this.vehicleId,
      required this.startedAt,
      required this.targetSoc,
      required this.budget,
      required this.powerKw,
      this.initialSoc = 25,
      this.endedAt,
      this.deliveredKwh = 0,
      this.settled = false,
      this.reason = ''});
  final String id, stationId, connectorId, vehicleId;
  final DateTime startedAt;
  final double targetSoc, budget, powerKw, initialSoc;
  DateTime? endedAt;
  double deliveredKwh;
  bool settled;
  String reason;
  DemoVehicle get vehicle => demoVehicles.firstWhere((v) => v.id == vehicleId);
  DemoStation get station => demoStations.firstWhere((s) => s.id == stationId);
  double get cost => deliveredKwh * station.rate;
  double get soc => initialSoc + deliveredKwh / vehicle.batteryKwh * 100;
  double get maximumEnergy => math.min(
      (targetSoc - initialSoc) / 100 * vehicle.batteryKwh,
      budget / station.rate);
  double get progress => maximumEnergy == 0 ? 1 : deliveredKwh / maximumEnergy;
  Duration get simulatedDuration =>
      Duration(seconds: (deliveredKwh / powerKw * 3600).round());
  Map<String, dynamic> toJson() => {
        'id': id,
        'stationId': stationId,
        'connectorId': connectorId,
        'vehicleId': vehicleId,
        'startedAt': startedAt.toIso8601String(),
        'targetSoc': targetSoc,
        'budget': budget,
        'powerKw': powerKw,
        'initialSoc': initialSoc,
        'endedAt': endedAt?.toIso8601String(),
        'deliveredKwh': deliveredKwh,
        'settled': settled,
        'reason': reason,
      };
  factory DemoSession.fromJson(Map<String, dynamic> json) => DemoSession(
        id: json['id'] as String,
        stationId: json['stationId'] as String,
        connectorId: json['connectorId'] as String,
        vehicleId: json['vehicleId'] as String,
        startedAt: DateTime.parse(json['startedAt'] as String),
        targetSoc: (json['targetSoc'] as num).toDouble(),
        budget: (json['budget'] as num).toDouble(),
        powerKw: (json['powerKw'] as num).toDouble(),
        initialSoc: (json['initialSoc'] as num).toDouble(),
        endedAt: json['endedAt'] == null
            ? null
            : DateTime.parse(json['endedAt'] as String),
        deliveredKwh: (json['deliveredKwh'] as num).toDouble(),
        settled: json['settled'] as bool,
        reason: json['reason'] as String,
      );
}
