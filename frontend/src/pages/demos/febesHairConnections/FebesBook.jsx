import { useEffect, useMemo, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { BRAND } from './constants';
import { SERVICES, serviceById } from './content/services';
import { STYLISTS, stylistById } from './content/stylists';
import {
  formatDayIso,
  formatDayLabel,
  nextBookableDays,
  slotsForDay,
} from './bookSlots';
import { febesPath } from './febesBase';

const STEPS = ['Service', 'Stylist', 'Date', 'Time', 'Confirm'];

export default function FebesBook() {
  const location = useLocation();
  const preService = location.state?.serviceId;

  const [step, setStep] = useState(0);
  const [serviceId, setServiceId] = useState(preService || '');
  const [stylistId, setStylistId] = useState('');
  const [dayIso, setDayIso] = useState('');
  const [timeSlot, setTimeSlot] = useState('');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [done, setDone] = useState(false);

  const days = useMemo(() => nextBookableDays(), []);
  const selectedDay = days.find((d) => formatDayIso(d) === dayIso);
  const slots = useMemo(
    () => (selectedDay && stylistId ? slotsForDay(selectedDay, stylistId) : []),
    [selectedDay, stylistId],
  );

  useEffect(() => {
    document.title = `Book — ${BRAND}`;
  }, []);

  useEffect(() => {
    if (preService) setServiceId(preService);
  }, [preService]);

  const service = serviceById(serviceId);
  const stylist = stylistById(stylistId);

  const canNext = () => {
    if (step === 0) return Boolean(serviceId);
    if (step === 1) return Boolean(stylistId);
    if (step === 2) return Boolean(dayIso);
    if (step === 3) return Boolean(timeSlot);
    return name.trim().length >= 2 && phone.trim().length >= 10;
  };

  const submit = (e) => {
    e.preventDefault();
    if (!canNext()) return;
    setDone(true);
  };

  if (done) {
    return (
      <div className="febe-section febe-book febe-success">
        <h2>You&apos;re on the books!</h2>
        <p>
          <strong>{service?.name}</strong> with <strong>{stylist?.name}</strong>
          <br />
          {selectedDay ? formatDayLabel(selectedDay) : dayIso} at {timeSlot}
        </p>
        <p className="febe-demo-note" style={{ maxWidth: '28rem', margin: '1.5rem auto' }}>
          This is a demo confirmation — no appointment was sent to the salon. In production, this
          connects to your calendar, deposits, and SMS reminders.
        </p>
        <Link to={febesPath()} className="febe-btn febe-btn--primary">
          Back to home
        </Link>
      </div>
    );
  }

  return (
    <div className="febe-section febe-book">
      <h1 className="febe-page-title">Book online</h1>
      <p className="febe-section-lead">Choose your service, stylist, and time — we&apos;ll hold your spot.</p>

      <div className="febe-steps" aria-hidden>
        {STEPS.map((_, i) => (
          <div key={STEPS[i]} className={`febe-step-dot${i <= step ? ' febe-step-dot--done' : ''}`} />
        ))}
      </div>
      <p style={{ textAlign: 'center', fontWeight: 600, marginBottom: '1.25rem' }}>
        Step {step + 1} of {STEPS.length}: {STEPS[step]}
      </p>

      {step === 0 && (
        <div className="febe-option-grid">
          {SERVICES.map((s) => (
            <button
              key={s.id}
              type="button"
              className={`febe-option${serviceId === s.id ? ' febe-option--selected' : ''}`}
              onClick={() => setServiceId(s.id)}
            >
              <strong>{s.name}</strong>
              <span style={{ display: 'block', fontSize: '0.88rem', color: 'var(--febe-muted)' }}>
                {s.duration} · from ${s.from}
              </span>
            </button>
          ))}
        </div>
      )}

      {step === 1 && (
        <div className="febe-option-grid">
          {STYLISTS.map((st) => (
            <button
              key={st.id}
              type="button"
              className={`febe-option${stylistId === st.id ? ' febe-option--selected' : ''}`}
              onClick={() => setStylistId(st.id)}
            >
              <div className="febe-stylist-row">
                <img src={st.image} alt="" />
                <div>
                  <strong>{st.name}</strong>
                  <span style={{ display: 'block', fontSize: '0.85rem', color: 'var(--febe-muted)' }}>
                    {st.title}
                  </span>
                </div>
              </div>
            </button>
          ))}
        </div>
      )}

      {step === 2 && (
        <div className="febe-option-grid">
          {days.map((d) => {
            const iso = formatDayIso(d);
            return (
              <button
                key={iso}
                type="button"
                className={`febe-option${dayIso === iso ? ' febe-option--selected' : ''}`}
                onClick={() => {
                  setDayIso(iso);
                  setTimeSlot('');
                }}
              >
                {formatDayLabel(d)}
              </button>
            );
          })}
        </div>
      )}

      {step === 3 && (
        <>
          {!slots.length ? (
            <p>Pick a date and stylist first.</p>
          ) : (
            <div className="febe-slot-grid">
              {slots.map((slot) => (
                <button
                  key={slot}
                  type="button"
                  className={`febe-slot${timeSlot === slot ? ' febe-slot--selected' : ''}`}
                  onClick={() => setTimeSlot(slot)}
                >
                  {slot}
                </button>
              ))}
            </div>
          )}
        </>
      )}

      {step === 4 && (
        <form onSubmit={submit}>
          <div className="febe-card" style={{ marginBottom: '1rem' }}>
            <p>
              <strong>{service?.name}</strong> · {stylist?.name}
            </p>
            <p style={{ color: 'var(--febe-muted)' }}>
              {selectedDay ? formatDayLabel(selectedDay) : dayIso} at {timeSlot}
            </p>
          </div>
          <div className="febe-field">
            <label htmlFor="febe-name">Full name</label>
            <input
              id="febe-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              autoComplete="name"
            />
          </div>
          <div className="febe-field">
            <label htmlFor="febe-phone">Mobile phone</label>
            <input
              id="febe-phone"
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              required
              autoComplete="tel"
            />
          </div>
          <div className="febe-field">
            <label htmlFor="febe-email">Email (optional)</label>
            <input
              id="febe-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
            />
          </div>
          <button type="submit" className="febe-btn febe-btn--primary" disabled={!canNext()}>
            Confirm booking
          </button>
        </form>
      )}

      <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1.5rem', flexWrap: 'wrap' }}>
        {step > 0 && (
          <button type="button" className="febe-btn febe-btn--ghost" onClick={() => setStep((s) => s - 1)}>
            Back
          </button>
        )}
        {step < 4 && (
          <button
            type="button"
            className="febe-btn febe-btn--primary"
            disabled={!canNext()}
            onClick={() => setStep((s) => s + 1)}
          >
            Continue
          </button>
        )}
      </div>

      <p className="febe-demo-note">Demo booking — confirmations are simulated for sales showcase.</p>
    </div>
  );
}
