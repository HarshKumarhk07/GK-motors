/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        /* ── 2026 palette — sampled from the logo ──────────────────────────
           The badge ring's navy and the steering-wheel mark's cyan, plus the
           blue where the two meet. These replace the generic blue-600 accent
           below, which matched the default of every SaaS template on the
           internet and nothing on the actual building.

           src/theme.js and src/styles/gk-system.css carry the same values for
           inline styles and stylesheet rules respectively; all three must move
           together. The legacy names beneath are kept because the admin panel
           and several inner pages still reference them. */
        gk: {
          ink:      '#04101F',
          navy:     '#0A2246',
          navysoft: '#12315F',
          blue:     '#1567D3',
          bluedeep: '#0F4FA8',
          cyan:     '#00B2F0',
          cyansoft: '#6FD8FF',
          surface:  '#F6F9FD',
          hairline: '#DCE7F3',
          body:     '#4A5A70',
          meta:     '#77879C',
          gold:     '#FFB020',
        },

        /* ── Legacy palette ────────────────────────────────────────────────
           blue-600 is the single accent the design system leans on: buttons,
           links, the emphasised word in a section heading, the active nav
           state. The older #1E3A8A navy is kept as `navy` because the admin
           panel and several inner pages still key off it. */
        brand: '#2563EB',        // blue-600 — primary accent
        'brand-dark': '#1D4ED8', // blue-700 — hover / pressed
        navy: '#1E3A8A',         // blue-900 — legacy accent (admin, inner pages)
        ink: '#0F172A',          // slate-900 — dark sections + headings
        'ink-soft': '#1E293B',   // slate-800 — gradient partner for dark sections
        body: '#475569',         // slate-600 — body copy
        meta: '#64748B',         // slate-500 — secondary / meta copy
        hairline: '#E2E8F0',     // slate-200 — card + section borders
        surface: '#F8FAFC',      // slate-50 — light section backgrounds
        chip: '#EBF0FF',         // icon-chip background
        amber: '#F59E0B',        // star ratings
        danger: '#EF4444',       // discount badges
        primary: '#111111',
        secondary: '#E53935',
        accent: '#FFFFFF',
        'dark-card': '#1A1A1A',
        'dark-border': '#2A2A2A',
        muted: '#888888',
        success: '#2E7D32',
        warning: '#FB8C00',
      },
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
        display: ['Space Grotesk', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
