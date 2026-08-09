import 'package:flutter_test/flutter_test.dart';
import 'package:trtripsathi_mobile/features/campaigns/domain/campaign_lifecycle.dart';

void main() {
  final now = DateTime.utc(2026, 8, 9, 12);

  test('future created campaigns remain open', () {
    expect(
      campaignJourneyState(
        {
          'lifecyclePhase': 'open',
          'startDate': '2026-08-12T12:00:00Z',
          'endDate': '2026-08-13T12:00:00Z',
        },
        at: now,
      ),
      CampaignJourneyState.open,
    );
  });

  test('a campaign between start and end is ongoing', () {
    expect(
      campaignJourneyState(
        {
          'lifecyclePhase': 'started',
          'startDate': '2026-08-09T08:00:00Z',
          'endDate': '2026-08-10T08:00:00Z',
        },
        at: now,
      ),
      CampaignJourneyState.ongoing,
    );
  });

  test('a campaign moves to history after its end date', () {
    expect(
      campaignJourneyState(
        {
          'startDate': '2026-08-07T08:00:00Z',
          'endDate': '2026-08-08T08:00:00Z',
        },
        at: now,
      ),
      CampaignJourneyState.expired,
    );
  });

  test('completed and cancelled campaigns are expired journeys', () {
    expect(
      campaignJourneyState({'lifecyclePhase': 'completed'}, at: now),
      CampaignJourneyState.expired,
    );
    expect(
      campaignJourneyState({'lifecyclePhase': 'cancelled'}, at: now),
      CampaignJourneyState.expired,
    );
  });
}
