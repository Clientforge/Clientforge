import { useEffect, useState } from 'react';
import { computeOfferRange, CONDITION_OPTIONS } from '../lib/pricingEngine.js';
import { decodeVin, isValidVinFormat, normalizeVin } from '../lib/vinDecode.js';

export default function OfferPage() {
  useEffect(() => {
    document.title = 'Get offer — Grace to Grace';
  }, []);

  const [vin, setVin] = useState('');
  const [decoding, setDecoding] = useState(false);
  const [decodeError, setDecodeError] = useState('');

  const [year, setYear] = useState('');
  const [make, setMake] = useState('');
  const [model, setModel] = useState('');
  const [bodyClass, setBodyClass] = useState('');
  const [engineNote, setEngineNote] = useState('');

  const [mileage, setMileage] = useState('');
  const [zip, setZip] = useState('');
  const [conditionId, setConditionId] = useState(CONDITION_OPTIONS[0].id);

  const [result, setResult] = useState(null);
  const [formError, setFormError] = useState('');

  const handleDecode = async () => {
    setDecodeError('');
    const v = normalizeVin(vin);
    if (!isValidVinFormat(v)) {
      setDecodeError('Enter a valid 17-character VIN (letters and numbers only; no I, O, or Q).');
      return;
    }
    setDecoding(true);
    try {
      const data = await decodeVin(v);
      setYear(data.year || '');
      setMake(data.make || '');
      setModel(data.model || '');
      setBodyClass(data.bodyClass || '');
      setEngineNote(data.engine || '');
    } catch (e) {
      setDecodeError(e.message || 'Decode failed.');
    } finally {
      setDecoding(false);
    }
  };

  const handleEstimate = (e) => {
    e.preventDefault();
    setFormError('');
    setResult(null);
    if (!year.trim() || !make.trim() || !model.trim()) {
      setFormError('Year, make, and model are required (use VIN decode or enter manually).');
      return;
    }
    if (!zip.trim() || zip.replace(/\D/g, '').length < 5) {
      setFormError('Enter a 5-digit ZIP code.');
      return;
    }
    const range = computeOfferRange({
      year: year.trim(),
      bodyClass,
      conditionId,
      zip: zip.trim(),
      mileage: mileage.trim(),
    });
    setResult(range);
  };

  return (
    <>
      <h1 className="g2g-page-title">Get your estimate</h1>
      <p className="g2g-page-lead">
        Decode your VIN with NHTSA data, confirm vehicle details, and choose a condition. You&apos;ll get a dollar
        range from our internal v1 pricing engine (demo — not a binding offer).
      </p>

      <form className="g2g-form" onSubmit={handleEstimate}>
        <div className="g2g-field">
          <label htmlFor="vin">VIN (optional but recommended)</label>
          <div className="g2g-row">
            <div className="g2g-field" style={{ flex: 2, minWidth: '200px' }}>
              <input
                id="vin"
                name="vin"
                autoComplete="off"
                placeholder="17-character VIN"
                value={vin}
                maxLength={17}
                onChange={(ev) => setVin(ev.target.value.toUpperCase())}
              />
            </div>
            <button type="button" className="g2g-btn g2g-btn--ghost" disabled={decoding} onClick={handleDecode}>
              {decoding ? 'Decoding…' : 'Decode VIN'}
            </button>
          </div>
          {decodeError ? (
            <p className="g2g-field-hint" style={{ color: 'var(--g2g-danger)' }}>
              {decodeError}
            </p>
          ) : null}
        </div>

        <div className="g2g-row">
          <div className="g2g-field">
            <label htmlFor="year">Year</label>
            <input id="year" name="year" inputMode="numeric" value={year} onChange={(e) => setYear(e.target.value)} />
          </div>
          <div className="g2g-field">
            <label htmlFor="make">Make</label>
            <input id="make" name="make" value={make} onChange={(e) => setMake(e.target.value)} />
          </div>
          <div className="g2g-field">
            <label htmlFor="model">Model</label>
            <input id="model" name="model" value={model} onChange={(e) => setModel(e.target.value)} />
          </div>
        </div>

        {engineNote || bodyClass ? (
          <div className="g2g-decode-meta">
            {bodyClass ? <div>Body class (from VIN): {bodyClass}</div> : null}
            {engineNote ? <div>Engine (from VIN): {engineNote}</div> : null}
          </div>
        ) : null}

        <div className="g2g-field">
          <label htmlFor="mileage">Mileage (optional)</label>
          <input
            id="mileage"
            name="mileage"
            inputMode="numeric"
            placeholder="e.g. 145000"
            value={mileage}
            onChange={(e) => setMileage(e.target.value)}
          />
        </div>

        <div className="g2g-field">
          <label htmlFor="zip">ZIP code</label>
          <input
            id="zip"
            name="zip"
            inputMode="numeric"
            autoComplete="postal-code"
            placeholder="30260"
            maxLength={10}
            value={zip}
            onChange={(e) => setZip(e.target.value)}
          />
        </div>

        <div className="g2g-field">
          <label htmlFor="condition">Condition</label>
          <select id="condition" name="condition" value={conditionId} onChange={(e) => setConditionId(e.target.value)}>
            {CONDITION_OPTIONS.map((o) => (
              <option key={o.id} value={o.id}>
                {o.label}
              </option>
            ))}
          </select>
        </div>

        {formError ? <div className="g2g-alert g2g-alert--error">{formError}</div> : null}

        <button type="submit" className="g2g-btn g2g-btn--primary">
          Show estimated range
        </button>
      </form>

      {result ? (
        <div className="g2g-result">
          <h2>Your estimated range</h2>
          <p className="g2g-offer-range">
            ${result.low.toLocaleString()} — ${result.high.toLocaleString()}
          </p>
          <p style={{ margin: 0, color: 'var(--g2g-muted)', fontSize: '0.92rem' }}>
            Internal base (before condition): ~${result.meta.baseBeforeCondition.toLocaleString()} · Condition factor:{' '}
            {result.meta.conditionFactor} · Class: {result.meta.vehicleClass} · Scrap floor: $
            {result.meta.scrapFloor}
          </p>
          <p className="g2g-disclaimer">
            This range is generated by a demo pricing engine only. It is not a guaranteed purchase price. Market APIs,
            local scrap prices, title status, and pickup logistics are not fully modeled in v1.
          </p>
        </div>
      ) : null}
    </>
  );
}
