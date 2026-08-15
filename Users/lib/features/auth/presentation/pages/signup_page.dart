import 'dart:convert';
import 'dart:io';
import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:image_picker/image_picker.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:trtripsathi_mobile/core/navigation/route_names.dart';
import 'package:trtripsathi_mobile/core/networking/api_service.dart';
import 'package:trtripsathi_mobile/core/theme/app_theme.dart';
import 'package:trtripsathi_mobile/core/widgets/animated_action_button.dart';
import 'package:trtripsathi_mobile/core/widgets/brand_mark.dart';
import 'package:trtripsathi_mobile/core/widgets/form_error_banner.dart';
import 'package:trtripsathi_mobile/core/widgets/travel_background.dart';

class SignupScreen extends StatefulWidget {
  const SignupScreen({super.key});

  @override
  State<SignupScreen> createState() => _SignupScreenState();
}

class _SignupScreenState extends State<SignupScreen>
    with TickerProviderStateMixin {
  final _formKey = GlobalKey<FormState>();
  final _firstName = TextEditingController();
  final _middleName = TextEditingController();
  final _lastName = TextEditingController();
  final _email = TextEditingController();
  final _phone = TextEditingController();
  final _password = TextEditingController();
  final _confirmPassword = TextEditingController();
  final _address = TextEditingController();
  final _dateOfBirth = TextEditingController();
  late final AnimationController _entranceController;
  late final AnimationController _travelController;
  late final Animation<double> _entrance;

  File? _profileImage;
  DateTime? _selectedDate;
  String? _gender;
  String? _error;
  bool _acceptTerms = false;
  bool _loading = false;
  bool _passwordHidden = true;
  bool _confirmHidden = true;

  static const _genderOptions = {
    'male': 'Male',
    'female': 'Female',
    'non_binary': 'Non-binary',
    'other': 'Other',
    'prefer_not_to_say': 'Prefer not to say',
  };

  @override
  void initState() {
    super.initState();
    _entranceController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 700),
    )..forward();
    _entrance = CurvedAnimation(
      parent: _entranceController,
      curve: Curves.easeOutCubic,
    );
    _travelController = AnimationController(
      vsync: this,
      duration: const Duration(seconds: 9),
    )..repeat();
  }

  Future<void> _pickProfileImage() async {
    FocusManager.instance.primaryFocus?.unfocus();
    try {
      final selected = await ImagePicker().pickImage(
        source: ImageSource.gallery,
        imageQuality: 82,
        maxWidth: 1440,
        maxHeight: 1440,
      );
      if (selected == null || !mounted) return;
      setState(() {
        _profileImage = File(selected.path);
        _error = null;
      });
    } catch (_) {
      if (mounted) {
        setState(() => _error =
            'Could not open your photos. Check the app permission and try again.');
      }
    }
  }

  Future<void> _selectDate() async {
    FocusManager.instance.primaryFocus?.unfocus();
    final today = DateTime.now();
    final latest = DateTime(today.year - 13, today.month, today.day);
    final selected = await showDatePicker(
      context: context,
      initialDate: _selectedDate ?? DateTime(today.year - 20),
      firstDate: DateTime(today.year - 100),
      lastDate: latest,
      helpText: 'Select date of birth',
    );
    if (selected == null) return;
    setState(() {
      _selectedDate = selected;
      _dateOfBirth.text = _displayDate(selected);
    });
  }

  Future<void> _submit() async {
    if (_loading) return;
    FocusManager.instance.primaryFocus?.unfocus();
    if (!(_formKey.currentState?.validate() ?? false)) return;
    if (_profileImage == null) {
      setState(() => _error = 'Add a clear profile photo to continue.');
      return;
    }
    if (!_acceptTerms) {
      setState(() =>
          _error = 'Please accept the Terms of Service and Privacy Policy.');
      return;
    }

    setState(() {
      _loading = true;
      _error = null;
    });

    try {
      final normalizedPhone =
          ApiService.normalizePhoneNumber(_phone.text.trim());
      final signupResult = await ApiService.signup(
        normalizedPhone,
        _password.text,
        firstName: _firstName.text.trim(),
        middleName:
            _middleName.text.trim().isEmpty ? null : _middleName.text.trim(),
        lastName: _lastName.text.trim(),
        email: _email.text.trim().toLowerCase(),
        address: _address.text.trim(),
        gender: _gender,
        dateOfBirth: _selectedDate == null ? null : _apiDate(_selectedDate!),
        profileImage: _profileImage,
      );

      final preferences = await SharedPreferences.getInstance();
      if (signupResult['_legacyProfileSaved'] == false) {
        await preferences.setString(
          'pending_identity_profile',
          jsonEncode({
            'firstName': _firstName.text.trim(),
            if (_middleName.text.trim().isNotEmpty)
              'middleName': _middleName.text.trim(),
            'lastName': _lastName.text.trim(),
            'email': _email.text.trim().toLowerCase(),
            'location': _address.text.trim(),
            'gender': _gender,
            if (_selectedDate != null) 'dateOfBirth': _apiDate(_selectedDate!),
          }),
        );
      } else {
        await preferences.remove('pending_identity_profile');
      }
      if (signupResult['_profilePhotoUploaded'] == false) {
        await preferences.setString(
          'pending_profile_image_path',
          _profileImage!.path,
        );
      } else {
        await preferences.remove('pending_profile_image_path');
      }
      await Future.wait([
        preferences.setBool('intro_done', true),
        preferences.setBool('account_created', true),
        preferences.setBool('onboarding_done', false),
      ]);

      if (!mounted) return;
      await _showAccountCreated();
      if (!mounted) return;
      Navigator.of(context).pushNamedAndRemoveUntil(
        RouteNames.accountVerification,
        (_) => false,
      );
    } catch (error) {
      final message = ApiService.readableError(error);
      final accountExists = message.toLowerCase().contains('already') &&
          (message.toLowerCase().contains('phone') ||
              message.toLowerCase().contains('email'));
      if (accountExists && mounted) {
        await _showExistingAccount();
        if (!mounted) return;
        Navigator.of(context).pushNamedAndRemoveUntil(
          RouteNames.login,
          (_) => false,
          arguments: ApiService.normalizePhoneNumber(_phone.text),
        );
      } else if (mounted) {
        setState(() => _error = message);
      }
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _showExistingAccount() => showDialog<void>(
        context: context,
        builder: (context) => AlertDialog(
          icon: const Icon(Icons.login_rounded,
              color: AppColors.goldDark, size: 48),
          title: const Text('Account already exists'),
          content: const Text(
            'This phone number or email is already registered. We will take you to sign in.',
            textAlign: TextAlign.center,
          ),
          actions: [
            FilledButton(
              onPressed: () => Navigator.pop(context),
              child: const Text('Continue to Sign In'),
            ),
          ],
        ),
      );

  Future<void> _showAccountCreated() async {
    Future<void>.delayed(const Duration(milliseconds: 1400), () {
      if (mounted && Navigator.of(context, rootNavigator: true).canPop()) {
        Navigator.of(context, rootNavigator: true).pop();
      }
    });
    await showDialog<void>(
      context: context,
      barrierDismissible: false,
      builder: (context) => const AlertDialog(
        icon: Icon(Icons.check_circle_rounded,
            color: Color(0xFF1F7A4D), size: 58),
        title: Text('Account created successfully'),
        content: Text(
          'Your traveler account is ready. Taking you to sign in...',
          textAlign: TextAlign.center,
        ),
      ),
    );
  }

  @override
  void dispose() {
    _firstName.dispose();
    _middleName.dispose();
    _lastName.dispose();
    _email.dispose();
    _phone.dispose();
    _password.dispose();
    _confirmPassword.dispose();
    _address.dispose();
    _dateOfBirth.dispose();
    _entranceController.dispose();
    _travelController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => Scaffold(
        body: TravelBackground(
          showOrbit: true,
          child: SafeArea(
            child: Center(
              child: SingleChildScrollView(
                padding: const EdgeInsets.fromLTRB(20, 12, 20, 32),
                child: ConstrainedBox(
                  constraints: const BoxConstraints(maxWidth: 760),
                  child: FadeTransition(
                    opacity: _entrance,
                    child: SlideTransition(
                      position: Tween<Offset>(
                        begin: const Offset(0, .035),
                        end: Offset.zero,
                      ).animate(_entrance),
                      child: AutofillGroup(
                        child: Form(
                          key: _formKey,
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.stretch,
                            children: [
                              Row(
                                children: [
                                  IconButton.filledTonal(
                                    tooltip: 'Back',
                                    onPressed: _loading
                                        ? null
                                        : () =>
                                            Navigator.of(context).maybePop(),
                                    icon: const Icon(Icons.arrow_back_rounded),
                                  ),
                                  const Spacer(),
                                  const BrandMark(size: 42, showName: true),
                                ],
                              ),
                              const SizedBox(height: 24),
                              _travelHeader(context),
                              const SizedBox(height: 24),
                              _profilePhotoPicker(),
                              const SizedBox(height: 28),
                              LayoutBuilder(
                                builder: (context, constraints) {
                                  final twoColumns =
                                      constraints.maxWidth >= 620;
                                  return Column(
                                    children: [
                                      _NameFields(
                                        threeColumns: twoColumns,
                                        first: _firstNameField(),
                                        middle: _middleNameField(),
                                        last: _lastNameField(),
                                      ),
                                      const SizedBox(height: 16),
                                      _FieldRow(
                                        twoColumns: twoColumns,
                                        first: _emailField(),
                                        second: _phoneField(),
                                      ),
                                      const SizedBox(height: 16),
                                      _FieldRow(
                                        twoColumns: twoColumns,
                                        first: _passwordField(),
                                        second: _confirmPasswordField(),
                                      ),
                                      const SizedBox(height: 16),
                                      _FieldRow(
                                        twoColumns: twoColumns,
                                        first: _genderField(),
                                        second: _dateField(),
                                      ),
                                    ],
                                  );
                                },
                              ),
                              const SizedBox(height: 16),
                              TextFormField(
                                controller: _address,
                                textCapitalization: TextCapitalization.words,
                                textInputAction: TextInputAction.newline,
                                minLines: 2,
                                maxLines: 3,
                                decoration: const InputDecoration(
                                  labelText: 'Address',
                                  hintText:
                                      'City, district, or current location',
                                  alignLabelWithHint: true,
                                  prefixIcon: Padding(
                                    padding: EdgeInsets.only(bottom: 28),
                                    child: Icon(Icons.location_on_outlined),
                                  ),
                                ),
                                validator: (value) =>
                                    (value?.trim().length ?? 0) < 3
                                        ? 'Enter your address'
                                        : null,
                              ),
                              const SizedBox(height: 14),
                              InkWell(
                                onTap: _loading
                                    ? null
                                    : () => setState(
                                        () => _acceptTerms = !_acceptTerms),
                                borderRadius: BorderRadius.circular(14),
                                child: Padding(
                                  padding:
                                      const EdgeInsets.symmetric(vertical: 6),
                                  child: Row(
                                    crossAxisAlignment:
                                        CrossAxisAlignment.start,
                                    children: [
                                      Checkbox(
                                        value: _acceptTerms,
                                        onChanged: _loading
                                            ? null
                                            : (value) => setState(
                                                  () => _acceptTerms =
                                                      value ?? false,
                                                ),
                                      ),
                                      const SizedBox(width: 4),
                                      const Expanded(
                                        child: Padding(
                                          padding: EdgeInsets.only(top: 11),
                                          child: Text.rich(
                                            TextSpan(
                                              text: 'I agree to the ',
                                              children: [
                                                TextSpan(
                                                  text: 'Terms of Service',
                                                  style: TextStyle(
                                                      fontWeight:
                                                          FontWeight.w800),
                                                ),
                                                TextSpan(text: ' and '),
                                                TextSpan(
                                                  text: 'Privacy Policy',
                                                  style: TextStyle(
                                                      fontWeight:
                                                          FontWeight.w800),
                                                ),
                                                TextSpan(text: '.'),
                                              ],
                                            ),
                                            style: TextStyle(
                                                color: AppColors.muted,
                                                height: 1.4),
                                          ),
                                        ),
                                      ),
                                    ],
                                  ),
                                ),
                              ),
                              if (_error case final error?) ...[
                                const SizedBox(height: 10),
                                FormErrorBanner(message: error),
                              ],
                              const SizedBox(height: 22),
                              AnimatedActionButton(
                                label: 'Create Account',
                                icon: Icons.rocket_launch_rounded,
                                loading: _loading,
                                onPressed: _submit,
                              ),
                              const SizedBox(height: 14),
                              TextButton(
                                onPressed: _loading
                                    ? null
                                    : () => Navigator.of(context)
                                        .pushReplacementNamed(RouteNames.login),
                                child: const Text(
                                    'Already have an account? Sign In'),
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
        ),
      );

  Widget _travelHeader(BuildContext context) => Container(
        padding: const EdgeInsets.fromLTRB(22, 22, 18, 22),
        decoration: BoxDecoration(
          gradient: const LinearGradient(
            colors: [AppColors.navy, AppColors.navyLight],
            begin: Alignment.topLeft,
            end: Alignment.bottomRight,
          ),
          borderRadius: BorderRadius.circular(28),
          boxShadow: [
            BoxShadow(
              color: AppColors.navy.withValues(alpha: .2),
              blurRadius: 30,
              offset: const Offset(0, 14),
            ),
          ],
        ),
        child: Row(
          children: [
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Container(
                    padding:
                        const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                    decoration: BoxDecoration(
                      color: AppColors.gold.withValues(alpha: .16),
                      borderRadius: BorderRadius.circular(99),
                    ),
                    child: const Text(
                      'YOUR JOURNEY BEGINS HERE',
                      style: TextStyle(
                        color: AppColors.gold,
                        fontSize: 10,
                        letterSpacing: 1.1,
                        fontWeight: FontWeight.w900,
                      ),
                    ),
                  ),
                  const SizedBox(height: 13),
                  Text(
                    'Create your\ntraveler account.',
                    style: Theme.of(context).textTheme.displaySmall?.copyWith(
                          color: Colors.white,
                          fontSize: 34,
                          height: 1.04,
                        ),
                  ),
                  const SizedBox(height: 9),
                  Text(
                    'Meet companions. Discover routes. Travel with confidence.',
                    style: TextStyle(
                      color: Colors.white.withValues(alpha: .76),
                      height: 1.4,
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(width: 14),
            SizedBox(
              width: 92,
              height: 104,
              child: AnimatedBuilder(
                animation: _travelController,
                builder: (context, child) => Stack(
                  alignment: Alignment.center,
                  children: [
                    Container(
                      width: 70,
                      height: 70,
                      decoration: BoxDecoration(
                        shape: BoxShape.circle,
                        border: Border.all(
                          color: Colors.white.withValues(alpha: .18),
                          width: 2,
                        ),
                      ),
                    ),
                    Transform.translate(
                      offset: Offset(
                        math.cos(_travelController.value * math.pi * 2) * 35,
                        math.sin(_travelController.value * math.pi * 2) * 35,
                      ),
                      child: Transform.rotate(
                        angle: _travelController.value * math.pi * 2 + 1.6,
                        child: child,
                      ),
                    ),
                    const Icon(Icons.terrain_rounded,
                        color: AppColors.gold, size: 38),
                  ],
                ),
                child: const Icon(Icons.flight_rounded,
                    color: Colors.white, size: 22),
              ),
            ),
          ],
        ),
      );

  Widget _profilePhotoPicker() => Center(
        child: Column(
          children: [
            Semantics(
              button: true,
              label: _profileImage == null
                  ? 'Add profile photo'
                  : 'Change profile photo',
              child: InkWell(
                onTap: _loading ? null : _pickProfileImage,
                customBorder: const CircleBorder(),
                child: SizedBox(
                  width: 154,
                  height: 154,
                  child: Stack(
                    alignment: Alignment.center,
                    children: [
                      AnimatedBuilder(
                        animation: _travelController,
                        builder: (context, child) => Transform.rotate(
                          angle: _travelController.value * math.pi * 2,
                          child: child,
                        ),
                        child: Container(
                          width: 150,
                          height: 150,
                          decoration: BoxDecoration(
                            shape: BoxShape.circle,
                            border:
                                Border.all(color: AppColors.goldDark, width: 2),
                          ),
                          child: const Align(
                            alignment: Alignment.topCenter,
                            child: Padding(
                              padding: EdgeInsets.only(top: 2),
                              child: Icon(Icons.flight_rounded,
                                  color: AppColors.goldDark, size: 19),
                            ),
                          ),
                        ),
                      ),
                      Container(
                        width: 130,
                        height: 130,
                        decoration: BoxDecoration(
                          shape: BoxShape.circle,
                          color: Colors.white,
                          image: _profileImage == null
                              ? null
                              : DecorationImage(
                                  image: FileImage(_profileImage!),
                                  fit: BoxFit.cover,
                                ),
                          boxShadow: [
                            BoxShadow(
                              color: AppColors.navy.withValues(alpha: .18),
                              blurRadius: 24,
                              offset: const Offset(0, 10),
                            ),
                          ],
                        ),
                        child: _profileImage == null
                            ? const Icon(Icons.person_add_alt_1_rounded,
                                size: 48, color: AppColors.navy)
                            : null,
                      ),
                      Positioned(
                        right: 5,
                        bottom: 12,
                        child: Container(
                          width: 42,
                          height: 42,
                          decoration: BoxDecoration(
                            color: AppColors.gold,
                            shape: BoxShape.circle,
                            border: Border.all(color: Colors.white, width: 3),
                          ),
                          child: const Icon(Icons.add_a_photo_rounded,
                              color: AppColors.navy, size: 21),
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            ),
            const SizedBox(height: 12),
            Text(
              _profileImage == null
                  ? 'Add profile photo  •  Required'
                  : 'Profile photo ready  •  Tap to change',
              style: TextStyle(
                color:
                    _profileImage == null ? AppColors.goldDark : AppColors.navy,
                fontWeight: FontWeight.w800,
              ),
            ),
            const SizedBox(height: 4),
            const Text(
              'Use a clear photo so future companions can recognize you.',
              textAlign: TextAlign.center,
              style: TextStyle(color: AppColors.muted, fontSize: 13),
            ),
          ],
        ),
      );

  Widget _firstNameField() => TextFormField(
        controller: _firstName,
        textCapitalization: TextCapitalization.words,
        textInputAction: TextInputAction.next,
        autofillHints: const [AutofillHints.givenName],
        decoration: const InputDecoration(
          labelText: 'First name',
          prefixIcon: Icon(Icons.person_outline_rounded),
        ),
        validator: (value) => _nameValidator(value, 'first name'),
      );

  Widget _middleNameField() => TextFormField(
        controller: _middleName,
        textCapitalization: TextCapitalization.words,
        textInputAction: TextInputAction.next,
        autofillHints: const [AutofillHints.middleName],
        decoration: const InputDecoration(
          labelText: 'Middle name',
          hintText: 'Optional',
          prefixIcon: Icon(Icons.person_outline_rounded),
        ),
        validator: (value) {
          if ((value ?? '').trim().isEmpty) return null;
          return _nameValidator(value, 'middle name');
        },
      );

  Widget _lastNameField() => TextFormField(
        controller: _lastName,
        textCapitalization: TextCapitalization.words,
        textInputAction: TextInputAction.next,
        autofillHints: const [AutofillHints.familyName],
        decoration: const InputDecoration(
          labelText: 'Last name',
          prefixIcon: Icon(Icons.badge_outlined),
        ),
        validator: (value) => _nameValidator(value, 'last name'),
      );

  Widget _emailField() => TextFormField(
        controller: _email,
        keyboardType: TextInputType.emailAddress,
        textInputAction: TextInputAction.next,
        autofillHints: const [AutofillHints.email],
        decoration: const InputDecoration(
          labelText: 'Email',
          hintText: 'you@example.com',
          prefixIcon: Icon(Icons.alternate_email_rounded),
        ),
        validator: (value) =>
            RegExp(r'^[^\s@]+@[^\s@]+\.[^\s@]+$').hasMatch(value?.trim() ?? '')
                ? null
                : 'Enter a valid email address',
      );

  Widget _phoneField() => TextFormField(
        controller: _phone,
        keyboardType: TextInputType.phone,
        textInputAction: TextInputAction.next,
        autofillHints: const [AutofillHints.telephoneNumber],
        decoration: const InputDecoration(
          labelText: 'Phone number',
          hintText: '98XXXXXXXX',
          prefixIcon: Icon(Icons.phone_outlined),
        ),
        validator: (value) => RegExp(r'^\d{10}$')
                .hasMatch(ApiService.normalizePhoneNumber(value?.trim() ?? ''))
            ? null
            : 'Enter a 10-digit phone number',
      );

  Widget _passwordField() => TextFormField(
        controller: _password,
        obscureText: _passwordHidden,
        textInputAction: TextInputAction.next,
        autofillHints: const [AutofillHints.newPassword],
        decoration: InputDecoration(
          labelText: 'Password',
          prefixIcon: const Icon(Icons.lock_outline_rounded),
          suffixIcon: IconButton(
            onPressed: () => setState(() => _passwordHidden = !_passwordHidden),
            icon: Icon(
              _passwordHidden
                  ? Icons.visibility_outlined
                  : Icons.visibility_off_outlined,
            ),
          ),
        ),
        validator: (value) {
          final password = value ?? '';
          final length = password.length;
          if (length < 12) return 'Use at least 12 characters';
          if (length > 128) return 'Use at most 128 characters';
          if (!RegExp(r'[A-Z]').hasMatch(password) ||
              !RegExp(r'[a-z]').hasMatch(password) ||
              !RegExp(r'\d').hasMatch(password) ||
              !RegExp(r'[@$!%*?&]').hasMatch(password)) {
            return 'Add upper, lower, number & symbol';
          }
          return null;
        },
      );

  Widget _confirmPasswordField() => TextFormField(
        controller: _confirmPassword,
        obscureText: _confirmHidden,
        textInputAction: TextInputAction.next,
        autofillHints: const [AutofillHints.newPassword],
        decoration: InputDecoration(
          labelText: 'Confirm password',
          prefixIcon: const Icon(Icons.lock_reset_rounded),
          suffixIcon: IconButton(
            onPressed: () => setState(() => _confirmHidden = !_confirmHidden),
            icon: Icon(
              _confirmHidden
                  ? Icons.visibility_outlined
                  : Icons.visibility_off_outlined,
            ),
          ),
        ),
        validator: (value) =>
            value == _password.text ? null : 'Passwords do not match',
      );

  Widget _genderField() => DropdownButtonFormField<String>(
        value: _gender,
        decoration: const InputDecoration(
          labelText: 'Gender',
          prefixIcon: Icon(Icons.people_outline_rounded),
        ),
        items: _genderOptions.entries
            .map((entry) =>
                DropdownMenuItem(value: entry.key, child: Text(entry.value)))
            .toList(),
        onChanged: _loading ? null : (value) => setState(() => _gender = value),
        validator: (value) => value == null ? 'Select a gender option' : null,
      );

  Widget _dateField() => TextFormField(
        controller: _dateOfBirth,
        readOnly: true,
        onTap: _loading ? null : _selectDate,
        decoration: const InputDecoration(
          labelText: 'Date of birth',
          hintText: 'DD MMM YYYY',
          prefixIcon: Icon(Icons.cake_outlined),
          suffixIcon: Icon(Icons.calendar_month_rounded),
        ),
        validator: (_) =>
            _selectedDate == null ? 'Select your date of birth' : null,
      );

  String? _nameValidator(String? rawValue, String label) {
    final value = rawValue?.trim() ?? '';
    if (value.length < 2) return 'Enter your $label';
    return RegExp(
      r"^[A-Za-z\u00C0-\u024F\u0900-\u097F' -]+$",
      unicode: true,
    ).hasMatch(value)
        ? null
        : 'Use letters only';
  }

  String _displayDate(DateTime value) {
    const months = [
      'Jan',
      'Feb',
      'Mar',
      'Apr',
      'May',
      'Jun',
      'Jul',
      'Aug',
      'Sep',
      'Oct',
      'Nov',
      'Dec',
    ];
    return '${value.day.toString().padLeft(2, '0')} ${months[value.month - 1]} ${value.year}';
  }

  String _apiDate(DateTime value) =>
      '${value.year.toString().padLeft(4, '0')}-${value.month.toString().padLeft(2, '0')}-${value.day.toString().padLeft(2, '0')}';
}

class _FieldRow extends StatelessWidget {
  const _FieldRow({
    required this.twoColumns,
    required this.first,
    required this.second,
  });

  final bool twoColumns;
  final Widget first;
  final Widget second;

  @override
  Widget build(BuildContext context) => twoColumns
      ? Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Expanded(child: first),
            const SizedBox(width: 16),
            Expanded(child: second),
          ],
        )
      : Column(children: [first, const SizedBox(height: 16), second]);
}

class _NameFields extends StatelessWidget {
  const _NameFields({
    required this.threeColumns,
    required this.first,
    required this.middle,
    required this.last,
  });

  final bool threeColumns;
  final Widget first;
  final Widget middle;
  final Widget last;

  @override
  Widget build(BuildContext context) => threeColumns
      ? Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Expanded(child: first),
            const SizedBox(width: 14),
            Expanded(child: middle),
            const SizedBox(width: 14),
            Expanded(child: last),
          ],
        )
      : Column(
          children: [
            first,
            const SizedBox(height: 16),
            middle,
            const SizedBox(height: 16),
            last,
          ],
        );
}
