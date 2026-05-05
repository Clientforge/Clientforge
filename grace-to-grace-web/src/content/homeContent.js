/** Marketing copy for the public home page. Edits here flow into HomePage. */

export const HERO = {
  headline: 'Sell your vehicle with a fast, upfront offer',
  subhead:
    'Share a few details about your car and your area — in minutes you’ll see what it could be worth. Final payout depends on a quick verification when you’re ready to move forward.',
  primaryCta: 'Get my offer',
  secondaryCta: 'Enter VIN instead',
  secondaryTo: '/offer?start=vin',
};

export const TRUST_CHIPS = [
  { label: 'Damaged & non-running welcome' },
  { label: 'Get your number in minutes' },
  { label: 'No obligation to sell' },
];

export const HOW_IT_WORKS_STEPS = [
  {
    title: 'Tell us about your vehicle',
    body: 'Tell us a bit about your car — VIN, year, make, and model — so we can tailor your offer.',
    icon: 'vin',
  },
  {
    title: 'Add a few details',
    body: 'Share condition and your ZIP so we can reflect your car and location accurately.',
    icon: 'form',
  },
  {
    title: 'See what your car is worth',
    body: 'You’ll get one clear number you can use to decide your next step with confidence.',
    icon: 'range',
  },
  {
    title: 'Ready to sell?',
    body: 'Tap “Sell now” to send your info to our team with SMS consent — we’ll follow up to coordinate pickup.',
    icon: 'sell',
  },
];

export const TRUST_BAND = [
  {
    title: 'Straightforward pricing',
    body: 'We focus on a simple offer you can understand — not a wall of numbers.',
    icon: 'chart',
  },
  {
    title: 'Real sales need paperwork',
    body: 'When you’re ready, we’ll confirm title and pickup — that’s normal for any sale.',
    icon: 'doc',
  },
  {
    title: 'You’re in control',
    body: 'Walk away anytime. We’re here to make selling easier, not to pressure you.',
    icon: 'shield',
  },
];

export const REVIEWS = [
  {
    quote:
      'I had a non-runner in the driveway. Got a clear number fast and knew what to expect before anyone came out.',
    name: 'James R.',
    meta: 'Metro Atlanta area',
    rating: 5,
  },
  {
    quote:
      'Using my VIN prefilled everything — I didn’t have to guess at trim or spelling.',
    name: 'Maria L.',
    meta: 'Georgia',
    rating: 5,
  },
  {
    quote:
      'Felt honest — one offer, no confusing spread. Easier than other sites I’ve tried.',
    name: 'David T.',
    meta: 'Southeast',
    rating: 5,
  },
];

export const FAQ_ITEMS = [
  {
    q: 'Is this a guaranteed purchase price?',
    a: 'The amount we show is an estimate based on what you tell us. A firm purchase price comes after we verify the vehicle and title.',
  },
  {
    q: 'Why does the site ask for my VIN?',
    a: 'When you enter a VIN, we can often fill in year, make, and model for you so you don’t have to type everything by hand.',
  },
  {
    q: 'What kinds of vehicles do you buy?',
    a: 'Many cars, trucks, and SUVs — running, damaged, or not. Unusual cases may need a quick look from our team.',
  },
  {
    q: 'What happens if I tap “Sell now”?',
    a: 'You share your name, phone, pickup address, and SMS consent. Our team gets notified so someone can reach out. Message and data rates may apply.',
  },
];

export const CTA_REPEAT = {
  title: 'See what your car is worth',
  body: 'VIN or manual entry — whichever is easier for you.',
  button: 'Get my offer',
};
