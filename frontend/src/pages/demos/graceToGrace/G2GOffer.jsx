import { useEffect, useState } from 'react';
import {
  computeOfferRange,
  MILEAGE_SELECT_OPTIONS,
  BODY_PANEL_KEYS,
  BODY_PANEL_LABELS,
} from './pricingEngine';
import { decodeVin, isValidVinFormat, normalizeVin } from './vinDecode';

function YesNoRow({ label, value, onChange, groupId }) {
  return (
    <div className="g2g-toggle-row">
      <span className="g2g-toggle-label" id={`${groupId}-label`}>
        {label}
      </span>
      <div className="g2g-segment" role="group" aria-labelledby={`${groupId}-label`}>
        <button
          type="button"
          className={value === 'yes' ? 'g2g-segment--active' : ''}
          onClick={() => onChange('yes')}
        >
          Yes
        </button>
        <button
          type="button"
          className={value === 'no' ? 'g2g-segment--active' : ''}
          onClick={() => onChange('no')}
        >
          No
        </button>
      </div>
    </div>
  );
}

function DamageRow({ label, value, onChange, groupId }) {
  return (
    <div className="g2g-damage-row">
      <span className="g2g-damage-label" id={`${groupId}-label`}>
        {label}
      </span>
      <div className="g2g-segment g2g-segment--wide" role="group" aria-labelledby={`${groupId}-label`}>
        <button
          type="button"
          className={value === 'none' ? 'g2g-segment--active' : ''}
          onClick={() => onChange('none')}
        >
          No damage
        </button>
        <button
          type="button"
          className={value === 'some' ? 'g2g-segment--active' : ''}
          onClick={() => onChange('some')}
        >
          Some damage
        </button>
      </div>
    </div>
  );
}

const initialBody = () =>
  Object.fromEntries(BODY_PANEL_KEYS.map((k) => [k, 'none']));

export default function G2GOffer() {
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

  const [mileageBracket, setMileageBracket] = useState('');
  const [zip, setZip] = useState('');

  const [drives, setDrives] = useState('yes');
  const [tiresInflated, setTiresInflated] = useState('yes');
  const [tiresAttached, setTiresAttached] = useState('yes');
  const [bodyDamage, setBodyDamage] = useState(initialBody);

  const [result, setResult] = useState(null);
  const [formError, setFormError] = useState('');

  const handleDecode = async () => {
    setDecodeError('');
    const v = normalizeVin(vin);
    if (!v) {
      return;
    }
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
    if (!mileageBracket) {
      setFormError('Select a mileage range.');
      return;
    }
    if (!zip.trim() || zip.replace(/\D/g, '').length < 5) {
      setFormError('Enter a 5-digit ZIP code.');
      return;
    }
    const range = computeOfferRange({
      year: year.trim(),
      bodyClass,
      zip: zip.trim(),
      mileageMidpoint: mileageBracket,
      assessment: {
        drives,
        tiresInflated,
        tiresAttached,
        body: bodyDamage,
      },
    });
    setResult(range);
  };

  const setPanel = (key, val) => {
    setBodyDamage((prev) => ({ ...prev, [key]: val }));
  };

  return (
    <>
      <h1 className="g2g-page-title">Get your estimate</h1>
      <p className="g2g-page-lead">
        Optionally decode your VIN with NHTSA data, confirm vehicle details, then answer a few questions about mileage
        and condition. You&apos;ll get a dollar range from our demo pricing engine — not a binding offer.
      </p>

      <form className="g2g-form g2g-form--offer" onSubmit={handleEstimate}>
        <div className="g2g-field">
          <label htmlFor="g2g-vin">VIN (optional)</label>
          <div className="g2g-row">
            <div className="g2g-field" style={{ flex: 2, minWidth: '200px' }}>
              <input
                id="g2g-vin"
                name="vin"
                autoComplete="off"
                placeholder="17-character VIN if you have it"
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
            <label htmlFor="g2g-year">Year</label>
            <input id="g2g-year" name="year" inputMode="numeric" value={year} onChange={(e) => setYear(e.target.value)} />
          </div>
          <div className="g2g-field">
            <label htmlFor="g2g-make">Make</label>
            <input id="g2g-make" name="make" value={make} onChange={(e) => setMake(e.target.value)} />
          </div>
          <div className="g2g-field">
            <label htmlFor="g2g-model">Model</label>
            <input id="g2g-model" name="model" value={model} onChange={(e) => setModel(e.target.value)} />
          </div>
        </div>

        {engineNote || bodyClass ? (
          <div className="g2g-decode-meta">
            {bodyClass ? <div>Body class (from VIN): {bodyClass}</div> : null}
            {engineNote ? <div>Engine (from VIN): {engineNote}</div> : null}
          </div>
        ) : null}

        <div className="g2g-field">
          <label htmlFor="g2g-zip">ZIP code</label>
          <input
            id="g2g-zip"
            name="zip"
            inputMode="numeric"
            autoComplete="postal-code"
            placeholder="30260"
            maxLength={10}
            value={zip}
            onChange={(e) => setZip(e.target.value)}
          />
        </div>

        <section className="g2g-form-section" aria-labelledby="g2g-car-conditions-heading">
          <h2 id="g2g-car-conditions-heading" className="g2g-form-section-title">
            Car conditions
          </h2>

          <div className="g2g-field">
            <label htmlFor="g2g-mileage-select">What is the mileage on the car?</label>
            <select
              id="g2g-mileage-select"
              name="mileageBracket"
              value={mileageBracket}
              onChange={(e) => setMileageBracket(e.target.value)}
            >
              {MILEAGE_SELECT_OPTIONS.map((o) => (
                <option key={o.label} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>

          <YesNoRow label="Does the car drive?" value={drives} onChange={setDrives} groupId="g2g-drives" />
          <YesNoRow
            label="Are all tires inflated with air?"
            value={tiresInflated}
            onChange={setTiresInflated}
            groupId="g2g-tires-air"
          />
          <YesNoRow
            label="Are all the tires attached to the car?"
            value={tiresAttached}
            onChange={setTiresAttached}
            groupId="g2g-tires-attached"
          />
        </section>

        <section className="g2g-form-section" aria-labelledby="g2g-body-heading">
          <h2 id="g2g-body-heading" className="g2g-form-section-title">
            Body condition
          </h2>
          <p className="g2g-form-section-hint">For each area, choose whether there is no damage or some damage.</p>
          <div className="g2g-damage-list">
            {BODY_PANEL_KEYS.map((key) => (
              <DamageRow
                key={key}
                label={BODY_PANEL_LABELS[key]}
                value={bodyDamage[key]}
                onChange={(v) => setPanel(key, v)}
                groupId={`g2g-body-${key}`}
              />
            ))}
          </div>
        </section>

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
            {Number(result.meta.conditionFactor.toFixed(3))} · Class: {result.meta.vehicleClass} · Scrap floor: $
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
