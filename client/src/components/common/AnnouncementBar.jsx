/* ═══════════════════════════════════════════════════════════════════════════
   Top announcement strip.

   Sits ABOVE the sticky <Navbar>, not inside it, and is deliberately not
   sticky itself: it carries standing information rather than navigation, so it
   scrolls away and hands the pinned row to the nav bar — which is what keeps
   the sticky bar at one height for the whole page.

   The claim on the left used to read "India's Most Trusted Car Care Service",
   inherited from the national-chain template this project started out as. That
   is not a claim GK Motors can make or wants to make: the whole argument of
   this site is that it is a specific workshop on a specific road in Rohtak
   that you can drive to. The strip now says exactly that, and links to the
   listing so it can be checked.

   Below 640px the location line is dropped and only the two actionable items —
   phone and Support — remain. The strip has no other job on a phone, and a
   wrapped three-item row would cost a second line of vertical space above the
   fold.
   ═══════════════════════════════════════════════════════════════════════════ */
import { Link } from 'react-router-dom';
import { Phone, Headset, MapPin } from 'lucide-react';
import { BIZ } from '../../theme';

const BAR_STYLES = `
  .gk-annbar {
    background: linear-gradient(90deg, var(--gk-blue-deep) 0%, var(--gk-blue) 52%, var(--gk-cyan) 100%);
    position: relative;
    z-index: 51;   /* above the sticky nav, so its shadow cannot bleed over */
  }
  .gk-annbar-row {
    display: flex; align-items: center; justify-content: space-between;
    gap: 1rem; min-height: 36px; padding: 0.35rem 0;
  }
  .gk-annbar-where {
    display: inline-flex; align-items: center; gap: 0.45rem;
    color: #FFFFFF; text-decoration: none;
    font-family: var(--gk-font-display);
    font-size: 0.72rem; font-weight: 700;
    letter-spacing: 0.09em; text-transform: uppercase;
    min-width: 0;
    transition: opacity .2s;
  }
  .gk-annbar-where:hover { opacity: .82; }
  .gk-annbar-where span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .gk-annbar-where svg { flex-shrink: 0; opacity: .85; }

  .gk-annbar-right { display: flex; align-items: center; gap: 1.15rem; flex-shrink: 0; }
  .gk-annbar-link {
    display: inline-flex; align-items: center; gap: 0.4rem;
    color: rgba(255, 255, 255, .94); text-decoration: none;
    font-size: 0.74rem; font-weight: 600; white-space: nowrap;
    transition: color .2s;
  }
  .gk-annbar-link:hover { color: #FFFFFF; }
  .gk-annbar-link svg { color: rgba(255, 255, 255, .82); flex-shrink: 0; }
  .gk-annbar-sep {
    width: 1px; height: 14px; background: rgba(255, 255, 255, .3); flex-shrink: 0;
  }

  @media (max-width: 640px) {
    /* Actionable items only — see the note above the component. */
    .gk-annbar-where { display: none; }
    .gk-annbar-row { justify-content: center; gap: 0.9rem; min-height: 32px; }
    .gk-annbar-right { gap: 0.9rem; }
    .gk-annbar-link { font-size: 0.7rem; }
  }
`;

export default function AnnouncementBar() {
  return (
    <div className="gk-annbar">
      <style>{BAR_STYLES}</style>
      <div className="gk-wrap">
        <div className="gk-annbar-row">
          <a href={BIZ.mapsUrl} target="_blank" rel="noreferrer noopener" className="gk-annbar-where">
            <MapPin size={13} />
            <span>Sheela Bypass, Rohtak · Open {BIZ.hoursShort}</span>
          </a>

          <div className="gk-annbar-right">
            <a href={`tel:${BIZ.phoneTel}`} className="gk-annbar-link">
              <Phone size={13} /> {BIZ.phoneDisplay}
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
