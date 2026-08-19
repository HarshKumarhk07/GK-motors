import { useState, useEffect } from 'react';
import { getBestsellerBikes } from '../api/bikeApi';
import BikeCard from '../components/bikes/BikeCard';
import { SkeletonCard } from '../components/common/LoadingSpinner';
import { Link } from 'react-router-dom';
import { ArrowLeft, TrendingUp } from 'lucide-react';

export default function BestsellerBikes() {
  const [bikes, setBikes] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    getBestsellerBikes()
      .then(({ data }) => setBikes(data.bikes || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  return (
    <div style={{ minHeight: '100vh', background: '#FFFFFF' }}>
      <style>{`
        @media (max-width: 640px) {
          .bestseller-bikes-grid { grid-template-columns: repeat(2, 1fr) !important; gap: 0.6rem !important; }
        }
      `}</style>
      <div style={{ height: '4px', background: 'linear-gradient(90deg, #1E3A8A, #93C5FD, transparent)' }} />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8" style={{ paddingTop: '3.5rem', paddingBottom: '5rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem', marginBottom: '3.5rem' }}>
          <Link to="/bikes" style={{ background: '#F9F9F9', border: '1px solid #EEE', borderRadius: '12px', padding: '0.6rem 1.2rem', color: '#111', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.9rem', fontWeight: 800, transition: 'all 0.2s' }}
            onMouseEnter={e => { e.currentTarget.style.background = '#FFF'; e.currentTarget.style.borderColor = '#111'; }}
            onMouseLeave={e => { e.currentTarget.style.background = '#F9F9F9'; e.currentTarget.style.borderColor = '#EEE'; }}>
            <ArrowLeft size={16} /> BROWSE ALL
          </Link>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <div style={{ width: 6, height: 32, background: '#1E3A8A', borderRadius: '3px' }} />
            <h1 style={{ color: '#111', fontFamily: 'Rajdhani, sans-serif', fontSize: 'clamp(1.5rem, 4vw, 2.5rem)', fontWeight: 950, margin: 0, letterSpacing: '-0.02em', textTransform: 'uppercase' }}>
              BEST <span style={{ color: '#1E3A8A' }}>SELLERS</span>
            </h1>
          </div>
        </div>
        
        {loading ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '2rem' }}>
            {[...Array(4)].map((_, i) => <SkeletonCard key={i} />)}
          </div>
        ) : bikes.length > 0 ? (
          <div className="bestseller-bikes-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '2.5rem' }}>
            {bikes.map(bike => <BikeCard key={bike._id} bike={bike} />)}
          </div>
        ) : (
          <div style={{ textAlign: 'center', padding: '10rem 2rem', background: '#F9F9F9', borderRadius: '32px', border: '1.5px solid #EEE' }}>
            <div style={{ fontSize: '4.5rem', marginBottom: '1.5rem', opacity: 0.2 }}>🔥</div>
            <h3 style={{ color: '#111', fontFamily: 'Rajdhani, sans-serif', fontSize: '1.8rem', fontWeight: 900, textTransform: 'uppercase' }}>NO BESTSELLING PRODUCTS FOUND</h3>
            <p style={{ color: '#666', fontSize: '1.1rem', fontWeight: 600, marginTop: '0.6rem', maxWidth: '400px', margin: '0.6rem auto' }}>We are currently updating our hottest selling premium vehicles. Please check back shortly!</p>
            <Link to="/bikes" style={{ display: 'inline-block', marginTop: '2.5rem', color: '#1E3A8A', fontWeight: 900, textDecoration: 'none', borderBottom: '2.5px solid #1E3A8A', paddingBottom: '3px' }}>EXPLORE CATALOGUE →</Link>
          </div>
        )}
      </div>
    </div>
  );
}

