const db = require('../db/connection');
const { getTenantTimezone, scheduledTodayInTimezone } = require('../utils/tenantTimezone');
const smsService = require('./sms.service');
const compliance = require('./compliance.service');
const tenantPhoneService = require('./tenant-phone.service');
const { normalizePhone } = require('./lead.service');
const instagramService = require('./instagram.service');

const sortAndPaginateConversations = (conversations, options = {}) => {
  const { page = 1, limit = 25 } = options;

  conversations.sort((a, b) => {
    if (a.needsReply !== b.needsReply) return a.needsReply ? -1 : 1;
    const aTime = a.lastActivityAt ? new Date(a.lastActivityAt).getTime() : 0;
    const bTime = b.lastActivityAt ? new Date(b.lastActivityAt).getTime() : 0;
    return bTime - aTime;
  });

  const needsReplyCount = conversations.filter((c) => c.needsReply).length;

  if (options.needsReply === 'true' || options.needsReply === true) {
    const filtered = conversations.filter((c) => c.needsReply);
    const total = filtered.length;
    const offset = (page - 1) * limit;
    return {
      conversations: filtered.slice(offset, offset + limit),
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) || 1 },
      needsReplyCount,
    };
  }

  const total = conversations.length;
  const offset = (page - 1) * limit;
  return {
    conversations: conversations.slice(offset, offset + limit),
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit) || 1,
    },
    needsReplyCount,
  };
};

const getParticipantPhones = async (tenantId) => {
  const result = await db.query(
    `SELECT DISTINCT (CASE WHEN direction = 'inbound' THEN from_number ELSE to_number END) AS phone
     FROM messages
     WHERE tenant_id = $1
       AND ((direction = 'inbound' AND from_number IS NOT NULL)
            OR (direction = 'outbound' AND to_number IS NOT NULL))`,
    [tenantId],
  );
  const phones = result.rows.map((r) => r.phone).filter(Boolean);
  return [...new Set(phones.map((p) => normalizePhone(p)))];
};

/**
 * Resolve participant (lead or contact) by phone. Prefer lead if both exist.
 */
const resolveParticipant = async (tenantId, phone) => {
  const normalized = normalizePhone(phone);
  const leadResult = await db.query(
    'SELECT id, first_name, last_name, phone, email, status FROM leads WHERE tenant_id = $1 AND phone = $2',
    [tenantId, normalized],
  );
  if (leadResult.rows.length > 0) {
    return {
      participantType: 'lead',
      id: leadResult.rows[0].id,
      firstName: leadResult.rows[0].first_name,
      lastName: leadResult.rows[0].last_name,
      phone: leadResult.rows[0].phone,
      email: leadResult.rows[0].email,
      status: leadResult.rows[0].status,
    };
  }
  const contactResult = await db.query(
    'SELECT id, first_name, last_name, phone, email FROM contacts WHERE tenant_id = $1 AND phone = $2',
    [tenantId, normalized],
  );
  if (contactResult.rows.length > 0) {
    return {
      participantType: 'contact',
      id: contactResult.rows[0].id,
      firstName: contactResult.rows[0].first_name,
      lastName: contactResult.rows[0].last_name,
      phone: contactResult.rows[0].phone,
      email: contactResult.rows[0].email,
      status: null,
    };
  }
  return null;
};

/**
 * Get last message for a participant phone.
 */
const getLastMessageForPhone = async (tenantId, phone) => {
  const digits = normalizePhone(phone).replace(/\D/g, '');
  const result = await db.query(
    `SELECT id, body, direction, message_type, created_at
     FROM messages m
     WHERE m.tenant_id = $1
       AND (
         (m.direction = 'inbound' AND regexp_replace(COALESCE(m.from_number,''), '[^0-9]', '', 'g') = $2)
         OR (m.direction = 'outbound' AND regexp_replace(COALESCE(m.to_number,''), '[^0-9]', '', 'g') = $2)
       )
     ORDER BY m.created_at DESC
     LIMIT 1`,
    [tenantId, digits],
  );
  return result.rows[0] || null;
};

/**
 * List conversations for a tenant (SMS + Instagram).
 */
