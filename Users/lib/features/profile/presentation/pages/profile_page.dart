import 'dart:io';

import 'package:flutter/material.dart';
import 'package:image_picker/image_picker.dart';
import 'package:provider/provider.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'package:trtripsathi_mobile/core/navigation/route_names.dart';
import 'package:trtripsathi_mobile/core/networking/api_service.dart';
import 'package:trtripsathi_mobile/core/notifications/push_notification_service.dart';
import 'package:trtripsathi_mobile/features/auth/presentation/providers/auth_provider.dart';
import 'package:trtripsathi_mobile/features/profile/presentation/pages/my_journeys_page.dart';

const _profileForest = Color(0xFF173F38);
const _profileForestLight = Color(0xFF28685A);
const _profileAmber = Color(0xFFF2B84B);
const _profileCanvas = Color(0xFFF5F4EF);
const _profileInk = Color(0xFF17201D);
const _profileMuted = Color(0xFF68746F);
const _profileLine = Color(0xFFE4E5DF);

class ProfileScreen extends StatefulWidget {
  const ProfileScreen({super.key, this.initialProfile});

  final Map<String, dynamic>? initialProfile;

  @override
  State<ProfileScreen> createState() => _ProfileScreenState();
}

class _ProfileScreenState extends State<ProfileScreen> {
  Map<String, dynamic> _data = {};
  bool _loading = true;
  bool _savingPrivacy = false;
  bool _notificationsEnabled = true;
  String? _error;

  @override
  void initState() {
    super.initState();
    final initial = widget.initialProfile ?? ApiService.cachedProfile;
    if (initial != null && initial.isNotEmpty) {
      _data = Map<String, dynamic>.from(initial);
      _loading = false;
      _load(showLoader: false, forceRefresh: true);
    } else {
      _load(forceRefresh: true);
    }
    _loadPreferences();
  }

  Future<void> _loadPreferences() async {
    final preferences = await SharedPreferences.getInstance();
    if (!mounted) return;
    setState(() {
      _notificationsEnabled =
          preferences.getBool('profile_notifications_enabled') ?? true;
    });
  }

  Future<void> _load({
    bool showLoader = true,
    bool forceRefresh = true,
  }) async {
    if (showLoader) {
      setState(() {
        _loading = true;
        _error = null;
      });
    }

    try {
      final profile = await ApiService.getProfile(forceRefresh: forceRefresh);
      if (!mounted) return;
      setState(() {
        _data = profile;
        _loading = false;
        _error = null;
      });
    } catch (error) {
      if (!mounted) return;
      setState(() {
        _loading = false;
        _error = ApiService.readableError(error);
      });
    }
  }

  Future<void> _setProfileVisibility(bool value) async {
    if (_savingPrivacy) return;
    final previous = _isPublic;
    setState(() {
      _savingPrivacy = true;
      _data = {..._data, 'isProfilePublic': value};
    });

    try {
      final updated =
          await ApiService.updateProfile({'isProfilePublic': value});
      if (!mounted) return;
      setState(() => _data = {..._data, ...updated});
      _showMessage(
          value ? 'Your profile is now public' : 'Your profile is now private');
    } catch (error) {
      if (!mounted) return;
      setState(() => _data = {..._data, 'isProfilePublic': previous});
      _showMessage(ApiService.readableError(error), error: true);
    } finally {
      if (mounted) setState(() => _savingPrivacy = false);
    }
  }

  Future<void> _setNotifications(bool value) async {
    setState(() => _notificationsEnabled = value);
    final preferences = await SharedPreferences.getInstance();
    await preferences.setBool('profile_notifications_enabled', value);
    if (value) {
      await PushNotificationService.instance.registerForCurrentUser();
    } else {
      await PushNotificationService.instance.unregisterCurrentDevice();
    }
    if (mounted) {
      _showMessage(value ? 'Notifications enabled' : 'Notifications paused');
    }
  }

  Future<void> _openEditProfile() async {
    final changed = await Navigator.of(context).push<bool>(
      MaterialPageRoute<bool>(
        builder: (_) => _EditProfilePage(profile: _data),
      ),
    );
    if (changed == true) await _load(showLoader: false);
  }

  Future<void> _signOut() async {
    final navigator = Navigator.of(context);
    await context.read<AuthProvider>().signOut();
    if (!mounted) return;
    navigator.pushNamedAndRemoveUntil(RouteNames.login, (_) => false);
  }

