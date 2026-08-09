import 'dart:async';

import 'package:flutter/material.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:trtripsathi_mobile/core/navigation/route_names.dart';
import 'package:trtripsathi_mobile/core/networking/api_service.dart';
import 'package:trtripsathi_mobile/core/theme/app_theme.dart';
import 'package:trtripsathi_mobile/core/widgets/animated_action_button.dart';
import 'package:trtripsathi_mobile/core/widgets/brand_mark.dart';
import 'package:trtripsathi_mobile/core/widgets/form_error_banner.dart';
import 'package:trtripsathi_mobile/core/widgets/travel_background.dart';

class LoginScreen extends StatefulWidget {
  const LoginScreen({this.initialIdentifier, super.key});

  final String? initialIdentifier;

  @override
  State<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends State<LoginScreen>
    with SingleTickerProviderStateMixin {
  final _formKey = GlobalKey<FormState>();
  late final TextEditingController _identifier;
  final _password = TextEditingController();
  late final AnimationController _entranceController;
  late final Animation<double> _entrance;
  bool _loading = false;
  bool _passwordHidden = true;
  String? _error;
  Timer? _cooldownTimer;
  int _cooldownSeconds = 0;

  @override
  void initState() {
    super.initState();
    _identifier = TextEditingController(text: widget.initialIdentifier);
    _entranceController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 650),
    )..forward();
    _entrance = CurvedAnimation(
      parent: _entranceController,
      curve: Curves.easeOutCubic,
    );
  }

  Future<void> _submit() async {
    if (_loading || _cooldownSeconds > 0) return;
    FocusManager.instance.primaryFocus?.unfocus();
    if (!(_formKey.currentState?.validate() ?? false)) return;
    setState(() {
      _loading = true;
      _error = null;
    });

    try {
      await ApiService.login(_identifier.text.trim(), _password.text);
      if (!mounted) return;
      final preferences = await SharedPreferences.getInstance();
      final needsTravelerProfile =
          (preferences.getBool('account_created') ?? false) &&
              !(preferences.getBool('onboarding_done') ?? false);
      if (!mounted) return;
      Navigator.of(context).pushNamedAndRemoveUntil(
        needsTravelerProfile ? RouteNames.profileSetup : RouteNames.dashboard,
        (_) => false,
      );
    } catch (error) {
      if (error is ApiRateLimitException) {
        _startCooldown(error.retryAfterSeconds);
      }
      if (mounted) setState(() => _error = ApiService.readableError(error));
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  void _startCooldown(int seconds) {
    _cooldownTimer?.cancel();
    if (mounted) setState(() => _cooldownSeconds = seconds);
    _cooldownTimer = Timer.periodic(const Duration(seconds: 1), (timer) {
      if (!mounted || _cooldownSeconds <= 1) {
        timer.cancel();
        if (mounted) setState(() => _cooldownSeconds = 0);
        return;
      }
      setState(() => _cooldownSeconds -= 1);
    });
  }

  void _showPasswordHelp() {
    showModalBottomSheet<void>(
      context: context,
      showDragHandle: true,
      builder: (context) => SafeArea(
        child: Padding(
          padding: const EdgeInsets.fromLTRB(24, 8, 24, 28),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Icon(Icons.lock_reset_rounded,
                  size: 38, color: AppColors.goldDark),
              const SizedBox(height: 14),
              Text('Reset your password',
                  style: Theme.of(context).textTheme.titleLarge),
              const SizedBox(height: 8),
              const Text(
                'Password recovery is handled by TripSathi support while secure email recovery is being rolled out. Contact support with your registered email or phone number.',
                style: TextStyle(color: AppColors.muted, height: 1.5),
              ),
              const SizedBox(height: 20),
              ElevatedButton(
                onPressed: () => Navigator.pop(context),
                child: const Text('Got it'),
              ),
            ],
          ),
        ),
      ),
    );
  }

  @override
  void dispose() {
    _identifier.dispose();
    _password.dispose();
    _cooldownTimer?.cancel();
    _entranceController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => Scaffold(
        body: TravelBackground(
          child: SafeArea(
            child: Center(
              child: SingleChildScrollView(
                padding:
                    const EdgeInsets.symmetric(horizontal: 24, vertical: 28),
                child: ConstrainedBox(
                  constraints: const BoxConstraints(maxWidth: 470),
                  child: FadeTransition(
                    opacity: _entrance,
                    child: SlideTransition(
                      position: Tween<Offset>(
                        begin: const Offset(0, .06),
                        end: Offset.zero,
                      ).animate(_entrance),
                      child: Form(
                        key: _formKey,
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.stretch,
                          children: [
                            const BrandMark(size: 54, showName: true),
                            const SizedBox(height: 50),
                            Text(
                              'Welcome back,\nexplorer.',
                              style: Theme.of(context)
                                  .textTheme
                                  .displaySmall
                                  ?.copyWith(
                                    fontSize: 38,
                                    height: 1.06,
                                  ),
                            ),
                            const SizedBox(height: 12),
                            const Text(
                              'Sign in to continue planning your next adventure.',
                              style: TextStyle(
                                  color: AppColors.muted, fontSize: 16),
                            ),
                            const SizedBox(height: 32),
                            TextFormField(
                              controller: _identifier,
                              keyboardType: TextInputType.emailAddress,
                              textInputAction: TextInputAction.next,
                              autofillHints: const [
                                AutofillHints.email,
                                AutofillHints.telephoneNumber,
                              ],
                              decoration: const InputDecoration(
                                labelText: 'Phone Number',
                                hintText: '98xxxxxxxx',
                                prefixIcon: Icon(Icons.phone_rounded),
                              ),
                              validator: _validateIdentifier,
                            ),
                            const SizedBox(height: 16),
                            TextFormField(
                              controller: _password,
                              obscureText: _passwordHidden,
                              textInputAction: TextInputAction.done,
                              autofillHints: const [AutofillHints.password],
                              onFieldSubmitted: (_) => _submit(),
                              decoration: InputDecoration(
                                labelText: 'Password',
                                prefixIcon:
                                    const Icon(Icons.lock_outline_rounded),
                                suffixIcon: IconButton(
                                  tooltip: _passwordHidden
                                      ? 'Show password'
                                      : 'Hide password',
                                  onPressed: () => setState(
                                    () => _passwordHidden = !_passwordHidden,
                                  ),
                                  icon: Icon(
                                    _passwordHidden
                                        ? Icons.visibility_outlined
                                        : Icons.visibility_off_outlined,
                                  ),
                                ),
                              ),
                              validator: (value) => (value?.length ?? 0) < 6
                                  ? 'Password must be at least 6 characters'
                                  : null,
                            ),
                            Align(
                              alignment: Alignment.centerRight,
                              child: TextButton(
                                onPressed: _loading ? null : _showPasswordHelp,
                                child: const Text('Forgot Password?'),
                              ),
                            ),
                            if (_error case final error?) ...[
                              FormErrorBanner(message: error),
                              const SizedBox(height: 18),
                            ],
                            AnimatedActionButton(
                              label: _cooldownSeconds > 0
                                  ? 'Try again in ${_cooldownSeconds}s'
                                  : 'Sign In',
                              loading: _loading,
                              onPressed: _cooldownSeconds > 0 ? null : _submit,
                            ),
                            const SizedBox(height: 22),
                            Row(
                              children: [
                                const Expanded(child: Divider()),
                                Padding(
                                  padding: const EdgeInsets.symmetric(
                                      horizontal: 14),
                                  child: Text(
                                    'New to TripSathi?',
                                    style:
                                        Theme.of(context).textTheme.bodySmall,
                                  ),
                                ),
                                const Expanded(child: Divider()),
                              ],
                            ),
                            const SizedBox(height: 18),
                            OutlinedButton(
                              onPressed: _loading
                                  ? null
                                  : () => Navigator.of(context)
                                      .pushNamed(RouteNames.signup),
                              child: const Text('Create Account'),
                            ),
                          ],
                        ),
                      ),
                    ),
                  ),
                ),
              ),
            ),
          ),
        ),
      );

  String? _validateIdentifier(String? rawValue) {
    final value = rawValue?.trim() ?? '';
    if (value.isEmpty) return 'Enter your email or phone number';
    final isPhone =
        RegExp(r'^\d{10}$').hasMatch(ApiService.normalizePhoneNumber(value));
    final isEmail = RegExp(r'^[^\s@]+@[^\s@]+\.[^\s@]+$').hasMatch(value);
    return isPhone || isEmail
        ? null
        : 'Enter a valid email or 10-digit phone number';
  }
}
