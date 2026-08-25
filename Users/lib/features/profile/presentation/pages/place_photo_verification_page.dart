import 'dart:io';

import 'package:flutter/material.dart';
import 'package:geolocator/geolocator.dart';
import 'package:image_picker/image_picker.dart';

import 'package:trtripsathi_mobile/core/networking/api_service.dart';
import 'package:trtripsathi_mobile/core/theme/app_theme.dart';

class PlacePhotoVerificationPage extends StatefulWidget {
  const PlacePhotoVerificationPage({super.key});

  @override
  State<PlacePhotoVerificationPage> createState() =>
      _PlacePhotoVerificationPageState();
}

class _PlacePhotoVerificationPageState
    extends State<PlacePhotoVerificationPage> {
  final _formKey = GlobalKey<FormState>();
  final _titleController = TextEditingController();
  final _addressController = TextEditingController();
  final _placeController = TextEditingController();
  final _picker = ImagePicker();

  List<_PlaceOption> _places = const [];
  List<String> _provinceOptions = const [];
  Map<String, List<String>> _districtOptions = const {};
  Map<String, List<String>> _municipalityOptions = const {};
  List<String> _categories = const [];
  _PlaceOption? _selectedPlace;
  String? _selectedProvince;
  String? _selectedDistrict;
  String? _selectedMunicipality;
  File? _placePhoto;
  File? _travelerPhoto;
  String? _category;
  Position? _position;
  bool _loadingPlaces = true;
  bool _loadingCategories = true;
  bool _locating = false;
  bool _submitting = false;
  final bool _showLegacyLocationFields = false;
  String? _catalogError;
  String? _categoryError;
  List<Map<String, dynamic>> _requests = const [];

  @override
  void initState() {
    super.initState();
    _loadPlaces();
    _loadCampaignCategories();
    _loadRequests();
  }

  Future<void> _loadCampaignCategories() async {
    if (mounted) {
      setState(() {
        _loadingCategories = true;
        _categoryError = null;
      });
    }
    try {
      final rawItems = await ApiService.getActivityHierarchy();
      final categories = rawItems
          .whereType<Map>()
          .map((item) => (item['name'] ?? '').toString().trim())
          .where((name) => name.isNotEmpty)
          .toSet()
          .toList()
        ..sort((a, b) => a.toLowerCase().compareTo(b.toLowerCase()));
      if (!mounted) return;
      setState(() {
        _categories = categories;
        _loadingCategories = false;
        _categoryError = categories.isEmpty
            ? 'No campaign categories are available. Ask an admin to add them.'
            : null;
        if (_category != null && !categories.contains(_category)) {
          _category = null;
        }
      });
    } catch (error) {
      if (!mounted) return;
      setState(() {
        _loadingCategories = false;
        _categoryError = ApiService.readableError(error);
      });
    }
  }

  Future<void> _loadRequests() async {
    try {
      final profile = await ApiService.getProfile(forceRefresh: true);
      final raw = profile['photoVerificationRequests'] as List? ?? const [];
      if (mounted) {
        setState(() => _requests = raw
            .whereType<Map>()
            .map((item) => Map<String, dynamic>.from(item))
            .toList()
            .reversed
            .take(5)
            .toList());
      }
    } catch (_) {}
  }

  Future<void> _appeal(Map<String, dynamic> request) async {
    final controller = TextEditingController();
    final note = await showDialog<String>(
      context: context,
      builder: (dialogContext) => AlertDialog(
        title: const Text('Appeal this decision'),
        content: TextField(
          controller: controller,
          minLines: 3,
          maxLines: 5,
          maxLength: 500,
          decoration: const InputDecoration(
            hintText:
                'Explain what the reviewer may have missed (20+ characters)',
          ),
        ),
        actions: [
          TextButton(
              onPressed: () => Navigator.pop(dialogContext),
              child: const Text('Cancel')),
          FilledButton(
              onPressed: () =>
                  Navigator.pop(dialogContext, controller.text.trim()),
              child: const Text('Submit appeal')),
        ],
      ),
    );
    controller.dispose();
    if (note == null || note.length < 20) {
      if (note != null) {
        _showMessage('Please explain your appeal in at least 20 characters.');
      }
      return;
    }
    try {
      await ApiService.appealPhotoVerification(
        requestCode: request['requestCode'].toString(),
        appealNote: note,
      );
      await _loadRequests();
      if (mounted) _showMessage('Appeal sent for a second review.');
    } catch (error) {
      if (mounted) _showMessage(ApiService.readableError(error));
    }
  }

  @override
  void dispose() {
    _titleController.dispose();
    _addressController.dispose();
    _placeController.dispose();
    super.dispose();
  }

  Future<void> _loadPlaces() async {
    try {
      final rawItems = await ApiService.getPlaceHierarchy();
      final options = <_PlaceOption>[];
      final provinces = <String>[];
      final districtsByProvince = <String, List<String>>{};
      final municipalitiesByDistrict = <String, List<String>>{};
      for (final rawProvince in rawItems.whereType<Map>()) {
        final province = (rawProvince['province'] ?? '').toString().trim();
        if (province.isEmpty) continue;
        provinces.add(province);
        final provinceDistricts = <String>[];
        final rawDistrictItems =
            (rawProvince['districtItems'] as List? ?? const [])
                .whereType<Map>()
                .toList();
        for (final rawDistrict in rawDistrictItems) {
          final district = (rawDistrict['district'] ?? '').toString().trim();
          if (district.isEmpty) continue;
          provinceDistricts.add(district);
          final municipalityNames = <String>[];
          final municipalityItems =
              (rawDistrict['municipalityItems'] as List? ?? const [])
                  .whereType<Map>()
                  .toList();
          if (municipalityItems.isNotEmpty) {
            for (final rawMunicipality in municipalityItems) {
              final municipality =
                  (rawMunicipality['municipality'] ?? '').toString().trim();
              if (municipality.isEmpty) continue;
              municipalityNames.add(municipality);
              for (final rawPlace
                  in (rawMunicipality['places'] as List? ?? const [])
                      .whereType<Map>()) {
                final place = (rawPlace['place'] ?? '').toString().trim();
                if (place.isNotEmpty) {
                  options.add(_PlaceOption(
                    province: province,
                    district: district,
                    municipality: municipality,
                    place: place,
                  ));
                }
              }
            }
          } else {
            // Backward compatibility with servers that only return flat places.
            for (final rawPlace
                in (rawDistrict['placeItems'] as List? ?? const [])
                    .whereType<Map>()) {
              final place = (rawPlace['place'] ?? '').toString().trim();
              final municipality =
                  (rawPlace['municipality'] ?? '').toString().trim();
              if (municipality.isNotEmpty) municipalityNames.add(municipality);
              if (municipality.isNotEmpty && place.isNotEmpty) {
                options.add(_PlaceOption(
                  province: province,
                  district: district,
                  municipality: municipality,
                  place: place,
                ));
              }
            }
            municipalityNames.addAll(
              (rawDistrict['municipalities'] as List? ?? const [])
                  .map((item) => item.toString().trim())
                  .where((item) => item.isNotEmpty),
            );
          }
          municipalitiesByDistrict['$province\u0000$district'] =
              _uniqueSorted(municipalityNames);
        }
        // Older catalogs may expose district names without districtItems.
        provinceDistricts.addAll(
          (rawProvince['districts'] as List? ?? const [])
              .map((item) => item.toString().trim())
              .where((item) => item.isNotEmpty),
        );
        districtsByProvince[province] = _uniqueSorted(provinceDistricts);
      }
      options.sort((a, b) => a.place.compareTo(b.place));
      if (!mounted) return;
      setState(() {
        _places = options;
        _provinceOptions = _uniqueSorted(provinces);
        _districtOptions = districtsByProvince;
        _municipalityOptions = municipalitiesByDistrict;
        _loadingPlaces = false;
        _catalogError = provinces.isEmpty
            ? 'No locations are available yet. Ask an admin to add the place catalog.'
            : null;
      });
    } catch (error) {
      if (!mounted) return;
      setState(() {
        _loadingPlaces = false;
        _catalogError = ApiService.readableError(error);
      });
    }
  }

  Future<void> _choosePhoto(ImageSource source,
      {required bool traveler}) async {
    final picked = await _picker.pickImage(
      source: source,
      imageQuality: 86,
      maxWidth: 2048,
    );
    if (picked != null && mounted) {
      setState(() {
        if (traveler) {
          _travelerPhoto = File(picked.path);
        } else {
          _placePhoto = File(picked.path);
        }
      });
    }
  }

  Future<void> _captureLocation() async {
    if (_locating) return;
    setState(() => _locating = true);
    try {
      if (!await Geolocator.isLocationServiceEnabled()) {
        throw Exception('Turn on location services and try again');
      }
      var permission = await Geolocator.checkPermission();
      if (permission == LocationPermission.denied) {
        permission = await Geolocator.requestPermission();
      }
      if (permission == LocationPermission.denied ||
          permission == LocationPermission.deniedForever) {
        throw Exception('Location permission was not granted');
      }
      final position = await Geolocator.getCurrentPosition(
        locationSettings: const LocationSettings(
          accuracy: LocationAccuracy.high,
          timeLimit: Duration(seconds: 15),
        ),
      );
      if (!mounted) return;
      setState(() => _position = position);
    } catch (error) {
      if (mounted) _showMessage(ApiService.readableError(error));
    } finally {
      if (mounted) setState(() => _locating = false);
    }
  }

  Future<void> _submit() async {
    if (_submitting || !_formKey.currentState!.validate()) return;
    if (_placePhoto == null) {
      _showMessage('Add a clear photo of the place.');
      return;
    }
    if (_travelerPhoto == null) {
      _showMessage('Add a photo showing you with the place scenery.');
      return;
    }
    if (_selectedPlace == null) {
      _showMessage('Choose a place from the verified list.');
      return;
    }
    if (_position == null) {
      _showMessage('Capture your current GPS location before submitting.');
      return;
    }
    setState(() => _submitting = true);
    try {
      final urls = await Future.wait([
        ApiService.uploadPlaceVerificationImage(_placePhoto!),
        ApiService.uploadPlaceVerificationImage(_travelerPhoto!),
      ]);
      await ApiService.submitPlacePhotoVerification(
        photoUrl: urls[0],
        travelerPhotoUrl: urls[1],
        title: _titleController.text,
        category: _category!,
        province: _selectedPlace!.province,
        district: _selectedPlace!.district,
        municipality: _selectedPlace!.municipality,
        place: _selectedPlace!.place,
        address: [
          _selectedPlace!.place,
          _selectedPlace!.municipality,
          _selectedPlace!.district,
          _selectedPlace!.province,
        ].join(', '),
        latitude: _position!.latitude,
        longitude: _position!.longitude,
        locationAccuracyMeters: _position!.accuracy,
        locationCapturedAt: _position!.timestamp,
      );
      if (!mounted) return;
      await showDialog<void>(
        context: context,
        builder: (_) => AlertDialog(
          icon: const Icon(Icons.hourglass_top_rounded,
              color: AppColors.goldDark),
          title: const Text('Sent for verification'),
          content: Text(
            'An admin will review your photo and location. Once approved, '
            '${_selectedPlace!.district} will turn green on your map and 40 XP will be awarded once for this place.',
          ),
          actions: [
            FilledButton(
              onPressed: () => Navigator.pop(context),
              child: const Text('Done'),
            ),
          ],
        ),
      );
      if (mounted) Navigator.pop(context, true);
    } catch (error) {
      if (mounted) _showMessage(ApiService.readableError(error));
    } finally {
      if (mounted) setState(() => _submitting = false);
    }
  }

  void _showMessage(String message) {
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(content: Text(message), behavior: SnackBarBehavior.floating),
    );
  }

  List<String> get _provinces => _provinceOptions;

  List<String> get _districts =>
      _districtOptions[_selectedProvince] ?? const [];

  List<String> get _municipalities =>
      _municipalityOptions[
          '${_selectedProvince ?? ''}\u0000${_selectedDistrict ?? ''}'] ??
      const [];

  List<_PlaceOption> get _filteredPlaces => _places
      .where(
        (item) =>
            item.province == _selectedProvince &&
            item.district == _selectedDistrict &&
            item.municipality == _selectedMunicipality,
      )
      .toList(growable: false);

  List<String> _uniqueSorted(Iterable<String> values) {
    final result = values.toSet().toList();
    result.sort();
    return result;
  }

  @override
  Widget build(BuildContext context) => Scaffold(
        backgroundColor: AppColors.canvas,
        appBar: AppBar(title: const Text('Verify a place')),
        body: SafeArea(
          child: Form(
            key: _formKey,
            child: ListView(
              padding: const EdgeInsets.fromLTRB(18, 18, 18, 32),
              children: [
                const Text(
                  'Turn real visits into map progress',
                  style: TextStyle(
                    color: AppColors.ink,
                    fontSize: 24,
                    fontWeight: FontWeight.w900,
                  ),
                ),
                const SizedBox(height: 7),
                const Text(
                  'Add a title and two photos, then select the province, district, municipality and place from TripSathi.',
                  style: TextStyle(color: AppColors.muted, height: 1.45),
                ),
                const SizedBox(height: 20),
                TextFormField(
                  controller: _titleController,
                  maxLength: 120,
                  decoration: const InputDecoration(
                    labelText: 'Visit title',
                    hintText: 'Morning visit to Pashupatinath',
                    prefixIcon: Icon(Icons.title_rounded),
                  ),
                  validator: (value) => (value ?? '').trim().length < 3
                      ? 'Enter a short title'
                      : null,
                ),
                const SizedBox(height: 0),
                _PhotoPicker(
                  title: '1. Place photo',
                  instruction: 'Show the place and surrounding scenery clearly',
                  photo: _placePhoto,
                  onCamera: () =>
                      _choosePhoto(ImageSource.camera, traveler: false),
                  onGallery: () =>
                      _choosePhoto(ImageSource.gallery, traveler: false),
                ),
                const SizedBox(height: 14),
                _PhotoPicker(
                  title: '2. You at the place',
                  instruction:
                      'Your face and the place scenery must both be visible',
                  photo: _travelerPhoto,
                  onCamera: () =>
                      _choosePhoto(ImageSource.camera, traveler: true),
                  onGallery: () =>
                      _choosePhoto(ImageSource.gallery, traveler: true),
                ),
                const SizedBox(height: 20),
                if (_loadingPlaces)
                  const LinearProgressIndicator(minHeight: 2)
                else if (_catalogError != null)
                  _InlineNotice(message: _catalogError!, onRetry: _loadPlaces)
                else if (_showLegacyLocationFields)
                  Autocomplete<_PlaceOption>(
                    displayStringForOption: (option) => option.place,
                    optionsBuilder: (value) {
                      final query = value.text.trim().toLowerCase();
                      if (query.isEmpty) {
                        return const Iterable<_PlaceOption>.empty();
                      }
                      return _places.where((option) =>
                          option.place.toLowerCase().contains(query) ||
                          option.municipality.toLowerCase().contains(query) ||
                          option.district.toLowerCase().contains(query));
                    },
                    onSelected: (option) => setState(() {
                      _selectedPlace = option;
                      _placeController.text = option.place;
                    }),
                    fieldViewBuilder:
                        (context, controller, focusNode, onSubmit) {
                      if (_placeController.text.isNotEmpty &&
                          controller.text.isEmpty) {
                        controller.text = _placeController.text;
                      }
                      return TextFormField(
                        controller: controller,
                        focusNode: focusNode,
                        decoration: const InputDecoration(
                          labelText: 'Search place',
                          hintText: 'Pashupatinath Temple',
                          prefixIcon: Icon(Icons.search_rounded),
                          helperText:
                              'Select a result so the district is filled correctly',
                        ),
                        onChanged: (_) {
                          if (_selectedPlace != null &&
                              controller.text != _selectedPlace!.place) {
                            setState(() => _selectedPlace = null);
                          }
                        },
                        validator: (_) => _selectedPlace == null
                            ? 'Select a place from the list'
                            : null,
                      );
                    },
                    optionsViewBuilder: (context, onSelected, options) => Align(
                      alignment: Alignment.topLeft,
                      child: Material(
                        elevation: 8,
                        borderRadius: BorderRadius.circular(14),
                        child: ConstrainedBox(
                          constraints: const BoxConstraints(
                              maxHeight: 250, maxWidth: 520),
                          child: ListView.builder(
                            padding: const EdgeInsets.symmetric(vertical: 6),
                            shrinkWrap: true,
                            itemCount: options.length,
                            itemBuilder: (_, index) {
                              final option = options.elementAt(index);
                              return ListTile(
                                title: Text(option.place),
                                subtitle: Text(
                                  '${option.municipality} • ${option.district} • ${option.province}',
                                ),
                                onTap: () => onSelected(option),
                              );
                            },
                          ),
                        ),
                      ),
                    ),
                  ),
                if (!_loadingPlaces && _catalogError == null) ...[
                  _LocationDropdown(
                    key: ValueKey('province-${_provinceOptions.join('|')}'),
                    label: 'Province',
                    value: _selectedProvince,
                    values: _provinces,
                    icon: Icons.map_outlined,
                    onChanged: (value) => setState(() {
                      _selectedProvince = value;
                      _selectedDistrict = null;
                      _selectedMunicipality = null;
                      _selectedPlace = null;
                    }),
                  ),
                  const SizedBox(height: 12),
                  _LocationDropdown(
                    key: ValueKey('district-${_selectedProvince ?? ''}'),
                    label: 'District',
                    value: _selectedDistrict,
                    values: _districts,
                    icon: Icons.signpost_outlined,
                    onChanged: _selectedProvince == null
                        ? null
                        : (value) => setState(() {
                              _selectedDistrict = value;
                              _selectedMunicipality = null;
                              _selectedPlace = null;
                            }),
                  ),
                  const SizedBox(height: 12),
                  _LocationDropdown(
                    key: ValueKey(
                      'municipality-${_selectedProvince ?? ''}-${_selectedDistrict ?? ''}',
                    ),
                    label: 'Municipality',
                    value: _selectedMunicipality,
                    values: _municipalities,
                    icon: Icons.location_city_outlined,
                    onChanged: _selectedDistrict == null
                        ? null
                        : (value) => setState(() {
                              _selectedMunicipality = value;
                              _selectedPlace = null;
                            }),
                  ),
                  const SizedBox(height: 12),
                  DropdownButtonFormField<_PlaceOption>(
                    key: ValueKey(
                      'place-${_selectedProvince ?? ''}-${_selectedDistrict ?? ''}-${_selectedMunicipality ?? ''}',
                    ),
                    value: _filteredPlaces.contains(_selectedPlace)
                        ? _selectedPlace
                        : null,
                    isExpanded: true,
                    decoration: const InputDecoration(
                      labelText: 'Visited place',
                      prefixIcon: Icon(Icons.place_outlined),
                    ),
                    items: _filteredPlaces
                        .map((item) => DropdownMenuItem(
                              value: item,
                              child: Text(item.place,
                                  overflow: TextOverflow.ellipsis),
                            ))
                        .toList(),
                    onChanged: _selectedMunicipality == null
                        ? null
                        : (value) => setState(() {
                              _selectedPlace = value;
                            }),
                    validator: (value) =>
                        value == null ? 'Choose the visited place' : null,
                  ),
                  const SizedBox(height: 12),
                  DropdownButtonFormField<String>(
                    value: _category,
                    decoration: const InputDecoration(
                      labelText: 'Campaign category',
                      prefixIcon: Icon(Icons.category_outlined),
                    ),
                    items: _categories
                        .map((category) => DropdownMenuItem(
                              value: category,
                              child: Text(category),
                            ))
                        .toList(),
                    onChanged: _loadingCategories || _categoryError != null
                        ? null
                        : (value) => setState(() => _category = value),
                    validator: (value) => value == null
                        ? _loadingCategories
                            ? 'Campaign categories are loading'
                            : _categories.isEmpty
                                ? 'Ask an admin to add campaign categories'
                                : 'Choose a campaign category'
                        : null,
                  ),
                  if (_loadingCategories)
                    const LinearProgressIndicator(minHeight: 2)
                  else if (_categoryError != null) ...[
                    const SizedBox(height: 8),
                    _InlineNotice(
                      message: _categoryError!,
                      onRetry: _loadCampaignCategories,
                    ),
                  ],
                ],
                if (_selectedPlace != null) ...[
                  const SizedBox(height: 12),
                  Container(
                    padding: const EdgeInsets.all(14),
                    decoration: BoxDecoration(
                      color: const Color(0xFF159455).withValues(alpha: .09),
                      borderRadius: BorderRadius.circular(14),
                    ),
                    child: Row(
                      children: [
                        const Icon(Icons.auto_awesome_rounded,
                            color: Color(0xFF159455)),
                        const SizedBox(width: 10),
                        Expanded(
                            child: Text(
                          '${_selectedPlace!.municipality} • ${_selectedPlace!.district} • ${_selectedPlace!.province}',
                          style: const TextStyle(fontWeight: FontWeight.w800),
                        )),
                      ],
                    ),
                  ),
                ],
                const SizedBox(height: 16),
                if (_showLegacyLocationFields)
                  TextFormField(
                    controller: _addressController,
                    maxLength: 240,
                    minLines: 2,
                    maxLines: 3,
                    decoration: const InputDecoration(
                      labelText: 'Location address',
                      hintText: 'Gate, road, ward or nearby landmark',
                      prefixIcon: Icon(Icons.location_on_outlined),
                    ),
                    validator: (value) => (value ?? '').trim().length < 5
                        ? 'Enter a useful address'
                        : null,
                  ),
                const SizedBox(height: 6),
                OutlinedButton.icon(
                  onPressed: _locating ? null : _captureLocation,
                  icon: _locating
                      ? const SizedBox.square(
                          dimension: 17,
                          child: CircularProgressIndicator(strokeWidth: 2),
                        )
                      : Icon(_position == null
                          ? Icons.my_location_rounded
                          : Icons.check_circle_rounded),
                  label: Text(_position == null
                      ? 'Add current GPS location (required)'
                      : 'GPS location added'),
                ),
                const SizedBox(height: 22),
                FilledButton.icon(
                  onPressed: _submitting ? null : _submit,
                  icon: _submitting
                      ? const SizedBox.square(
                          dimension: 18,
                          child: CircularProgressIndicator(
                            strokeWidth: 2,
                            color: Colors.white,
                          ),
                        )
                      : const Icon(Icons.verified_outlined),
                  label:
                      Text(_submitting ? 'Sending…' : 'Send for verification'),
                  style: FilledButton.styleFrom(
                    padding: const EdgeInsets.symmetric(vertical: 15),
                  ),
                ),
                const SizedBox(height: 12),
                const Text(
                  'Only approved photos award XP and update map progress. False locations or unrelated photos can be rejected.',
                  textAlign: TextAlign.center,
                  style: TextStyle(
                      color: AppColors.muted, fontSize: 12, height: 1.35),
                ),
                if (_requests.isNotEmpty) ...[
                  const SizedBox(height: 26),
                  Text('Recent requests',
                      style: Theme.of(context)
                          .textTheme
                          .titleMedium
                          ?.copyWith(fontWeight: FontWeight.w800)),
                  const SizedBox(height: 8),
                  ..._requests.map((request) {
                    final status = request['status']?.toString() ?? 'pending';
                    final canAppeal = status == 'rejected' &&
                        (request['appealCount'] as num? ?? 0) < 1;
                    return Card(
                      child: ListTile(
                        title: Text(request['title']?.toString() ??
                            request['place']?.toString() ??
                            'Place verification'),
                        subtitle: Text([
                          status.toUpperCase(),
                          if (request['reviewNote']
                                  ?.toString()
                                  .trim()
                                  .isNotEmpty ==
                              true)
                            request['reviewNote'].toString(),
                        ].join(' · ')),
                        trailing: canAppeal
                            ? TextButton(
                                onPressed: () => _appeal(request),
                                child: const Text('Appeal'))
                            : null,
                      ),
                    );
                  }),
                ],
              ],
            ),
          ),
        ),
      );
}

