import { useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { computeOfferRange, CONDITION_OPTIONS } from '../lib/pricingEngine.js';
import { formatOfferRange, getDisplayRangeLoHi } from '../lib/displayOffer.js';
import G2gPhotoUploadPanel from '../components/G2gPhotoUploadPanel.jsx';
import { decodeVin, isValidVinFormat, normalizeVin } from '../lib/vinDecode.js';
import { postGraceSellIntent } from '../lib/sellIntentApi.js';
import { getOrCreateG2gSessionId, postGraceEstimateSnapshot } from '../lib/estimateSnapshotApi.js';
import { loadG2gContact, saveG2gContact } from '../lib/g2gContactStorage.js';
import { postG2gLeadStart, postG2gNotifyEstimate } from '../lib/g2gLeadApi.js';
import { lookupUsZipCityState } from '../lib/zipLookup.js';
import { pickReviewMessage } from '../lib/reviewMessages.js';

export default function OfferPage() {
  const vinInputRef = useRef(null);
  const leadGateRef = useRef(null);
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
  const [showLeadGate, setShowLeadGate] = useState(false);

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

  const [sellConsent, setSellConsent] = useState(false);
  const [sellBusy, setSellBusy] = useState(false);
  const [sellErr, setSellErr] = useState('');
  const [sellOk, setSellOk] = useState(false);
  const [photosSubmitted, setPhotosSubmitted] = useState(false);

  const conditionLabel =
    CONDITION_OPTIONS.find((o) => o.id === conditionId)?.label || conditionId;

  const validateVehicleForEstimate = () => {
    if (!year.trim() || !make.trim() || !model.trim()) {
      return { error: 'Year, make, and model are required (use VIN decode or enter manually).' };
    }
    if (!zip.trim() || zip.replace(/\D/g, '').length < 5) {
      return { error: 'Enter a 5-digit ZIP code.' };
    }
    return {};
  };

  const runEstimate = (contactSnapshot) => {
    const validation = validateVehicleForEstimate();
    if (validation.error) {
      setFormError(validation.error);
      return;
    }
    const activeContact = contactSnapshot ?? contact;
    setFormError('');
    setSellOk(false);
    setSellConsent(false);
    setPhotosSubmitted(false);

    const range = computeOfferRange({
      year: year.trim(),
      bodyClass,
      conditionId,
      zip: zip.trim(),
      mileage: mileage.trim(),
    });
    setResult(range);
    setShowLeadGate(false);

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

    if (activeContact) {
      const displayRange = formatOfferRange(range);
      const rangeLoHi = getDisplayRangeLoHi(range);
      postG2gNotifyEstimate({
        firstName: activeContact.firstName,
        phone: activeContact.phone,
        email: activeContact.email,
        zip: zipClean,
        city: activeContact.city,
        state: activeContact.state,
        leadId: activeContact.leadId,
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

  const handleContactSubmit = async (e) => {
    e?.preventDefault();
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
      runEstimate(saved);
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
    setResult(null);
    setSellOk(false);
    setSellConsent(false);
    setPhotosSubmitted(false);

    const validation = validateVehicleForEstimate();
    if (validation.error) {
      setFormError(validation.error);
      return;
    }
    setFormError('');

    if (!contact) {
      const zipClean = zip.trim().replace(/\D/g, '').slice(0, 5);
      if (zipClean.length === 5) {
        setLeadZip(zipClean);
      }
      setShowLeadGate(true);
      requestAnimationFrame(() => {
        leadGateRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      });
      return;
    }

    runEstimate();
  };

  const submitTeamContact = async () => {
    setSellErr('');
    setSellOk(false);
    if (!result || !contact) return;
    if (!contact.firstName?.trim() || contact.firstName.trim().length < 2) {
      setSellErr('Contact info is missing. Please complete the form above.');
      return;
    }
    if (!contact.phone?.trim()) {
      setSellErr('Contact info is missing. Please complete the form above.');
      return;
    }
    if (!sellConsent) {
      setSellErr('Please confirm consent to receive SMS from Grace to Grace.');
      return;
    }
    const zipClean =
      zip.trim().replace(/\D/g, '').slice(0, 5) || contact.zip?.replace(/\D/g, '').slice(0, 5) || '';
    if (zipClean.length !== 5) {
      setSellErr('ZIP code is required.');
      return;
    }
    const city = contact.city?.trim() || '';
    const state = contact.state?.trim() || '';
    const addressLine = city && state ? `${city}, ${state} ${zipClean}` : zipClean;
    const rangeLoHi = getDisplayRangeLoHi(result);

    setSellBusy(true);
    try {
      await postGraceSellIntent({
        customerName: contact.firstName.trim(),
        phone: contact.phone.trim(),
        email: contact.email,
        leadId: contact.leadId,
        address: addressLine,
        smsConsent: true,
        year: year.trim(),
        make: make.trim(),
        model: model.trim(),
        zip: zipClean,
        vin: normalizeVin(vin) || undefined,
        mileage: mileage.trim() || undefined,
        conditionLabel,
        estimateLow: rangeLoHi?.lo ?? result.low ?? undefined,
        estimateHigh: rangeLoHi?.hi ?? result.high ?? undefined,
        manualReviewRequired: Boolean(result?.meta?.noEstimate),
        pickupNotes: 'Customer chose Sell My Car Now without photos — confirm pickup address on follow-up.',
      });
      setSellOk(true);
    } catch (err) {
      setSellErr(err.message || 'Something went wrong.');
    } finally {
      setSellBusy(false);
    }
  };

  const reviewMessage = useMemo(
    () => (result ? pickReviewMessage(getOrCreateG2gSessionId()) : ''),
    [result],
  );

  const buildVehicleSnapshot = () => ({
    year: year.trim(),
    make: make.trim(),
    model: model.trim(),
    zip: zip.trim().replace(/\D/g, '').slice(0, 5),
    vin: normalizeVin(vin) || undefined,
    mileage: mileage.trim() || undefined,
    conditionLabel,
  });

  const buildEstimateSnapshot = () => ({
    low: result?.low ?? null,
    high: result?.high ?? null,
    display: formatOfferRange(result) || undefined,
  });

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

        {showLeadGate && !result ? (
          <div ref={leadGateRef} className="g2g-lead-gate g2g-mt">
            <h2 className="g2g-flow-block-title" style={{ marginTop: 0 }}>
              Almost done — see your estimate
            </h2>
            <p className="g2g-page-lead" style={{ marginBottom: '1rem' }}>
              Enter your contact info and we&apos;ll show your vehicle&apos;s estimated value.
            </p>
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
                name="leadZip"
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
            <button type="button" className="g2g-btn g2g-btn--primary g2g-mt" disabled={contactBusy} onClick={handleContactSubmit}>
              {contactBusy ? 'Calculating…' : 'Show my estimate'}
            </button>
          </div>
        ) : null}

        {formError ? <div className="g2g-alert g2g-alert--error">{formError}</div> : null}

        {!showLeadGate ? (
          <button type="submit" className="g2g-btn g2g-btn--primary">
            See what your car is worth
          </button>
        ) : null}
      </form>

      {result ? (
        <div className="g2g-result">
          <h2>We&apos;re ready to help with your vehicle</h2>
          <div className="g2g-alert g2g-alert--info g2g-mt" role="status">
            <p className="g2g-no-estimate-copy">{reviewMessage}</p>
          </div>
          <div className="g2g-exact-offer-step">
            <h3 className="g2g-exact-offer-step__title">Upload your vehicle photos (optional)</h3>
            <p className="g2g-exact-offer-step__hint">
              Photos help us confirm the vehicle condition and speed up your custom offer.
            </p>
          </div>
          {contact ? (
            sellOk ? (
              <div className="g2g-alert g2g-alert--success g2g-mt" role="status">
                Thanks — our team will contact you directly to continue the process.
              </div>
            ) : (
              <div className="g2g-post-estimate-actions g2g-mt">
                <G2gPhotoUploadPanel
                  contact={contact}
                  vehicle={buildVehicleSnapshot()}
                  estimatePayload={buildEstimateSnapshot()}
                  onSuccess={() => setPhotosSubmitted(true)}
                />
                {!photosSubmitted ? (
                  <div className="g2g-sell-now-skip">
                    <p className="g2g-sell-now-skip__hint">Prefer to skip photos?</p>
                    <div className="g2g-field">
                      <div className="g2g-consent-wrap">
                        <input
                          id="g2g-sell-now-consent"
                          type="checkbox"
                          checked={sellConsent}
                          onChange={(ev) => setSellConsent(ev.target.checked)}
                        />
                        <label htmlFor="g2g-sell-now-consent" className="g2g-consent-text">
                          I agree to receive SMS messages from Grace to Grace about selling my vehicle. Message and
                          data rates may apply. Reply STOP to opt out.
                        </label>
                      </div>
                    </div>
                    {sellErr ? <div className="g2g-alert g2g-alert--error g2g-mt">{sellErr}</div> : null}
                    <button
                      type="button"
                      className="g2g-btn g2g-btn--ghost g2g-mt"
                      disabled={sellBusy}
                      onClick={submitTeamContact}
                    >
                      {sellBusy ? 'Sending…' : 'Sell My Car Now'}
                    </button>
                  </div>
                ) : null}
              </div>
            )
          ) : null}
        </div>
      ) : null}
    </>
  );
}
