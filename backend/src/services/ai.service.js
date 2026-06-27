const OpenAI = require('openai');
const db = require('../db/connection');

const getClient = () => {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw Object.assign(new Error('OpenAI API key not configured. Add OPENAI_API_KEY to your .env file.'), {
      statusCode: 503, isOperational: true,
    });
  }
  return new OpenAI({ apiKey });
};

const generateFollowUpSchedule = async (tenantId) => {
  const result = await db.query(
    `SELECT name, industry, description, target_audience, tone, booking_link
     FROM tenants WHERE id = $1`,
    [tenantId],
  );

  if (result.rows.length === 0) {
    throw Object.assign(new Error('Tenant not found'), { statusCode: 404, isOperational: true });
  }

  const t = result.rows[0];

  const prompt = `You are an expert SMS copywriter specializing in lead conversion for appointment-based businesses. Generate a 7-step follow-up SMS sequence for this business.

BUSINESS CONTEXT:
- Business Name: ${t.name}
- Industry: ${t.industry || 'General services'}
- Description: ${t.description || 'An appointment-based business'}
- Target Audience: ${t.target_audience || 'People who have shown interest in our services'}
- Tone: ${t.tone || 'friendly'}

RULES:
- Each message MUST be under 155 characters (one SMS segment)
- MUST use these exact template variables: {firstName}, {businessName}, {bookingLink}
- Messages should progressively increase in urgency from step 1 to step 7
- Step 1 (1 hour later): Gentle check-in
- Step 2 (4 hours later): Friendly nudge
- Step 3 (1 day later): Value reminder
- Step 4 (2 days later): Social proof or scarcity
- Step 5 (3 days later): Direct ask
- Step 6 (5 days later): Last chance tone
- Step 7 (7 days later): Final friendly farewell
- Make messages feel personal, not robotic
- Match the ${t.tone || 'friendly'} tone throughout
- Reference the specific industry/service naturally

RESPOND ONLY with valid JSON — an array of 7 objects:
[{"step":1,"delay_hours":1,"message":"..."},{"step":2,"delay_hours":4,"message":"..."},...]`;

  const openai = getClient();

  const completion = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [{ role: 'user', content: prompt }],
    temperature: 0.8,
    max_tokens: 1200,
  });

  const raw = completion.choices[0].message.content.trim();

  // Extract JSON from the response (handle markdown code blocks)
  let jsonStr = raw;
  const jsonMatch = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (jsonMatch) jsonStr = jsonMatch[1].trim();

  try {
    const schedule = JSON.parse(jsonStr);

    if (!Array.isArray(schedule) || schedule.length === 0) {
      throw new Error('Invalid response format');
    }

    return schedule.map((s, i) => ({
      step: i + 1,
      delay_hours: s.delay_hours || [1, 4, 24, 48, 72, 120, 168][i] || (i + 1) * 24,
      message: s.message,
    }));
  } catch (parseErr) {
    console.error('[AI] Failed to parse response:', raw);
    throw Object.assign(new Error('AI returned an invalid response. Please try again.'), {
      statusCode: 502, isOperational: true,
    });
  }
};

const refineFollowUpMessages = async (tenantId, currentSchedule, userInstruction) => {
  const result = await db.query(
    `SELECT name, industry, description, target_audience, tone
     FROM tenants WHERE id = $1`,
    [tenantId],
  );
  const t = result.rows[0];

  const prompt = `You are an expert SMS copywriter. A business wants to refine their follow-up SMS sequence.

BUSINESS: ${t.name} (${t.industry || 'General'}) — ${t.description || 'An appointment-based business'}
TONE: ${t.tone || 'friendly'}

CURRENT SEQUENCE:
${currentSchedule.map((s) => `Step ${s.step} (${s.delay_hours}h): "${s.message}"`).join('\n')}

USER REQUEST: "${userInstruction}"

Update the sequence based on the user's request. Keep the same number of steps and delay_hours unless they ask to change them. Use template variables: {firstName}, {businessName}, {bookingLink}. Keep each message under 155 characters.

RESPOND ONLY with valid JSON array:
[{"step":1,"delay_hours":1,"message":"..."},...]`;

  const openai = getClient();

  const completion = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [{ role: 'user', content: prompt }],
    temperature: 0.7,
    max_tokens: 1200,
  });

  const raw = completion.choices[0].message.content.trim();
  let jsonStr = raw;
  const jsonMatch = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (jsonMatch) jsonStr = jsonMatch[1].trim();

  try {
    const schedule = JSON.parse(jsonStr);
    return schedule.map((s, i) => ({
      step: i + 1,
      delay_hours: s.delay_hours || currentSchedule[i]?.delay_hours || (i + 1) * 24,
      message: s.message,
    }));
  } catch (parseErr) {
    console.error('[AI] Failed to parse refine response:', raw);
    throw Object.assign(new Error('AI returned an invalid response. Please try again.'), {
      statusCode: 502, isOperational: true,
    });
  }
};

