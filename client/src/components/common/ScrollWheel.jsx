/* ═══════════════════════════════════════════════════════════════════════════
   SCROLL WHEEL
   An alloy wheel that turns as the page is scrolled — faster while you are
   scrolling, coasting to an idle crawl when you stop.

   HOW THE SPEED-UP / SLOW-DOWN ACTUALLY WORKS
   Mapping rotation directly to scroll position would make the wheel a dial:
   it would track the scrollbar exactly, stop dead the instant you stopped,
   and jump backwards the moment you scrolled up. A wheel does none of those
   things.

   Two values are summed instead:

     1. A SPRING following scroll position. The spring is deliberately slack
        (low stiffness, high mass), so it lags behind the scroll and then
        overshoots slightly as it catches up. That lag is the whole effect —
        it reads as a heavy wheel being spun up and then coasting, rather than
        as a value being set.

     2. A CONSTANT IDLE DRIFT, integrated per animation frame. Without it the
        wheel freezes completely when the page is still, which looks broken
        rather than restful.

   The rotation is one-directional by design: `Math.abs` on the scroll delta
   means scrolling up spins the wheel the same way as scrolling down. A wheel
   that reverses when you scroll back up draws attention to itself as a
   gimmick; one that just keeps turning reads as motion.

   Purely decorative — aria-hidden, pointer-events:none, and it disappears
   entirely under prefers-reduced-motion, where a large rotating object in
   peripheral vision is exactly the sort of thing that causes trouble.
   ═══════════════════════════════════════════════════════════════════════════ */
import { useRef } from 'react';
import {
  motion, useScroll, useSpring, useTransform, useMotionValue,
  useAnimationFrame, useReducedMotion,
} from 'framer-motion';

/* An alloy wheel: tyre, rim, ten spokes, hub. Drawn once and reused at any
   size — the whole thing is a couple of hundred bytes of markup and scales
   losslessly, which a photograph of a wheel would not. */
function WheelArt() {
  const spokes = Array.from({ length: 10 }, (_, i) => (i / 10) * 360);
  return (
    <svg viewBox="0 0 200 200" aria-hidden="true">
      {/* Tyre */}
      <circle cx="100" cy="100" r="96" fill="none" stroke="currentColor" strokeWidth="15" opacity=".22" />
      {/* Rim lip */}
      <circle cx="100" cy="100" r="84" fill="none" stroke="currentColor" strokeWidth="3" opacity=".5" />
      <circle cx="100" cy="100" r="76" fill="none" stroke="currentColor" strokeWidth="1.5" opacity=".3" />

      {/* Spokes. Rotated copies of one tapered blade rather than ten hand-placed
          paths, so the spacing cannot drift. */}
      <g opacity=".42">
        {spokes.map((deg) => (
          <path
            key={deg}
            d="M100 30 L108 74 L100 84 L92 74 Z"
            fill="currentColor"
            transform={`rotate(${deg} 100 100)`}
          />
        ))}
      </g>

      {/* Lug bolts and hub */}
      <g opacity=".55">
        {Array.from({ length: 5 }, (_, i) => {
          const a = (i / 5) * Math.PI * 2 - Math.PI / 2;
          return (
            <circle key={i}
              cx={100 + Math.cos(a) * 22}
              cy={100 + Math.sin(a) * 22}
              r="4.5" fill="currentColor" />
          );
        })}
      </g>
      <circle cx="100" cy="100" r="13" fill="none" stroke="currentColor" strokeWidth="3" opacity=".6" />
    </svg>
  );
}

export default function ScrollWheel({
  className,
  style,
  /* Degrees turned per pixel scrolled. Larger = more eager. */
  factor = 0.16,
  /* Degrees per second while the page is still. */
  idle = 4,
  /* Lower stiffness = heavier wheel = more coast. */
  stiffness = 40,
}) {
  const reduced = useReducedMotion();
  const { scrollY } = useScroll();

  /* Accumulated one-directional distance. useTransform cannot do this on its
     own because it is a pure mapping of the current value; the running total
     has to be kept in a ref across updates. */
  const travelled = useRef(0);
  const last = useRef(0);
  const distance = useMotionValue(0);

  const spun = useSpring(distance, { stiffness, damping: 22, mass: 1.4 });
  const drift = useMotionValue(0);

  useAnimationFrame((_, delta) => {
    if (reduced) return;

    const y = scrollY.get();
    // Absolute delta: scrolling up turns the wheel the same way as down.
    travelled.current += Math.abs(y - last.current);
    last.current = y;
    distance.set(travelled.current * factor);

    // delta is in ms.
    drift.set(drift.get() + (idle * delta) / 1000);
  });

  const rotate = useTransform([spun, drift], ([a, b]) => a + b);

  // A large rotating object in peripheral vision is precisely what this
  // setting exists to prevent, so it is removed rather than slowed.
  if (reduced) return null;

  return (
    <motion.div
      className={className}
      style={{ ...style, rotate, willChange: 'transform' }}
      aria-hidden="true"
    >
      <WheelArt />
    </motion.div>
  );
}
