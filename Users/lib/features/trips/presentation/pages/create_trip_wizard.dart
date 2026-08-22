import 'dart:io';
import 'dart:ui';

import 'package:flutter/material.dart';
import 'package:flutter_map/flutter_map.dart';
import 'package:image/image.dart' as image_tools;
import 'package:image_picker/image_picker.dart';
import 'package:latlong2/latlong.dart';
import 'package:provider/provider.dart';

import 'package:trtripsathi_mobile/core/networking/api_service.dart';
import 'package:trtripsathi_mobile/core/theme/app_theme.dart';
import 'package:trtripsathi_mobile/features/campaigns/presentation/providers/campaigns_provider.dart';
import 'package:trtripsathi_mobile/features/map/domain/nepal_boundary.dart';

class CreateTripWizard extends StatefulWidget {
  const CreateTripWizard({super.key, this.campaign});

  final Map<String, dynamic>? campaign;

  @override
  State<CreateTripWizard> createState() => _CreateTripWizardState();
}

class _CreateTripWizardState extends State<CreateTripWizard> {
  static const _steps = [
    ('The idea', 'Name and trip style', Icons.lightbulb_outline_rounded),
    ('The place', 'Choose the location', Icons.map_outlined),
    ('The plan', 'Schedule and group size', Icons.event_note_rounded),
    ('Review', 'Check before publishing', Icons.fact_check_outlined),
  ];

  final _pageController = PageController();
  final _imagePicker = ImagePicker();
  final _title = TextEditingController();
  final _description = TextEditingController();
  final _category = TextEditingController();
  final _municipality = TextEditingController();
  final _placeName = TextEditingController();
  final _duration = TextEditingController(text: '1');
  final _estimatedCost = TextEditingController(text: '0');
  final _minParticipants = TextEditingController(text: '2');
  final _maxParticipants = TextEditingController(text: '10');

  int _step = 0;
  bool _loadingOptions = true;
  bool _submitting = false;
  String? _error;
  String _hikeType = 'group';
  String _scheduleType = 'scheduled';
  String _difficulty = 'moderate';
  String _joinMode = 'open';
  String? _genderVisibility;
  String _campaignVisibility = 'public';
  String? _subcategory;
  String? _province;
  String? _district;
  LatLng? _destinationPoint;
  DateTime? _startDate;
  XFile? _coverPhoto;
  String? _existingCoverUrl;
  List<_CampaignCategory> _categories = const [];
  List<_TripProvince> _places = const [];

  @override
  void initState() {
    super.initState();
    _prefillCampaign();
    _loadOptions();
  }

  bool get _isEditing => widget.campaign != null;

  void _prefillCampaign() {
    final campaign = widget.campaign;
    if (campaign == null) return;
    _title.text = (campaign['title'] ?? '').toString();
    _description.text = (campaign['description'] ?? '').toString();
    _category.text = (campaign['category'] ?? '').toString();
    _subcategory = (campaign['subcategory'] ?? '').toString().trim();
    if (_subcategory!.isEmpty) _subcategory = null;
    _hikeType = (campaign['hikeType'] ?? 'group').toString();
    _scheduleType = (campaign['scheduleType'] ?? 'scheduled').toString();
    _province = (campaign['province'] ?? '').toString().trim();
    if (_province!.isEmpty) _province = null;
    _district = (campaign['district'] ?? '').toString().trim();
    if (_district!.isEmpty) _district = null;
    _municipality.text = (campaign['municipality'] ?? '').toString();
    _placeName.text = (campaign['placeName'] ?? '').toString();
    final locationGps = campaign['locationGps'];
    if (locationGps is Map && locationGps['coordinates'] is List) {
      final coordinates = locationGps['coordinates'] as List;
      if (coordinates.length >= 2 &&
          coordinates[0] is num &&
          coordinates[1] is num) {
        _destinationPoint = LatLng(
          (coordinates[1] as num).toDouble(),
          (coordinates[0] as num).toDouble(),
        );
      }
    }
    _difficulty = (campaign['difficulty'] ?? 'moderate').toString();
    _joinMode = (campaign['joinMode'] ?? 'open').toString();
    final savedGenderVisibility =
        (campaign['genderVisibility'] ?? '').toString();
    _genderVisibility =
        const {'all', 'male', 'female'}.contains(savedGenderVisibility)
            ? savedGenderVisibility
            : null;
    _campaignVisibility = (campaign['visibility'] ?? 'public').toString();
    _duration.text = (campaign['durationDays'] ?? 1).toString();
    _estimatedCost.text = (campaign['estimatedNPR'] ?? 0).toString();
    _minParticipants.text = (campaign['minParticipants'] ?? 2).toString();
    _maxParticipants.text = (campaign['maxParticipants'] ?? 10).toString();
    _startDate = DateTime.tryParse(
      (campaign['startDate'] ?? '').toString(),
    )?.toLocal();
    final photos = campaign['photos'];
    if (photos is List && photos.isNotEmpty && photos.first is Map) {
      final firstPhoto = Map<String, dynamic>.from(photos.first as Map);
      _existingCoverUrl = ApiService.autoOrientCloudinaryImage(
        (firstPhoto['url'] ?? '').toString().trim(),
      );
      if (_existingCoverUrl!.isEmpty) _existingCoverUrl = null;
    }
  }

  @override
  void dispose() {
    _pageController.dispose();
    _title.dispose();
    _description.dispose();
    _category.dispose();
    _municipality.dispose();
    _placeName.dispose();
    _duration.dispose();
    _estimatedCost.dispose();
    _minParticipants.dispose();
    _maxParticipants.dispose();
    super.dispose();
  }

  Future<void> _loadOptions() async {
    final selectedCategory = _category.text.trim();
    final selectedSubcategory = _subcategory;
    setState(() {
      _loadingOptions = true;
      _error = null;
    });
    try {
      final results = await Future.wait([
        ApiService.getPlaceHierarchy(),
        ApiService.getActivityHierarchy(),
      ]);
      final rawPlaces = results[0];
      final rawActivities = results[1];
      if (!mounted) return;
      setState(() {
        _places = rawPlaces
            .whereType<Map>()
            .map((item) =>
                _TripProvince.fromJson(Map<String, dynamic>.from(item)))
            .where((item) => item.name.isNotEmpty)
            .toList();
        _categories = rawActivities
            .whereType<Map>()
            .map((item) => _CampaignCategory.fromJson(
                  Map<String, dynamic>.from(item),
                ))
            .where((item) => item.name.isNotEmpty)
            .toList()
          ..sort((a, b) => a.name.compareTo(b.name));
        if (_categories.isNotEmpty) {
          final matchingCategory = _categories.any(
            (item) => item.name == selectedCategory,
          );
          _category.text =
              matchingCategory ? selectedCategory : _categories.first.name;
          _subcategory =
              matchingCategory && _subcategories.contains(selectedSubcategory)
                  ? selectedSubcategory
                  : null;
        } else {
          _category.clear();
        }
        _loadingOptions = false;
      });
    } catch (error) {
      if (!mounted) return;
      setState(() {
        _loadingOptions = false;
        _error = ApiService.readableError(error);
      });
    }
  }

  List<String> get _districts {
    for (final province in _places) {
      if (province.name == _province) return province.districts;
    }
    return const [];
  }

