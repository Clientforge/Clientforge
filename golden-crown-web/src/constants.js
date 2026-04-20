export const CLOVER_DEFAULT_ORDER_URL =
  'https://www.clover.com/online-ordering/goldencrown-kitchen-morrow';
export const CLOVER_ORDER_URL =
  import.meta.env.VITE_GCK_CLOVER_ORDER_URL || CLOVER_DEFAULT_ORDER_URL;

/** Formspree / Getform — POST URL. If unset, contact form uses mailto. */
export const CONTACT_FORM_URL = import.meta.env.VITE_CONTACT_FORM_URL || '';
export const CONTACT_EMAIL =
  import.meta.env.VITE_CONTACT_EMAIL || 'info@goldencrownkitchen.com';

export const HERO_BG = '/hero-golden-crown.png';

export const FEATURED_DISH = {
  name: 'Jollof Rice + Chicken',
  desc: 'Smoky party jollof with tender grilled chicken — our #1 seller.',
  img: '/dish-jollof-chicken.jpg',
};

export const OTHER_DISHES = [
  {
    name: 'Egusi + Pounded Yam',
    desc: 'Rich melon-seed soup with smooth pounded yam.',
    img: '/dish-egusi-pounded-yam.webp',
  },
  {
    name: 'Asun Meat',
    desc: 'Spicy roasted goat with peppers and onions — smoky, tender, and bold.',
    img: '/dish-asun-meat.webp',
  },
  {
    name: 'Meat Pie',
    desc: 'Buttery pastry filled with seasoned beef.',
    img: '/dish-meat-pie.jpg',
  },
];

export const REVIEWS = [
  {
    initials: 'AK',
    name: 'Ashley KernerChristian',
    quote:
      'Rice was perfectly cooked everything is really good I wish it was just a little bit spicier. I ordered the egusi jollof rice and bitter leaf. Since I’ve been pregnant I’ve been craving African food and this is the first place I’ve tried since moving to Georgia and I’ll definitely be back.',
    stars: '\u2605\u2605\u2605\u2605\u2605',
  },
  {
    initials: 'ET',
    name: 'Eyram Tawia',
    quote:
      'Ayo!!! If you’re looking for really good amazing authentic freshly made Nigerian dishes this is the spot!!!!! I’ve found another legit African food spot my boi !! 😂😂, and it slick is fighting for the number one spot. Definitely top 2.',
    stars: '\u2605\u2605\u2605\u2605\u2605',
  },
  {
    initials: 'MW',
    name: 'Melodie W',
    quote: 'very delicious, come here once a week for the spinach and fish dish',
    stars: '\u2605\u2605\u2605\u2605\u2605',
  },
];
