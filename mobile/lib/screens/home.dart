import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../demo/demo_store.dart';
import '../demo/models.dart';
import '../theme.dart';
import '../widgets/common.dart';
import 'charging.dart';
import 'discover.dart';

class HomeScreen extends StatefulWidget {
  const HomeScreen({super.key});
  @override
  State<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends State<HomeScreen> with WidgetsBindingObserver {
  int index = 0;
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.resumed) context.read<DemoStore>().refresh();
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final store = context.watch<DemoStore>();
    if (!store.onboarded) return const VehicleWelcome();
    return Scaffold(
      appBar: AppBar(
        title: const Text('CHARGEFLOW',
            style: TextStyle(
                fontSize: 17, letterSpacing: 3, fontWeight: FontWeight.w800)),
        actions: [
          Padding(
              padding: const EdgeInsets.only(right: 16),
              child: Container(
                padding:
                    const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
                decoration: BoxDecoration(
                    border: Border.all(color: edge),
                    borderRadius: BorderRadius.circular(8)),
                child: const Text('DEMO',
                    style: TextStyle(fontSize: 10, letterSpacing: 2)),
              )),
        ],
      ),
      body: Column(children: [
        if (store.storageMessage != null)
          Padding(
              padding: const EdgeInsets.all(12),
              child: Text(store.storageMessage!,
                  style: const TextStyle(color: muted, fontSize: 12))),
        Expanded(
            child: IndexedStack(index: index, children: const [
          DiscoverPage(),
          SessionsPage(),
          GaragePage(),
        ])),
      ]),
      bottomNavigationBar: NavigationBar(
        selectedIndex: index,
        onDestinationSelected: (value) => setState(() => index = value),
        destinations: const [
          NavigationDestination(
              icon: Icon(Icons.explore_outlined),
              selectedIcon: Icon(Icons.explore),
              label: 'Discover'),
          NavigationDestination(
              icon: Icon(Icons.bolt_outlined),
              selectedIcon: Icon(Icons.bolt),
              label: 'Sessions'),
          NavigationDestination(
              icon: Icon(Icons.garage_outlined),
              selectedIcon: Icon(Icons.garage),
              label: 'My garage'),
        ],
      ),
    );
  }
}

class VehicleWelcome extends StatelessWidget {
  const VehicleWelcome({super.key});
  @override
  Widget build(BuildContext context) => Scaffold(
          body: SafeArea(
        child: ListView(padding: const EdgeInsets.all(24), children: [
          const SizedBox(height: 28),
          const Row(children: [
            Icon(Icons.bolt, size: 28),
            SizedBox(width: 8),
            Text('CHARGEFLOW',
                style: TextStyle(letterSpacing: 3, fontWeight: FontWeight.w800))
          ]),
          const SizedBox(height: 44),
          Container(
              height: 130,
              alignment: Alignment.center,
              decoration: BoxDecoration(
                  gradient: const LinearGradient(
                      colors: [Color(0xFF383A42), Color(0xFF121317)]),
                  borderRadius: BorderRadius.circular(28),
                  border: Border.all(color: edge)),
              child: const Icon(Icons.electric_car_rounded,
                  size: 100, color: silver)),
          const SizedBox(height: 32),
          const Text('Your next charge.\nA little closer.',
              style: TextStyle(
                  fontSize: 37,
                  height: 1.12,
                  fontWeight: FontWeight.w700,
                  letterSpacing: -1.4)),
          const SizedBox(height: 14),
          const Text(
              'Start with your vehicle. Explore New Delhi and try a complete charging journey.',
              style: TextStyle(color: muted, height: 1.6)),
          const SizedBox(height: 24),
          const Text('WHAT ARE YOU CHARGING?',
              style: TextStyle(color: muted, fontSize: 11, letterSpacing: 2)),
          const SizedBox(height: 12),
          for (final vehicle in demoVehicles)
            Padding(
              padding: const EdgeInsets.only(bottom: 12),
              child: VehicleOption(
                  vehicle: vehicle,
                  onTap: () =>
                      context.read<DemoStore>().selectVehicle(vehicle)),
            ),
          const SizedBox(height: 12),
          const DemoNotice(),
        ]),
      ));
}

class VehicleOption extends StatelessWidget {
  const VehicleOption(
      {super.key,
      required this.vehicle,
      required this.onTap,
      this.selected = false});
  final DemoVehicle vehicle;
  final VoidCallback onTap;
  final bool selected;
  @override
  Widget build(BuildContext context) => Material(
        color: selected ? const Color(0xFF292B31) : panel,
        shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(18),
            side: BorderSide(color: selected ? silver : edge)),
        child: ListTile(
          contentPadding:
              const EdgeInsets.symmetric(horizontal: 18, vertical: 6),
          leading: Icon(vehicleIcon(vehicle.kind), size: 32),
          title: Text(vehicle.kind,
              style: const TextStyle(fontWeight: FontWeight.w700)),
          subtitle: Text(
              '${vehicle.batteryKwh.toStringAsFixed(0)} kWh demo profile · ${vehicle.connectors.join(' / ')}',
              style: const TextStyle(color: muted, fontSize: 11)),
          trailing:
              Icon(selected ? Icons.check_circle : Icons.arrow_forward_rounded),
          onTap: onTap,
        ),
      );
}

