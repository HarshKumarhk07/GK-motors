/* ═══════════════════════════════════════════════════════════════════════════
   AMBIENT VIDEO
   A silent, looping video used purely as a background layer.

   A <video autoplay> in the markup starts downloading as soon as it is
   parsed, whatever else the page still needs, and these clips are ~2.6 MB. On
   a phone on mobile data that is the entire page budget spent on decoration
   nobody asked for. So the <video> element is not rendered at all until three
   conditions are met:

     1. The viewport is wide enough that the layer is actually visible, and
        the connection is not metered or slow — Data Saver and 2g both opt
        out, since 2.6 MB of decoration is not a reasonable thing to spend
        somebody's data allowance on.
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
  /* Below this width the video is never fetched.
     0 by default — there is no width at which this should be withheld.

     It has been wrong twice. First 1024, which excluded every phone and
     tablet. Then 420, chosen as "deliberately low", which still blocked a
     Galaxy S21 (360), an iPhone SE (375), an iPhone 14 (390) and a Pixel 7
     (412) — in portrait, essentially every phone except a Pro Max. Both times
     the symptom was identical and looked like a broken video rather than a
     deliberate gate, which is exactly why an arbitrary pixel threshold was
     the wrong instrument.

     What actually needs guarding is the CONNECTION, not the screen, and that
     is handled below by saveData and effectiveType. Someone on a 360px phone
     over wifi should get the video; someone on a 1440px laptop tethered to a
     2g hotspot should not. */
  minWidth = 0,
  /* How far ahead of the viewport to start loading. */
  rootMargin = '400px 0px',
}) {
  const hostRef = useRef(null);
  const videoRef = useRef(null);
  const reduced = useReducedMotion();
  const [show, setShow] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (reduced) return undefined;
    if (typeof window === 'undefined') return undefined;

    if (minWidth > 0 && !window.matchMedia(`(min-width: ${minWidth}px)`).matches) {
      return undefined;
    }

    /* Now that phones are included, the connection has to be checked rather
       than assumed. The Network Information API is Chromium-only, which is
       fine — it is used to OPT OUT, so browsers without it keep the previous
       behaviour rather than losing anything.

       Two signals:
         • saveData: the visitor has explicitly turned on Data Saver. Loading
           2.6 MB of decoration over that is ignoring a direct instruction.
         • effectiveType: on 2g or slow-2g the clip would still be arriving
           long after they had scrolled past, while competing for bandwidth
           with things they actually asked for. */
    const conn = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
    if (conn) {
      if (conn.saveData) return undefined;
      if (/(^|-)2g$/.test(conn.effectiveType || '')) return undefined;
    }

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

  /* ── Why autoplay needed help ───────────────────────────────────────────
     The clip played on desktop and silently did nothing on phones.

     React sets `muted` as a DOM PROPERTY but does not reliably emit the
     `muted` ATTRIBUTE on the element. Desktop browsers are happy either way;
     mobile Safari and Chrome check for a muted video before allowing
     unprompted playback, and several versions consult the attribute. With it
     missing the element is treated as an audible autoplay attempt, silently
     blocked, and left showing its poster — which is exactly what it looked
     like, because the poster is our fallback design.

     So the property is set imperatively the moment the element exists, and
     play() is called explicitly rather than left to the `autoPlay` attribute.
     play() returns a promise that REJECTS when the browser refuses; that
     rejection is unhandled by default and shows up as a console error, so it
     is caught. A refusal is not a failure here — the poster is a complete
     design on its own. */
  useEffect(() => {
    const v = videoRef.current;
    if (!v || !show) return undefined;

    v.muted = true;
    v.defaultMuted = true;
    v.setAttribute('muted', '');

    /* If the element already has a frame by the time this runs, no further
       `canplay` is coming — the event fired before React attached its
       handler. Checking readyState directly is the only way to catch that,
       and missing it is what left the layer permanently at opacity 0 with a
       perfectly healthy video playing invisibly underneath. */
    if (v.readyState >= 2) setReady(true);

    let cancelled = false;
    let retry = null;

    const start = () => {
      const attempt = v.play();
      if (attempt && typeof attempt.then === 'function') {
        attempt
          .then(() => { if (!cancelled) setReady(true); })
          .catch(() => {
            /* Refused. iOS in Low Power Mode blocks autoplay outright however
               muted the clip is, and re-permits it after any user gesture. So
               one retry is armed on the first touch or scroll and then thrown
               away — passive and once:true, so it can never sit on the scroll
               path. If that is refused too, the poster stands, which is a
               finished design in its own right. */
            if (cancelled || retry) return;
            retry = () => { v.play().then(() => setReady(true)).catch(() => {}); };
            const opts = { once: true, passive: true };
            window.addEventListener('touchstart', retry, opts);
            window.addEventListener('scroll', retry, opts);
          });
      }
    };

    start();

    return () => {
      cancelled = true;
      if (retry) {
        window.removeEventListener('touchstart', retry);
        window.removeEventListener('scroll', retry);
      }
    };
  }, [show]);

  return (
    <div ref={hostRef} className={className} aria-hidden="true">
      <img src={poster} alt="" className="gk-av-poster" loading="lazy" decoding="async" />

      {show && (
        <video
          ref={videoRef}
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
          /* Three triggers, not one. `canplay` alone was the single point of
             failure: if it fired before React attached the handler, nothing
             ever set `ready`, the layer stayed at opacity 0, and the video
             played invisibly behind the poster — which looks exactly like a
             video that will not play. `loadeddata` fires as soon as the first
             frame exists and `playing` when playback actually starts, so
             between them one always lands. */
          onLoadedData={() => setReady(true)}
          onCanPlay={() => setReady(true)}
          onPlaying={() => setReady(true)}
        />
      )}
    </div>
  );
}