  List<String> get _subcategories {
    for (final category in _categories) {
      if (category.name == _category.text.trim()) return category.subcategories;
    }
    return const [];
  }

  int get _leadDays => _hikeType == 'group' ? 9 : 2;

  Future<void> _pickStartDate() async {
    final now = DateTime.now();
    final minimum = now.add(Duration(days: _leadDays));
    final firstAllowed = DateTime(minimum.year, minimum.month, minimum.day);
    final date = await showDatePicker(
      context: context,
      initialDate: _startDate ?? firstAllowed,
      firstDate: firstAllowed,
      lastDate: DateTime(now.year + 2),
      helpText: 'CHOOSE TRIP DATE',
    );
    if (date == null || !mounted) return;
    final time = await showTimePicker(
      context: context,
      initialTime: _startDate == null
          ? TimeOfDay.fromDateTime(minimum.add(const Duration(minutes: 5)))
          : TimeOfDay.fromDateTime(_startDate!),
      helpText: 'CHOOSE START TIME',
    );
    if (time == null || !mounted) return;
    final selected =
        DateTime(date.year, date.month, date.day, time.hour, time.minute);
    if (selected.isBefore(minimum)) {
      setState(
          () => _error = 'Choose a time at least $_leadDays days from now.');
      return;
    }
    setState(() {
      _startDate = selected;
      _error = null;
    });
  }

