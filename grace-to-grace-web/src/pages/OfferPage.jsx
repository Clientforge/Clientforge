import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { computeOfferRange, CONDITION_OPTIONS, displayOfferUsd } from '../lib/pricingEngine.js';
import { decodeVin, isValidVinFormat, normalizeVin } from '../lib/vinDecode.js';
import { BRAND } from '../constants.js';
import { postGraceSellIntent } from '../lib/sellIntentApi.js';
import { getOrCreateG2gSessionId, postGraceEstimateSnapshot } from '../lib/estimateSnapshotApi.js';

export default function OfferPage() {
  const vinInputRef = useRef(null);
  const [searchParams] = useSearchParams();

  useEffect(() => {
    document.title = 'See what your car is worth — Grace to Grace';
  }, []);

  useEffect(() => {
    if (searchParams.get('start') !== 'vin') return undefined;
    const id = requestAnimationFrame(() => {
      const el = vinInputRef.current;
      if (!el) return;
      el.focus({ preventScroll: true });
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    });
    return () => cancelAnimationFrame(id);
  }, [searchParams]);

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

  const [sellOpen, setSellOpen] = useState(false);
  const [sellName, setSellName] = useState('');
  const [sellPhone, setSellPhone] = useState('');
  const [sellAddress, setSellAddress] = useState('');
  const [sellConsent, setSellConsent] = useState(false);
  const [sellBusy, setSellBusy] = useState(false);
  const [sellErr, setSellErr] = useState('');
  const [sellOk, setSellOk] = useState(false);

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
    setSellOk(false);
    setSellOpen(false);
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
    postGraceEstimateSnapshot({
      sessionId: getOrCreateG2gSessionId(),
      input: {
        year: year.trim(),
        make: make.trim(),
        model: model.trim(),
        zip: zip.trim().replace(/\D/g, '').slice(0, 5),
        vin: normalizeVin(vin) || undefined,
        mileage: mileage.trim() || undefined,
        conditionId,
        bodyClass: bodyClass || undefined,
        engineNote: engineNote || undefined,
      },
      result: range,
    }).catch(() => {});
  };

  const conditionLabel =
    CONDITION_OPTIONS.find((o) => o.id === conditionId)?.label || conditionId;

  const handleSellSubmit = async (e) => {
    e.preventDefault();
    setSellErr('');
    setSellOk(false);
    if (!sellName.trim() || sellName.trim().length < 2) {
      setSellErr('Enter your name.');
      return;
    }
    if (!sellPhone.trim()) {
      setSellErr('Enter your phone number.');
      return;
    }
    if (!sellAddress.trim() || sellAddress.trim().length < 8) {
      setSellErr('Enter your full pickup address (street, city, state, ZIP).');
      return;
    }
    if (!sellConsent) {
      setSellErr('Please confirm consent to receive SMS from Grace to Grace.');
      return;
    }
    if (!result) return;
    setSellBusy(true);
    try {
      await postGraceSellIntent({
        customerName: sellName.trim(),
        phone: sellPhone.trim(),
        address: sellAddress.trim(),
        smsConsent: true,
        year: year.trim(),
        make: make.trim(),
        model: model.trim(),
        zip: zip.trim().replace(/\D/g, '').slice(0, 5),
        vin: normalizeVin(vin) || undefined,
        mileage: mileage.trim() || undefined,
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

  return (
    <>
      <h1 className="g2g-page-title">See what your car is worth</h1>
      <p className="g2g-page-lead">
        Add your VIN or type year, make, and model, then a few details about condition and your ZIP. You&apos;ll get
        one straightforward offer amount to help you decide your next step — not a final check until we verify the car.
      </p>

      <form className="g2g-form" onSubmit={handleEstimate}>
        <div className="g2g-field">
          <label htmlFor="vin">VIN (optional but recommended)</label>
          <div className="g2g-row">
            <div className="g2g-field" style={{ flex: 2, minWidth: '200px' }}>
              <input
                ref={vinInputRef}
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
            {bodyClass ? <div>Vehicle style: {bodyClass}</div> : null}
            {engineNote ? <div>Engine (if listed): {engineNote}</div> : null}
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
          See what your car is worth
        </button>
      </form>

      {result && displayOfferUsd(result) != null ? (
        <div className="g2g-result">
          <h2>Here&apos;s what your car could be worth</h2>
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
                <label htmlFor="sell-name">Your name</label>
                <input
                  id="sell-name"
                  name="customerName"
                  autoComplete="name"
                  value={sellName}
                  onChange={(ev) => setSellName(ev.target.value)}
                  required
                />
              </div>
              <div className="g2g-field g2g-mt">
                <label htmlFor="sell-phone">Mobile phone</label>
                <input
                  id="sell-phone"
                  name="phone"
                  type="tel"
                  autoComplete="tel"
                  value={sellPhone}
                  onChange={(ev) => setSellPhone(ev.target.value)}
                  required
                />
              </div>
              <div className="g2g-field g2g-mt">
                <label htmlFor="sell-address">Full pickup address</label>
                <textarea
                  id="sell-address"
                  name="address"
                  className="g2g-textarea"
                  rows={3}
                  autoComplete="street-address"
                  placeholder="Street, city, state, ZIP"
                  value={sellAddress}
                  onChange={(ev) => setSellAddress(ev.target.value)}
                  required
                />
              </div>
              <div className="g2g-field g2g-mt">
                <div className="g2g-consent-wrap">
                  <input
                    id="sell-consent"
                    type="checkbox"
                    checked={sellConsent}
                    onChange={(ev) => setSellConsent(ev.target.checked)}
                  />
                  <label htmlFor="sell-consent" className="g2g-consent-text">
                    I agree to receive SMS messages from {BRAND} about selling my vehicle. Message and data rates may
                    apply. Reply STOP to opt out.
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
