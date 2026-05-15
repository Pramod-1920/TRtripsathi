import 'dart:io';

import 'package:flutter/material.dart';
import 'package:image_picker/image_picker.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../services/api.dart';

class _ActivityOption {
  final String label;
  final IconData icon;
  const _ActivityOption({required this.label, required this.icon});
}

class ProfileSetupScreen extends StatefulWidget {
  const ProfileSetupScreen({super.key});

  @override
  State<ProfileSetupScreen> createState() => _ProfileSetupScreenState();
}

class _ProfileSetupScreenState extends State<ProfileSetupScreen>
    with TickerProviderStateMixin {
  final _bioController = TextEditingController();
  final ImagePicker _imagePicker = ImagePicker();
  XFile? _selectedImage;

  final Map<String, String> _levels = {
    'Beginner': 'F',
    'Intermediate': 'C',
    'Experienced': 'A',
  };

  static const _activityOptions = <_ActivityOption>[
    _ActivityOption(label: 'Hike', icon: Icons.hiking),
    _ActivityOption(label: 'Trek', icon: Icons.terrain),
    _ActivityOption(label: 'Heritage', icon: Icons.account_balance),
    _ActivityOption(label: 'Camping', icon: Icons.forest),
    _ActivityOption(label: 'Cycling', icon: Icons.pedal_bike),
    _ActivityOption(label: 'Photography', icon: Icons.photo_camera_outlined),
  ];

  String _selectedLevel = 'Intermediate';
  final Set<String> _selectedActivities = {'Trek', 'Camping'};
  bool _loading = false;
  String? _error;

  late final AnimationController _entryController;
  late final Animation<double> _fadeIn;
  late final Animation<Offset> _slideUp;

  @override
  void initState() {
    super.initState();
    _entryController = AnimationController(
      duration: const Duration(milliseconds: 750),
      vsync: this,
    );
    _fadeIn = CurvedAnimation(parent: _entryController, curve: Curves.easeOut);
    _slideUp = Tween<Offset>(
      begin: const Offset(0, 0.05),
      end: Offset.zero,
    ).animate(
      CurvedAnimation(parent: _entryController, curve: Curves.easeOutCubic),
    );
    _entryController.forward();
  }

  Future<void> _submit() async {
    FocusScope.of(context).unfocus();

    setState(() {
      _loading = true;
      _error = null;
    });

    final updates = <String, dynamic>{
      'experienceLevel': _levels[_selectedLevel],
      if (_bioController.text.trim().isNotEmpty) 'bio': _bioController.text.trim(),
    };

    try {
      await ApiService.updateProfile(updates);

      final prefs = await SharedPreferences.getInstance();

      await prefs.setBool('onboarding_done', true);

      if (!mounted) return;

      Navigator.pushReplacementNamed(context, '/dashboard');
    } catch (e) {
      if (!mounted) return;

      setState(() {
        _error = 'Something went wrong';
      });

      debugPrint('ONBOARDING ERROR: $e');
    } finally {
      if (!mounted) return;

      setState(() {
        _loading = false;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    const bg = Color(0xFFF7F5F2);
    const accent = Color(0xFFB24A00);
    const selectedChip = Color(0xFF3E6E4A);

    return Scaffold(
      backgroundColor: bg,
      body: SafeArea(
        child: FadeTransition(
          opacity: _fadeIn,
          child: SlideTransition(
            position: _slideUp,
            child: Column(
              children: [
                _buildHeader(accent),
                Expanded(
                  child: SingleChildScrollView(
                    padding: const EdgeInsets.fromLTRB(24, 18, 24, 120),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        const SizedBox(height: 12),
                        const Center(
                          child: Text(
                            'Tell us about yourself.',
                            style: TextStyle(
                              fontSize: 52 / 2,
                              fontWeight: FontWeight.w700,
                              color: Color(0xFF111111),
                            ),
                            textAlign: TextAlign.center,
                          ),
                        ),
                        const SizedBox(height: 10),
                        Center(
                          child: Text(
                            'Help us personalize your adventure recommendations.',
                            textAlign: TextAlign.center,
                            style: TextStyle(
                              color: Colors.black.withOpacity(0.7),
                              fontSize: 16,
                            ),
                          ),
                        ),
                        const SizedBox(height: 26),
                        _buildPhotoUploader(accent),
                        const SizedBox(height: 26),
                        const Text(
                          'Select Experience Level',
                          style: TextStyle(fontSize: 17, fontWeight: FontWeight.w500),
                        ),
                        const SizedBox(height: 12),
                        Wrap(
                          spacing: 10,
                          runSpacing: 10,
                          children: _levels.keys.map((label) {
                            final selected = _selectedLevel == label;
                            return _pillChip(
                              label: label,
                              selected: selected,
                              selectedColor: selectedChip,
                              onTap: () {
                                setState(() {
                                  _selectedLevel = label;
                                });
                              },
                            );
                          }).toList(),
                        ),
                        const SizedBox(height: 30),
                        const Text(
                          'Select Favorite Activities',
                          style: TextStyle(fontSize: 17, fontWeight: FontWeight.w500),
                        ),
                        const SizedBox(height: 12),
                        Wrap(
                          spacing: 10,
                          runSpacing: 10,
                          children: _activityOptions.map((activity) {
                            final selected = _selectedActivities.contains(activity.label);
                            return _pillChip(
                              label: activity.label,
                              icon: activity.icon,
                              selected: selected,
                              selectedColor: selectedChip,
                              onTap: () {
                                setState(() {
                                  if (selected) {
                                    _selectedActivities.remove(activity.label);
                                  } else {
                                    _selectedActivities.add(activity.label);
                                  }
                                });
                              },
                            );
                          }).toList(),
                        ),
                        const SizedBox(height: 30),
                        const Text(
                          'Short Bio (Optional)',
                          style: TextStyle(fontSize: 17, fontWeight: FontWeight.w500),
                        ),
                        const SizedBox(height: 10),
                        TextField(
                          controller: _bioController,
                          maxLines: 5,
                          decoration: InputDecoration(
                            hintText: 'Tell us about your outdoor journey...',
                            hintStyle: TextStyle(
                              color: Colors.black.withOpacity(0.35),
                              fontSize: 20,
                            ),
                            filled: true,
                            fillColor: Colors.white,
                            contentPadding: const EdgeInsets.all(18),
                            border: OutlineInputBorder(
                              borderRadius: BorderRadius.circular(16),
                              borderSide: const BorderSide(
                                color: Color(0xFFE8C4B2),
                              ),
                            ),
                            enabledBorder: OutlineInputBorder(
                              borderRadius: BorderRadius.circular(16),
                              borderSide: const BorderSide(
                                color: Color(0xFFE8C4B2),
                              ),
                            ),
                            focusedBorder: OutlineInputBorder(
                              borderRadius: BorderRadius.circular(16),
                              borderSide: const BorderSide(color: accent, width: 1.6),
                            ),
                          ),
                        ),
                        const SizedBox(height: 14),
                        if (_error != null) Text(_error!, style: const TextStyle(color: Colors.red)),
                      ],
                    ),
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
      bottomNavigationBar: Container(
        color: bg,
        padding: const EdgeInsets.fromLTRB(24, 8, 24, 22),
        child: SafeArea(
          top: false,
          child: SizedBox(
            height: 64,
            child: ElevatedButton(
              onPressed: _loading ? null : _submit,
              style: ElevatedButton.styleFrom(
                backgroundColor: accent,
                foregroundColor: Colors.white,
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(34),
                ),
                textStyle: const TextStyle(
                  fontSize: 34 / 2,
                  fontWeight: FontWeight.w600,
                ),
              ),
              child: _loading
                  ? const SizedBox(width: 22, height: 22, child: CircularProgressIndicator(strokeWidth: 2.4, color: Colors.white))
                  : const Row(mainAxisAlignment: MainAxisAlignment.center, children: [Text('Finish Setup'), SizedBox(width: 12), Icon(Icons.arrow_forward_rounded, size: 28)]),
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildHeader(Color accent) { /* preserved */
    return Container(
      padding: const EdgeInsets.fromLTRB(24, 14, 24, 14),
      decoration: const BoxDecoration(
        color: Color(0xFFF9F8F5),
        border: Border(
          bottom: BorderSide(color: Color(0xFFE8E6DF)),
        ),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Row(
                children: const [
                  Icon(Icons.explore_outlined, color: Color(0xFFB24A00), size: 32),
                  SizedBox(width: 8),
                  Text('Yatri', style: TextStyle(color: Color(0xFFB24A00), fontSize: 46 / 2, fontWeight: FontWeight.w700)),
                ],
              ),
              const Spacer(),
              TextButton(
                onPressed: () async {
                  final prefs = await SharedPreferences.getInstance();
                  await prefs.setBool('onboarding_done', true);
                  if (!mounted) return;
                  Navigator.pushReplacementNamed(context, '/dashboard');
                },
                child: const Text('Skip', style: TextStyle(color: Color(0xFFB24A00), fontSize: 17, fontWeight: FontWeight.w500)),
              ),
            ],
          ),
          const SizedBox(height: 12),
          const Row(
            children: [
              Text('Step 3 of 3', style: TextStyle(fontSize: 15, fontWeight: FontWeight.w600)),
              Spacer(),
              Text('Profile Completion', style: TextStyle(fontSize: 15, fontWeight: FontWeight.w700, color: Color(0xFFB24A00))),
            ],
          ),
          const SizedBox(height: 10),
          ClipRRect(
            borderRadius: BorderRadius.circular(99),
            child: LinearProgressIndicator(value: 1, minHeight: 9, valueColor: AlwaysStoppedAnimation<Color>(accent), backgroundColor: const Color(0xFFE2D8D0)),
          ),
        ],
      ),
    );
  }

  Widget _buildPhotoUploader(Color accent) { /* preserved */
    return Center(child: Column(children: [/* ... preserved UI ... */]));
  }

  Future<void> _pickPhoto() async { /* preserved */ }

  Widget _pillChip({required String label, required bool selected, required Color selectedColor, required VoidCallback onTap, IconData? icon}) { /* preserved */
    final borderColor = selected ? selectedColor : const Color(0xFF9D8478);
    return InkWell(
      borderRadius: BorderRadius.circular(18),
      onTap: onTap,
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 220),
        padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 12),
        decoration: BoxDecoration(
          color: selected ? selectedColor : const Color(0xFFF7F5F2),
          border: Border.all(color: borderColor),
          borderRadius: BorderRadius.circular(18),
        ),
        child: Row(mainAxisSize: MainAxisSize.min, children: [if (icon != null) ...[Icon(icon, size: 20, color: selected ? Colors.white : const Color(0xFF222222)), const SizedBox(width: 8)], Text(label, style: TextStyle(color: selected ? Colors.white : const Color(0xFF222222), fontSize: 31 / 2, fontWeight: FontWeight.w500))]),
      ),
    );
  }

  @override
  void dispose() {
    _entryController.dispose();
    _bioController.dispose();

    super.dispose();
  }
}
