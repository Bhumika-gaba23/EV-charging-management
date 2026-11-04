import 'dart:math' as math;
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../demo/demo_store.dart';
import '../demo/models.dart';
import '../theme.dart';
import '../widgets/common.dart';

class ChargeSetup extends StatefulWidget {
  const ChargeSetup(
      {super.key, required this.station, required this.connector});
  final DemoStation station;
  final DemoConnector connector;
  @override
  State<ChargeSetup> createState() => _ChargeSetupState();
}

class _ChargeSetupState extends State<ChargeSetup> {
  double target = 80, budget = 300;
  @override
  Widget build(BuildContext context) {
    final store = context.watch<DemoStore>();
    final vehicle = store.vehicle;
    final power = math.min(widget.connector.kw, vehicle.maxKw);
    final energy = math.min(
        (target - 25) / 100 * vehicle.batteryKwh, budget / widget.station.rate);
    final compatible = widget.connector.supports(vehicle);
    final pending = store.sessions.any((s) => s.endedAt != null && !s.settled);
    return Scaffold(
      appBar: AppBar(title: const Text('Plan your charge')),
      body: ListView(padding: const EdgeInsets.all(20), children: [
        const DemoNotice(),
        const SizedBox(height: 24),
        SectionTitle(widget.station.name,
            subtitle:
                '${widget.connector.id} · ${widget.connector.type} · ${vehicle.kind}'),
        Surface(
            child: Row(children: [
          Icon(vehicleIcon(vehicle.kind), size: 40),
          const SizedBox(width: 16),
          Expanded(
              child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                const Text('Starting battery', style: TextStyle(color: muted)),
                const SizedBox(height: 6),
                const Text('25%',
                    style:
                        TextStyle(fontSize: 32, fontWeight: FontWeight.w700)),
                Text(
                    '${vehicle.batteryKwh.toStringAsFixed(0)} kWh fictional profile',
                    style: const TextStyle(color: muted, fontSize: 12)),
              ])),
        ])),
        const SizedBox(height: 24),
        Text('Charge target · ${target.round()}%',
            style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w600)),
        Slider(
            value: target,
            min: 30,
            max: 100,
            divisions: 14,
            label: '${target.round()}%',
            onChanged: (v) => setState(() => target = v)),
        const SizedBox(height: 16),
        Text('Budget cap · ₹${budget.round()}',
            style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w600)),
        Slider(
            value: budget,
            min: 50,
            max: 1000,
            divisions: 19,
            label: '₹${budget.round()}',
            onChanged: (v) => setState(() => budget = v)),
        const Text(
            'The demo stops at your target or budget cap, whichever comes first.',
            style: TextStyle(color: muted, fontSize: 12, height: 1.6)),
        const SizedBox(height: 24),
        Surface(
            child: Column(children: [
          _SummaryRow('Energy to add', '${energy.toStringAsFixed(2)} kWh'),
          _SummaryRow('Charging power', '${power.toStringAsFixed(1)} kW'),
          _SummaryRow('Simulated time', '${(energy / power * 60).ceil()} min'),
          _SummaryRow(
              'Demo duration (60×)', '~${(energy / power * 60).ceil()} sec'),
          const Divider(),
          _SummaryRow('Estimated demo bill',
              '₹${(energy * widget.station.rate).toStringAsFixed(2)}'),
          const _SummaryRow('Real amount charged', '₹0.00'),
        ])),
        const SizedBox(height: 20),
        if (store.active != null || pending || !compatible)
          Padding(
              padding: const EdgeInsets.only(bottom: 12),
              child: Text(
                  !compatible
                      ? 'Vehicle changed. Return and choose a compatible connector.'
                      : store.active != null
                          ? 'A demo session is already running. Open Sessions to manage it.'
                          : 'Complete your previous demo checkout in Sessions first.',
                  style: const TextStyle(color: muted, height: 1.5))),
        FilledButton.icon(
            icon: const Icon(Icons.bolt),
            onPressed: store.active != null || pending || !compatible
                ? null
                : () {
                    try {
                      final session = store.start(
                          widget.station, widget.connector,
                          targetSoc: target, budget: budget);
                      Navigator.pushReplacement(
                          context,
                          MaterialPageRoute(
                              builder: (_) => SessionScreen(session: session)));
                    } catch (error) {
                      showMessage(
                          context,
                          error is StateError
                              ? error.message
                              : 'Unable to start this demo.');
                    }
                  },
            label: const Text('Start simulated charging')),
        const SizedBox(height: 16),
        const Text(
            'No physical charger is connected. One second represents one minute of charging. '
            'The demo continues while the app is in the background.',
            textAlign: TextAlign.center,
            style: TextStyle(color: muted, fontSize: 12, height: 1.6)),
      ]),
    );
  }
}

