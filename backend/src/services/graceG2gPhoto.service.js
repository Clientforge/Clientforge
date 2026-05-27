const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const db = require('../db/connection');
const { sendSms } = require('./sms.service');
const { sendEmail } = require('./email.service');
const tenantPhoneService = require('./tenant-phone.service');
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

/** Ensure upload root exists and is writable (call at server startup). */
function ensureG2gUploadDir() {
  const root = uploadRootDir();
  try {
    fs.mkdirSync(root, { recursive: true });
    fs.accessSync(root, fs.constants.W_OK);
    return root;
  } catch (err) {
    const msg = err.code === 'EACCES'
      ? `Upload directory is not writable: ${root}`
      : `Could not prepare upload directory: ${root} (${err.message})`;
    console.error('[g2g-photo]', msg);
    throw new Error(msg);
  }
}

function writeUploadedFile(storagePath, buffer) {
  try {
    fs.writeFileSync(storagePath, buffer);
  } catch (err) {
    if (err.code === 'EACCES') {
      throw new G2gPhotoError(
        'Photo storage is not writable on the server. Please contact support.',
        503,
      );
    }
    throw new G2gPhotoError('Could not save photo file.', 500);
  }
}

function mapDbError(err) {
  if (err.code === '42P01') {
    return new G2gPhotoError(
      'Photo submissions are not set up yet (database migration missing).',
      503,
    );
  }
  return err;
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
  const r = await db.query('SELECT phone_number FROM tenants WHERE id = $1', [tenantId]);
  return tenantPhoneService.resolveEffectiveSmsFrom(r.rows[0]?.phone_number).from;
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
function normalizeLeadId(leadId) {
  const id = String(leadId || '').trim();
  if (!id) return null;
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)) {
    return null;
  }
  return id;
}

async function createPhotoSubmission({ leadId, sessionId, contact, vehicle, estimate, files }) {
  if (!files || files.length === 0) {
    throw new G2gPhotoError('Upload at least one photo.');
  }
  const safeLeadId = normalizeLeadId(leadId);
  if (files.length > MAX_FILES) {
    throw new G2gPhotoError(`You can upload up to ${MAX_FILES} photos.`);
  }

  const tenantId = tenantIdForG2g();
  const reviewToken = crypto.randomBytes(24).toString('hex');
  const submissionId = crypto.randomUUID();

  const subDir = path.join(uploadRootDir(), submissionId);
  try {
    fs.mkdirSync(subDir, { recursive: true });
  } catch (err) {
    if (err.code === 'EACCES') {
      throw new G2gPhotoError(
        'Photo storage is not writable on the server. Please contact support.',
        503,
      );
    }
    throw new G2gPhotoError('Could not create upload folder.', 500);
  }

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
    writeUploadedFile(storagePath, f.buffer);
    savedFiles.push({
      id: fileId,
      storagePath,
      mime,
      originalName: sanitizeFilename(f.originalname),
      sortOrder: i,
    });
  }

  try {
    await db.query(
      `INSERT INTO g2g_photo_submissions
         (id, tenant_id, lead_id, review_token, session_id, contact, vehicle, estimate)
       VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7::jsonb, $8::jsonb)`,
      [
        submissionId,
        tenantId,
        safeLeadId,
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
  } catch (err) {
    if (err instanceof G2gPhotoError) throw err;
    throw mapDbError(err);
  }

  const phone = contact?.phone;
  let resolvedLeadId = null;
  try {
    resolvedLeadId = await updateLeadAfterEstimate(tenantId, safeLeadId, phone, {
      funnelStage: 'PHOTOS_SUBMITTED',
      photoSubmissionId: submissionId,
      reviewToken,
      photosSubmittedAt: new Date().toISOString(),
    });
  } catch (err) {
    console.error('[g2g-photo] lead metadata update failed:', err.message);
  }

  const reviewUrl = `${publicAppBaseUrl()}/g2g-review/${reviewToken}`;
  try {
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
  } catch (err) {
    console.error('[g2g-photo] team notification failed (photos saved):', err.message);
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
  ensureG2gUploadDir,
  G2gPhotoError,
  MAX_FILES,
  MAX_FILE_BYTES,
};