  Future<void> _pickCoverPhoto() async {
    final source = await showModalBottomSheet<ImageSource>(
      context: context,
      showDragHandle: true,
      builder: (context) => SafeArea(
        child: Padding(
          padding: const EdgeInsets.fromLTRB(16, 4, 16, 18),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              ListTile(
                leading: const Icon(Icons.photo_library_outlined),
                title: const Text('Choose from gallery'),
                onTap: () => Navigator.pop(context, ImageSource.gallery),
              ),
              ListTile(
                leading: const Icon(Icons.photo_camera_outlined),
                title: const Text('Take a photo'),
                onTap: () => Navigator.pop(context, ImageSource.camera),
              ),
            ],
          ),
        ),
      ),
    );
    if (source == null || !mounted) return;
    try {
      // Keep the camera's original bytes here. Asking image_picker to resize
      // can rotate the pixels while retaining the old EXIF direction on some
      // Android devices, which makes a later correction turn the image upside
      // down. Resizing and compression happen once, below, after orientation
      // has been baked into the pixels.
      final image = await _imagePicker.pickImage(source: source);
      if (image != null) {
        final corrected = await _normalizeImageOrientation(image);
        if (mounted) setState(() => _coverPhoto = corrected);
      }
    } catch (error) {
      if (mounted) setState(() => _error = ApiService.readableError(error));
    }
  }

  Future<XFile> _normalizeImageOrientation(XFile picked) async {
    final bytes = await picked.readAsBytes();
    final decoded = image_tools.decodeImage(bytes);
    if (decoded == null) return picked;
    final oriented = image_tools.bakeOrientation(decoded);
    final corrected = oriented.width > 1800
        ? image_tools.copyResize(oriented, width: 1800)
        : oriented;
    final output = File('${picked.path}_oriented.jpg');
    await output.writeAsBytes(
      image_tools.encodeJpg(corrected, quality: 86),
      flush: true,
    );
    return XFile(output.path);
  }

  void _next() {
    final error = _validateStep(_step);
    if (error != null) {
      setState(() => _error = error);
      return;
    }
    if (_step == _steps.length - 1) {
      _createCampaign();
      return;
    }
    setState(() {
      _step += 1;
      _error = null;
    });
    _pageController.animateToPage(
      _step,
      duration: const Duration(milliseconds: 320),
      curve: Curves.easeOutCubic,
    );
  }

  void _back() {
    if (_step == 0) {
      Navigator.pop(context);
      return;
    }
    setState(() {
      _step -= 1;
      _error = null;
    });
    _pageController.animateToPage(
      _step,
      duration: const Duration(milliseconds: 260),
      curve: Curves.easeOutCubic,
    );
  }

  String? _validateStep(int step) {
    if (step == 0) {
      if (_loadingOptions) return 'Wait for activity categories to load.';
      if (_categories.isEmpty) {
        return 'No enabled activity categories are available from Admin.';
      }
      if (_title.text.trim().length < 4) return 'Give your trip a clear title.';
      if (_category.text.trim().isEmpty) {
        return 'Choose an activity category.';
      }
      if (_description.text.trim().length < 20) {
        return 'Describe the plan in at least 20 characters.';
      }
    }
    if (step == 1) {
      if (_province == null) return 'Choose a province.';
      if (_district == null) return 'Choose a district.';
      if (_municipality.text.trim().isEmpty) {
        return 'Enter a municipality.';
      }
    }
    if (step == 2) {
      if (_startDate == null) return 'Choose the trip date and time.';
      final duration = int.tryParse(_duration.text.trim());
      if (duration == null || duration < 1 || duration > 30) {
        return 'Duration must be between 1 and 30 days.';
      }
      final cost = num.tryParse(_estimatedCost.text.trim());
      if (cost == null || cost < 0) return 'Enter a valid estimated cost.';
      if (_hikeType == 'group') {
        if (_genderVisibility == null) {
          return 'Choose who can discover and join the campaign.';
        }
        final minimum = int.tryParse(_minParticipants.text.trim());
        final maximum = int.tryParse(_maxParticipants.text.trim());
        if (minimum == null || minimum < 1) {
          return 'Minimum participants must be at least 1.';
        }
        if (maximum == null || maximum < 2 || maximum > 30) {
          return 'Maximum participants must be between 2 and 30.';
        }
        if (minimum > maximum) {
          return 'Minimum participants cannot exceed maximum participants.';
        }
      }
    }
    return null;
  }

  Future<void> _createCampaign() async {
    for (var index = 0; index < 3; index++) {
      final error = _validateStep(index);
      if (error != null) {
        setState(() => _error = error);
        return;
      }
    }
    setState(() {
      _submitting = true;
      _error = null;
    });
    final campaignsProvider = context.read<CampaignsProvider>();
    try {
      Map<String, String>? uploadedPhoto;
      if (_coverPhoto != null) {
        uploadedPhoto = await ApiService.uploadCampaignImage(
          File(_coverPhoto!.path),
        );
      }
      final duration =
          _scheduleType == 'instant' ? 1 : int.parse(_duration.text.trim());
      final start = _startDate!;
      final end = start.add(Duration(days: duration));
      final payload = <String, dynamic>{
        'title': _title.text.trim(),
        'description': _description.text.trim(),
        'category': _category.text.trim(),
        if ((_subcategory ?? '').isNotEmpty) 'subcategory': _subcategory,
        'hikeType': _hikeType,
        'province': _province,
        'district': _district,
        if (_municipality.text.trim().isNotEmpty)
          'municipality': _municipality.text.trim(),
        if (_placeName.text.trim().isNotEmpty)
          'placeName': _placeName.text.trim(),
        if (_destinationPoint != null)
          'locationGps': {
            'type': 'Point',
            'coordinates': [
              _destinationPoint!.longitude,
              _destinationPoint!.latitude,
            ],
          },
        'difficulty': _difficulty,
        'durationDays': duration,
        'estimatedNPR': num.parse(_estimatedCost.text.trim()),
        'scheduleType': _scheduleType,
        'startDate': start.toUtc().toIso8601String(),
        if (_scheduleType == 'scheduled')
          'endDate': end.toUtc().toIso8601String(),
        if (_hikeType == 'group') ...{
          'joinMode': _joinMode,
          'genderVisibility': _genderVisibility!,
          'visibility': _campaignVisibility,
          'minParticipants': int.parse(_minParticipants.text.trim()),
          'maxParticipants': int.parse(_maxParticipants.text.trim()),
        } else
          'maxParticipants': 1,
        if (uploadedPhoto != null)
          'photos': [
            {
              'url': uploadedPhoto['url'],
              if ((uploadedPhoto['publicId'] ?? '').isNotEmpty)
                'publicId': uploadedPhoto['publicId'],
              'caption': _title.text.trim(),
            }
          ],
      };
      final campaignId =
          (widget.campaign?['_id'] ?? widget.campaign?['id'] ?? '').toString();
      final created = _isEditing
          ? await campaignsProvider.updateOwnedCampaign(campaignId, payload)
          : await campaignsProvider.createCampaign(payload);
      if (!mounted) return;
      Navigator.pop(context, created);
    } catch (error) {
      if (!mounted) return;
      setState(() => _error = ApiService.readableError(error));
    } finally {
      if (mounted) setState(() => _submitting = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final step = _steps[_step];
    return PopScope(
      canPop: _step == 0 && !_submitting,
      onPopInvokedWithResult: (didPop, _) {
        if (!didPop && !_submitting) _back();
      },
      child: Scaffold(
        backgroundColor: const Color(0xFFF5F5F0),
        appBar: AppBar(
          backgroundColor: const Color(0xFFF5F5F0),
          leading: IconButton(
            onPressed: _submitting ? null : _back,
            icon: const Icon(Icons.arrow_back_rounded),
          ),
          title: Text(_isEditing ? 'Edit trip' : 'Plan a trip'),
          actions: [
            Padding(
              padding: const EdgeInsets.only(right: 16),
              child: Center(
                child: Text(
                  '${_step + 1} / ${_steps.length}',
                  style: const TextStyle(
                    color: AppColors.muted,
                    fontWeight: FontWeight.w800,
                  ),
                ),
              ),
            ),
          ],
        ),
        bottomNavigationBar: _WizardFooter(
          step: _step,
          lastStep: _steps.length - 1,
          submitting: _submitting,
          editing: _isEditing,
          onBack: _back,
          onNext: _next,
        ),
        body: Column(
          children: [
            _WizardProgress(currentStep: _step, steps: _steps),
            Padding(
              padding: const EdgeInsets.fromLTRB(20, 20, 20, 8),
              child: Row(
                children: [
                  Container(
                    width: 48,
                    height: 48,
                    decoration: BoxDecoration(
                      color: AppColors.gold.withValues(alpha: .22),
                      borderRadius: BorderRadius.circular(16),
                    ),
                    child: Icon(step.$3, color: AppColors.navy),
                  ),
                  const SizedBox(width: 13),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          step.$1,
                          style: const TextStyle(
                            color: AppColors.navy,
                            fontSize: 23,
                            fontWeight: FontWeight.w900,
                          ),
                        ),
                        Text(step.$2,
                            style: const TextStyle(color: AppColors.muted)),
                      ],
                    ),
                  ),
                ],
              ),
            ),
            if (_error != null)
              Padding(
                padding: const EdgeInsets.fromLTRB(20, 8, 20, 2),
                child: _WizardError(message: _error!),
              ),
            Expanded(
              child: PageView(
                controller: _pageController,
                physics: const NeverScrollableScrollPhysics(),
                children: [
                  _IdeaStep(
                    title: _title,
                    description: _description,
                    category: _category,
                    categories: _categories,
                    subcategories: _subcategories,
                    selectedSubcategory: _subcategory,
                    hikeType: _hikeType,
                    loading: _loadingOptions,
                    coverPhoto: _coverPhoto,
                    existingCoverUrl: _existingCoverUrl,
                    onPickCover: _pickCoverPhoto,
                    onRetry: _loadOptions,
                    onCategoryChanged: (value) => setState(() {
                      _category.text = value;
                      _subcategory = null;
                    }),
                    onSubcategoryChanged: (value) =>
                        setState(() => _subcategory = value),
                    onHikeTypeChanged: (value) => setState(() {
                      _hikeType = value;
                      if (value == 'group') _scheduleType = 'scheduled';
                      _startDate = null;
                    }),
                  ),
                  _PlaceStep(
                    loading: _loadingOptions,
                    places: _places,
                    province: _province,
                    district: _district,
                    districts: _districts,
                    municipality: _municipality,
                    destinationPoint: _destinationPoint,
                    onProvinceChanged: (value) => setState(() {
                      _province = value;
                      _district = null;
                      _municipality.clear();
                      _destinationPoint = null;
                    }),
                    onDistrictChanged: (value) => setState(() {
                      _district = value;
                      _municipality.clear();
                      _destinationPoint = null;
                    }),
                    onDestinationPointChanged: (value) => setState(() {
                      _destinationPoint = value;
                      _error = null;
                    }),
                  ),
                  _PlanStep(
                    hikeType: _hikeType,
                    scheduleType: _scheduleType,
                    difficulty: _difficulty,
                    joinMode: _joinMode,
                    genderVisibility: _genderVisibility,
                    campaignVisibility: _campaignVisibility,
                    startDate: _startDate,
                    leadDays: _leadDays,
                    duration: _duration,
                    estimatedCost: _estimatedCost,
                    minParticipants: _minParticipants,
                    maxParticipants: _maxParticipants,
                    onPickDate: _pickStartDate,
                    onScheduleTypeChanged: (value) => setState(() {
                      _scheduleType = value;
                      _startDate = value == 'instant' ? DateTime.now() : null;
                      _error = null;
                    }),
                    onDifficultyChanged: (value) =>
                        setState(() => _difficulty = value),
                    onJoinModeChanged: (value) =>
                        setState(() => _joinMode = value),
                    onGenderVisibilityChanged: (value) =>
                        setState(() => _genderVisibility = value),
                    onCampaignVisibilityChanged: (value) =>
                        setState(() => _campaignVisibility = value),
                  ),
                  _ReviewStep(
                    title: _title.text.trim(),
                    description: _description.text.trim(),
                    category: _category.text.trim(),
                    hikeType: _hikeType,
                    scheduleType: _scheduleType,
                    genderVisibility: _genderVisibility ?? 'all',
                    campaignVisibility: _campaignVisibility,
                    province: _province ?? '',
                    district: _district ?? '',
                    municipality: _municipality.text.trim(),
                    difficulty: _difficulty,
                    startDate: _startDate,
                    duration: _duration.text,
                    estimatedCost: _estimatedCost.text,
                    participants: _hikeType == 'group'
                        ? '${_minParticipants.text}–${_maxParticipants.text}'
                        : 'Solo',
                    coverPhoto: _coverPhoto,
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _IdeaStep extends StatelessWidget {
  const _IdeaStep({
    required this.title,
    required this.description,
    required this.category,
    required this.categories,
    required this.subcategories,
    required this.selectedSubcategory,
    required this.hikeType,
    required this.loading,
    required this.coverPhoto,
    required this.existingCoverUrl,
    required this.onPickCover,
    required this.onRetry,
    required this.onCategoryChanged,
    required this.onSubcategoryChanged,
    required this.onHikeTypeChanged,
  });
  final TextEditingController title;
  final TextEditingController description;
  final TextEditingController category;
  final List<_CampaignCategory> categories;
  final List<String> subcategories;
  final String? selectedSubcategory;
  final String hikeType;
  final bool loading;
  final XFile? coverPhoto;
  final String? existingCoverUrl;
  final VoidCallback onPickCover;
  final VoidCallback onRetry;
  final ValueChanged<String> onCategoryChanged;
  final ValueChanged<String?> onSubcategoryChanged;
  final ValueChanged<String> onHikeTypeChanged;

  @override
  Widget build(BuildContext context) => _StepScroll(
        children: [
          _TripTypeSelector(value: hikeType, onChanged: onHikeTypeChanged),
          const SizedBox(height: 16),
          _CoverPhotoPicker(
            photo: coverPhoto,
            existingUrl: existingCoverUrl,
            onTap: onPickCover,
          ),
          const SizedBox(height: 16),
          _WizardCard(
            children: [
              TextField(
                controller: title,
                textCapitalization: TextCapitalization.words,
                maxLength: 80,
                decoration: const InputDecoration(
                  labelText: 'Trip title',
                  hintText: 'Sunrise trail to Mardi viewpoint',
                  prefixIcon: Icon(Icons.title_rounded),
                ),
              ),
              const SizedBox(height: 12),
              if (loading)
                const _ActivityCatalogLoading()
              else if (categories.isNotEmpty)
                DropdownButtonFormField<String>(
                  value: categories.any((item) => item.name == category.text)
                      ? category.text
                      : null,
                  isExpanded: true,
                  decoration: const InputDecoration(
                    labelText: 'Activity category',
                    prefixIcon: Icon(Icons.hiking_rounded),
                  ),
                  items: categories
                      .map((item) => DropdownMenuItem(
                            value: item.name,
                            child: Text(item.name),
                          ))
                      .toList(),
                  onChanged: (value) {
                    if (value != null) onCategoryChanged(value);
                  },
                )
              else
                _ActivityCatalogUnavailable(onRetry: onRetry),
              if (subcategories.isNotEmpty) ...[
                const SizedBox(height: 12),
                DropdownButtonFormField<String>(
                  value: subcategories.contains(selectedSubcategory)
                      ? selectedSubcategory
                      : null,
                  decoration: const InputDecoration(labelText: 'Subcategory'),
                  items: subcategories
                      .map((item) =>
                          DropdownMenuItem(value: item, child: Text(item)))
                      .toList(),
                  onChanged: onSubcategoryChanged,
                ),
              ],
              const SizedBox(height: 12),
              TextField(
                controller: description,
                minLines: 4,
                maxLines: 7,
                maxLength: 500,
                textCapitalization: TextCapitalization.sentences,
                decoration: const InputDecoration(
                  labelText: 'What should travelers expect?',
                  hintText: 'Route highlights, pace, preparation and the mood…',
                  alignLabelWithHint: true,
                ),
              ),
            ],
          ),
        ],
      );
}

class _PlaceStep extends StatelessWidget {
  const _PlaceStep({
    required this.loading,
    required this.places,
    required this.province,
    required this.district,
    required this.districts,
    required this.municipality,
    required this.destinationPoint,
    required this.onProvinceChanged,
    required this.onDistrictChanged,
    required this.onDestinationPointChanged,
  });
  final bool loading;
  final List<_TripProvince> places;
  final String? province;
  final String? district;
  final List<String> districts;
  final TextEditingController municipality;
  final LatLng? destinationPoint;
  final ValueChanged<String?> onProvinceChanged;
  final ValueChanged<String?> onDistrictChanged;
  final ValueChanged<LatLng> onDestinationPointChanged;

  @override
  Widget build(BuildContext context) => _StepScroll(
        children: [
          _WizardNote(
            icon: Icons.cloud_done_outlined,
            title: 'Choose the campaign location',
            message: 'Province, district and municipality are required. '
                'The exact map pin is optional.',
          ),
          const SizedBox(height: 14),
          _WizardCard(
            children: [
              if (loading)
                const Padding(
                  padding: EdgeInsets.all(24),
                  child: Center(
                    child: CircularProgressIndicator(color: AppColors.navy),
                  ),
                )
              else ...[
                DropdownButtonFormField<String>(
                  value: places.any((item) => item.name == province)
                      ? province
                      : null,
                  isExpanded: true,
                  decoration: const InputDecoration(
                    labelText: 'Province',
                    prefixIcon: Icon(Icons.map_outlined),
                  ),
                  items: places
                      .map((item) => DropdownMenuItem(
                            value: item.name,
                            child: Text(_label(item.name)),
                          ))
                      .toList(),
                  onChanged: onProvinceChanged,
                ),
                const SizedBox(height: 12),
                DropdownButtonFormField<String>(
                  key: ValueKey(province),
                  value: districts.contains(district) ? district : null,
                  isExpanded: true,
                  decoration: const InputDecoration(
                    labelText: 'District',
                    prefixIcon: Icon(Icons.signpost_outlined),
                  ),
                  items: districts
                      .map((item) => DropdownMenuItem(
                            value: item,
                            child: Text(_label(item)),
                          ))
                      .toList(),
                  onChanged: province == null ? null : onDistrictChanged,
                ),
                const SizedBox(height: 12),
                TextField(
                  controller: municipality,
                  textCapitalization: TextCapitalization.words,
                  decoration: const InputDecoration(
                    labelText: 'Municipality',
                    prefixIcon: Icon(Icons.location_city_outlined),
                  ),
                ),
                const SizedBox(height: 18),
                Align(
                  alignment: Alignment.centerLeft,
                  child: Text(
                    'Pin the location (optional)',
                    style: Theme.of(context).textTheme.titleMedium?.copyWith(
                          color: AppColors.ink,
                          fontWeight: FontWeight.w800,
                        ),
                  ),
                ),
                const SizedBox(height: 5),
                const Align(
                  alignment: Alignment.centerLeft,
                  child: Text(
                    'Tap the map if you want to share a more precise location.',
                    style: TextStyle(color: AppColors.muted, height: 1.35),
                  ),
                ),
                const SizedBox(height: 10),
                ClipRRect(
                  borderRadius: BorderRadius.circular(18),
                  child: SizedBox(
                    height: 230,
                    child: FlutterMap(
                      key: ValueKey(destinationPoint),
                      options: MapOptions(
                        initialCenter:
                            destinationPoint ?? const LatLng(28.3949, 84.1240),
                        initialZoom: destinationPoint == null ? 6 : 13,
                        minZoom: 6,
                        maxZoom: 18,
                        backgroundColor: AppColors.canvas,
                        cameraConstraint: CameraConstraint.containCenter(
                          bounds: nepalMapBounds,
                        ),
                        onTap: (_, point) {
                          if (isInsideNepal(point)) {
                            onDestinationPointChanged(point);
                            return;
                          }
                          ScaffoldMessenger.of(context).showSnackBar(
                            const SnackBar(
                              content: Text(
                                'Choose a location inside Nepal.',
                              ),
                            ),
                          );
                        },
                      ),
                      children: [
                        TileLayer(
                          urlTemplate:
                              'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
                          userAgentPackageName: 'com.test.tripsathi',
                          maxNativeZoom: 19,
                          tileBounds: nepalMapBounds,
                        ),
                        PolygonLayer(
                          invertedFill: AppColors.canvas,
                          polygons: [
                            Polygon(
                              points: nepalBoundary,
                              color: Colors.transparent,
                              borderColor:
                                  AppColors.navy.withValues(alpha: .55),
                              borderStrokeWidth: 1.2,
                            ),
                          ],
                        ),
                        if (destinationPoint != null)
                          MarkerLayer(
                            markers: [
                              Marker(
                                point: destinationPoint!,
                                width: 48,
                                height: 48,
                                alignment: Alignment.topCenter,
                                child: const Icon(
                                  Icons.location_pin,
                                  size: 46,
                                  color: AppColors.navy,
                                  shadows: [
                                    Shadow(
                                      color: Colors.black26,
                                      blurRadius: 8,
                                    ),
                                  ],
                                ),
                              ),
                            ],
                          ),
                        const RichAttributionWidget(
                          attributions: [
                            TextSourceAttribution(
                              'OpenStreetMap contributors',
                            ),
                            TextSourceAttribution(
                              'Nepal boundary: geoBoundaries / Open Data Nepal',
                            ),
                          ],
                        ),
                      ],
                    ),
                  ),
                ),
                const SizedBox(height: 9),
                Row(
                  children: [
                    Icon(
                      destinationPoint == null
                          ? Icons.touch_app_outlined
                          : Icons.check_circle_rounded,
                      color: destinationPoint == null
                          ? AppColors.muted
                          : const Color(0xFF18794E),
                      size: 18,
                    ),
                    const SizedBox(width: 7),
                    Text(
                      destinationPoint == null
                          ? 'No map pin added'
                          : 'Optional map pin added',
                      style: TextStyle(
                        color: destinationPoint == null
                            ? AppColors.muted
                            : const Color(0xFF18794E),
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                  ],
                ),
              ],
            ],
          ),
        ],
      );
}

class _PlanStep extends StatelessWidget {
  const _PlanStep({
    required this.hikeType,
    required this.scheduleType,
    required this.difficulty,
    required this.joinMode,
    required this.genderVisibility,
    required this.campaignVisibility,
    required this.startDate,
    required this.leadDays,
    required this.duration,
    required this.estimatedCost,
    required this.minParticipants,
    required this.maxParticipants,
    required this.onPickDate,
    required this.onScheduleTypeChanged,
    required this.onDifficultyChanged,
    required this.onJoinModeChanged,
    required this.onGenderVisibilityChanged,
    required this.onCampaignVisibilityChanged,
  });
  final String hikeType;
  final String scheduleType;
  final String difficulty;
  final String joinMode;
  final String? genderVisibility;
  final String campaignVisibility;
  final DateTime? startDate;
  final int leadDays;
  final TextEditingController duration;
  final TextEditingController estimatedCost;
  final TextEditingController minParticipants;
  final TextEditingController maxParticipants;
  final VoidCallback onPickDate;
  final ValueChanged<String> onScheduleTypeChanged;
  final ValueChanged<String> onDifficultyChanged;
  final ValueChanged<String> onJoinModeChanged;
  final ValueChanged<String> onGenderVisibilityChanged;
  final ValueChanged<String> onCampaignVisibilityChanged;

  @override
  Widget build(BuildContext context) => _StepScroll(
        children: [
          _WizardNote(
            icon: Icons.schedule_rounded,
            title: scheduleType == 'instant'
                ? 'Travel today'
                : hikeType == 'group'
                    ? 'Give the group time to prepare'
                    : 'Schedule your solo trip',
            message: scheduleType == 'instant'
                ? 'Your trip starts when published and remains active for 12 hours.'
                : 'This trip must begin at least $leadDays days from now.',
          ),
          const SizedBox(height: 14),
          _WizardCard(
            children: [
              if (hikeType == 'solo') ...[
                Row(
                  children: [
                    Expanded(
                      child: ChoiceChip(
                        label: const Text('Travel today'),
                        selected: scheduleType == 'instant',
                        onSelected: (_) => onScheduleTypeChanged('instant'),
                      ),
                    ),
                    const SizedBox(width: 10),
                    Expanded(
                      child: ChoiceChip(
                        label: const Text('Schedule later'),
                        selected: scheduleType == 'scheduled',
                        onSelected: (_) => onScheduleTypeChanged('scheduled'),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 12),
              ],
              if (scheduleType == 'scheduled')
                InkWell(
                  onTap: onPickDate,
                  borderRadius: BorderRadius.circular(18),
                  child: InputDecorator(
                    decoration: const InputDecoration(
                      labelText: 'Start date and time',
                      prefixIcon: Icon(Icons.event_rounded),
                      suffixIcon: Icon(Icons.chevron_right_rounded),
                    ),
                    child: Text(
                      startDate == null
                          ? 'Choose schedule'
                          : _formatDateTime(startDate!),
                      style: TextStyle(
                        color: startDate == null
                            ? AppColors.muted
                            : AppColors.navy,
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                  ),
                )
              else
                const ListTile(
                  contentPadding: EdgeInsets.symmetric(horizontal: 4),
                  leading: Icon(Icons.bolt_rounded, color: AppColors.gold),
                  title: Text('Starts immediately'),
                  subtitle: Text('12-hour solo trip'),
                ),
              const SizedBox(height: 12),
              DropdownButtonFormField<String>(
                value: difficulty,
                decoration: const InputDecoration(
                  labelText: 'Difficulty',
                  prefixIcon: Icon(Icons.terrain_rounded),
                ),
                items: const [
                  DropdownMenuItem(value: 'easy', child: Text('Easy')),
                  DropdownMenuItem(value: 'moderate', child: Text('Moderate')),
                  DropdownMenuItem(
                      value: 'difficult', child: Text('Difficult')),
                  DropdownMenuItem(value: 'expert', child: Text('Expert')),
                ],
                onChanged: (value) {
                  if (value != null) onDifficultyChanged(value);
                },
              ),
              const SizedBox(height: 12),
              Row(
                children: [
                  if (scheduleType == 'scheduled') ...[
                    Expanded(
                      child: TextField(
                        controller: duration,
                        keyboardType: TextInputType.number,
                        decoration: const InputDecoration(
                          labelText: 'Days',
                          prefixIcon: Icon(Icons.timelapse_rounded),
                        ),
                      ),
                    ),
                    const SizedBox(width: 10),
                  ],
                  Expanded(
                    child: TextField(
                      controller: estimatedCost,
                      keyboardType: TextInputType.number,
                      decoration: const InputDecoration(
                        labelText: 'Budget (NPR)',
                        prefixIcon: Icon(Icons.payments_outlined),
                      ),
                    ),
                  ),
                ],
              ),
              if (hikeType == 'group') ...[
                const SizedBox(height: 8),
                DropdownButtonFormField<String>(
                  value: campaignVisibility,
                  isExpanded: true,
                  decoration: const InputDecoration(
                    labelText: 'Campaign visibility',
                    prefixIcon: Icon(Icons.lock_outline_rounded),
                  ),
                  items: const [
                    DropdownMenuItem(
                      value: 'public',
                      child: Text(
                        'Public — shown in discovery',
                        overflow: TextOverflow.ellipsis,
                      ),
                    ),
                    DropdownMenuItem(
                      value: 'private',
                      child: Text(
                        'Private — join with code',
                        overflow: TextOverflow.ellipsis,
                      ),
                    ),
                  ],
                  onChanged: (value) {
                    if (value != null) onCampaignVisibilityChanged(value);
                  },
                ),
                const SizedBox(height: 8),
                DropdownButtonFormField<String>(
                  value: joinMode,
                  decoration: const InputDecoration(
                    labelText: 'How travelers join',
                    prefixIcon: Icon(Icons.group_add_outlined),
                  ),
                  items: const [
                    DropdownMenuItem(value: 'open', child: Text('Open join')),
                    DropdownMenuItem(
                      value: 'request',
                      child: Text('Host approval required'),
                    ),
                  ],
                  onChanged: (value) {
                    if (value != null) onJoinModeChanged(value);
                  },
                ),
                const SizedBox(height: 10),
                DropdownButtonFormField<String>(
                  value: genderVisibility,
                  decoration: const InputDecoration(
                    labelText: 'Allowed gender',
                    hintText: 'Select who can join',
                    prefixIcon: Icon(Icons.wc_rounded),
                  ),
                  items: const [
                    DropdownMenuItem(
                      value: 'all',
                      child: Text('All genders'),
                    ),
                    DropdownMenuItem(
                      value: 'male',
                      child: Text('Men only'),
                    ),
                    DropdownMenuItem(
                      value: 'female',
                      child: Text('Women only'),
                    ),
                  ],
                  onChanged: (value) {
                    if (value != null) onGenderVisibilityChanged(value);
                  },
                ),
                const SizedBox(height: 12),
                Row(
                  children: [
                    Expanded(
                      child: TextField(
                        controller: minParticipants,
                        keyboardType: TextInputType.number,
                        decoration:
                            const InputDecoration(labelText: 'Minimum people'),
                      ),
                    ),
                    const SizedBox(width: 10),
                    Expanded(
                      child: TextField(
                        controller: maxParticipants,
                        keyboardType: TextInputType.number,
                        decoration:
                            const InputDecoration(labelText: 'Maximum people'),
                      ),
                    ),
                  ],
                ),
              ],
            ],
          ),
        ],
      );
}

class _ReviewStep extends StatelessWidget {
  const _ReviewStep({
    required this.title,
    required this.description,
    required this.category,
    required this.hikeType,
    required this.scheduleType,
    required this.genderVisibility,
    required this.campaignVisibility,
    required this.province,
    required this.district,
    required this.municipality,
    required this.difficulty,
    required this.startDate,
    required this.duration,
    required this.estimatedCost,
    required this.participants,
    required this.coverPhoto,
  });
  final String title;
  final String description;
  final String category;
  final String hikeType;
  final String scheduleType;
  final String genderVisibility;
  final String campaignVisibility;
  final String province;
  final String district;
  final String municipality;
  final String difficulty;
  final DateTime? startDate;
  final String duration;
  final String estimatedCost;
  final String participants;
  final XFile? coverPhoto;

  @override
  Widget build(BuildContext context) => _StepScroll(
        children: [
          Container(
            clipBehavior: Clip.antiAlias,
            decoration: BoxDecoration(
              color: AppColors.navy,
              borderRadius: BorderRadius.circular(26),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Container(
                  height: 108,
                  decoration: BoxDecoration(
                    gradient: const LinearGradient(
                      colors: [Color(0xFF1D5C50), Color(0xFF17324D)],
                      begin: Alignment.topLeft,
                      end: Alignment.bottomRight,
                    ),
                  ),
                  child: Stack(
                    children: [
                      if (coverPhoto != null)
                        Positioned.fill(
                          child: _FullCampaignPhoto(
                            image: FileImage(File(coverPhoto!.path)),
                          ),
                        ),
                      Positioned(
                        right: 18,
                        bottom: -8,
                        child: Icon(
                          Icons.landscape_rounded,
                          size: 100,
                          color: Colors.white.withValues(alpha: .1),
                        ),
                      ),
                      Positioned(
                        left: 16,
                        top: 16,
                        child: _ReviewPill(label: hikeType.toUpperCase()),
                      ),
                    ],
                  ),
                ),
                Padding(
                  padding: const EdgeInsets.all(18),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        title,
                        style: const TextStyle(
                          color: Colors.white,
                          fontSize: 21,
                          fontWeight: FontWeight.w900,
                        ),
                      ),
                      const SizedBox(height: 7),
                      Text(
                        description,
                        maxLines: 3,
                        overflow: TextOverflow.ellipsis,
                        style: const TextStyle(
                          color: Color(0xFFCAD8E3),
                          height: 1.4,
                        ),
                      ),
                      const SizedBox(height: 15),
                      Wrap(
                        spacing: 7,
                        runSpacing: 7,
                        children: [
                          _ReviewPill(label: category),
                          _ReviewPill(label: _label(difficulty)),
                          _ReviewPill(
                            label: scheduleType == 'instant'
                                ? '12 hour trip'
                                : '$duration day trip',
                          ),
                        ],
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 14),
          _WizardCard(
            children: [
              _ReviewRow(
                icon: Icons.location_on_outlined,
                label: 'Location',
                value: [municipality, district, province]
                    .where((value) => value.isNotEmpty)
                    .map(_label)
                    .join(', '),
              ),
              _ReviewRow(
                icon: Icons.event_outlined,
                label: 'Starts',
                value: scheduleType == 'instant'
                    ? 'Immediately after publishing'
                    : startDate == null
                        ? 'Not selected'
                        : _formatDateTime(startDate!),
              ),
              if (hikeType == 'group')
                _ReviewRow(
                  icon: Icons.lock_outline_rounded,
                  label: 'Visibility',
                  value: campaignVisibility == 'private'
                      ? 'Private - join with code'
                      : 'Public discovery',
                ),
              _ReviewRow(
                icon: Icons.groups_2_outlined,
                label: 'Travelers',
                value: hikeType == 'group'
                    ? '${_genderVisibilityLabel(genderVisibility)} • $participants'
                    : participants,
              ),
              _ReviewRow(
                icon: Icons.payments_outlined,
                label: 'Estimated budget',
                value: 'NPR $estimatedCost',
                last: true,
              ),
            ],
          ),
          const SizedBox(height: 14),
          const _WizardNote(
            icon: Icons.visibility_outlined,
            title: 'Ready for the Campaign page',
            message:
                'After publishing, this trip is added to Campaigns immediately. Some difficulty levels may require Admin approval.',
          ),
        ],
      );
}

class _WizardProgress extends StatelessWidget {
  const _WizardProgress({required this.currentStep, required this.steps});
  final int currentStep;
  final List<(String, String, IconData)> steps;

  @override
  Widget build(BuildContext context) => Padding(
        padding: const EdgeInsets.symmetric(horizontal: 20),
        child: Row(
          children: List.generate(steps.length, (index) {
            final active = index <= currentStep;
            return Expanded(
              child: AnimatedContainer(
                duration: const Duration(milliseconds: 260),
                height: 4,
                margin:
                    EdgeInsets.only(right: index == steps.length - 1 ? 0 : 6),
                decoration: BoxDecoration(
                  color: active ? AppColors.gold : const Color(0xFFDDE1DC),
                  borderRadius: BorderRadius.circular(99),
                ),
              ),
            );
          }),
        ),
      );
}

class _WizardFooter extends StatelessWidget {
  const _WizardFooter({
    required this.step,
    required this.lastStep,
    required this.submitting,
    required this.editing,
    required this.onBack,
    required this.onNext,
  });
  final int step;
  final int lastStep;
  final bool submitting;
  final bool editing;
  final VoidCallback onBack;
  final VoidCallback onNext;

  @override
  Widget build(BuildContext context) => SafeArea(
        top: false,
        child: Container(
          padding: const EdgeInsets.fromLTRB(16, 10, 16, 12),
          decoration: const BoxDecoration(
            color: Colors.white,
            border: Border(top: BorderSide(color: AppColors.line)),
          ),
          child: Row(
            children: [
              if (step > 0) ...[
                OutlinedButton(
                  onPressed: submitting ? null : onBack,
                  style: OutlinedButton.styleFrom(
                    minimumSize: const Size(54, 54),
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(17),
                    ),
                  ),
                  child: const Icon(Icons.arrow_back_rounded),
                ),
                const SizedBox(width: 10),
              ],
              Expanded(
                child: FilledButton.icon(
                  onPressed: submitting ? null : onNext,
                  style: FilledButton.styleFrom(
                    backgroundColor: AppColors.navy,
                    foregroundColor: Colors.white,
                    minimumSize: const Size.fromHeight(54),
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(17),
                    ),
                  ),
                  icon: submitting
                      ? const SizedBox.square(
                          dimension: 18,
                          child: CircularProgressIndicator(
                            color: Colors.white,
                            strokeWidth: 2,
                          ),
                        )
                      : Icon(step == lastStep
                          ? Icons.rocket_launch_outlined
                          : Icons.arrow_forward_rounded),
                  label: Text(
                    submitting
                        ? (editing ? 'Saving…' : 'Publishing…')
                        : step == lastStep
                            ? (editing ? 'Save changes' : 'Publish trip')
                            : 'Continue',
                  ),
                ),
              ),
            ],
          ),
        ),
      );
}

class _TripTypeSelector extends StatelessWidget {
  const _TripTypeSelector({required this.value, required this.onChanged});
  final String value;
  final ValueChanged<String> onChanged;

  @override
  Widget build(BuildContext context) => Row(
        children: [
          Expanded(
            child: _TripTypeCard(
              icon: Icons.person_outline_rounded,
              title: 'Solo',
              subtitle: 'A personal journey',
              selected: value == 'solo',
              onTap: () => onChanged('solo'),
            ),
          ),
          const SizedBox(width: 10),
          Expanded(
            child: _TripTypeCard(
              icon: Icons.groups_2_outlined,
              title: 'Group',
              subtitle: 'Invite travelers',
              selected: value == 'group',
              onTap: () => onChanged('group'),
            ),
          ),
        ],
      );
}

class _FullCampaignPhoto extends StatelessWidget {
  const _FullCampaignPhoto({required this.image});

  final ImageProvider image;

  @override
  Widget build(BuildContext context) => Stack(
        fit: StackFit.expand,
        children: [
          ImageFiltered(
            imageFilter: ImageFilter.blur(sigmaX: 14, sigmaY: 14),
            child: Image(image: image, fit: BoxFit.cover),
          ),
          ColoredBox(color: Colors.black.withValues(alpha: .14)),
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 3),
            child: Image(image: image, fit: BoxFit.contain),
          ),
        ],
      );
}

class _CoverPhotoPicker extends StatelessWidget {
  const _CoverPhotoPicker({
    required this.photo,
    required this.existingUrl,
    required this.onTap,
  });
  final XFile? photo;
  final String? existingUrl;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final hasPhoto = photo != null || (existingUrl ?? '').isNotEmpty;
    final image = photo != null
        ? FileImage(File(photo!.path)) as ImageProvider
        : hasPhoto
            ? NetworkImage(existingUrl!)
            : null;
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(22),
      child: Container(
        height: 142,
        clipBehavior: Clip.antiAlias,
        decoration: BoxDecoration(
          color: const Color(0xFFE9EEE9),
          borderRadius: BorderRadius.circular(22),
          border: Border.all(color: AppColors.line),
        ),
        child: Stack(
          children: [
            if (image != null)
              Positioned.fill(child: _FullCampaignPhoto(image: image)),
            if (!hasPhoto)
              const Positioned(
                right: 18,
                bottom: -12,
                child: Icon(Icons.landscape_rounded,
                    color: Color(0xFFD1DDD5), size: 118),
              ),
            Positioned(
              left: 14,
              bottom: 14,
              child: Container(
                padding:
                    const EdgeInsets.symmetric(horizontal: 12, vertical: 9),
                decoration: BoxDecoration(
                  color: !hasPhoto
                      ? AppColors.navy
                      : Colors.black.withValues(alpha: .62),
                  borderRadius: BorderRadius.circular(13),
                ),
                child: Row(
                  children: [
                    Icon(
                      !hasPhoto
                          ? Icons.add_photo_alternate_outlined
                          : Icons.edit_outlined,
                      color: Colors.white,
                      size: 18,
                    ),
                    const SizedBox(width: 7),
                    Text(
                      !hasPhoto ? 'Add a cover photo' : 'Change photo',
                      style: const TextStyle(
                        color: Colors.white,
                        fontSize: 11,
                        fontWeight: FontWeight.w800,
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _TripTypeCard extends StatelessWidget {
  const _TripTypeCard({
    required this.icon,
    required this.title,
    required this.subtitle,
    required this.selected,
    required this.onTap,
  });
  final IconData icon;
  final String title;
  final String subtitle;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) => InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(21),
        child: AnimatedContainer(
          duration: const Duration(milliseconds: 220),
          padding: const EdgeInsets.all(15),
          decoration: BoxDecoration(
            color: selected ? AppColors.navy : Colors.white,
            borderRadius: BorderRadius.circular(21),
            border: Border.all(
              color: selected ? AppColors.navy : AppColors.line,
            ),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Icon(icon,
                  color: selected ? AppColors.gold : AppColors.navy, size: 27),
              const SizedBox(height: 15),
              Text(
                title,
                style: TextStyle(
                  color: selected ? Colors.white : AppColors.navy,
                  fontSize: 16,
                  fontWeight: FontWeight.w900,
                ),
              ),
              const SizedBox(height: 3),
              Text(
                subtitle,
                style: TextStyle(
                  color: selected ? Colors.white60 : AppColors.muted,
                  fontSize: 11,
                ),
              ),
            ],
          ),
        ),
      );
}

class _StepScroll extends StatelessWidget {
  const _StepScroll({required this.children});
  final List<Widget> children;

  @override
  Widget build(BuildContext context) => ListView(
        padding: const EdgeInsets.fromLTRB(20, 12, 20, 28),
        keyboardDismissBehavior: ScrollViewKeyboardDismissBehavior.onDrag,
        children: children,
      );
}

class _WizardCard extends StatelessWidget {
  const _WizardCard({required this.children});
  final List<Widget> children;

  @override
  Widget build(BuildContext context) => Container(
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(23),
          border: Border.all(color: AppColors.line),
        ),
        child: Column(children: children),
      );
}

class _WizardNote extends StatelessWidget {
  const _WizardNote({
    required this.icon,
    required this.title,
    required this.message,
  });
  final IconData icon;
  final String title;
  final String message;

  @override
  Widget build(BuildContext context) => Container(
        padding: const EdgeInsets.all(14),
        decoration: BoxDecoration(
          color: const Color(0xFFEBF2EE),
          borderRadius: BorderRadius.circular(18),
        ),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Icon(icon, color: const Color(0xFF28685A), size: 21),
            const SizedBox(width: 11),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(title,
                      style: const TextStyle(
                          color: AppColors.navy, fontWeight: FontWeight.w800)),
                  const SizedBox(height: 3),
                  Text(message,
                      style: const TextStyle(
                          color: AppColors.muted, fontSize: 12, height: 1.35)),
                ],
              ),
            ),
          ],
        ),
      );
}

class _WizardError extends StatelessWidget {
  const _WizardError({required this.message});
  final String message;

  @override
  Widget build(BuildContext context) => Container(
        padding: const EdgeInsets.all(12),
        decoration: BoxDecoration(
          color: const Color(0xFFFFECE9),
          borderRadius: BorderRadius.circular(15),
          border: Border.all(color: const Color(0xFFF5B7AF)),
        ),
        child: Row(
          children: [
            const Icon(Icons.error_outline_rounded,
                color: Color(0xFFB42318), size: 20),
            const SizedBox(width: 9),
            Expanded(
              child: Text(message,
                  style: const TextStyle(color: Color(0xFF8F2118))),
            ),
          ],
        ),
      );
}

class _ActivityCatalogLoading extends StatelessWidget {
  const _ActivityCatalogLoading();

  @override
  Widget build(BuildContext context) => Container(
        padding: const EdgeInsets.all(14),
        decoration: BoxDecoration(
          color: const Color(0xFFF2F3EF),
          borderRadius: BorderRadius.circular(17),
        ),
        child: const Row(
          children: [
            SizedBox.square(
              dimension: 20,
              child: CircularProgressIndicator(
                color: AppColors.navy,
                strokeWidth: 2,
              ),
            ),
            SizedBox(width: 12),
            Text(
              'Loading Admin activity catalog…',
              style: TextStyle(
                color: AppColors.muted,
                fontWeight: FontWeight.w700,
              ),
            ),
          ],
        ),
      );
}

class _ActivityCatalogUnavailable extends StatelessWidget {
  const _ActivityCatalogUnavailable({required this.onRetry});
  final VoidCallback onRetry;

  @override
  Widget build(BuildContext context) => Container(
        padding: const EdgeInsets.all(14),
        decoration: BoxDecoration(
          color: const Color(0xFFFFF4E5),
          borderRadius: BorderRadius.circular(17),
          border: Border.all(color: const Color(0xFFF2D09A)),
        ),
        child: Row(
          children: [
            const Icon(Icons.sync_problem_rounded, color: Color(0xFF9A5B00)),
            const SizedBox(width: 11),
            const Expanded(
              child: Text(
                'The activity catalog could not be loaded from the backend.',
                style: TextStyle(
                  color: Color(0xFF754700),
                  fontSize: 12,
                  fontWeight: FontWeight.w700,
                ),
              ),
            ),
            TextButton(onPressed: onRetry, child: const Text('Retry')),
          ],
        ),
      );
}

class _ReviewPill extends StatelessWidget {
  const _ReviewPill({required this.label});
  final String label;

  @override
  Widget build(BuildContext context) => Container(
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
        decoration: BoxDecoration(
          color: Colors.white.withValues(alpha: .13),
          borderRadius: BorderRadius.circular(99),
        ),
        child: Text(label,
            style: const TextStyle(
                color: Colors.white,
                fontSize: 10,
                fontWeight: FontWeight.w800)),
      );
}

class _ReviewRow extends StatelessWidget {
  const _ReviewRow({
    required this.icon,
    required this.label,
    required this.value,
    this.last = false,
  });
  final IconData icon;
  final String label;
  final String value;
  final bool last;

  @override
  Widget build(BuildContext context) => Container(
        padding: const EdgeInsets.symmetric(vertical: 12),
        decoration: BoxDecoration(
          border: last
              ? null
              : const Border(bottom: BorderSide(color: AppColors.line)),
        ),
        child: Row(
          children: [
            Icon(icon, color: AppColors.navy, size: 21),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(label,
                      style: const TextStyle(
                          color: AppColors.muted, fontSize: 10)),
                  const SizedBox(height: 2),
                  Text(value,
                      style: const TextStyle(
                          color: AppColors.navy, fontWeight: FontWeight.w700)),
                ],
              ),
            ),
          ],
        ),
      );
}

class _CampaignCategory {
  const _CampaignCategory({required this.name, required this.subcategories});
  final String name;
  final List<String> subcategories;

  factory _CampaignCategory.fromJson(Map<String, dynamic> json) {
    final subcategories = (json['subcategories'] as List? ?? const [])
        .whereType<Map>()
        .map((item) => (item['name'] ?? '').toString().trim())
        .where((item) => item.isNotEmpty)
        .toList()
      ..sort();
    return _CampaignCategory(
      name: (json['name'] ?? '').toString().trim(),
      subcategories: subcategories,
    );
  }
}

class _TripProvince {
  const _TripProvince({
    required this.name,
    required this.districts,
    required this.destinations,
  });
  final String name;
  final List<String> districts;
  final Map<String, List<String>> destinations;

  factory _TripProvince.fromJson(Map<String, dynamic> json) {
    final districts = (json['districts'] as List? ?? const [])
        .map((item) => item.toString().trim())
        .where((item) => item.isNotEmpty)
        .toList();
    final destinations = <String, List<String>>{};
    for (final item
        in (json['districtItems'] as List? ?? const []).whereType<Map>()) {
      final district = (item['district'] ?? '').toString().trim();
      if (district.isEmpty) continue;
      destinations[district] = (item['places'] as List? ?? const [])
          .map((place) => place.toString().trim())
          .where((place) => place.isNotEmpty)
          .toList();
    }
    return _TripProvince(
      name: (json['province'] ?? json['name'] ?? '').toString().trim(),
      districts: districts,
      destinations: destinations,
    );
  }
}

String _genderVisibilityLabel(String value) => switch (value) {
      'male' => 'Men only',
      'female' => 'Women only',
      _ => 'All genders',
    };

String _label(String value) => value
    .trim()
    .toLowerCase()
    .split(RegExp(r'[_\s]+'))
    .where((part) => part.isNotEmpty)
    .map((part) => '${part[0].toUpperCase()}${part.substring(1)}')
    .join(' ');

String _formatDateTime(DateTime date) {
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
    'Dec'
  ];
  final hour = date.hour % 12 == 0 ? 12 : date.hour % 12;
  final minute = date.minute.toString().padLeft(2, '0');
  return '${date.day} ${months[date.month - 1]} ${date.year}, '
      '$hour:$minute ${date.hour >= 12 ? 'PM' : 'AM'}';
}
