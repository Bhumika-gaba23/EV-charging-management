import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'demo/demo_store.dart';
import 'screens/home.dart';
import 'theme.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  final store = DemoStore();
  await store.restore();
  runApp(ChargeFlowApp(store: store));
}

class ChargeFlowApp extends StatelessWidget {
  const ChargeFlowApp({super.key, this.store});
  final DemoStore? store;

  @override
  Widget build(BuildContext context) {
    final app = MaterialApp(
      debugShowCheckedModeBanner: false,
      title: 'ChargeFlow',
      theme: chargeFlowTheme,
      home: const HomeScreen(),
    );
    if (store != null) {
      return ChangeNotifierProvider.value(value: store!, child: app);
    }
    return ChangeNotifierProvider(create: (_) => DemoStore(), child: app);
  }
}
