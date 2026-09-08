/**
 * Southlake Autocare — auto shop workflow defaults.
 */

const SOUTHLAKE_POST_SERVICE_REVIEW_MESSAGE =
  "Hi {firstName}! this is Southlake Auto Care! We'd love to hear how your recent visit went. "
  + 'We really value your feedback and appreciate you taking a moment to let us know! '
  + 'https://service.southlakeautocare.com/leave-a-review';

/** Messages written by migrations 058/060 that should be replaced with the review ask. */
const MIGRATION_DEFAULT_POST_SERVICE_PATTERNS = [
  'Hope everything went well with your {serviceName}',
  'Book your next visit anytime',
  '{bookingCta}',
];

function isMigrationDefaultPostServiceMessage(message) {
  const text = String(message || '');
  if (!text) return false;
  return MIGRATION_DEFAULT_POST_SERVICE_PATTERNS.some((fragment) => text.includes(fragment));
}

module.exports = {
  SOUTHLAKE_POST_SERVICE_REVIEW_MESSAGE,
  MIGRATION_DEFAULT_POST_SERVICE_PATTERNS,
  isMigrationDefaultPostServiceMessage,
};