const listConversations = async (tenantId, options = {}) => {
  const { search } = options;
  const phones = await getParticipantPhones(tenantId);

  const conversations = [];
  for (const phone of phones) {
    const participant = await resolveParticipant(tenantId, phone);
    if (!participant) continue;

    const lastMsg = await getLastMessageForPhone(tenantId, phone);
    if (!lastMsg) continue;

    const displayName = [participant.firstName, participant.lastName].filter(Boolean).join(' ') || phone;

    if (search) {
      const searchLower = search.toLowerCase();
      const matchesSearch =
        displayName.toLowerCase().includes(searchLower) ||
        phone.includes(search.replace(/\D/g, '')) ||
        (participant.email || '').toLowerCase().includes(searchLower);
      if (!matchesSearch) continue;
    }

    conversations.push({
      channel: 'sms',
      participantType: participant.participantType,
      participantId: participant.id,
      participant: {
        id: participant.id,
        firstName: participant.firstName,
        lastName: participant.lastName,
        phone: participant.phone,
        email: participant.email,
        status: participant.status,
        displayName,
      },
      lastMessage: {
        id: lastMsg.id,
        body: lastMsg.body,
        direction: lastMsg.direction,
        messageType: lastMsg.message_type,
        createdAt: lastMsg.created_at,
      },
      lastActivityAt: lastMsg.created_at || null,
      needsReply: lastMsg.direction === 'inbound',
    });
  }

  const igRows = await instagramService.listConversationRows(tenantId);
  for (const row of igRows) {
    const lastMsg = row.last_message;
    if (!lastMsg) continue;

    const displayName = row.display_name
      || (row.instagram_username ? `@${row.instagram_username}` : null)
      || `Instagram ${String(row.instagram_user_id).slice(-6)}`;

    if (search) {
      const searchLower = search.toLowerCase();
      const matchesSearch =
        displayName.toLowerCase().includes(searchLower) ||
        (row.instagram_username || '').toLowerCase().includes(searchLower) ||
        row.instagram_user_id.includes(search.replace(/\D/g, ''));
      if (!matchesSearch) continue;
    }

    conversations.push({
      channel: 'instagram',
      participantType: 'instagram',
      participantId: row.id,
      participant: {
        id: row.id,
        firstName: row.display_name || row.instagram_username || null,
        lastName: null,
        phone: null,
        email: null,
        status: null,
        displayName,
        instagramUsername: row.instagram_username,
        instagramUserId: row.instagram_user_id,
      },
      lastMessage: {
        id: lastMsg.id,
        body: lastMsg.body,
        direction: lastMsg.direction,
        messageType: lastMsg.message_type,
        createdAt: lastMsg.created_at,
      },
      lastActivityAt: lastMsg.created_at || row.last_message_at || null,
      needsReply: lastMsg.direction === 'inbound',
    });
  }

  return sortAndPaginateConversations(conversations, options);
};

const getInboxSummary = async (tenantId) => {
  const listed = await listConversations(tenantId, { page: 1, limit: 10000 });
  const needsReplyCount = listed.needsReplyCount ?? 0;
  const totalConversations = listed.pagination?.total ?? 0;

  const timezone = await getTenantTimezone(tenantId);
  const todayClause = scheduledTodayInTimezone('a.scheduled_at', 2);
  const apptResult = await db.query(
    `SELECT COUNT(*)::int AS count
     FROM appointments a
     WHERE a.tenant_id = $1
       AND a.status IN ('scheduled', 'confirmed', 'rescheduled')
       AND ${todayClause}`,
    [tenantId, timezone],
  );

  return {
    needsReplyCount,
    totalConversations,
    appointmentsToday: apptResult.rows[0]?.count ?? 0,
  };
};

/**
 * Get a single conversation thread (all messages for a participant).
 */
