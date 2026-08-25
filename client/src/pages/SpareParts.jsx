import { useState, useEffect } from 'react';
import { getParts, getPartCategories, getFeaturedParts } from '../api/storeApi';
import PartCard from '../components/parts/PartCard';
import { SkeletonCard } from '../components/common/LoadingSpinner';
import { ShoppingCart, Search, SlidersHorizontal, Star } from 'lucide-react';
import { useCart } from '../context/CartContext';
import { Link } from 'react-router-dom';

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

  useEffect(() => {
    setLoading(true);
    const params = { category, search, page, limit: 12 };
    if (pincode.length === 6) params.pincode = pincode;
    getParts(params)
      .then(({ data }) => { setParts(data.parts); setTotal(data.total); setPages(Math.ceil(data.total / 12)); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [category, search, page, pincode]);

  const activeCatLabel = category ? formatCategoryLabel(category) : 'All Parts';

  // The shelf only appears on the unfiltered first page — anywhere else it would
  // compete with the search or filter the customer is actually running.
  const showFeatured = featured.length > 0 && !category && !search && page === 1;
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
       {/* ── HERO HEADER ── */}
        <div style={{ background: '#FFFFFF', borderBottom: '1px solid #F1F5F9', padding: '3.5rem 0' }}>
          {/* Decorative blue line */}
          <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '4px', background: '#1E3A8A' }} />
 
         <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8" style={{ paddingTop: '2.5rem', paddingBottom: '1.5rem' }}>
           <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
 
             <div>
               {/* Eyebrow */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.5rem' }}>
                  <div style={{ width: 30, height: 4, background: '#1E3A8A', borderRadius: '4px' }} />
                  <span style={{ color: '#1E3A8A', fontSize: '0.8rem', fontWeight: 900, letterSpacing: '0.25em', textTransform: 'uppercase', fontFamily: 'Rajdhani, sans-serif' }}>
                    GK Motors Spares
                  </span>
                </div>
                <h1 style={{ fontFamily: 'Rajdhani, sans-serif', fontSize: 'clamp(1.8rem, 4.5vw, 3.5rem)', fontWeight: 950, color: '#0F172A', lineHeight: 1, margin: 0, letterSpacing: '0.05em' }}>
                  GENUINE <span style={{ color: '#1E3A8A' }}>SPARES</span>
                </h1>
               <p style={{ color: '#94A3B8', marginTop: '0.5rem', fontSize: '0.88rem' }}>
                 {total > 0 ? <><span style={{ color: '#0F172A', fontWeight: 700 }}>{total}</span> products available</> : 'Browse our collection'}
                 {pincode.length === 6 && (
                   <span style={{ color: '#2E7D32', marginLeft: '0.7rem', fontWeight: 700, fontSize: '0.82rem', background: 'rgba(46,125,50,0.05)', padding: '2px 8px', borderRadius: '4px' }}>
                     📍 {pincode}
                   </span>
                 )}
               </p>
             </div>
 
             {/* Cart button */}
              <Link to="/cart" style={{
                display: 'flex', alignItems: 'center', gap: '0.7rem',
                 padding: '0.8rem 1.8rem',
                 background: '#1E3A8A',
                 borderRadius: '14px', color: 'white', textDecoration: 'none',
                 fontWeight: 900, fontSize: '0.95rem', position: 'relative',
                 transition: 'all 0.3s',
                 fontFamily: 'Rajdhani, sans-serif', letterSpacing: '0.08em',
                 boxShadow: '0 10px 25px rgba(30, 58, 138, 0.3)'
              }}
                onMouseEnter={e => { e.currentTarget.style.background = '#93C5FD'; e.currentTarget.style.transform = 'translateY(-2px)'; }}
                onMouseLeave={e => { e.currentTarget.style.background = '#1E3A8A'; e.currentTarget.style.transform = 'translateY(0)'; }}>
                <ShoppingCart size={19} />
                MY CART
                {itemCount > 0 && (
                   <span style={{
                     background: 'white', color: '#1E3A8A',
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
                        borderBottom: `4px solid ${isActive ? '#1E3A8A' : 'transparent'}`,
                        color: isActive ? '#0F172A' : '#64748B',
                        cursor: 'pointer', fontSize: '0.9rem', fontWeight: isActive ? 900 : 700,
                        transition: 'all 0.3s', whiteSpace: 'nowrap',
                        fontFamily: 'Rajdhani, sans-serif', letterSpacing: '0.05em',
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
                <span style={{ background: 'rgba(30, 58, 138, 0.08)', color: '#1E3A8A', border: '1px solid rgba(30, 58, 138, 0.15)', fontSize: '0.8rem', fontWeight: 800, padding: '4px 14px', borderRadius: '999px', fontFamily: 'Rajdhani, sans-serif' }}>
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
               <h2 style={{ fontFamily: 'Rajdhani, sans-serif', fontSize: '1.5rem', fontWeight: 950, color: '#0F172A', margin: 0, letterSpacing: '0.04em', textTransform: 'uppercase' }}>
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
                 <h2 style={{ fontFamily: 'Rajdhani, sans-serif', fontSize: '1.5rem', fontWeight: 950, color: '#0F172A', margin: '2rem 0 0', letterSpacing: '0.04em', textTransform: 'uppercase' }}>
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
                        transition: 'all 0.3s', fontFamily: 'Rajdhani, sans-serif',
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
             <h3 style={{ color: '#0F172A', fontFamily: 'Rajdhani, sans-serif', fontSize: '1.6rem', fontWeight: 900, marginBottom: '0.5rem' }}>
               NO SPARES FOUND
             </h3>
             <p style={{ color: '#64748B', fontSize: '0.95rem', fontWeight: 600 }}>We couldn't find any parts matching your current filters.</p>
             {(category || search) && (
                <button onClick={() => { setCategory(''); setSearch(''); }}
                  style={{ marginTop: '2rem', background: '#1E3A8A', color: 'white', border: 'none', borderRadius: '12px', padding: '1rem 2.5rem', cursor: 'pointer', fontWeight: 900, fontSize: '1rem', boxShadow: '0 8px 25px rgba(30, 58, 138, 0.3)', fontFamily: 'Rajdhani, sans-serif', letterSpacing: '0.1em' }}>
                 Clear All Filters
               </button>
             )}
           </div>
         )}
      </div>
    </div>
  );
}

