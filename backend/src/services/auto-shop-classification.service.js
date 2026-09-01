const db = require('../db/connection');
const { normalizeBusinessName } = require('./bookingEmailParse.service');
const { isShopmonkeyTenant } = require('../config/shopmonkeyTenant');
const {
  MASTER_CATEGORIES,
  DEFAULT_CATEGORY_SLUG,
  KEYWORD_RULES,
  SEED_SERVICE_MAPPINGS,
} = require('./auto-shop-classification.constants');

const normalizeServiceName = (name) => normalizeBusinessName(name);

function scoreFuzzyMatch(rawNorm, candidateNorm) {
  if (!rawNorm || !candidateNorm) return 0;
  if (rawNorm === candidateNorm) return 100 + candidateNorm.length;
  if (rawNorm.includes(candidateNorm) || candidateNorm.includes(rawNorm)) {
    return 50 + Math.min(rawNorm.length, candidateNorm.length);
  }
  return 0;
}

function classifyByKeywords(rawName) {
  const norm = normalizeServiceName(rawName);
  if (!norm) return null;

  for (const rule of KEYWORD_RULES) {
    for (const keyword of rule.keywords) {
      const keywordNorm = normalizeServiceName(keyword);
      if (!keywordNorm) continue;
      if (norm.includes(keywordNorm)) {
        return { slug: rule.slug, matchSource: 'keyword', confidence: 85 };
      }
    }
  }
  return null;
}

function classifyByFuzzy(rawName, candidates) {
  const rawNorm = normalizeServiceName(rawName);
  if (!rawNorm) return null;

  let best = null;
  let bestScore = 0;

  for (const candidate of candidates) {
    const candNorm = normalizeServiceName(candidate.serviceNameDisplay || candidate.name);
    const score = scoreFuzzyMatch(rawNorm, candNorm);
    if (score > bestScore) {
      bestScore = score;
      best = {
        categoryId: candidate.masterCategoryId || candidate.master_category_id,
        slug: candidate.categorySlug || candidate.slug,
        matchSource: 'fuzzy',
        confidence: Math.min(95, score),
      };
    }
  }

  if (!best || bestScore < 50) return null;
  return best;
}

const mapCategoryRow = (row) => ({
  id: row.id,
  slug: row.slug,
  name: row.name,
  followUpIntervalDays: row.follow_up_interval_days,
  sortOrder: row.sort_order ?? 0,
  reminderEnabled: row.reminder_enabled !== false,
  reminderMessage: row.reminder_message || '',
});

const mapMappingRow = (row) => ({
  id: row.id,
  serviceName: row.service_name_display,
  serviceNameNormalized: row.service_name_normalized,
  categorySlug: row.category_slug,
  categoryName: row.category_name,
  matchSource: row.match_source,
  confidence: row.confidence,
  hitCount: row.hit_count ?? 0,
  updatedAt: row.updated_at,
});

async function getTenantName(tenantId) {
  const result = await db.query('SELECT name FROM tenants WHERE id = $1', [tenantId]);
  return result.rows[0]?.name || '';
}

async function isClassificationEnabled(tenantId, tenantName) {
  return isShopmonkeyTenant(tenantId, tenantName || await getTenantName(tenantId));
}

async function ensureMasterCategories(tenantId) {
  const existing = await db.query(
    'SELECT id FROM auto_shop_master_categories WHERE tenant_id = $1 LIMIT 1',
    [tenantId],
  );
  if (existing.rows.length > 0) return;

  for (const cat of MASTER_CATEGORIES) {
    await db.query(
      `INSERT INTO auto_shop_master_categories
        (tenant_id, slug, name, follow_up_interval_days, sort_order, updated_at)
       VALUES ($1, $2, $3, $4, $5, NOW())
       ON CONFLICT (tenant_id, slug) DO NOTHING`,
      [tenantId, cat.slug, cat.name, cat.followUpIntervalDays, cat.sortOrder],
    );
  }

  const categories = await db.query(
    'SELECT id, slug FROM auto_shop_master_categories WHERE tenant_id = $1',
    [tenantId],
  );
  const bySlug = Object.fromEntries(categories.rows.map((r) => [r.slug, r.id]));

  for (const mapping of SEED_SERVICE_MAPPINGS) {
    const categoryId = bySlug[mapping.categorySlug];
    if (!categoryId) continue;
    const normalized = normalizeServiceName(mapping.serviceName);
    await db.query(
      `INSERT INTO auto_shop_service_mappings
        (tenant_id, service_name_normalized, service_name_display, master_category_id,
         match_source, confidence, hit_count, updated_at)
       VALUES ($1, $2, $3, $4, 'seed', 100, 0, NOW())
       ON CONFLICT (tenant_id, service_name_normalized) DO NOTHING`,
      [tenantId, normalized, mapping.serviceName, categoryId],
    );
  }
}

