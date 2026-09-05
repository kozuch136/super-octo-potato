import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../models/remote_action.dart';
import '../models/tv_device.dart';
import '../services/remote_manager.dart';
import '../widgets/dpad.dart';
import '../widgets/remote_button.dart';

class RemoteScreen extends StatefulWidget {
  const RemoteScreen({super.key, required this.device});
  final TvDevice device;

  @override
  State<RemoteScreen> createState() => _RemoteScreenState();
}

class _RemoteScreenState extends State<RemoteScreen> {
  bool _showNumpad = false;
  final _textController = TextEditingController();

  void _send(RemoteAction action) => context.read<RemoteManager>().send(action);

  @override
  void dispose() {
    _textController.dispose();
    super.dispose();
  }

  Future<void> _sendTextDialog() async {
    _textController.clear();
    final text = await showDialog<String>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Wpisz tekst'),
        content: TextField(controller: _textController, autofocus: true),
        actions: [
          TextButton(onPressed: () => Navigator.pop(context), child: const Text('Anuluj')),
          FilledButton(
            onPressed: () => Navigator.pop(context, _textController.text),
            child: const Text('Wyślij'),
          ),
        ],
      ),
    );
    if (text != null && text.isNotEmpty) {
      final adapter = context.read<RemoteManager>().activeAdapter;
      await adapter?.sendText(text);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: Text(widget.device.name),
        actions: [
          IconButton(
            icon: const Icon(Icons.keyboard_outlined),
            tooltip: 'Wpisz tekst',
            onPressed: _sendTextDialog,
          ),
          IconButton(
            icon: Icon(_showNumpad ? Icons.dialpad : Icons.dialpad_outlined),
            tooltip: 'Klawiatura numeryczna',
            onPressed: () => setState(() => _showNumpad = !_showNumpad),
          ),
        ],
      ),
      body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 12),
          child: Column(
            children: [
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  RemoteButton(icon: Icons.power_settings_new, onTap: () => _send(RemoteAction.power)),
                  RemoteButton(icon: Icons.arrow_back, onTap: () => _send(RemoteAction.back)),
                  RemoteButton(icon: Icons.home, onTap: () => _send(RemoteAction.home)),
                  RemoteButton(icon: Icons.menu, onTap: () => _send(RemoteAction.menu)),
                  RemoteButton(icon: Icons.mic_none, onTap: () => _send(RemoteAction.mic)),
                ],
              ),
              const SizedBox(height: 32),
              Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Column(
                    children: [
                      RemoteButton(icon: Icons.add, onTap: () => _send(RemoteAction.volumeUp), size: 48),
                      const SizedBox(height: 8),
                      Text('VOL', style: Theme.of(context).textTheme.labelSmall),
                      const SizedBox(height: 8),
                      RemoteButton(icon: Icons.remove, onTap: () => _send(RemoteAction.volumeDown), size: 48),
                    ],
                  ),
                  const SizedBox(width: 24),
                  Dpad(onAction: _send),
                  const SizedBox(width: 24),
                  Column(
                    children: [
                      RemoteButton(icon: Icons.add, onTap: () => _send(RemoteAction.channelUp), size: 48),
                      const SizedBox(height: 8),
                      Text('CH', style: Theme.of(context).textTheme.labelSmall),
                      const SizedBox(height: 8),
                      RemoteButton(icon: Icons.remove, onTap: () => _send(RemoteAction.channelDown), size: 48),
                    ],
                  ),
                ],
              ),
              const SizedBox(height: 32),
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceEvenly,
                children: [
                  RemoteButton(icon: Icons.fast_rewind, onTap: () => _send(RemoteAction.rewind)),
                  RemoteButton(icon: Icons.play_arrow, onTap: () => _send(RemoteAction.playPause)),
                  RemoteButton(icon: Icons.fast_forward, onTap: () => _send(RemoteAction.fastForward)),
                  RemoteButton(icon: Icons.volume_off, onTap: () => _send(RemoteAction.mute)),
                ],
              ),
              if (_showNumpad) ...[
                const SizedBox(height: 32),
                _Numpad(onDigit: _send),
              ],
              const SizedBox(height: 24),
            ],
          ),
        ),
      ),
    );
  }
}

class _Numpad extends StatelessWidget {
  const _Numpad({required this.onDigit});
  final void Function(RemoteAction) onDigit;

  static const _digits = [
    RemoteAction.num1, RemoteAction.num2, RemoteAction.num3, //
    RemoteAction.num4, RemoteAction.num5, RemoteAction.num6,
    RemoteAction.num7, RemoteAction.num8, RemoteAction.num9,
    null, RemoteAction.num0, null,
  ];

  @override
  Widget build(BuildContext context) {
    return GridView.count(
      crossAxisCount: 3,
      shrinkWrap: true,
      physics: const NeverScrollableScrollPhysics(),
      mainAxisSpacing: 8,
      crossAxisSpacing: 8,
      childAspectRatio: 1.6,
      children: [
        for (final digit in _digits)
          if (digit == null)
            const SizedBox.shrink()
          else
            OutlinedButton(
              onPressed: () => onDigit(digit),
              child: Text(digit.name.replaceFirst('num', '')),
            ),
      ],
    );
  }
}
