const db = require('../db/connection');
const { getTenantTimezone, scheduledTodayInTimezone } = require('../utils/tenantTimezone');
const smsService = require('./sms.service');
const compliance = require('./compliance.service');
const instagramService = require('./instagram.service');
const conversationArchive = require('./conversation-archive.service');

const phoneDigits = (expr) => `regexp_replace(COALESCE(${expr}, ''), '[^0-9]', '', 'g')`;

const CONVERSATION_BASE_CTE = `
  WITH msg_phones AS (
    SELECT
      m.id,
      m.body,
      m.direction,
      m.message_type,
      m.created_at,
      ${phoneDigits("CASE WHEN m.direction = 'inbound' THEN m.from_number ELSE m.to_number END")} AS phone_digits
    FROM messages m
    WHERE m.tenant_id = $1
      AND (
        (m.direction = 'inbound' AND m.from_number IS NOT NULL)
        OR (m.direction = 'outbound' AND m.to_number IS NOT NULL)
      )
  ),
  last_per_phone AS (
    SELECT DISTINCT ON (phone_digits)
      id AS last_msg_id,
      body AS last_msg_body,
      direction AS last_msg_direction,
      message_type AS last_msg_type,
      created_at AS last_activity_at,
      phone_digits,
      (direction = 'inbound') AS needs_reply
    FROM msg_phones
    WHERE phone_digits <> ''
    ORDER BY phone_digits, created_at DESC
  ),
  sms_rows AS (
    SELECT
      'sms'::text AS channel,
      CASE WHEN l.id IS NOT NULL THEN 'lead' ELSE 'contact' END AS participant_type,
      COALESCE(l.id, c.id) AS participant_id,
      COALESCE(l.first_name, c.first_name) AS first_name,
      COALESCE(l.last_name, c.last_name) AS last_name,
      COALESCE(l.phone, c.phone) AS phone,
      COALESCE(l.email, c.email) AS email,
      l.status AS status,
      NULL::text AS instagram_username,
      NULL::text AS instagram_user_id,
      NULL::text AS display_name,
      lpp.last_msg_id,
      lpp.last_msg_body,
      lpp.last_msg_direction,
      lpp.last_msg_type,
      lpp.last_activity_at,
      lpp.needs_reply,
      lpp.phone_digits
    FROM last_per_phone lpp
    LEFT JOIN leads l
      ON l.tenant_id = $1 AND ${phoneDigits('l.phone')} = lpp.phone_digits
    LEFT JOIN contacts c
      ON c.tenant_id = $1 AND ${phoneDigits('c.phone')} = lpp.phone_digits AND l.id IS NULL
    WHERE COALESCE(l.id, c.id) IS NOT NULL
  ),
  ig_rows AS (
    SELECT
      'instagram'::text AS channel,
      'instagram'::text AS participant_type,
      ic.id AS participant_id,
      ic.display_name AS first_name,
      NULL::text AS last_name,
      NULL::text AS phone,
      NULL::text AS email,
      NULL::text AS status,
      ic.instagram_username,
      ic.instagram_user_id::text AS instagram_user_id,
      ic.display_name,
      lm.id AS last_msg_id,
      lm.body AS last_msg_body,
      lm.direction AS last_msg_direction,
      lm.message_type AS last_msg_type,
      COALESCE(lm.created_at, ic.last_message_at) AS last_activity_at,
      (lm.direction = 'inbound') AS needs_reply,
      NULL::text AS phone_digits
    FROM instagram_conversations ic
    INNER JOIN LATERAL (
      SELECT id, body, direction, message_type, created_at
      FROM instagram_messages
      WHERE conversation_id = ic.id
      ORDER BY created_at DESC
      LIMIT 1
    ) lm ON true
    WHERE ic.tenant_id = $1
  ),
  combined AS (
    SELECT * FROM sms_rows
    UNION ALL
    SELECT * FROM ig_rows
  )
`;

const VALID_PARTICIPANT_TYPES = conversationArchive.VALID_PARTICIPANT_TYPES;

const parseArchivedFilter = (raw) => raw === true || raw === 'true';

const buildConversationFilters = (options = {}) => {
  const filters = [];
  const params = [];
  let paramIdx = 2;

  const archived = parseArchivedFilter(options.archived);
  if (archived) {
    filters.push(' AND ca.participant_id IS NOT NULL ');
  } else {
    filters.push(' AND ca.participant_id IS NULL ');
  }

  if (options.search) {
    const searchLower = options.search.toLowerCase();
    const searchDigits = options.search.replace(/\D/g, '');
    params.push(`%${searchLower}%`);
    params.push(searchDigits ? `%${searchDigits}%` : null);
    filters.push(`
      AND (
        lower(trim(coalesce(sc.first_name, '') || ' ' || coalesce(sc.last_name, ''))) LIKE $${paramIdx}
        OR lower(coalesce(sc.email, '')) LIKE $${paramIdx}
        OR ($${paramIdx + 1}::text IS NOT NULL AND sc.phone_digits LIKE $${paramIdx + 1})
        OR lower(coalesce(sc.instagram_username, '')) LIKE $${paramIdx}
        OR lower(coalesce(sc.display_name, '')) LIKE $${paramIdx}
      )`);
    paramIdx += 2;
  }

  if (options.needsReply === 'true' || options.needsReply === true) {
    filters.push(' AND sc.needs_reply = true ');
  }

  return { filters: filters.join('\n'), params, nextParamIdx: paramIdx };
};

