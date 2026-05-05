/** Marketing copy for the Grace to Grace demo home (`G2GHome`). */

export const HERO = {
  headline: 'Sell your vehicle with a fast, upfront estimate',
  subhead:
    'Decode your VIN or enter year, make, and model, add condition and ZIP, and see an estimated dollar range in seconds. Final amounts depend on verification — this tool is built for transparency, not hype.',
  primaryCta: 'Get my offer',
  secondaryCta: 'Enter VIN instead',
};

export const TRUST_CHIPS = [
  { label: 'Works for damaged & non-running units' },
  { label: 'Estimate in minutes' },
  { label: 'No obligation to proceed' },
];

export const HOW_IT_WORKS_STEPS = [
  {
    title: 'Tell us about the vehicle',
    body: 'Paste a 17-character VIN (we decode via NHTSA) or type year, make, and model yourself.',
    icon: 'vin',
  },
  {
    title: 'Add condition & ZIP',
    body: 'Pick a condition band and your ZIP so we can anchor the range to your area.',
    icon: 'form',
  },
  {
    title: 'See your estimated range',
    body: 'Our v1 engine applies clear multipliers and floors — you’ll see a low–high range right away.',
    icon: 'range',
  },
  {
    title: 'Ready to move?',
    body: 'Use “Sell now” after your estimate to reach our team with pickup details (SMS consent required).',
    icon: 'sell',
  },
];

export const TRUST_BAND = [
  {
    title: 'Grounded numbers',
    body: 'Class-based scrap floors and condition factors keep estimates from floating too high.',
    icon: 'chart',
  },
  {
    title: 'Title & logistics',
    body: 'Real deals still need title checks, pickup scheduling, and local compliance — we spell that out up front.',
    icon: 'doc',
  },
  {
    title: 'You’re in control',
    body: 'Walk away anytime. The estimate page is there to inform your next step, not pressure it.',
    icon: 'shield',
  },
];

export const REVIEWS = [
  {
    quote:
      'I had a non-runner sitting in the driveway. Got a range fast and knew what ballpark to expect before anyone came out.',
    name: 'James R.',
    meta: 'Metro Atlanta area',
    rating: 5,
  },
  {
    quote:
      'The VIN decode saved me from typing everything wrong. Condition options were plain English.',
    name: 'Maria L.',
    meta: 'Georgia',
    rating: 5,
  },
  {
    quote:
      'Appreciated that it says estimate, not a guaranteed check amount. Felt more honest than other sites.',
    name: 'David T.',
    meta: 'Southeast',
    rating: 5,
  },
];

export const FAQ_ITEMS = [
  {
    q: 'Is this a guaranteed purchase price?',
    a: 'No. You see an estimated range from our demo pricing engine. A binding offer requires verifying the vehicle, title, and pickup details.',
  },
  {
    q: 'Where does VIN information come from?',
    a: 'When you decode a VIN we call the public NHTSA vPIC API so year, make, model, and related fields stay consistent with federal data.',
  },
  {
    q: 'What vehicles do you buy?',
    a: 'The estimator supports many passenger vehicles across condition bands — running, damaged, salvage-style, and more. Edge cases may need a manual review.',
  },
  {
    q: 'What happens if I click “Sell now”?',
    a: 'You submit your name, phone, pickup address, and SMS consent. We notify our buyer team so someone can follow up. Message and data rates may apply where SMS is used.',
  },
];

export const CTA_REPEAT = {
  title: 'See your range in minutes',
  body: 'Start with VIN or manual entry — same flow either way.',
  button: 'Get my offer',
};
