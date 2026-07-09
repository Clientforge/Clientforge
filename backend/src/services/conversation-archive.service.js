const db = require('../db/connection');

const VALID_PARTICIPANT_TYPES = ['lead', 'contact', 'instagram'];

const isArchived = async (tenantId, participantType, participantId) => {
  const result = await db.query(
    `SELECT 1 FROM conversation_archives
     WHERE tenant_id = $1 AND participant_type = $2 AND participant_id = $3`,
    [tenantId, participantType, participantId],
  );
  return result.rows.length > 0;
};

const setArchived = async (tenantId, participantType, participantId, archived, userId = null) => {
  if (!VALID_PARTICIPANT_TYPES.includes(participantType)) {
    throw Object.assign(new Error('Invalid participant type'), { statusCode: 400, isOperational: true });
  }

  if (archived) {
    await db.query(
      `INSERT INTO conversation_archives (tenant_id, participant_type, participant_id, archived_by)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (tenant_id, participant_type, participant_id)
       DO UPDATE SET archived_at = NOW(), archived_by = EXCLUDED.archived_by`,
      [tenantId, participantType, participantId, userId],
    );
  } else {
    await db.query(
      `DELETE FROM conversation_archives
       WHERE tenant_id = $1 AND participant_type = $2 AND participant_id = $3`,
      [tenantId, participantType, participantId],
    );
  }

  return { archived: !!archived, participantType, participantId };
};

const unarchiveIfArchived = async (tenantId, participantType, participantId) => {
  if (!VALID_PARTICIPANT_TYPES.includes(participantType)) {
    return { unarchived: false };
  }
  const result = await db.query(
    `DELETE FROM conversation_archives
     WHERE tenant_id = $1 AND participant_type = $2 AND participant_id = $3
     RETURNING participant_id`,
    [tenantId, participantType, participantId],
  );
  return { unarchived: result.rows.length > 0 };
};

module.exports = {
  VALID_PARTICIPANT_TYPES,
  isArchived,
  setArchived,
  unarchiveIfArchived,
};
