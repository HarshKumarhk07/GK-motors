import { useState, useEffect } from 'react';
import { getParts, getPartCategories, getFeaturedParts } from '../api/storeApi';
import { reportApiError } from '../api/apiError';
import PartCard from '../components/parts/PartCard';
import { SkeletonCard } from '../components/common/LoadingSpinner';
import { ShoppingCart, Search, SlidersHorizontal, Star } from 'lucide-react';
import { useCart } from '../context/CartContext';
import { Link } from 'react-router-dom';
import PageHero from '../components/common/PageHero';

const formatCategoryLabel = (val) => String(val || '').replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());

export default function SpareParts() {
  const [parts, setParts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [category, setCategory] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [pincode, setPincode] = useState(() => localStorage.getItem('selectedPincode') || '');
  const [categories, setCategories] = useState([]);
  const [featured, setFeatured] = useState([]);
  const [loadError, setLoadError] = useState('');
  const [reloadToken, setReloadToken] = useState(0);
  const { itemCount } = useCart();

  // Featured parts are whatever the admin has ticked as featured. They are
  // fetched once, not per page — the strip is a shelf, not a view of the grid.
  useEffect(() => {
    getFeaturedParts()
      .then(({ data }) => setFeatured((data.parts || []).slice(0, 5)))
      .catch((err) => console.error('[SpareParts.getFeaturedParts]', err));
  }, []);

  useEffect(() => {
    getPartCategories()
      // A part saved with a null category would otherwise render a blank tab.
      .then(({ data }) => setCategories((data.categories || []).filter(Boolean)))
      .catch(() => {});
  }, []);

  useEffect(() => {
    const handlePincodeUpdate = () => {
      setPincode(localStorage.getItem('selectedPincode') || '');
      setPage(1);
    };
    window.addEventListener('pincode-updated', handlePincodeUpdate);
    return () => window.removeEventListener('pincode-updated', handlePincodeUpdate);
  }, []);

  /* One request per filter change, and only the newest one may write.
   *
   * Two ways this effect used to leave the grid disagreeing with the filter:
   *
   * 1. `.catch(() => {})` swallowed the failure, so `setParts` never ran and
   *    the PREVIOUS filter's products stayed on screen with loading already
   *    false. Tapping a category while the API was unreachable therefore
   *    looked exactly like "the filter did nothing" -- unrelated categories
   *    kept sitting there, with no error and no empty state.
   * 2. Nothing tied a response to the request that asked for it. Tapping A
   *    then B resolved in arrival order, so a slow A could land after B and
   *    repaint A's products under B's highlighted tab.
   *
   * `cancelled` fixes both: React runs the cleanup before re-running the
   * effect, so a superseded request can no longer write, and the failure path
   * now clears the grid and surfaces the error instead of leaving stale rows.
   */
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setLoadError('');
    const params = { category, search, page, limit: 12 };
    if (pincode.length === 6) params.pincode = pincode;
    getParts(params)
      .then(({ data }) => {
        if (cancelled) return;
        const list = Array.isArray(data?.parts) ? data.parts : [];
        const count = Number(data?.total) || 0;
        setParts(list);
        setTotal(count);
        setPages(Math.max(1, Math.ceil(count / 12)));
      })
      .catch((err) => {
        if (cancelled) return;
        // Never keep the old filter's products: an empty grid plus an error is
        // honest, stale rows under a new filter are not.
        setParts([]);
        setTotal(0);
        setPages(1);
        setLoadError(reportApiError('SpareParts.getParts', err, 'Could not load products'));
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [category, search, page, pincode, reloadToken]);

  const activeCatLabel = category ? formatCategoryLabel(category) : 'All Parts';

  // The shelf only appears on the unfiltered first page — anywhere else it would
  // compete with the search or filter the customer is actually running.
  const showFeatured = featured.length > 0 && !category && !search && page === 1 && !loadError;
  // A featured part is still an ordinary part, so it comes back in the paged
  // list too. Show it once: on the shelf, not again directly underneath.
  const featuredIds = new Set(showFeatured ? featured.map((f) => f._id) : []);
  const gridParts = parts.filter((p) => !featuredIds.has(p._id));

  return (
    <div style={{ flex: '1 0 auto', background: '#FFFFFF', width: '100%' }}>
      <style>{`
        @media (max-width: 640px) {
          .parts-grid { grid-template-columns: repeat(2, 1fr) !important; gap: 0.6rem !important; }
          .parts-header h1 { font-size: 1.8rem !important; }
        }
        @media (max-width: 400px) {
          .parts-grid { grid-template-columns: repeat(2, 1fr) !important; }
        }
      `}</style>
      {/* The page title moves to the shared PageHero so Shop opens the same
          way Services, About and Contact do. What stays here is the toolbar —
          the cart button and the search field — which are controls, not
          decoration, and belong above the grid rather than in the banner. */}
      <PageHero
        crumb={{ label: 'Shop' }}
        eyebrow="GK Motors spares"
        title="Genuine parts,"
        highlight="workshop prices."
        lede={
          total > 0
            ? `${total} products in stock — oils, filters, batteries and accessories. Buy them for your own garage, or have us fit them during your service.`
            : 'Oils, filters, batteries and accessories. Buy them for your own garage, or have us fit them during your service.'
        }
      />

      <div style={{ background: '#FFFFFF', borderBottom: '1px solid #E4EBF7' }}>
        <div className="gk-wrap" style={{ paddingTop: '1.6rem', paddingBottom: '1.2rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
            {/* Cart button */}
              <Link to="/cart" className="gk-btn gk-btn--primary">
                <ShoppingCart size={18} />
                My cart
                {itemCount > 0 && (
                   <span style={{
                     background: 'white', color: '#1567D3',
                     borderRadius: '999px', padding: '0 8px',
                     fontSize: '0.8rem', fontWeight: 950, marginLeft: '0.4rem'
                   }}>{itemCount}</span>
                )}
              </Link>
           </div>
 
           {/* ── Search Bar ── */}
            <div style={{ position: 'relative', marginTop: '2rem', maxWidth: 520 }}>
              <Search size={16} style={{ position: 'absolute', left: 16, top: '50%', transform: 'translateY(-50%)', color: '#64748B', pointerEvents: 'none' }} />
              <input
                type="text"
                placeholder={`Search ${activeCatLabel.toLowerCase()}...`}
                value={search}
                onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                className="input-light"
                style={{
                  paddingLeft: '3rem',
                  height: '54px',
                  background: '#FFF',
                  border: '1px solid rgba(156, 163, 175, 0.2)',
                  borderRadius: '12px',
                  color: '#0F172A',
                  fontWeight: 600,
                  boxShadow: '0 4px 12px rgba(0,0,0,0.02)'
                }}
              />
              {search && (
                <button onClick={() => setSearch('')}
                  style={{ position: 'absolute', right: 14, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: '#94A3B8', cursor: 'pointer', fontSize: '1.2rem' }}>
                  ×
                </button>
              )}
            </div>
         </div>
 
         {/* ── Category Tab Strip ── */}
         <div style={{ borderTop: '1px solid rgba(156, 163, 175, 0.1)', background: '#F8FAFC' }}>
           <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
             <div style={{ display: 'flex', gap: 0, overflowX: 'auto', scrollbarWidth: 'none' }}
               className="hide-scrollbar">
               <style>{`.hide-scrollbar::-webkit-scrollbar { display: none; }`}</style>
               {/* All Parts tab */}
               {[{ value: '', label: 'All Parts' }, ...categories.map(c => ({ value: c, label: formatCategoryLabel(c) }))].map((cat) => {
                 const isActive = category === cat.value;
                 return (
                   <button
                     key={cat.value}
                     onClick={() => { setCategory(cat.value); setPage(1); }}
                     style={{
                       flexShrink: 0,
                        padding: '1.2rem 1.5rem',
                        background: 'none', border: 'none',
                        borderBottom: `4px solid ${isActive ? '#1567D3' : 'transparent'}`,
                        color: isActive ? '#0F172A' : '#64748B',
                        cursor: 'pointer', fontSize: '0.9rem', fontWeight: isActive ? 900 : 700,
                        transition: 'all 0.3s', whiteSpace: 'nowrap',
                        fontFamily: "'Space Grotesk', sans-serif", letterSpacing: '0.05em',
                     }}
                   >
                     {cat.label}
                   </button>
                 );
               })}
             </div>
           </div>
         </div>
       </div>

      {/* ── GRID ── */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8" style={{ paddingTop: '2rem', paddingBottom: '3rem' }}>

         {/* Active filter indicator */}
         {(category || search) && (
           <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '1.5rem' }}>
             <SlidersHorizontal size={14} style={{ color: '#888' }} />
             <span style={{ color: '#888', fontSize: '0.82rem', fontWeight: 600 }}>Filtering by:</span>
              {category && (
                <span style={{ background: 'rgba(21, 103, 211, 0.08)', color: '#1567D3', border: '1px solid rgba(21, 103, 211, 0.15)', fontSize: '0.8rem', fontWeight: 800, padding: '4px 14px', borderRadius: '999px', fontFamily: "'Space Grotesk', sans-serif" }}>
                  {activeCatLabel}
                </span>
              )}
             {search && (
               <span style={{ background: '#F5F5F5', color: '#666', border: '1px solid #EEE', fontSize: '0.75rem', fontWeight: 600, padding: '3px 12px', borderRadius: '999px' }}>
                 "{search}"
               </span>
             )}
             <button onClick={() => { setCategory(''); setSearch(''); setPage(1); }}
               style={{ background: 'none', border: 'none', color: '#999', cursor: 'pointer', fontSize: '0.78rem', marginLeft: 'auto', fontWeight: 600 }}>
               Clear all ×
             </button>
           </div>
         )}
 
         {/* ── Featured shelf ── */}
         {showFeatured && (
           <div style={{ marginBottom: '3.5rem' }}>
             <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '1.25rem' }}>
               <Star size={17} style={{ color: '#F59E0B', fill: '#F59E0B' }} />
               <h2 style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: '1.5rem', fontWeight: 950, color: '#0F172A', margin: 0, letterSpacing: '0.04em', textTransform: 'uppercase' }}>
                 Featured
               </h2>
               <span style={{ color: '#94A3B8', fontSize: '0.82rem', fontWeight: 600 }}>
                 Hand-picked by our workshop
               </span>
             </div>
             <div className="parts-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '1.5rem' }}>
               {featured.map((part) => <PartCard key={`f-${part._id}`} part={part} />)}
             </div>
             {gridParts.length > 0 && (
               <>
                 <div style={{ height: 1, background: '#F1F5F9', marginTop: '3rem' }} />
                 <h2 style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: '1.5rem', fontWeight: 950, color: '#0F172A', margin: '2rem 0 0', letterSpacing: '0.04em', textTransform: 'uppercase' }}>
                   All Spares
                 </h2>
               </>
             )}
           </div>
         )}

         {loading ? (
           <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: '1.5rem' }}>
             {[...Array(8)].map((_, i) => <SkeletonCard key={i} />)}
           </div>
         ) : loadError ? (
           /* A failed request is not an empty result. Saying "no spares match
              your filters" when the call never returned would be a lie, and
              would hide the fact that a retry is what is needed. */
           <div style={{ textAlign: 'center', padding: '5rem 2rem' }}>
             <div style={{ fontSize: '3rem', marginBottom: '1.25rem' }}>⚠️</div>
             <h3 style={{ color: '#0F172A', fontFamily: "'Space Grotesk', sans-serif", fontSize: '1.5rem', fontWeight: 900, marginBottom: '0.5rem' }}>
               COULDN'T LOAD PRODUCTS
             </h3>
             <p style={{ color: '#64748B', fontSize: '0.95rem', fontWeight: 600 }}>{loadError}</p>
             <button
               onClick={() => setReloadToken((t) => t + 1)}
               style={{ marginTop: '2rem', minHeight: 48, background: '#1567D3', color: 'white', border: 'none', borderRadius: '12px', padding: '1rem 2.5rem', cursor: 'pointer', fontWeight: 900, fontSize: '1rem', boxShadow: '0 8px 25px rgba(21, 103, 211, 0.3)', fontFamily: "'Space Grotesk', sans-serif", letterSpacing: '0.1em' }}>
               Retry
             </button>
           </div>
         ) : parts.length > 0 ? (
           <>
             {gridParts.length > 0 && (
               <div className="parts-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '1.5rem' }}>
                 {gridParts.map((part) => <PartCard key={part._id} part={part} />)}
               </div>
             )}
 
             {/* Pagination */}
             {pages > 1 && (
               <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '0.5rem', marginTop: '4rem' }}>
                 <button
                   onClick={() => setPage(p => Math.max(1, p - 1))}
                   disabled={page === 1}
                   style={{ height: 40, padding: '0 1.2rem', borderRadius: '10px', border: '1px solid #EEE', background: '#FFF', color: page === 1 ? '#CCC' : '#666', cursor: page === 1 ? 'not-allowed' : 'pointer', fontSize: '0.85rem', fontWeight: 700 }}>
                   ← Prev
                 </button>
                 {[...Array(pages)].map((_, i) => (
                   <button key={i} onClick={() => setPage(i + 1)}
                     style={{
                       width: 40, height: 40, borderRadius: '10px', border: '1px solid',
                        borderColor: page === i + 1 ? '#0F172A' : '#E2E8F0',
                        background: page === i + 1 ? '#0F172A' : '#FFF',
                        color: page === i + 1 ? 'white' : '#64748B',
                        cursor: 'pointer', fontWeight: 900, fontSize: '0.95rem',
                        transition: 'all 0.3s', fontFamily: "'Space Grotesk', sans-serif",
                     }}>
                     {i + 1}
                   </button>
                 ))}
                 <button
                   onClick={() => setPage(p => Math.min(pages, p + 1))}
                   disabled={page === pages}
                   style={{ height: 40, padding: '0 1.2rem', borderRadius: '10px', border: '1px solid #EEE', background: '#FFF', color: page === pages ? '#CCC' : '#666', cursor: page === pages ? 'not-allowed' : 'pointer', fontSize: '0.85rem', fontWeight: 700 }}>
                   Next →
                 </button>
               </div>
             )}
           </>
         ) : (
           <div style={{ textAlign: 'center', padding: '6rem 2rem' }}>
             <div style={{ fontSize: '3.5rem', marginBottom: '1.5rem' }}>⚙️</div>
             <h3 style={{ color: '#0F172A', fontFamily: "'Space Grotesk', sans-serif", fontSize: '1.6rem', fontWeight: 900, marginBottom: '0.5rem' }}>
               NO SPARES FOUND
             </h3>
             <p style={{ color: '#64748B', fontSize: '0.95rem', fontWeight: 600 }}>We couldn't find any parts matching your current filters.</p>
             {(category || search) && (
                <button onClick={() => { setCategory(''); setSearch(''); }}
                  style={{ marginTop: '2rem', background: '#1567D3', color: 'white', border: 'none', borderRadius: '12px', padding: '1rem 2.5rem', cursor: 'pointer', fontWeight: 900, fontSize: '1rem', boxShadow: '0 8px 25px rgba(21, 103, 211, 0.3)', fontFamily: "'Space Grotesk', sans-serif", letterSpacing: '0.1em' }}>
                 Clear All Filters
               </button>
             )}
           </div>
         )}
      </div>
    </div>
  );
}

