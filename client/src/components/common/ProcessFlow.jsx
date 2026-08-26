/* ═══════════════════════════════════════════════════════════════════════════
   PROCESS FLOW
   The four booking steps as a line that draws itself as you scroll, rather
   than as four cards in a row.

   WHY NOT CARDS
   Four bordered boxes side by side say "here are four things". A line running
   through four nodes says "here is one journey with four stops on it", which
   is what the section actually means. It also removes four card borders, four
   shadows and four hover states from a page that already has plenty.

   HOW THE LINE DRAWS
   The track is a dashed rule in the hairline colour. Over it sits an identical
   dashed rule in the brand gradient, revealed left-to-right by an animated
   `clip-path: inset(...)` tied to the section's scroll progress.

   clip-path rather than scaleX or an animated width, for two specific reasons:
     • scaleX would stretch the dashes as it grew, so the dash pattern would
       visibly lengthen instead of more dashes appearing.
     • width is a layout property and would force a reflow every frame.
   Clipping composites, and the dashes stay exactly the size they were drawn.

   Each node then lights as the line reaches it, driven off the same scroll
   progress so the timing cannot drift out of step with the line.

   On phones the whole thing rotates: the rule runs vertically down the left
   and the steps stack beside it. Four steps across a 360px screen would be
   four columns of two-word lines, and this is the one section where the
   two-up treatment used elsewhere genuinely does not work.
   ═══════════════════════════════════════════════════════════════════════════ */
import { useRef } from 'react';
import {
  motion, useScroll, useSpring, useTransform, useMotionTemplate, useReducedMotion,
} from 'framer-motion';

/* A single stop. Split into its own component so each one can own the hooks
   that derive its state from the shared progress value — hooks cannot be
   called inside the parent's map. */
function FlowNode({ step, index, count, progress, reduced }) {
  const { icon: Icon, n, title, desc } = step;

  /* Where along the line this node sits, 0..1. The last node is deliberately
     reached slightly before the line finishes so it does not light up only
     once the section has already scrolled past. */
  const at = count > 1 ? (index / (count - 1)) * 0.92 : 0;

  /* All four derived values are created before the `reduced` early return
     below. A hook called after a conditional return runs in a different order
     on the next render, which is the one rule React genuinely cannot recover
     from — and `bodyOpacity` was originally written inline in the JSX, which
     put it after that return. */
  const lit = useTransform(progress, [at - 0.06, at + 0.02], [0, 1]);
  const scale = useTransform(lit, [0, 1], [0.86, 1]);
  const glow = useTransform(lit, [0, 1], [0, 1]);
  const bodyOpacity = useTransform(lit, [0, 1], [0.45, 1]);

  const content = (
    <>
      <span className="gk-flow-num">{n}</span>
      <h3 className="gk-flow-title">{title}</h3>
      <p className="gk-flow-desc">{desc}</p>
    </>
  );

  if (reduced) {
    return (
      <li className="gk-flow-step">
        <span className="gk-flow-dot gk-flow-dot--on"><Icon size={19} /></span>
        <div className="gk-flow-body">{content}</div>
      </li>
    );
  }

  return (
    <li className="gk-flow-step">
      <motion.span className="gk-flow-dot" style={{ scale }}>
        {/* Two stacked layers: a resting ring and the filled brand state that
            fades in over it. Cross-fading beats swapping a class because the
            transition is continuous with scroll rather than a step change. */}
        <motion.span className="gk-flow-dot-fill" style={{ opacity: glow }} />
        <Icon size={19} />
      </motion.span>
      <motion.div className="gk-flow-body" style={{ opacity: bodyOpacity }}>
        {content}
      </motion.div>
    </li>
  );
}

export default function ProcessFlow({ steps }) {
  const ref = useRef(null);
  const reduced = useReducedMotion();

  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ['start 0.82', 'end 0.62'],
  });
  // Springing the raw progress stops a trackpad's jitter turning into a
  // flickering line, and gives the draw a little momentum past each node.
  const progress = useSpring(scrollYProgress, { stiffness: 80, damping: 26, mass: 0.4 });

  const hidePct = useTransform(progress, [0, 1], [100, 0]);
  const clip = useMotionTemplate`inset(0 ${hidePct}% 0 0)`;
  const clipV = useMotionTemplate`inset(0 0 ${hidePct}% 0)`;

  return (
    <div className="gk-flow" ref={ref}>
      <style>{FLOW_STYLES}</style>

      {/* The rule. Decorative — the ordered numbers on each step carry the
          sequence for anyone who cannot see it. */}
      <div className="gk-flow-rail" aria-hidden="true">
        <span className="gk-flow-track" />
        {!reduced && (
          <>
            <motion.span className="gk-flow-fill gk-flow-fill--h" style={{ clipPath: clip }} />
            <motion.span className="gk-flow-fill gk-flow-fill--v" style={{ clipPath: clipV }} />
          </>
        )}
      </div>

      <ol className="gk-flow-steps">
        {steps.map((step, i) => (
          <FlowNode
            key={step.n}
            step={step}
            index={i}
            count={steps.length}
            progress={progress}
            reduced={reduced}
          />
        ))}
      </ol>
    </div>
  );
}

