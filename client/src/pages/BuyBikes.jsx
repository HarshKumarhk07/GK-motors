import { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { getBikes } from '../api/bikeApi';
import BikeCard from '../components/bikes/BikeCard';
import { SkeletonCard } from '../components/common/LoadingSpinner';
import { Search, SlidersHorizontal, X, ChevronDown } from 'lucide-react';

const BRANDS = ['Mercedes-Benz', 'BMW', 'Audi', 'Porsche', 'Toyota', 'Honda', 'Hyundai', 'Tata', 'Mahindra', 'Kia', 'Volvo'];
const CONDITIONS = ['excellent', 'good', 'fair', 'poor'];
const FUEL_TYPES = ['petrol', 'electric', 'hybrid'];

export default function BuyBikes() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [bikes, setBikes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [filtersOpen, setFiltersOpen] = useState(false);

  const [filters, setFilters] = useState({
    search: searchParams.get('search') || '',
    type: searchParams.get('type') || '',
    brand: searchParams.get('brand') || '',
    condition: '',
    fuelType: '',
    minPrice: '',
    maxPrice: '',
    minYear: '',
    maxYear: '',
    sort: 'newest',
  });

  const fetchBikes = useCallback(async () => {
    setLoading(true);
    try {
      const params = { page, limit: 12 };
      Object.entries(filters).forEach(([k, v]) => { if (v) params[k] = v; });
      const { data } = await getBikes(params);
      setBikes(data.bikes);
      setTotal(data.total);
      setPages(data.pages);
    } catch { } finally { setLoading(false); }
  }, [filters, page]);

  useEffect(() => { fetchBikes(); }, [fetchBikes]);

  const handleFilter = (key, value) => {
    setFilters((f) => ({ ...f, [key]: value }));
    setPage(1);
  };

  const clearFilters = () => {
    setFilters({ search: '', type: '', brand: '', condition: '', fuelType: '', minPrice: '', maxPrice: '', minYear: '', maxYear: '', sort: 'newest' });
    setPage(1);
  };

  return (
    <div style={{ minHeight: '100vh', background: '#FFFFFF' }}>
      <style>{`
        @media (max-width: 640px) {
          .bikes-search-bar { flex-direction: column !important; }
          .bikes-search-bar > div:first-child { min-width: 100% !important; }
          .bikes-type-pills { width: 100%; justify-content: center; }
          .bikes-grid { grid-template-columns: repeat(2, 1fr) !important; gap: 0.6rem !important; }
          .bikes-filter-panel { grid-template-columns: 1fr 1fr !important; }
          .bikes-sort-row { width: 100% !important; }
          .bikes-sort-row select { width: 100% !important; }
          .bikes-sort-row button { flex: 1 !important; }
        }
        @media (max-width: 400px) {
          .bikes-grid { grid-template-columns: repeat(2, 1fr) !important; }
          .bikes-filter-panel { grid-template-columns: 1fr !important; }
        }
      `}</style>
      {/* Header */}
      <div style={{ background: '#FFFFFF', borderBottom: '1px solid #F1F5F9', padding: '2.5rem 0' }}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h1 style={{ fontFamily: 'Rajdhani, sans-serif', fontSize: 'clamp(2rem, 5vw, 3.5rem)', fontWeight: 950, color: '#0F172A', marginBottom: '0.4rem', letterSpacing: '0.02em' }}>
            Explore <span style={{ color: '#1E3A8A' }}>Luxury Collection</span>
          </h1>
          <p style={{ color: '#64748B', fontSize: '1.1rem', fontWeight: 600 }}>{total} premium vehicles available</p>

          {/* Search & Sort Bar */}
          <div className="bikes-search-bar" style={{ display: 'flex', gap: '1rem', marginTop: '1.5rem', flexWrap: 'wrap' }}>
            <div style={{ flex: 1, minWidth: 250, position: 'relative' }}>
              <Search size={16} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#64748B' }} />
              <input type="text" className="input-light" style={{ paddingLeft: '2.5rem', background: '#FFF', border: '1px solid rgba(156, 163, 175, 0.2)', fontWeight: 600 }}
                placeholder="Search brand, model, city..."
                value={filters.search}
                onChange={(e) => handleFilter('search', e.target.value)} />
            </div>

            {/* Type Pills */}
            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
              {['', 'new', 'used'].map((t) => (
                <button key={t} onClick={() => handleFilter('type', t)}
                  style={{
                    padding: '0.6rem 1.8rem', borderRadius: '12px', border: '1.5px solid',
                    borderColor: filters.type === t ? '#1E3A8A' : '#E2E8F0',
                    background: filters.type === t ? 'rgba(30, 58, 138, 0.05)' : '#FFF',
                    color: filters.type === t ? '#1E3A8A' : '#64748B',
                    cursor: 'pointer', fontSize: '0.9rem', fontWeight: 800,
                    transition: 'all 0.3s', fontFamily: 'Rajdhani, sans-serif', letterSpacing: '0.05em'
                  }}>
                  {t === '' ? 'All' : t.charAt(0).toUpperCase() + t.slice(1)}
                </button>
              ))}
            </div>

            <div className="bikes-sort-row" style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
              <select className="input-light" style={{ width: 'auto', background: '#FFF', border: '1px solid rgba(156, 163, 175, 0.2)', fontWeight: 700, fontFamily: 'Rajdhani, sans-serif' }} value={filters.sort} onChange={(e) => handleFilter('sort', e.target.value)}>
                <option value="newest">Newest First</option>
                <option value="price_asc">Price: Low to High</option>
                <option value="price_desc">Price: High to Low</option>
                <option value="popular">Most Popular</option>
              </select>

               <button onClick={() => setFiltersOpen(!filtersOpen)}
                style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.6rem 1.5rem', background: '#0F172A', border: 'none', borderRadius: '12px', color: '#FFF', cursor: 'pointer', fontWeight: 900, whiteSpace: 'nowrap', transition: 'all 0.3s', fontFamily: 'Rajdhani, sans-serif', letterSpacing: '0.05em' }}>
                <SlidersHorizontal size={18} /> FILTERS
              </button>
            </div>
          </div>

           {/* Expanded Filters */}
          {filtersOpen && (
            <div style={{ marginTop: '1.5rem', padding: '1.5rem', background: '#FFF', borderRadius: '16px', border: '1px solid rgba(156, 163, 175, 0.1)', boxShadow: '0 20px 40px rgba(0,0,0,0.05)' }}>
              <div className="bikes-filter-panel" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem' }}>
                {/* Brand */}
                <div>
                  <label style={{ color: '#64748B', fontSize: '0.75rem', display: 'block', marginBottom: '0.5rem', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Brand</label>
                  <select className="input-light" value={filters.brand} onChange={(e) => handleFilter('brand', e.target.value)} style={{ background: '#F8FAFC' }}>
                    <option value="">All Brands</option>
                    {BRANDS.map((b) => <option key={b} value={b}>{b}</option>)}
                  </select>
                </div>
                {/* Condition */}
                <div>
                  <label style={{ color: '#64748B', fontSize: '0.75rem', display: 'block', marginBottom: '0.5rem', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Condition</label>
                  <select className="input-light" value={filters.condition} onChange={(e) => handleFilter('condition', e.target.value)} style={{ background: '#F8FAFC' }}>
                    <option value="">All</option>
                    {CONDITIONS.map((c) => <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</option>)}
                  </select>
                </div>
                {/* Fuel */}
                <div>
                  <label style={{ color: '#64748B', fontSize: '0.75rem', display: 'block', marginBottom: '0.5rem', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Fuel Type</label>
                  <select className="input-light" value={filters.fuelType} onChange={(e) => handleFilter('fuelType', e.target.value)} style={{ background: '#F8FAFC' }}>
                    <option value="">All</option>
                    {FUEL_TYPES.map((f) => <option key={f} value={f}>{f.charAt(0).toUpperCase() + f.slice(1)}</option>)}
                  </select>
                </div>
                {/* Price */}
                <div>
                  <label style={{ color: '#64748B', fontSize: '0.75rem', display: 'block', marginBottom: '0.5rem', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Price Range (₹)</label>
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <input type="number" className="input-light" placeholder="Min" value={filters.minPrice} onChange={(e) => handleFilter('minPrice', e.target.value)} style={{ background: '#F8FAFC' }} />
                    <input type="number" className="input-light" placeholder="Max" value={filters.maxPrice} onChange={(e) => handleFilter('maxPrice', e.target.value)} style={{ background: '#F8FAFC' }} />
                  </div>
                </div>
                {/* Year */}
                <div>
                  <label style={{ color: '#64748B', fontSize: '0.75rem', display: 'block', marginBottom: '0.5rem', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Year Range</label>
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <input type="number" className="input-light" placeholder="From" value={filters.minYear} onChange={(e) => handleFilter('minYear', e.target.value)} style={{ background: '#F8FAFC' }} />
                    <input type="number" className="input-light" placeholder="To" value={filters.maxYear} onChange={(e) => handleFilter('maxYear', e.target.value)} style={{ background: '#F8FAFC' }} />
                  </div>
                </div>
              </div>
              <button onClick={clearFilters} style={{ marginTop: '1.2rem', display: 'flex', alignItems: 'center', gap: '0.4rem', background: 'none', border: '1px solid rgba(156, 163, 175, 0.2)', borderRadius: '10px', color: '#94A3B8', padding: '0.6rem 1.2rem', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 600 }}>
                <X size={14} /> Clear All Filters
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Bike Grid */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {loading ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: '1.5rem' }}>
            {[...Array(12)].map((_, i) => <SkeletonCard key={i} />)}
          </div>
        ) : bikes.length > 0 ? (
          <>
            <div className="animate-fadeInUp bikes-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '1.5rem' }}>
              {bikes.map((bike) => <BikeCard key={bike._id} bike={bike} hideBadges={true} />)}
            </div>

            {/* Pagination */}
            {pages > 1 && (
              <div style={{ display: 'flex', justifyContent: 'center', gap: '0.6rem', marginTop: '4rem' }}>
                {[...Array(pages)].map((_, i) => (
                  <button key={i} onClick={() => setPage(i + 1)}
                    style={{
                      width: 44, height: 44, borderRadius: '12px',
                      background: page === i + 1 ? '#0F172A' : '#FFF',
                      color: page === i + 1 ? 'white' : '#64748B',
                      cursor: 'pointer', fontWeight: 950, fontSize: '0.95rem',
                      fontFamily: 'Rajdhani, sans-serif',
                      transition: 'all 0.3s', boxShadow: page === i + 1 ? '0 8px 20px rgba(15, 23, 42, 0.2)' : '0 4px 12px rgba(0,0,0,0.03)',
                      border: page === i + 1 ? 'none' : '1px solid rgba(156, 163, 175, 0.1)'
                    }}>
                    {i + 1}
                  </button>
                ))}
              </div>
            )}
          </>
        ) : (
          <div style={{ textAlign: 'center', padding: '8rem 2rem', color: '#64748B' }}>
            <p style={{ fontSize: '1.4rem', marginBottom: '2rem', fontWeight: 600, fontFamily: 'Rajdhani, sans-serif' }}>No cars match your current filters</p>
            <button onClick={clearFilters} className="btn-primary">Clear Filters</button>
          </div>
        )}
      </div>
    </div>
  );
}

