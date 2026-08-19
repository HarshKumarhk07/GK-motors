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
  const box = {
    width: size, height: size, borderRadius: '50%',
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
          style={{ width: '78%', height: '78%', objectFit: 'contain', display: 'block' }}
        />
      </div>
    );
  }

  return (
    <div style={box}>
      {Icon ? <Icon size={iconSize} style={{ color: '#1E3A8A' }} /> : null}
    </div>
  );
}

/**
 * The category image is stored on the ServiceType documents in that category
 * (every package in a category shares the same artwork), so the first package
 * carrying an image defines it.
 */
export function categoryImageFrom(packages = []) {
  const withImage = packages.find((p) => p && p.image);
  return withImage ? withImage.image : null;
}