async function getCategoryBySlug(tenantId, slug) {
  const result = await db.query(
    `SELECT id, slug, name, follow_up_interval_days, sort_order
     FROM auto_shop_master_categories
     WHERE tenant_id = $1 AND slug = $2
     LIMIT 1`,
    [tenantId, slug],
  );
  return result.rows[0] ? mapCategoryRow(result.rows[0]) : null;
}

async function getCachedMapping(tenantId, normalizedName) {
  const result = await db.query(
    `SELECT m.id, m.service_name_display, m.service_name_normalized, m.match_source,
            m.confidence, m.hit_count, m.master_category_id,
            c.slug AS category_slug, c.name AS category_name, c.follow_up_interval_days
     FROM auto_shop_service_mappings m
     JOIN auto_shop_master_categories c ON c.id = m.master_category_id
     WHERE m.tenant_id = $1 AND m.service_name_normalized = $2
     LIMIT 1`,
    [tenantId, normalizedName],
  );
  return result.rows[0] || null;
}

async function upsertServiceMapping(tenantId, {
  normalizedName,
  displayName,
  categoryId,
  matchSource,
  confidence,
}) {
  await db.query(
    `INSERT INTO auto_shop_service_mappings
      (tenant_id, service_name_normalized, service_name_display, master_category_id,
       match_source, confidence, hit_count, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, 1, NOW())
     ON CONFLICT (tenant_id, service_name_normalized) DO UPDATE SET
       service_name_display = EXCLUDED.service_name_display,
       master_category_id = EXCLUDED.master_category_id,
       match_source = EXCLUDED.match_source,
       confidence = EXCLUDED.confidence,
       hit_count = auto_shop_service_mappings.hit_count + 1,
       updated_at = NOW()`,
    [tenantId, normalizedName, displayName, categoryId, matchSource, confidence],
  );
}

async function classifyShopmonkeyService(tenantId, rawName, { tenantName } = {}) {
  const displayName = String(rawName || '').trim();
  if (!displayName) return null;

  if (!(await isClassificationEnabled(tenantId, tenantName))) return null;

  await ensureMasterCategories(tenantId);

  const normalizedName = normalizeServiceName(displayName);
  if (!normalizedName) return null;

  const cached = await getCachedMapping(tenantId, normalizedName);
  if (cached) {
    await db.query(
      `UPDATE auto_shop_service_mappings
       SET hit_count = hit_count + 1, updated_at = NOW()
       WHERE tenant_id = $1 AND service_name_normalized = $2`,
      [tenantId, normalizedName],
    );
    return {
      categoryId: cached.master_category_id,
      slug: cached.category_slug,
      name: cached.category_name,
      followUpIntervalDays: cached.follow_up_interval_days,
      matchSource: 'cache',
      confidence: cached.confidence,
      serviceName: displayName,
      serviceNameNormalized: normalizedName,
    };
  }

  const keywordMatch = classifyByKeywords(displayName);
  if (keywordMatch) {
    const category = await getCategoryBySlug(tenantId, keywordMatch.slug);
    if (category) {
      await upsertServiceMapping(tenantId, {
        normalizedName,
        displayName,
        categoryId: category.id,
        matchSource: keywordMatch.matchSource,
        confidence: keywordMatch.confidence,
      });
      return {
        categoryId: category.id,
        slug: category.slug,
        name: category.name,
        followUpIntervalDays: category.followUpIntervalDays,
        matchSource: keywordMatch.matchSource,
        confidence: keywordMatch.confidence,
        serviceName: displayName,
        serviceNameNormalized: normalizedName,
      };
    }
  }

  const fuzzyCandidates = await db.query(
    `SELECT m.service_name_display, m.master_category_id, c.slug AS category_slug
     FROM auto_shop_service_mappings m
     JOIN auto_shop_master_categories c ON c.id = m.master_category_id
     WHERE m.tenant_id = $1`,
    [tenantId],
  );
  const fuzzyMatch = classifyByFuzzy(displayName, fuzzyCandidates.rows);
  if (fuzzyMatch) {
    const category = fuzzyMatch.categoryId
      ? { id: fuzzyMatch.categoryId, slug: fuzzyMatch.slug }
      : await getCategoryBySlug(tenantId, fuzzyMatch.slug);
    if (category?.id) {
      const fullCategory = await db.query(
        `SELECT id, slug, name, follow_up_interval_days, sort_order
         FROM auto_shop_master_categories WHERE id = $1`,
        [category.id],
      );
      const cat = mapCategoryRow(fullCategory.rows[0]);
      await upsertServiceMapping(tenantId, {
        normalizedName,
        displayName,
        categoryId: cat.id,
        matchSource: fuzzyMatch.matchSource,
        confidence: fuzzyMatch.confidence,
      });
      return {
        categoryId: cat.id,
        slug: cat.slug,
        name: cat.name,
        followUpIntervalDays: cat.followUpIntervalDays,
        matchSource: fuzzyMatch.matchSource,
        confidence: fuzzyMatch.confidence,
        serviceName: displayName,
        serviceNameNormalized: normalizedName,
      };
    }
  }

  const defaultCategory = await getCategoryBySlug(tenantId, DEFAULT_CATEGORY_SLUG);
  if (!defaultCategory) return null;

  await upsertServiceMapping(tenantId, {
    normalizedName,
    displayName,
    categoryId: defaultCategory.id,
    matchSource: 'default',
    confidence: 40,
  });

  return {
    categoryId: defaultCategory.id,
    slug: defaultCategory.slug,
    name: defaultCategory.name,
    followUpIntervalDays: defaultCategory.followUpIntervalDays,
    matchSource: 'default',
    confidence: 40,
    serviceName: displayName,
    serviceNameNormalized: normalizedName,
  };
}

