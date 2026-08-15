import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import 'package:trtripsathi_mobile/core/navigation/route_names.dart';
import 'package:trtripsathi_mobile/core/networking/api_service.dart';
import 'package:trtripsathi_mobile/core/theme/app_theme.dart';
import 'package:trtripsathi_mobile/core/widgets/form_error_banner.dart';

class AccountVerificationPage extends StatefulWidget {
  const AccountVerificationPage({super.key});

  @override
  State<AccountVerificationPage> createState() =>
      _AccountVerificationPageState();
}

class _AccountVerificationPageState extends State<AccountVerificationPage> {
  final _code = TextEditingController();
  String _channel = 'email';
  String? _challengeId;
  String? _destination;
  String? _error;
  bool _busy = false;
  Timer? _expiryTimer;
  int _secondsRemaining = 0;

  @override
  void dispose() {
    _code.dispose();
    _expiryTimer?.cancel();
    super.dispose();
  }

  void _startExpiryCountdown(int seconds) {
    _expiryTimer?.cancel();
    _secondsRemaining = seconds;
    _expiryTimer = Timer.periodic(const Duration(seconds: 1), (timer) {
      if (!mounted || _secondsRemaining <= 1) {
        timer.cancel();
        if (mounted) setState(() => _secondsRemaining = 0);
      } else {
        setState(() => _secondsRemaining -= 1);
      }
    });
  }

  Future<void> _send() async {
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      final result = await ApiService.requestContactVerification(_channel);
      if (!mounted) return;
      if (result['alreadyVerified'] == true) return _finish();
      setState(() {
        _challengeId = result['challengeId']?.toString();
        _destination = result['destination']?.toString();
      });
      _startExpiryCountdown(
          (result['expiresInSeconds'] as num?)?.toInt() ?? 180);
    } catch (error) {
      if (mounted) setState(() => _error = ApiService.readableError(error));
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _confirm() async {
    if (_secondsRemaining <= 0) {
      setState(() => _error = 'This code has expired. Request a new code.');
      return;
    }
    if (_code.text.trim().length != 6) {
      setState(() => _error = 'Enter the 6-digit code.');
      return;
    }
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      await ApiService.confirmContactVerification(
          challengeId: _challengeId!, code: _code.text.trim());
      if (mounted) _finish();
    } catch (error) {
      if (mounted) setState(() => _error = ApiService.readableError(error));
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  void _finish() {
    Navigator.of(context)
        .pushNamedAndRemoveUntil(RouteNames.profileSetup, (_) => false);
  }

  @override
  Widget build(BuildContext context) => Scaffold(
        appBar: AppBar(title: const Text('Verify your account')),
        body: SafeArea(
            child: ListView(padding: const EdgeInsets.all(24), children: [
          const Icon(Icons.verified_user_outlined,
              size: 56, color: AppColors.goldDark),
          const SizedBox(height: 16),
          Text('Protect your TripSathi account',
              style: Theme.of(context).textTheme.headlineSmall,
              textAlign: TextAlign.center),
          const SizedBox(height: 8),
          Text(
              _challengeId == null
                  ? 'Choose where we should send your one-time verification code.'
                  : 'Enter the code sent to ${_destination ?? 'your registered contact'}.',
              textAlign: TextAlign.center,
              style: const TextStyle(color: AppColors.muted, height: 1.45)),
          const SizedBox(height: 28),
          if (_challengeId == null) ...[
            SegmentedButton<String>(
              segments: const [
                ButtonSegment(
                    value: 'email',
                    label: Text('Email'),
                    icon: Icon(Icons.email_outlined)),
                ButtonSegment(
                    value: 'sms',
                    label: Text('SMS'),
                    icon: Icon(Icons.sms_outlined))
              ],
              selected: {_channel},
              onSelectionChanged: _busy
                  ? null
                  : (value) => setState(() => _channel = value.first),
            ),
          ] else ...[
            TextField(
                controller: _code,
                keyboardType: TextInputType.number,
                maxLength: 6,
                inputFormatters: [FilteringTextInputFormatter.digitsOnly],
                decoration: const InputDecoration(
                    labelText: '6-digit code',
                    prefixIcon: Icon(Icons.password_rounded))),
            Text(
              _secondsRemaining > 0
                  ? 'Expires in ${(_secondsRemaining ~/ 60).toString().padLeft(2, '0')}:${(_secondsRemaining % 60).toString().padLeft(2, '0')}'
                  : 'Code expired',
              style: TextStyle(
                color: _secondsRemaining > 0 ? AppColors.muted : Colors.red,
                fontWeight: FontWeight.w600,
              ),
            ),
          ],
          if (_error != null) ...[
            const SizedBox(height: 16),
            FormErrorBanner(message: _error!)
          ],
          const SizedBox(height: 22),
          FilledButton(
              onPressed:
                  _busy || (_challengeId != null && _secondsRemaining <= 0)
                      ? null
                      : (_challengeId == null ? _send : _confirm),
              child: Text(_busy
                  ? 'Please wait…'
                  : (_challengeId == null ? 'Send code' : 'Verify account'))),
          if (_challengeId != null)
            TextButton(
                onPressed: _busy
                    ? null
                    : () => setState(() {
                          _challengeId = null;
                          _expiryTimer?.cancel();
                          _secondsRemaining = 0;
                          _code.clear();
                        }),
                child: const Text('Choose another method')),
        ])),
      );
}
