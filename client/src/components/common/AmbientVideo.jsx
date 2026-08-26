/* ═══════════════════════════════════════════════════════════════════════════
   AMBIENT VIDEO
   A silent, looping video used purely as a background layer.

   A <video autoplay> in the markup starts downloading as soon as it is
   parsed, whatever else the page still needs, and these clips are ~2.6 MB. On
   a phone on mobile data that is the entire page budget spent on decoration
   nobody asked for. So the <video> element is not rendered at all until three
   conditions are met:

     1. The viewport is wide enough that the layer is actually visible. Below
        the breakpoint the poster alone is used — on a small screen a dim,
        blurred backdrop is indistinguishable from a still anyway.
     2. The section is within one screen of the viewport. Scrolling to it is
        what triggers the fetch.
     3. The visitor has not asked their OS to reduce motion.

   The poster image renders in every case, immediately and at full quality, so
   the section is never empty and never shifts: the video fades in over an
   image that already looks finished. If the video never loads — blocked, slow
   connection, unsupported codec — what remains is exactly the design as it
   would have been with a still, which is the point.
   ═══════════════════════════════════════════════════════════════════════════ */
import { useEffect, useRef, useState } from 'react';
import { useReducedMotion } from 'framer-motion';

export default function AmbientVideo({
  src,
  poster,
  className,
  /* Below this width the video is never fetched. */
  minWidth = 1024,
  /* How far ahead of the viewport to start loading. */
  rootMargin = '400px 0px',
}) {
  const hostRef = useRef(null);
  const reduced = useReducedMotion();
  const [show, setShow] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (reduced) return undefined;
    if (typeof window === 'undefined') return undefined;

    const wide = window.matchMedia(`(min-width: ${minWidth}px)`);
    if (!wide.matches) return undefined;

    const el = hostRef.current;
    if (!el || typeof IntersectionObserver === 'undefined') return undefined;

    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          io.disconnect();
          setShow(true);
        }
      },
      { rootMargin }
    );
    io.observe(el);
    return () => io.disconnect();
  }, [reduced, minWidth, rootMargin]);

  return (
    <div ref={hostRef} className={className} aria-hidden="true">
      <img src={poster} alt="" className="gk-av-poster" loading="lazy" decoding="async" />

      {show && (
        <video
          className="gk-av-video"
          // `ready` gates only the fade-in, so the first frame is never shown
          // half-decoded over the poster.
          data-ready={ready}
          src={src}
          poster={poster}
          autoPlay
          muted
          loop
          // Without this iOS refuses to autoplay and opens the clip fullscreen
          // the moment it is tapped.
          playsInline
          preload="auto"
          // Belt and braces: a background layer must never be a control.
          tabIndex={-1}
          onCanPlay={() => setReady(true)}
        />
      )}
    </div>
  );
}