function excludeDeferredFromClassifications(classifications = [], deferredServiceNames = []) {
  if (!deferredServiceNames.length) return classifications;

  const deferredNorms = new Set(
    deferredServiceNames.map((name) => normalizeServiceName(name)).filter(Boolean),
  );
  if (deferredNorms.size === 0) return classifications;

  return classifications.filter((item) => {
    const norm = normalizeServiceName(item.serviceName);
    return norm && !deferredNorms.has(norm);
  });
}
async function persistVisitClassification(tenantId, {
  appointmentId,
  contactId,
  orderId,
  shopmonkeyServiceId,
  classification,
}) {
  if (!classification) return null;

  await db.query(
    `INSERT INTO auto_shop_visit_service_classifications
      (tenant_id, appointment_id, contact_id, shopmonkey_order_id, shopmonkey_service_id,
       service_name, service_name_normalized, master_category_id, match_source,
       confidence, follow_up_interval_days)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
     ON CONFLICT (tenant_id, appointment_id, service_name_normalized) DO UPDATE SET
       master_category_id = EXCLUDED.master_category_id,
       match_source = EXCLUDED.match_source,
       confidence = EXCLUDED.confidence,
       follow_up_interval_days = EXCLUDED.follow_up_interval_days`,
    [
      tenantId,
      appointmentId || null,
      contactId,
      orderId || null,
      shopmonkeyServiceId || null,
      classification.serviceName,
      classification.serviceNameNormalized,
      classification.categoryId,
      classification.matchSource,
      classification.confidence,
      classification.followUpIntervalDays,
    ],
  );

  return classification;
}

async function classifyVisitServices(tenantId, {
  tenantName,
  appointmentId,
  contactId,
  orderId,
  services = [],
}) {
  if (!(await isClassificationEnabled(tenantId, tenantName))) {
    return { classified: 0, skipped: true };
  }

  const performed = (services || []).filter((s) => s?.name && String(s.name).trim());
  if (performed.length === 0) {
    return { classified: 0, services: [] };
  }

  const results = [];
  for (const service of performed) {
    const classification = await classifyShopmonkeyService(tenantId, service.name, { tenantName });
    if (!classification) continue;
    await persistVisitClassification(tenantId, {
      appointmentId,
      contactId,
      orderId,
      shopmonkeyServiceId: service.id,
      classification,
    });
    results.push(classification);
  }

  if (appointmentId && results.length > 0) {
    await db.query(
      `UPDATE appointments
       SET raw_payload = COALESCE(raw_payload, '{}'::jsonb) || $2::jsonb,
           updated_at = NOW()
       WHERE id = $1`,
      [
        appointmentId,
        JSON.stringify({
          shopmonkeyClassifiedServices: results.map((r) => ({
            serviceName: r.serviceName,
            categorySlug: r.slug,
            categoryName: r.name,
            followUpIntervalDays: r.followUpIntervalDays,
            matchSource: r.matchSource,
            confidence: r.confidence,
          })),
        }),
      ],
    );
  }

  return { classified: results.length, services: results };
}

async function listMasterCategories(tenantId) {
  if (!(await isClassificationEnabled(tenantId))) {
    return { categories: [], enabled: false };
  }
  await ensureMasterCategories(tenantId);
  const result = await db.query(
    `SELECT id, slug, name, follow_up_interval_days, sort_order,
            reminder_enabled, reminder_message
     FROM auto_shop_master_categories
     WHERE tenant_id = $1
     ORDER BY sort_order ASC, name ASC`,
    [tenantId],
  );
  return { categories: result.rows.map(mapCategoryRow), enabled: true };
}