class SessionsPage extends StatelessWidget {
  const SessionsPage({super.key});
  @override
  Widget build(BuildContext context) {
    final store = context.watch<DemoStore>();
    return ListView(padding: const EdgeInsets.all(20), children: [
      const SectionTitle('Your charging story',
          subtitle: 'Live sessions, demo checkouts and receipts.'),
      const DemoNotice(),
      const SizedBox(height: 24),
      if (store.sessions.isEmpty)
        const Surface(
            child: Column(children: [
          Icon(Icons.bolt_outlined, size: 52, color: muted),
          SizedBox(height: 16),
          Text('Your first charge starts here.',
              style: TextStyle(fontSize: 17)),
          SizedBox(height: 8),
          Text('Choose a station in Discover to start a simulated session.',
              textAlign: TextAlign.center,
              style: TextStyle(color: muted, height: 1.5)),
        ])),
      for (final session in store.sessions)
        Padding(
          padding: const EdgeInsets.only(bottom: 12),
          child: Surface(
              child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                Row(children: [
                  Expanded(
                      child: Text(
                          session.endedAt == null
                              ? '● CHARGING NOW'
                              : session.settled
                                  ? 'DEMO RECEIPT'
                                  : 'CHECKOUT READY',
                          style: const TextStyle(
                              letterSpacing: 1.5, fontSize: 10, color: muted))),
                  Text('₹${session.cost.toStringAsFixed(2)}',
                      style: const TextStyle(fontWeight: FontWeight.w700)),
                ]),
                const SizedBox(height: 12),
                Text(session.station.name,
                    style: const TextStyle(
                        fontSize: 20, fontWeight: FontWeight.w700)),
                const SizedBox(height: 6),
                Text(
                    '${session.vehicle.kind} · ${session.deliveredKwh.toStringAsFixed(2)} kWh',
                    style: const TextStyle(color: muted)),
                const SizedBox(height: 6),
                Text(
                    '${session.startedAt.day}/${session.startedAt.month}/${session.startedAt.year} · ${session.connectorId}',
                    style: const TextStyle(color: muted, fontSize: 12)),
                const SizedBox(height: 16),
                SizedBox(
                    width: double.infinity,
                    child: OutlinedButton(
                      onPressed: () => Navigator.push(
                          context,
                          MaterialPageRoute(
                              builder: (_) => SessionScreen(session: session))),
                      child: Text(session.endedAt == null
                          ? 'View live session'
                          : session.settled
                              ? 'View receipt'
                              : 'Complete demo checkout'),
                    )),
              ])),
        ),
    ]);
  }
}

class GaragePage extends StatelessWidget {
  const GaragePage({super.key});
  @override
  Widget build(BuildContext context) {
    final store = context.watch<DemoStore>();
    return ListView(padding: const EdgeInsets.all(20), children: [
      const SectionTitle('My garage',
          subtitle: 'Choose a demo profile for compatible station results.'),
      for (final vehicle in demoVehicles)
        Padding(
          padding: const EdgeInsets.only(bottom: 12),
          child: VehicleOption(
              vehicle: vehicle,
              selected: store.vehicle == vehicle,
              onTap: () => store.selectVehicle(vehicle)),
        ),
      const SizedBox(height: 16),
      const Surface(
          child:
              Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Text('Built for your college demo',
            style: TextStyle(fontSize: 17, fontWeight: FontWeight.w700)),
        SizedBox(height: 12),
        Text(
            'New Delhi · India\nBlack & silver edition\nNo account or real payment required',
            style: TextStyle(color: muted, height: 1.8)),
        SizedBox(height: 12),
        Text(
            'Battery sizes, AC compatibility, tariffs and station availability are fictional. '
            'Battery percentage is simulated, not read from your vehicle. '
            'Sessions and saved stations stay on this device. There is no payment gateway.',
            style: TextStyle(color: muted, height: 1.6, fontSize: 12)),
      ])),
      const SizedBox(height: 20),
      OutlinedButton.icon(
          icon: const Icon(Icons.restart_alt),
          label: const Text('Reset demonstration'),
          onPressed: () async {
            final reset = await showDialog<bool>(
                context: context,
                builder: (context) => AlertDialog(
                      title: const Text('Start fresh?'),
                      content: const Text(
                          'This clears local demo sessions and saved stations, including any active demo charge.'),
                      actions: [
                        TextButton(
                            onPressed: () => Navigator.pop(context, false),
                            child: const Text('Keep demo')),
                        FilledButton(
                            onPressed: () => Navigator.pop(context, true),
                            child: const Text('Reset')),
                      ],
                    ));
            if (reset == true) store.reset();
          }),
      const SizedBox(height: 16),
      const DemoNotice(),
    ]);
  }
}
