import 'package:flutter/material.dart';

import '../services/api.dart';

class LoginScreen extends StatefulWidget {
  const LoginScreen({super.key});

  @override
  State<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends State<LoginScreen> {
  final _formKey = GlobalKey<FormState>();
  final _phone = TextEditingController();
  final _password = TextEditingController();
  bool _loading = false;
  bool _hidden = true;
  String? _error;

  Future<void> _submit() async {
    FocusScope.of(context).unfocus();
    if (!_formKey.currentState!.validate()) return;
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      await ApiService.login(_phone.text.trim(), _password.text);
      if (!mounted) return;
      Navigator.of(context).pushNamedAndRemoveUntil('/profile', (_) => false);
    } catch (error) {
      if (mounted) setState(() => _error = ApiService.readableError(error));
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  void dispose() {
    _phone.dispose();
    _password.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: Stack(children: [
        Positioned(
            top: -90,
            right: -80,
            child: Container(
                width: 260,
                height: 260,
                decoration: const BoxDecoration(
                    shape: BoxShape.circle, color: Color(0x1A0D9488)))),
        SafeArea(
            child: Center(
                child: SingleChildScrollView(
                    padding: const EdgeInsets.all(24),
                    child: ConstrainedBox(
                        constraints: const BoxConstraints(maxWidth: 460),
                        child: Form(
                            key: _formKey,
                            child: Column(
                                crossAxisAlignment: CrossAxisAlignment.stretch,
                                children: [
                                  Row(children: [
                                    Container(
                                        width: 54,
                                        height: 54,
                                        decoration: BoxDecoration(
                                            color: const Color(0xFF0D9488),
                                            borderRadius:
                                                BorderRadius.circular(18)),
                                        child: const Icon(Icons.explore_rounded,
                                            color: Colors.white, size: 32)),
                                    const SizedBox(width: 13),
                                    const Text('TripSathi',
                                        style: TextStyle(
                                            fontSize: 24,
                                            fontWeight: FontWeight.w900,
                                            color: Color(0xFF12312E)))
                                  ]),
                                  const SizedBox(height: 54),
                                  const Text('Welcome back,\nexplorer!',
                                      style: TextStyle(
                                          fontSize: 36,
                                          height: 1.08,
                                          fontWeight: FontWeight.w900,
                                          letterSpacing: -1,
                                          color: Color(0xFF12312E))),
                                  const SizedBox(height: 12),
                                  const Text(
                                      'Your next achievement is waiting for you.',
                                      style: TextStyle(
                                          fontSize: 16,
                                          color: Color(0xFF647773))),
                                  const SizedBox(height: 32),
                                  TextFormField(
                                      controller: _phone,
                                      keyboardType: TextInputType.phone,
                                      autofillHints: const [
                                        AutofillHints.telephoneNumber
                                      ],
                                      decoration: const InputDecoration(
                                          labelText: 'Phone number',
                                          hintText: '98XXXXXXXX',
                                          prefixIcon:
                                              Icon(Icons.phone_rounded)),
                                      validator: (v) => RegExp(r'^\d{10}$')
                                              .hasMatch(v?.trim() ?? '')
                                          ? null
                                          : 'Enter your 10-digit phone number'),
                                  const SizedBox(height: 16),
                                  TextFormField(
                                      controller: _password,
                                      obscureText: _hidden,
                                      autofillHints: const [
                                        AutofillHints.password
                                      ],
                                      decoration: InputDecoration(
                                          labelText: 'Password',
                                          prefixIcon:
                                              const Icon(Icons.lock_rounded),
                                          suffixIcon: IconButton(
                                              onPressed: () => setState(
                                                  () => _hidden = !_hidden),
                                              icon: Icon(_hidden
                                                  ? Icons.visibility_rounded
                                                  : Icons
                                                      .visibility_off_rounded))),
                                      validator: (v) => (v?.length ?? 0) >= 6
                                          ? null
                                          : 'Password must be at least 6 characters',
                                      onFieldSubmitted: (_) => _submit()),
                                  if (_error != null)
                                    Padding(
                                        padding: const EdgeInsets.only(top: 16),
                                        child: Container(
                                            padding: const EdgeInsets.all(14),
                                            decoration: BoxDecoration(
                                                color: const Color(0xFFFFE8E7),
                                                borderRadius:
                                                    BorderRadius.circular(14)),
                                            child: Row(children: [
                                              const Icon(
                                                  Icons.error_outline_rounded,
                                                  color: Color(0xFFB42318)),
                                              const SizedBox(width: 10),
                                              Expanded(
                                                  child: Text(_error!,
                                                      style: const TextStyle(
                                                          color: Color(
                                                              0xFF912018))))
                                            ]))),
                                  const SizedBox(height: 24),
                                  ElevatedButton(
                                      onPressed: _loading ? null : _submit,
                                      child: _loading
                                          ? const SizedBox(
                                              width: 24,
                                              height: 24,
                                              child: CircularProgressIndicator(
                                                  color: Colors.white,
                                                  strokeWidth: 2.5))
                                          : const Row(
                                              mainAxisAlignment:
                                                  MainAxisAlignment.center,
                                              children: [
                                                  Text('Continue journey'),
                                                  SizedBox(width: 8),
                                                  Icon(Icons
                                                      .arrow_forward_rounded)
                                                ])),
                                  const SizedBox(height: 22),
                                  Row(children: [
                                    const Expanded(child: Divider()),
                                    Padding(
                                        padding: const EdgeInsets.symmetric(
                                            horizontal: 14),
                                        child: Text('New to TripSathi?',
                                            style: TextStyle(
                                                color: Colors.grey.shade600))),
                                    const Expanded(child: Divider())
                                  ]),
                                  const SizedBox(height: 16),
                                  OutlinedButton(
                                      onPressed: () => Navigator.of(context)
                                          .pushNamed('/signup'),
                                      style: OutlinedButton.styleFrom(
                                          minimumSize:
                                              const Size.fromHeight(56),
                                          side: const BorderSide(
                                              color: Color(0xFF0D9488)),
                                          shape: RoundedRectangleBorder(
                                              borderRadius:
                                                  BorderRadius.circular(18))),
                                      child: const Text(
                                          'Create my explorer account',
                                          style: TextStyle(
                                              fontWeight: FontWeight.w700))),
                                ])))))),
      ]),
    );
  }
}
