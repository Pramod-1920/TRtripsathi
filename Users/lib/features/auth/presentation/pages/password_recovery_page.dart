import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import 'package:trtripsathi_mobile/core/networking/api_service.dart';
import 'package:trtripsathi_mobile/core/theme/app_theme.dart';
import 'package:trtripsathi_mobile/core/widgets/form_error_banner.dart';

class PasswordRecoveryPage extends StatefulWidget {
  const PasswordRecoveryPage({super.key});

  @override
  State<PasswordRecoveryPage> createState() => _PasswordRecoveryPageState();
}

class _PasswordRecoveryPageState extends State<PasswordRecoveryPage> {
  final _identifier = TextEditingController();
  final _code = TextEditingController();
  final _password = TextEditingController();
  String? _challengeId;
  String? _error;
  bool _busy = false;
  bool _hidePassword = true;
  Timer? _expiryTimer;
  int _secondsRemaining = 0;
  int _resendSecondsRemaining = 0;

  @override
  void dispose() {
    _identifier.dispose();
    _code.dispose();
    _password.dispose();
    _expiryTimer?.cancel();
    super.dispose();
  }

  void _startCountdowns(int expirySeconds, int resendSeconds) {
    _expiryTimer?.cancel();
    _secondsRemaining = expirySeconds;
    _resendSecondsRemaining = resendSeconds;
    _expiryTimer = Timer.periodic(const Duration(seconds: 1), (timer) {
      if (!mounted) {
        timer.cancel();
        return;
      }
      setState(() {
        if (_secondsRemaining > 0) _secondsRemaining -= 1;
        if (_resendSecondsRemaining > 0) _resendSecondsRemaining -= 1;
      });
      if (_secondsRemaining <= 0 && _resendSecondsRemaining <= 0) {
        timer.cancel();
      }
    });
  }

  Future<void> _requestCode() async {
    if (_identifier.text.trim().isEmpty || _busy) return;
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      final result = await ApiService.forgotPassword(_identifier.text);
      if (!mounted) return;
      setState(() => _challengeId = result['challengeId']?.toString());
      _startCountdowns(
        (result['expiresInSeconds'] as num?)?.toInt() ?? 180,
        (result['resendAfterSeconds'] as num?)?.toInt() ?? 60,
      );
    } catch (error) {
      if (mounted) setState(() => _error = ApiService.readableError(error));
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _resendCode() async {
    if (_challengeId == null || _busy || _resendSecondsRemaining > 0) return;
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      final result = await ApiService.resendPasswordCode(_challengeId!);
      if (!mounted) return;
      setState(() {
        _challengeId = result['challengeId']?.toString();
        _code.clear();
      });
      _startCountdowns(
        (result['expiresInSeconds'] as num?)?.toInt() ?? 180,
        (result['resendAfterSeconds'] as num?)?.toInt() ?? 60,
      );
    } catch (error) {
      if (mounted) setState(() => _error = ApiService.readableError(error));
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _reset() async {
    if (_secondsRemaining <= 0) {
      setState(() => _error = 'This code has expired. Request a new code.');
      return;
    }
    if (_busy || _code.text.trim().length != 6 || _password.text.length < 12) {
      setState(() => _error =
          'Enter the 6-digit code and a password of at least 12 characters.');
      return;
    }
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      await ApiService.resetPassword(
        challengeId: _challengeId!,
        code: _code.text.trim(),
        password: _password.text,
      );
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Password changed. You can sign in now.')),
      );
      Navigator.pop(context);
    } catch (error) {
      if (mounted) setState(() => _error = ApiService.readableError(error));
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) => Scaffold(
        appBar: AppBar(title: const Text('Reset password')),
        body: SafeArea(
          child: ListView(
            padding: const EdgeInsets.all(24),
            children: [
              const Icon(Icons.lock_reset_rounded,
                  size: 52, color: AppColors.goldDark),
              const SizedBox(height: 18),
              Text(
                _challengeId == null
                    ? 'Find your account'
                    : 'Check your messages',
                style: Theme.of(context).textTheme.headlineSmall,
                textAlign: TextAlign.center,
              ),
              const SizedBox(height: 8),
              Text(
                _challengeId == null
                    ? 'Use the email or Nepal phone number registered to your account.'
                    : 'If the account exists, we sent a 6-digit code. It expires in 3 minutes.',
                textAlign: TextAlign.center,
                style: const TextStyle(color: AppColors.muted, height: 1.45),
              ),
              const SizedBox(height: 28),
              if (_challengeId == null)
                TextField(
                  controller: _identifier,
                  autofillHints: const [
                    AutofillHints.email,
                    AutofillHints.telephoneNumber
                  ],
                  decoration: const InputDecoration(
                    labelText: 'Email or phone number',
                    prefixIcon: Icon(Icons.person_search_outlined),
                  ),
                )
              else ...[
                TextField(
                  controller: _code,
                  keyboardType: TextInputType.number,
                  maxLength: 6,
                  inputFormatters: [FilteringTextInputFormatter.digitsOnly],
                  decoration: const InputDecoration(
                    labelText: '6-digit code',
                    prefixIcon: Icon(Icons.password_rounded),
                  ),
                ),
                Text(
                  _secondsRemaining > 0
                      ? 'Expires in ${(_secondsRemaining ~/ 60).toString().padLeft(2, '0')}:${(_secondsRemaining % 60).toString().padLeft(2, '0')}'
                      : 'Code expired',
                  style: TextStyle(
                    color: _secondsRemaining > 0 ? AppColors.muted : Colors.red,
                    fontWeight: FontWeight.w600,
                  ),
                ),
                const SizedBox(height: 12),
                TextField(
                  controller: _password,
                  obscureText: _hidePassword,
                  autofillHints: const [AutofillHints.newPassword],
                  decoration: InputDecoration(
                    labelText: 'New password',
                    helperText: 'At least 12 characters',
                    prefixIcon: const Icon(Icons.lock_outline_rounded),
                    suffixIcon: IconButton(
                      onPressed: () =>
                          setState(() => _hidePassword = !_hidePassword),
                      icon: Icon(_hidePassword
                          ? Icons.visibility_outlined
                          : Icons.visibility_off_outlined),
                    ),
                  ),
                ),
              ],
              if (_error != null) ...[
                const SizedBox(height: 16),
                FormErrorBanner(message: _error!),
              ],
              const SizedBox(height: 24),
              FilledButton(
                onPressed:
                    _busy || (_challengeId != null && _secondsRemaining <= 0)
                        ? null
                        : (_challengeId == null ? _requestCode : _reset),
                child: Text(_busy
                    ? 'Please wait…'
                    : (_challengeId == null
                        ? 'Send reset code'
                        : 'Change password')),
              ),
              if (_challengeId != null) ...[
                TextButton(
                  onPressed:
                      _busy || _resendSecondsRemaining > 0 ? null : _resendCode,
                  child: Text(
                    _resendSecondsRemaining > 0
                        ? 'Resend code in ${_resendSecondsRemaining}s'
                        : 'Resend code',
                  ),
                ),
                TextButton(
                  onPressed: _busy
                      ? null
                      : () => setState(() {
                            _challengeId = null;
                            _expiryTimer?.cancel();
                            _secondsRemaining = 0;
                            _resendSecondsRemaining = 0;
                            _code.clear();
                            _error = null;
                          }),
                  child: const Text('Use a different account'),
                ),
              ],
            ],
          ),
        ),
      );
}