async function updateMasterCategories(tenantId, { categories = [], maintenanceReminderEnabled } = {}) {
  if (!(await isClassificationEnabled(tenantId))) {
    throw Object.assign(new Error('Service classification is not enabled for this account'), {
      statusCode: 403,
      isOperational: true,
    });
  }

  await ensureMasterCategories(tenantId);

  if (maintenanceReminderEnabled !== undefined) {
    await db.query(
      `UPDATE tenant_shopmonkey_connections
       SET maintenance_reminder_enabled = $2, updated_at = NOW()
       WHERE tenant_id = $1`,
      [tenantId, !!maintenanceReminderEnabled],
    );
  }

  for (const cat of categories) {
    if (!cat?.id) continue;
    const interval = cat.followUpIntervalDays == null || cat.followUpIntervalDays === ''
      ? null
      : Number(cat.followUpIntervalDays);
    if (interval != null && (!Number.isFinite(interval) || interval <= 0)) {
      throw Object.assign(new Error(`Invalid interval for ${cat.name || 'category'}`), {
        statusCode: 400,
        isOperational: true,
      });
    }

    const sets = ['updated_at = NOW()'];
    const params = [tenantId, cat.id];
    let idx = 3;

    if (interval != null) {
      sets.push(`follow_up_interval_days = $${idx++}`);
      params.push(interval);
    }
    if (cat.reminderEnabled !== undefined) {
      sets.push(`reminder_enabled = $${idx++}`);
      params.push(cat.reminderEnabled !== false);
    }
    if (cat.reminderMessage !== undefined) {
      sets.push(`reminder_message = $${idx++}`);
      params.push(cat.reminderMessage || null);
    }

    if (sets.length === 1) continue;

    await db.query(
      `UPDATE auto_shop_master_categories SET ${sets.join(', ')} WHERE tenant_id = $1 AND id = $2`,
      params,
    );
  }

  return listMasterCategories(tenantId);
}

async function getAutoShopServicesForAutomations(tenantId) {
  const tenantRow = await db.query('SELECT name FROM tenants WHERE id = $1', [tenantId]);
  const tenantName = tenantRow.rows[0]?.name || '';
  if (!(await isClassificationEnabled(tenantId, tenantName))) {
    return null;
  }

  const categoriesResult = await listMasterCategories(tenantId);
  const settings = await db.query(
    `SELECT maintenance_reminder_enabled
     FROM tenant_shopmonkey_connections
     WHERE tenant_id = $1`,
    [tenantId],
  );

  return {
    mode: 'auto_shop',
    maintenanceReminderEnabled: settings.rows[0]?.maintenance_reminder_enabled !== false,
    categories: categoriesResult.categories,
  };
}

async function listServiceMappings(tenantId, { page = 1, limit = 50 } = {}) {
  if (!(await isClassificationEnabled(tenantId))) {
    return { mappings: [], total: 0, enabled: false };
  }

  const safeLimit = Math.min(Math.max(Number(limit) || 50, 1), 200);
  const safePage = Math.max(Number(page) || 1, 1);
  const offset = (safePage - 1) * safeLimit;

  const countResult = await db.query(
    'SELECT COUNT(*)::int AS total FROM auto_shop_service_mappings WHERE tenant_id = $1',
    [tenantId],
  );

  const result = await db.query(
    `SELECT m.id, m.service_name_display, m.service_name_normalized, m.match_source,
            m.confidence, m.hit_count, m.updated_at,
            c.slug AS category_slug, c.name AS category_name
     FROM auto_shop_service_mappings m
     JOIN auto_shop_master_categories c ON c.id = m.master_category_id
     WHERE m.tenant_id = $1
     ORDER BY m.hit_count DESC, m.updated_at DESC
     LIMIT $2 OFFSET $3`,
    [tenantId, safeLimit, offset],
  );

  return {
    mappings: result.rows.map(mapMappingRow),
    total: countResult.rows[0]?.total || 0,
    page: safePage,
    limit: safeLimit,
    enabled: true,
  };
}

module.exports = {
  MASTER_CATEGORIES,
  SEED_SERVICE_MAPPINGS,
  KEYWORD_RULES,
  DEFAULT_CATEGORY_SLUG,
  normalizeServiceName,
  classifyByKeywords,
  classifyByFuzzy,
  scoreFuzzyMatch,
  classifyShopmonkeyService,
  classifyVisitServices,
  excludeDeferredFromClassifications,
  ensureMasterCategories,
  listMasterCategories,
  listServiceMappings,
  updateMasterCategories,
  getAutoShopServicesForAutomations,
  isClassificationEnabled,
};