class SessionScreen extends StatelessWidget {
  const SessionScreen({super.key, required this.session});
  final DemoSession session;
  @override
  Widget build(BuildContext context) {
    final store = context.watch<DemoStore>();
    final ended = session.endedAt != null;
    return Scaffold(
      appBar: AppBar(
          title: Text(session.settled
              ? 'Demo receipt'
              : ended
                  ? 'Session complete'
                  : 'Live charging')),
      body: ListView(padding: const EdgeInsets.all(24), children: [
        const DemoNotice(compact: true),
        const SizedBox(height: 24),
        Text(session.station.name,
            style: const TextStyle(
                fontSize: 27,
                fontWeight: FontWeight.w700,
                letterSpacing: -0.7)),
        const SizedBox(height: 6),
        Text('${session.connectorId} · ${session.vehicle.kind}',
            style: const TextStyle(color: muted)),
        const SizedBox(height: 32),
        Center(
            child: SizedBox(
                width: 220,
                height: 220,
                child: Stack(alignment: Alignment.center, children: [
                  SizedBox.expand(
                      child: CircularProgressIndicator(
                          value: (session.soc / 100).clamp(0, 1),
                          strokeWidth: 10,
                          backgroundColor: edge,
                          color: silver,
                          strokeCap: StrokeCap.round)),
                  Column(mainAxisSize: MainAxisSize.min, children: [
                    Icon(
                        session.settled
                            ? Icons.check_circle_outline
                            : ended
                                ? Icons.done
                                : Icons.bolt,
                        size: 28),
                    const SizedBox(height: 6),
                    Text('${session.soc.toStringAsFixed(0)}%',
                        style: const TextStyle(
                            fontSize: 52,
                            fontWeight: FontWeight.w700,
                            letterSpacing: -2)),
                    Text(ended ? 'DEMO COMPLETE' : 'SIMULATED BATTERY',
                        style: const TextStyle(
                            color: muted, fontSize: 10, letterSpacing: 1.4)),
                  ]),
                ]))),
        const SizedBox(height: 32),
        Surface(
            child: Column(children: [
          _SummaryRow('Energy delivered',
              '${session.deliveredKwh.toStringAsFixed(2)} kWh'),
          _SummaryRow('Power',
              ended ? '0.0 kW' : '${session.powerKw.toStringAsFixed(1)} kW'),
          _SummaryRow('Simulated time',
              '${session.simulatedDuration.inMinutes}m ${session.simulatedDuration.inSeconds % 60}s'),
          _SummaryRow('Demo total', '₹${session.cost.toStringAsFixed(2)}'),
          const _SummaryRow('Real money charged', '₹0.00'),
          if (ended) _SummaryRow('Finished', session.reason),
        ])),
        const SizedBox(height: 24),
        if (!ended) ...[
          LinearProgressIndicator(
              value: session.progress.clamp(0, 1), backgroundColor: edge),
          const SizedBox(height: 12),
          const Text(
              '60× demo speed · target and budget are enforced automatically.',
              style: TextStyle(color: muted, fontSize: 12, height: 1.6)),
          const SizedBox(height: 20),
          OutlinedButton.icon(
              icon: const Icon(Icons.stop_circle_outlined),
              label: const Text('Stop demo charging'),
              onPressed: () => store.stop(session)),
        ] else if (!session.settled)
          FilledButton.icon(
            icon: const Icon(Icons.receipt_long_outlined),
            onPressed: () => Navigator.push(
                context,
                MaterialPageRoute(
                    builder: (_) => DemoCheckout(session: session))),
            label: const Text('Continue to demo checkout'),
          )
        else ...[
          const Surface(
              child: Column(children: [
            Icon(Icons.verified_outlined, size: 32),
            SizedBox(height: 12),
            Text('Demo payment completed',
                style: TextStyle(fontWeight: FontWeight.w700)),
            SizedBox(height: 8),
            Text('No real money was charged.', style: TextStyle(color: muted)),
          ])),
          const SizedBox(height: 16),
          SelectableText(
              'Receipt ${session.id}\n${session.startedAt.toLocal()}\nSimulation only · not a tax invoice',
              style: const TextStyle(color: muted, fontSize: 11, height: 1.8)),
        ],
        const SizedBox(height: 24),
        const DemoNotice(),
      ]),
    );
  }
}

class DemoCheckout extends StatelessWidget {
  const DemoCheckout({super.key, required this.session});
  final DemoSession session;
  @override
  Widget build(BuildContext context) => Scaffold(
        appBar: AppBar(title: const Text('Demo checkout')),
        body: ListView(padding: const EdgeInsets.all(24), children: [
          const Icon(Icons.account_balance_wallet_outlined, size: 64),
          const SizedBox(height: 24),
          const SectionTitle('A full journey.\nZero real payments.',
              subtitle:
                  'This checkout is for your college demonstration only.'),
          Surface(
              child: Column(children: [
            _SummaryRow('Station', session.station.name),
            _SummaryRow(
                'Energy', '${session.deliveredKwh.toStringAsFixed(2)} kWh'),
            _SummaryRow('Demo bill', '₹${session.cost.toStringAsFixed(2)}'),
            const Divider(),
            const _SummaryRow('Amount collected', '₹0.00'),
          ])),
          const SizedBox(height: 24),
          const Surface(
              child:
                  Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Icon(Icons.info_outline),
            SizedBox(width: 12),
            Expanded(
                child: Text(
                    'No real money is charged. Do not enter UPI, card or bank details. '
                    'No payment gateway is connected.',
                    style: TextStyle(height: 1.6, color: muted))),
          ])),
          const SizedBox(height: 24),
          FilledButton(
              onPressed: () {
                context.read<DemoStore>().settle(session);
                Navigator.pop(context);
              },
              child: const Text('Complete demo payment · ₹0')),
        ]),
      );
}

class _SummaryRow extends StatelessWidget {
  const _SummaryRow(this.label, this.value);
  final String label, value;
  @override
  Widget build(BuildContext context) => Padding(
        padding: const EdgeInsets.symmetric(vertical: 9),
        child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Expanded(
              child: Text(label,
                  style: const TextStyle(color: muted, fontSize: 13))),
          const SizedBox(width: 12),
          Flexible(
              child: Text(value,
                  textAlign: TextAlign.right,
                  style: const TextStyle(
                      fontWeight: FontWeight.w600, fontSize: 13))),
        ]),
      );
}
