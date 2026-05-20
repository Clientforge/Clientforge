import { formatOfferRange, formatPointOffer } from '../lib/pricingEngine.js';

export default function OfferPricingDisplay({ result }) {
  const range = formatOfferRange(result);
  const point = formatPointOffer(result);
  if (!range && !point) return null;

  return (
    <div className="g2g-offer-pricing">
      {range ? (
        <div className="g2g-offer-pricing__block">
          <p className="g2g-offer-pricing__label">Estimated range</p>
          <p className="g2g-offer-range g2g-offer-range--band">{range}</p>
        </div>
      ) : null}
      {point ? (
        <div className="g2g-offer-pricing__block g2g-offer-pricing__block--primary">
          <p className="g2g-offer-pricing__label">Your offer</p>
          <p className="g2g-offer-point">{point}</p>
        </div>
      ) : null}
    </div>
  );
}