const FLOW_STYLES = `
  .gk-flow { position: relative; }

  /* ── The rule ───────────────────────────────────────────────────────────
     Sits behind the steps, aligned with the centre of the dot row. */
  .gk-flow-rail {
    position: absolute; z-index: 0;
    left: 8%; right: 8%; top: 27px; height: 3px;
    pointer-events: none;
  }
  .gk-flow-track, .gk-flow-fill {
    position: absolute; inset: 0;
    /* The dashes. A repeating-linear-gradient rather than a border-style so
       the dash and gap can be sized independently and so it can carry a
       gradient of its own. */
    background-image: repeating-linear-gradient(
      90deg,
      currentColor 0 14px,
      transparent 14px 24px
    );
  }
  .gk-flow-track { color: var(--gk-hairline); }
  .gk-flow-fill {
    /* Painted as a brand-gradient bar, then punched into dashes by the mask so
       the colour runs continuously across the whole rule instead of restarting
       inside every dash. */
    background-image: none;
    background: var(--gk-g-brand);
    -webkit-mask-image: repeating-linear-gradient(90deg, #000 0 14px, transparent 14px 24px);
            mask-image: repeating-linear-gradient(90deg, #000 0 14px, transparent 14px 24px);
    filter: drop-shadow(0 2px 8px rgba(21,103,211,.45));
  }
  .gk-flow-fill--v { display: none; }

  /* ── Steps ─────────────────────────────────────────────────────────────── */
  .gk-flow-steps {
    position: relative; z-index: 1;
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: clamp(1rem, 2vw, 1.75rem);
    list-style: none; margin: 0; padding: 0;
  }
  .gk-flow-step {
    display: flex; flex-direction: column; align-items: center;
    text-align: center; min-width: 0;
  }

  .gk-flow-dot {
    position: relative;
    width: 58px; height: 58px; border-radius: 50%;
    display: inline-flex; align-items: center; justify-content: center;
    flex-shrink: 0;
    background: #FFFFFF;
    border: 2px solid var(--gk-hairline);
    color: var(--gk-blue);
    /* Opaque and slightly larger than the rule, so the line appears to run
       behind the node rather than through it. */
    box-shadow: 0 0 0 6px #FFFFFF;
  }
  .gk-flow-dot svg { position: relative; z-index: 1; }
  .gk-flow-dot-fill {
    position: absolute; inset: -2px;
    border-radius: 50%;
    background: var(--gk-g-brand);
    box-shadow: var(--gk-sh-brand);
  }
  /* Once lit, the icon has the gradient behind it and must invert. Driven off
     the same opacity value, so it can never disagree with the fill. */
  .gk-flow-dot-fill ~ svg { color: #FFFFFF; }
  .gk-flow-dot--on { background: var(--gk-g-brand); border-color: transparent; color: #FFFFFF; }

  .gk-flow-body { margin-top: 1.1rem; }
  .gk-flow-num {
    display: block;
    font-family: var(--gk-font-display);
    font-size: 0.7rem; font-weight: 700; letter-spacing: .2em;
    color: var(--gk-blue); margin-bottom: 0.45rem;
  }
  .gk-flow-title {
    font-family: var(--gk-font-display);
    font-size: clamp(0.98rem, 1.5vw, 1.12rem); font-weight: 700;
    letter-spacing: -.015em; color: var(--gk-navy); margin: 0;
  }
  .gk-flow-desc {
    font-size: 0.82rem; line-height: 1.6; color: var(--gk-body);
    margin: 0.5rem auto 0; max-width: 22rem;
  }

  /* ── Vertical below 760px ───────────────────────────────────────────────
     Four stops across a phone would be four columns of two-word lines. The
     rule swings to the left edge and the steps stack against it, which is
     also how a journey reads more naturally on a tall screen. */
  @media (max-width: 760px) {
    .gk-flow-rail {
      left: 28px; right: auto; top: 30px; bottom: 30px;
      width: 3px; height: auto;
    }
    .gk-flow-track {
      background-image: repeating-linear-gradient(
        180deg, currentColor 0 12px, transparent 12px 22px
      );
    }
    .gk-flow-fill--h { display: none; }
    .gk-flow-fill--v {
      display: block;
      -webkit-mask-image: repeating-linear-gradient(180deg, #000 0 12px, transparent 12px 22px);
              mask-image: repeating-linear-gradient(180deg, #000 0 12px, transparent 12px 22px);
    }

    .gk-flow-steps { grid-template-columns: minmax(0, 1fr); gap: 1.5rem; }
    .gk-flow-step {
      flex-direction: row; align-items: flex-start; text-align: left;
      gap: 1rem;
    }
    .gk-flow-dot { width: 46px; height: 46px; box-shadow: 0 0 0 5px #FFFFFF; }
    .gk-flow-dot svg { width: 17px; height: 17px; }
    .gk-flow-body { margin-top: 0.15rem; }
    .gk-flow-desc { font-size: 0.78rem; margin-left: 0; }
  }
`;