  Future<void> _confirmDeleteAccount() async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Delete your account?'),
        content: const Text(
          'Your profile and account data will be permanently removed. This cannot be undone.',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context, false),
            child: const Text('Cancel'),
          ),
          FilledButton(
            style: FilledButton.styleFrom(
              backgroundColor: const Color(0xFFB42318),
            ),
            onPressed: () => Navigator.pop(context, true),
            child: const Text('Delete account'),
          ),
        ],
      ),
    );

    if (confirmed != true || !mounted) return;
    final navigator = Navigator.of(context);
    try {
      await ApiService.deleteProfile();
      if (!mounted) return;
      navigator.pushNamedAndRemoveUntil(RouteNames.login, (_) => false);
    } catch (error) {
      if (mounted) _showMessage(ApiService.readableError(error), error: true);
    }
  }

  void _openDocument(_ProfileDocument document) {
    Navigator.of(context).push(
      MaterialPageRoute<void>(
        builder: (_) => _PolicyPage(document: document),
      ),
    );
  }

  void _showMessage(String message, {bool error = false}) {
    ScaffoldMessenger.of(context)
      ..hideCurrentSnackBar()
      ..showSnackBar(
        SnackBar(
          backgroundColor: error ? const Color(0xFFB42318) : _profileForest,
          content: Text(message),
        ),
      );
  }

  String get _fullName {
    final names = [
      _data['firstName'],
      _data['middleName'],
      _data['lastName'],
    ]
        .map((value) => (value ?? '').toString().trim())
        .where((value) => value.isNotEmpty);
    final name = names.join(' ');
    return name.isEmpty ? 'Your profile' : name;
  }

  String get _initials {
    final parts = _fullName
        .split(RegExp(r'\s+'))
        .where((part) => part.isNotEmpty)
        .toList();
    if (parts.isEmpty || _fullName == 'Your profile') return 'YS';
    return parts.take(2).map((part) => part[0].toUpperCase()).join();
  }

  bool get _isPublic => _data['isProfilePublic'] != false;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: _profileCanvas,
      appBar: AppBar(
        backgroundColor: _profileCanvas,
        title: const Text('Profile'),
        actions: [
          IconButton(
            tooltip: 'Refresh profile',
            onPressed: _loading ? null : () => _load(),
            icon: const Icon(Icons.refresh_rounded),
          ),
          const SizedBox(width: 6),
        ],
      ),
      body: _loading
          ? const _ProfileSkeleton()
          : RefreshIndicator(
              color: _profileForest,
              onRefresh: () => _load(showLoader: false),
              child: ListView(
                physics: const AlwaysScrollableScrollPhysics(),
                padding: const EdgeInsets.fromLTRB(16, 8, 16, 32),
                children: [
                  if (_error != null) ...[
                    _ErrorBanner(message: _error!, onRetry: _load),
                    const SizedBox(height: 12),
                  ],
                  _ProfileHeader(
                    profile: _data,
                    fullName: _fullName,
                    initials: _initials,
                    uploadingPhoto: false,
                    onPhotoTap: _openEditProfile,
                    onEdit: _openEditProfile,
                  ),
                  const SizedBox(height: 22),
                  _SectionLabel(title: 'Your profile'),
                  _SettingsCard(
                    children: [
                      _SettingsTile(
                        icon: Icons.edit_outlined,
                        title: 'Personal details',
                        subtitle:
                            'Identity, location, languages and travel preferences',
                        onTap: _openEditProfile,
                      ),
                      _SettingsTile(
                        icon: Icons.photo_camera_outlined,
                        title: 'Profile photo',
                        subtitle: 'Choose a clear photo of yourself',
                        onTap: _openEditProfile,
                      ),
                      _SettingsTile(
                        icon: Icons.route_rounded,
                        title: 'My journeys',
                        subtitle: 'Completed, expired and cancelled trips',
                        onTap: () => Navigator.of(context).push(
                          MaterialPageRoute<void>(
                            builder: (_) => const MyJourneysPage(),
                          ),
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 20),
                  _SectionLabel(title: 'Preferences & privacy'),
                  _SettingsCard(
                    children: [
                      _SettingsTile(
                        icon: _isPublic
                            ? Icons.public_rounded
                            : Icons.lock_outline_rounded,
                        title: 'Public profile',
                        subtitle: _isPublic
                            ? 'Travelers can discover your profile'
                            : 'Only you can view your full profile',
                        trailing: _savingPrivacy
                            ? const SizedBox.square(
                                dimension: 22,
                                child:
                                    CircularProgressIndicator(strokeWidth: 2),
                              )
                            : Switch.adaptive(
                                value: _isPublic,
                                activeTrackColor: _profileForestLight,
                                onChanged: _setProfileVisibility,
                              ),
                      ),
                      _SettingsTile(
                        icon: Icons.notifications_none_rounded,
                        title: 'Notifications',
                        subtitle: 'Trip, campaign and safety updates',
                        trailing: Switch.adaptive(
                          value: _notificationsEnabled,
                          activeTrackColor: _profileForestLight,
                          onChanged: _setNotifications,
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 20),
                  _SectionLabel(title: 'Safety & support'),
                  _SettingsCard(
                    children: [
                      _SettingsTile(
                        icon: Icons.flag_outlined,
                        title: 'Report an issue',
                        subtitle: 'Tell us what went wrong and track updates',
                        onTap: () => Navigator.of(context)
                            .pushNamed(RouteNames.reportIssue),
                      ),
                      _SettingsTile(
                        icon: Icons.privacy_tip_outlined,
                        title: 'Privacy policy',
                        subtitle: 'How your information is handled',
                        onTap: () => _openDocument(_privacyPolicy),
                      ),
                      _SettingsTile(
                        icon: Icons.description_outlined,
                        title: 'User agreement',
                        subtitle: 'Rules for using TripSathi',
                        onTap: () => _openDocument(_userAgreement),
                      ),
                      _SettingsTile(
                        icon: Icons.health_and_safety_outlined,
                        title: 'Community & safety',
                        subtitle: 'Travel responsibly and report concerns',
                        onTap: () => _openDocument(_communitySafety),
                      ),
                    ],
                  ),
                  const SizedBox(height: 20),
                  _SectionLabel(title: 'Account'),
                  _SettingsCard(
                    children: [
                      _SettingsTile(
                        icon: Icons.logout_rounded,
                        title: 'Log out',
                        onTap: _signOut,
                      ),
                      _SettingsTile(
                        icon: Icons.delete_outline_rounded,
                        iconColor: const Color(0xFFB42318),
                        title: 'Delete account',
                        titleColor: const Color(0xFFB42318),
                        subtitle: 'Permanently remove your account',
                        onTap: _confirmDeleteAccount,
                      ),
                    ],
                  ),
                  const SizedBox(height: 22),
                  const Center(
                    child: Text(
                      'Yatri by TripSathi  •  v0.1.0',
                      style: TextStyle(
                        color: _profileMuted,
                        fontSize: 12,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                  ),
                ],
              ),
            ),
    );
  }
}

class _ProfileSkeleton extends StatefulWidget {
  const _ProfileSkeleton();

  @override
  State<_ProfileSkeleton> createState() => _ProfileSkeletonState();
}

class _ProfileSkeletonState extends State<_ProfileSkeleton>
    with SingleTickerProviderStateMixin {
  late final AnimationController _controller;

  @override
  void initState() {
    super.initState();
    _controller = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 1350),
    )..repeat(reverse: true);
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => Semantics(
        label: 'Loading traveler profile',
        liveRegion: true,
        child: IgnorePointer(
          child: FadeTransition(
            opacity: Tween<double>(begin: .54, end: 1).animate(
              CurvedAnimation(parent: _controller, curve: Curves.easeInOut),
            ),
            child: ListView(
              physics: const NeverScrollableScrollPhysics(),
              padding: const EdgeInsets.fromLTRB(16, 8, 16, 32),
              children: const [
                _SkeletonProfileHeader(),
                SizedBox(height: 24),
                _SkeletonLine(width: 94, height: 11),
                SizedBox(height: 10),
                _SkeletonSettingsCard(rows: 2),
                SizedBox(height: 22),
                _SkeletonLine(width: 142, height: 11),
                SizedBox(height: 10),
                _SkeletonSettingsCard(rows: 3),
              ],
            ),
          ),
        ),
      );
}

class _SkeletonProfileHeader extends StatelessWidget {
  const _SkeletonProfileHeader();

  @override
  Widget build(BuildContext context) => Container(
        padding: const EdgeInsets.all(20),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(28),
          border: Border.all(color: _profileLine),
        ),
        child: Column(
          children: [
            const Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                _SkeletonCircle(size: 82),
                SizedBox(width: 16),
                Expanded(
                  child: Padding(
                    padding: EdgeInsets.only(top: 8),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        _SkeletonLine(width: 155, height: 18),
                        SizedBox(height: 10),
                        _SkeletonLine(width: 104, height: 11),
                        SizedBox(height: 13),
                        _SkeletonLine(width: 72, height: 23),
                      ],
                    ),
                  ),
                ),
                _SkeletonCircle(size: 38),
              ],
            ),
            const SizedBox(height: 20),
            Container(
              height: 1,
              color: const Color(0xFFE2E4DE),
            ),
            const SizedBox(height: 16),
            const Row(
              children: [
                Expanded(child: _SkeletonMetric()),
                SizedBox(width: 10),
                Expanded(child: _SkeletonMetric()),
                SizedBox(width: 10),
                Expanded(child: _SkeletonMetric()),
              ],
            ),
          ],
        ),
      );
}

class _SkeletonMetric extends StatelessWidget {
  const _SkeletonMetric();

  @override
  Widget build(BuildContext context) => Column(
        children: const [
          _SkeletonLine(width: 38, height: 15),
          SizedBox(height: 7),
          _SkeletonLine(width: 55, height: 9),
        ],
      );
}

class _SkeletonSettingsCard extends StatelessWidget {
  const _SkeletonSettingsCard({required this.rows});
  final int rows;

  @override
  Widget build(BuildContext context) => Container(
        padding: const EdgeInsets.symmetric(horizontal: 16),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(22),
          border: Border.all(color: _profileLine),
        ),
        child: Column(
          children: List.generate(
            rows,
            (index) => Padding(
              padding: const EdgeInsets.symmetric(vertical: 17),
              child: Row(
                children: [
                  const _SkeletonCircle(size: 42),
                  const SizedBox(width: 13),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        _SkeletonLine(
                          width: index.isEven ? 132 : 108,
                          height: 13,
                        ),
                        const SizedBox(height: 8),
                        const FractionallySizedBox(
                          widthFactor: .72,
                          alignment: Alignment.centerLeft,
                          child: _SkeletonLine(height: 9),
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(width: 12),
                  const _SkeletonLine(width: 18, height: 18, radius: 6),
                ],
              ),
            ),
          ),
        ),
      );
}

class _SkeletonCircle extends StatelessWidget {
  const _SkeletonCircle({required this.size});
  final double size;

  @override
  Widget build(BuildContext context) => Container(
        width: size,
        height: size,
        decoration: const BoxDecoration(
          color: Color(0xFFE2E4DE),
          shape: BoxShape.circle,
        ),
      );
}

class _SkeletonLine extends StatelessWidget {
  const _SkeletonLine({this.width, required this.height, this.radius = 99});
  final double? width;
  final double height;
  final double radius;

  @override
  Widget build(BuildContext context) => Container(
        width: width,
        height: height,
        decoration: BoxDecoration(
          color: const Color(0xFFE2E4DE),
          borderRadius: BorderRadius.circular(radius),
        ),
      );
}

class _ProfileHeader extends StatelessWidget {
  const _ProfileHeader({
    required this.profile,
    required this.fullName,
    required this.initials,
    required this.uploadingPhoto,
    required this.onPhotoTap,
    required this.onEdit,
  });

