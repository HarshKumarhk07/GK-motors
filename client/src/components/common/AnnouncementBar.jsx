import { Link } from 'react-router-dom';
import { Phone, Headset, ShieldCheck } from 'lucide-react';

/* ═══════════════════════════════════════════════════════════════════════════
   Top announcement strip.

   Sits ABOVE the sticky <Navbar>, not inside it, and is deliberately not
   sticky itself: it carries standing information rather than navigation, so
   it scrolls away and hands the pinned row to the nav bar — which is what
   keeps the sticky bar at one height for the whole page.

   Blue ground, white text. It reads as the accent band above the slate-900
   nav field, so the page opens blue → slate-900 → slate-900 hero with the
   white nav card floating between the last two.

   Below 640px the trust line is dropped and only the two actionable items —
   phone and Support — remain. The strip has no other job on a phone, and a
   wrapped three-item row would cost a second line of vertical space above
   the fold.
   ═══════════════════════════════════════════════════════════════════════════ */

const BAR_STYLES = `
  .gk-annbar {
    background: linear-gradient(90deg, #1E3A8A 0%, #2563EB 100%);
    border-bottom: 1px solid rgba(255, 255, 255, 0.1);
    position: relative;
    z-index: 51;   /* above the sticky nav's own stacking, so its shadow cannot bleed over */
  }
  .gk-annbar-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
    min-height: 36px;
    padding: 0.35rem 0;
  }
  .gk-annbar-trust {
    display: inline-flex;
    align-items: center;
    gap: 0.45rem;
    color: #FFFFFF;
    font-family: 'Space Grotesk', sans-serif;
    font-size: 0.72rem;
    font-weight: 700;
    letter-spacing: 0.09em;
    text-transform: uppercase;
    min-width: 0;
  }
  .gk-annbar-trust span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .gk-annbar-right {
    display: flex;
    align-items: center;
    gap: 1.15rem;
    flex-shrink: 0;
  }
  .gk-annbar-link {
    display: inline-flex;
    align-items: center;
    gap: 0.4rem;
    color: rgba(255, 255, 255, 0.94);
    text-decoration: none;
    font-size: 0.74rem;
    font-weight: 600;
    white-space: nowrap;
    transition: color 0.2s;
  }
  .gk-annbar-link:hover { color: #FFFFFF; }
  .gk-annbar-link svg { color: rgba(255, 255, 255, 0.8); flex-shrink: 0; }
  .gk-annbar-sep {
    width: 1px; height: 14px;
    background: rgba(255, 255, 255, 0.28);
    flex-shrink: 0;
  }

  @media (max-width: 640px) {
    /* Actionable items only — see the note above the component. */
    .gk-annbar-trust { display: none; }
    .gk-annbar-row { justify-content: center; gap: 0.9rem; min-height: 32px; }
    .gk-annbar-right { gap: 0.9rem; }
    .gk-annbar-link { font-size: 0.7rem; }
  }
`;

export default function AnnouncementBar() {
  return (
    <div className="gk-annbar">
      <style>{BAR_STYLES}</style>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="gk-annbar-row">
          <p className="gk-annbar-trust">
            <ShieldCheck size={14} style={{ color: 'rgba(255,255,255,0.85)', flexShrink: 0 }} />
            <span>India&rsquo;s Most Trusted Car Care Service</span>
          </p>

          <div className="gk-annbar-right">
            <a href="tel:+919253625099" className="gk-annbar-link">
              <Phone size={13} /> +91 9253625099
            </a>
            <span className="gk-annbar-sep" aria-hidden="true" />
            <Link to="/contact" className="gk-annbar-link">
              <Headset size={13} /> Support
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
