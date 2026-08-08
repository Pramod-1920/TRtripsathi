import 'dart:convert';
import 'dart:io';

import 'package:flutter/material.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:trtripsathi_mobile/core/navigation/route_names.dart';
import 'package:trtripsathi_mobile/core/networking/api_service.dart';
import 'package:trtripsathi_mobile/core/theme/app_theme.dart';
import 'package:trtripsathi_mobile/core/widgets/animated_action_button.dart';
import 'package:trtripsathi_mobile/core/widgets/brand_mark.dart';
import 'package:trtripsathi_mobile/core/widgets/form_error_banner.dart';
import 'package:trtripsathi_mobile/core/widgets/travel_background.dart';

class ProfileSetupScreen extends StatefulWidget {
  const ProfileSetupScreen({super.key});

  @override
  State<ProfileSetupScreen> createState() => _ProfileSetupScreenState();
}

class _ProfileSetupScreenState extends State<ProfileSetupScreen>
    with SingleTickerProviderStateMixin {
  final _bio = TextEditingController();
  late final AnimationController _entranceController;
  late final Animation<double> _entrance;

  String? _experience;
  String? _travelStyle;
  final Set<String> _interests = {};
  final Set<String> _languages = {'Nepali'};
  bool _isPublic = true;
  bool _loading = false;
  String? _error;

  static const _experiences = [
    _Choice(
      value: 'new_explorer',
      title: 'New Explorer',
      subtitle: 'I am starting my travel journey',
      icon: Icons.explore_outlined,
    ),
    _Choice(
      value: 'trail_regular',
      title: 'Trail Regular',
      subtitle: 'I travel several times a year',
      icon: Icons.hiking_rounded,
    ),
    _Choice(
      value: 'expedition_ready',
      title: 'Expedition Ready',
      subtitle: 'I am comfortable on demanding trips',
      icon: Icons.landscape_rounded,
    ),
  ];

  static const _styles = [
    _Choice(
      value: 'solo',
      title: 'Solo',
      subtitle: 'Independent travel',
      icon: Icons.person_pin_circle_outlined,
    ),
    _Choice(
      value: 'small_group',
      title: 'Small Group',
      subtitle: 'A close travel circle',
      icon: Icons.groups_2_outlined,
    ),
    _Choice(
      value: 'open_to_all',
      title: 'Open to All',
      subtitle: 'Flexible and social',
      icon: Icons.public_rounded,
    ),
  ];

  static const _interestOptions = {
    'trekking': ('Trekking', Icons.hiking_rounded),
    'camping': ('Camping', Icons.cabin_outlined),
    'culture': ('Culture', Icons.account_balance_outlined),
    'photography': ('Photography', Icons.photo_camera_outlined),
    'cycling': ('Cycling', Icons.pedal_bike_rounded),
    'food': ('Local Food', Icons.restaurant_outlined),
    'wildlife': ('Wildlife', Icons.pets_outlined),
    'wellness': ('Wellness', Icons.spa_outlined),
  };

  static const _languageOptions = [
    'Nepali',
    'English',
    'Hindi',
    'Newari',
    'Maithili',
    'Tibetan',
  ];

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
  }

  Future<void> _submit() async {
    FocusManager.instance.primaryFocus?.unfocus();
    final bio = _bio.text.trim();
    final validationError = switch ((
      _experience,
      _travelStyle,
      _interests.length,
      _languages.length,
      bio.length,
    )) {
      (null, _, _, _, _) => 'Choose your travel experience.',
      (_, null, _, _, _) => 'Choose how you prefer to travel.',
      (_, _, < 2, _, _) => 'Choose at least two travel interests.',
      (_, _, _, 0, _) => 'Choose at least one language.',
      (_, _, _, _, < 20) =>
        'Write at least 20 characters so travelers can know you.',
      _ => null,
    };

    if (validationError != null) {
      setState(() => _error = validationError);
      return;
    }

    setState(() {
      _loading = true;
      _error = null;
    });

    try {
      final preferences = await SharedPreferences.getInstance();
      final pendingIdentityJson =
          preferences.getString('pending_identity_profile');
      final pendingIdentity = pendingIdentityJson == null
          ? <String, dynamic>{}
          : Map<String, dynamic>.from(
              jsonDecode(pendingIdentityJson) as Map,
            );
      final travelerFields = <String, dynamic>{
        'travelerExperience': _experience,
        'travelStyle': _travelStyle,
        'travelInterests': _interests.toList()..sort(),
      };
      final supportedProfileFields = <String, dynamic>{
        ...pendingIdentity,
        'languagesKnown': _languages.toList()..sort(),
        'bio': bio,
        'isProfilePublic': _isPublic,
      };

      try {
        await ApiService.updateProfile({
          ...supportedProfileFields,
          ...travelerFields,
        });
        await preferences.remove('pending_traveler_profile');
      } catch (error) {
        if (!error.toString().contains('should not exist')) rethrow;
        // Old deployed APIs do not know the traveler-specific fields yet.
        // Save supported data now and retain the rest for server migration.
        await ApiService.updateProfile(supportedProfileFields);
        await preferences.setString(
          'pending_traveler_profile',
          jsonEncode(travelerFields),
        );
      }
      await preferences.remove('pending_identity_profile');

      final pendingImagePath =
          preferences.getString('pending_profile_image_path');
      if (pendingImagePath != null && pendingImagePath.isNotEmpty) {
        final pendingImage = File(pendingImagePath);
        if (!await pendingImage.exists()) {
          throw Exception(
            'Your selected profile photo is no longer available. Please try account setup again.',
          );
        }
        await ApiService.uploadProfileImage(pendingImage);
        await preferences.remove('pending_profile_image_path');
      }
      await preferences.setBool('onboarding_done', true);

      if (!mounted) return;
      Navigator.of(context).pushNamedAndRemoveUntil(
        RouteNames.dashboard,
        (_) => false,
      );
    } catch (error) {
      if (mounted) setState(() => _error = ApiService.readableError(error));
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  void dispose() {
    _bio.dispose();
    _entranceController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => Scaffold(
        body: TravelBackground(
          child: SafeArea(
            child: FadeTransition(
              opacity: _entrance,
              child: Column(
                children: [
                  _header(),
                  Expanded(
                    child: SingleChildScrollView(
                      padding: const EdgeInsets.fromLTRB(20, 20, 20, 34),
                      child: Center(
                        child: ConstrainedBox(
                          constraints: const BoxConstraints(maxWidth: 760),
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.stretch,
                            children: [
                              _passportHero(context),
                              const SizedBox(height: 30),
                              _sectionTitle(
                                'Your travel experience',
                                'This is separate from the TripSathi rank you earn.',
                              ),
                              const SizedBox(height: 12),
                              ..._experiences.map(
                                (choice) => Padding(
                                  padding: const EdgeInsets.only(bottom: 10),
                                  child: _ChoiceCard(
                                    choice: choice,
                                    selected: _experience == choice.value,
                                    onTap: _loading
                                        ? null
                                        : () => setState(
                                              () => _experience = choice.value,
                                            ),
                                  ),
                                ),
                              ),
                              const SizedBox(height: 22),
                              _sectionTitle(
                                'How do you like to travel?',
                                'We use this to suggest compatible companions.',
                              ),
                              const SizedBox(height: 12),
                              LayoutBuilder(
                                builder: (context, constraints) {
                                  final wide = constraints.maxWidth >= 620;
                                  return wide
                                      ? Row(
                                          children: _styles
                                              .map(
                                                (choice) => Expanded(
                                                  child: Padding(
                                                    padding:
                                                        const EdgeInsets.only(
                                                            right: 10),
                                                    child: _ChoiceCard(
                                                      choice: choice,
                                                      compact: true,
                                                      selected: _travelStyle ==
                                                          choice.value,
                                                      onTap: _loading
                                                          ? null
                                                          : () => setState(
                                                                () =>
                                                                    _travelStyle =
                                                                        choice
                                                                            .value,
                                                              ),
                                                    ),
                                                  ),
                                                ),
                                              )
                                              .toList(),
                                        )
                                      : Column(
                                          children: _styles
                                              .map(
                                                (choice) => Padding(
                                                  padding:
                                                      const EdgeInsets.only(
                                                          bottom: 10),
                                                  child: _ChoiceCard(
                                                    choice: choice,
                                                    selected: _travelStyle ==
                                                        choice.value,
                                                    onTap: _loading
                                                        ? null
                                                        : () => setState(
                                                              () =>
                                                                  _travelStyle =
                                                                      choice
                                                                          .value,
                                                            ),
                                                  ),
                                                ),
                                              )
                                              .toList(),
                                        );
                                },
                              ),
                              const SizedBox(height: 22),
                              _sectionTitle(
                                'Choose your adventures',
                                'Pick at least two. You can change these later.',
                              ),
                              const SizedBox(height: 12),
                              Wrap(
                                spacing: 9,
                                runSpacing: 9,
                                children: _interestOptions.entries.map((entry) {
                                  final selected =
                                      _interests.contains(entry.key);
                                  return FilterChip(
                                    selected: selected,
                                    avatar: Icon(
                                      entry.value.$2,
                                      size: 18,
                                      color: selected
                                          ? Colors.white
                                          : AppColors.navy,
                                    ),
                                    label: Text(entry.value.$1),
                                    onSelected: _loading
                                        ? null
                                        : (_) => setState(() {
                                              selected
                                                  ? _interests.remove(entry.key)
                                                  : _interests.add(entry.key);
                                            }),
                                  );
                                }).toList(),
                              ),
                              const SizedBox(height: 26),
                              _sectionTitle(
                                'Languages you speak',
                                'Help companions communicate comfortably.',
                              ),
                              const SizedBox(height: 12),
                              Wrap(
                                spacing: 9,
                                runSpacing: 9,
                                children: _languageOptions.map((language) {
                                  final selected = _languages.contains(language);
                                  return FilterChip(
                                    selected: selected,
                                    label: Text(language),
                                    onSelected: _loading
                                        ? null
                                        : (_) => setState(() {
                                              selected
                                                  ? _languages.remove(language)
                                                  : _languages.add(language);
                                            }),
                                  );
                                }).toList(),
                              ),
                              const SizedBox(height: 26),
                              _sectionTitle(
                                'Your traveler story',
                                'Share what makes you a thoughtful companion.',
                              ),
                              const SizedBox(height: 12),
                              TextField(
                                controller: _bio,
                                enabled: !_loading,
                                minLines: 4,
                                maxLines: 6,
                                maxLength: 500,
                                textCapitalization: TextCapitalization.sentences,
                                decoration: const InputDecoration(
                                  hintText:
                                      'I love slow mountain mornings, local food, and leaving every trail cleaner than I found it...',
                                  alignLabelWithHint: true,
                                  prefixIcon: Padding(
                                    padding: EdgeInsets.only(bottom: 82),
                                    child: Icon(Icons.edit_note_rounded),
                                  ),
                                ),
                              ),
                              const SizedBox(height: 8),
                              SwitchListTile.adaptive(
                                value: _isPublic,
                                onChanged: _loading
                                    ? null
                                    : (value) =>
                                        setState(() => _isPublic = value),
                                contentPadding: const EdgeInsets.symmetric(
                                  horizontal: 4,
                                ),
                                secondary: const Icon(Icons.shield_outlined),
                                title: const Text(
                                  'Discoverable traveler profile',
                                  style: TextStyle(fontWeight: FontWeight.w800),
                                ),
                                subtitle: const Text(
                                  'Allow other travelers to find your public profile.',
                                ),
                              ),
                              if (_error case final error?) ...[
                                const SizedBox(height: 14),
                                FormErrorBanner(message: error),
                              ],
                              const SizedBox(height: 24),
                              AnimatedActionButton(
                                label: 'Create Traveler Profile',
                                icon: Icons.flight_takeoff_rounded,
                                loading: _loading,
                                onPressed: _submit,
                              ),
                            ],
                          ),
                        ),
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ),
        ),
      );

  Widget _header() => Container(
        padding: const EdgeInsets.fromLTRB(20, 10, 20, 14),
        decoration: BoxDecoration(
          color: Colors.white.withValues(alpha: .9),
          border: const Border(bottom: BorderSide(color: AppColors.line)),
        ),
        child: const Column(
          children: [
            Row(
              children: [
                BrandMark(size: 38, showName: true),
                Spacer(),
                Text(
                  'FINAL STEP',
                  style: TextStyle(
                    color: AppColors.goldDark,
                    fontWeight: FontWeight.w900,
                    letterSpacing: 1.2,
                    fontSize: 12,
                  ),
                ),
              ],
            ),
            SizedBox(height: 12),
            ClipRRect(
              borderRadius: BorderRadius.all(Radius.circular(99)),
              child: LinearProgressIndicator(
                value: 1,
                minHeight: 6,
                color: AppColors.goldDark,
                backgroundColor: AppColors.line,
              ),
            ),
          ],
        ),
      );

  Widget _passportHero(BuildContext context) => Container(
        padding: const EdgeInsets.all(24),
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
              blurRadius: 28,
              offset: const Offset(0, 14),
            ),
          ],
        ),
        child: Row(
          children: [
            Container(
              width: 76,
              height: 76,
              decoration: BoxDecoration(
                color: AppColors.gold,
                borderRadius: BorderRadius.circular(24),
              ),
              child: const Icon(
                Icons.airplane_ticket_rounded,
                color: AppColors.navy,
                size: 38,
              ),
            ),
            const SizedBox(width: 18),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    'Build your\nTraveler Passport',
                    style: Theme.of(context).textTheme.headlineSmall?.copyWith(
                          color: Colors.white,
                          height: 1.08,
                          fontWeight: FontWeight.w900,
                        ),
                  ),
                  const SizedBox(height: 8),
                  Text(
                    'A profile designed for better trips and trusted companions.',
                    style: TextStyle(
                      color: Colors.white.withValues(alpha: .78),
                      height: 1.35,
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
      );

  Widget _sectionTitle(String title, String subtitle) => Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            title,
            style: const TextStyle(
              color: AppColors.navy,
              fontSize: 19,
              fontWeight: FontWeight.w900,
            ),
          ),
          const SizedBox(height: 4),
          Text(subtitle, style: const TextStyle(color: AppColors.muted)),
        ],
      );
}

class _ChoiceCard extends StatelessWidget {
  const _ChoiceCard({
    required this.choice,
    required this.selected,
    required this.onTap,
    this.compact = false,
  });

  final _Choice choice;
  final bool selected;
  final VoidCallback? onTap;
  final bool compact;

  @override
  Widget build(BuildContext context) => Material(
        color: selected ? AppColors.navy : Colors.white,
        borderRadius: BorderRadius.circular(20),
        child: InkWell(
          onTap: onTap,
          borderRadius: BorderRadius.circular(20),
          child: AnimatedContainer(
            duration: const Duration(milliseconds: 220),
            padding: EdgeInsets.all(compact ? 16 : 18),
            decoration: BoxDecoration(
              borderRadius: BorderRadius.circular(20),
              border: Border.all(
                color: selected ? AppColors.navy : AppColors.line,
                width: selected ? 2 : 1,
              ),
            ),
            child: Row(
              children: [
                Container(
                  width: 44,
                  height: 44,
                  decoration: BoxDecoration(
                    color: selected
                        ? AppColors.gold
                        : AppColors.navy.withValues(alpha: .08),
                    borderRadius: BorderRadius.circular(14),
                  ),
                  child: Icon(choice.icon, color: AppColors.navy),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        choice.title,
                        style: TextStyle(
                          color: selected ? Colors.white : AppColors.navy,
                          fontWeight: FontWeight.w900,
                        ),
                      ),
                      const SizedBox(height: 3),
                      Text(
                        choice.subtitle,
                        style: TextStyle(
                          color: selected
                              ? Colors.white.withValues(alpha: .72)
                              : AppColors.muted,
                          fontSize: 12,
                        ),
                      ),
                    ],
                  ),
                ),
                Icon(
                  selected
                      ? Icons.check_circle_rounded
                      : Icons.circle_outlined,
                  color: selected ? AppColors.gold : AppColors.line,
                ),
              ],
            ),
          ),
        ),
      );
}

class _Choice {
  const _Choice({
    required this.value,
    required this.title,
    required this.subtitle,
    required this.icon,
  });

  final String value;
  final String title;
  final String subtitle;
  final IconData icon;
}