  final Map<String, dynamic> profile;
  final String fullName;
  final String initials;
  final bool uploadingPhoto;
  final VoidCallback? onPhotoTap;
  final VoidCallback onEdit;

  @override
  Widget build(BuildContext context) {
    final photoUrl = (profile['profilePhoto'] ?? '').toString().trim();
    final rankCode = (profile['experienceLevel'] ?? 'F').toString();
    final level = _asInt(profile['level'], fallback: 1);
    final totalXp = _asInt(profile['totalXp']);
    final badgeCount = _asInt(profile['badgeCount']);
    final rankProgress = _profileRankProgress(profile);
    final rankColor = _profileRankGaugeColor(rankCode);

    return Container(
      clipBehavior: Clip.antiAlias,
      decoration: BoxDecoration(
        gradient: const LinearGradient(
          colors: [_profileForest, _profileForestLight],
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ),
        borderRadius: BorderRadius.circular(28),
        boxShadow: [
          BoxShadow(
            color: _profileForest.withValues(alpha: .18),
            blurRadius: 28,
            offset: const Offset(0, 12),
          ),
        ],
      ),
      child: Stack(
        children: [
          const Positioned(
            right: -34,
            top: -45,
            child: _HeaderRing(size: 142),
          ),
          Padding(
            padding: const EdgeInsets.fromLTRB(20, 22, 20, 18),
            child: Column(
              children: [
                Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Semantics(
                      button: true,
                      label: 'Change profile photo',
                      child: GestureDetector(
                        onTap: onPhotoTap,
                        child: Stack(
                          clipBehavior: Clip.none,
                          children: [
                            SizedBox.square(
                              dimension: 90,
                              child: Stack(
                                fit: StackFit.expand,
                                children: [
                                  CircularProgressIndicator(
                                    value: rankProgress,
                                    strokeWidth: 5,
                                    strokeCap: StrokeCap.round,
                                    backgroundColor:
                                        Colors.white.withValues(alpha: .22),
                                    color: rankColor,
                                  ),
                                  Padding(
                                    padding: const EdgeInsets.all(7),
                                    child: CircleAvatar(
                                      backgroundColor: const Color(0xFFE5EFEA),
                                      backgroundImage: photoUrl.isEmpty
                                          ? null
                                          : NetworkImage(photoUrl),
                                      child: photoUrl.isEmpty
                                          ? Text(
                                              initials,
                                              style: const TextStyle(
                                                color: _profileForest,
                                                fontSize: 24,
                                                fontWeight: FontWeight.w900,
                                              ),
                                            )
                                          : null,
                                    ),
                                  ),
                                ],
                              ),
                            ),
                            Positioned(
                              right: -2,
                              bottom: 0,
                              child: Container(
                                width: 30,
                                height: 30,
                                decoration: BoxDecoration(
                                  color: _profileAmber,
                                  shape: BoxShape.circle,
                                  border: Border.all(
                                      color: _profileForest, width: 2),
                                ),
                                child: uploadingPhoto
                                    ? const Padding(
                                        padding: EdgeInsets.all(7),
                                        child: CircularProgressIndicator(
                                          color: _profileForest,
                                          strokeWidth: 2,
                                        ),
                                      )
                                    : const Icon(
                                        Icons.camera_alt_rounded,
                                        color: _profileForest,
                                        size: 16,
                                      ),
                              ),
                            ),
                          ],
                        ),
                      ),
                    ),
                    const SizedBox(width: 16),
                    Expanded(
                      child: Padding(
                        padding: const EdgeInsets.only(top: 4),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              fullName,
                              maxLines: 2,
                              overflow: TextOverflow.ellipsis,
                              style: const TextStyle(
                                color: Colors.white,
                                fontSize: 21,
                                height: 1.12,
                                fontWeight: FontWeight.w900,
                                letterSpacing: -.35,
                              ),
                            ),
                            const SizedBox(height: 8),
                            Container(
                              padding: const EdgeInsets.symmetric(
                                  horizontal: 10, vertical: 6),
                              decoration: BoxDecoration(
                                color: Colors.white.withValues(alpha: .12),
                                borderRadius: BorderRadius.circular(99),
                                border: Border.all(
                                    color: Colors.white.withValues(alpha: .15)),
                              ),
                              child: Text(
                                '${_rankName(rankCode)}  •  Rank $rankCode  •  Level $level',
                                style: const TextStyle(
                                  color: Color(0xFFFFE3A5),
                                  fontSize: 11,
                                  fontWeight: FontWeight.w800,
                                ),
                              ),
                            ),
                          ],
                        ),
                      ),
                    ),
                    IconButton(
                      tooltip: 'Edit profile',
                      onPressed: onEdit,
                      style: IconButton.styleFrom(
                        backgroundColor: Colors.white.withValues(alpha: .12),
                        foregroundColor: Colors.white,
                      ),
                      icon: const Icon(Icons.edit_outlined, size: 19),
                    ),
                  ],
                ),
                const SizedBox(height: 20),
                Container(
                  padding: const EdgeInsets.symmetric(vertical: 13),
                  decoration: BoxDecoration(
                    color: const Color(0xFF0E302A).withValues(alpha: .7),
                    borderRadius: BorderRadius.circular(18),
                  ),
                  child: Row(
                    children: [
                      _ProfileStat(value: '$totalXp', label: 'Total XP'),
                      const _StatDivider(),
                      _ProfileStat(value: '$badgeCount', label: 'Badges'),
                      const _StatDivider(),
                      _ProfileStat(
                        value: profile['isProfilePublic'] == false
                            ? 'Private'
                            : 'Public',
                        label: 'Visibility',
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _EditProfilePage extends StatefulWidget {
  const _EditProfilePage({required this.profile});

  final Map<String, dynamic> profile;

  @override
  State<_EditProfilePage> createState() => _EditProfilePageState();
}

class _EditProfilePageState extends State<_EditProfilePage> {
  final _formKey = GlobalKey<FormState>();
  final _imagePicker = ImagePicker();
  late final TextEditingController _firstName;
  late final TextEditingController _middleName;
  late final TextEditingController _lastName;
  late final TextEditingController _email;
  late final TextEditingController _location;
  late final TextEditingController _landmark;
  late final TextEditingController _bio;
  late Map<String, dynamic> _baselineProfile;
  late String _photoUrl;
  XFile? _pendingPhoto;
  DateTime? _dateOfBirth;
  String? _province;
  String? _district;
  String? _gender;
  String? _travelerExperience;
  String? _travelStyle;
  final Set<String> _languages = {};
  final Set<String> _interests = {};
  List<_ProvinceOption> _placeOptions = [];
  bool _saving = false;
  bool _uploadingPhoto = false;
  bool _loadingPlaces = true;
  String? _error;

  static const _genderOptions = {
    'male': 'Male',
    'female': 'Female',
    'non_binary': 'Non-binary',
    'other': 'Other',
    'prefer_not_to_say': 'Prefer not to say',
  };
  static const _experienceOptions = {
    'new_explorer': 'New Explorer',
    'trail_regular': 'Trail Regular',
    'expedition_ready': 'Expedition Ready',
  };
  static const _styleOptions = {
    'solo': 'Solo',
    'small_group': 'Small group',
    'open_to_all': 'Open to all',
  };
  static const _languageOptions = [
    'Nepali',
    'English',
    'Hindi',
    'Newari',
    'Maithili',
    'Tibetan',
  ];
  static const _interestOptions = {
    'trekking': 'Trekking',
    'camping': 'Camping',
    'culture': 'Culture',
    'photography': 'Photography',
    'cycling': 'Cycling',
    'food': 'Local food',
    'wildlife': 'Wildlife',
    'wellness': 'Wellness',
  };

  @override
  void initState() {
    super.initState();
    _baselineProfile = {...widget.profile};
    _firstName = TextEditingController(text: _value('firstName'));
    _middleName = TextEditingController(text: _value('middleName'));
    _lastName = TextEditingController(text: _value('lastName'));
    _email = TextEditingController(text: _value('email'));
    _location = TextEditingController(text: _value('location'));
    _landmark = TextEditingController(text: _value('landmark'));
    _bio = TextEditingController(text: _value('bio'));
    _photoUrl = _value('profilePhoto');
    _dateOfBirth = DateTime.tryParse(_value('dateOfBirth'));
    _province = _nullableValue('province');
    _district = _nullableValue('district');
    _gender = _nullableValue('gender');
    _travelerExperience = _nullableValue('travelerExperience');
    _travelStyle = _nullableValue('travelStyle');
    _languages.addAll(_stringValues(_baselineProfile['languagesKnown']));
    _interests.addAll(_stringValues(_baselineProfile['travelInterests']));
    _loadPlaces();
  }

  String _value(String key) => (_baselineProfile[key] ?? '').toString().trim();
  String? _nullableValue(String key) {
    final value = _value(key);
    return value.isEmpty ? null : value;
  }

  List<String> _stringValues(dynamic value) {
    final Iterable<dynamic> values = value is Iterable && value is! String
        ? value
        : (value ?? '').toString().split(',');
    return values
        .map((item) => item.toString().trim())
        .where((item) => item.isNotEmpty)
        .toList();
  }

  @override
  void dispose() {
    _firstName.dispose();
    _middleName.dispose();
    _lastName.dispose();
    _email.dispose();
    _location.dispose();
    _landmark.dispose();
    _bio.dispose();
    super.dispose();
  }

  Future<void> _loadPlaces() async {
    try {
      final rawItems = await ApiService.getPlaceHierarchy();
      final options = rawItems
          .whereType<Map>()
          .map((item) =>
              _ProvinceOption.fromJson(Map<String, dynamic>.from(item)))
          .where((option) => option.name.isNotEmpty)
          .toList();
      if (!mounted) return;
      setState(() {
        _placeOptions = options;
        final matchedProvince = _matchOption(
          _province,
          options.map((option) => option.name),
        );
        if (matchedProvince != null) _province = matchedProvince;
        final districts = _districtOptions;
        final matchedDistrict = _matchOption(_district, districts);
        if (matchedDistrict != null) _district = matchedDistrict;
        _loadingPlaces = false;
      });
    } catch (error) {
      if (!mounted) return;
      setState(() {
        _loadingPlaces = false;
        _error = ApiService.readableError(error);
      });
    }
  }

  String? _matchOption(String? value, Iterable<String> options) {
    if (value == null) return null;
    final normalized = value.trim().toLowerCase();
    for (final option in options) {
      if (option.trim().toLowerCase() == normalized) return option;
    }
    return null;
  }

  List<String> get _districtOptions {
    if (_province == null) return const [];
    for (final option in _placeOptions) {
      if (option.name == _province) return option.districts;
    }
    return const [];
  }

  Future<void> _chooseDateOfBirth() async {
    final now = DateTime.now();
    final lastAllowed = DateTime(now.year - 9, now.month, now.day);
    final selected = await showDatePicker(
      context: context,
      initialDate: _dateOfBirth ?? DateTime(now.year - 18),
      firstDate: DateTime(now.year - 120),
      lastDate: lastAllowed,
      helpText: 'SELECT DATE OF BIRTH',
    );
    if (selected != null && mounted) setState(() => _dateOfBirth = selected);
  }

  Future<void> _changePhoto() async {
    final source = await showModalBottomSheet<ImageSource>(
      context: context,
      showDragHandle: true,
      builder: (context) => SafeArea(
        child: Padding(
          padding: const EdgeInsets.fromLTRB(18, 4, 18, 18),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              _PhotoSourceTile(
                icon: Icons.photo_library_outlined,
                title: 'Choose from gallery',
                onTap: () => Navigator.pop(context, ImageSource.gallery),
              ),
              const SizedBox(height: 8),
              _PhotoSourceTile(
                icon: Icons.photo_camera_outlined,
                title: 'Take a photo',
                onTap: () => Navigator.pop(context, ImageSource.camera),
              ),
            ],
          ),
        ),
      ),
    );
    if (source == null || !mounted) return;

    try {
      final image = await _imagePicker.pickImage(
        source: source,
        imageQuality: 82,
        maxWidth: 1400,
      );
      if (image == null || !mounted) return;
      setState(() {
        _pendingPhoto = image;
        _error = null;
      });
    } catch (error) {
      if (mounted) setState(() => _error = ApiService.readableError(error));
    }
  }

  Future<void> _save() async {
    FocusManager.instance.primaryFocus?.unfocus();
    if (!_formKey.currentState!.validate()) return;

    final changes = _changedFields();
    final locationChanged =
        changes.containsKey('province') || changes.containsKey('district');
    if (locationChanged && (_province == null || _district == null)) {
      setState(() => _error = 'Choose your province and district.');
      return;
    }
    if (changes.containsKey('languagesKnown') && _languages.isEmpty) {
      setState(() => _error = 'Choose at least one language.');
      return;
    }
    if (changes.containsKey('travelInterests') &&
        (_interests.length < 2 || _interests.length > 8)) {
      setState(
        () => _error = 'Choose between two and eight travel interests.',
      );
      return;
    }
    if (changes.isEmpty && _pendingPhoto == null) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('No profile changes to save.')),
      );
      return;
    }

    setState(() {
      _saving = true;
      _error = null;
    });
    try {
      if (changes.isNotEmpty) {
        await ApiService.updateProfile(changes);
        final refreshed = await ApiService.getProfile();
        if (!mounted) return;
        _baselineProfile = refreshed;
        _photoUrl = (refreshed['profilePhoto'] ?? _photoUrl).toString();
      }

      final photo = _pendingPhoto;
      if (photo != null) {
        setState(() => _uploadingPhoto = true);
        final uploadedPhotoUrl =
            await ApiService.uploadProfileImage(File(photo.path));
        final refreshed = await ApiService.getProfile();
        final savedPhotoUrl =
            (refreshed['profilePhoto'] ?? '').toString().trim();
        if (savedPhotoUrl.isEmpty || savedPhotoUrl != uploadedPhotoUrl) {
          throw Exception(
            'The server did not confirm the new profile photo. Please retry.',
          );
        }
        if (!mounted) return;
        _baselineProfile = refreshed;
        _photoUrl = savedPhotoUrl;
        _pendingPhoto = null;
      }

      if (!mounted) return;
      Navigator.pop(context, true);
    } catch (error) {
      if (mounted) setState(() => _error = ApiService.readableError(error));
    } finally {
      if (mounted) {
        setState(() {
          _saving = false;
          _uploadingPhoto = false;
        });
      }
    }
  }

  Map<String, dynamic> _changedFields() {
    final changes = <String, dynamic>{};

    void addString(String key, String value, {bool lowercase = false}) {
      final current = lowercase ? value.trim().toLowerCase() : value.trim();
      final baseline = lowercase ? _value(key).toLowerCase() : _value(key);
      if (current != baseline) changes[key] = current;
    }

    void addNullable(
      String key,
      String? value, {
      bool caseInsensitive = false,
    }) {
      final current = (value ?? '').trim();
      final baseline = _value(key);
      final unchanged = caseInsensitive
          ? current.toLowerCase() == baseline.toLowerCase()
          : current == baseline;
      if (!unchanged) changes[key] = current;
    }

    void addSet(String key, Set<String> values) {
      final current = values.toList()..sort();
      final baseline = _stringValues(_baselineProfile[key])..sort();
      if (!_sameList(current, baseline)) changes[key] = current;
    }

    addString('firstName', _firstName.text);
    addString('middleName', _middleName.text);
    addString('lastName', _lastName.text);
    addString('email', _email.text, lowercase: true);
    final date = _dateOfBirth == null ? '' : _apiDate(_dateOfBirth!);
    final baselineDate = DateTime.tryParse(_value('dateOfBirth'));
    final normalizedBaselineDate =
        baselineDate == null ? '' : _apiDate(baselineDate);
    if (date != normalizedBaselineDate) changes['dateOfBirth'] = date;
    addString('location', _location.text);
    addNullable('province', _province, caseInsensitive: true);
    addNullable('district', _district, caseInsensitive: true);
    addString('landmark', _landmark.text);
    addNullable('gender', _gender);
    addSet('languagesKnown', _languages);
    addNullable('travelerExperience', _travelerExperience);
    addNullable('travelStyle', _travelStyle);
    addSet('travelInterests', _interests);
    addString('bio', _bio.text);
    return changes;
  }

  bool _sameList(List<String> first, List<String> second) {
    if (first.length != second.length) return false;
    for (var index = 0; index < first.length; index++) {
      if (first[index] != second[index]) return false;
    }
    return true;
  }

  @override
  Widget build(BuildContext context) {
    final completion = _profileCompletion();

    return Scaffold(
      backgroundColor: _profileCanvas,
      appBar: AppBar(
        backgroundColor: _profileCanvas,
        title: const Text('Edit traveler profile'),
      ),
      bottomNavigationBar: SafeArea(
        top: false,
        child: Container(
          padding: const EdgeInsets.fromLTRB(18, 12, 18, 14),
          decoration: BoxDecoration(
            color: Colors.white,
            border: const Border(top: BorderSide(color: _profileLine)),
            boxShadow: [
              BoxShadow(
                color: _profileForest.withValues(alpha: .08),
                blurRadius: 20,
                offset: const Offset(0, -6),
              ),
            ],
          ),
          child: FilledButton.icon(
            onPressed: _saving ? null : _save,
            style: FilledButton.styleFrom(
              backgroundColor: _profileForest,
              foregroundColor: Colors.white,
              minimumSize: const Size.fromHeight(56),
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(18),
              ),
            ),
            icon: _saving
                ? const SizedBox.square(
                    dimension: 20,
                    child: CircularProgressIndicator(
                      color: Colors.white,
                      strokeWidth: 2,
                    ),
                  )
                : const Icon(Icons.check_circle_outline_rounded),
            label: Text(_saving ? 'Saving profile…' : 'Save profile'),
          ),
        ),
      ),
      body: Form(
        key: _formKey,
        child: ListView(
          padding: const EdgeInsets.fromLTRB(16, 6, 16, 32),
          children: [
            _EditorIntroCard(
              completion: completion,
              photoUrl: _photoUrl,
              pendingPhoto: _pendingPhoto,
              uploadingPhoto: _uploadingPhoto,
              onPhotoTap: _saving ? null : _changePhoto,
            ),
            const SizedBox(height: 20),
            _EditorSection(
              number: '01',
              eyebrow: 'IDENTITY',
              title: 'How travelers know you',
              icon: Icons.fingerprint_rounded,
              child: Column(
                children: [
                  _FixedPhoneField(
                    phone: _formatPhone(widget.profile['phoneNumber']),
                  ),
                  const SizedBox(height: 14),
                  Row(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Expanded(
                        child: TextFormField(
                          controller: _firstName,
                          textCapitalization: TextCapitalization.words,
                          decoration:
                              const InputDecoration(labelText: 'First name'),
                          validator: (value) => _requiredIfChanged(
                              'firstName', value, 'Enter your first name'),
                        ),
                      ),
                      const SizedBox(width: 10),
                      Expanded(
                        child: TextFormField(
                          controller: _lastName,
                          textCapitalization: TextCapitalization.words,
                          decoration:
                              const InputDecoration(labelText: 'Last name'),
                          validator: (value) => _requiredIfChanged(
                              'lastName', value, 'Enter your last name'),
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 12),
                  TextFormField(
                    controller: _middleName,
                    textCapitalization: TextCapitalization.words,
                    decoration: const InputDecoration(
                        labelText: 'Middle name (optional)'),
                  ),
                  const SizedBox(height: 12),
                  TextFormField(
                    controller: _email,
                    keyboardType: TextInputType.emailAddress,
                    autofillHints: const [AutofillHints.email],
                    decoration: const InputDecoration(
                      labelText: 'Email address',
                      prefixIcon: Icon(Icons.alternate_email_rounded),
                    ),
                    validator: _validateEmailIfChanged,
                  ),
                  const SizedBox(height: 12),
                  _DateOfBirthField(
                    date: _dateOfBirth,
                    onTap: _chooseDateOfBirth,
                  ),
                  const SizedBox(height: 12),
                  DropdownButtonFormField<String>(
                    value: _genderOptions.containsKey(_gender) ? _gender : null,
                    decoration: const InputDecoration(
                      labelText: 'Gender',
                      prefixIcon: Icon(Icons.person_outline_rounded),
                    ),
                    items: _genderOptions.entries
                        .map(
                          (entry) => DropdownMenuItem(
                            value: entry.key,
                            child: Text(entry.value),
                          ),
                        )
                        .toList(),
                    onChanged: (value) => setState(() => _gender = value),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 16),
            _EditorSection(
              number: '02',
              eyebrow: 'HOME BASE',
              title: 'Where your journeys begin',
              icon: Icons.explore_outlined,
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  if (_loadingPlaces)
                    const Padding(
                      padding: EdgeInsets.symmetric(vertical: 18),
                      child: Center(
                        child: CircularProgressIndicator(
                          color: _profileForest,
                          strokeWidth: 2.5,
                        ),
                      ),
                    )
                  else ...[
                    DropdownButtonFormField<String>(
                      value: _placeOptions
                              .any((option) => option.name == _province)
                          ? _province
                          : null,
                      isExpanded: true,
                      decoration: const InputDecoration(
                        labelText: 'Province',
                        prefixIcon: Icon(Icons.map_outlined),
                      ),
                      items: _placeOptions
                          .map(
                            (option) => DropdownMenuItem(
                              value: option.name,
                              child: Text(
                                _optionLabel(option.name),
                                overflow: TextOverflow.ellipsis,
                              ),
                            ),
                          )
                          .toList(),
                      onChanged: (value) => setState(() {
                        _province = value;
                        _district = null;
                      }),
                    ),
                    const SizedBox(height: 12),
                    DropdownButtonFormField<String>(
                      key: ValueKey(_province),
                      value: _districtOptions.contains(_district)
                          ? _district
                          : null,
                      isExpanded: true,
                      decoration: const InputDecoration(
                        labelText: 'District',
                        prefixIcon: Icon(Icons.signpost_outlined),
                      ),
                      items: _districtOptions
                          .map(
                            (district) => DropdownMenuItem(
                              value: district,
                              child: Text(
                                _optionLabel(district),
                                overflow: TextOverflow.ellipsis,
                              ),
                            ),
                          )
                          .toList(),
                      onChanged: _province == null
                          ? null
                          : (value) => setState(() => _district = value),
                    ),
                    const SizedBox(height: 12),
                  ],
                  TextFormField(
                    controller: _location,
                    textCapitalization: TextCapitalization.words,
                    decoration: const InputDecoration(
                      labelText: 'City, municipality or locality',
                      prefixIcon: Icon(Icons.location_on_outlined),
                    ),
                    validator: (value) => _requiredIfChanged(
                        'location', value, 'Add your city or locality'),
                  ),
                  const SizedBox(height: 12),
                  TextFormField(
                    controller: _landmark,
                    textCapitalization: TextCapitalization.words,
                    decoration: const InputDecoration(
                      labelText: 'Nearby landmark',
                      prefixIcon: Icon(Icons.place_outlined),
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 16),
            _EditorSection(
              number: '03',
              eyebrow: 'TRAVEL PROFILE',
              title: 'How you explore and connect',
              icon: Icons.hiking_rounded,
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  DropdownButtonFormField<String>(
                    value: _experienceOptions.containsKey(_travelerExperience)
                        ? _travelerExperience
                        : null,
                    decoration: const InputDecoration(
                      labelText: 'Travel experience',
                      prefixIcon: Icon(Icons.landscape_outlined),
                    ),
                    items: _experienceOptions.entries
                        .map(
                          (entry) => DropdownMenuItem(
                            value: entry.key,
                            child: Text(entry.value),
                          ),
                        )
                        .toList(),
                    onChanged: (value) =>
                        setState(() => _travelerExperience = value),
                  ),
                  const SizedBox(height: 12),
                  DropdownButtonFormField<String>(
                    value: _styleOptions.containsKey(_travelStyle)
                        ? _travelStyle
                        : null,
                    decoration: const InputDecoration(
                      labelText: 'Preferred travel style',
                      prefixIcon: Icon(Icons.groups_2_outlined),
                    ),
                    items: _styleOptions.entries
                        .map(
                          (entry) => DropdownMenuItem(
                            value: entry.key,
                            child: Text(entry.value),
                          ),
                        )
                        .toList(),
                    onChanged: (value) => setState(() => _travelStyle = value),
                  ),
                  const SizedBox(height: 20),
                  const _FieldHeading(
                    title: 'Languages you speak',
                    subtitle: 'Choose at least one language.',
                  ),
                  const SizedBox(height: 10),
                  Wrap(
                    spacing: 8,
                    runSpacing: 8,
                    children: _languageOptions.map((language) {
                      final selected = _languages.contains(language);
                      return FilterChip(
                        selected: selected,
                        label: Text(language),
                        onSelected: (_) => setState(() {
                          selected
                              ? _languages.remove(language)
                              : _languages.add(language);
                        }),
                      );
                    }).toList(),
                  ),
                  const SizedBox(height: 20),
                  const _FieldHeading(
                    title: 'Travel interests',
                    subtitle: 'Choose between two and eight interests.',
                  ),
                  const SizedBox(height: 10),
                  Wrap(
                    spacing: 8,
                    runSpacing: 8,
                    children: _interestOptions.entries.map((entry) {
                      final selected = _interests.contains(entry.key);
                      return FilterChip(
                        selected: selected,
                        label: Text(entry.value),
                        onSelected: (_) => setState(() {
                          selected
                              ? _interests.remove(entry.key)
                              : _interests.add(entry.key);
                        }),
                      );
                    }).toList(),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 16),
            _EditorSection(
              number: '04',
              eyebrow: 'YOUR STORY',
              title: 'Give people a reason to connect',
              icon: Icons.auto_stories_outlined,
              child: TextFormField(
                controller: _bio,
                minLines: 5,
                maxLines: 8,
                maxLength: 300,
                textCapitalization: TextCapitalization.sentences,
                decoration: const InputDecoration(
                  labelText: 'Traveler bio',
                  hintText:
                      'Share the places, pace, and kind of company you enjoy…',
                  alignLabelWithHint: true,
                ),
                validator: (value) {
                  final length = value?.trim().length ?? 0;
                  if ((value ?? '').trim() == _value('bio')) return null;
                  if (length > 0 && length < 20) {
                    return 'Write at least 20 characters or leave it empty';
                  }
                  return null;
                },
              ),
            ),
            if (_error != null) ...[
              const SizedBox(height: 16),
              _InlineEditorError(message: _error!),
            ],
          ],
        ),
      ),
    );
  }

  int _profileCompletion() {
    final values = [
      _firstName.text,
      _lastName.text,
      _email.text,
      _location.text,
      _landmark.text,
      _bio.text,
      if (_dateOfBirth != null) 'dob',
      if (_photoUrl.isNotEmpty) 'photo',
      if (_province != null) 'province',
      if (_district != null) 'district',
      if (_languages.isNotEmpty) 'languages',
      if (_interests.length >= 2) 'interests',
      if (_travelerExperience != null) 'experience',
      if (_travelStyle != null) 'style',
      if (_gender != null) 'gender',
    ];
    final complete = values.where((value) => value.trim().isNotEmpty).length;
    return ((complete / 15) * 100).round().clamp(0, 100);
  }

  String? _requiredIfChanged(String key, String? value, String message) {
    final current = (value ?? '').trim();
    if (current == _value(key)) return null;
    return current.isEmpty ? message : null;
  }

  String? _validateEmailIfChanged(String? value) {
    final email = (value ?? '').trim().toLowerCase();
    if (email == _value('email').toLowerCase()) return null;
    if (email.isEmpty) return 'Enter your email address';
    if (!RegExp(r'^[^\s@]+@[^\s@]+\.[^\s@]+$').hasMatch(email)) {
      return 'Enter a valid email address';
    }
    return null;
  }

  String _apiDate(DateTime date) =>
      '${date.year.toString().padLeft(4, '0')}-${date.month.toString().padLeft(2, '0')}-${date.day.toString().padLeft(2, '0')}';

  String _optionLabel(String value) => value
      .trim()
      .toLowerCase()
      .split(RegExp(r'[_\s]+'))
      .where((part) => part.isNotEmpty)
      .map((part) => '${part[0].toUpperCase()}${part.substring(1)}')
      .join(' ');
}

class _ProvinceOption {
  const _ProvinceOption({required this.name, required this.districts});

  factory _ProvinceOption.fromJson(Map<String, dynamic> json) {
    final rawDistricts = json['districts'];
    return _ProvinceOption(
      name: (json['province'] ?? '').toString().trim(),
      districts: rawDistricts is Iterable
          ? rawDistricts
              .map((value) => value.toString().trim())
              .where((value) => value.isNotEmpty)
              .toList()
          : const [],
    );
  }

  final String name;
  final List<String> districts;
}

class _FieldHeading extends StatelessWidget {
  const _FieldHeading({required this.title, required this.subtitle});

  final String title;
  final String subtitle;

  @override
  Widget build(BuildContext context) => Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            title,
            style: const TextStyle(
              color: _profileInk,
              fontSize: 14,
              fontWeight: FontWeight.w900,
            ),
          ),
          const SizedBox(height: 3),
          Text(
            subtitle,
            style: const TextStyle(color: _profileMuted, fontSize: 12),
          ),
        ],
      );
}

class _EditorIntroCard extends StatelessWidget {
  const _EditorIntroCard({
    required this.completion,
    required this.photoUrl,
    required this.pendingPhoto,
    required this.uploadingPhoto,
    required this.onPhotoTap,
  });

  final int completion;
  final String photoUrl;
  final XFile? pendingPhoto;
  final bool uploadingPhoto;
  final VoidCallback? onPhotoTap;

  @override
  Widget build(BuildContext context) {
    ImageProvider<Object>? photoProvider;
    if (pendingPhoto != null) {
      photoProvider = FileImage(File(pendingPhoto!.path));
    } else if (photoUrl.isNotEmpty) {
      photoProvider = NetworkImage(photoUrl);
    }

    return Container(
      clipBehavior: Clip.antiAlias,
      decoration: BoxDecoration(
        gradient: const LinearGradient(
          colors: [_profileForest, _profileForestLight],
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ),
        borderRadius: BorderRadius.circular(26),
      ),
      child: Stack(
        children: [
          const Positioned(right: -38, top: -52, child: _HeaderRing(size: 150)),
          Padding(
            padding: const EdgeInsets.all(20),
            child: Row(
              children: [
                GestureDetector(
                  onTap: onPhotoTap,
                  child: SizedBox.square(
                    dimension: 78,
                    child: Stack(
                      children: [
                        Positioned.fill(
                          child: CircularProgressIndicator(
                            value: completion / 100,
                            strokeWidth: 4,
                            backgroundColor:
                                Colors.white.withValues(alpha: .15),
                            color: _profileAmber,
                          ),
                        ),
                        Positioned.fill(
                          child: Padding(
                            padding: const EdgeInsets.all(6),
                            child: CircleAvatar(
                              backgroundColor: const Color(0xFFDDEAE5),
                              backgroundImage: photoProvider,
                              child: photoProvider == null
                                  ? const Icon(
                                      Icons.person_rounded,
                                      color: _profileForest,
                                      size: 30,
                                    )
                                  : null,
                            ),
                          ),
                        ),
                        Positioned(
                          right: 0,
                          bottom: 0,
                          child: Container(
                            width: 27,
                            height: 27,
                            decoration: const BoxDecoration(
                              color: _profileAmber,
                              shape: BoxShape.circle,
                            ),
                            child: uploadingPhoto
                                ? const Padding(
                                    padding: EdgeInsets.all(6),
                                    child: CircularProgressIndicator(
                                      color: _profileForest,
                                      strokeWidth: 2,
                                    ),
                                  )
                                : const Icon(
                                    Icons.camera_alt_rounded,
                                    color: _profileForest,
                                    size: 15,
                                  ),
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
                const SizedBox(width: 16),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Text(
                        'Your traveler card',
                        style: TextStyle(
                          color: Colors.white,
                          fontSize: 19,
                          fontWeight: FontWeight.w900,
                        ),
                      ),
                      const SizedBox(height: 5),
                      Text(
                        pendingPhoto == null
                            ? '$completion% complete  •  Tap photo to change'
                            : 'New photo ready  •  Save to upload',
                        style: const TextStyle(
                          color: _profileAmber,
                          fontSize: 11,
                          fontWeight: FontWeight.w800,
                        ),
                      ),
                      const SizedBox(height: 4),
                      const Text(
                        'A complete profile builds trust before the first hello.',
                        style:
                            TextStyle(color: Color(0xFFC9DDD6), height: 1.35),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _EditorSection extends StatelessWidget {
  const _EditorSection({
    required this.number,
    required this.eyebrow,
    required this.title,
    required this.icon,
    required this.child,
  });

  final String number;
  final String eyebrow;
  final String title;
  final IconData icon;
  final Widget child;

  @override
  Widget build(BuildContext context) => Container(
        padding: const EdgeInsets.all(18),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(24),
          border: Border.all(color: _profileLine),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Container(
                  width: 42,
                  height: 42,
                  decoration: BoxDecoration(
                    color: _profileForest.withValues(alpha: .09),
                    borderRadius: BorderRadius.circular(14),
                  ),
                  child: Icon(icon, color: _profileForest, size: 21),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        '$number  /  $eyebrow',
                        style: const TextStyle(
                          color: _profileForestLight,
                          fontSize: 10,
                          fontWeight: FontWeight.w900,
                          letterSpacing: 1,
                        ),
                      ),
                      const SizedBox(height: 3),
                      Text(
                        title,
                        style: const TextStyle(
                          color: _profileInk,
                          fontSize: 17,
                          fontWeight: FontWeight.w900,
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ),
            const SizedBox(height: 18),
            child,
          ],
        ),
      );
}

class _FixedPhoneField extends StatelessWidget {
  const _FixedPhoneField({required this.phone});
  final String phone;

  @override
  Widget build(BuildContext context) => Container(
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
        decoration: BoxDecoration(
          color: const Color(0xFFF0F3F0),
          borderRadius: BorderRadius.circular(17),
          border: Border.all(color: _profileLine),
        ),
        child: Row(
          children: [
            const Icon(Icons.phone_outlined, color: _profileForest),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text(
                    'REGISTERED PHONE',
                    style: TextStyle(
                      color: _profileMuted,
                      fontSize: 9.5,
                      fontWeight: FontWeight.w900,
                      letterSpacing: .8,
                    ),
                  ),
                  const SizedBox(height: 3),
                  Text(
                    phone,
                    style: const TextStyle(
                        color: _profileInk, fontWeight: FontWeight.w800),
                  ),
                ],
              ),
            ),
            const _LockedIndicator(label: 'Fixed'),
          ],
        ),
      );
}

class _DateOfBirthField extends StatelessWidget {
  const _DateOfBirthField({required this.date, required this.onTap});
  final DateTime? date;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) => InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(18),
        child: InputDecorator(
          decoration: const InputDecoration(
            labelText: 'Date of birth',
            prefixIcon: Icon(Icons.cake_outlined),
            suffixIcon: Icon(Icons.calendar_month_outlined),
          ),
          child: Text(
            date == null
                ? 'Choose your date of birth'
                : _formatDateOfBirth(date!.toIso8601String()),
            style: TextStyle(
              color: date == null ? _profileMuted : _profileInk,
              fontWeight: FontWeight.w700,
            ),
          ),
        ),
      );
}

class _InlineEditorError extends StatelessWidget {
  const _InlineEditorError({required this.message});
  final String message;

  @override
  Widget build(BuildContext context) => Container(
        padding: const EdgeInsets.all(14),
        decoration: BoxDecoration(
          color: const Color(0xFFFFECE9),
          borderRadius: BorderRadius.circular(16),
          border: Border.all(color: const Color(0xFFF4C7C2)),
        ),
        child: Row(
          children: [
            const Icon(Icons.error_outline_rounded, color: Color(0xFFB42318)),
            const SizedBox(width: 10),
            Expanded(
              child: Text(
                message,
                style: const TextStyle(
                    color: _profileInk, fontWeight: FontWeight.w700),
              ),
            ),
          ],
        ),
      );
}

class _PolicyPage extends StatelessWidget {
  const _PolicyPage({required this.document});

  final _ProfileDocument document;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: _profileCanvas,
      appBar: AppBar(
        backgroundColor: _profileCanvas,
        title: Text(document.title),
      ),
      body: ListView(
        padding: const EdgeInsets.fromLTRB(20, 8, 20, 36),
        children: [
          Container(
            padding: const EdgeInsets.all(18),
            decoration: BoxDecoration(
              color: _profileForest,
              borderRadius: BorderRadius.circular(22),
            ),
            child: Row(
              children: [
                Icon(document.icon, color: _profileAmber, size: 28),
                const SizedBox(width: 14),
                Expanded(
                  child: Text(
                    document.introduction,
                    style: const TextStyle(
                        color: Colors.white,
                        height: 1.45,
                        fontWeight: FontWeight.w600),
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 22),
          for (final section in document.sections) ...[
            Text(
              section.title,
              style: const TextStyle(
                color: _profileInk,
                fontSize: 17,
                fontWeight: FontWeight.w900,
              ),
            ),
            const SizedBox(height: 7),
            Text(
              section.body,
              style: const TextStyle(
                  color: _profileMuted, height: 1.6, fontSize: 14.5),
            ),
            const SizedBox(height: 20),
          ],
        ],
      ),
    );
  }
}

class _SectionLabel extends StatelessWidget {
  const _SectionLabel({required this.title});
  final String title;

  @override
  Widget build(BuildContext context) => Padding(
        padding: const EdgeInsets.fromLTRB(4, 0, 4, 9),
        child: Text(
          title.toUpperCase(),
          style: const TextStyle(
            color: _profileMuted,
            fontSize: 11,
            fontWeight: FontWeight.w900,
            letterSpacing: 1.1,
          ),
        ),
      );
}

class _SettingsCard extends StatelessWidget {
  const _SettingsCard({required this.children});
  final List<Widget> children;

  @override
  Widget build(BuildContext context) => Container(
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(20),
          border: Border.all(color: _profileLine),
        ),
        child: Column(
          children: [
            for (var index = 0; index < children.length; index++) ...[
              children[index],
              if (index < children.length - 1)
                const Divider(height: 1, indent: 68, color: _profileLine),
            ],
          ],
        ),
      );
}

class _LockedIndicator extends StatelessWidget {
  const _LockedIndicator({this.label = 'Fixed'});

  final String label;

  @override
  Widget build(BuildContext context) => Container(
        padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 6),
        decoration: BoxDecoration(
          color: _profileForest.withValues(alpha: .07),
          borderRadius: BorderRadius.circular(99),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Icon(
              Icons.lock_outline_rounded,
              color: _profileForest,
              size: 13,
            ),
            const SizedBox(width: 4),
            Text(
              label,
              style: const TextStyle(
                color: _profileForest,
                fontSize: 10.5,
                fontWeight: FontWeight.w800,
              ),
            ),
          ],
        ),
      );
}

class _SettingsTile extends StatelessWidget {
  const _SettingsTile({
    required this.icon,
    required this.title,
    this.subtitle,
    this.onTap,
    this.trailing,
    this.iconColor = _profileForest,
    this.titleColor = _profileInk,
  });

  final IconData icon;
  final String title;
  final String? subtitle;
  final VoidCallback? onTap;
  final Widget? trailing;
  final Color iconColor;
  final Color titleColor;

  @override
  Widget build(BuildContext context) => ListTile(
        onTap: onTap,
        minTileHeight: subtitle == null ? 60 : 72,
        contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 2),
        leading: Container(
          width: 40,
          height: 40,
          decoration: BoxDecoration(
            color: iconColor.withValues(alpha: .09),
            borderRadius: BorderRadius.circular(13),
          ),
          child: Icon(icon, color: iconColor, size: 21),
        ),
        title: Text(
          title,
          style: TextStyle(
              color: titleColor, fontSize: 15, fontWeight: FontWeight.w800),
        ),
        subtitle: subtitle == null
            ? null
            : Text(subtitle!,
                style: const TextStyle(color: _profileMuted, fontSize: 12.5)),
        trailing: trailing ??
            (onTap == null
                ? null
                : const Icon(Icons.chevron_right_rounded,
                    color: _profileMuted)),
      );
}

class _ProfileStat extends StatelessWidget {
  const _ProfileStat({required this.value, required this.label});
  final String value;
  final String label;

  @override
  Widget build(BuildContext context) => Expanded(
        child: Column(
          children: [
            Text(
              value,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: const TextStyle(
                  color: Colors.white,
                  fontSize: 15,
                  fontWeight: FontWeight.w900),
            ),
            const SizedBox(height: 3),
            Text(label,
                style: TextStyle(
                    color: Colors.white.withValues(alpha: .62),
                    fontSize: 10.5)),
          ],
        ),
      );
}

class _StatDivider extends StatelessWidget {
  const _StatDivider();

  @override
  Widget build(BuildContext context) => Container(
        width: 1,
        height: 30,
        color: Colors.white.withValues(alpha: .13),
      );
}

class _HeaderRing extends StatelessWidget {
  const _HeaderRing({required this.size});
  final double size;

  @override
  Widget build(BuildContext context) => Container(
        width: size,
        height: size,
        decoration: BoxDecoration(
          shape: BoxShape.circle,
          border:
              Border.all(color: Colors.white.withValues(alpha: .08), width: 24),
        ),
      );
}

class _PhotoSourceTile extends StatelessWidget {
  const _PhotoSourceTile(
      {required this.icon, required this.title, required this.onTap});
  final IconData icon;
  final String title;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) => ListTile(
        onTap: onTap,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
        tileColor: _profileCanvas,
        leading: Icon(icon, color: _profileForest),
        title: Text(title, style: const TextStyle(fontWeight: FontWeight.w800)),
        trailing: const Icon(Icons.chevron_right_rounded),
      );
}

class _ErrorBanner extends StatelessWidget {
  const _ErrorBanner({required this.message, required this.onRetry});
  final String message;
  final Future<void> Function({bool showLoader}) onRetry;

  @override
  Widget build(BuildContext context) => Container(
        padding: const EdgeInsets.all(14),
        decoration: BoxDecoration(
          color: const Color(0xFFFFECE9),
          borderRadius: BorderRadius.circular(16),
          border: Border.all(color: const Color(0xFFF4C7C2)),
        ),
        child: Row(
          children: [
            const Icon(Icons.info_outline_rounded, color: Color(0xFFB42318)),
            const SizedBox(width: 10),
            Expanded(
                child:
                    Text(message, style: const TextStyle(color: _profileInk))),
            TextButton(onPressed: () => onRetry(), child: const Text('Retry')),
          ],
        ),
      );
}

class _ProfileDocument {
  const _ProfileDocument({
    required this.title,
    required this.icon,
    required this.introduction,
    required this.sections,
  });

  final String title;
  final IconData icon;
  final String introduction;
  final List<_DocumentSection> sections;
}

class _DocumentSection {
  const _DocumentSection(this.title, this.body);
  final String title;
  final String body;
}

const _privacyPolicy = _ProfileDocument(
  title: 'Privacy policy',
  icon: Icons.privacy_tip_outlined,
  introduction:
      'A clear overview of the information TripSathi uses to provide your account and travel features.',
  sections: [
    _DocumentSection(
      'Information you provide',
      'Your account may include your name, contact details, profile photo, location, traveler preferences and content you choose to share. Only provide information you are comfortable using in the service.',
    ),
    _DocumentSection(
      'How information is used',
      'Profile data supports sign-in, traveler discovery, trips, campaigns, safety features and account support. Security records may be used to prevent abuse and protect accounts.',
    ),
    _DocumentSection(
      'Your profile visibility',
      'You can make your traveler profile public or private from Profile settings. Some information may still be processed when required to operate your account and joined activities.',
    ),
    _DocumentSection(
      'Your choices',
      'You can update your profile, change your photo, adjust visibility, pause app notifications, sign out or permanently delete your account from this screen.',
    ),
  ],
);

const _userAgreement = _ProfileDocument(
  title: 'User agreement',
  icon: Icons.description_outlined,
  introduction:
      'These practical rules help keep trips, campaigns and traveler interactions trustworthy.',
  sections: [
    _DocumentSection(
      'Use an authentic account',
      'Keep your account information accurate, protect your sign-in details and do not impersonate another person or organization.',
    ),
    _DocumentSection(
      'Respect other travelers',
      'Do not harass, threaten, discriminate, mislead or share another person’s private information without permission.',
    ),
    _DocumentSection(
      'Trips involve real-world risk',
      'Check routes, weather, permits, equipment and emergency contacts independently. A listing or user profile is not a guarantee of safety, skill or availability.',
    ),
    _DocumentSection(
      'Account enforcement',
      'Content or accounts that create safety, fraud or abuse risks may be restricted while a report is reviewed.',
    ),
  ],
);

const _communitySafety = _ProfileDocument(
  title: 'Community & safety',
  icon: Icons.health_and_safety_outlined,
  introduction:
      'Good preparation and clear communication matter more than any app feature when traveling.',
  sections: [
    _DocumentSection(
      'Before joining',
      'Review the itinerary, difficulty, organizer details, costs and cancellation expectations. Meet in a public place when traveling with someone new.',
    ),
    _DocumentSection(
      'Protect personal information',
      'Avoid posting identity documents, banking details, passwords or precise home addresses in public profiles, chats or trip listings.',
    ),
    _DocumentSection(
      'During an emergency',
      'Contact local emergency services first. Do not rely on TripSathi messaging as an emergency-response channel.',
    ),
    _DocumentSection(
      'Report concerns',
      'Preserve relevant details and use the report action available on the related traveler, trip, campaign or conversation when reporting harmful behavior.',
    ),
  ],
);

int _asInt(dynamic value, {int fallback = 0}) {
  if (value is num) return value.round();
  return int.tryParse((value ?? '').toString()) ?? fallback;
}

double _profileRankProgress(Map<String, dynamic> profile) {
  final progress = profile['nextRankProgress'];
  if (progress is! Map) return 0;
  if (progress['nextRankHidden'] == true) return 1;

  final percentage = progress['progressPercentage'];
  if (percentage is! num) return 0;
  return (percentage / 100).clamp(0.0, 1.0).toDouble();
}

Color _profileRankGaugeColor(String rankCode) =>
    switch (rankCode.trim().toUpperCase()) {
      'F' => const Color(0xFF78909C),
      'E' => const Color(0xFF43A047),
      'D' => const Color(0xFF00897B),
      'C' => const Color(0xFF1E88E5),
      'B' => const Color(0xFF7E57C2),
      'A' => const Color(0xFFFFB300),
      'S' => const Color(0xFFEF5350),
      'SS' => const Color(0xFFEC407A),
      'SSS' => const Color(0xFF26C6DA),
      'MYTHIC' => const Color(0xFFAB47BC),
      'HEROIC' => const Color(0xFFFF6D00),
      _ => _profileAmber,
    };

String _displayValue(dynamic value) {
  final text = (value ?? '').toString().trim();
  return text.isEmpty ? 'Not provided' : text;
}

String _formatPhone(dynamic value) {
  final digits = ApiService.normalizePhoneNumber((value ?? '').toString());
  if (digits.length != 10) return _displayValue(value);
  return '+977 ${digits.substring(0, 3)} ${digits.substring(3, 6)} ${digits.substring(6)}';
}

String _formatDateOfBirth(dynamic value) {
  final raw = (value ?? '').toString().trim();
  if (raw.isEmpty) return 'Not provided';
  final date = DateTime.tryParse(raw);
  if (date == null) return raw;
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
  return '${date.day} ${months[date.month - 1]} ${date.year}';
}

String _rankName(String code) => switch (code.toUpperCase()) {
      'F' => 'New Explorer',
      'E' => 'Path Finder',
      'D' => 'Trail Seeker',
      'C' => 'Trekker',
      'B' => 'Adventurer',
      'A' => 'Expedition Pro',
      'S' => 'Elite Explorer',
      'SS' => 'Master Voyager',
      'SSS' => 'Legendary Yatri',
      'MYTHIC' => 'Mythic Yatri',
      'HEROIC' => 'Heroic Yatri',
      _ => 'New Explorer',
    };
