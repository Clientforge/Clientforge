const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const db = require('../db/connection');
const { sendSms } = require('./sms.service');
const { sendEmail } = require('./email.service');
const {
  updateLeadAfterEstimate,
  tenantIdForG2g,
  G2gLeadError,
} = require('./graceG2gLead.service');

const MAX_FILES = 12;
const MAX_FILE_BYTES = 8 * 1024 * 1024;
const ALLOWED_MIME = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);

class G2gPhotoError extends Error {
  constructor(message, statusCode = 400) {
    super(message);
    this.statusCode = statusCode;
  }
}

function uploadRootDir() {
  const custom = process.env.G2G_UPLOAD_DIR?.trim();
  if (custom) return path.resolve(custom);
  return path.join(__dirname, '../../uploads/g2g');
}

function publicAppBaseUrl() {
  const base = process.env.PUBLIC_APP_BASE_URL?.trim();
  if (base) return base.replace(/\/$/, '');
  return 'https://app.clientforge-ai.com';
}

function parseJsonField(raw, fieldName) {
  if (raw == null || raw === '') return null;
  try {
    const v = typeof raw === 'string' ? JSON.parse(raw) : raw;
    if (!v || typeof v !== 'object') throw new Error('invalid');
    return v;
  } catch {
    throw new G2gPhotoError(`Invalid ${fieldName} JSON.`);
  }
}

function sanitizeFilename(name) {
  const base = path.basename(String(name || 'photo').replace(/[^\w.\-]+/g, '_'));
  return base.slice(0, 200) || 'photo.jpg';
}

function extForMime(mime) {
  if (mime === 'image/png') return '.png';
  if (mime === 'image/webp') return '.webp';
  if (mime === 'image/gif') return '.gif';
  return '.jpg';
}

function formatEstimateLine(estimate) {
  if (!estimate || typeof estimate !== 'object') return '—';
  const lo = estimate.low;
  const hi = estimate.high;
  const display = estimate.display;
  const point = estimate.pointOffer;
  const parts = [];
  if (lo != null && hi != null) {
    parts.push(`$${Number(lo).toLocaleString()}–$${Number(hi).toLocaleString()}`);
  }
  if (display) parts.push(`shown: ${display}`);
  else if (point != null) parts.push(`offer: $${Number(point).toLocaleString()}`);
  return parts.length ? parts.join(' · ') : '—';
}

function buildNotifySms({ contact, vehicle, estimate, reviewUrl, photoCount }) {
  const name = contact?.firstName || contact?.name || '—';
  const phone = contact?.phone || '—';
  const ymm = [vehicle?.year, vehicle?.make, vehicle?.model].filter(Boolean).join(' ') || '—';
  const vin = vehicle?.vin || '—';
  return (
    `[G2G PHOTOS] Vehicle photo review (${photoCount} image${photoCount === 1 ? '' : 's'})\n` +
    `Name: ${name}\n` +
    `Phone: ${phone}\n` +
    `Email: ${contact?.email || '—'}\n` +
    `Vehicle: ${ymm}\n` +
    `VIN: ${vin}\n` +
    `Estimate: ${formatEstimateLine(estimate)}\n` +
    `Review: ${reviewUrl}`
  ).slice(0, 1500);
}

async function resolveFromNumber(tenantId) {
  const config = require('../config');
  const r = await db.query('SELECT phone_number FROM tenants WHERE id = $1', [tenantId]);
  const row = r.rows[0];
  if (row?.phone_number) return row.phone_number;
  const provider = config.sms.provider || 'twilio';
  return provider === 'telnyx' ? config.telnyx.defaultFrom : config.twilio.defaultFrom;
}

function resolveNotifyPhone() {
  const keys = ['G2G_PHOTO_NOTIFY_PHONE', 'G2G_ESTIMATE_NOTIFY_PHONE', 'G2G_SELL_NOTIFY_PHONE'];
  for (const k of keys) {
    const raw = process.env[k];
    if (raw && String(raw).trim()) {
      const { normalizePhone } = require('./lead.service');
      return normalizePhone(String(raw).trim());
    }
  }
  return null;
}

/**
 * @param {object} params
 * @param {string} [params.leadId]
 * @param {string} [params.sessionId]
 * @param {object} params.contact
 * @param {object} params.vehicle
 * @param {object} params.estimate
 * @param {Express.Multer.File[]} params.files
 */
