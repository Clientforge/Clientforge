/**
 * Auto shop (Southlake) booking CTA — call the shop instead of a booking URL.
 */

function formatDisplayPhone(raw) {
  const digits = String(raw || '').replace(/\D/g, '');
  const ten = digits.length === 11 && digits.startsWith('1') ? digits.slice(1) : digits.slice(-10);
  if (ten.length !== 10) return String(raw || '').trim();
  return `(${ten.slice(0, 3)}) ${ten.slice(3, 6)}-${ten.slice(6)}`;
}

function buildAutoShopBookingCta(phoneNumber) {
  const formatted = formatDisplayPhone(phoneNumber);
  if (!formatted) {
    return 'Give us a call and our team will help you find the best appointment time';
  }
  return `Give us a call at ${formatted} and our team will help you find the best appointment time`;
}

/** Prefer a real http(s) booking URL; otherwise use the phone CTA. */
function resolveAutoShopBookingLink(tenant) {
  const url = (tenant?.booking_link || '').trim();
  if (url && /^https?:\/\//i.test(url)) return url;
  return buildAutoShopBookingCta(tenant?.phone_number);
}

function buildAutoShopBookingTemplateExtras(tenant) {
  const businessPhone = formatDisplayPhone(tenant?.phone_number);
  const bookingCta = buildAutoShopBookingCta(tenant?.phone_number);
  const bookingLink = resolveAutoShopBookingLink(tenant);
  return { businessPhone, bookingCta, bookingLink };
}

module.exports = {
  formatDisplayPhone,
  buildAutoShopBookingCta,
  resolveAutoShopBookingLink,
  buildAutoShopBookingTemplateExtras,
};
