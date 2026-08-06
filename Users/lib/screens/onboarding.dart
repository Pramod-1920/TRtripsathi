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
  final _middleController = TextEditingController();
  final _lastController = TextEditingController();
  final _emailController = TextEditingController();
  final _ageController = TextEditingController();
  final _landmarkController = TextEditingController();

  String? _selectedProvince;
  String? _selectedDistrict;
  String? _selectedPlace;

  bool _loading = false;
  bool _loadingPlaces = true;

  String? _error;

  List<dynamic> _placeHierarchy = [];

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

    final email = _emailController.text.trim();
    if (!RegExp(r'^[^\s@]+@[^\s@]+\.[^\s@]+$').hasMatch(email)) {
      setState(() {
        _loading = false;
        _error = 'Enter a valid email address';
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

    if (_landmarkController.text.trim().isEmpty) {
      setState(() {
        _loading = false;
        _error = 'A nearby landmark is required';
      });
      return;
    }

    final ageText = _ageController.text.trim();

    int? age;

    if (ageText.isEmpty) {
      setState(() {
        _loading = false;
        _error = 'Age is required';
      });
      return;
    }

    age = int.tryParse(ageText);

    if (age == null) {
      setState(() {
        _loading = false;
        _error = 'Age must be a number';
      });
      return;
    }

    if (age <= 8 || age > 120) {
      setState(() {
        _loading = false;
        _error = 'Age must be between 9 and 120';
      });
      return;
    }

    final locationParts = [
      _selectedPlace,
      _selectedDistrict,
      _selectedProvince,
    ].where((e) => e != null && e.isNotEmpty).toList();

    final updates = <String, dynamic>{
      'firstName': _firstController.text.trim(),
      'middleName': _middleController.text.trim(),
      'lastName': _lastController.text.trim(),
      'email': email,
      'location': locationParts.join(', '),
      'province': _selectedProvince,
      'district': _selectedDistrict,
      'landmark': _landmarkController.text.trim(),
      'age': age,
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
        _error = ApiService.readableError(e);
      });

      debugPrint('ONBOARDING ERROR: $e');
    } finally {
      if (mounted) {
        setState(() {
          _loading = false;
        });
      }
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
        backgroundColor: const Color(0xFF0D9488),
        foregroundColor: Colors.white,
        title: const Text('Build your explorer profile',
            style: TextStyle(fontWeight: FontWeight.w800)),
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
                    Container(
                      padding: const EdgeInsets.all(22),
                      decoration: BoxDecoration(
                        gradient: const LinearGradient(
                            colors: [Color(0xFF064E4A), Color(0xFF0D9488)]),
                        borderRadius: BorderRadius.circular(26),
                        boxShadow: const [
                          BoxShadow(
                              color: Color(0x280D9488),
                              blurRadius: 24,
                              offset: Offset(0, 12))
                        ],
                      ),
                      child: const Row(children: [
                        CircleAvatar(
                            radius: 29,
                            backgroundColor: Colors.white24,
                            child: Icon(Icons.person_pin_circle_rounded,
                                color: Colors.white, size: 34)),
                        SizedBox(width: 16),
                        Expanded(
                            child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                              Text('One last step',
                                  style: TextStyle(
                                      color: Colors.white,
                                      fontSize: 22,
                                      fontWeight: FontWeight.w900)),
                              SizedBox(height: 5),
                              Text(
                                  'Personalize your journey and unlock your explorer dashboard.',
                                  style: TextStyle(
                                      color: Colors.white70, height: 1.35)),
                            ])),
                      ]),
                    ),
                    const SizedBox(height: 30),
                    const Text('ABOUT YOU',
                        style: TextStyle(
                            fontSize: 12,
                            letterSpacing: 1.4,
                            fontWeight: FontWeight.w800,
                            color: Color(0xFF0D9488))),
                    const SizedBox(height: 12),
                    TextField(
                      controller: _firstController,
                      textInputAction: TextInputAction.next,
                      decoration: const InputDecoration(
                        labelText: 'First Name',
                        prefixIcon: Icon(Icons.person_rounded),
                      ),
                    ),
                    const SizedBox(height: 16),
                    TextField(
                      controller: _middleController,
                      textInputAction: TextInputAction.next,
                      decoration: const InputDecoration(
                        labelText: 'Middle Name (Optional)',
                        prefixIcon: Icon(Icons.person_outline_rounded),
                      ),
                    ),
                    const SizedBox(height: 16),
                    TextField(
                      controller: _lastController,
                      textInputAction: TextInputAction.next,
                      decoration: const InputDecoration(
                        labelText: 'Last Name',
                        prefixIcon: Icon(Icons.person_rounded),
                      ),
                    ),
                    const SizedBox(height: 16),
                    TextField(
                      controller: _emailController,
                      textInputAction: TextInputAction.next,
                      keyboardType: TextInputType.emailAddress,
                      decoration: const InputDecoration(
                        labelText: 'Email Address',
                        hintText: 'explorer@example.com',
                        prefixIcon: Icon(Icons.email_rounded),
                      ),
                    ),
                    const SizedBox(height: 16),
                    TextField(
                      controller: _ageController,
                      keyboardType: TextInputType.number,
                      decoration: const InputDecoration(
                        labelText: 'Age',
                        hintText: 'Required',
                        prefixIcon: Icon(Icons.cake_rounded),
                      ),
                    ),
                    const SizedBox(height: 28),
                    const Text('YOUR HOME BASE',
                        style: TextStyle(
                            fontSize: 12,
                            letterSpacing: 1.4,
                            fontWeight: FontWeight.w800,
                            color: Color(0xFF0D9488))),
                    const SizedBox(height: 12),
                    DropdownButtonFormField<String>(
                      isExpanded: true,
                      initialValue: _selectedProvince,
                      decoration: const InputDecoration(
                        labelText: 'Province',
                        prefixIcon: Icon(Icons.map_rounded),
                      ),
                      items: provinces
                          .map(
                            (province) => DropdownMenuItem(
                              value: province,
                              child: Text(
                                province,
                                maxLines: 1,
                                overflow: TextOverflow.ellipsis,
                              ),
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
                      isExpanded: true,
                      initialValue: _selectedDistrict,
                      decoration: const InputDecoration(
                        labelText: 'District',
                        prefixIcon: Icon(Icons.location_city_rounded),
                      ),
                      items: districts
                          .map(
                            (district) => DropdownMenuItem(
                              value: district,
                              child: Text(
                                district,
                                maxLines: 1,
                                overflow: TextOverflow.ellipsis,
                              ),
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
                      isExpanded: true,
                      initialValue: _selectedPlace,
                      decoration: const InputDecoration(
                        labelText: 'Place',
                        prefixIcon: Icon(Icons.place_rounded),
                      ),
                      items: places
                          .map(
                            (place) => DropdownMenuItem(
                              value: place,
                              child: Text(
                                place,
                                maxLines: 1,
                                overflow: TextOverflow.ellipsis,
                              ),
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
                      controller: _landmarkController,
                      textInputAction: TextInputAction.next,
                      decoration: const InputDecoration(
                        labelText: 'Nearby Landmark',
                        hintText: 'e.g. Near Durbar Square',
                        prefixIcon: Icon(Icons.flag_rounded),
                      ),
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
    _middleController.dispose();
    _lastController.dispose();
    _emailController.dispose();
    _ageController.dispose();
    _landmarkController.dispose();

    super.dispose();
  }
}
