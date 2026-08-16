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

  test('expired date overrides a stale active lifecycle status', () {
    expect(
      campaignStatusLabel(
        {
          'lifecyclePhase': 'open',
          'status': 'active',
          'endDate': '2026-08-08T08:00:00Z',
        },
        at: now,
      ),
      'Campaign Expired',
    );
  });

  test('active completion evidence window shows photo verification', () {
    expect(
      campaignStatusLabel(
        {
          'lifecyclePhase': 'completed',
          'completed': true,
          'awaitingVerification': true,
          'verificationDeadline': '2026-08-10T08:00:00Z',
          'endDate': '2026-08-09T08:00:00Z',
        },
        at: now,
      ),
      'Photo Verification',
    );
  });

  test('ready and future campaigns show happening soon', () {
    expect(
      campaignStatusLabel(
        {
          'lifecyclePhase': 'ready',
          'startDate': '2026-08-10T08:00:00Z',
        },
        at: now,
      ),
      'Happening Soon',
    );
    expect(
      campaignStatusLabel(
        {
          'lifecyclePhase': 'open',
          'approvalStatus': 'approved',
          'startDate': '2026-08-12T08:00:00Z',
        },
        at: now,
      ),
      'Happening Soon',
    );
  });

  test('planning verification phase has an explicit status', () {
    expect(
      campaignStatusLabel(
        {
          'lifecyclePhase': 'verification',
          'approvalStatus': 'approved',
        },
        at: now,
      ),
      'Verification in Progress',
    );
  });

  test('a paused low-enrollment campaign asks for the host decision', () {
    expect(
      campaignStatusLabel(
        {
          'lifecyclePhase': 'open',
          'minimumParticipantDecisionRequired': true,
          'endDate': '2026-08-08T08:00:00Z',
        },
        at: now,
      ),
      'Host Decision Required',
    );
  });
}