const mapRowToConversation = (row) => {
  const displayName = row.channel === 'instagram'
    ? row.display_name
      || (row.instagram_username ? `@${row.instagram_username}` : null)
      || `Instagram ${String(row.instagram_user_id).slice(-6)}`
    : [row.first_name, row.last_name].filter(Boolean).join(' ') || row.phone;

  const participant = {
    id: row.participant_id,
    firstName: row.first_name,
    lastName: row.last_name,
    phone: row.phone,
    email: row.email,
    status: row.status,
    displayName,
  };

  if (row.channel === 'instagram') {
    participant.instagramUsername = row.instagram_username;
    participant.instagramUserId = row.instagram_user_id;
  }

  return {
    channel: row.channel,
    participantType: row.participant_type,
    participantId: row.participant_id,
    archived: !!row.archived,
    participant,
    lastMessage: row.last_msg_id
      ? {
        id: row.last_msg_id,
        body: row.last_msg_body,
        direction: row.last_msg_direction,
        messageType: row.last_msg_type,
        createdAt: row.last_activity_at,
      }
      : null,
    lastActivityAt: row.last_activity_at,
    needsReply: row.needs_reply,
  };
};

const queryConversationCounts = async (tenantId, options = {}) => {
  const { filters, params } = buildConversationFilters(options);
  const result = await db.query(
    `${CONVERSATION_BASE_CTE},
     scoped AS (
       SELECT sc.*, (ca.participant_id IS NOT NULL) AS archived
       FROM combined sc
       LEFT JOIN conversation_archives ca
         ON ca.tenant_id = $1
        AND ca.participant_type = sc.participant_type
        AND ca.participant_id = sc.participant_id
     )
     SELECT
       COUNT(*)::int AS total,
       COUNT(*) FILTER (WHERE sc.needs_reply)::int AS needs_reply_count
     FROM scoped sc
     WHERE 1 = 1
     ${filters}`,
    [tenantId, ...params],
  );
  return {
    total: result.rows[0]?.total ?? 0,
    needsReplyCount: result.rows[0]?.needs_reply_count ?? 0,
  };
};

/**
 * List conversations for a tenant (SMS + Instagram).
 */
const listConversations = async (tenantId, options = {}) => {
  const { page = 1, limit = 25 } = options;
  const { filters, params, nextParamIdx } = buildConversationFilters(options);
  const listParams = [tenantId, ...params];
  const limitParam = nextParamIdx;
  const offsetParam = nextParamIdx + 1;
  listParams.push(limit, (page - 1) * limit);

  const [listResult, counts, archivedCounts] = await Promise.all([
    db.query(
      `${CONVERSATION_BASE_CTE},
       scoped AS (
         SELECT sc.*, (ca.participant_id IS NOT NULL) AS archived
         FROM combined sc
         LEFT JOIN conversation_archives ca
           ON ca.tenant_id = $1
          AND ca.participant_type = sc.participant_type
          AND ca.participant_id = sc.participant_id
       ),
       filtered AS (
         SELECT sc.*
         FROM scoped sc
         WHERE 1 = 1
         ${filters}
       )
       SELECT *
       FROM filtered
       ORDER BY needs_reply DESC, last_activity_at DESC NULLS LAST
       LIMIT $${limitParam} OFFSET $${offsetParam}`,
      listParams,
    ),
    queryConversationCounts(tenantId, options),
    queryConversationCounts(tenantId, { archived: true }),
  ]);

  const { total, needsReplyCount } = counts;

  return {
    conversations: listResult.rows.map(mapRowToConversation),
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit) || 1,
    },
    needsReplyCount: parseArchivedFilter(options.archived) ? 0 : needsReplyCount,
    archivedCount: archivedCounts.total,
  };
};

const getArchivedCount = async (tenantId) => {
  const counts = await queryConversationCounts(tenantId, { archived: true });
  return counts.total;
};

const getInboxSummary = async (tenantId) => {
  const counts = await queryConversationCounts(tenantId, { archived: false });
  const needsReplyCount = counts.needsReplyCount;
  const totalConversations = counts.total;
  const archivedCount = await getArchivedCount(tenantId);

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
    archivedCount,
    appointmentsToday: apptResult.rows[0]?.count ?? 0,
  };
};

/**
 * Get a single conversation thread (all messages for a participant).
 */
const isConversationArchived = conversationArchive.isArchived;

const assertParticipantExists = async (tenantId, participantType, participantId) => {
  if (!VALID_PARTICIPANT_TYPES.includes(participantType)) {
    throw Object.assign(new Error('Invalid participant type'), { statusCode: 400, isOperational: true });
  }

  if (participantType === 'instagram') {
    const row = await instagramService.getConversationById(tenantId, participantId);
    if (!row) {
      throw Object.assign(new Error('Conversation not found'), { statusCode: 404, isOperational: true });
    }
    return;
  }

  if (participantType === 'lead') {
    const result = await db.query(
      'SELECT id FROM leads WHERE id = $1 AND tenant_id = $2',
      [participantId, tenantId],
    );
    if (result.rows.length === 0) {
      throw Object.assign(new Error('Lead not found'), { statusCode: 404, isOperational: true });
    }
    return;
  }

  const result = await db.query(
    'SELECT id FROM contacts WHERE id = $1 AND tenant_id = $2',
    [participantId, tenantId],
  );
  if (result.rows.length === 0) {
    throw Object.assign(new Error('Contact not found'), { statusCode: 404, isOperational: true });
  }
};

const setConversationArchived = async (tenantId, participantType, participantId, archived, userId = null) => {
  await assertParticipantExists(tenantId, participantType, participantId);
  return conversationArchive.setArchived(tenantId, participantType, participantId, archived, userId);
};

const unarchiveConversationIfArchived = conversationArchive.unarchiveIfArchived;

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
      archived: await isConversationArchived(tenantId, 'instagram', participantId),
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
    archived: await isConversationArchived(tenantId, participantType, participantId),
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
  setConversationArchived,
  unarchiveConversationIfArchived,
};
