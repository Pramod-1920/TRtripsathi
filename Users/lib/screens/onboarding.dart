import 'package:flutter/material.dart';
import '../services/api.dart';

class OnboardingScreen extends StatefulWidget {
  const OnboardingScreen({Key? key}) : super(key: key);

  @override
  _OnboardingScreenState createState() => _OnboardingScreenState();
}

class _OnboardingScreenState extends State<OnboardingScreen> {
  final _firstController = TextEditingController();
  final _lastController = TextEditingController();
  String? _selectedProvince;
  String? _selectedDistrict;
  String? _selectedPlace;
  String? _experienceLevel;
  bool _loading = false;
  String? _error;
  List<dynamic> _placeHierarchy = [];
  bool _loadingPlaces = true;

  final List<String> _levels = ['beginner', 'intermediate', 'advanced'];
  final _ageController = TextEditingController();

  @override
  void initState() {
    super.initState();
    _loadPlaces();
  }

  Future<void> _loadPlaces() async {
    try {
      final places = await ApiService.getPlaceHierarchy();
      setState(() {
        _placeHierarchy = places;
        _loadingPlaces = false;
      });
    } catch (e) {
      setState(() {
        _loadingPlaces = false;
        _error = 'Failed to load places: $e';
      });
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
    final provinceItem = _placeHierarchy
        .whereType<Map<String, dynamic>>()
        .firstWhere((item) => item['province'] == province, orElse: () => {});

    if (provinceItem.isEmpty) return [];

    final districtItems = provinceItem['districtItems'] as List<dynamic>? ?? [];
    return districtItems
        .whereType<Map<String, dynamic>>()
        .map((item) => item['district'] as String?)
        .whereType<String>()
        .toList();
  }

  List<String> _getPlaces(String province, String district) {
    final provinceItem = _placeHierarchy
        .whereType<Map<String, dynamic>>()
        .firstWhere((item) => item['province'] == province, orElse: () => {});

    if (provinceItem.isEmpty) return [];

    final districtItems = provinceItem['districtItems'] as List<dynamic>? ?? [];
    final districtItem = districtItems
        .whereType<Map<String, dynamic>>()
        .firstWhere((item) => item['district'] == district, orElse: () => {});

    if (districtItem.isEmpty) return [];

    final places = districtItem['places'] as List<dynamic>? ?? [];
    return places.whereType<String>().toList();
  }

  @override
  Widget build(BuildContext context) {
    final provinces = _getProvinces();
    final districts = _selectedProvince != null ? _getDistricts(_selectedProvince!) : [];
    final places = (_selectedProvince != null && _selectedDistrict != null)
        ? _getPlaces(_selectedProvince!, _selectedDistrict!)
        : [];

    return Scaffold(
      appBar: AppBar(title: const Text('Complete your profile')),
      body: _loadingPlaces
          ? const Center(child: CircularProgressIndicator())
          : SingleChildScrollView(
              padding: const EdgeInsets.all(16.0),
              child: Column(
                children: [
                  TextField(
                    controller: _firstController,
                    decoration: const InputDecoration(labelText: 'First name'),
                  ),
                  const SizedBox(height: 12),
                  TextField(
                    controller: _lastController,
                    decoration: const InputDecoration(labelText: 'Last name'),
                  ),
                  const SizedBox(height: 12),
                  // Province Dropdown
                  DropdownButtonFormField<String>(
                    value: _selectedProvince,
                    items: provinces
                        .map((p) => DropdownMenuItem(value: p, child: Text(p)))
                        .toList(),
                    onChanged: (value) {
                      setState(() {
                        _selectedProvince = value;
                        _selectedDistrict = null;
                        _selectedPlace = null;
                      });
                    },
                    decoration: const InputDecoration(
                      labelText: 'Province',
                      hintText: 'Select province',
                    ),
                  ),
                  const SizedBox(height: 12),
                  // District Dropdown
                  DropdownButtonFormField<String>(
                    value: _selectedDistrict,
                    items: districts
                        .map((d) => DropdownMenuItem(value: d, child: Text(d)))
                        .toList(),
                    onChanged: _selectedProvince != null
                        ? (value) {
                            setState(() {
                              _selectedDistrict = value;
                              _selectedPlace = null;
                            });
                          }
                        : null,
                    decoration: InputDecoration(
                      labelText: 'District',
                      hintText: _selectedProvince == null ? 'Select province first' : 'Select district',
                    ),
                  ),
                  const SizedBox(height: 12),
                  // Place Dropdown
                  DropdownButtonFormField<String>(
                    value: _selectedPlace,
                    items: places
                        .map((p) => DropdownMenuItem(value: p, child: Text(p)))
                        .toList(),
                    onChanged: (_selectedProvince != null && _selectedDistrict != null)
                        ? (value) {
                            setState(() {
                              _selectedPlace = value;
                            });
                          }
                        : null,
                    decoration: InputDecoration(
                      labelText: 'Place (Famous Location)',
                      hintText: _selectedDistrict == null ? 'Select district first' : 'Select place',
                    ),
                  ),
                  const SizedBox(height: 12),
                  TextField(
                    controller: _ageController,
                    decoration: const InputDecoration(labelText: 'Age (optional, must be > 8)'),
                    keyboardType: TextInputType.number,
                  ),
                  const SizedBox(height: 12),
                  DropdownButtonFormField<String>(
                    initialValue: _experienceLevel,
                    items: _levels.map((l) => DropdownMenuItem(value: l, child: Text(l))).toList(),
                    onChanged: (v) => setState(() => _experienceLevel = v),
                    decoration: const InputDecoration(labelText: 'Experience level'),
                  ),
                  const SizedBox(height: 20),
                  if (_error != null) Text(_error!, style: const TextStyle(color: Colors.red)),
                  ElevatedButton(
                    onPressed: _loading ? null : _submit,
                    child: _loading ? const CircularProgressIndicator() : const Text('Save and continue'),
                  ),
                ],
              ),
            ),
    );
  }

  Future<void> _submit() async {
    setState(() {
      _loading = true;
      _error = null;
    });

    // Build location string from selections
    final locationParts = [
      _selectedPlace,
      _selectedDistrict,
      _selectedProvince,
    ].where((p) => p != null && p.isNotEmpty).toList();

    final updates = <String, dynamic>{
      'firstName': _firstController.text.trim(),
      'lastName': _lastController.text.trim(),
      'location': locationParts.join(', '),
      'province': _selectedProvince,
      'district': _selectedDistrict,
      if (_experienceLevel != null) 'experienceLevel': _experienceLevel,
    };

    // Age validation (optional)
    final ageText = _ageController.text.trim();
    if (ageText.isNotEmpty) {
      final age = int.tryParse(ageText);
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
      updates['age'] = age;
    }

    try {
      await ApiService.updateProfile(updates);
      if (!mounted) return;
      Navigator.of(context).pushReplacementNamed('/profile');
    } catch (e) {
      setState(() {
        _error = e.toString();
      });
    } finally {
      setState(() {
        _loading = false;
      });
    }
  }

  @override
  void dispose() {
    _firstController.dispose();
    _lastController.dispose();
    _ageController.dispose();
    super.dispose();
  }
}
