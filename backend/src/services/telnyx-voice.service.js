const config = require('../config');

/**
 * Parse Telnyx Voice API v2 webhook for an inbound missed/forwarded call.
 * Returns null for events we should ignore (non-initiated, outbound legs, etc.).
 */
const parseInboundCallEvent = (body) => {
  const eventType = body?.data?.event_type;
  if (eventType !== 'call.initiated') return null;

  const payload = body.data.payload;
  if (!payload || payload.direction !== 'incoming') return null;

  const callControlId = payload.call_control_id;
  if (!callControlId) return null;

  const from = extractPhone(payload.from);
  const to = extractPhone(payload.to);
  if (!from || !to) return null;

  return { from, to, callControlId, eventId: body.data.id || null };
};

const extractPhone = (value) => {
  if (!value) return null;
  if (typeof value === 'string') return value.trim() || null;
  if (typeof value === 'object' && value.phone_number) return String(value.phone_number).trim();
  return null;
};

/**
 * Hang up an inbound Telnyx call leg to minimize voice charges.
 */
const hangupCall = async (callControlId) => {
  if (!config.telnyx.apiKey) {
    throw new Error('TELNYX_API_KEY is not configured');
  }

  const res = await fetch(
    `https://api.telnyx.com/v2/calls/${encodeURIComponent(callControlId)}/actions/hangup`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${config.telnyx.apiKey}`,
      },
      body: JSON.stringify({}),
    },
  );

  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.errors?.[0]?.detail || data.message || `Telnyx hangup failed (${res.status})`);
  }
};

module.exports = {
  parseInboundCallEvent,
  hangupCall,
};