async function createPhotoSubmission({ leadId, sessionId, contact, vehicle, estimate, files }) {
  if (!files || files.length === 0) {
    throw new G2gPhotoError('Upload at least one photo.');
  }
  if (files.length > MAX_FILES) {
    throw new G2gPhotoError(`You can upload up to ${MAX_FILES} photos.`);
  }

  const tenantId = tenantIdForG2g();
  const reviewToken = crypto.randomBytes(24).toString('hex');
  const submissionId = crypto.randomUUID();

  const subDir = path.join(uploadRootDir(), submissionId);
  fs.mkdirSync(subDir, { recursive: true });

  const savedFiles = [];
  for (let i = 0; i < files.length; i += 1) {
    const f = files[i];
    const mime = (f.mimetype || '').toLowerCase();
    if (!ALLOWED_MIME.has(mime)) {
      throw new G2gPhotoError('Only JPEG, PNG, WebP, and GIF images are allowed.');
    }
    if (f.size > MAX_FILE_BYTES) {
      throw new G2gPhotoError(`Each photo must be under ${MAX_FILE_BYTES / (1024 * 1024)} MB.`);
    }
    const ext = extForMime(mime);
    const fileId = crypto.randomUUID();
    const filename = `${fileId}${ext}`;
    const storagePath = path.join(subDir, filename);
    fs.writeFileSync(storagePath, f.buffer);
    savedFiles.push({
      id: fileId,
      storagePath,
      mime,
      originalName: sanitizeFilename(f.originalname),
      sortOrder: i,
    });
  }

  await db.query(
    `INSERT INTO g2g_photo_submissions
       (id, tenant_id, lead_id, review_token, session_id, contact, vehicle, estimate)
     VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7::jsonb, $8::jsonb)`,
    [
      submissionId,
      tenantId,
      leadId || null,
      reviewToken,
      sessionId ? String(sessionId).slice(0, 80) : null,
      JSON.stringify(contact),
      JSON.stringify(vehicle),
      JSON.stringify(estimate),
    ],
  );

  for (const row of savedFiles) {
    await db.query(
      `INSERT INTO g2g_photo_files (id, submission_id, storage_path, mime_type, original_filename, sort_order)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [
        row.id,
        submissionId,
        row.storagePath,
        row.mime,
        row.originalName,
        row.sortOrder,
      ],
    );
  }

  const phone = contact?.phone;
  const resolvedLeadId = await updateLeadAfterEstimate(tenantId, leadId, phone, {
    funnelStage: 'PHOTOS_SUBMITTED',
    photoSubmissionId: submissionId,
    reviewToken,
    photosSubmittedAt: new Date().toISOString(),
  });

  const reviewUrl = `${publicAppBaseUrl()}/g2g-review/${reviewToken}`;
  const notifyPhone = resolveNotifyPhone();
  if (notifyPhone && notifyPhone.replace(/\D/g, '').length >= 10) {
    const from = await resolveFromNumber(tenantId);
    const smsBody = buildNotifySms({
      contact,
      vehicle,
      estimate,
      reviewUrl,
      photoCount: savedFiles.length,
    });
    await sendSms({
      tenantId,
      leadId: resolvedLeadId,
      contactId: null,
      to: notifyPhone,
      from,
      body: smsBody,
      messageType: 'g2g_photo_submission',
    });
  }

  const emailTo =
    process.env.G2G_PHOTO_NOTIFY_EMAIL?.trim() ||
    process.env.G2G_ESTIMATE_NOTIFY_EMAIL?.trim() ||
    process.env.G2G_SELL_NOTIFY_EMAIL?.trim();
  if (emailTo) {
    await sendEmail({
      tenantId,
      to: emailTo,
      fromName: 'Grace to Grace',
      subject: '[G2G PHOTOS] Vehicle photo review',
      body: buildNotifySms({
        contact,
        vehicle,
        estimate,
        reviewUrl,
        photoCount: savedFiles.length,
      }),
    });
  }

  return {
    ok: true,
    submissionId,
    leadId: resolvedLeadId,
    photoCount: savedFiles.length,
  };
}

async function getSubmissionByToken(token) {
  const t = String(token || '').trim();
  if (!/^[a-f0-9]{32,64}$/i.test(t)) {
    throw new G2gPhotoError('Invalid review link.', 404);
  }
  const sub = await db.query(
    `SELECT s.*, COALESCE(json_agg(
       json_build_object(
         'id', f.id,
         'mimeType', f.mime_type,
         'originalFilename', f.original_filename,
         'sortOrder', f.sort_order
       ) ORDER BY f.sort_order
     ) FILTER (WHERE f.id IS NOT NULL), '[]') AS files
     FROM g2g_photo_submissions s
     LEFT JOIN g2g_photo_files f ON f.submission_id = s.id
     WHERE s.review_token = $1
     GROUP BY s.id`,
    [t],
  );
  if (sub.rows.length === 0) {
    throw new G2gPhotoError('Review not found.', 404);
  }
  const row = sub.rows[0];
  const base = publicAppBaseUrl();
  const files = (row.files || []).map((f) => ({
    id: f.id,
    mimeType: f.mimeType,
    originalFilename: f.originalFilename,
    sortOrder: f.sortOrder,
    url: `${base}/api/v1/public/g2g-review/${t}/file/${f.id}`,
  }));
  return {
    id: row.id,
    createdAt: row.created_at,
    contact: row.contact,
    vehicle: row.vehicle,
    estimate: row.estimate,
    files,
  };
}

async function getFileForToken(token, fileId) {
  const t = String(token || '').trim();
  const fid = String(fileId || '').trim();
  const r = await db.query(
    `SELECT f.storage_path, f.mime_type, f.original_filename
     FROM g2g_photo_files f
     JOIN g2g_photo_submissions s ON s.id = f.submission_id
     WHERE s.review_token = $1 AND f.id = $2`,
    [t, fid],
  );
  if (r.rows.length === 0) {
    throw new G2gPhotoError('File not found.', 404);
  }
  const row = r.rows[0];
  if (!fs.existsSync(row.storage_path)) {
    throw new G2gPhotoError('File missing on server.', 404);
  }
  return {
    path: row.storage_path,
    mimeType: row.mime_type,
    originalFilename: row.original_filename,
  };
}

module.exports = {
  createPhotoSubmission,
  getSubmissionByToken,
  getFileForToken,
  G2gPhotoError,
  MAX_FILES,
  MAX_FILE_BYTES,
};
