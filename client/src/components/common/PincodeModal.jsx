import { useState, useEffect } from 'react';
import { MapPin, X } from 'lucide-react';
import API from '../../api/axios';

const DEFAULT_PINCODE = '124001';

export default function PincodeModal() {
  const [visible, setVisible] = useState(false);
  const [value, setValue] = useState('');
  const [checking, setChecking] = useState(false);
  const [status, setStatus] = useState(null); // null | 'available' | 'unavailable'

  useEffect(() => {
    // Automatic modal showing is disabled per user request
    /*
    const alreadyShown = sessionStorage.getItem('pincodeModalShown');
    const saved = localStorage.getItem('selectedPincode');
    if (!alreadyShown && !saved) {
      setVisible(true);
    }
    */
  }, []);

  const applyPincode = (pin) => {
    localStorage.setItem('selectedPincode', pin);
    window.dispatchEvent(new Event('pincode-updated'));
    sessionStorage.setItem('pincodeModalShown', '1');
    setVisible(false);
  };

  const handleSubmit = () => {
    if (value.length === 6) applyPincode(value);
  };

  const handleSkip = () => {
    // Apply default pincode so products show
    if (!localStorage.getItem('selectedPincode')) {
      localStorage.setItem('selectedPincode', DEFAULT_PINCODE);
      window.dispatchEvent(new Event('pincode-updated'));
    }
    sessionStorage.setItem('pincodeModalShown', '1');
    setVisible(false);
  };

  // Check availability as user types
  useEffect(() => {
    if (value.length !== 6) { setStatus(null); return; }
    setChecking(true);
    API.get('/store/parts', { params: { pincode: value, limit: 1 } })
      .then(({ data }) => setStatus((data.total || 0) > 0 ? 'available' : 'unavailable'))
      .catch(() => setStatus('unavailable'))
      .finally(() => setChecking(false));
  }, [value]);

  if (!visible) return null;

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 9999,
      background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(6px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: '1rem',
    }}>
      <div style={{
        background: '#111', border: '1px solid #1E1E1E',
        borderRadius: '20px', width: '100%', maxWidth: 420,
        overflow: 'hidden', boxShadow: '0 24px 80px rgba(0,0,0,0.8)',
        position: 'relative',
      }}>
        {/* Red top bar */}
        <div style={{ height: 4, background: 'linear-gradient(90deg, #E53935, #FF7043)' }} />

        {/* Close button */}
        <button onClick={handleSkip} style={{
          position: 'absolute', top: 16, right: 16,
          background: 'none', border: 'none', color: '#444',
          cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
          width: 28, height: 28, borderRadius: '50%',
          transition: 'color 0.2s',
        }}
          onMouseEnter={e => e.currentTarget.style.color = '#888'}
          onMouseLeave={e => e.currentTarget.style.color = '#444'}
        >
          <X size={16} />
        </button>

        <div style={{ padding: '2rem 2rem 1.75rem' }}>
          {/* Icon */}
          <div style={{ width: 56, height: 56, borderRadius: '16px', background: 'rgba(229,57,53,0.1)', border: '1px solid rgba(229,57,53,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '1.2rem' }}>
            <MapPin size={26} style={{ color: '#E53935' }} />
          </div>

          {/* Heading */}
          <h2 style={{ color: 'white', fontFamily: 'Rajdhani, sans-serif', fontWeight: 900, fontSize: '1.5rem', margin: '0 0 0.35rem', letterSpacing: '0.04em' }}>
            SET YOUR LOCATION
          </h2>
          <p style={{ color: '#555', fontSize: '0.85rem', margin: '0 0 1.5rem', lineHeight: 1.5 }}>
            Enter your pincode to see available parts and special pricing for your area.
          </p>

          {/* Input */}
          <div style={{ position: 'relative', marginBottom: '0.75rem' }}>
            <input
              type="text"
              placeholder="Enter 6-digit pincode"
              maxLength={6}
              value={value}
              onChange={e => setValue(e.target.value.replace(/\D/g, '').slice(0, 6))}
              onKeyDown={e => e.key === 'Enter' && value.length === 6 && handleSubmit()}
              autoFocus
              style={{
                width: '100%', boxSizing: 'border-box',
                background: '#0D0D0D',
                border: `1px solid ${value.length === 6 ? (status === 'available' ? '#4CAF50' : status === 'unavailable' ? '#E53935' : '#2A2A2A') : '#2A2A2A'}`,
                borderRadius: '10px', padding: '0.75rem 1rem',
                color: 'white', fontSize: '1.1rem',
                letterSpacing: '0.15em', outline: 'none',
                fontFamily: 'Rajdhani, sans-serif', fontWeight: 700,
                transition: 'border-color 0.2s',
              }}
            />
            {checking && (
              <div style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', width: 16, height: 16, border: '2px solid #2A2A2A', borderTopColor: '#E53935', borderRadius: '50%', animation: 'spin 0.6s linear infinite' }} />
            )}
            {!checking && value.length === 6 && status && (
              <span style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', fontSize: '0.72rem', fontWeight: 700, color: status === 'available' ? '#4CAF50' : '#E53935' }}>
                {status === 'available' ? '✓ Available' : '✗ Not Available'}
              </span>
            )}
          </div>
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>

          {/* CTA */}
          <button
            onClick={handleSubmit}
            disabled={value.length < 6}
            style={{
              width: '100%', padding: '0.85rem',
              background: value.length === 6 ? 'linear-gradient(135deg, #E53935, #C62828)' : '#1A1A1A',
              color: value.length === 6 ? 'white' : '#444',
              border: 'none', borderRadius: '10px',
              fontWeight: 900, fontSize: '0.95rem',
              cursor: value.length === 6 ? 'pointer' : 'not-allowed',
              fontFamily: 'Rajdhani, sans-serif', letterSpacing: '0.08em',
              transition: 'all 0.2s',
              marginBottom: '0.75rem',
            }}
          >
            CONFIRM LOCATION →
          </button>

          {/* Skip note */}
          <p style={{ color: '#333', fontSize: '0.75rem', textAlign: 'center', lineHeight: 1.5 }}>
            Don't have a pincode?{' '}
            <button onClick={handleSkip} style={{ background: 'none', border: 'none', color: '#555', cursor: 'pointer', fontSize: '0.75rem', textDecoration: 'underline', padding: 0 }}>
              Skip — will show products for <strong style={{ color: '#888' }}>{DEFAULT_PINCODE}</strong>
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}

