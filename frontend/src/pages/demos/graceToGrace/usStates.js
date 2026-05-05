/**
 * US states + DC for pickup address forms (values = USPS abbreviations).
 */

const STATE_ROWS = [
  ['AL', 'Alabama'],
  ['AK', 'Alaska'],
  ['AZ', 'Arizona'],
  ['AR', 'Arkansas'],
  ['CA', 'California'],
  ['CO', 'Colorado'],
  ['CT', 'Connecticut'],
  ['DE', 'Delaware'],
  ['DC', 'District of Columbia'],
  ['FL', 'Florida'],
  ['GA', 'Georgia'],
  ['HI', 'Hawaii'],
  ['ID', 'Idaho'],
  ['IL', 'Illinois'],
  ['IN', 'Indiana'],
  ['IA', 'Iowa'],
  ['KS', 'Kansas'],
  ['KY', 'Kentucky'],
  ['LA', 'Louisiana'],
  ['ME', 'Maine'],
  ['MD', 'Maryland'],
  ['MA', 'Massachusetts'],
  ['MI', 'Michigan'],
  ['MN', 'Minnesota'],
  ['MS', 'Mississippi'],
  ['MO', 'Missouri'],
  ['MT', 'Montana'],
  ['NE', 'Nebraska'],
  ['NV', 'Nevada'],
  ['NH', 'New Hampshire'],
  ['NJ', 'New Jersey'],
  ['NM', 'New Mexico'],
  ['NY', 'New York'],
  ['NC', 'North Carolina'],
  ['ND', 'North Dakota'],
  ['OH', 'Ohio'],
  ['OK', 'Oklahoma'],
  ['OR', 'Oregon'],
  ['PA', 'Pennsylvania'],
  ['RI', 'Rhode Island'],
  ['SC', 'South Carolina'],
  ['SD', 'South Dakota'],
  ['TN', 'Tennessee'],
  ['TX', 'Texas'],
  ['UT', 'Utah'],
  ['VT', 'Vermont'],
  ['VA', 'Virginia'],
  ['WA', 'Washington'],
  ['WV', 'West Virginia'],
  ['WI', 'Wisconsin'],
  ['WY', 'Wyoming'],
].map(([value, label]) => ({ value, label }));

STATE_ROWS.sort((a, b) => a.label.localeCompare(b.label));

export const US_STATE_OPTIONS = [{ value: '', label: 'Select state' }, ...STATE_ROWS];

/** Strip to digits; true if 5 or 9 digits (ZIP+4). */
export function isValidUsZipInput(raw) {
  const d = String(raw ?? '').replace(/\D/g, '');
  return d.length === 5 || d.length === 9;
}

/** Format digits as 12345 or 12345-6789 for the composed address line. */
export function zFormatZipForAddress(raw) {
  const d = String(raw ?? '').replace(/\D/g, '').slice(0, 9);
  if (d.length === 9) return `${d.slice(0, 5)}-${d.slice(5)}`;
  return d.slice(0, 5);
}

/**
 * Single line for SMS / sell-intent API (max 500 chars server-side).
 */
export function composeSellAddress({ street, city, state, zip }) {
  const zipPart = zFormatZipForAddress(zip);
  return `${street.trim()}, ${city.trim()}, ${state} ${zipPart}`;
}
