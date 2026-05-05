export const BRAND = 'Grace to Grace';
export const TAGLINE = 'Instant estimated offers for junk, damaged & scrap vehicles.';

export const CONTACT_EMAIL =
  import.meta.env.VITE_CONTACT_EMAIL || 'gracetogracetowing@gmail.com';

/** E.164 for tel: links (no spaces). Override in env if the number changes. */
export const CONTACT_PHONE_E164 =
  import.meta.env.VITE_CONTACT_PHONE_E164 || '+14704492307';

/** Human-readable phone for display */
export const CONTACT_PHONE_DISPLAY =
  import.meta.env.VITE_CONTACT_PHONE_DISPLAY || '(470) 449-2307';

export const CONTACT_SERVICE_AREA =
  import.meta.env.VITE_CONTACT_SERVICE_AREA || 'Serving Atlanta area';

export const CONTACT_STREET =
  import.meta.env.VITE_CONTACT_STREET || '2070 Banks Way';

export const CONTACT_CITY_LINE =
  import.meta.env.VITE_CONTACT_CITY_LINE || 'Atlanta, GA 30349';

/** Full single-line address for maps links */
export const CONTACT_MAPS_QUERY =
  import.meta.env.VITE_CONTACT_MAPS_QUERY ||
  '2070 Banks Way, Atlanta, GA 30349';

/** Optional full URL (no trailing slash) if API is on another host */
export const VIN_DECODE_BASE = import.meta.env.VITE_VIN_DECODE_BASE || '';
