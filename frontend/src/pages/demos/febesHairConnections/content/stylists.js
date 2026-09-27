export const STYLISTS = [
  {
    id: 'febe',
    name: 'Febe A.',
    title: 'Owner & Master Stylist',
    bio: 'Specializes in silk press, custom color, and healthy natural hair.',
    image: 'https://images.unsplash.com/photo-1580618672591-eb180b1a973f?w=400&q=80',
  },
  {
    id: 'jordan',
    name: 'Jordan M.',
    title: 'Braids & Protective Styles',
    bio: 'Known for neat parts, gentle tension, and long-lasting braids.',
    image: 'https://images.unsplash.com/photo-1594744803329-e58b31de8bf1?w=400&q=80',
  },
  {
    id: 'alicia',
    name: 'Alicia R.',
    title: 'Color & Extensions',
    bio: 'Balayage, sew-ins, and extension maintenance with a flawless blend.',
    image: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=400&q=80',
  },
];

export function stylistById(id) {
  return STYLISTS.find((s) => s.id === id) || null;
}
