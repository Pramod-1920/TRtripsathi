import 'package:flutter/material.dart';

import '../services/api.dart';

class SignupScreen extends StatefulWidget {
  const SignupScreen({super.key});

  @override
  State<SignupScreen> createState() => _SignupScreenState();
}

class _SignupScreenState extends State<SignupScreen> {
  final _formKey = GlobalKey<FormState>();
  final _phone = TextEditingController();
  final _password = TextEditingController();
  final _confirm = TextEditingController();
  int _step = 0;
  int _identity = 0;
  bool _loading = false;
  bool _hidden = true;
  bool _confirmHidden = true;
  String? _error;

  static const _identities = [
    (
      icon: Icons.hiking_rounded,
      title: 'Trail Seeker',
      subtitle: 'Hikes & hidden paths'
    ),
    (
      icon: Icons.temple_buddhist_rounded,
      title: 'Culture Keeper',
      subtitle: 'Heritage & stories'
    ),
    (
      icon: Icons.landscape_rounded,
      title: 'Nature Soul',
      subtitle: 'Views & wild places'
    ),
  ];

  bool get _strong =>
      RegExp(r'^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&]).{6,}$')
          .hasMatch(_password.text);

  Future<void> _create() async {
    FocusScope.of(context).unfocus();
    if (!_formKey.currentState!.validate()) return;
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      await ApiService.signup(_phone.text.trim(), _password.text);
      if (!mounted) return;
      Navigator.of(context)
          .pushNamedAndRemoveUntil('/profile-setup', (_) => false);
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
    _confirm.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
          backgroundColor: Colors.transparent,
          leading: IconButton(
              onPressed: () => _step == 0
                  ? Navigator.pop(context)
                  : setState(() => _step = 0),
              icon: const Icon(Icons.arrow_back_rounded)),
          title: Text('Step ${_step + 1} of 2',
              style:
                  const TextStyle(fontSize: 14, fontWeight: FontWeight.w700)),
          centerTitle: true),
      body: SafeArea(
          child: Center(
              child: SingleChildScrollView(
                  padding: const EdgeInsets.fromLTRB(24, 12, 24, 28),
                  child: ConstrainedBox(
                      constraints: const BoxConstraints(maxWidth: 500),
                      child: AnimatedSwitcher(
                          duration: const Duration(milliseconds: 300),
                          child: _step == 0
                              ? _identityStep()
                              : _accountStep()))))),
    );
  }

  Widget _identityStep() => Column(
        key: const ValueKey('identity'),
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          const Text('Choose your\nexplorer identity',
              style: TextStyle(
                  fontSize: 34,
                  height: 1.08,
                  fontWeight: FontWeight.w900,
                  color: Color(0xFF12312E))),
          const SizedBox(height: 12),
          const Text(
              'This is the beginning of your journey. You can change it later.',
              style: TextStyle(
                  fontSize: 16, height: 1.45, color: Color(0xFF647773))),
          const SizedBox(height: 30),
          ...List.generate(_identities.length, (index) {
            final item = _identities[index];
            final selected = _identity == index;
            return Padding(
              padding: const EdgeInsets.only(bottom: 14),
              child: InkWell(
                onTap: () => setState(() => _identity = index),
                borderRadius: BorderRadius.circular(22),
                child: AnimatedContainer(
                  duration: const Duration(milliseconds: 200),
                  padding: const EdgeInsets.all(18),
                  decoration: BoxDecoration(
                    color: selected ? const Color(0xFFE7F7F4) : Colors.white,
                    borderRadius: BorderRadius.circular(22),
                    border: Border.all(
                        color: selected
                            ? const Color(0xFF0D9488)
                            : const Color(0xFFE1EAE7),
                        width: selected ? 2 : 1),
                  ),
                  child: Row(children: [
                    Container(
                        width: 58,
                        height: 58,
                        decoration: BoxDecoration(
                            color: selected
                                ? const Color(0xFF0D9488)
                                : const Color(0xFFF0F5F4),
                            borderRadius: BorderRadius.circular(18)),
                        child: Icon(item.icon,
                            color: selected
                                ? Colors.white
                                : const Color(0xFF54706B),
                            size: 31)),
                    const SizedBox(width: 16),
                    Expanded(
                        child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                          Text(item.title,
                              style: const TextStyle(
                                  fontSize: 17, fontWeight: FontWeight.w800)),
                          const SizedBox(height: 4),
                          Text(item.subtitle,
                              style: const TextStyle(color: Color(0xFF647773)))
                        ])),
                    Icon(
                        selected
                            ? Icons.check_circle_rounded
                            : Icons.circle_outlined,
                        color: selected
                            ? const Color(0xFF0D9488)
                            : const Color(0xFFB7C7C3)),
                  ]),
                ),
              ),
            );
          }),
          const SizedBox(height: 14),
          ElevatedButton(
              onPressed: () => setState(() => _step = 1),
              child: const Text('Claim my identity')),
        ],
      );

  Widget _accountStep() => Form(
      key: _formKey,
      child: Column(
          key: const ValueKey('account'),
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Container(
                width: 72,
                height: 72,
                alignment: Alignment.center,
                decoration: BoxDecoration(
                    color: const Color(0xFFE7F7F4),
                    borderRadius: BorderRadius.circular(24)),
                child: Icon(_identities[_identity].icon,
                    size: 40, color: const Color(0xFF0D9488))),
            const SizedBox(height: 24),
            Text('Create your ${_identities[_identity].title} account',
                textAlign: TextAlign.center,
                style: const TextStyle(
                    fontSize: 28,
                    height: 1.15,
                    fontWeight: FontWeight.w900,
                    color: Color(0xFF12312E))),
            const SizedBox(height: 10),
            const Text(
                'Start at Level 1 • Unlock daily quests • Earn your first badge',
                textAlign: TextAlign.center,
                style: TextStyle(color: Color(0xFF647773), height: 1.4)),
            const SizedBox(height: 28),
            TextFormField(
                controller: _phone,
                keyboardType: TextInputType.phone,
                decoration: const InputDecoration(
                    labelText: 'Phone number',
                    hintText: '98XXXXXXXX',
                    prefixIcon: Icon(Icons.phone_rounded)),
                validator: (v) => RegExp(r'^\d{10}$').hasMatch(v?.trim() ?? '')
                    ? null
                    : 'Enter exactly 10 digits'),
            const SizedBox(height: 14),
            TextFormField(
                controller: _password,
                obscureText: _hidden,
                onChanged: (_) => setState(() {}),
                decoration: InputDecoration(
                    labelText: 'Create password',
                    prefixIcon: const Icon(Icons.lock_rounded),
                    suffixIcon: IconButton(
                        onPressed: () => setState(() => _hidden = !_hidden),
                        icon: Icon(_hidden
                            ? Icons.visibility_rounded
                            : Icons.visibility_off_rounded))),
                validator: (_) =>
                    _strong ? null : 'Please meet all password requirements'),
            const SizedBox(height: 10),
            Wrap(
                spacing: 7,
                runSpacing: 7,
                children: [
                  ('6+ characters', _password.text.length >= 6),
                  ('Uppercase', RegExp('[A-Z]').hasMatch(_password.text)),
                  ('Number', RegExp(r'\d').hasMatch(_password.text)),
                  ('Symbol', RegExp(r'[@$!%*?&]').hasMatch(_password.text))
                ]
                    .map((rule) => Container(
                        padding: const EdgeInsets.symmetric(
                            horizontal: 10, vertical: 6),
                        decoration: BoxDecoration(
                            color: rule.$2
                                ? const Color(0xFFE7F7F4)
                                : const Color(0xFFF0F3F2),
                            borderRadius: BorderRadius.circular(20)),
                        child: Text('${rule.$2 ? '✓' : '○'} ${rule.$1}',
                            style: TextStyle(
                                fontSize: 12,
                                fontWeight: FontWeight.w600,
                                color: rule.$2
                                    ? const Color(0xFF087A70)
                                    : const Color(0xFF647773)))))
                    .toList()),
            const SizedBox(height: 14),
            TextFormField(
                controller: _confirm,
                obscureText: _confirmHidden,
                decoration: InputDecoration(
                    labelText: 'Confirm password',
                    prefixIcon: const Icon(Icons.verified_user_rounded),
                    suffixIcon: IconButton(
                      onPressed: () => setState(
                        () => _confirmHidden = !_confirmHidden,
                      ),
                      icon: Icon(
                        _confirmHidden
                            ? Icons.visibility_rounded
                            : Icons.visibility_off_rounded,
                      ),
                    )),
                validator: (v) =>
                    v == _password.text ? null : 'Passwords do not match'),
            if (_error != null)
              Padding(
                  padding: const EdgeInsets.only(top: 14),
                  child: Text(_error!,
                      style: const TextStyle(
                          color: Color(0xFFB42318),
                          fontWeight: FontWeight.w600))),
            const SizedBox(height: 24),
            ElevatedButton(
                onPressed: _loading ? null : _create,
                child: _loading
                    ? const SizedBox(
                        width: 24,
                        height: 24,
                        child: CircularProgressIndicator(
                            color: Colors.white, strokeWidth: 2.5))
                    : const Text('Create account & earn 50 XP')),
            const SizedBox(height: 12),
            const Text(
                'By continuing, you agree to explore responsibly and respect local communities.',
                textAlign: TextAlign.center,
                style: TextStyle(
                    fontSize: 12, height: 1.4, color: Color(0xFF7A8C88))),
          ]));
}
