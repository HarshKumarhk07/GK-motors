/* ═══════════════════════════════════════════════════════════════════════════
   MOTION PRIMITIVES
   The one place scroll- and pointer-driven motion is defined, so every section
   on the page moves with the same easing, distance and timing instead of each
   one inventing its own.

   Two rules hold throughout:

   1. Every primitive honours `prefers-reduced-motion`. When it is set, the
      component renders its children in their FINAL state — not hidden, not
      mid-transition. A visitor who has asked their OS to stop animation still
      sees the whole page; they just see it arrive instantly.

   2. Nothing here animates a property that triggers layout. Only `transform`
      and `opacity` are touched, so a scroll-linked effect stays on the
      compositor and does not force a reflow per frame.
   ═══════════════════════════════════════════════════════════════════════════ */
import { useRef, useEffect, useState } from 'react';
import {
  motion, useScroll, useTransform, useSpring, useInView,
  useMotionValue, useMotionTemplate, useReducedMotion, animate,
} from 'framer-motion';

/* A single easing curve for the whole site. A custom cubic-bezier rather than
   one of the named keywords: the long tail is what makes an element feel like
   it settles rather than stops. */
export const EASE = [0.22, 1, 0.36, 1];

/* ── Reveal ────────────────────────────────────────────────────────────────
   The workhorse. Fades and lifts its children the first time they scroll into
   view, once — `once: true` on the viewport, so scrolling back up does not
   replay the entrance and turn the page into a slideshow.

   `amount: 0.15` fires when 15% of the element is visible. Tall sections would
   otherwise sit fully on screen, still invisible, waiting to cross a 50%
   threshold they only reach after the visitor has already scrolled past. */
export function Reveal({
  children, delay = 0, y = 28, x = 0, duration = 0.7,
  className, style, amount = 0.15,
}) {
  const reduced = useReducedMotion();

  if (reduced) return <div className={className} style={style}>{children}</div>;

  return (
    <motion.div
      className={className}
      style={style}
      initial={{ opacity: 0, y, x }}
      whileInView={{ opacity: 1, y: 0, x: 0 }}
      viewport={{ once: true, amount }}
      transition={{ duration, delay, ease: EASE }}
    >
      {children}
    </motion.div>
  );
}

/* ── Stagger ───────────────────────────────────────────────────────────────
   For grids and lists. The parent owns the timing and the children inherit it
   through variants, so a twelve-card grid needs one `viewport` observer rather
   than twelve, and the cascade cannot drift out of order the way twelve
   independent `delay` props eventually do. */
export function Stagger({ children, className, style, gap = 0.07, delay = 0, amount = 0.1 }) {
  const reduced = useReducedMotion();

  if (reduced) return <div className={className} style={style}>{children}</div>;

  return (
    <motion.div
      className={className}
      style={style}
      initial="hidden"
      whileInView="show"
      viewport={{ once: true, amount }}
      variants={{
        hidden: {},
        show: { transition: { staggerChildren: gap, delayChildren: delay } },
      }}
    >
      {children}
    </motion.div>
  );
}

/* `depth` is the 3D entrance: the card starts tipped back from the viewer and
   flattens as it arrives, so a grid reads as physical cards being dealt onto
   the page rather than boxes fading in.

   `transformPerspective` is set per item rather than as a `perspective` on the
   grid container. A container perspective shares one vanishing point across
   every child, so cards at the edges of a wide grid skew outward and the row
   looks bowed. Per-item perspective gives each card its own vanishing point
   straight ahead of it, which is what keeps a twelve-card grid square. */
export function StaggerItem({ children, className, style, y = 24, depth = 0, ...rest }) {
  const reduced = useReducedMotion();

  if (reduced) return <div className={className} style={style} {...rest}>{children}</div>;

  return (
    <motion.div
      className={className}
      style={depth ? { ...style, transformPerspective: 1000 } : style}
      variants={{
        hidden: { opacity: 0, y, rotateX: depth },
        show: {
          opacity: 1, y: 0, rotateX: 0,
          transition: { duration: depth ? 0.75 : 0.6, ease: EASE },
        },
      }}
      {...rest}
    >
      {children}
    </motion.div>
  );
}

