/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        /* ── Redesign palette ──────────────────────────────────────────────
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
