export const BRAND = "Febe's Hair Connections";
export const TAGLINE = 'Premium hair care in Morrow — silk press, braids, color & more.';

export const ADDRESS_LINE1 = '1544 Mt Zion Rd #9e';
export const ADDRESS_LINE2 = 'Morrow, GA 30260';
export const ADDRESS_FULL = `${ADDRESS_LINE1}, ${ADDRESS_LINE2}`;

export const PHONE_DISPLAY = '(770) 961-2224';
export const PHONE_TEL = '+17709612224';

export const EMAIL = 'hello@febeshair.demo';

export const HOURS = [
  { days: 'Tuesday – Friday', time: '9:00 AM – 7:00 PM' },
  { days: 'Saturday', time: '8:00 AM – 6:00 PM' },
  { days: 'Sunday – Monday', time: 'Closed' },
];

export const SOCIAL = {
  instagram: 'https://instagram.com/',
  facebook: 'https://facebook.com/',
};

export const MAPS_EMBED =
  'https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3315.8!2d-84.334!3d33.583!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x0%3A0x0!2zMTU0NCBNdCBaaW9uIFJkLCBNb3Jyb3csIEdBIDMwMjYw!5e0!3m2!1sen!2sus!4v1';

export const MAPS_LINK = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(ADDRESS_FULL)}`;

/** Demo imagery (Unsplash — replace with salon photos in production). */
export const IMAGES = {
  hero: 'https://images.unsplash.com/photo-1633681928662-062993784a86?w=1600&q=80',
  about: 'https://images.unsplash.com/photo-1522337360788-8eee635ccc3?w=1200&q=80',
  services: 'https://images.unsplash.com/photo-1562322140-8baeececf3df?w=1200&q=80',
};
