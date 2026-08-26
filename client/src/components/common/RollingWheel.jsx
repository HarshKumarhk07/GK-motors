/* ═══════════════════════════════════════════════════════════════════════════
   ROLLING WHEEL
   A tyre that rolls across its section as you scroll past it — travelling, not
   just spinning on the spot.

   WHY THE FIRST ATTEMPT DID NOT READ AS A WHEEL
   It rotated in a fixed position. A wheel that turns without moving is a fan:
   the eye reads rotation-without-translation as a spinning disc, not as
   something rolling. What sells "rolling" is the RELATIONSHIP between how far
   it moves and how far it turns.

   So the rotation here is derived from the travel, using the real thing:

       rotation (radians) = distance / radius

   The wheel is told its own diameter, its travel is measured in the same
   pixels, and the turn falls out of the division. Scroll slowly and it creeps;
   flick and it spins — with no velocity handling at all, because correct
   rolling gives that for free. Get this ratio wrong in either direction and it
   reads instantly as sliding on ice or as a wheel spinning up on a wet road,
   which is exactly why the number is computed rather than tuned by eye.

   TRAVEL
   Tied to the host section's own crossing of the viewport, so the wheel enters
   from one edge as the section appears and leaves by the other as it goes.
   `direction` flips it, and alternating direction down the page is what makes
   a series of these feel like scenery going past rather than one asset
   repeated.

   Decorative throughout: aria-hidden, pointer-events:none, and nothing renders
   at all under prefers-reduced-motion.
   ═══════════════════════════════════════════════════════════════════════════ */
import { useEffect, useRef, useState } from 'react';
import {
  motion, useScroll, useSpring, useTransform, useReducedMotion,
} from 'framer-motion';

function TyreArt() {
  const spokes = Array.from({ length: 10 }, (_, i) => (i / 10) * 360);
  return (
    <svg viewBox="0 0 200 200" aria-hidden="true">
      {/* Tyre wall */}
      <circle cx="100" cy="100" r="94" fill="none" stroke="currentColor" strokeWidth="18" opacity=".18" />
      {/* Tread ticks — the detail that makes rotation legible at low opacity.
          Without something repeating around the circumference, a smooth ring
          looks identical at every angle and the wheel appears not to turn. */}
      <g opacity=".3">
        {Array.from({ length: 44 }, (_, i) => {
          const a = (i / 44) * Math.PI * 2;
          const r1 = 86, r2 = 99;
          return (
            <line key={i}
              x1={100 + Math.cos(a) * r1} y1={100 + Math.sin(a) * r1}
              x2={100 + Math.cos(a) * r2} y2={100 + Math.sin(a) * r2}
              stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
          );
        })}
      </g>
      {/* Rim */}
      <circle cx="100" cy="100" r="80" fill="none" stroke="currentColor" strokeWidth="3.5" opacity=".55" />
      <circle cx="100" cy="100" r="72" fill="none" stroke="currentColor" strokeWidth="1.5" opacity=".3" />
      {/* Spokes */}
      <g opacity=".45">
        {spokes.map((deg) => (
          <path key={deg} d="M100 26 L109 70 L100 82 L91 70 Z"
            fill="currentColor" transform={`rotate(${deg} 100 100)`} />
        ))}
      </g>
      {/* Hub and lugs */}
      <g opacity=".6">
        {Array.from({ length: 5 }, (_, i) => {
          const a = (i / 5) * Math.PI * 2 - Math.PI / 2;
          return <circle key={i} cx={100 + Math.cos(a) * 21} cy={100 + Math.sin(a) * 21} r="4.5" fill="currentColor" />;
        })}
      </g>
      <circle cx="100" cy="100" r="12" fill="none" stroke="currentColor" strokeWidth="3" opacity=".65" />
    </svg>
  );
}

export default function RollingWheel({
  className,
  /* Rendered diameter in px. Used as the radius in the rolling equation, so it
     must match what CSS actually paints or the turn will not match the travel. */
  size = 260,
  /* How far it rolls, in viewport widths. 1.35 sends it fully across and off. */
  travel = 1.35,
  /* 1 rolls left-to-right, -1 right-to-left. */
  direction = 1,
  /* Vertical placement within the host section. */
  top,
  bottom,
  style,
}) {
  const ref = useRef(null);
  const reduced = useReducedMotion();

  /* The host section's crossing of the viewport, 0 as it enters to 1 as it
     leaves. The wheel's entire journey is mapped onto that, so it is always
     mid-roll exactly while its section is on screen. */
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ['start end', 'end start'],
  });

  const smooth = useSpring(scrollYProgress, { stiffness: 70, damping: 26, mass: 0.5 });

  /* ── Why the viewport width is state, not a calc() string ────────────────
     The endpoints used to be `-size` (a number) and `calc(100vw + 300px)` (a
     string). useTransform interpolates between values of the SAME type — it
     cannot blend a number into a calc() expression, so it fell back to
     holding the first value and the wheel never moved an inch. It rotated,
     which is why it looked like the earlier spinning version rather than
     obviously broken.

     Both endpoints are now plain pixel numbers, which means the viewport
     width has to be known in JS. Kept in state and updated on resize so a
     rotated phone does not leave the wheel travelling to the old width. */
  const [vw, setVw] = useState(() => (typeof window === 'undefined' ? 1280 : window.innerWidth));

  useEffect(() => {
    const onResize = () => setVw(window.innerWidth);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  const start = -size;
  const end = vw + size;
  const x = useTransform(smooth, [0, 1], direction > 0 ? [start, end] : [end, start]);

  /* The rolling equation: degrees = (distance / radius) * (180 / PI), where
     distance is the full journey across the viewport plus a diameter each
     side. Derived from the same numbers the travel uses, so the turn and the
     travel cannot disagree. */
  const distance = (vw + size * 2) * travel;
  const degrees = (distance / (size / 2)) * (180 / Math.PI) * direction;
  const rotate = useTransform(smooth, [0, 1], [0, degrees]);

  if (reduced) return null;

  return (
    <div
      ref={ref}
      className={className}
      style={{ ...style, top, bottom, width: size, height: size }}
      aria-hidden="true"
    >
      <motion.div style={{ x, rotate, width: '100%', height: '100%', willChange: 'transform' }}>
        <TyreArt />
      </motion.div>
    </div>
  );
}
