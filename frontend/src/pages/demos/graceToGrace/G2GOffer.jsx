import { useEffect, useMemo, useRef, useState } from 'react';
import {
  MILEAGE_SELECT_OPTIONS,
  BODY_STRUCTURAL_KEYS,
  BODY_PANEL_LABELS,
  TITLE_STATUS_OPTIONS,
  START_DRIVE,
  EXTERIOR,
  EXTERIOR_COMPLETE,
  CATALYTIC,
  INTERIOR_QUALITY,
} from './pricingEngine';
import { postGraceEstimate, postGraceSellIntent } from './graceEstimateApi';
import { decodeVin, isValidVinFormat, normalizeVin } from './vinDecode';
import {
  OTHER_VALUE,
  VEHICLE_YEARS,
  VEHICLE_MAKES,
  MODELS_BY_MAKE,
  matchMakeToCatalog,
  matchModelToCatalog,
  coerceDecodedYear,
} from './vehicleCatalog';

const FLOW = {
  year: 1,
  make: 2,
  model: 3,
  vin: 4,
  zipTitle: 5,
  mileage: 6,
  battery: 7,
  key: 8,
  startDrive: 9,
  tiresInflated: 10,
  tiresAttached: 11,
  exterior: 12,
  exteriorComplete: 13,
  glass: 14,
  catalytic: 15,
  interior: 16,
  body: 17,
};

function FlowBlock({ children, step, flowMax, className = '' }) {
  const isPast = step < flowMax;
  const isCurrent = step === flowMax;
  return (
    <div
      className={`g2g-flow-block ${isPast ? 'g2g-flow-block--past' : ''} ${isCurrent ? 'g2g-flow-block--current' : ''} ${className}`.trim()}
      data-flow-step={step}
      aria-current={isCurrent ? 'step' : undefined}
    >
      {children}
    </div>
  );
}

function YesNoRow({ label, value, onChange, groupId, hint }) {
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
      {hint ? <p className="g2g-field-hint" style={{ width: '100%', margin: '0.25rem 0 0' }}>{hint}</p> : null}
    </div>
  );
}

function StartDriveRow({ value, onChange, groupId }) {
  return (
    <div className="g2g-damage-row">
      <span className="g2g-damage-label" id={`${groupId}-label`}>
        Start &amp; drive
      </span>
      <div
        className="g2g-segment g2g-segment--wide g2g-segment--triple"
        role="group"
        aria-labelledby={`${groupId}-label`}
      >
        <button
          type="button"
          className={value === START_DRIVE.starts_drives ? 'g2g-segment--active' : ''}
          onClick={() => onChange(START_DRIVE.starts_drives)}
        >
          Yes — starts and drives
        </button>
        <button
          type="button"
          className={value === START_DRIVE.starts_not_drives ? 'g2g-segment--active' : ''}
          onClick={() => onChange(START_DRIVE.starts_not_drives)}
        >
          Starts but does not drive
        </button>
        <button
          type="button"
          className={value === START_DRIVE.does_not_start ? 'g2g-segment--active' : ''}
          onClick={() => onChange(START_DRIVE.does_not_start)}
        >
          Does not start (or requires a jump)
        </button>
      </div>
    </div>
  );
}

