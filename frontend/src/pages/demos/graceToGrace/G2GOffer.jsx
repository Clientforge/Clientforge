import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
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
import { getOrCreateG2gSessionId } from './g2gSession';
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
import { displayOfferUsd } from './displayOffer';
import {
  US_STATE_OPTIONS,
  composeSellAddress,
  isValidUsZipInput,
} from './usStates';

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

function StartDriveRow({ value, onChange, groupId, locked, lockHint }) {
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
          disabled={locked}
          onClick={() => !locked && onChange(START_DRIVE.starts_drives)}
        >
          Yes — starts and drives
        </button>
        <button
          type="button"
          className={value === START_DRIVE.starts_not_drives ? 'g2g-segment--active' : ''}
          disabled={locked}
          onClick={() => !locked && onChange(START_DRIVE.starts_not_drives)}
        >
          Starts but does not drive
        </button>
        <button
          type="button"
          className={value === START_DRIVE.does_not_start ? 'g2g-segment--active' : ''}
          disabled={locked}
          onClick={() => !locked && onChange(START_DRIVE.does_not_start)}
        >
          Does not start (or requires a jump)
        </button>
      </div>
      {lockHint ? (
        <p className="g2g-field-hint" style={{ width: '100%', margin: '0.35rem 0 0' }}>
          {lockHint}
        </p>
      ) : null}
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
  entryMode,
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
  if (entryMode == null) {
    return 0;
  }
  if (entryMode === 'vin') {
    const ymmOk =
      String(year || '').trim()
      && isModelComplete(makeSelect, makeOther, modelSelect, modelOther);
    if (!vinStepAcknowledged || !ymmOk) {
      return FLOW.vin;
    }
    let m = FLOW.zipTitle;
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

  let m = FLOW.year;
  if (!String(year || '').trim()) return m;
  m = FLOW.make;
  if (!makeSelect) return m;
  m = FLOW.model;
  if (!isModelComplete(makeSelect, makeOther, modelSelect, modelOther)) return m;
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
  const vinFirstInputRef = useRef(null);
  const [searchParams] = useSearchParams();
  const vinDeepLinkApplied = useRef(false);

  useEffect(() => {
    document.title = 'See what your car is worth — Grace to Grace';
  }, []);

  const [vin, setVin] = useState('');
  const [decoding, setDecoding] = useState(false);
  const [decodeError, setDecodeError] = useState('');
  const [entryMode, setEntryMode] = useState(null);

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
  /** Set when decode succeeds; cleared when VIN no longer matches (user edits) or new path. */
  const [lastDecodedVin, setLastDecodedVin] = useState('');
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
  const [sellStreet, setSellStreet] = useState('');
  const [sellCity, setSellCity] = useState('');
  const [sellState, setSellState] = useState('');
  const [sellPickupZip, setSellPickupZip] = useState('');
  const [sellConsent, setSellConsent] = useState(false);
  const [sellBusy, setSellBusy] = useState(false);
  const [sellErr, setSellErr] = useState('');
  const [sellOk, setSellOk] = useState(false);

  const unlocked = useMemo(
    () =>
      computeUnlockedStep({
        entryMode,
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
      entryMode,
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

  const [flowMax, setFlowMax] = useState(0);

  useEffect(() => {
    setFlowMax((f) => Math.max(f, unlocked));
  }, [unlocked]);

  useEffect(() => {
    if (flowEndRef.current) {
      flowEndRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }, [flowMax]);

  const ymmComplete = isModelComplete(makeSelect, makeOther, modelSelect, modelOther);
  const vinDecodedMatchesInput =
    Boolean(lastDecodedVin) && normalizeVin(vin) === lastDecodedVin;

  const { displayMake, displayModel } = useMemo(() => {
    const makeFinal =
      makeSelect === OTHER_VALUE ? makeOther.trim() : makeSelect.trim();
    const modelFinal =
      makeSelect === OTHER_VALUE
        ? modelOther.trim()
        : modelSelect === OTHER_VALUE
          ? modelOther.trim()
          : modelSelect.trim();
    return { displayMake: makeFinal, displayModel: modelFinal };
  }, [makeSelect, makeOther, modelSelect, modelOther]);

  const showVinFirstPanel =
    entryMode === 'vin'
    && flowMax >= FLOW.vin
    && (!vinStepAcknowledged || !String(year || '').trim() || !ymmComplete);

  const startVinPath = () => {
    setEntryMode('vin');
    setVin('');
    setDecodeError('');
    setVinStepAcknowledged(false);
    setLastDecodedVin('');
    setYear('');
    setMakeSelect('');
    setMakeOther('');
    setModelSelect('');
    setModelOther('');
    setBodyClass('');
    setEngineNote('');
    setZip('');
    setTitleStatus('clean');
    setMileageBracket('');
    setBattery(null);
    setKey(null);
    setStartDrive(null);
    setTiresInflated(null);
    setTiresAttached(null);
    setExterior(null);
    setExteriorComplete(null);
    setCatalytic(null);
    setInteriorQuality(null);
    setBodyDamage(initialBody());
    setFormError('');
    setResult(null);
    setSellOk(false);
    setSellOpen(false);
    setFlowMax(0);
  };

  useEffect(() => {
    if (searchParams.get('start') !== 'vin') return undefined;
    if (vinDeepLinkApplied.current) return undefined;
    vinDeepLinkApplied.current = true;
    startVinPath();
    return undefined;
    // eslint-disable-next-line react-hooks/exhaustive-deps -- one-shot deep link
  }, [searchParams]);

  const vinQueryFocusDone = useRef(false);
  useLayoutEffect(() => {
    if (searchParams.get('start') !== 'vin') return;
    if (!showVinFirstPanel) return;
    if (vinQueryFocusDone.current) return;
    const el = vinFirstInputRef.current;
    if (!el) return;
    vinQueryFocusDone.current = true;
    el.focus({ preventScroll: true });
    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, [searchParams, showVinFirstPanel]);

  const switchToManualEntry = () => {
    setEntryMode('manual');
    setVin('');
    setDecodeError('');
    setVinStepAcknowledged(false);
    setLastDecodedVin('');
    setYear('');
    setMakeSelect('');
    setMakeOther('');
    setModelSelect('');
    setModelOther('');
    setBodyClass('');
    setEngineNote('');
    setZip('');
    setTitleStatus('clean');
    setMileageBracket('');
    setBattery(null);
    setKey(null);
    setStartDrive(null);
    setTiresInflated(null);
    setTiresAttached(null);
    setExterior(null);
    setExteriorComplete(null);
    setCatalytic(null);
    setInteriorQuality(null);
    setBodyDamage(initialBody());
    setFormError('');
    setResult(null);
    setSellOk(false);
    setSellOpen(false);
    setFlowMax(0);
  };

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
      setLastDecodedVin(v);
      setVinStepAcknowledged(false);
    } catch (e) {
      setDecodeError(e.message || 'Decode failed.');
      setLastDecodedVin('');
      setVinStepAcknowledged(false);
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
        sessionId: getOrCreateG2gSessionId(),
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
    if (!sellStreet.trim() || sellStreet.trim().length < 3) {
      setSellErr('Enter the street address for pickup.');
      return;
    }
    if (!sellCity.trim() || sellCity.trim().length < 2) {
      setSellErr('Enter the city.');
      return;
    }
    if (!sellState) {
      setSellErr('Select the state.');
      return;
    }
    if (!isValidUsZipInput(sellPickupZip)) {
      setSellErr('Enter a valid 5-digit ZIP (or ZIP+4).');
      return;
    }
    const addressLine = composeSellAddress({
      street: sellStreet,
      city: sellCity,
      state: sellState,
      zip: sellPickupZip,
    });
    if (!sellConsent) {
      setSellErr('Please confirm consent to receive SMS from Grace to Grace.');
      return;
    }
    const offerDisplay = displayOfferUsd(result);
    if (!result || offerDisplay == null) return;

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
        address: addressLine,
        smsConsent: true,
        year: year.trim(),
        make: makeFinal,
        model: modelFinal,
        zip: zip.trim().replace(/\D/g, '').slice(0, 5),
        vin: normalizeVin(vin) || undefined,
        mileage: miLabel || undefined,
        conditionLabel,
        estimateLow: result.low != null ? result.low : offerDisplay,
        estimateHigh: result.high != null ? result.high : offerDisplay,
        manualReviewRequired: Boolean(result.meta?.manualReviewRequired),
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
      <h1 className="g2g-page-title">See what your car is worth</h1>
      <p className="g2g-page-lead">
        {entryMode === null
          ? 'Start with your VIN or enter year, make, and model yourself — then answer a few quick questions. You’ll get one clear offer amount to help you decide what’s next.'
          : 'Answer each question as it appears. Your previous answers stay on screen until you see your offer.'}
      </p>

      {entryMode === null ? (
        <div className="g2g-entry-choice">
          <button
            type="button"
            className="g2g-btn g2g-btn--primary g2g-entry-choice__btn"
            onClick={() => {
              setEntryMode('manual');
              setFlowMax(0);
            }}
          >
            Enter year, make &amp; model
          </button>
          <button
            type="button"
            className="g2g-btn g2g-btn--ghost g2g-entry-choice__btn"
            onClick={startVinPath}
          >
            Enter VIN
          </button>
        </div>
      ) : (
      <div className="g2g-flow" aria-live="polite">
        <form className="g2g-form g2g-form--offer g2g-form--flow" onSubmit={handleEstimate}>
          {showVinFirstPanel ? (
            <FlowBlock step={FLOW.vin} flowMax={flowMax}>
              <div className="g2g-flow-block-title">What&apos;s your VIN?</div>
              <p className="g2g-flow-block-lead">
                Enter your VIN and we&apos;ll fill in year, make, and model when we can, so you can skip those steps.
              </p>
              <div className="g2g-field">
                <label htmlFor="g2g-vin-first">17-character VIN</label>
                <div className="g2g-row">
                  <div className="g2g-field" style={{ flex: 2, minWidth: '200px' }}>
                    <input
                      ref={vinFirstInputRef}
                      id="g2g-vin-first"
                      name="vin"
                      autoComplete="off"
                      placeholder="e.g. 1HGBH41JXMN109186"
                      value={vin}
                      maxLength={17}
                      onChange={(ev) => {
                        const next = ev.target.value.toUpperCase();
                        setVin(next);
                        const n = normalizeVin(next);
                        if (n !== lastDecodedVin) {
                          setLastDecodedVin('');
                          setVinStepAcknowledged(false);
                        }
                      }}
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
              {vinDecodedMatchesInput ? (
                <div className="g2g-vin-decode-summary">
                  <div className="g2g-vin-decode-summary__title">Vehicle from this VIN</div>
                  <p className="g2g-vin-decode-summary__lead">
                    Confirm these details before continuing. If something looks wrong, edit the VIN and decode again, or enter the vehicle manually.
                  </p>
                  <dl className="g2g-vin-decode-summary__list">
                    <div className="g2g-vin-decode-summary__row">
                      <dt>Year</dt>
                      <dd>{String(year || '').trim() || '—'}</dd>
                    </div>
                    <div className="g2g-vin-decode-summary__row">
                      <dt>Make</dt>
                      <dd>{displayMake || '—'}</dd>
                    </div>
                    <div className="g2g-vin-decode-summary__row">
                      <dt>Model</dt>
                      <dd>{displayModel || '—'}</dd>
                    </div>
                  </dl>
                  {ymmComplete && !vinStepAcknowledged ? (
                    <div className="g2g-flow-actions" style={{ marginTop: '1rem' }}>
                      <button
                        type="button"
                        className="g2g-btn g2g-btn--primary"
                        onClick={() => setVinStepAcknowledged(true)}
                      >
                        Continue — looks correct
                      </button>
                    </div>
                  ) : null}
                </div>
              ) : null}
              {vinDecodedMatchesInput && !ymmComplete ? (
                <div className="g2g-field-hint" style={{ marginTop: '0.75rem' }}>
                  We couldn&apos;t match all fields from this VIN.{' '}
                  <button type="button" className="g2g-link-btn" onClick={switchToManualEntry}>
                    Enter vehicle manually
                  </button>
                </div>
              ) : null}
              <div className="g2g-field-hint" style={{ marginTop: '0.75rem' }}>
                <button type="button" className="g2g-link-btn" onClick={switchToManualEntry}>
                  Prefer to enter year, make, and model instead?
                </button>
              </div>
            </FlowBlock>
          ) : null}

          {entryMode === 'manual' && flowMax >= FLOW.year ? (
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

          {entryMode === 'manual' && flowMax >= FLOW.make ? (
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

          {entryMode === 'manual' && flowMax >= FLOW.model ? (
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
                onChange={(v) => {
                  setKey(v);
                  if (v === 'no') {
                    setStartDrive(START_DRIVE.does_not_start);
                  } else if (v === 'yes') {
                    setStartDrive(null);
                  }
                }}
                groupId="g2g-key"
                hint="Yes = key is available. No = no key."
              />
            </FlowBlock>
          ) : null}

          {flowMax >= FLOW.startDrive ? (
            <FlowBlock step={FLOW.startDrive} flowMax={flowMax}>
              <StartDriveRow
                value={startDrive}
                onChange={setStartDrive}
                groupId="g2g-start-drive"
                locked={key === 'no'}
                lockHint={
                  key === 'no'
                    ? 'Without a key the vehicle can’t be started, so we set this to “does not start” for pricing.'
                    : undefined
                }
              />
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
              {submitting ? 'Calculating…' : 'See what your car is worth'}
            </button>
          ) : null}
        </form>
      </div>
      )}

      {result && displayOfferUsd(result) != null ? (
        <div className="g2g-result">
          <h2>Here&apos;s what your car could be worth</h2>
          {result.meta?.manualReviewRequired ? (
            <div className="g2g-alert g2g-alert--info g2g-mt" role="status">
              We couldn&apos;t match this exact vehicle in our pricing reference. The amount below is a broad guide
              only — our team will review your listing and contact you with a tailored quote. You can still start a
              sell request so we have your details.
            </div>
          ) : null}
          <p className="g2g-offer-range">${displayOfferUsd(result).toLocaleString()}</p>
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
                offer details.
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
                <label htmlFor="g2g-sell-street">Street address</label>
                <input
                  id="g2g-sell-street"
                  name="addressStreet"
                  autoComplete="street-address"
                  placeholder="Number and street"
                  value={sellStreet}
                  onChange={(ev) => setSellStreet(ev.target.value)}
                  required
                />
              </div>
              <div className="g2g-field g2g-mt">
                <div className="g2g-row">
                  <div className="g2g-field" style={{ flex: '2 1 10rem' }}>
                    <label htmlFor="g2g-sell-city">City</label>
                    <input
                      id="g2g-sell-city"
                      name="addressCity"
                      autoComplete="address-level2"
                      placeholder="City"
                      value={sellCity}
                      onChange={(ev) => setSellCity(ev.target.value)}
                      required
                    />
                  </div>
                  <div className="g2g-field" style={{ flex: '0 1 7.5rem', minWidth: '7rem' }}>
                    <label htmlFor="g2g-sell-state">State</label>
                    <select
                      id="g2g-sell-state"
                      name="addressState"
                      autoComplete="address-level1"
                      value={sellState}
                      onChange={(ev) => setSellState(ev.target.value)}
                      required
                    >
                      {US_STATE_OPTIONS.map((o) => (
                        <option key={o.value || 'placeholder'} value={o.value}>
                          {o.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="g2g-field g2g-pickup-zip-field">
                    <label htmlFor="g2g-sell-pickup-zip">ZIP</label>
                    <input
                      id="g2g-sell-pickup-zip"
                      name="addressZip"
                      inputMode="numeric"
                      autoComplete="postal-code"
                      placeholder="30260"
                      maxLength={10}
                      value={sellPickupZip}
                      onChange={(ev) => setSellPickupZip(ev.target.value)}
                      required
                    />
                  </div>
                </div>
              </div>
              <div className="g2g-field g2g-mt">
                <div className="g2g-consent-wrap">
                  <input
                    id="g2g-sell-consent"
                    type="checkbox"
                    checked={sellConsent}
                    onChange={(ev) => setSellConsent(ev.target.checked)}
                  />
                  <label htmlFor="g2g-sell-consent" className="g2g-consent-text">
                    I agree to receive SMS messages from Grace to Grace about selling my vehicle. Message and data rates
                    may apply. Reply STOP to opt out.
                  </label>
                </div>
              </div>
              {sellErr ? <div className="g2g-alert g2g-alert--error g2g-mt">{sellErr}</div> : null}
              <button type="submit" className="g2g-btn g2g-btn--primary g2g-mt" disabled={sellBusy}>
                {sellBusy ? 'Sending…' : 'Submit & notify our team'}
              </button>
            </form>
          ) : null}
          <p className="g2g-disclaimer">
            This amount is an estimate based on what you shared. Your final offer may change after we confirm the
            vehicle, title, and pickup details.
          </p>
        </div>
      ) : null}
    </>
  );
}