/* ── ScrollRecede ──────────────────────────────────────────────────────────
   Lays an element back and pushes it away as it scrolls off the top of the
   screen — the strongest single "3D scroll" moment on the page, used on the
   hero card so leaving the hero feels like a physical exit rather than the
   content merely sliding up.

   Driven by the element's own crossing of the viewport ("start start" → the
   moment its top hits the top of the screen; "end start" → the moment its
   bottom does), so the effect is tied to where the card actually is rather
   than to an absolute scroll distance that would be wrong at every other
   viewport height.

   `transformOrigin: 'center top'` matters: rotating about the centre would
   swing the card's bottom edge upward into the text below it. Hinging at the
   top edge makes it fall away instead. */
export function ScrollRecede({ children, className, style, rotate = 26, lift = 90, minScale = 0.86 }) {
  const ref = useRef(null);
  const reduced = useReducedMotion();
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ['start start', 'end start'],
  });

  const rotateX = useTransform(scrollYProgress, [0, 1], [0, rotate]);
  const scale = useTransform(scrollYProgress, [0, 1], [1, minScale]);
  const y = useTransform(scrollYProgress, [0, 1], [0, -lift]);
  const opacity = useTransform(scrollYProgress, [0, 0.75, 1], [1, 0.85, 0.4]);

  if (reduced) return <div className={className} style={style}>{children}</div>;

  return (
    <div ref={ref} className={className} style={style}>
      <motion.div
        style={{
          rotateX, scale, y, opacity,
          transformPerspective: 1200,
          transformOrigin: 'center top',
          willChange: 'transform',
        }}
      >
        {children}
      </motion.div>
    </div>
  );
}

/* ── Parallax ──────────────────────────────────────────────────────────────
   Moves its children against the scroll direction as the element crosses the
   viewport. `distance` is half the total travel across the whole crossing;
   keep it small (20–80) — parallax reads as depth up to a point and as a bug
   past it.

   The raw scroll value is run through a spring so a trackpad's jittery deltas
   do not translate into visible stutter. */
export function Parallax({ children, distance = 60, className, style }) {
  const ref = useRef(null);
  const reduced = useReducedMotion();
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ['start end', 'end start'],
  });
  const raw = useTransform(scrollYProgress, [0, 1], [distance, -distance]);
  const y = useSpring(raw, { stiffness: 120, damping: 30, mass: 0.4 });

  if (reduced) return <div className={className} style={style}>{children}</div>;

  return (
    <div ref={ref} className={className} style={style}>
      <motion.div style={{ y }}>{children}</motion.div>
    </div>
  );
}

/* ── ScrollScale ───────────────────────────────────────────────────────────
   The "3D" entrance: an element starts tipped back in Z and flattens as it
   enters. Used sparingly — one or two feature panels — because it is
   expensive-looking by design and stops reading as special if every card
   does it. */
export function ScrollScale({ children, className, style, from = 0.9, rotate = 7 }) {
  const ref = useRef(null);
  const reduced = useReducedMotion();
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ['start 0.95', 'center 0.65'],
  });
  const scale = useTransform(scrollYProgress, [0, 1], [from, 1]);
  const rotateX = useTransform(scrollYProgress, [0, 1], [rotate, 0]);
  const opacity = useTransform(scrollYProgress, [0, 0.6], [0.2, 1]);

  if (reduced) return <div className={className} style={style}>{children}</div>;

  return (
    <div ref={ref} className={className} style={{ ...style, perspective: 1400 }}>
      <motion.div style={{ scale, rotateX, opacity, transformStyle: 'preserve-3d' }}>
        {children}
      </motion.div>
    </div>
  );
}

/* ── Tilt ──────────────────────────────────────────────────────────────────
   Pointer-tracking 3D tilt for cards. The rotation is driven by the pointer's
   position within the card's own box, normalised to -0.5..0.5, so the effect
   is identical whatever the card's size.

   Guarded on a fine pointer: on a touch screen there is no hover, the
   `mousemove` a tap synthesises would leave the card stuck at whatever angle
   the finger last touched, and the whole effect is invisible anyway. Note the
   hooks all run before that guard — a conditional return must not sit above a
   hook call, so the motion values are created unconditionally and simply go
   unused on touch. */
