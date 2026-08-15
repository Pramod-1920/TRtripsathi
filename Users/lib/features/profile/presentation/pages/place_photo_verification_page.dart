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
  static const _categories = <String, String>{
    'temple_spiritual': 'Temple & spiritual',
    'heritage_culture': 'Heritage & culture',
    'nature': 'Nature',
    'adventure': 'Adventure',
    'food_local': 'Local food',
    'community_event': 'Community & events',
    'hidden_gem': 'Hidden gem',
    'other': 'Other',
  };

  final _formKey = GlobalKey<FormState>();
  final _titleController = TextEditingController();
  final _addressController = TextEditingController();
  final _placeController = TextEditingController();
  final _picker = ImagePicker();

  List<_PlaceOption> _places = const [];
  _PlaceOption? _selectedPlace;
  File? _photo;
  String? _category;
  Position? _position;
  bool _loadingPlaces = true;
  bool _locating = false;
  bool _submitting = false;
  String? _catalogError;
  List<Map<String, dynamic>> _requests = const [];

  @override
  void initState() {
    super.initState();
    _loadPlaces();
    _loadRequests();
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
      for (final rawProvince in rawItems.whereType<Map>()) {
        final province = (rawProvince['province'] ?? '').toString().trim();
        for (final rawDistrict
            in (rawProvince['districtItems'] as List? ?? const [])
                .whereType<Map>()) {
          final district = (rawDistrict['district'] ?? '').toString().trim();
          for (final rawPlace
              in (rawDistrict['placeItems'] as List? ?? const [])
                  .whereType<Map>()) {
            final place = (rawPlace['place'] ?? '').toString().trim();
            final municipality =
                (rawPlace['municipality'] ?? '').toString().trim();
            final latitude =
                double.tryParse(rawPlace['latitude']?.toString() ?? '');
            final longitude =
                double.tryParse(rawPlace['longitude']?.toString() ?? '');
            if (province.isNotEmpty &&
                district.isNotEmpty &&
                municipality.isNotEmpty &&
                place.isNotEmpty &&
                latitude != null &&
                longitude != null) {
              options.add(_PlaceOption(
                province: province,
                district: district,
                municipality: municipality,
                place: place,
              ));
            }
          }
        }
      }
      options.sort((a, b) => a.place.compareTo(b.place));
      if (!mounted) return;
      setState(() {
        _places = options;
        _loadingPlaces = false;
        _catalogError = options.isEmpty
            ? 'No places are available yet. Ask an admin to add the place catalog.'
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

  Future<void> _choosePhoto(ImageSource source) async {
    final picked = await _picker.pickImage(
      source: source,
      imageQuality: 86,
      maxWidth: 2048,
    );
    if (picked != null && mounted) {
      setState(() => _photo = File(picked.path));
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
    if (_photo == null) {
      _showMessage('Add a clear photo of the place.');
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
      final photoUrl = await ApiService.uploadPlaceVerificationImage(_photo!);
      await ApiService.submitPlacePhotoVerification(
        photoUrl: photoUrl,
        title: _titleController.text,
        category: _category!,
        province: _selectedPlace!.province,
        district: _selectedPlace!.district,
        municipality: _selectedPlace!.municipality,
        place: _selectedPlace!.place,
        address: _addressController.text,
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
                  'Choose a known place, add your own photo and details, then send it to an admin. Province and district are filled automatically.',
                  style: TextStyle(color: AppColors.muted, height: 1.45),
                ),
                const SizedBox(height: 20),
                _PhotoPicker(
                  photo: _photo,
                  onCamera: () => _choosePhoto(ImageSource.camera),
                  onGallery: () => _choosePhoto(ImageSource.gallery),
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
                const SizedBox(height: 12),
                DropdownButtonFormField<String>(
                  value: _category,
                  decoration: const InputDecoration(
                    labelText: 'Category',
                    prefixIcon: Icon(Icons.category_outlined),
                  ),
                  items: _categories.entries
                      .map((entry) => DropdownMenuItem(
                            value: entry.key,
                            child: Text(entry.value),
                          ))
                      .toList(),
                  onChanged: (value) => setState(() => _category = value),
                  validator: (value) =>
                      value == null ? 'Choose a category' : null,
                ),
                const SizedBox(height: 18),
                if (_loadingPlaces)
                  const LinearProgressIndicator(minHeight: 2)
                else if (_catalogError != null)
                  _InlineNotice(message: _catalogError!, onRetry: _loadPlaces)
                else
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
                              maxHeight: 280, maxWidth: 520),
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
                      ? 'Add current GPS location (recommended)'
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

class _PhotoPicker extends StatelessWidget {
  const _PhotoPicker({
    required this.photo,
    required this.onCamera,
    required this.onGallery,
  });

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
                  const Text('Add a clear photo of the place',
                      style: TextStyle(fontWeight: FontWeight.w800)),
                  const SizedBox(height: 14),
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
                        label: const Text('Gallery'),
                      ),
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
