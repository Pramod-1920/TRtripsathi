enum CampaignJourneyState { open, ongoing, expired }

String campaignStatusLabel(
  Map<String, dynamic> campaign, {
  DateTime? at,
}) {
  final now = at ?? DateTime.now();
  final phase = (campaign['lifecyclePhase'] ?? '').toString().toLowerCase();
  final status = (campaign['status'] ?? '').toString().toLowerCase();
  final approval = (campaign['approvalStatus'] ?? '').toString().toLowerCase();
  final start = _campaignDate(campaign['startDate']);
  final explicitEnd = _campaignDate(campaign['endDate']);
  final durationDays = (campaign['durationDays'] as num?)?.toInt() ?? 1;
  final calculatedEnd = start?.add(Duration(days: durationDays.clamp(1, 365)));
  final end = explicitEnd ?? calculatedEnd;
  final verificationDeadline = _campaignDate(campaign['verificationDeadline']);
  final awaitingPhotoVerification = campaign['awaitingVerification'] == true &&
      (verificationDeadline == null || verificationDeadline.isAfter(now));

  if (campaign['minimumParticipantDecisionRequired'] == true) {
    return 'Host Decision Required';
  }

  // A completed campaign has a short evidence-upload window. Keep that state
  // visible instead of immediately presenting it as expired.
  if (awaitingPhotoVerification) return 'Photo Verification';

  if (campaign['failed'] == true ||
      phase == 'cancelled' ||
      status == 'cancelled') {
    return 'Campaign Expired';
  }

  if (campaign['completed'] == true ||
      phase == 'completed' ||
      status == 'completed' ||
      (end != null && !end.isAfter(now))) {
    return 'Campaign Expired';
  }

  if (approval == 'rejected') return 'Rejected';
  if (approval == 'submitted') return 'Awaiting Approval';
  if (approval == 'draft' || phase == 'draft') return 'Draft';

  if (phase == 'verification') return 'Verification in Progress';
  if (phase == 'planning') return 'Planning';
  if (phase == 'ready') return 'Happening Soon';

  if (phase == 'started' ||
      status == 'ongoing' ||
      (start != null &&
          !start.isAfter(now) &&
          (end == null || end.isAfter(now)))) {
    return 'Ongoing';
  }

  if (start != null && start.isAfter(now)) return 'Happening Soon';
  if (phase == 'open' || status == 'active' || status == 'open') {
    return 'Active';
  }

  return _campaignLabel(phase.isNotEmpty ? phase : status);
}

CampaignJourneyState campaignJourneyState(
  Map<String, dynamic> campaign, {
  DateTime? at,
}) {
  final now = at ?? DateTime.now();
  final phase = (campaign['lifecyclePhase'] ?? '').toString().toLowerCase();
  final status = (campaign['status'] ?? '').toString().toLowerCase();
  final completed = campaign['completed'] == true;
  final failed = campaign['failed'] == true;
  final start = _campaignDate(campaign['startDate']);
  final explicitEnd = _campaignDate(campaign['endDate']);
  final durationDays = (campaign['durationDays'] as num?)?.toInt() ?? 1;
  final calculatedEnd = start?.add(Duration(days: durationDays.clamp(1, 365)));
  final end = explicitEnd ?? calculatedEnd;

  if (completed ||
      failed ||
      phase == 'completed' ||
      phase == 'cancelled' ||
      status == 'completed' ||
      status == 'cancelled' ||
      (end != null && !end.isAfter(now))) {
    return CampaignJourneyState.expired;
  }

  if (phase == 'started' ||
      status == 'ongoing' ||
      (start != null &&
          !start.isAfter(now) &&
          (end == null || end.isAfter(now)))) {
    return CampaignJourneyState.ongoing;
  }

  return CampaignJourneyState.open;
}

DateTime? _campaignDate(dynamic raw) =>
    DateTime.tryParse((raw ?? '').toString())?.toLocal();

String _campaignLabel(String value) => value
    .trim()
    .toLowerCase()
    .split(RegExp(r'[_\s]+'))
    .where((part) => part.isNotEmpty)
    .map((part) => '${part[0].toUpperCase()}${part.substring(1)}')
    .join(' ');
