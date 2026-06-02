/**
 * Normalize Meta Instagram messaging webhook payloads.
 * @see https://developers.facebook.com/docs/messenger-platform/instagram
 */

function parseInstagramWebhook(body) {
  if (!body || body.object !== 'instagram') return [];

  const events = [];
  for (const entry of body.entry || []) {
    const instagramAccountId = String(entry.id || '');
    for (const item of entry.messaging || []) {
      const message = item.message;
      if (!message || message.is_echo) continue;

      const text = message.text?.trim();
      if (!text) continue;

      events.push({
        instagramAccountId,
        senderId: String(item.sender?.id || ''),
        recipientId: String(item.recipient?.id || ''),
        messageId: message.mid ? String(message.mid) : null,
        text,
        timestamp: item.timestamp ? Number(item.timestamp) : Date.now(),
      });
    }
  }
  return events;
}

module.exports = {
  parseInstagramWebhook,
};
