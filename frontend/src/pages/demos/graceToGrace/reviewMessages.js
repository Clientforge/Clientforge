export const G2G_REVIEW_MESSAGES = [
  'Your vehicle may require a quick review. Our team will follow up with a custom offer.',
  'Thanks! We have your vehicle details. Our team will review them and get back to you with a custom offer.',
  'We\u2019re reviewing your vehicle information. One of our team members will follow up shortly with an offer.',
  'Your vehicle details have been received! Our team will take a quick look and reach out with your personalized offer.',
  'Almost there! We just need to review your vehicle details before providing your offer. Our team will be in touch soon.',
  'Thanks for sharing your vehicle information. Our team will review it and contact you with an offer.',
  'We\u2019ve got your vehicle details! A member of our team will review everything and follow up with your custom offer.',
  'Your vehicle is being reviewed. Our team will reach out shortly with an offer based on the information provided.',
  'Great! We have everything we need for now. Our team will review your vehicle and follow up with your offer.',
  'Thank you! Your vehicle requires a quick review before we finalize an offer. Our team will contact you shortly.',
];

/** Pick a random message on each estimate submit. */
export function pickRandomReviewMessage() {
  const i = Math.floor(Math.random() * G2G_REVIEW_MESSAGES.length);
  return G2G_REVIEW_MESSAGES[i];
}
