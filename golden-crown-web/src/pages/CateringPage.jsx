import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { IconArrowRight, IconCalendar, IconLeaf, IconTruck, IconUsers } from '../icons.jsx';

export default function CateringPage() {
  useEffect(() => {
    document.title = 'Catering — Golden Crown Kitchen';
  }, []);

  return (
    <main className="gck-page">
      <header className="gck-page-header">
        <p className="gck-eyebrow">Catering</p>
        <h1>Feed your event — without the stress</h1>
        <p className="gck-page-lead">
          Office lunches, celebrations, church functions, and family gatherings. We build trays and menus around your
          headcount, budget, spice level, and dietary notes — so you can focus on your guests.
        </p>
      </header>

      <div className="gck-catering-card gck-catering-card--page">
        <p className="gck-catering-intro">
          Tell us your <strong>date</strong>, <strong>approximate guest count</strong>, and any must-have dishes.
          We&apos;ll follow up with options, portions, and pickup timing from our Morrow kitchen.
        </p>
        <ul className="gck-catering-points">
          <li>
            <IconUsers />
            <span>
              <strong>Flexible headcount</strong> — from small teams (10–15) to full spreads for 50+ guests
            </span>
          </li>
          <li>
            <IconLeaf />
            <span>
              <strong>Signature dishes</strong> — jollof, egusi, proteins, sides, and vegetarian-friendly options
              when requested
            </span>
          </li>
          <li>
            <IconCalendar />
            <span>
              <strong>Lead time</strong> — ideally 48–72 hours notice; rush requests considered when capacity allows
            </span>
          </li>
          <li>
            <IconTruck />
            <span>
              <strong>Pickup in Morrow</strong> — scheduled handoff; ask about delivery partners or drop-off when you
              inquire
            </span>
          </li>
        </ul>
        <div className="gck-catering-detail">
          <h2 className="gck-catering-subhead">What to include in your message</h2>
          <ul className="gck-catering-checklist">
            <li>Event type (office, wedding weekend, church, birthday, etc.)</li>
            <li>Preferred date &amp; pickup window</li>
            <li>Approximate guest count and budget range</li>
            <li>Spice level and any allergies or dietary needs</li>
          </ul>
        </div>
        <Link to="/contact" className="gck-btn-primary gck-btn-primary--wide gck-btn-primary--link">
          Request catering info
          <IconArrowRight />
        </Link>
      </div>
    </main>
  );
}
