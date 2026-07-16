import 'package:flutter/material.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../services/api.dart';

class OnboardingScreen extends StatefulWidget {
  const OnboardingScreen({super.key});

  @override
  State<OnboardingScreen> createState() => _OnboardingScreenState();
}

class _OnboardingScreenState extends State<OnboardingScreen> {
  final _firstController = TextEditingController();
  final _lastController = TextEditingController();
  final _ageController = TextEditingController();

  String? _selectedProvince;
  String? _selectedDistrict;
  String? _selectedPlace;
  String? _experienceLevel;

  bool _loading = false;
  bool _loadingPlaces = true;

  String? _error;

  List<dynamic> _placeHierarchy = [];

  final List<String> _levels = [
    'beginner',
    'intermediate',
    'advanced',
  ];

  @override
  void initState() {
    super.initState();
    _loadPlaces();
  }

  Future<void> _loadPlaces() async {
    try {
      final places = await ApiService.getPlaceHierarchy();

      if (!mounted) return;

      setState(() {
        _placeHierarchy = places;
        _loadingPlaces = false;
      });
    } catch (e) {
      if (!mounted) return;

      setState(() {
        _loadingPlaces = false;
        _error = 'Failed to load places';
      });

      debugPrint('PLACE ERROR: $e');
    }
  }

  List<String> _getProvinces() {
    return _placeHierarchy
        .whereType<Map<String, dynamic>>()
        .map((item) => item['province'] as String?)
        .whereType<String>()
        .toList();
  }

  List<String> _getDistricts(String province) {
    final provinceItem =
        _placeHierarchy.whereType<Map<String, dynamic>>().firstWhere(
              (item) => item['province'] == province,
              orElse: () => {},
            );

    if (provinceItem.isEmpty) return [];

    final districtItems = provinceItem['districtItems'] as List<dynamic>? ?? [];

    return districtItems
        .whereType<Map<String, dynamic>>()
        .map((item) => item['district'] as String?)
        .whereType<String>()
        .toList();
  }

  List<String> _getPlaces(String province, String district) {
    final provinceItem =
        _placeHierarchy.whereType<Map<String, dynamic>>().firstWhere(
              (item) => item['province'] == province,
              orElse: () => {},
            );

    if (provinceItem.isEmpty) return [];

    final districtItems = provinceItem['districtItems'] as List<dynamic>? ?? [];

    final districtItem =
        districtItems.whereType<Map<String, dynamic>>().firstWhere(
              (item) => item['district'] == district,
              orElse: () => {},
            );

    if (districtItem.isEmpty) return [];

    final places = districtItem['places'] as List<dynamic>? ?? [];

    return places.whereType<String>().toList();
  }