function TwoOptionRow({ label, value, onChange, groupId, leftValue, rightValue, leftLabel, rightLabel }) {
  return (
    <div className="g2g-damage-row">
      <span className="g2g-damage-label" id={`${groupId}-label`}>
        {label}
      </span>
      <div className="g2g-segment g2g-segment--wide" role="group" aria-labelledby={`${groupId}-label`}>
        <button
          type="button"
          className={value != null && value === leftValue ? 'g2g-segment--active' : ''}
          onClick={() => onChange(leftValue)}
        >
          {leftLabel}
        </button>
        <button
          type="button"
          className={value != null && value === rightValue ? 'g2g-segment--active' : ''}
          onClick={() => onChange(rightValue)}
        >
          {rightLabel}
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

const initialBody = () => ({
  front: 'none',
  rear: 'none',
  left: 'none',
  right: 'none',
  engine: 'none',
  flood: 'none',
  fire: 'none',
  glass: null,
  airbag: 'none',
});

function isModelComplete(makeSelect, makeOther, modelSelect, modelOther) {
  if (!makeSelect) return false;
  if (makeSelect === OTHER_VALUE) {
    return Boolean(makeOther.trim() && modelOther.trim());
  }
  if (!modelSelect) return false;
  if (modelSelect === OTHER_VALUE) {
    return Boolean(modelOther.trim());
  }
  return true;
}

function computeUnlockedStep({
  year,
  makeSelect,
  makeOther,
  modelSelect,
  modelOther,
  vinStepAcknowledged,
  zip,
  mileageBracket,
  battery,
  key,
  startDrive,
  tiresInflated,
  tiresAttached,
  exterior,
  exteriorComplete,
  glass,
  catalytic,
  interiorQuality,
}) {
  let m = FLOW.year;
  if (!String(year || '').trim()) return m;
  m = FLOW.make;
  if (!makeSelect) return m;
  m = FLOW.model;
  if (!isModelComplete(makeSelect, makeOther, modelSelect, modelOther)) return m;
  m = FLOW.vin;
  if (!vinStepAcknowledged) return m;
  m = FLOW.zipTitle;
  if (String(zip || '').replace(/\D/g, '').length < 5) return m;
  m = FLOW.mileage;
  if (!mileageBracket) return m;
  m = FLOW.battery;
  if (battery == null) return m;
  m = FLOW.key;
  if (key == null) return m;
  m = FLOW.startDrive;
  if (startDrive == null) return m;
  m = FLOW.tiresInflated;
  if (tiresInflated == null) return m;
  m = FLOW.tiresAttached;
  if (tiresAttached == null) return m;
  m = FLOW.exterior;
  if (exterior == null) return m;
  m = FLOW.exteriorComplete;
  if (exteriorComplete == null) return m;
  m = FLOW.glass;
  if (glass == null) return m;
  m = FLOW.catalytic;
  if (catalytic == null) return m;
  m = FLOW.interior;
  if (interiorQuality == null) return m;
  m = FLOW.body;
  return m;
}

function buildSellConditionSummary({
  titleStatus,
  mileageBracket,
  battery,
  key,
  startDrive,
  tiresInflated,
  tiresAttached,
  exterior,
  exteriorComplete,
  catalytic,
  interiorQuality,
  bodyDamage,
}) {
  const mi = MILEAGE_SELECT_OPTIONS.find((o) => o.value === mileageBracket)?.label || mileageBracket || '—';
  const damagedPanels = BODY_STRUCTURAL_KEYS.filter((k) => bodyDamage[k] === 'some')
    .map((k) => BODY_PANEL_LABELS[k])
    .join(', ');
  const parts = [
    `title:${titleStatus}`,
    `mi:${mi}`,
    `drive:${startDrive}`,
    `bat:${battery}`,
    `key:${key}`,
    `tires:${tiresInflated}/${tiresAttached}`,
    `ext:${exterior}/${exteriorComplete}`,
    `cat:${catalytic}`,
    `int:${interiorQuality}`,
    `glass:${bodyDamage.glass}`,
    bodyDamage.airbag === 'some' ? 'airbag:deployed' : 'airbag:ok',
  ];
  if (damagedPanels) parts.push(`panels:${damagedPanels}`);
  return parts.join(' · ').slice(0, 500);
}

export default function G2GOffer() {
  const flowEndRef = useRef(null);

  useEffect(() => {
    document.title = 'Get offer — Grace to Grace';
  }, []);

  const [vin, setVin] = useState('');
  const [decoding, setDecoding] = useState(false);
  const [decodeError, setDecodeError] = useState('');

  const [year, setYear] = useState('');
  const [makeSelect, setMakeSelect] = useState('');
  const [makeOther, setMakeOther] = useState('');
  const [modelSelect, setModelSelect] = useState('');
  const [modelOther, setModelOther] = useState('');
  const [bodyClass, setBodyClass] = useState('');
  const [engineNote, setEngineNote] = useState('');

  const [mileageBracket, setMileageBracket] = useState('');
  const [zip, setZip] = useState('');
  const [titleStatus, setTitleStatus] = useState('clean');

  const [vinStepAcknowledged, setVinStepAcknowledged] = useState(false);
  const [startDrive, setStartDrive] = useState(null);
  const [battery, setBattery] = useState(null);
  const [key, setKey] = useState(null);
  const [tiresInflated, setTiresInflated] = useState(null);
  const [tiresAttached, setTiresAttached] = useState(null);
  const [exterior, setExterior] = useState(null);
  const [exteriorComplete, setExteriorComplete] = useState(null);
  const [catalytic, setCatalytic] = useState(null);
  const [interiorQuality, setInteriorQuality] = useState(null);
  const [bodyDamage, setBodyDamage] = useState(initialBody);

  const [result, setResult] = useState(null);
  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const [sellOpen, setSellOpen] = useState(false);
  const [sellName, setSellName] = useState('');
  const [sellPhone, setSellPhone] = useState('');
  const [sellConsent, setSellConsent] = useState(false);
  const [sellBusy, setSellBusy] = useState(false);
  const [sellErr, setSellErr] = useState('');
  const [sellOk, setSellOk] = useState(false);

  const unlocked = useMemo(
    () =>
      computeUnlockedStep({
        year,
        makeSelect,
        makeOther,
        modelSelect,
        modelOther,
        vinStepAcknowledged,
        zip,
        mileageBracket,
        battery,
        key,
        startDrive,
        tiresInflated,
        tiresAttached,
        exterior,
        exteriorComplete,
        glass: bodyDamage.glass,
        catalytic,
        interiorQuality,
      }),
    [
      year,
      makeSelect,
      makeOther,
      modelSelect,
      modelOther,
      vinStepAcknowledged,
      zip,
      mileageBracket,
      battery,
      key,
      startDrive,
      tiresInflated,
      tiresAttached,
      exterior,
      exteriorComplete,
      bodyDamage.glass,
      catalytic,
      interiorQuality,
    ],
  );

  const [flowMax, setFlowMax] = useState(1);

  useEffect(() => {
    setFlowMax((f) => Math.max(f, unlocked));
  }, [unlocked]);

  useEffect(() => {
    if (flowEndRef.current) {
      flowEndRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }, [flowMax]);

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
      const y = coerceDecodedYear(data.year);
      if (y) setYear(y);
      const rawMake = String(data.make || '').trim();
      const rawModel = String(data.model || '').trim();
      const canonMake = matchMakeToCatalog(rawMake);
      if (canonMake) {
        setMakeSelect(canonMake);
        setMakeOther('');
        const canonModel = matchModelToCatalog(canonMake, rawModel);
        if (canonModel) {
          setModelSelect(canonModel);
          setModelOther('');
        } else {
          setModelSelect(OTHER_VALUE);
          setModelOther(rawModel);
        }
      } else {
        setMakeSelect(OTHER_VALUE);
        setMakeOther(rawMake);
        setModelSelect('');
        setModelOther(rawModel);
      }
      setBodyClass(data.bodyClass || '');
      setEngineNote(data.engine || '');
      setVinStepAcknowledged(true);
    } catch (e) {
      setDecodeError(e.message || 'Decode failed.');
    } finally {
      setDecoding(false);
    }
  };

  const handleEstimate = async (e) => {
    e.preventDefault();
    setFormError('');
    setResult(null);
    setSellOk(false);
    setSellOpen(false);
    const makeFinal =
      makeSelect === OTHER_VALUE
        ? makeOther.trim()
        : makeSelect.trim();
    const modelFinal =
      makeSelect === OTHER_VALUE
        ? modelOther.trim()
        : modelSelect === OTHER_VALUE
          ? modelOther.trim()
          : modelSelect.trim();
    if (!year.trim() || !makeFinal || !modelFinal) {
      setFormError('Complete the vehicle steps: year, make, and model.');
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
    if (
      battery == null
      || key == null
      || startDrive == null
      || tiresInflated == null
      || tiresAttached == null
      || exterior == null
      || exteriorComplete == null
      || catalytic == null
      || interiorQuality == null
      || bodyDamage.glass == null
    ) {
      setFormError('Answer each condition question to get an estimate.');
      return;
    }
    setSubmitting(true);
    const drives = startDrive === START_DRIVE.does_not_start ? 'no' : 'yes';
    try {
      const range = await postGraceEstimate({
        year: year.trim(),
        make: makeFinal,
        model: modelFinal,
        bodyClass,
        zip: zip.trim().replace(/\D/g, '').slice(0, 5),
        mileageMidpoint: mileageBracket,
        titleStatus,
        vin: normalizeVin(vin) || undefined,
        assessment: {
          startDrive,
          drives,
          battery,
          key,
          tiresInflated,
          tiresAttached,
          exterior,
          exteriorComplete,
          catalytic,
          interior: interiorQuality,
          body: bodyDamage,
        },
      });
      setResult(range);
    } catch (err) {
      setFormError(err.message || 'Could not reach pricing service.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleSellSubmit = async (e) => {
    e.preventDefault();
    setSellErr('');
    setSellOk(false);
    const makeFinal =
      makeSelect === OTHER_VALUE ? makeOther.trim() : makeSelect.trim();
    const modelFinal =
      makeSelect === OTHER_VALUE
        ? modelOther.trim()
        : modelSelect === OTHER_VALUE
          ? modelOther.trim()
          : modelSelect.trim();
    if (!sellName.trim() || sellName.trim().length < 2) {
      setSellErr('Enter your name.');
      return;
    }
    if (!sellPhone.trim()) {
      setSellErr('Enter your phone number.');
      return;
    }
    if (!sellConsent) {
      setSellErr('Please confirm consent to receive SMS from Grace to Grace.');
      return;
    }
    if (!result || result.low == null || result.high == null) return;

    const miLabel =
      MILEAGE_SELECT_OPTIONS.find((o) => o.value === mileageBracket)?.label || mileageBracket;
    const conditionLabel = buildSellConditionSummary({
      titleStatus,
      mileageBracket,
      battery,
      key,
      startDrive,
      tiresInflated,
      tiresAttached,
      exterior,
      exteriorComplete,
      catalytic,
      interiorQuality,
      bodyDamage,
    });

    setSellBusy(true);
    try {
      await postGraceSellIntent({
        customerName: sellName.trim(),
        phone: sellPhone.trim(),
        smsConsent: true,
        year: year.trim(),
        make: makeFinal,
        model: modelFinal,
        zip: zip.trim().replace(/\D/g, '').slice(0, 5),
        vin: normalizeVin(vin) || undefined,
        mileage: miLabel || undefined,
        conditionLabel,
        estimateLow: result.low,
        estimateHigh: result.high,
      });
      setSellOk(true);
      setSellOpen(false);
    } catch (err) {
      setSellErr(err.message || 'Something went wrong.');
    } finally {
      setSellBusy(false);
    }
  };

  const setPanel = (k, val) => {
    setBodyDamage((prev) => ({ ...prev, [k]: val }));
  };

  const modelListForMake = makeSelect && makeSelect !== OTHER_VALUE ? MODELS_BY_MAKE[makeSelect] || [] : [];

  const canSubmitEstimate = unlocked >= FLOW.body;

  return (
    <>
      <h1 className="g2g-page-title">Get your estimate</h1>
      <p className="g2g-page-lead">
        Answer each question as it appears. Your previous answers stay on screen — like a short conversation — until
        you see your range. Not a binding offer.
      </p>

      <div className="g2g-flow" aria-live="polite">
        <form className="g2g-form g2g-form--offer g2g-form--flow" onSubmit={handleEstimate}>
          {flowMax >= FLOW.year ? (
            <FlowBlock step={FLOW.year} flowMax={flowMax}>
              <div className="g2g-flow-block-title">What year is your vehicle?</div>
              <div className="g2g-field">
                <label htmlFor="g2g-year">Year</label>
                <select
                  id="g2g-year"
                  name="year"
                  value={year}
                  onChange={(e) => setYear(e.target.value)}
                >
                  <option value="">Select year</option>
                  {VEHICLE_YEARS.map((y) => (
                    <option key={y} value={y}>
                      {y}
                    </option>
                  ))}
                </select>
              </div>
            </FlowBlock>
          ) : null}

          {flowMax >= FLOW.make ? (
            <FlowBlock step={FLOW.make} flowMax={flowMax}>
              <div className="g2g-flow-block-title">What make?</div>
              <div className="g2g-field">
                <label htmlFor="g2g-make">Make</label>
                <select
                  id="g2g-make"
                  name="make"
                  value={makeSelect}
                  onChange={(e) => {
                    const v = e.target.value;
                    setMakeSelect(v);
                    if (v !== OTHER_VALUE) {
                      setMakeOther('');
                    }
                    setModelSelect('');
                    setModelOther('');
                  }}
                >
                  <option value="">Select make</option>
                  {VEHICLE_MAKES.map((m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
                  <option value={OTHER_VALUE}>Other (type make &amp; model)</option>
                </select>
              </div>
            </FlowBlock>
          ) : null}

          {flowMax >= FLOW.model ? (
            <FlowBlock step={FLOW.model} flowMax={flowMax}>
              <div className="g2g-flow-block-title">What model?</div>
              {makeSelect && makeSelect !== OTHER_VALUE ? (
                <div className="g2g-field">
                  <label htmlFor="g2g-model">Model</label>
                  <select
                    id="g2g-model"
                    name="model"
                    value={modelSelect}
                    onChange={(e) => {
                      const v = e.target.value;
                      setModelSelect(v);
                      if (v !== OTHER_VALUE) {
                        setModelOther('');
                      }
                    }}
                  >
                    <option value="">Select model</option>
                    {modelListForMake.map((mo) => (
                      <option key={mo} value={mo}>
                        {mo}
                      </option>
                    ))}
                    <option value={OTHER_VALUE}>Other (specify)</option>
                  </select>
                </div>
              ) : null}
              {makeSelect === OTHER_VALUE ? (
                <div className="g2g-row">
                  <div className="g2g-field">
                    <label htmlFor="g2g-make-other">Make (not listed)</label>
                    <input
                      id="g2g-make-other"
                      name="makeOther"
                      autoComplete="off"
                      placeholder="e.g. Alfa Romeo"
                      value={makeOther}
                      onChange={(e) => setMakeOther(e.target.value)}
                    />
                  </div>
                  <div className="g2g-field">
                    <label htmlFor="g2g-model-free">Model</label>
                    <input
                      id="g2g-model-free"
                      name="modelFree"
                      autoComplete="off"
                      placeholder="e.g. Stelvio"
                      value={modelOther}
                      onChange={(e) => setModelOther(e.target.value)}
                    />
                  </div>
                </div>
              ) : null}
              {makeSelect && makeSelect !== OTHER_VALUE && modelSelect === OTHER_VALUE ? (
                <div className="g2g-field">
                  <label htmlFor="g2g-model-other">Model name</label>
                  <input
                    id="g2g-model-other"
                    name="modelOther"
                    autoComplete="off"
                    placeholder="Type the model (e.g. Camry XSE)"
                    value={modelOther}
                    onChange={(e) => setModelOther(e.target.value)}
                  />
                  <p className="g2g-field-hint">Use when your exact trim isn&apos;t in the list.</p>
                </div>
              ) : null}
            </FlowBlock>
          ) : null}

          {flowMax >= FLOW.vin ? (
            <FlowBlock step={FLOW.vin} flowMax={flowMax}>
              <div className="g2g-flow-block-title">VIN (optional)</div>
              <p className="g2g-flow-block-lead">
                Add a VIN to fill details from NHTSA, or skip to continue with what you entered.
              </p>
              <div className="g2g-field">
                <label htmlFor="g2g-vin">17-character VIN</label>
                <div className="g2g-row">
                  <div className="g2g-field" style={{ flex: 2, minWidth: '200px' }}>
                    <input
                      id="g2g-vin"
                      name="vin"
                      autoComplete="off"
                      placeholder="If you don’t have it, skip below"
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
              {engineNote || bodyClass ? (
                <div className="g2g-decode-meta">
                  {bodyClass ? <div>Body class (from VIN): {bodyClass}</div> : null}
                  {engineNote ? <div>Engine (from VIN): {engineNote}</div> : null}
                </div>
              ) : null}
              {!vinStepAcknowledged ? (
                <div className="g2g-flow-actions">
                  <button
                    type="button"
                    className="g2g-btn g2g-btn--primary"
                    onClick={() => setVinStepAcknowledged(true)}
                  >
                    Continue
                  </button>
                </div>
              ) : null}
            </FlowBlock>
          ) : null}

          {flowMax >= FLOW.zipTitle ? (
            <FlowBlock step={FLOW.zipTitle} flowMax={flowMax}>
              <div className="g2g-flow-block-title">Where is the vehicle &amp; what title status?</div>
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
              <div className="g2g-field">
                <label htmlFor="g2g-title">Title status (seller-reported)</label>
                <select
                  id="g2g-title"
                  name="titleStatus"
                  value={titleStatus}
                  onChange={(e) => setTitleStatus(e.target.value)}
                >
                  {TITLE_STATUS_OPTIONS.map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.label}
                    </option>
                  ))}
                </select>
                <p className="g2g-field-hint">Pricing uses your selection; verified title is not pulled yet.</p>
              </div>
            </FlowBlock>
          ) : null}

          {flowMax >= FLOW.mileage ? (
            <FlowBlock step={FLOW.mileage} flowMax={flowMax}>
              <div className="g2g-flow-block-title">What&apos;s the mileage?</div>
              <div className="g2g-field">
                <label htmlFor="g2g-mileage-select">Mileage range</label>
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
            </FlowBlock>
          ) : null}

          {flowMax >= FLOW.battery ? (
            <FlowBlock step={FLOW.battery} flowMax={flowMax}>
              <div className="g2g-flow-block-title">Condition</div>
              <YesNoRow
                label="Battery"
                value={battery}
                onChange={setBattery}
                groupId="g2g-battery"
                hint="Yes = installed and working. No = missing or not working."
              />
            </FlowBlock>
          ) : null}

          {flowMax >= FLOW.key ? (
            <FlowBlock step={FLOW.key} flowMax={flowMax}>
              <YesNoRow
                label="Key availability"
                value={key}
                onChange={setKey}
                groupId="g2g-key"
                hint="Yes = key is available. No = no key."
              />
            </FlowBlock>
          ) : null}

          {flowMax >= FLOW.startDrive ? (
            <FlowBlock step={FLOW.startDrive} flowMax={flowMax}>
              <StartDriveRow value={startDrive} onChange={setStartDrive} groupId="g2g-start-drive" />
            </FlowBlock>
          ) : null}

          {flowMax >= FLOW.tiresInflated ? (
            <FlowBlock step={FLOW.tiresInflated} flowMax={flowMax}>
              <YesNoRow
                label="Are all tires inflated with air?"
                value={tiresInflated}
                onChange={setTiresInflated}
                groupId="g2g-tires-air"
              />
            </FlowBlock>
          ) : null}

          {flowMax >= FLOW.tiresAttached ? (
            <FlowBlock step={FLOW.tiresAttached} flowMax={flowMax}>
              <YesNoRow
                label="Are all tires attached to the car?"
                value={tiresAttached}
                onChange={setTiresAttached}
                groupId="g2g-tires-attached"
              />
            </FlowBlock>
          ) : null}

          {flowMax >= FLOW.exterior ? (
            <FlowBlock step={FLOW.exterior} flowMax={flowMax}>
              <TwoOptionRow
                label="Exterior condition"
                value={exterior}
                onChange={setExterior}
                groupId="g2g-exterior"
                leftValue={EXTERIOR.no_major}
                rightValue={EXTERIOR.rust_or_damage}
                leftLabel="No major damage (minor dents/dings only)"
                rightLabel="Has rust or visible exterior damage"
              />
            </FlowBlock>
          ) : null}

          {flowMax >= FLOW.exteriorComplete ? (
            <FlowBlock step={FLOW.exteriorComplete} flowMax={flowMax}>
              <TwoOptionRow
                label="Exterior completeness"
                value={exteriorComplete}
                onChange={setExteriorComplete}
                groupId="g2g-exterior-complete"
                leftValue={EXTERIOR_COMPLETE.all}
                rightValue={EXTERIOR_COMPLETE.incomplete}
                leftLabel="All exterior parts (doors, bumpers, panels) are attached"
                rightLabel="One or more are broken, loose, or missing"
              />
            </FlowBlock>
          ) : null}

          {flowMax >= FLOW.glass ? (
            <FlowBlock step={FLOW.glass} flowMax={flowMax}>
              <TwoOptionRow
                label="Glass, mirrors &amp; lights"
                value={bodyDamage.glass}
                onChange={(v) => setPanel('glass', v)}
                groupId="g2g-glass"
                leftValue="none"
                rightValue="some"
                leftLabel="No damage (all intact)"
                rightLabel="At least one is damaged or missing"
              />
            </FlowBlock>
          ) : null}

          {flowMax >= FLOW.catalytic ? (
            <FlowBlock step={FLOW.catalytic} flowMax={flowMax}>
              <TwoOptionRow
                label="Catalytic converter"
                value={catalytic}
                onChange={setCatalytic}
                groupId="g2g-cat"
                leftValue={CATALYTIC.present}
                rightValue={CATALYTIC.missing}
                leftLabel="Present (attached)"
                rightLabel="Missing"
              />
            </FlowBlock>
          ) : null}

          {flowMax >= FLOW.interior ? (
            <FlowBlock step={FLOW.interior} flowMax={flowMax}>
              <TwoOptionRow
                label="Interior condition"
                value={interiorQuality}
                onChange={setInteriorQuality}
                groupId="g2g-interior-quality"
                leftValue={INTERIOR_QUALITY.clean}
                rightValue={INTERIOR_QUALITY.damaged}
                leftLabel="Clean — no heavy wear, odors, stains, or missing trim"
                rightLabel="Heavy wear, odors/stains, ripped or missing upholstery, or missing trim/panels"
              />
            </FlowBlock>
          ) : null}

          {flowMax >= FLOW.body ? (
            <FlowBlock step={FLOW.body} flowMax={flowMax}>
              <div className="g2g-flow-block-title">Body &amp; panels</div>
              <p className="g2g-form-section-hint" style={{ marginTop: 0 }}>
                For each area, choose whether there is no damage or some damage.
              </p>
              <div className="g2g-damage-list">
                {BODY_STRUCTURAL_KEYS.map((panelKey) => (
                  <DamageRow
                    key={panelKey}
                    label={BODY_PANEL_LABELS[panelKey]}
                    value={bodyDamage[panelKey]}
                    onChange={(v) => setPanel(panelKey, v)}
                    groupId={`g2g-body-${panelKey}`}
                  />
                ))}
                <TwoOptionRow
                  label="Airbag condition"
                  value={bodyDamage.airbag}
                  onChange={(v) => setPanel('airbag', v)}
                  groupId="g2g-airbag"
                  leftValue="none"
                  rightValue="some"
                  leftLabel="No — airbags are intact"
                  rightLabel="Yes — airbags are deployed"
                />
              </div>
            </FlowBlock>
          ) : null}

          <span ref={flowEndRef} className="g2g-flow-anchor" />

          {formError ? <div className="g2g-alert g2g-alert--error">{formError}</div> : null}

          {canSubmitEstimate ? (
            <button type="submit" className="g2g-btn g2g-btn--primary g2g-submit-sticky" disabled={submitting}>
              {submitting ? 'Calculating…' : 'Show estimated range'}
            </button>
          ) : null}
        </form>
      </div>

      {result && result.low != null && result.high != null ? (
        <div className="g2g-result">
          <h2>Your estimated range</h2>
          {result.pointOffer != null && Number.isFinite(Number(result.pointOffer)) ? (
            <p className="g2g-offer-typical" style={{ margin: '0.35rem 0 0.25rem', fontSize: '1.1rem' }}>
              Typical offer: <strong>${Number(result.pointOffer).toLocaleString()}</strong>
              {result.meta?.estimator === 'camry_rule_table' ? (
                <span style={{ color: 'var(--g2g-muted)', fontWeight: 400, fontSize: '0.92rem' }}>
                  {' '}
                  (from the reference band, then condition multipliers; floor is scrap value, not the table
                  minimum)
                </span>
              ) : null}
              {result.meta?.estimator === 'valuation_bands' ? (
                <span style={{ color: 'var(--g2g-muted)', fontWeight: 400, fontSize: '0.92rem' }}>
                  {' '}
                  (tier score blends worst vs best band anchors — severe issues pull toward the lowest band more
                  sharply)
                </span>
              ) : null}
            </p>
          ) : null}
          <p className="g2g-offer-range">
            ${Number(result.low).toLocaleString()} — ${Number(result.high).toLocaleString()}
          </p>
          <button
            type="button"
            className="g2g-btn g2g-btn--primary g2g-mt"
            onClick={() => {
              setSellOpen((o) => !o);
              setSellErr('');
              setSellOk(false);
            }}
          >
            {sellOpen ? 'Hide' : 'Sell'} now — we&apos;ll text you
          </button>
          {sellOk ? (
            <div className="g2g-alert g2g-alert--success g2g-mt" role="status">
              Thanks — we got your details and our team has been notified. We&apos;ll reach out shortly.
            </div>
          ) : null}
          {sellOpen ? (
            <form className="g2g-sell-panel g2g-form" onSubmit={handleSellSubmit}>
              <p style={{ margin: '0 0 0.75rem', fontSize: '0.92rem', color: 'var(--g2g-muted)' }}>
                Confirm how we can reach you. Submitting sends a text alert to our buyer team with your vehicle and
                estimate details.
              </p>
              <div className="g2g-field">
                <label htmlFor="g2g-sell-name">Your name</label>
                <input
                  id="g2g-sell-name"
                  name="customerName"
                  autoComplete="name"
                  value={sellName}
                  onChange={(ev) => setSellName(ev.target.value)}
                  required
                />
              </div>
              <div className="g2g-field g2g-mt">
                <label htmlFor="g2g-sell-phone">Mobile phone</label>
                <input
                  id="g2g-sell-phone"
                  name="phone"
                  type="tel"
                  autoComplete="tel"
                  value={sellPhone}
                  onChange={(ev) => setSellPhone(ev.target.value)}
                  required
                />
              </div>
              <div className="g2g-field g2g-mt">
                <label className="g2g-consent">
                  <input
                    type="checkbox"
                    checked={sellConsent}
                    onChange={(ev) => setSellConsent(ev.target.checked)}
                  />
                  <span>
                    I agree to receive SMS messages from Grace to Grace about selling my vehicle. Message and data rates
                    may apply. Reply STOP to opt out.
                  </span>
                </label>
              </div>
              {sellErr ? <div className="g2g-alert g2g-alert--error g2g-mt">{sellErr}</div> : null}
              <button type="submit" className="g2g-btn g2g-btn--primary g2g-mt" disabled={sellBusy}>
                {sellBusy ? 'Sending…' : 'Submit & notify our team'}
              </button>
            </form>
          ) : null}
          {result.meta?.estimator === 'camry_rule_table' ? (
            <div style={{ margin: 0, color: 'var(--g2g-muted)', fontSize: '0.92rem' }}>
              <p style={{ margin: '0 0 0.4rem' }}>
                Rule band: <strong>{result.meta?.yearBand ?? '—'}</strong> · Base row:{' '}
                <strong>{result.meta?.baseRule ?? 'running'}</strong> · Assessment:{' '}
                <strong>{result.meta?.ruleCondition ?? '—'}</strong>
                {result.meta?.ruleConditionReason ? <> ({result.meta.ruleConditionReason})</> : null} · Reference
                (running) min/max: ${result.meta?.priceLow != null ? Number(result.meta.priceLow).toLocaleString() : '—'}{' '}
                – ${result.meta?.priceHigh != null ? Number(result.meta.priceHigh).toLocaleString() : '—'}
                {result.meta?.scrapFloor != null && result.meta?.priceLow != null
                && Number(result.meta.scrapFloor) < Number(result.meta.priceLow) ? (
                  <> · Hard floor (scrap): ${Number(result.meta.scrapFloor).toLocaleString()}</>
                ) : result.meta?.scrapFloor != null ? (
                  <> · Hard floor: ${Number(result.meta.scrapFloor).toLocaleString()}</>
                ) : null}
                {result.meta?.scrapSource ? <> · Floor source: {result.meta.scrapSource}</> : null}
              </p>
              {result.meta?.multipliers ? (
                <p style={{ margin: '0 0 0.4rem' }}>
                  Multipliers — mileage: {result.meta.multipliers.mileage ?? '—'} · title:{' '}
                  {result.meta.multipliers.title ?? '—'} · mileage/title:{' '}
                  <strong>
                    {result.meta.multipliers.appliedMileageTitle != null
                      ? result.meta.multipliers.appliedMileageTitle
                      : (result.meta.multipliers.applied ?? '—')}
                  </strong>
                  {result.meta.multipliers.drivability != null
                    && result.meta.multipliers.drivability < 1 ? (
                    <> · start/drive: {result.meta.multipliers.drivability}</>
                  ) : null}
                  {result.meta.multipliers.tires != null && result.meta.multipliers.tires < 1 ? (
                    <>
                      {' '}
                      · tires: {result.meta.multipliers.tires}
                      {result.meta.multipliers.tireMode && result.meta.multipliers.tireMode !== 'ok' ? (
                        <> ({result.meta.multipliers.tireMode})</>
                      ) : null}
                    </>
                  ) : null}
                  {result.meta.multipliers.conditionStack != null
                    && result.meta.multipliers.conditionStack < 1 ? (
                    <> · other condition: {result.meta.multipliers.conditionStack}</>
                  ) : null}
                  {result.meta.multipliers.damage != null && result.meta.multipliers.damage < 1 ? (
                    <> · body damage: {result.meta.multipliers.damage}</>
                  ) : null}
                  {result.meta?.cleanBoostApplied ? (
                    <> · clean: {result.meta.multipliers?.cleanBoost ?? 1.05}</>
                  ) : null}
                  {result.meta.multipliers.combinedPreClamp != null ? (
                    <> · combined: {result.meta.multipliers.combinedPreClamp}</>
                  ) : null}
                </p>
              ) : null}
              {result.meta?.damagePenalties && Object.keys(result.meta.damagePenalties).length > 0 ? (
                <p style={{ margin: '0 0 0.4rem' }}>
                  Damage factors:{' '}
                  {Object.entries(result.meta.damagePenalties)
                    .map(([k, v]) => `${k} ×${v}`)
                    .join(' · ')}
                </p>
              ) : null}
              {result.meta?.deductions && Number(result.meta.deductions.total) > 0 ? (
                <p style={{ margin: '0 0 0.4rem' }}>
                  Deductions: -${Number(result.meta.deductions.total).toLocaleString()}
                  {result.meta.deductions.tiresAttachedNo ? <> · tires loose</> : null}
                  {result.meta.deductions.tiresInflatedNo ? <> · tires flat</> : null}
                  {result.meta.deductions.glassSome ? <> · glass</> : null}
                  {result.meta.deductions.airbagSome ? <> · airbag</> : null}
                  {result.meta.deductions.panelsSomeKeys?.length ? (
                    <> · body panels: {result.meta.deductions.panelsSomeKeys.join(', ')}</>
                  ) : null}
                </p>
              ) : null}
              {result.meta?.clamped ? (
                <p style={{ margin: 0 }}>Offer clamped to the rule band min/max.</p>
              ) : null}
            </div>
          ) : result.meta?.estimator === 'valuation_bands' ? (
            <div style={{ margin: 0, color: 'var(--g2g-muted)', fontSize: '0.92rem' }}>
              <p style={{ margin: '0 0 0.4rem' }}>
                Band table: <strong>{result.meta?.make ?? '—'}</strong> {result.meta?.model ?? '—'} · Model years{' '}
                <strong>
                  {result.meta?.yearFrom != null ? result.meta.yearFrom : '—'}–
                  {result.meta?.yearTo != null ? result.meta.yearTo : '—'}
                </strong>
                {result.meta?.conditionTierScore != null ? (
                  <>
                    {' '}
                    · Condition score (0=worst tier, 1=best): <strong>{result.meta.conditionTierScore}</strong>
                  </>
                ) : null}
              </p>
              <p style={{ margin: '0 0 0.4rem' }}>
                Worst band: $
                {result.meta?.worst?.min != null ? Number(result.meta.worst.min).toLocaleString() : '—'} – $
                {result.meta?.worst?.max != null ? Number(result.meta.worst.max).toLocaleString() : '—'} · Best band: $
                {result.meta?.best?.min != null ? Number(result.meta.best.min).toLocaleString() : '—'} – $
                {result.meta?.best?.max != null ? Number(result.meta.best.max).toLocaleString() : '—'}
              </p>
            </div>
          ) : result.meta && typeof result.meta === 'object' ? (
            <p style={{ margin: 0, color: 'var(--g2g-muted)', fontSize: '0.92rem' }}>
              Base before condition: ~$
              {result.meta.baseBeforeCondition != null
                ? Number(result.meta.baseBeforeCondition).toLocaleString()
                : '—'}{' '}
              · Condition:{' '}
              {result.meta.conditionFactor != null && Number.isFinite(Number(result.meta.conditionFactor))
                ? Number(result.meta.conditionFactor).toFixed(3)
                : '—'}{' '}
              · Class: {result.meta.vehicleClass ?? '—'} · Scrap floor: $
              {result.meta.scrapFloor != null ? Number(result.meta.scrapFloor).toLocaleString() : '—'}
              {result.meta.marketCompsProxy != null ? (
                <>
                  {' '}
                  · Market proxy: {result.meta.marketCompsProxy} · ZIP scrap: {result.meta.scrapRegionalIndex}
                  {result.meta.metalCommodityBlend != null ? (
                    <> · Metal ETF blend: {result.meta.metalCommodityBlend}</>
                  ) : null}
                  {result.meta.scrapCombinedIndex != null ? (
                    <> · Combined scrap: {result.meta.scrapCombinedIndex}</>
                  ) : null}
                  {result.meta.alphaVantage?.status != null ? (
                    <> · Alpha Vantage: {result.meta.alphaVantage.status}</>
                  ) : null}
                  {result.meta.titleFactor != null ? (
                    <>
                      {' · '}
                      Title: {result.meta.titleFactor}
                    </>
                  ) : null}
                </>
              ) : null}
            </p>
          ) : (
            <p style={{ margin: 0, color: 'var(--g2g-muted)', fontSize: '0.92rem' }}>
              Estimated range is shown above. Detail metadata was not available for this response.
            </p>
          )}
          <p className="g2g-disclaimer">
            {result.meta?.estimator === 'camry_rule_table'
              ? 'This 2005–2017 Toyota Camry estimate uses a fixed internal rule table and a deterministic point offer (60% from min to max in the band). It is not a market valuation. Title verification, local scrap, and pickup are not included. Not a guaranteed purchase price.'
              : result.meta?.estimator === 'valuation_bands'
                ? 'This estimate uses internal worst/best dollar bands for your make, model, and year range, then maps your answers to a position between those bands. It is not a market valuation. Verified title, local sales, and pickup are not included. Not a guaranteed purchase price.'
                : 'Estimates use server v1: seller-reported title, ZIP regional scrap, optional Alpha Vantage ETF metal proxies (SLX / DBB / CPER — not spot $/lb), and a wholesale-style market proxy. Live auction feeds, verified title pulls, and pickup routing are not included yet. Not a guaranteed purchase price.'}
          </p>
        </div>
      ) : null}
    </>
  );
}
