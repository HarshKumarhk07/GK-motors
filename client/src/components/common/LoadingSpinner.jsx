export default function LoadingSpinner({ size = 'md', text = '' }) {
  const sizes = { sm: 24, md: 40, lg: 56 };
  const s = sizes[size] || 40;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '1rem', padding: '2rem' }}>
      <svg width={s} height={s} viewBox="0 0 50 50" style={{ animation: 'spin 0.8s linear infinite' }}>
        <style>{`@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }`}</style>
        <circle cx="25" cy="25" r="20" fill="none" stroke="#2A2A2A" strokeWidth="4" />
        <circle cx="25" cy="25" r="20" fill="none" stroke="#1E3A8A" strokeWidth="4"
          strokeDasharray="80" strokeDashoffset="60" strokeLinecap="round" />
      </svg>
      {text && <p style={{ color: '#888', fontSize: '0.9rem' }}>{text}</p>}
    </div>
  );
}

export function PageLoader() {
  return (
    <div style={{ minHeight: '60vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#111' }}>
      <LoadingSpinner size="lg" text="Loading..." />
    </div>
  );
}

export function SkeletonCard() {
  return (
    <div className="card-dark" style={{ overflow: 'hidden' }}>
      <div className="skeleton" style={{ height: 200, width: '100%' }} />
      <div style={{ padding: '1rem' }}>
        <div className="skeleton" style={{ height: 20, width: '70%', marginBottom: '0.5rem' }} />
        <div className="skeleton" style={{ height: 16, width: '50%', marginBottom: '0.5rem' }} />
        <div className="skeleton" style={{ height: 16, width: '40%' }} />
      </div>
    </div>
  );
}

