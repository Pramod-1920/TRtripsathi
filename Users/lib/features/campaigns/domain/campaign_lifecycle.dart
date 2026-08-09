enum CampaignJourneyState { open, ongoing, expired }

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