const getConversation = async (tenantId, participantType, participantId) => {
  if (participantType === 'instagram') {
    const row = await instagramService.getConversationById(tenantId, participantId);
    if (!row) {
      throw Object.assign(new Error('Conversation not found'), { statusCode: 404, isOperational: true });
    }

    const displayName = row.display_name
      || (row.instagram_username ? `@${row.instagram_username}` : null)
      || `Instagram ${String(row.instagram_user_id).slice(-6)}`;

    const messages = (await instagramService.getThreadMessages(tenantId, participantId)).map((msg) => ({
      id: msg.id,
      direction: msg.direction,
      body: msg.body,
      messageType: msg.message_type,
      deliveryStatus: msg.delivery_status,
      createdAt: msg.created_at,
    }));

    return {
      channel: 'instagram',
      participantType: 'instagram',
      participant: {
        id: row.id,
        firstName: row.display_name || row.instagram_username || null,
        lastName: null,
        phone: null,
        email: null,
        status: null,
        displayName,
        instagramUsername: row.instagram_username,
        instagramUserId: row.instagram_user_id,
      },
      messages,
      aiReply: null,
    };
  }

  if (participantType !== 'lead' && participantType !== 'contact') {
    throw Object.assign(new Error('Invalid participant type'), { statusCode: 400, isOperational: true });
  }

  let participant;
  if (participantType === 'lead') {
    const leadResult = await db.query(
      'SELECT id, first_name, last_name, phone, email, status, ai_auto_reply_override FROM leads WHERE id = $1 AND tenant_id = $2',
      [participantId, tenantId],
    );
    if (leadResult.rows.length === 0) {
      throw Object.assign(new Error('Lead not found'), { statusCode: 404, isOperational: true });
    }
    const row = leadResult.rows[0];
    participant = {
      participantType: 'lead',
      id: row.id,
      firstName: row.first_name,
      lastName: row.last_name,
      phone: row.phone,
      email: row.email,
      status: row.status,
      displayName: [row.first_name, row.last_name].filter(Boolean).join(' ') || row.phone,
      aiAutoReplyOverride: row.ai_auto_reply_override,
    };
  } else {
    const contactResult = await db.query(
      'SELECT id, first_name, last_name, phone, email, ai_auto_reply_override FROM contacts WHERE id = $1 AND tenant_id = $2',
      [participantId, tenantId],
    );
    if (contactResult.rows.length === 0) {
      throw Object.assign(new Error('Contact not found'), { statusCode: 404, isOperational: true });
    }
    const row = contactResult.rows[0];
    participant = {
      participantType: 'contact',
      id: row.id,
      firstName: row.first_name,
      lastName: row.last_name,
      phone: row.phone,
      email: row.email,
      status: null,
      displayName: [row.first_name, row.last_name].filter(Boolean).join(' ') || row.phone,
      aiAutoReplyOverride: row.ai_auto_reply_override,
    };
  }

  const tenantAi = await db.query(
    'SELECT ai_auto_reply_enabled FROM tenants WHERE id = $1',
    [tenantId],
  );
  const tenantDefault = !!tenantAi.rows[0]?.ai_auto_reply_enabled;
  const override = participant.aiAutoReplyOverride;
  const effective =
    override === null || override === undefined ? tenantDefault : !!override;

  const messagesResult = await db.query(
    participantType === 'lead'
      ? `SELECT * FROM messages WHERE tenant_id = $1 AND lead_id = $2 ORDER BY created_at ASC`
      : `SELECT * FROM messages WHERE tenant_id = $1 AND contact_id = $2 ORDER BY created_at ASC`,
    [tenantId, participantId],
  );

  const messages = messagesResult.rows.map((row) => ({
    id: row.id,
    direction: row.direction,
    body: row.body,
    fromNumber: row.from_number,
    toNumber: row.to_number,
    messageType: row.message_type,
    deliveryStatus: row.delivery_status,
    createdAt: row.created_at,
  }));

  return {
    channel: 'sms',
    participant,
    messages,
    participantType,
    aiReply: {
      tenantDefault,
      override,
      effective,
    },
  };
};

/**
 * Update per-thread AI auto-reply override (null = use tenant default).
 */
const updateAiReplyOverride = async (tenantId, participantType, participantId, override) => {
  if (participantType !== 'lead' && participantType !== 'contact') {
    throw Object.assign(new Error('Invalid participant type'), { statusCode: 400, isOperational: true });
  }
  if (override !== null && override !== undefined && typeof override !== 'boolean') {
    throw Object.assign(new Error('override must be true, false, or null'), { statusCode: 400, isOperational: true });
  }

  const val = override === undefined ? null : override;

  if (participantType === 'lead') {
    const r = await db.query(
      `UPDATE leads SET ai_auto_reply_override = $1, updated_at = NOW()
       WHERE id = $2 AND tenant_id = $3 RETURNING id`,
      [val, participantId, tenantId],
    );
    if (r.rows.length === 0) {
      throw Object.assign(new Error('Lead not found'), { statusCode: 404, isOperational: true });
    }
  } else {
    const r = await db.query(
      `UPDATE contacts SET ai_auto_reply_override = $1, updated_at = NOW()
       WHERE id = $2 AND tenant_id = $3 RETURNING id`,
      [val, participantId, tenantId],
    );
    if (r.rows.length === 0) {
      throw Object.assign(new Error('Contact not found'), { statusCode: 404, isOperational: true });
    }
  }

  return getConversation(tenantId, participantType, participantId);
};

