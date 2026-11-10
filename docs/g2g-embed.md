# Cash4JunkCar embed (iframe)

Leads still submit to `https://www.cash4junkcar.net/api/v1/public/...` from inside the iframe.

## Render env

Set parent website origin(s) (required for cross-domain embed):

```bash
G2G_FRAME_ANCESTORS=https://gracetogracecash4cars.com,https://www.gracetogracecash4cars.com
```

`cash4junkcar.net` is always allowed via `'self'`.

## Recommended iframe (quote funnel)

```html
<div id="cash4junkcar-embed" style="width:100%;max-width:900px;margin:0 auto;">
  <iframe
    id="cash4junkcar-frame"
    src="https://www.cash4junkcar.net/offer?embed=1"
    title="Get your cash offer for your junk car"
    width="100%"
    style="border:0;min-height:720px;display:block;"
    loading="lazy"
  ></iframe>
</div>
<script>
  window.addEventListener('message', function (e) {
    if (!e.data || e.data.type !== 'g2g-embed-resize') return;
  var frame = document.getElementById('cash4junkcar-frame');
    if (!frame) return;
    var h = Math.max(480, Number(e.data.height) || 0);
    frame.style.height = h + 'px';
  });
</script>
```

## URLs

| Use | URL |
|-----|-----|
| Full home + funnel | `https://www.cash4junkcar.net/?embed=1` |
| Quote form only | `https://www.cash4junkcar.net/offer?embed=1` |

With `embed=1`, or when loaded inside an iframe, site header/nav is hidden. Internal links keep `embed=1` so users stay in the iframe while browsing home → offer → service areas → contact.

## Grace to Grace parent site

- Use **one iframe** on the sell-car page (or the same `src` on every page that should show the funnel).
- Do **not** add WordPress menu items that link directly to `https://www.cash4junkcar.net/...` — that leaves the parent site.
- **Quote only:** `src="https://www.cash4junkcar.net/offer?embed=1"` (current snippet).
- **Full site in frame:** `src="https://www.cash4junkcar.net/?embed=1"`.

## Deploy

Requires backend (`G2G_FRAME_ANCESTORS`) and frontend rebuild (`npm run build` in `backend` includes `dist-g2g-public`).
