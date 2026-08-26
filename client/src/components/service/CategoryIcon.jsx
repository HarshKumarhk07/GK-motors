import { useState, useEffect } from 'react';

/**
 * Icon for a service category, resolved in order of preference:
 *
 *   1. `image`  — artwork the admin uploaded for this category
 *   2. `/service-icons/<slug>.svg` — the illustration shipped in public/
 *   3. the lucide `icon` component — last resort if both fail to load
 *
 * Each step falls through on a load error, so a broken upload or a missing
 * file degrades quietly instead of leaving an empty card.
 */
export default function CategoryIcon({ slug, image, icon: Icon, size = 40, iconSize = 18, tone = 'navy' }) {
  const sources = [image, slug ? `/service-icons/${slug}.svg` : null].filter(Boolean);
  const [attempt, setAttempt] = useState(0);

  // A new upload should re-enter the chain at the top.
  useEffect(() => { setAttempt(0); }, [image, slug]);

  const src = sources[attempt];
  /* A rounded SQUARE, not a circle — the redesign's icon chip. The radius is
     derived from the box rather than fixed, so the 44px compact chip and the
     64px featured chip keep the same corner *character* instead of the larger
     one reading as sharper. Floored at 10px so a small chip never flattens
     into a plain square. */
  const box = {
    width: size, height: size,
    borderRadius: `${Math.max(10, Math.round(size * 0.26))}px`,
    background: tone === 'plain' ? 'transparent' : '#EBF0FF',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    flexShrink: 0, overflow: 'hidden',
  };

  if (src) {
    return (
      <div style={box}>
        <img
          src={src}
          alt=""
          onError={() => setAttempt((a) => a + 1)}
          style={{
            width: src.includes('.svg') ? '78%' : '100%',
            height: src.includes('.svg') ? '78%' : '100%',
            objectFit: src.includes('.svg') ? 'contain' : 'cover',
            display: 'block',
          }}
        />
      </div>
    );
  }

  return (
    <div style={box}>
      {Icon ? <Icon size={iconSize} style={{ color: '#1567D3' }} /> : null}
    </div>
  );
}
