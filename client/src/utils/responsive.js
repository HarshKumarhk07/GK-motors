import { useState, useEffect } from 'react';

/**
 * Viewport breakpoints, in one place so components agree on what "mobile" is.
 * These match the media queries used across the inline <style> blocks.
 */
export const BREAKPOINTS = {
  smallMobile: 375,
  mobile: 768,
  tablet: 1024,
};

const read = () => {
  // Vite renders client-side only, but guard anyway so importing this module
  // can never throw in a non-browser context (a test runner, a prerender step).
  const width = typeof window === 'undefined' ? BREAKPOINTS.tablet : window.innerWidth;
  const height = typeof window === 'undefined' ? 0 : window.innerHeight;
  return {
    width,
    height,
    isSmallMobile: width < BREAKPOINTS.smallMobile,
    isMobile: width < BREAKPOINTS.mobile,
    isTablet: width >= BREAKPOINTS.mobile && width < BREAKPOINTS.tablet,
    isDesktop: width >= BREAKPOINTS.tablet,
  };
};

/**
 * Current viewport size and the derived breakpoint flags.
 *
 *   const { isMobile } = useResponsive();
 *
 * Resize events fire continuously while a window is dragged, so updates are
 * coalesced to one per animation frame and skipped entirely when no flag
 * actually changed — otherwise every component using this re-renders dozens of
 * times a second for a width change that does not affect layout.
 *
 * Prefer a CSS media query where one will do. This hook is for cases CSS
 * cannot express: rendering a different component tree, or changing behaviour
 * rather than appearance.
 */
export const useResponsive = () => {
  const [state, setState] = useState(read);

  useEffect(() => {
    let frame = null;

    const onResize = () => {
      if (frame !== null) return;
      frame = window.requestAnimationFrame(() => {
        frame = null;
        setState((prev) => {
          const next = read();
          const same =
            prev.isMobile === next.isMobile &&
            prev.isTablet === next.isTablet &&
            prev.isDesktop === next.isDesktop &&
            prev.isSmallMobile === next.isSmallMobile &&
            prev.width === next.width;
          return same ? prev : next;
        });
      });
    };

    window.addEventListener('resize', onResize);
    window.addEventListener('orientationchange', onResize);
    onResize();   // catch a viewport that changed between render and effect

    return () => {
      if (frame !== null) window.cancelAnimationFrame(frame);
      window.removeEventListener('resize', onResize);
      window.removeEventListener('orientationchange', onResize);
    };
  }, []);

  return state;
};

/**
 * Value that settles `delay` ms after it stops changing. For search boxes, so
 * a request is not fired on every keystroke.
 *
 *   const query = useDebounce(search, 300);
 *   useEffect(() => { fetchResults(query); }, [query]);
 */
export const useDebounce = (value, delay = 300) => {
  const [settled, setSettled] = useState(value);

  useEffect(() => {
    const t = setTimeout(() => setSettled(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);

  return settled;
};

/**
 * Locks page scroll while `locked` is true — for open drawers and modals, so
 * the page behind does not scroll under the overlay.
 *
 * Restores whatever `overflow` was there before rather than assuming 'auto',
 * and counts nested locks so closing a modal opened over a drawer does not
 * release the drawer's lock.
 */
let lockCount = 0;
let restoreOverflow = '';

export const useScrollLock = (locked) => {
  useEffect(() => {
    if (!locked) return undefined;

    if (lockCount === 0) {
      restoreOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
    }
    lockCount += 1;

    return () => {
      lockCount -= 1;
      if (lockCount === 0) document.body.style.overflow = restoreOverflow;
    };
  }, [locked]);
};