const generateCampaignSequence = async (tenantId, { campaignName, promotionDetails, audienceDescription, waveCount, channel }) => {
  const result = await db.query(
    `SELECT name, industry, description, target_audience, tone, booking_link
     FROM tenants WHERE id = $1`,
    [tenantId],
  );

  if (result.rows.length === 0) {
    throw Object.assign(new Error('Tenant not found'), { statusCode: 404, isOperational: true });
  }

  const t = result.rows[0];
  const waves = waveCount || 4;
  const ch = channel || 'sms';

  const isSms = ch === 'sms';
  const isEmail = ch === 'email';
  const isBoth = ch === 'both';

  let channelRules;
  let jsonFormat;

  if (isSms) {
    channelRules = `CHANNEL: SMS only
- Each message MUST be under 155 characters (one SMS segment)
- Keep messages short, punchy, and action-oriented`;
    jsonFormat = `[{"step":1,"delay_days":0,"message":"..."},...]`;
  } else if (isEmail) {
    channelRules = `CHANNEL: Email only
- Each email can be 2-4 sentences (up to 500 characters)
- Include a compelling subject line for each wave
- Emails can be more detailed than SMS — include benefits, details, personality
- Still keep it concise and scannable — not a novel`;
    jsonFormat = `[{"step":1,"delay_days":0,"email_subject":"...","message":"..."},...]`;
  } else {
    channelRules = `CHANNEL: Both SMS and Email (every wave sends both)
- "message" = the SMS version: MUST be under 155 characters
- "email_body" = the email version: 2-4 sentences, more detailed
- "email_subject" = subject line for the email
- SMS should be a punchy summary; email expands with more detail`;
    jsonFormat = `[{"step":1,"delay_days":0,"message":"SMS text...","email_subject":"Subject...","email_body":"Longer email text..."},...]`;
  }

  const prompt = `You are an expert marketing copywriter specializing in customer re-engagement for appointment-based businesses.

BUSINESS CONTEXT:
- Business Name: ${t.name}
- Industry: ${t.industry || 'General services'}
- Description: ${t.description || 'An appointment-based business'}
- Target Audience: ${t.target_audience || 'Existing customers'}
- Tone: ${t.tone || 'friendly'}

CAMPAIGN DETAILS:
- Campaign Name: ${campaignName || 'Customer Re-engagement'}
- Promotion/Offer: ${promotionDetails || 'General check-in / re-engagement'}
- Target Audience for this campaign: ${audienceDescription || 'Past customers'}

${channelRules}

Generate a ${waves}-wave re-engagement sequence:
- Wave 1 (Day 0 — immediate): Warm re-introduction, mention the offer
- Wave 2 (Day 3): Friendly reminder with added value or detail
- Wave 3 (Day 6): Create gentle urgency or social proof${waves >= 4 ? '\n- Wave 4 (Day 10): Final friendly nudge, last chance' : ''}

RULES:
- MUST use template variables: {firstName}, {businessName}, {bookingLink}
- Messages should feel personal, warm, and action-oriented — NOT pushy
- Match the ${t.tone || 'friendly'} tone throughout
- Each wave should have a different angle (don't repeat the same pitch)
- Do NOT use hashtags, emojis, or all-caps words

RESPOND ONLY with valid JSON array:
${jsonFormat}`;

  const openai = getClient();

  const completion = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [{ role: 'user', content: prompt }],
    temperature: 0.8,
    max_tokens: isBoth ? 1500 : 800,
  });

  const raw = completion.choices[0].message.content.trim();
  let jsonStr = raw;
  const jsonMatch = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (jsonMatch) jsonStr = jsonMatch[1].trim();

  try {
    const sequence = JSON.parse(jsonStr);

    if (!Array.isArray(sequence) || sequence.length === 0) {
      throw new Error('Invalid response format');
    }

    const defaultDelays = [0, 3, 6, 10];
    return sequence.map((s, i) => ({
      step: i + 1,
      delay_days: s.delay_days !== undefined ? s.delay_days : (defaultDelays[i] ?? (i * 3)),
      message: s.message || '',
      ...(isEmail || isBoth ? {
        email_subject: s.email_subject || '',
        email_body: s.email_body || s.message || '',
      } : {}),
    }));
  } catch (parseErr) {
    console.error('[AI] Failed to parse campaign sequence:', raw);
    throw Object.assign(new Error('AI returned an invalid response. Please try again.'), {
      statusCode: 502, isOperational: true,
    });
  }
};

