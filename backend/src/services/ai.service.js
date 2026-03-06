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

module.exports = { generateFollowUpSchedule, refineFollowUpMessages, generateCampaignSequence };