/**
 * Effective AI auto-reply flag for inbound handling (used by SMS webhook).
 */
const getEffectiveAiAutoReply = async (tenantId, participantType, participantId) => {
  const tenantRes = await db.query(
    'SELECT ai_auto_reply_enabled FROM tenants WHERE id = $1',
    [tenantId],
  );
  const tenantDefault = !!tenantRes.rows[0]?.ai_auto_reply_enabled;

  if (participantType === 'lead') {
    const r = await db.query(
      'SELECT ai_auto_reply_override FROM leads WHERE id = $1 AND tenant_id = $2',
      [participantId, tenantId],
    );
    if (r.rows.length === 0) return { effective: false, tenantDefault, override: null };
    const o = r.rows[0].ai_auto_reply_override;
    const effective = o === null || o === undefined ? tenantDefault : !!o;
    return { effective, tenantDefault, override: o };
  }

  const r = await db.query(
    'SELECT ai_auto_reply_override FROM contacts WHERE id = $1 AND tenant_id = $2',
    [participantId, tenantId],
  );
  if (r.rows.length === 0) return { effective: false, tenantDefault, override: null };
  const o = r.rows[0].ai_auto_reply_override;
  const effective = o === null || o === undefined ? tenantDefault : !!o;
  return { effective, tenantDefault, override: o };
};

/**
 * Recent thread lines for AI context (newest last).
 * Excludes messages from before the tenant last updated their AI knowledge profile
 * so stale bot replies do not override current booking link / business details.
 */
const getRecentThreadMessagesForAi = async (tenantId, participantType, participantId, limit = 12) => {
  const tenantRow = await db.query(
    'SELECT ai_knowledge_updated_at FROM tenants WHERE id = $1',
    [tenantId],
  );
  const knowledgeSince = tenantRow.rows[0]?.ai_knowledge_updated_at;

  const participantCol = participantType === 'lead' ? 'lead_id' : 'contact_id';
  const params = [tenantId, participantId];
  let timeFilter = '';
  if (knowledgeSince) {
    params.push(knowledgeSince);
    timeFilter = ` AND created_at >= $${params.length}`;
  }
  params.push(limit);

  const result = await db.query(
    `SELECT direction, body FROM messages
     WHERE tenant_id = $1 AND ${participantCol} = $2${timeFilter}
     ORDER BY created_at DESC
     LIMIT $${params.length}`,
    params,
  );
  return result.rows.reverse();
};

/**
 * Send a manual reply to a participant.
 */
const sendManualReply = async (tenantId, participantType, participantId, body) => {
  if (participantType === 'instagram') {
    return instagramService.sendReply(tenantId, participantId, body);
  }

  const conv = await getConversation(tenantId, participantType, participantId);
  const { participant } = conv;

  if (participantType === 'contact') {
    const canSend = await compliance.canSendToContact(participantId);
    if (!canSend) {
      throw Object.assign(new Error('Contact has opted out'), { statusCode: 403, isOperational: true });
    }
  } else {
    const canSend = await compliance.canSendMessage(participantId);
    if (!canSend) {
      throw Object.assign(new Error('Lead has opted out'), { statusCode: 403, isOperational: true });
    }
  }

  const tenantResult = await db.query(
    'SELECT phone_number FROM tenants WHERE id = $1',
    [tenantId],
  );
  const fromNumber = tenantResult.rows[0]?.phone_number ?? null;

  const message = await smsService.sendSms({
    tenantId,
    leadId: participantType === 'lead' ? participantId : null,
    contactId: participantType === 'contact' ? participantId : null,
    to: participant.phone,
    from: fromNumber,
    body: body.trim(),
    messageType: 'manual',
  });

  return {
    id: message.id,
    direction: 'outbound',
    body: message.body,
    messageType: 'manual',
    deliveryStatus: message.delivery_status,
    createdAt: message.created_at,
  };
};

module.exports = {
  listConversations,
  getConversation,
  getInboxSummary,
  sendManualReply,
  updateAiReplyOverride,
  getEffectiveAiAutoReply,
  getRecentThreadMessagesForAi,
};
