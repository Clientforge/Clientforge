export const G2G_REVIEW_MESSAGES = [
  'Your vehicle may require a quick review. Our team will follow up with a custom offer.',
  'We\u2019re reviewing your vehicle details. Our team will reach out shortly with a custom offer.',
  'Thanks! Your vehicle needs a quick review before we can finalize an offer. Our team will be in touch soon.',
  'Almost there! Our team will review your vehicle information and follow up with a personalized offer.',
  'We\u2019ve received your vehicle details. One of our team members will review them and contact you with an offer.',
];

export function pickReviewMessage(sessionId) {
  const key = String(sessionId || 'default');
  const hash = [...key].reduce((n, c) => n + c.charCodeAt(0), 0);
  return G2G_REVIEW_MESSAGES[Math.abs(hash) % G2G_REVIEW_MESSAGES.length];
}
