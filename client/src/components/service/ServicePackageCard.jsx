import { useState, useId } from 'react';
import { Check, Plus, Clock, ShieldCheck, RefreshCw, Truck, ChevronDown, Wrench } from 'lucide-react';

/**
 * One bookable service package.
 *
 * Presentation only. It knows nothing about specific packages — no "Basic
 * Service" anywhere — and it does not price anything: the caller resolves the
 * amount through getServicePrice() and hands the number down. Every optional
 * field renders only when the backend actually has a value, so a package with
 * no warranty shows no warranty row rather than a blank or a zero.
 */

const VISIBLE_FEATURES = 6;

const inr = (n) => `₹${Number(n).toLocaleString('en-IN')}`;

const PICKUP_LABEL = {
  free: 'Free pickup & drop',
  paid: 'Pickup & drop available',
  unavailable: 'Drop at service centre',
};

const TIER_LABEL = {
  basic: 'Basic',
  standard: 'Standard',
  comprehensive: 'Comprehensive',
};

/** "1,000 km or 3 months", omitting whichever half is unset. */
const joinSpec = (km, months, kmSuffix = 'km') => {
  const parts = [];
  if (Number.isFinite(km) && km > 0) parts.push(`${Number(km).toLocaleString('en-IN')} ${kmSuffix}`);
  if (Number.isFinite(months) && months > 0) parts.push(`${months} month${months === 1 ? '' : 's'}`);
  return parts.join(' or ');
};

export default function ServicePackageCard({
  pkg,
  price,              // resolved by the caller; null = price on request
  inCart = false,
  onAdd,
}) {
  const [expanded, setExpanded] = useState(false);
  const featuresId = useId();

  const unavailable = price === null || price === undefined;
  const features = Array.isArray(pkg.features) ? pkg.features.filter(Boolean) : [];
  const shown = expanded ? features : features.slice(0, VISIBLE_FEATURES);
  const hiddenCount = features.length - shown.length;

  const tierLabel = TIER_LABEL[pkg.tier] || '';
  const warranty = joinSpec(pkg.warranty?.distanceKm, pkg.warranty?.months);
  const interval = joinSpec(pkg.recommendedIntervalKm, pkg.recommendedIntervalMonths);
  const pickup = PICKUP_LABEL[pkg.pickupDrop] || '';

  // Only a genuine markdown counts. A stale originalPrice below the charged
  // price would otherwise render a negative "saving".
  const original = Number(pkg.originalPrice);
  const hasDiscount = !unavailable && Number.isFinite(original) && original > price;
  const saving = hasDiscount ? original - price : 0;

  const metaRows = [
    pkg.durationHours > 0 && { icon: Clock, label: `${pkg.durationHours} hrs taken` },
    warranty && { icon: ShieldCheck, label: `${warranty} warranty` },
    interval && { icon: RefreshCw, label: `Every ${interval}` },
    pickup && { icon: Truck, label: pickup },
  ].filter(Boolean);

  return (
    <article className={`gk-pkg${inCart ? ' gk-pkg--in' : ''}${unavailable ? ' gk-pkg--off' : ''}`}>
      {pkg.isRecommended && <span className="gk-pkg-flag">Recommended</span>}

      <div className="gk-pkg-body">
        {/* ── Image ── */}
        <div className="gk-pkg-media">
          {pkg.image ? (
            <img
              src={pkg.image}
              alt={pkg.label}
              loading="lazy"
              onError={(e) => { e.currentTarget.style.display = 'none'; }}
            />
          ) : (
            <div className="gk-pkg-media-empty" aria-hidden="true"><Wrench size={26} /></div>
          )}
        </div>

        {/* ── Detail ── */}
        <div className="gk-pkg-main">
          <div className="gk-pkg-head">
            <h3 className="gk-pkg-title">{pkg.label}</h3>
            {tierLabel && <span className="gk-pkg-tier">{tierLabel}</span>}
          </div>

          {pkg.desc && <p className="gk-pkg-desc">{pkg.desc}</p>}

          {metaRows.length > 0 && (
            <ul className="gk-pkg-meta">
              {metaRows.map(({ icon: Icon, label }) => (
                <li key={label}><Icon size={13} aria-hidden="true" />{label}</li>
              ))}
            </ul>
          )}

          {features.length > 0 && (
            <>
              <ul className="gk-pkg-feats" id={featuresId}>
                {shown.map((f) => (
                  <li key={f}>
                    <Check size={13} aria-hidden="true" />
                    <span>{f}</span>
                  </li>
                ))}
              </ul>

              {(hiddenCount > 0 || expanded) && (
                <button
                  type="button"
                  className="gk-pkg-more"
                  onClick={() => setExpanded((v) => !v)}
                  aria-expanded={expanded}
                  aria-controls={featuresId}
                >
                  {expanded ? 'Show less' : `+ ${hiddenCount} more · View all`}
                  <ChevronDown size={13} style={{ transform: expanded ? 'rotate(180deg)' : 'none', transition: 'transform .2s' }} />
                </button>
              )}
            </>
          )}
        </div>
      </div>

      {/* ── Price + CTA ── */}
      <div className="gk-pkg-foot">
        <div className="gk-pkg-price">
          {unavailable ? (
            <span className="gk-pkg-onreq">Price on request</span>
          ) : (
            <>
              {hasDiscount && <span className="gk-pkg-was">{inr(original)}</span>}
              <span className="gk-pkg-now">{inr(price)}</span>
              {hasDiscount && <span className="gk-pkg-save">Save {inr(saving)}</span>}
            </>
          )}
        </div>

        <button
          type="button"
          className="gk-pkg-cta"
          onClick={() => onAdd?.(pkg)}
          disabled={unavailable || inCart}
          aria-label={
            inCart ? `${pkg.label} is already in your booking`
              : unavailable ? `${pkg.label} is not available for this car`
              : `Add ${pkg.label} to your booking`
          }
        >
          {inCart ? <><Check size={15} aria-hidden="true" /> Added</>
            : unavailable ? 'Unavailable'
            : <><Plus size={15} aria-hidden="true" /> Add to booking</>}
        </button>
      </div>
    </article>
  );
}
