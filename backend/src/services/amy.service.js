const db = require('../db/connection');
const {
  SERVICE_TYPES,
  computeAuthorizationStats,
  daysUntil,
  sumSessionMinutes,
  formatClientName,
  parseDuration,
} = require('../lib/amy/calculations');
const { computeRbtMonthlyStats, getMonthBounds } = require('../lib/amy/rbt-calculations');

function groupBy(rows, key) {
  const map = new Map();
  for (const row of rows) {
    const k = row[key];
    if (!map.has(k)) map.set(k, []);
    map.get(k).push(row);
  }
  return map;
}

function mapClientRow(row) {
  return {
    id: row.id,
    firstName: row.first_name,
    lastName: row.last_name,
    dateOfBirth: row.date_of_birth,
    diagnosis: row.diagnosis,
    insuranceProvider: row.insurance_provider,
    insuranceId: row.insurance_id,
    authorizationStart: row.authorization_start,
    authorizationEnd: row.authorization_end,
    notes: row.notes,
    isActive: row.is_active,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapAuthRow(row) {
  return {
    id: row.id,
    clientId: row.client_id,
    serviceType: row.service_type,
    authorizedMinutes: row.authorized_minutes,
    unitDisplay: row.unit_display,
  };
}

function mapSessionRow(row, rbt) {
  return {
    id: row.id,
    clientId: row.client_id,
    rbtId: row.rbt_id,
    serviceType: row.service_type,
    date: row.date,
    durationMinutes: row.duration_minutes,
    notes: row.notes,
    rbt: rbt || null,
  };
}

function mapRbtRow(row) {
  return {
    id: row.id,
    firstName: row.first_name,
    lastName: row.last_name,
    email: row.email,
    workSchedule: row.work_schedule,
    supervisionPercentage: row.supervision_percentage,
    isActive: row.is_active,
  };
}

function mapNoteRow(row, client) {
  return {
    id: row.id,
    clientId: row.client_id,
    date: row.date,
    title: row.title,
    content: row.content,
    client: client || null,
  };
}

function buildAuthorizations(authorizations, sessions) {
  return SERVICE_TYPES.map((serviceType) => {
    const auth = authorizations.find((a) => a.serviceType === serviceType);
    const authorizedMinutes = auth?.authorizedMinutes ?? 0;
    const usedMinutes = sumSessionMinutes(sessions, serviceType);
    return computeAuthorizationStats(
      authorizedMinutes,
      usedMinutes,
      serviceType,
      auth?.unitDisplay ?? 'UNITS',
    );
  });
}

async function getClientsWithStats() {
  const [clientsRes, authsRes, sessionsRes] = await Promise.all([
    db.query('SELECT * FROM amy_clients ORDER BY is_active DESC, last_name ASC'),
    db.query('SELECT * FROM amy_authorizations'),
    db.query('SELECT * FROM amy_sessions'),
  ]);

  const authsByClient = groupBy(authsRes.rows.map(mapAuthRow), 'clientId');
  const sessionsByClient = groupBy(
    sessionsRes.rows.map((r) => mapSessionRow(r)),
    'clientId',
  );

  return clientsRes.rows.map((row) => {
    const client = mapClientRow(row);
    const authorizations = authsByClient.get(client.id) || [];
    const sessions = sessionsByClient.get(client.id) || [];
    const authStats = buildAuthorizations(authorizations, sessions);

    return {
      ...client,
      name: formatClientName(client.firstName, client.lastName),
      authorizations: authStats,
      daysUntilExpiration: daysUntil(client.authorizationEnd),
      sessionCount: sessions.length,
    };
  });
}

async function getClientById(id) {
  const clientRes = await db.query('SELECT * FROM amy_clients WHERE id = $1', [id]);
  if (clientRes.rows.length === 0) return null;

  const client = mapClientRow(clientRes.rows[0]);

  const [authsRes, sessionsRes, notesRes] = await Promise.all([
    db.query('SELECT * FROM amy_authorizations WHERE client_id = $1', [id]),
    db.query(
      `SELECT s.*, r.first_name AS rbt_first_name, r.last_name AS rbt_last_name
       FROM amy_sessions s
       LEFT JOIN amy_rbts r ON r.id = s.rbt_id
       WHERE s.client_id = $1
       ORDER BY s.date DESC`,
      [id],
    ),
    db.query('SELECT * FROM amy_case_notes WHERE client_id = $1 ORDER BY date DESC', [id]),
  ]);

  const authorizations = authsRes.rows.map(mapAuthRow);
  const sessions = sessionsRes.rows.map((row) => {
    const rbt =
      row.rbt_id != null
        ? { firstName: row.rbt_first_name, lastName: row.rbt_last_name }
        : null;
    return mapSessionRow(row, rbt);
  });
  const caseNotes = notesRes.rows.map((row) => mapNoteRow(row));

  return {
    ...client,
    name: formatClientName(client.firstName, client.lastName),
    authorizations: buildAuthorizations(authorizations, sessions),
    daysUntilExpiration: daysUntil(client.authorizationEnd),
    sessions,
    caseNotes,
  };
}

async function getDashboardStats() {
  const clients = await getClientsWithStats();
  const activeClients = clients.filter((c) => c.isActive);
  const expiringSoon = activeClients.filter(
    (c) => c.daysUntilExpiration !== null && c.daysUntilExpiration >= 0 && c.daysUntilExpiration <= 30,
  );

  const totals = {
    activeClients: activeClients.length,
    totalClients: clients.length,
    expiringSoon: expiringSoon.length,
    lowSupervision: activeClients.filter((c) => {
      const sup = c.authorizations.find((a) => a.serviceType === 'SUPERVISION');
      return sup && sup.authorizedMinutes > 0 && sup.percentRemaining <= 20;
    }).length,
    lowAssessment: activeClients.filter((c) => {
      const a = c.authorizations.find((x) => x.serviceType === 'ASSESSMENT');
      return a && a.authorizedMinutes > 0 && a.percentRemaining <= 20;
    }).length,
    lowParentTraining: activeClients.filter((c) => {
      const pt = c.authorizations.find((x) => x.serviceType === 'PARENT_TRAINING');
      return pt && pt.authorizedMinutes > 0 && pt.percentRemaining <= 20;
    }).length,
  };

  return { clients: activeClients, expiringSoon, totals };
}

async function getSessions(filters = {}) {
  const conditions = [];
  const params = [];
  let i = 1;

  if (filters.clientId) {
    conditions.push(`s.client_id = $${i++}`);
    params.push(filters.clientId);
  }
  if (filters.serviceType) {
    conditions.push(`s.service_type = $${i++}`);
    params.push(filters.serviceType);
  }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const limit = filters.limit ? `LIMIT ${parseInt(filters.limit, 10)}` : '';

  const result = await db.query(
    `SELECT s.*,
            c.first_name AS client_first_name, c.last_name AS client_last_name,
            r.first_name AS rbt_first_name, r.last_name AS rbt_last_name
     FROM amy_sessions s
     JOIN amy_clients c ON c.id = s.client_id
     LEFT JOIN amy_rbts r ON r.id = s.rbt_id
     ${where}
     ORDER BY s.date DESC
     ${limit}`,
    params,
  );

  return result.rows.map((row) => ({
    ...mapSessionRow(
      row,
      row.rbt_id
        ? { firstName: row.rbt_first_name, lastName: row.rbt_last_name }
        : null,
    ),
    client: {
      id: row.client_id,
      firstName: row.client_first_name,
      lastName: row.client_last_name,
    },
  }));
}

async function getRbtsWithStats(year, month) {
  const now = new Date();
  const y = year ?? now.getFullYear();
  const m = month ?? now.getMonth();
  const { start, end } = getMonthBounds(y, m);

  const rbtsRes = await db.query(
    'SELECT * FROM amy_rbts ORDER BY is_active DESC, last_name ASC',
  );

  const sessionsRes = await db.query(
    `SELECT s.*, c.first_name AS client_first_name, c.last_name AS client_last_name
     FROM amy_sessions s
     JOIN amy_clients c ON c.id = s.client_id
     WHERE s.service_type = 'SUPERVISION'
       AND s.date >= $1 AND s.date <= $2
       AND s.rbt_id IS NOT NULL
     ORDER BY s.date DESC`,
    [start, end],
  );

  const sessionsByRbt = groupBy(sessionsRes.rows, 'rbt_id');

  return rbtsRes.rows.map((row) => {
    const rbt = mapRbtRow(row);
    const sessions = (sessionsByRbt.get(rbt.id) || []).map((s) => ({
      id: s.id,
      date: s.date,
      durationMinutes: s.duration_minutes,
      notes: s.notes,
      client: {
        firstName: s.client_first_name,
        lastName: s.client_last_name,
      },
    }));

    return {
      ...rbt,
      stats: computeRbtMonthlyStats({ ...rbt, sessions }, y, m),
    };
  });
}

async function getCaseNotes(filters = {}) {
  const conditions = [];
  const params = [];
  let i = 1;

  if (filters.clientId) {
    conditions.push(`n.client_id = $${i++}`);
    params.push(filters.clientId);
  }
  if (filters.search) {
    conditions.push(`(n.title ILIKE $${i} OR n.content ILIKE $${i})`);
    params.push(`%${filters.search}%`);
    i++;
  }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

  const result = await db.query(
    `SELECT n.*, c.first_name AS client_first_name, c.last_name AS client_last_name
     FROM amy_case_notes n
     JOIN amy_clients c ON c.id = n.client_id
     ${where}
     ORDER BY n.date DESC`,
    params,
  );

  return result.rows.map((row) =>
    mapNoteRow(row, {
      id: row.client_id,
      firstName: row.client_first_name,
      lastName: row.client_last_name,
    }),
  );
}

async function getAllClientsSimple() {
  const result = await db.query(
    `SELECT id, first_name, last_name FROM amy_clients
     WHERE is_active = true ORDER BY last_name ASC`,
  );
  return result.rows.map((row) => ({
    id: row.id,
    firstName: row.first_name,
    lastName: row.last_name,
  }));
}

async function getAllRbtsSimple() {
  const result = await db.query(
    `SELECT id, first_name, last_name FROM amy_rbts
     WHERE is_active = true ORDER BY last_name ASC`,
  );
  return result.rows.map((row) => ({
    id: row.id,
    firstName: row.first_name,
    lastName: row.last_name,
  }));
}

async function createClient(data) {
  const result = await db.query(
    `INSERT INTO amy_clients (
       first_name, last_name, date_of_birth, diagnosis,
       insurance_provider, insurance_id, authorization_start,
       authorization_end, notes, updated_at
     ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,NOW())
     RETURNING *`,
    [
      data.firstName,
      data.lastName,
      data.dateOfBirth ? new Date(data.dateOfBirth) : null,
      data.diagnosis || null,
      data.insuranceProvider || null,
      data.insuranceId || null,
      data.authorizationStart ? new Date(data.authorizationStart) : null,
      data.authorizationEnd ? new Date(data.authorizationEnd) : null,
      data.notes || null,
    ],
  );

  const client = mapClientRow(result.rows[0]);

  if (data.authorizations?.length) {
    for (const auth of data.authorizations) {
      if (auth.units > 0) {
        await db.query(
          `INSERT INTO amy_authorizations (client_id, service_type, authorized_minutes, unit_display, updated_at)
           VALUES ($1, $2, $3, 'UNITS', NOW())`,
          [client.id, auth.serviceType, parseDuration(auth.units, 'UNITS')],
        );
      }
    }
  }

  return client;
}

async function updateClient(id, data) {
  const existingRes = await db.query('SELECT * FROM amy_clients WHERE id = $1', [id]);
  if (existingRes.rows.length === 0) {
    const err = new Error('Client not found');
    err.statusCode = 404;
    err.isOperational = true;
    throw err;
  }

  const current = mapClientRow(existingRes.rows[0]);
  const toDate = (value) => (value ? new Date(value) : null);

  const result = await db.query(
    `UPDATE amy_clients SET
       first_name = $2,
       last_name = $3,
       date_of_birth = $4,
       diagnosis = $5,
       insurance_provider = $6,
       insurance_id = $7,
       authorization_start = $8,
       authorization_end = $9,
       notes = $10,
       is_active = $11,
       updated_at = NOW()
     WHERE id = $1
     RETURNING *`,
    [
      id,
      data.firstName ?? current.firstName,
      data.lastName ?? current.lastName,
      data.dateOfBirth !== undefined ? toDate(data.dateOfBirth) : current.dateOfBirth,
      data.diagnosis !== undefined ? data.diagnosis : current.diagnosis,
      data.insuranceProvider !== undefined ? data.insuranceProvider : current.insuranceProvider,
      data.insuranceId !== undefined ? data.insuranceId : current.insuranceId,
      data.authorizationStart !== undefined
        ? toDate(data.authorizationStart)
        : current.authorizationStart,
      data.authorizationEnd !== undefined ? toDate(data.authorizationEnd) : current.authorizationEnd,
      data.notes !== undefined ? data.notes : current.notes,
      data.isActive !== undefined ? data.isActive : current.isActive,
    ],
  );

  if (data.authorizations) {
    for (const auth of data.authorizations) {
      await db.query(
        `INSERT INTO amy_authorizations (client_id, service_type, authorized_minutes, unit_display, updated_at)
         VALUES ($1, $2, $3, 'UNITS', NOW())
         ON CONFLICT (client_id, service_type)
         DO UPDATE SET authorized_minutes = EXCLUDED.authorized_minutes,
                       unit_display = 'UNITS',
                       updated_at = NOW()`,
        [id, auth.serviceType, parseDuration(auth.units, 'UNITS')],
      );
    }
  }

  return mapClientRow(result.rows[0]);
}

async function deleteClient(id) {
  await db.query('DELETE FROM amy_clients WHERE id = $1', [id]);
}

async function createSession(data) {
  const result = await db.query(
    `INSERT INTO amy_sessions (client_id, rbt_id, service_type, date, duration_minutes, notes, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, NOW())
     RETURNING *`,
    [
      data.clientId,
      data.rbtId || null,
      data.serviceType,
      new Date(data.date),
      parseDuration(data.duration, data.unit),
      data.notes || null,
    ],
  );

  const session = mapSessionRow(result.rows[0]);
  const clientRes = await db.query('SELECT first_name, last_name FROM amy_clients WHERE id = $1', [
    data.clientId,
  ]);
  let rbt = null;
  if (data.rbtId) {
    const rbtRes = await db.query('SELECT first_name, last_name FROM amy_rbts WHERE id = $1', [
      data.rbtId,
    ]);
    if (rbtRes.rows.length) {
      rbt = { firstName: rbtRes.rows[0].first_name, lastName: rbtRes.rows[0].last_name };
    }
  }

  return {
    ...session,
    client: clientRes.rows.length
      ? {
          id: data.clientId,
          firstName: clientRes.rows[0].first_name,
          lastName: clientRes.rows[0].last_name,
        }
      : null,
    rbt,
  };
}

async function deleteSession(id) {
  await db.query('DELETE FROM amy_sessions WHERE id = $1', [id]);
}

async function createCaseNote(data) {
  const result = await db.query(
    `INSERT INTO amy_case_notes (client_id, date, title, content, updated_at)
     VALUES ($1, $2, $3, $4, NOW())
     RETURNING *`,
    [data.clientId, new Date(data.date), data.title || null, data.content],
  );

  const note = mapNoteRow(result.rows[0]);
  const clientRes = await db.query('SELECT first_name, last_name FROM amy_clients WHERE id = $1', [
    data.clientId,
  ]);
  if (clientRes.rows.length) {
    note.client = {
      id: data.clientId,
      firstName: clientRes.rows[0].first_name,
      lastName: clientRes.rows[0].last_name,
    };
  }
  return note;
}

async function createRbt(data) {
  const result = await db.query(
    `INSERT INTO amy_rbts (first_name, last_name, email, work_schedule, supervision_percentage, updated_at)
     VALUES ($1, $2, $3, $4, $5, NOW())
     RETURNING *`,
    [
      data.firstName,
      data.lastName,
      data.email || null,
      data.workSchedule || '[]',
      data.supervisionPercentage ?? 5,
    ],
  );
  return mapRbtRow(result.rows[0]);
}

async function getRbtById(id) {
  const result = await db.query('SELECT * FROM amy_rbts WHERE id = $1', [id]);
  if (result.rows.length === 0) return null;
  return mapRbtRow(result.rows[0]);
}

async function updateRbt(id, data) {
  const existing = await db.query('SELECT id FROM amy_rbts WHERE id = $1', [id]);
  if (existing.rows.length === 0) {
    const err = new Error('RBT not found');
    err.statusCode = 404;
    err.isOperational = true;
    throw err;
  }

  const result = await db.query(
    `UPDATE amy_rbts SET
       first_name = COALESCE($2, first_name),
       last_name = COALESCE($3, last_name),
       email = COALESCE($4, email),
       work_schedule = COALESCE($5, work_schedule),
       supervision_percentage = COALESCE($6, supervision_percentage),
       is_active = COALESCE($7, is_active),
       updated_at = NOW()
     WHERE id = $1
     RETURNING *`,
    [
      id,
      data.firstName,
      data.lastName,
      data.email,
      data.workSchedule,
      data.supervisionPercentage,
      data.isActive,
    ],
  );
  return mapRbtRow(result.rows[0]);
}

module.exports = {
  getClientsWithStats,
  getClientById,
  getDashboardStats,
  getSessions,
  getRbtsWithStats,
  getCaseNotes,
  getAllClientsSimple,
  getAllRbtsSimple,
  createClient,
  updateClient,
  deleteClient,
  createSession,
  deleteSession,
  createCaseNote,
  createRbt,
  getRbtById,
  updateRbt,
};