/**
 * Generate a short SMS reply to an inbound message (requires OPENAI_API_KEY).
 */
const BOOKING_INTENT_RE = /\b(book(?:ing)?|schedule|appointment|available|availability|link|reserve|reserv(?:e|ation)|slot|when\s+can\s+i|how\s+(?:do|can)\s+i\s+(?:book|schedule)|sign\s*up|set\s+up\s+an?\s+appointment)\b/i;

const GREETING_ONLY_RE = /^(hi|hello|hey|good\s+(?:morning|afternoon|evening)|howdy|yo|sup|what'?s\s+up)[!.?\s]*$/i;

const bookingLinkAlreadyInThread = (recentMessages, bookingLink) => {
  if (!bookingLink || !recentMessages?.length) return false;
  const needle = bookingLink.trim().toLowerCase();
  try {
    const host = new URL(needle.startsWith('http') ? needle : `https://${needle}`).host.toLowerCase();
    return recentMessages.some(
      (m) => m.direction === 'outbound'
        && m.body
        && (m.body.toLowerCase().includes(needle) || m.body.toLowerCase().includes(host)),
    );
  } catch {
    return recentMessages.some(
      (m) => m.direction === 'outbound' && m.body && m.body.toLowerCase().includes(needle),
    );
  }
};

const generateInboundSmsReply = async (tenantId, {
  firstName,
  inboundBody,
  recentMessages,
}) => {
  const result = await db.query(
    `SELECT name, industry, description, target_audience, tone, booking_link
     FROM tenants WHERE id = $1`,
    [tenantId],
  );

  if (result.rows.length === 0) {
    throw Object.assign(new Error('Tenant not found'), { statusCode: 404, isOperational: true });
  }

  const t = result.rows[0];
  const bookingLink = (t.booking_link || '').trim();
  const hasBookingLink = !!bookingLink;
  const linkAlreadySent = bookingLinkAlreadyInThread(recentMessages, bookingLink);
  const wantsBooking = BOOKING_INTENT_RE.test(inboundBody || '');
  const isGreetingOnly = GREETING_ONLY_RE.test((inboundBody || '').trim());

  const threadLines = (recentMessages || [])
    .map((m) => `${m.direction === 'inbound' ? 'Them' : 'Us'}: ${(m.body || '').slice(0, 500)}`)
    .join('\n');

  let bookingLinkRule;
  if (!hasBookingLink) {
    bookingLinkRule = `- No booking link is configured. Do not invent a URL; offer to help them book another way only if they ask about scheduling.`;
  } else if (linkAlreadySent) {
    bookingLinkRule = `- A booking link was already sent in this conversation. Do NOT paste the URL again unless they explicitly ask for the link again or say they cannot find it.
- NEVER say there is no booking link or that online booking is unavailable.
- Booking link (reference only — do not repeat unless asked): ${bookingLink}`;
  } else if (wantsBooking) {
    bookingLinkRule = `- They are asking about booking/scheduling. Share the booking link: ${bookingLink}
- NEVER say there is no booking link or that online booking is unavailable.`;
  } else if (isGreetingOnly) {
    bookingLinkRule = `- This is a greeting only. Reply warmly and offer to help — do NOT include the booking link yet.
- Booking link (hold until they ask about booking): ${bookingLink}`;
  } else {
    bookingLinkRule = `- Answer their question directly using the business profile. Do NOT include the booking link in this reply.
- Only mention booking if a brief soft close fits naturally (e.g. "Happy to help if you want to book later") — without pasting the URL.
- If they later ask about booking, scheduling, availability, or a link, share: ${bookingLink}
- NEVER say there is no booking link or that online booking is unavailable.`;
  }

  const prompt = `You are replying via SMS on behalf of a local business. Write ONE reply to the customer's latest message.

Your job is to be helpful and build trust — like a good front desk person. Answer what they asked. Do not push booking unless they bring it up or clearly want to schedule.

AUTHORITATIVE BUSINESS PROFILE (single source of truth for facts):
- Name: ${t.name}
- Industry: ${t.industry || 'services'}
- Description: ${t.description || 'A customer-focused business'}
- Audience: ${t.target_audience || 'local customers'}
- Tone: ${t.tone || 'friendly'}

FIRST NAME (if known): ${firstName || 'there'}

RECENT SMS THREAD (oldest first) — continuity and tone only. Do not copy sales CTAs or repeated links from prior "Us:" messages.

${threadLines || '(no prior messages since profile update)'}

THEIR LATEST MESSAGE:
${inboundBody}

RULES:
- Reply in ${t.tone || 'friendly'} tone; be helpful, natural, and concise.
- Answer ONLY what they asked — do not add unrelated info or extra CTAs.
- Maximum 300 characters (aim for one SMS segment when possible).
- No markdown, no bullet lists, no emojis unless essential.
- Facts about the business must match the AUTHORITATIVE BUSINESS PROFILE only.
${bookingLinkRule}
- Do not ask them to list name, phone, email, and service details unless they want to book by message and no online link applies.
- Do not claim discounts or legal facts unless implied in the description above.
- If they opted out or said STOP, apologize briefly and do not market (still comply — but normally we block those before calling you).

Respond with ONLY the SMS text, no quotes or labels.`;

  const openai = getClient();

  const completion = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [{ role: 'user', content: prompt }],
    temperature: 0.65,
    max_tokens: 220,
  });

  let text = completion.choices[0].message.content.trim();
  text = text.replace(/^["']|["']$/g, '').trim();
  if (text.length > 480) text = text.slice(0, 477) + '...';
  return text;
};

const APPOINTMENT_CATEGORY_META = {
  confirmations: {
    label: 'Booking Confirmations',
    hint: '1 immediate confirmation when an appointment is created.',
    defaultOffsets: [0],
  },
  reminders: {
    label: 'Reminder Sequences',
    hint: '2 reminders: 24 hours before and 2 hours before the appointment.',
    defaultOffsets: [-1440, -120],
  },
  postAppointment: {
    label: 'Post-Appointment Follow-ups',
    hint: '1 thank-you / check-in message 24 hours after the appointment.',
    defaultOffsets: [1440],
  },
  reviewRequests: {
    label: 'Review Requests',
    hint: '1 review request 48 hours after the appointment.',
    defaultOffsets: [2880],
  },
  rebooking: {
    label: 'Rebooking Campaigns',
    hint: '1 rebooking nudge 30 days after the appointment.',
    defaultOffsets: [43200],
  },
};

const parseAiJsonArray = (raw) => {
  let jsonStr = raw.trim();
  const jsonMatch = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (jsonMatch) jsonStr = jsonMatch[1].trim();
  return JSON.parse(jsonStr);
};

const normalizeAiAppointmentSteps = (steps, fallbackOffsets) => {
  if (!Array.isArray(steps) || steps.length === 0) {
    throw new Error('Invalid response format');
  }

  return steps.map((s, i) => ({
    id: s.id || `ai-${Date.now()}-${i}`,
    enabled: s.enabled !== false,
    channel: ['sms', 'email', 'both'].includes(s.channel) ? s.channel : 'sms',
    offset_minutes: Number.isFinite(Number(s.offset_minutes))
      ? Number(s.offset_minutes)
      : (fallbackOffsets[i] ?? fallbackOffsets[fallbackOffsets.length - 1] ?? 0),
    message: String(s.message || '').trim(),
    email_subject: String(s.email_subject || s.emailSubject || 'Message from {businessName}').trim(),
  }));
};

const generateAppointmentMessages = async (tenantId, categoryKey) => {
  const meta = APPOINTMENT_CATEGORY_META[categoryKey];
  if (!meta) {
    throw Object.assign(new Error('Invalid category'), { statusCode: 400, isOperational: true });
  }

  const result = await db.query(
    `SELECT name, industry, description, target_audience, tone, booking_link
     FROM tenants WHERE id = $1`,
    [tenantId],
  );
  if (result.rows.length === 0) {
    throw Object.assign(new Error('Tenant not found'), { statusCode: 404, isOperational: true });
  }
  const t = result.rows[0];

  const prompt = `You are an expert SMS/email copywriter for appointment-based businesses. Generate messages for: ${meta.label}.

BUSINESS CONTEXT:
- Business Name: ${t.name}
- Industry: ${t.industry || 'General services'}
- Description: ${t.description || 'An appointment-based business'}
- Target Audience: ${t.target_audience || 'Customers with scheduled appointments'}
- Tone: ${t.tone || 'friendly'}

CATEGORY: ${meta.label}
${meta.hint}

RULES:
- SMS messages MUST be under 155 characters when channel is sms or both
- MUST use template variables where natural: {firstName}, {businessName}, {serviceName}, {appointmentDate}, {appointmentTime}, {bookingLink}, {reviewLink}
- offset_minutes: negative = before appointment, positive = after, 0 = immediately on booking
- Suggested offsets (minutes): ${meta.defaultOffsets.join(', ')}
- channel: "sms", "email", or "both"
- Include email_subject for email/both channels

RESPOND ONLY with valid JSON:
{"steps":[{"enabled":true,"channel":"sms","offset_minutes":0,"message":"...","email_subject":"..."}]}`;

  const openai = getClient();
  const completion = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [{ role: 'user', content: prompt }],
    temperature: 0.8,
    max_tokens: 1200,
  });

  try {
    const parsed = parseAiJsonArray(completion.choices[0].message.content);
    const steps = normalizeAiAppointmentSteps(parsed.steps || parsed, meta.defaultOffsets);
    return { category: categoryKey, steps };
  } catch (parseErr) {
    console.error('[AI] Failed to parse appointment generate response:', parseErr.message);
    throw Object.assign(new Error('AI returned an invalid response. Please try again.'), {
      statusCode: 502, isOperational: true,
    });
  }
};

