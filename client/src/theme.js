/* ═══════════════════════════════════════════════════════════════════════════
   GK MOTORS — DESIGN TOKENS
   Every colour below is sampled from the logo rather than picked to taste, so
   the site and the sign above the workshop are demonstrably the same brand:

     • the deep navy of the badge ring and the "GK MOTORS" wordmark  → navy
     • the bright cyan of the steering-wheel mark                    → cyan
     • the blue between them, where the wheel meets the ring         → blue

   The previous palette was a generic Tailwind blue-600, which is the default
   accent of roughly every SaaS template on the internet and matched nothing on
   the building. The navy→cyan pairing is what makes this page recognisable at
   a glance, so it is used as a *gradient* on anything that carries the brand
   (primary buttons, the hero, section eyebrows) and as flat navy on anything
   that carries text.

   Import these rather than typing hex literals. The CSS custom properties in
   index.css mirror them one-for-one for use inside <style> blocks and
   stylesheet rules; this module is for inline styles and computed values.
   ═══════════════════════════════════════════════════════════════════════════ */

export const C = {
  /* ── Brand core ──────────────────────────────────────────────────────── */
  ink: '#04101F',        // deepest — page-dark backdrop, behind everything
  navy: '#0A2246',       // logo ring navy — dark surfaces, headings on light
  navySoft: '#12315F',   // the lighter navy the ring fades to — gradient partner
  blue: '#1567D3',       // primary action blue
  blueDeep: '#0F4FA8',   // pressed / hover state for the above
  cyan: '#00B2F0',       // steering-wheel cyan — the accent that does the work
  cyanSoft: '#6FD8FF',   // cyan on dark backgrounds, where full cyan vibrates

  /* ── Neutrals ────────────────────────────────────────────────────────── */
  white: '#FFFFFF',
  surface: '#F6F9FD',    // light section background — faintly cool, not grey
  surfaceAlt: '#EDF3FA', // the second light tone, for banding two sections
  hairline: '#DCE7F3',   // borders on light
  hairlineDark: 'rgba(255,255,255,0.10)', // borders on dark
  body: '#4A5A70',       // body copy on light
  meta: '#77879C',       // secondary / captions on light
  bodyDark: '#9FB3CC',   // body copy on dark
  metaDark: '#6E85A3',   // secondary on dark

  /* ── Status ──────────────────────────────────────────────────────────── */
  gold: '#FFB020',       // star ratings — warm against all that blue
  green: '#15A66B',      // in-stock, confirmed
  red: '#E5484D',        // discounts, errors
};

/* Gradients are tokens too. Written once here because a gradient typed by hand
   in twelve places drifts by a few degrees and a hex digit each time, and the
   drift is exactly what makes a page look assembled rather than designed. */
export const G = {
  brand: `linear-gradient(135deg, ${C.blue} 0%, ${C.cyan} 100%)`,
  brandSoft: `linear-gradient(135deg, ${C.blueDeep} 0%, ${C.blue} 55%, ${C.cyan} 100%)`,
  dark: `linear-gradient(165deg, ${C.ink} 0%, ${C.navy} 55%, #0B2851 100%)`,
  darkFlat: `linear-gradient(180deg, ${C.navy} 0%, ${C.ink} 100%)`,
  /* Text fill for the emphasised word in a heading. Needs
     -webkit-background-clip:text + transparent fill to show; see .gk-grad-text
     in index.css, which is the supported way to apply it. */
  text: `linear-gradient(100deg, ${C.blue} 0%, ${C.cyan} 60%, ${C.cyanSoft} 100%)`,
};

/* Shadows carry the brand hue rather than neutral black. A blue-tinted shadow
   under a blue button reads as the button glowing; a black one reads as dirt. */
export const S = {
  card: '0 2px 4px rgba(10, 34, 70, 0.04), 0 12px 32px rgba(10, 34, 70, 0.07)',
  cardHover: '0 4px 8px rgba(10, 34, 70, 0.06), 0 24px 56px rgba(10, 34, 70, 0.14)',
  brand: `0 8px 24px rgba(21, 103, 211, 0.34)`,
  brandStrong: `0 12px 34px rgba(21, 103, 211, 0.46)`,
  onDark: '0 20px 60px rgba(0, 0, 0, 0.45)',
};

/* Type. Space Grotesk for anything structural (headings, numbers, buttons,
   nav) and Inter for prose — already loaded in index.css. */
export const F = {
  display: "'Space Grotesk', system-ui, sans-serif",
  sans: "'Inter', system-ui, sans-serif",
};

/* One radius scale, so cards, chips and buttons stay in the same family. */
export const R = {
  chip: '10px',
  btn: '12px',
  card: '18px',
  panel: '24px',
  slab: '32px',
};

/* ── Business facts ────────────────────────────────────────────────────────
   The single source of truth for the details that appear in the nav, the
   footer, the hero, the contact section and the booking flow. These were
   previously typed out in nine different files, which is how the site ended up
   advertising Gurgaon and Mumbai offices that do not exist.

   PHONE is the number on the Google Business listing — the one a customer who
   finds GK Motors through Maps will already have seen. `tel:` gets the full
   +91 form; the display string is the human one. */
export const BIZ = {
  name: 'GK Motors',
  tagline: 'Sale · Spare · Service',
  phoneDisplay: '093559 99664',
  phoneTel: '+919355999664',
  whatsapp: '919355999664',
  email: 'kp@avanienterprises.in',
  addressLine1: 'Sheela Bypass, near New Railway Crossing',
  addressLine2: 'Jasbir Colony, Sector-5, Rohtak, Haryana 124001',
  addressShort: 'Sheela Bypass, Sector-5, Rohtak',
  city: 'Rohtak',
  mapsUrl: 'https://share.google/HFpvRFVP9rCKgdaNv',
  /* ⚠ CONFIRM THESE. Taken from what the Contact page already claimed rather
     than invented — but nobody has checked them against the actual shutters,
     and they should match the Google listing exactly, because that is where
     most people will read them. */
  hours: 'Mon – Sat · 9:00 AM – 8:00 PM',
  hoursSunday: 'Sunday · 10:00 AM – 4:00 PM',
  hoursShort: 'Mon–Sat, 9 AM – 8 PM',
};
