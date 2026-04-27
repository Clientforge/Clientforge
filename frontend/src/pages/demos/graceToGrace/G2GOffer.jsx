import { useEffect, useState } from 'react';
import {
  MILEAGE_SELECT_OPTIONS,
  BODY_STRUCTURAL_KEYS,
  BODY_PANEL_LABELS,
  TITLE_STATUS_OPTIONS,
  START_DRIVE,
  EXTERIOR,
  EXTERIOR_COMPLETE,
  CATALYTIC,
} from './pricingEngine';
import { postGraceEstimate } from './graceEstimateApi';
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
          className={value === leftValue ? 'g2g-segment--active' : ''}
          onClick={() => onChange(leftValue)}
        >
          {leftLabel}
        </button>
        <button
          type="button"
          className={value === rightValue ? 'g2g-segment--active' : ''}
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
  glass: 'none',
  airbag: 'none',
});

export default function G2GOffer() {
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

  const [startDrive, setStartDrive] = useState(START_DRIVE.starts_drives);
  const [battery, setBattery] = useState('yes');
  const [key, setKey] = useState('yes');
  const [tiresInflated, setTiresInflated] = useState('yes');
  const [tiresAttached, setTiresAttached] = useState('yes');
  const [exterior, setExterior] = useState(EXTERIOR.no_major);
  const [exteriorComplete, setExteriorComplete] = useState(EXTERIOR_COMPLETE.all);
  const [catalytic, setCatalytic] = useState(CATALYTIC.present);
  const [bodyDamage, setBodyDamage] = useState(initialBody);

  const [result, setResult] = useState(null);
  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);

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
      setFormError('Select year, make, and model (use VIN decode or choose from the lists). If your make is not listed, use Other.');
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

  const setPanel = (k, val) => {
    setBodyDamage((prev) => ({ ...prev, [k]: val }));
  };

  const modelListForMake = makeSelect && makeSelect !== OTHER_VALUE ? MODELS_BY_MAKE[makeSelect] || [] : [];

  return (
    <>
      <h1 className="g2g-page-title">Get your estimate</h1>
      <p className="g2g-page-lead">
        Optionally decode your VIN with NHTSA data, confirm or choose year, make, and model from the lists, then answer
        a few questions about mileage and condition. You&apos;ll get a dollar range from our demo pricing engine — not a
        binding offer.
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

        <div className="g2g-row g2g-row--vehicle">
          <div className="g2g-field">
            <label htmlFor="g2g-year">Year</label>
            <select id="g2g-year" name="year" value={year} onChange={(e) => setYear(e.target.value)}>
              <option value="">Select year</option>
              {VEHICLE_YEARS.map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
          </div>
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
        </div>
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
            <p className="g2g-field-hint">Use when your exact trim isn&apos;t in the list. We still price from make &amp; model text.</p>
          </div>
        ) : null}

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
          <p className="g2g-field-hint">
            v1 uses your selection for pricing. Verified NMVTIS / title branding is not pulled automatically yet.
          </p>
        </div>

        <section className="g2g-form-section" aria-labelledby="g2g-car-conditions-heading">
          <h2 id="g2g-car-conditions-heading" className="g2g-form-section-title">
            Vehicle condition
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

          <YesNoRow
            label="Battery"
            value={battery}
            onChange={setBattery}
            groupId="g2g-battery"
            hint="Yes = installed and working. No = missing or not working."
          />
          <YesNoRow
            label="Key availability"
            value={key}
            onChange={setKey}
            groupId="g2g-key"
            hint="Yes = key is available. No = no key."
          />

          <StartDriveRow value={startDrive} onChange={setStartDrive} groupId="g2g-start-drive" />

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
        </section>

        <section className="g2g-form-section" aria-labelledby="g2g-body-heading">
          <h2 id="g2g-body-heading" className="g2g-form-section-title">
            Body &amp; panels
          </h2>
          <p className="g2g-form-section-hint">For each area, choose whether there is no damage or some damage.</p>
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
        </section>

        {formError ? <div className="g2g-alert g2g-alert--error">{formError}</div> : null}

        <button type="submit" className="g2g-btn g2g-btn--primary" disabled={submitting}>
          {submitting ? 'Calculating…' : 'Show estimated range'}
        </button>
      </form>

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
            </p>
          ) : null}
          <p className="g2g-offer-range">
            ${Number(result.low).toLocaleString()} — ${Number(result.high).toLocaleString()}
          </p>
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
              : 'Estimates use server v1: seller-reported title, ZIP regional scrap, optional Alpha Vantage ETF metal proxies (SLX / DBB / CPER — not spot $/lb), and a wholesale-style market proxy. Live auction feeds, verified title pulls, and pickup routing are not included yet. Not a guaranteed purchase price.'}
          </p>
        </div>
      ) : null}
    </>
  );
}