class _LocationDropdown extends StatelessWidget {
  const _LocationDropdown({
    super.key,
    required this.label,
    required this.value,
    required this.values,
    required this.icon,
    required this.onChanged,
  });

  final String label;
  final String? value;
  final List<String> values;
  final IconData icon;
  final ValueChanged<String?>? onChanged;

  @override
  Widget build(BuildContext context) => DropdownButtonFormField<String>(
        value: values.contains(value) ? value : null,
        isExpanded: true,
        decoration: InputDecoration(
          labelText: label,
          prefixIcon: Icon(icon),
        ),
        items: values
            .map(
              (item) => DropdownMenuItem(
                value: item,
                child: Text(item, overflow: TextOverflow.ellipsis),
              ),
            )
            .toList(),
        onChanged: onChanged,
        validator: (selected) => selected == null ? 'Choose $label' : null,
      );
}

class _PhotoPicker extends StatelessWidget {
  const _PhotoPicker({
    required this.title,
    required this.instruction,
    required this.photo,
    required this.onCamera,
    required this.onGallery,
  });

  final String title;
  final String instruction;
  final File? photo;
  final VoidCallback onCamera;
  final VoidCallback onGallery;

  @override
  Widget build(BuildContext context) => Container(
        height: 220,
        clipBehavior: Clip.antiAlias,
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(20),
          border: Border.all(color: AppColors.muted.withValues(alpha: .2)),
        ),
        child: photo == null
            ? Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  const Icon(Icons.add_a_photo_outlined,
                      size: 38, color: AppColors.navy),
                  const SizedBox(height: 10),
                  Text(title,
                      style: const TextStyle(fontWeight: FontWeight.w800)),
                  const SizedBox(height: 4),
                  Padding(
                    padding: const EdgeInsets.symmetric(horizontal: 18),
                    child: Text(
                      instruction,
                      textAlign: TextAlign.center,
                      style: const TextStyle(
                        color: AppColors.muted,
                        fontSize: 12,
                      ),
                    ),
                  ),
                  const SizedBox(height: 0),
                  Wrap(
                    spacing: 8,
                    children: [
                      OutlinedButton.icon(
                        onPressed: onCamera,
                        icon: const Icon(Icons.camera_alt_outlined),
                        label: const Text('Camera'),
                      ),
                      OutlinedButton.icon(
                          onPressed: onGallery,
                          icon: const Icon(Icons.photo_library_outlined),
                          label: const Text('Gallery')),
                    ],
                  ),
                ],
              )
            : Stack(
                fit: StackFit.expand,
                children: [
                  Image.file(photo!, fit: BoxFit.cover),
                  Positioned(
                    right: 10,
                    bottom: 10,
                    child: FilledButton.tonalIcon(
                      onPressed: onGallery,
                      icon: const Icon(Icons.swap_horiz_rounded),
                      label: const Text('Change'),
                    ),
                  ),
                ],
              ),
      );
}

class _InlineNotice extends StatelessWidget {
  const _InlineNotice({required this.message, required this.onRetry});

  final String message;
  final VoidCallback onRetry;

  @override
  Widget build(BuildContext context) => Container(
        padding: const EdgeInsets.all(14),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(14),
        ),
        child: Row(
          children: [
            Expanded(child: Text(message)),
            TextButton(onPressed: onRetry, child: const Text('Retry')),
          ],
        ),
      );
}

class _PlaceOption {
  const _PlaceOption({
    required this.province,
    required this.district,
    required this.municipality,
    required this.place,
  });

  final String province;
  final String district;
  final String municipality;
  final String place;
}
