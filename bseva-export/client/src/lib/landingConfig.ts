/**
 * Public landing page configuration.
 *
 * Everything here is optional content that must NEVER be faked:
 *  - store links render only when a real URL is configured,
 *  - testimonials render only when real, approved quotes are supplied.
 *
 * Set store links at build time with VITE_APP_STORE_URL / VITE_PLAY_STORE_URL.
 */

function envUrl(value: unknown): string {
  const v = typeof value === "string" ? value.trim() : "";
  return /^https?:\/\//i.test(v) ? v : "";
}

export const APP_STORE_URL = envUrl(import.meta.env.VITE_APP_STORE_URL);
export const PLAY_STORE_URL = envUrl(import.meta.env.VITE_PLAY_STORE_URL);
export const HAS_STORE_LINKS = Boolean(APP_STORE_URL || PLAY_STORE_URL);

export type LandingTestimonial = {
  id: string;
  quote: string;
  name: string;
  location: string;
  /** 1–5 */
  rating: number;
  avatarUrl?: string;
};

/**
 * Approved devotee testimonials. Intentionally empty: the platform has no public
 * reviews source yet, so the section stays hidden until real content is added here
 * (or wired to an approved-reviews endpoint).
 */
export const LANDING_TESTIMONIALS: LandingTestimonial[] = [];

/**
 * Development-only sample cards so the carousel can be QA'd (`/?previewTestimonials=1`).
 * Never rendered in production builds.
 */
export const PREVIEW_TESTIMONIALS: LandingTestimonial[] = [
  { id: "p1", name: "Sample Name A", location: "Sample City", rating: 5, quote: "[Development placeholder] Replace with an approved devotee testimonial." },
  { id: "p2", name: "Sample Name B", location: "Sample City", rating: 5, quote: "[Development placeholder] This card only appears with ?previewTestimonials=1 in development." },
  { id: "p3", name: "Sample Name C", location: "Sample City", rating: 4, quote: "[Development placeholder] Real testimonials will be supplied by the B-Seva team." },
  { id: "p4", name: "Sample Name D", location: "Sample City", rating: 5, quote: "[Development placeholder] Used to verify spacing, swipe and arrow controls." },
];

/** Category slug → optimised card image under /images/landing/cards. */
export const CATEGORY_CARD_IMAGES: Record<string, string> = {
  all: "/images/landing/cards/all.jpg",
  popular: "/images/landing/cards/popular.jpg",
  "home-property": "/images/landing/cards/home-property.jpg",
  "homam-havan": "/images/landing/cards/homam-havan.jpg",
  festivals: "/images/landing/cards/festivals.jpg",
  "lakshmi-wealth": "/images/landing/cards/lakshmi-wealth.jpg",
  marriage: "/images/landing/cards/marriage.jpg",
  ganapathi: "/images/landing/cards/ganapathi.jpg",
  shiva: "/images/landing/cards/shiva.jpg",
};

/** Order in which live service categories are promoted on the landing page. */
export const CATEGORY_PREFERENCE = [
  "home-property",
  "homam-havan",
  "festivals",
  "lakshmi-wealth",
  "marriage",
  "ganapathi",
  "shiva",
] as const;
