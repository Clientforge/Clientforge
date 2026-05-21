import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  computeOfferRange,
  CONDITION_OPTIONS,
  hasDisplayableOffer,
} from '../lib/pricingEngine.js';
import { formatOfferRange, getDisplayRangeLoHi } from '../lib/displayOffer.js';
import OfferPricingDisplay from '../components/OfferPricingDisplay.jsx';
import { decodeVin, isValidVinFormat, normalizeVin } from '../lib/vinDecode.js';
import { BRAND } from '../constants.js';
import { postGraceSellIntent } from '../lib/sellIntentApi.js';
import {
  US_STATE_OPTIONS,
  composeSellAddress,
  isValidUsZipInput,
} from '../lib/usStates.js';
import { getOrCreateG2gSessionId, postGraceEstimateSnapshot } from '../lib/estimateSnapshotApi.js';
import { loadG2gContact, saveG2gContact } from '../lib/g2gContactStorage.js';
import { postG2gLeadStart, postG2gNotifyEstimate } from '../lib/g2gLeadApi.js';
import { lookupUsZipCityState } from '../lib/zipLookup.js';

export default function OfferPage() {
  const vinInputRef = useRef(null);
  const [searchParams] = useSearchParams();

  const [contact, setContact] = useState(() => loadG2gContact());
  const [leadFirstName, setLeadFirstName] = useState(() => loadG2gContact()?.firstName || '');
  const [leadPhone, setLeadPhone] = useState(() => loadG2gContact()?.phone || '');
  const [leadEmail, setLeadEmail] = useState(() => loadG2gContact()?.email || '');
  const [leadZip, setLeadZip] = useState(() => loadG2gContact()?.zip || '');
  const [leadCity, setLeadCity] = useState(() => loadG2gContact()?.city || '');
  const [leadState, setLeadState] = useState(() => loadG2gContact()?.state || '');
  const [zipLookupBusy, setZipLookupBusy] = useState(false);
  const [zipLookupErr, setZipLookupErr] = useState('');
  const [contactBusy, setContactBusy] = useState(false);
  const [contactErr, setContactErr] = useState('');

  const contactReady = Boolean(contact);

  useEffect(() => {
    const digits = leadZip.replace(/\D/g, '').slice(0, 5);
    if (digits.length !== 5) {
      setLeadCity('');
      setLeadState('');
      setZipLookupErr('');
      return undefined;
    }

    let cancelled = false;
    setZipLookupBusy(true);
    setZipLookupErr('');

    lookupUsZipCityState(digits)
      .then((loc) => {
        if (cancelled) return;
        if (!loc) {
          setLeadCity('');
          setLeadState('');
          setZipLookupErr('Could not find city and state for that ZIP. Check the code and try again.');
          return;
        }
        setLeadZip(loc.zip);
        setLeadCity(loc.city);
        setLeadState(loc.state);
        setZipLookupErr('');
      })
      .catch(() => {
        if (!cancelled) setZipLookupErr('Could not look up ZIP right now. Try again in a moment.');
      })
      .finally(() => {
        if (!cancelled) setZipLookupBusy(false);
      });

    return () => {
      cancelled = true;
    };
  }, [leadZip]);

  useEffect(() => {
    document.title = 'See what your car is worth — Grace to Grace';
  }, []);

  useEffect(() => {
    if (!contactReady || searchParams.get('start') !== 'vin') return undefined;
    const id = requestAnimationFrame(() => {
      const el = vinInputRef.current;
      if (!el) return;
      el.focus({ preventScroll: true });
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    });
    return () => cancelAnimationFrame(id);
  }, [searchParams, contactReady]);

  const [vin, setVin] = useState('');
  const [decoding, setDecoding] = useState(false);
  const [decodeError, setDecodeError] = useState('');

  const [year, setYear] = useState('');
  const [make, setMake] = useState('');
  const [model, setModel] = useState('');
  const [bodyClass, setBodyClass] = useState('');
  const [engineNote, setEngineNote] = useState('');

  const [mileage, setMileage] = useState('');
  const [zip, setZip] = useState(() => loadG2gContact()?.zip || '');
  const [conditionId, setConditionId] = useState(CONDITION_OPTIONS[0].id);

  const [result, setResult] = useState(null);
  const [formError, setFormError] = useState('');

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

  const handleContactSubmit = async (e) => {
    e.preventDefault();
    setContactErr('');
    if (!leadFirstName.trim() || leadFirstName.trim().length < 2) {
      setContactErr('Enter your first name.');
      return;
    }
    if (!leadPhone.trim()) {
      setContactErr('Enter your phone number.');
      return;
    }
    if (!leadEmail.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(leadEmail.trim())) {
      setContactErr('Enter a valid email address.');
      return;
    }
    const zipClean = leadZip.replace(/\D/g, '').slice(0, 5);
    if (zipClean.length !== 5) {
      setContactErr('Enter a valid 5-digit ZIP code.');
      return;
    }
    if (!leadCity.trim() || !leadState.trim()) {
      setContactErr(zipLookupErr || 'Enter your ZIP code and wait for city and state to fill in.');
      return;
    }
    setContactBusy(true);
    try {
      const { leadId } = await postG2gLeadStart({
        firstName: leadFirstName.trim(),
        phone: leadPhone.trim(),
        email: leadEmail.trim(),
        zip: zipClean,
        city: leadCity.trim(),
        state: leadState.trim(),
        sessionId: getOrCreateG2gSessionId(),
      });
      const saved = {
        firstName: leadFirstName.trim(),
        phone: leadPhone.trim(),
        email: leadEmail.trim().toLowerCase(),
        zip: zipClean,
        city: leadCity.trim(),
        state: leadState.trim(),
        leadId: leadId || undefined,
      };
      saveG2gContact(saved);
      setContact(saved);
      setZip(zipClean);
      setSellName(saved.firstName);
      setSellPhone(saved.phone);
      setSellPickupZip(zipClean);
      setSellCity(saved.city);
      setSellState(saved.state);
    } catch (err) {
      setContactErr(err.message || 'Something went wrong.');
    } finally {
      setContactBusy(false);
    }
  };

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
    const zipClean = zip.trim().replace(/\D/g, '').slice(0, 5);
    const snapshotInput = {
      year: year.trim(),
      make: make.trim(),
      model: model.trim(),
      zip: zipClean,
      vin: normalizeVin(vin) || undefined,
      mileage: mileage.trim() || undefined,
      conditionId,
      bodyClass: bodyClass || undefined,
      engineNote: engineNote || undefined,
    };
    postGraceEstimateSnapshot({
      sessionId: getOrCreateG2gSessionId(),
      input: snapshotInput,
      result: range,
    }).catch(() => {});
    if (contact) {
      const displayRange = formatOfferRange(range);
      const rangeLoHi = getDisplayRangeLoHi(range);
      postG2gNotifyEstimate({
        firstName: contact.firstName,
        phone: contact.phone,
        email: contact.email,
        zip: zipClean,
        city: contact.city,
        state: contact.state,
        leadId: contact.leadId,
        sessionId: getOrCreateG2gSessionId(),
        year: year.trim(),
        make: make.trim(),
        model: model.trim(),
        vin: normalizeVin(vin) || undefined,
        mileage: mileage.trim() || undefined,
        conditionLabel,
        estimateLow: rangeLoHi?.lo ?? range.low,
        estimateHigh: rangeLoHi?.hi ?? range.high,
        estimateDisplay: displayRange || undefined,
      }).catch((err) => {
        console.warn('[G2G] Estimate team notify failed:', err?.message || err);
      });
    }
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
    if (!result) return;
    setSellBusy(true);
    try {
      await postGraceSellIntent({
        customerName: sellName.trim(),
        phone: sellPhone.trim(),
        email: contact?.email,
        leadId: contact?.leadId,
        address: addressLine,
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

  if (!contactReady) {
    return (
      <>
        <h1 className="g2g-page-title">Get your estimate</h1>
        <p className="g2g-page-lead">
          Enter your contact info so we can send your estimate and follow up if you have questions. Next, you&apos;ll
          add your vehicle details — same quick flow as before.
        </p>
        <form className="g2g-form" onSubmit={handleContactSubmit}>
          <div className="g2g-field">
            <label htmlFor="lead-first-name">First name</label>
            <input
              id="lead-first-name"
              name="firstName"
              autoComplete="given-name"
              value={leadFirstName}
              onChange={(ev) => setLeadFirstName(ev.target.value)}
              required
            />
          </div>
          <div className="g2g-field g2g-mt">
            <label htmlFor="lead-phone">Phone number</label>
            <input
              id="lead-phone"
              name="phone"
              type="tel"
              autoComplete="tel"
              value={leadPhone}
              onChange={(ev) => setLeadPhone(ev.target.value)}
              required
            />
          </div>
          <div className="g2g-field g2g-mt">
            <label htmlFor="lead-email">Email address</label>
            <input
              id="lead-email"
              name="email"
              type="email"
              autoComplete="email"
              value={leadEmail}
              onChange={(ev) => setLeadEmail(ev.target.value)}
              required
            />
          </div>
          <div className="g2g-field g2g-mt">
            <label htmlFor="lead-zip">ZIP code</label>
            <input
              id="lead-zip"
              name="zip"
              inputMode="numeric"
              autoComplete="postal-code"
              placeholder="30260"
              maxLength={10}
              value={leadZip}
              onChange={(ev) => setLeadZip(ev.target.value)}
              required
            />
            {zipLookupBusy ? (
              <p className="g2g-field-hint" style={{ margin: '0.35rem 0 0' }}>
                Looking up city and state…
              </p>
            ) : null}
            {zipLookupErr ? (
              <p className="g2g-field-hint" style={{ margin: '0.35rem 0 0', color: 'var(--g2g-danger)' }}>
                {zipLookupErr}
              </p>
            ) : null}
          </div>
          <div className="g2g-field g2g-mt">
            <div className="g2g-row">
              <div className="g2g-field" style={{ flex: '2 1 10rem' }}>
                <label htmlFor="lead-city">City</label>
                <input
                  id="lead-city"
                  name="city"
                  autoComplete="address-level2"
                  value={leadCity}
                  readOnly
                  placeholder={zipLookupBusy ? 'Looking up…' : 'Enter ZIP first'}
                />
              </div>
              <div className="g2g-field" style={{ flex: '0 1 7.5rem', minWidth: '7rem' }}>
                <label htmlFor="lead-state">State</label>
                <input
                  id="lead-state"
                  name="state"
                  autoComplete="address-level1"
                  value={leadState}
                  readOnly
                  placeholder="—"
                />
              </div>
            </div>
          </div>
          {contactErr ? <div className="g2g-alert g2g-alert--error g2g-mt">{contactErr}</div> : null}
          <button type="submit" className="g2g-btn g2g-btn--primary g2g-mt" disabled={contactBusy}>
            {contactBusy ? 'Saving…' : 'Continue to estimate'}
          </button>
        </form>
      </>
    );
  }

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

      {result && hasDisplayableOffer(result) ? (
        <div className="g2g-result">
          <h2>Here&apos;s what your car could be worth</h2>
          <OfferPricingDisplay result={result} />
          <button
            type="button"
            className="g2g-btn g2g-btn--primary g2g-mt"
            onClick={() => {
              if (contact) {
                if (!sellName.trim()) setSellName(contact.firstName);
                if (!sellPhone.trim()) setSellPhone(contact.phone);
              }
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
                <label htmlFor="sell-street">Street address</label>
                <input
                  id="sell-street"
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
                    <label htmlFor="sell-city">City</label>
                    <input
                      id="sell-city"
                      name="addressCity"
                      autoComplete="address-level2"
                      placeholder="City"
                      value={sellCity}
                      onChange={(ev) => setSellCity(ev.target.value)}
                      required
                    />
                  </div>
                  <div className="g2g-field" style={{ flex: '0 1 7.5rem', minWidth: '7rem' }}>
                    <label htmlFor="sell-state">State</label>
                    <select
                      id="sell-state"
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
                    <label htmlFor="sell-pickup-zip">ZIP</label>
                    <input
                      id="sell-pickup-zip"
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