const refineAppointmentMessages = async (tenantId, categoryKey, currentSteps, userInstruction) => {
  const meta = APPOINTMENT_CATEGORY_META[categoryKey];
  if (!meta) {
    throw Object.assign(new Error('Invalid category'), { statusCode: 400, isOperational: true });
  }
  if (!userInstruction) {
    throw Object.assign(new Error('instruction is required'), { statusCode: 400, isOperational: true });
  }

  const result = await db.query(
    `SELECT name, industry, description, target_audience, tone
     FROM tenants WHERE id = $1`,
    [tenantId],
  );
  const t = result.rows[0];

  const prompt = `You are an expert SMS/email copywriter. Refine appointment automation messages for: ${meta.label}.

BUSINESS: ${t.name} (${t.industry || 'General'}) — ${t.tone || 'friendly'} tone

CURRENT STEPS:
${(currentSteps || []).map((s, i) => `Step ${i + 1} (${s.offset_minutes} min, ${s.channel}): "${s.message}"`).join('\n')}

USER REQUEST: "${userInstruction}"

Update the steps based on the user's request. Keep the same number of steps and offset_minutes unless they ask to change timing. Use variables: {firstName}, {businessName}, {serviceName}, {appointmentDate}, {appointmentTime}, {bookingLink}, {reviewLink}. SMS under 155 chars.

RESPOND ONLY with valid JSON:
{"steps":[{"enabled":true,"channel":"sms","offset_minutes":0,"message":"...","email_subject":"..."}]}`;

  const openai = getClient();
  const completion = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [{ role: 'user', content: prompt }],
    temperature: 0.7,
    max_tokens: 1200,
  });

  try {
    const parsed = parseAiJsonArray(completion.choices[0].message.content);
    const fallbackOffsets = (currentSteps || []).map((s) => s.offset_minutes);
    const steps = normalizeAiAppointmentSteps(parsed.steps || parsed, fallbackOffsets);
    return { category: categoryKey, steps };
  } catch (parseErr) {
    console.error('[AI] Failed to parse appointment refine response:', parseErr.message);
    throw Object.assign(new Error('AI returned an invalid response. Please try again.'), {
      statusCode: 502, isOperational: true,
    });
  }
};

module.exports = {
  generateFollowUpSchedule,
  refineFollowUpMessages,
  generateCampaignSequence,
  generateInboundSmsReply,
  generateAppointmentMessages,
  refineAppointmentMessages,
};
