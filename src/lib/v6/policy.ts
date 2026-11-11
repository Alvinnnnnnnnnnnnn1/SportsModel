/** Separate from approved V5 methodology. Activation is an independently persisted owner action. */
export const V6_POLICY = Object.freeze({
  id: 'v6-uncapped-paper-1', version: 1, currency: 'AUD', timezone: 'Australia/Melbourne',
  openingReferenceCents: 500000, stakeCents: 5000, participation: 'uncapped_notional',
  minExpectedValue: .02, maxQuoteAgeSeconds: 300, exploratoryEnabled: false,
  actualWagerCapability: false,
} as const);
