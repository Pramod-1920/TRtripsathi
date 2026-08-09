export type XpEventCatalogItem = {
  key: string;
  label: string;
  description: string;
  source: string;
  contextFields: string[];
  recommendedRepeat: string;
};

export const XP_EVENT_CATALOG: XpEventCatalogItem[] = [
  {
    key: 'campaign_completed',
    label: 'Campaign completed',
    description: 'Awarded to accepted participants after host verification.',
    source: 'Verified campaign completion',
    contextFields: [
      'campaignId',
      'difficulty',
      'district',
      'locationKey',
      'activityType',
      'solo',
    ],
    recommendedRepeat: 'once_per_campaign',
  },
  {
    key: 'host_campaign_completed',
    label: 'Hosted campaign completed',
    description: 'Awarded to the host after campaign completion is verified.',
    source: 'Verified campaign completion',
    contextFields: [
      'campaignId',
      'difficulty',
      'district',
      'locationKey',
      'activityType',
      'hostOnly',
    ],
    recommendedRepeat: 'once_per_campaign',
  },
  {
    key: 'first_trek_new_district',
    label: 'Trek in a new district',
    description: 'Evaluated for participants when a campaign is verified.',
    source: 'Verified campaign completion',
    contextFields: [
      'campaignId',
      'difficulty',
      'district',
      'locationKey',
      'activityType',
      'solo',
    ],
    recommendedRepeat: 'once_per_district',
  },
  {
    key: 'solo_photo_uploaded',
    label: 'Solo photo approved',
    description: 'Awarded after an admin approves a solo verification photo.',
    source: 'Photo verification approval',
    contextFields: ['campaignId', 'solo'],
    recommendedRepeat: 'once_per_campaign',
  },
  {
    key: 'group_photo_uploaded',
    label: 'Group photo approved',
    description: 'Awarded after an admin approves a group verification photo.',
    source: 'Photo verification approval',
    contextFields: ['campaignId', 'solo'],
    recommendedRepeat: 'once_per_campaign',
  },
  {
    key: 'received_five_star_rating',
    label: 'Received a five-star rating',
    description: 'Evaluated when another user submits a campaign rating.',
    source: 'User rating submission',
    contextFields: ['campaignId', 'rating'],
    recommendedRepeat: 'once_per_campaign',
  },
  {
    key: 'referral_completed_trek',
    label: 'Referral completed a trek',
    description:
      'Awarded to a referrer after the referred user completes a trek.',
    source: 'Verified referred-user completion',
    contextFields: ['referredUserId'],
    recommendedRepeat: 'once_per_referred_user',
  },
];

export const REGISTERED_XP_EVENT_KEYS = new Set(
  XP_EVENT_CATALOG.map((event) => event.key),
);
