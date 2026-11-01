import 'package:flutter_test/flutter_test.dart';
import 'package:chargeflow_mobile/main.dart';
void main(){testWidgets('vehicle choices are visible',(tester)async{await tester.pumpWidget(const ChargeFlowApp());expect(find.text('EV Car'),findsOneWidget);expect(find.text('EV Bike'),findsOneWidget);expect(find.text('EV Scooter'),findsOneWidget);});}
