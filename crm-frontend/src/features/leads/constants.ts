export const LEAD_STATUSES = [
  'NEW',
  'CONTACTED',
  'QUALIFIED',
  'UNQUALIFIED',
  'NURTURING',
  'CONVERTED',
  'LOST',
] as const;

export const LEAD_SOURCES = [
  'WEBSITE',
  'REFERRAL',
  'SOCIAL_MEDIA',
  'EMAIL_CAMPAIGN',
  'GOOGLE_ADS',
  'FACEBOOK_ADS',
  'COLD_CALL',
  'TRADE_SHOW',
  'PARTNER',
  'OTHER',
] as const;

export type LeadStatus = (typeof LEAD_STATUSES)[number];
export type LeadSource = (typeof LEAD_SOURCES)[number];
