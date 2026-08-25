import { Component } from 'react';

/**
 * A boundary around one non-critical page section.
 *
 * The landing page renders several independent sections, and a render-time
 * throw in any one of them — a malformed catalogue record, a package missing a
 * field a card destructures, a testimonial with no image — took the entire
 * page down with it, because React unmounts the whole tree when nothing
 * catches. The visitor got a blank white screen instead of a site with one
 * section missing.
 *
 * Deliberately narrow:
 *   • It does NOT hide the error. The real error and component stack still go
 *     to the console, exactly as they would have.
 *   • It is for sections whose absence is survivable — the parts strip, the
 *     reviews. It is not wrapped around the hero or the services grid, where
 *     silently rendering nothing would be worse than failing loudly.
 *   • It renders a small, honest notice rather than an empty gap, so a broken
 *     section is visible to whoever is testing rather than looking like a
 *     design decision.
 *
 * Class component because `getDerivedStateFromError` / `componentDidCatch`
 * have no hook equivalent.
 */
export default class SectionBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { failed: false };
  }

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error, info) {
    // Surfaced, not swallowed.
    console.error(
      `[SectionBoundary${this.props.name ? `: ${this.props.name}` : ''}]`,
      error,
      info?.componentStack
    );
  }

  render() {
    if (!this.state.failed) return this.props.children;
    if (this.props.fallback !== undefined) return this.props.fallback;

    return (
      <div
        role="status"
        style={{
          background: '#F8FAFC',
          border: '1px solid #E2E8F0',
          borderRadius: '14px',
          padding: '1.5rem',
          textAlign: 'center',
          color: '#64748B',
          fontSize: '0.85rem',
          fontWeight: 600,
        }}
      >
        This section could not be displayed. Everything else on the page still works.
      </div>
    );
  }
}
