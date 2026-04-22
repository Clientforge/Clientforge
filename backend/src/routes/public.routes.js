const express = require('express');

const router = express.Router();

/** NHTSA vPIC does not send Access-Control-Allow-Origin; browsers need this proxy. */
router.get('/vin-decode/:vin', async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  const raw = String(req.params.vin || '').trim().toUpperCase().replace(/\s/g, '');
  if (!/^[A-HJ-NPR-Z0-9]{17}$/.test(raw)) {
    return res.status(400).json({ error: 'Invalid VIN (must be 17 characters, no I, O, or Q).' });
  }
  const url = `https://vpic.nhtsa.dot.gov/api/vehicles/DecodeVinValues/${encodeURIComponent(raw)}?format=json`;
  try {
    const r = await fetch(url);
    if (!r.ok) {
      return res.status(502).json({ error: 'VIN service returned an error.' });
    }
    const data = await r.json();
    return res.json(data);
  } catch (err) {
    return res.status(502).json({ error: 'Could not reach VIN service.' });
  }
});

module.exports = router;
