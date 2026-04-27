import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { TAGLINE } from './constants';

const BASE = '/demo/grace-to-grace';

export default function G2GHome() {
  useEffect(() => {
    document.title = 'Grace to Grace — Vehicle cash offers';
  }, []);

  return (
    <>
      <section className="g2g-hero">
        <h1>{TAGLINE}</h1>
        <p>
          Enter your VIN to pre-fill year, make, and model (matched to our lists), or pick them from the menus, then tell
          us the condition. You&apos;ll
          see an <strong>estimated</strong> offer range in seconds — not a final quote until we verify the vehicle.
        </p>
        <Link to={`${BASE}/offer`} className="g2g-btn g2g-btn--primary">
          Get your estimate
        </Link>
      </section>

      <div className="g2g-grid-3">
        <div className="g2g-card">
          <h3>VIN decode</h3>
          <p>We use the free NHTSA vPIC API to normalize your vehicle details when you provide a valid VIN.</p>
        </div>
        <div className="g2g-card">
          <h3>Condition-based pricing</h3>
          <p>Our v1 engine applies transparent multipliers for running, damaged, non-running, and salvage-type units.</p>
        </div>
        <div className="g2g-card">
          <h3>Scrap floor</h3>
          <p>Estimates respect a minimum scrap-style floor by vehicle class so numbers stay grounded in reality.</p>
        </div>
      </div>

      <p className="g2g-disclaimer g2g-muted-block">
        Grace to Grace demo platform — estimates are for illustration only. Final purchase offers require inspection,
        title verification, and local compliance.
      </p>
    </>
  );
}
