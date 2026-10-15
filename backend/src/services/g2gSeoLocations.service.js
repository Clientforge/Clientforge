const db = require('../db/connection');
const { g2gCanonicalOrigin } = require('../config/g2gPublicHost');

function mapRow(row) {
  if (!row) return null;
  return {
    slug: row.slug,
    city: row.city,
    state: row.state,
    displayName: row.display_name,
    metaTitle: row.meta_title,
    metaDescription: row.meta_description,
    heroHeadline: row.hero_headline,
    heroSubhead: row.hero_subhead,
    localIntro: row.local_intro,
    neighborhoods: row.neighborhoods || [],
    localFaq: row.local_faq || [],
    nearbySlugs: row.nearby_slugs || [],
    primaryZip: row.primary_zip,
    sortOrder: row.sort_order,
    updatedAt: row.updated_at,
  };
}

async function listPublishedLocations() {
  const r = await db.query(
    `SELECT slug, city, state, display_name, meta_title, meta_description, sort_order
     FROM g2g_seo_locations
     WHERE published = true
     ORDER BY sort_order ASC, city ASC`,
  );
  return r.rows.map((row) => ({
    slug: row.slug,
    city: row.city,
    state: row.state,
    displayName: row.display_name,
    metaTitle: row.meta_title,
    metaDescription: row.meta_description,
    sortOrder: row.sort_order,
  }));
}

async function getPublishedLocationBySlug(slug) {
  const normalized = String(slug || '').trim().toLowerCase();
  if (!normalized) return null;
  const r = await db.query(
    `SELECT *
     FROM g2g_seo_locations
     WHERE slug = $1 AND published = true
     LIMIT 1`,
    [normalized],
  );
  return mapRow(r.rows[0]);
}

async function getPublishedSlugsByList(slugs = []) {
  const list = slugs.filter(Boolean).map((s) => String(s).trim().toLowerCase());
  if (list.length === 0) return [];
  const r = await db.query(
    `SELECT slug, display_name
     FROM g2g_seo_locations
     WHERE published = true AND slug = ANY($1::text[])
     ORDER BY sort_order ASC`,
    [list],
  );
  return r.rows.map((row) => ({ slug: row.slug, displayName: row.display_name }));
}

function locationCanonicalUrl(slug) {
  const origin = g2gCanonicalOrigin() || '';
  const path = `/cash-for-junk-cars/${slug}/`;
  return origin ? `${origin}${path}` : path;
}

function hubCanonicalUrl() {
  const origin = g2gCanonicalOrigin() || '';
  const path = '/cash-for-junk-cars/';
  return origin ? `${origin}${path}` : path;
}

async function buildSitemapXml() {
  const origin = g2gCanonicalOrigin();
  if (!origin) {
    return '<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"></urlset>';
  }
  const locations = await listPublishedLocations();
  const urls = [
    { loc: `${origin}/`, priority: '1.0' },
    { loc: `${origin}/cash-for-junk-cars/`, priority: '0.9' },
    { loc: `${origin}/offer`, priority: '0.8' },
    ...locations.map((loc) => ({
      loc: `${origin}/cash-for-junk-cars/${loc.slug}/`,
      priority: '0.85',
    })),
  ];
  const body = urls
    .map(
      (u) => `  <url><loc>${escapeXml(u.loc)}</loc><changefreq>weekly</changefreq><priority>${u.priority}</priority></url>`,
    )
    .join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${body}\n</urlset>`;
}

function escapeXml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

module.exports = {
  listPublishedLocations,
  getPublishedLocationBySlug,
  getPublishedSlugsByList,
  locationCanonicalUrl,
  hubCanonicalUrl,
  buildSitemapXml,
  mapRow,
};
