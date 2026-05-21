import { formatOfferRange } from '../lib/displayOffer.js';

export default function OfferPricingDisplay({ result }) {
  const range = formatOfferRange(result);
  if (!range) return null;

  return (
    <div className="g2g-offer-pricing">
      <div className="g2g-offer-pricing__block">
        <p className="g2g-offer-pricing__label">Estimated range</p>
        <p className="g2g-offer-range">{range}</p>
      </div>
    </div>
  );
}
