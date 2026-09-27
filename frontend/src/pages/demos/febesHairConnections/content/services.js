export const SERVICES = [
  {
    id: 'cut',
    name: 'Haircut & Shape',
    desc: 'Consultation, precision cut, and finish for your face shape and lifestyle.',
    duration: '45–60 min',
    from: 45,
  },
  {
    id: 'silk-press',
    name: 'Silk Press',
    desc: 'Smooth, glossy blowout on natural hair with heat protection and lasting movement.',
    duration: '90–120 min',
    from: 85,
  },
  {
    id: 'braids',
    name: 'Braids',
    desc: 'Knotless, box braids, and protective styles — length and size tailored to you.',
    duration: '3–6 hrs',
    from: 180,
  },
  {
    id: 'sew-in',
    name: 'Sew-In Weave',
    desc: 'Secure install with blending and styling for a seamless, natural look.',
    duration: '2–4 hrs',
    from: 200,
  },
  {
    id: 'color',
    name: 'Color & Highlights',
    desc: 'All-over color, balayage, and dimension with bond-safe formulas.',
    duration: '2–4 hrs',
    from: 120,
  },
  {
    id: 'treatment',
    name: 'Treatments',
    desc: 'Deep conditioning, steam therapy, and scalp care to restore moisture and strength.',
    duration: '45–75 min',
    from: 55,
  },
  {
    id: 'extensions',
    name: 'Extensions',
    desc: 'Tape-ins, microlinks, and maintenance for volume and length goals.',
    duration: '2–5 hrs',
    from: 250,
  },
  {
    id: 'locs',
    name: 'Loc Maintenance',
    desc: 'Retwist, style, and scalp care for mature and starter locs.',
    duration: '1.5–3 hrs',
    from: 95,
  },
];

export function serviceById(id) {
  return SERVICES.find((s) => s.id === id) || null;
}