  Future<void> _submit() async {
    FocusScope.of(context).unfocus();

    setState(() {
      _loading = true;
      _error = null;
    });

    if (_firstController.text.trim().isEmpty) {
      setState(() {
        _loading = false;
        _error = 'First name is required';
      });
      return;
    }

    if (_selectedProvince == null ||
        _selectedDistrict == null ||
        _selectedPlace == null) {
      setState(() {
        _loading = false;
        _error = 'Please select your location';
      });
      return;
    }

    final ageText = _ageController.text.trim();

    int? age;

    if (ageText.isNotEmpty) {
      age = int.tryParse(ageText);

      if (age == null) {
        setState(() {
          _loading = false;
          _error = 'Age must be a number';
        });
        return;
      }

      if (age <= 8) {
        setState(() {
          _loading = false;
          _error = 'Age must be greater than 8';
        });
        return;
      }
    }

    final locationParts = [
      _selectedPlace,
      _selectedDistrict,
      _selectedProvince,
    ].where((e) => e != null && e.isNotEmpty).toList();

    final updates = <String, dynamic>{
      'firstName': _firstController.text.trim(),
      'lastName': _lastController.text.trim(),
      'location': locationParts.join(', '),
      'province': _selectedProvince,
      'district': _selectedDistrict,
      if (_experienceLevel != null) 'experienceLevel': _experienceLevel,
      if (age != null) 'age': age,
    };

    try {
      await ApiService.updateProfile(updates);

      final prefs = await SharedPreferences.getInstance();

      await prefs.setBool('onboarding_done', true);

      if (!mounted) return;

      Navigator.pushReplacementNamed(context, '/profile');
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
    final provinces = _getProvinces();

    final districts = _selectedProvince != null
        ? _getDistricts(_selectedProvince!)
        : <String>[];

    final places = (_selectedProvince != null && _selectedDistrict != null)
        ? _getPlaces(
            _selectedProvince!,
            _selectedDistrict!,
          )
        : <String>[];

    return Scaffold(
      appBar: AppBar(
        title: const Text('Complete your profile'),
        centerTitle: true,
      ),
      body: _loadingPlaces
          ? const Center(
              child: CircularProgressIndicator(),
            )
          : SafeArea(
              child: SingleChildScrollView(
                padding: const EdgeInsets.all(20),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    const SizedBox(height: 10),
                    const Text(
                      'Welcome to Yatri',
                      style: TextStyle(
                        fontSize: 28,
                        fontWeight: FontWeight.bold,
                      ),
                    ),
                    const SizedBox(height: 8),
                    Text(
                      'Complete your profile to continue',
                      style: TextStyle(
                        color: Colors.grey.shade600,
                      ),
                    ),
                    const SizedBox(height: 30),
                    TextField(
                      controller: _firstController,
                      textInputAction: TextInputAction.next,
                      decoration: const InputDecoration(
                        labelText: 'First Name',
                        border: OutlineInputBorder(),
                      ),
                    ),
                    const SizedBox(height: 16),
                    TextField(
                      controller: _lastController,
                      textInputAction: TextInputAction.next,
                      decoration: const InputDecoration(
                        labelText: 'Last Name',
                        border: OutlineInputBorder(),
                      ),
                    ),
                    const SizedBox(height: 16),
                    DropdownButtonFormField<String>(
                      initialValue: _selectedProvince,
                      decoration: const InputDecoration(
                        labelText: 'Province',
                        border: OutlineInputBorder(),
                      ),
                      items: provinces
                          .map(
                            (province) => DropdownMenuItem(
                              value: province,
                              child: Text(province),
                            ),
                          )
                          .toList(),
                      onChanged: (value) {
                        setState(() {
                          _selectedProvince = value;
                          _selectedDistrict = null;
                          _selectedPlace = null;
                        });
                      },
                    ),
                    const SizedBox(height: 16),
                    DropdownButtonFormField<String>(
                      initialValue: _selectedDistrict,
                      decoration: const InputDecoration(
                        labelText: 'District',
                        border: OutlineInputBorder(),
                      ),
                      items: districts
                          .map(
                            (district) => DropdownMenuItem(
                              value: district,
                              child: Text(district),
                            ),
                          )
                          .toList(),
                      onChanged: _selectedProvince == null
                          ? null
                          : (value) {
                              setState(() {
                                _selectedDistrict = value;
                                _selectedPlace = null;
                              });
                            },
                    ),
                    const SizedBox(height: 16),
                    DropdownButtonFormField<String>(
                      initialValue: _selectedPlace,
                      decoration: const InputDecoration(
                        labelText: 'Place',
                        border: OutlineInputBorder(),
                      ),
                      items: places
                          .map(
                            (place) => DropdownMenuItem(
                              value: place,
                              child: Text(place),
                            ),
                          )
                          .toList(),
                      onChanged: (_selectedProvince == null ||
                              _selectedDistrict == null)
                          ? null
                          : (value) {
                              setState(() {
                                _selectedPlace = value;
                              });
                            },
                    ),
                    const SizedBox(height: 16),
                    TextField(
                      controller: _ageController,
                      keyboardType: TextInputType.number,
                      decoration: const InputDecoration(
                        labelText: 'Age (Optional)',
                        border: OutlineInputBorder(),
                      ),
                    ),
                    const SizedBox(height: 16),
                    DropdownButtonFormField<String>(
                      initialValue: _experienceLevel,
                      decoration: const InputDecoration(
                        labelText: 'Experience Level',
                        border: OutlineInputBorder(),
                      ),
                      items: _levels
                          .map(
                            (level) => DropdownMenuItem(
                              value: level,
                              child: Text(level),
                            ),
                          )
                          .toList(),
                      onChanged: (value) {
                        setState(() {
                          _experienceLevel = value;
                        });
                      },
                    ),
                    const SizedBox(height: 24),
                    if (_error != null)
                      Padding(
                        padding: const EdgeInsets.only(bottom: 16),
                        child: Text(
                          _error!,
                          style: const TextStyle(
                            color: Colors.red,
                          ),
                        ),
                      ),
                    SizedBox(
                      height: 55,
                      child: ElevatedButton(
                        onPressed: _loading ? null : _submit,
                        child: _loading
                            ? const CircularProgressIndicator()
                            : const Text(
                                'Save and Continue',
                              ),
                      ),
                    ),
                  ],
                ),
              ),
            ),
    );
  }

  @override
  void dispose() {
    _firstController.dispose();
    _lastController.dispose();
    _ageController.dispose();

    super.dispose();
  }
}