export function Tilt({ children, className, style, max = 8, lift = 1.02, glare = true }) {
  const ref = useRef(null);
  const reduced = useReducedMotion();
  const [fine, setFine] = useState(false);

  const rx = useMotionValue(0);
  const ry = useMotionValue(0);
  const gx = useMotionValue(50);
  const gy = useMotionValue(50);

  const rotateX = useSpring(rx, { stiffness: 260, damping: 22 });
  const rotateY = useSpring(ry, { stiffness: 260, damping: 22 });
  const glareBg = useMotionTemplate`radial-gradient(circle at ${gx}% ${gy}%, rgba(255,255,255,0.5), transparent 55%)`;

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return undefined;
    const mq = window.matchMedia('(hover: hover) and (pointer: fine)');
    const sync = () => setFine(mq.matches);
    sync();
    mq.addEventListener('change', sync);
    return () => mq.removeEventListener('change', sync);
  }, []);

  if (reduced || !fine) {
    return <div className={className} style={style}>{children}</div>;
  }

  const onMove = (e) => {
    const r = ref.current?.getBoundingClientRect();
    if (!r) return;
    const px = (e.clientX - r.left) / r.width;
    const py = (e.clientY - r.top) / r.height;
    ry.set((px - 0.5) * max * 2);
    rx.set(-(py - 0.5) * max * 2);
    gx.set(px * 100);
    gy.set(py * 100);
  };

  const onLeave = () => { rx.set(0); ry.set(0); };

  return (
    <motion.div
      ref={ref}
      className={className}
      onMouseMove={onMove}
      onMouseLeave={onLeave}
      whileHover={{ scale: lift }}
      transition={{ type: 'spring', stiffness: 260, damping: 22 }}
      style={{
        ...style,
        rotateX, rotateY,
        transformStyle: 'preserve-3d',
        transformPerspective: 900,
      }}
    >
      {children}
      {glare && (
        <motion.span
          aria-hidden="true"
          initial={{ opacity: 0 }}
          whileHover={{ opacity: 1 }}
          transition={{ duration: 0.3 }}
          style={{
            position: 'absolute', inset: 0, borderRadius: 'inherit',
            pointerEvents: 'none', mixBlendMode: 'overlay',
            background: glareBg,
          }}
        />
      )}
    </motion.div>
  );
}

/* ── CountUp ───────────────────────────────────────────────────────────────
   Counts a stat up from zero the first time it is seen. Takes the number and
   its decoration separately (`prefix`/`suffix`) rather than parsing a display
   string, so "12+" and "₹2,499" and "4.9" all work without the component
   having to guess which characters are the number.

   Locale-formatted on the way out, so 5000 reads as 5,000 mid-count too. */
export function CountUp({
  to, from = 0, duration = 1.6, decimals = 0,
  prefix = '', suffix = '', className, style,
}) {
  const ref = useRef(null);
  const reduced = useReducedMotion();
  const inView = useInView(ref, { once: true, amount: 0.5 });
  const [val, setVal] = useState(reduced ? to : from);

  useEffect(() => {
    if (!inView || reduced) return undefined;
    const controls = animate(from, to, {
      duration,
      ease: EASE,
      onUpdate: setVal,
    });
    return () => controls.stop();
  }, [inView, reduced, from, to, duration]);

  const shown = decimals > 0
    ? val.toFixed(decimals)
    : Math.round(val).toLocaleString('en-IN');

  return <span ref={ref} className={className} style={style}>{prefix}{shown}{suffix}</span>;
}

/* ── ScrollProgressLine ────────────────────────────────────────────────────
   A rule that fills as its section is scrolled through. Used as the spine of
   the "How it works" timeline so the four steps read as one journey being
   travelled rather than four unrelated boxes.

   scaleY/scaleX against a fixed transform-origin rather than animating height
   or width — same visual, no layout pass per frame. */
export function ScrollProgressLine({ orientation = 'vertical', className, style, color }) {
  const ref = useRef(null);
  const reduced = useReducedMotion();
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ['start 0.85', 'end 0.45'],
  });
  const p = useSpring(scrollYProgress, { stiffness: 90, damping: 24, mass: 0.3 });
  const vertical = orientation === 'vertical';

  return (
    <div ref={ref} className={className} style={{ ...style, overflow: 'hidden' }} aria-hidden="true">
      <motion.span
        style={{
          display: 'block', width: '100%', height: '100%',
          background: color,
          transformOrigin: vertical ? 'top' : 'left',
          ...(reduced
            ? {}
            : vertical ? { scaleY: p } : { scaleX: p }),
        }}
      />
    </div>
  );
}

export { motion, useReducedMotion };
