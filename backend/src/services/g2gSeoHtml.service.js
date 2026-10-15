const fs = require('fs');
const path = require('path');
const {
  getPublishedLocationBySlug,
  locationCanonicalUrl,
  hubCanonicalUrl,
} = require('./g2gSeoLocations.service');

const G2G_ROOT_DIR = path.join(__dirname, '../../../frontend/dist-g2g-public');

function readSpaIndexTemplate() {
  const indexPath = path.join(G2G_ROOT_DIR, 'index.html');
  if (!fs.existsSync(indexPath)) return null;
  return fs.readFileSync(indexPath, 'utf-8');
}

function injectSeo(html, { title, description, canonical, jsonLd }) {
  let out = html;
  if (title) {
    out = out.replace(/<title>[^<]*<\/title>/i, `<title>${escapeHtml(title)}</title>`);
  }
  if (description) {
    if (/<meta\s+name="description"/i.test(out)) {
      out = out.replace(
        /<meta\s+name="description"[^>]*>/i,
        `<meta name="description" content="${escapeAttr(description)}" />`,
      );
    } else {
      out = out.replace(
        /<head>/i,
        `<head>\n    <meta name="description" content="${escapeAttr(description)}" />`,
      );
    }
  }
  const canonicalTag = canonical
    ? `<link rel="canonical" href="${escapeAttr(canonical)}" />`
    : '';
  if (canonicalTag) {
    if (/<link\s+rel="canonical"/i.test(out)) {
      out = out.replace(/<link\s+rel="canonical"[^>]*>/i, canonicalTag);
    } else {
      out = out.replace(/<\/head>/i, `    ${canonicalTag}\n  </head>`);
    }
  }
  if (jsonLd) {
    const script = `<script type="application/ld+json">${JSON.stringify(jsonLd)}</script>`;
    out = out.replace(/<\/head>/i, `    ${script}\n  </head>`);
  }
  return out;
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function escapeAttr(s) {
  return String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;');
}

async function buildG2gSpaIndexForPath(reqPath) {
  const template = readSpaIndexTemplate();
  if (!template) return null;

  const parts = String(reqPath || '').split('/').filter(Boolean);
  if (parts[0] === 'cash-for-junk-cars' && parts.length === 1) {
    return injectSeo(template, {
      title: 'Cash for Junk Cars — Metro Atlanta | Cash4JunkCar',
      description:
        'Location-specific cash for junk cars across Metro Atlanta. Alpharetta, Sandy Springs, Marietta area, Cobb, Cherokee, and more. Get your online estimate.',
      canonical: hubCanonicalUrl(),
    });
  }

  if (parts[0] === 'cash-for-junk-cars' && parts.length >= 2) {
    const slug = parts[1];
    const loc = await getPublishedLocationBySlug(slug);
    if (!loc) return null;
    const jsonLd = {
      '@context': 'https://schema.org',
      '@type': 'Service',
      name: loc.heroHeadline || `Cash for junk cars in ${loc.displayName}`,
      areaServed: {
        '@type': 'City',
        name: loc.displayName,
      },
      provider: {
        '@type': 'LocalBusiness',
        name: 'Cash4JunkCar',
      },
    };
    return injectSeo(template, {
      title: loc.metaTitle || loc.heroHeadline,
      description: loc.metaDescription || loc.heroSubhead,
      canonical: locationCanonicalUrl(slug),
      jsonLd,
    });
  }

  return null;
}

module.exports = {
  buildG2gSpaIndexForPath,
  readSpaIndexTemplate,
};
