import { useState, useEffect } from 'react';
import { getFeaturedParts } from '../api/storeApi';
import { getFeaturedBikes } from '../api/bikeApi';
import PartCard from '../components/parts/PartCard';
import BikeCard from '../components/bikes/BikeCard';
import { SkeletonCard } from '../components/common/LoadingSpinner';
import { Link } from 'react-router-dom';
import { ArrowLeft, Sparkles } from 'lucide-react';

export default function FeaturedParts() {
  const [parts, setParts] = useState([]);
  const [bikes, setBikes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [pincode, setPincode] = useState(() => localStorage.getItem('selectedPincode') || '');

  useEffect(() => {
    const handler = () => { setPincode(localStorage.getItem('selectedPincode') || ''); };
    window.addEventListener('pincode-updated', handler);
    return () => window.removeEventListener('pincode-updated', handler);
  }, []);

  useEffect(() => {
    setLoading(true);
    const params = {};
    if (pincode.length === 6) params.pincode = pincode;
    
    Promise.all([
      getFeaturedParts(params),
      getFeaturedBikes()
    ]).then(([partsRes, bikesRes]) => {
      setParts(partsRes.data.parts || []);
      setBikes(bikesRes.data.bikes || []);
    })
    .catch(() => {})
    .finally(() => setLoading(false));
  }, [pincode]);

  return (
    <div style={{ minHeight: '100vh', background: '#FFFFFF' }}>
      <style>{`
        @media (max-width: 640px) {
          .featured-products-grid { grid-template-columns: repeat(2, 1fr) !important; gap: 0.6rem !important; }
        }
      `}</style>
      <div style={{ height: '4px', background: 'linear-gradient(90deg, #1E3A8A, #93C5FD, transparent)' }} />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8" style={{ paddingTop: '3.5rem', paddingBottom: '5rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem', marginBottom: '3.5rem' }}>
          <Link to="/parts" style={{ background: '#F9F9F9', border: '1px solid #EEE', borderRadius: '12px', padding: '0.6rem 1.2rem', color: '#111', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.9rem', fontWeight: 800, transition: 'all 0.2s' }}
            onMouseEnter={e => { e.currentTarget.style.background = '#FFF'; e.currentTarget.style.borderColor = '#111'; }}
            onMouseLeave={e => { e.currentTarget.style.background = '#F9F9F9'; e.currentTarget.style.borderColor = '#EEE'; }}>
            <ArrowLeft size={16} /> SHOP ALL
          </Link>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <div style={{ width: 6, height: 32, background: '#1E3A8A', borderRadius: '3px' }} />
            <h1 style={{ color: '#111', fontFamily: 'Rajdhani, sans-serif', fontSize: 'clamp(1.5rem, 4vw, 2.5rem)', fontWeight: 950, margin: 0, letterSpacing: '-0.02em', textTransform: 'uppercase' }}>
              FEATURED <span style={{ color: '#1E3A8A' }}>PRODUCTS</span>
            </h1>
          </div>
        </div>
        {pincode.length === 6 && (
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.6rem', background: '#F0F7FF', color: '#0052CC', padding: '0.6rem 1.2rem', borderRadius: '12px', marginBottom: '2rem', fontSize: '0.9rem', fontWeight: 800, border: '1.5px solid rgba(0,82,204,0.1)' }}>
            <span style={{ fontSize: '1.1rem' }}>📍</span> SHOWING PREMIUM SELECTIONS NEAR <span style={{ color: '#111' }}>{pincode}</span>
          </div>
        )}
        {loading ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '2rem' }}>
            {[...Array(6)].map((_, i) => <SkeletonCard key={i} />)}
          </div>
        ) : (parts.length > 0 || bikes.length > 0) ? (
          <div className="featured-products-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '2.5rem' }}>
            {bikes.map(bike => <BikeCard key={bike._id} bike={bike} hideBadges={true} />)}
            {parts.map(part => <PartCard key={part._id} part={part} />)}
          </div>
        ) : (
          <div style={{ textAlign: 'center', padding: '10rem 2rem', background: '#F9F9F9', borderRadius: '32px', border: '1.5px solid #EEE' }}>
            <div style={{ fontSize: '4.5rem', marginBottom: '1.5rem', opacity: 0.2 }}>⭐</div>
            <h3 style={{ color: '#111', fontFamily: 'Rajdhani, sans-serif', fontSize: '1.8rem', fontWeight: 900, textTransform: 'uppercase' }}>NO FEATURED PRODUCTS FOUND</h3>
            <p style={{ color: '#666', fontSize: '1.1rem', fontWeight: 600, marginTop: '0.6rem', maxWidth: '400px', margin: '0.6rem auto' }}>Our exclusive selection of high-performance parts is currently being updated. Check back shortly!</p>
            <Link to="/parts" style={{ display: 'inline-block', marginTop: '2.5rem', color: '#1E3A8A', fontWeight: 900, textDecoration: 'none', borderBottom: '2.5px solid #1E3A8A', paddingBottom: '3px' }}>BROWSE SHOP →</Link>
          </div>
        )}
      </div>
    </div>
  );
}

