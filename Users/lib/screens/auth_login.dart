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
<<<<<<< HEAD:Users/lib/screens/auth_login.dart
      final phone = _phoneController.text.trim();
      final password = _passwordController.text;

      if (phone.isEmpty) {
        throw Exception('Phone number is required');
      }

      if(!RegExp(r'^\d{10}$').hasMatch(phone)) {
        throw Exception('Phone number must be 10 digits');
      }

      if (password.isEmpty) {
        throw Exception('Password is required');
      }

      await ApiService.login(phone, password);

      if (!mounted) return;

      Navigator.of(context).pushReplacementNamed('/dashboard');
    } catch (e) {
      if (!mounted) return;

      setState(() {
        _error = e.toString().replaceAll('Exception: ', '');
      });
    } finally {
      if (mounted) {
        setState(() {
          _loading = false;
        });
      }
=======
      await ApiService.login(_phone.text.trim(), _password.text);
      if (!mounted) return;
      Navigator.of(context).pushNamedAndRemoveUntil('/profile', (_) => false);
    } catch (error) {
      if (mounted) setState(() => _error = ApiService.readableError(error));
    } finally {
      if (mounted) setState(() => _loading = false);
>>>>>>> e09d3789ef38baf838053502fd4c44d5b127d5a4:Users/lib/screens/login.dart
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
<<<<<<< HEAD:Users/lib/screens/auth_login.dart
      backgroundColor: Colors.white,
      body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.symmetric(
            horizontal: 24,
            vertical: 20,
          ),
          child: SizedBox(
            height: MediaQuery.of(context).size.height - 100,
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Spacer(),
                Center(
                  child: Container(
                    width: 100,
                    height: 100,
                    decoration: BoxDecoration(
                      color: Theme.of(context).colorScheme.primaryContainer,
                      borderRadius: BorderRadius.circular(28),
                    ),
                    child: Icon(
                      Icons.travel_explore,
                      size: 55,
                      color: Theme.of(context).colorScheme.primary,
                    ),
                  ),
                ),
                const SizedBox(height: 30),
                const Center(
                  child: Text(
                    'Yatri',
                    style: TextStyle(
                      fontSize: 34,
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                ),
                const SizedBox(height: 10),
                Center(
                  child: Text(
                    'Explore Nepal with travelers like you',
                    textAlign: TextAlign.center,
                    style: TextStyle(
                      color: Colors.grey.shade600,
                      fontSize: 15,
                    ),
                  ),
                ),
                const SizedBox(height: 40),
                TextField(
                  controller: _phoneController,
                  keyboardType: TextInputType.phone,
                  textInputAction: TextInputAction.next,
                  decoration: InputDecoration(
                    labelText: 'Phone Number',
                    hintText: 'Enter your phone number',
                    prefixIcon: const Icon(Icons.phone_outlined),
                  ),
                ),
                const SizedBox(height: 18),
                TextField(
                  controller: _passwordController,
                  obscureText: _obscurePassword,
                  decoration: InputDecoration(
                    labelText: 'Password',
                    hintText: 'Enter your password',
                    prefixIcon: const Icon(Icons.lock_outline),
                    suffixIcon: IconButton(
                      onPressed: () {
                        setState(() {
                          _obscurePassword = !_obscurePassword;
                        });
                      },
                      icon: Icon(
                        _obscurePassword
                            ? Icons.visibility_off
                            : Icons.visibility,
                      ),
                    ),
                  ),
                ),
                const SizedBox(height: 10),
                Align(
                  alignment: Alignment.centerRight,
                  child: TextButton(
                    onPressed: () {},
                    child: const Text('Forgot Password?'),
                  ),
                ),
                if (_error != null) ...[
                  const SizedBox(height: 8),
                  Container(
                    width: double.infinity,
                    padding: const EdgeInsets.all(14),
                    decoration: BoxDecoration(
                      color: Colors.red.shade50,
                      borderRadius: BorderRadius.circular(14),
                    ),
                    child: Text(
                      _error!,
                      style: const TextStyle(
                        color: Colors.red,
                      ),
                    ),
                  ),
                ],
                const SizedBox(height: 24),
                SizedBox(
                  width: double.infinity,
                  height: 56,
                  child: ElevatedButton(
                    onPressed: _loading ? null : _submit,
                    child: _loading
                        ? const SizedBox(
                            height: 24,
                            width: 24,
                            child: CircularProgressIndicator(
                              strokeWidth: 2.5,
                              color: Colors.white,
                            ),
                          )
                        : const Text(
                            'Login',
                            style: TextStyle(
                              fontSize: 16,
                              fontWeight: FontWeight.w600,
                            ),
                          ),
                  ),
                ),
                const SizedBox(height: 26),
                Row(
                  children: [
                    Expanded(
                      child: Divider(
                        color: Colors.grey.shade300,
                      ),
                    ),
                    Padding(
                      padding: const EdgeInsets.symmetric(horizontal: 12),
                      child: Text(
                        'OR',
                        style: TextStyle(
                          color: Colors.grey.shade600,
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                    ),
                    Expanded(
                      child: Divider(
                        color: Colors.grey.shade300,
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 24),
                SizedBox(
                  width: double.infinity,
                  height: 56,
                  child: OutlinedButton.icon(
                    onPressed: _googleLogin,
                    icon: const Text(
                      'G',
                      style: TextStyle(
                        fontSize: 18,
                        fontWeight: FontWeight.bold,
                        color: Color(0xFF4285F4),
                      ),
                    ),
                    label: const Text(
                      'Continue with Google',
                      style: TextStyle(
                        color: Colors.black87,
                        fontSize: 15,
                        fontWeight: FontWeight.w500,
                      ),
                    ),
                  ),
                ),
                const SizedBox(height: 30),
                Row(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    Text(
                      'Don\'t have an account?',
                      style: TextStyle(
                        color: Colors.grey.shade700,
                      ),
                    ),
                    TextButton(
                      onPressed: () {
                        Navigator.of(context).pushNamed('/signup');
                      },
                      child: const Text(
                        'Sign Up',
                        style: TextStyle(
                          fontWeight: FontWeight.bold,
                        ),
                      ),
                    ),
                  ],
                ),
                const Spacer(),
              ],
            ),
          ),
        ),
      ),
    );
  }

  @override
  void dispose() {
    _phoneController.dispose();
    _passwordController.dispose();
    super.dispose();
  }
=======
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
>>>>>>> e09d3789ef38baf838053502fd4c44d5b127d5a4:Users/lib/screens/login.dart
}
