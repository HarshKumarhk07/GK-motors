import { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { getOrder, cancelMyOrder } from '../api/storeApi';
import { useAuth } from '../context/AuthContext';
import { reportApiError } from '../api/apiError';
import { PageLoader } from '../components/common/LoadingSpinner';
import {
  ArrowLeft, CheckCircle, MapPin, CreditCard, AlertCircle, Package, Truck,
} from 'lucide-react';

const PART_PLACEHOLDER = '/part-images/_placeholder.svg';
const STEPS = ['placed', 'confirmed', 'shipped', 'delivered'];

const money = (n) => `₹${Number(n || 0).toLocaleString('en-IN')}`;
const longDate = (d) => {
  const parsed = new Date(d);
  return Number.isNaN(parsed.getTime())
    ? '—'
    : parsed.toLocaleString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
};

export default function OrderDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [cancelling, setCancelling] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    return getOrder(id)
      .then(({ data }) => { setOrder(data.order); setError(''); })
      .catch((err) => setError(reportApiError('OrderDetail.getOrder', err, 'We could not load this order.')))
      .finally(() => setLoading(false));
  }, [id]);

  useEffect(() => {
    if (!user) { navigate(`/login?redirect=/orders/${id}`); return; }
    load();
  }, [user, id, navigate, load]);

  const handleCancel = async () => {
    if (!window.confirm('Cancel this order? Any reserved stock is released.')) return;
    setCancelling(true);
    try {
      const { data } = await cancelMyOrder(order._id);
      setOrder(data.order);
      toast.success('Order cancelled');
    } catch (err) {
      toast.error(err.response?.data?.message || 'We could not cancel this order');
    } finally {
      setCancelling(false);
    }
  };

  if (loading) return <PageLoader />;

  if (error || !order) {
    return (
      <div className="gk-od-wrap" style={{ padding: '3rem 1rem' }}>
        <style>{STYLES}</style>
        <div className="gk-od-error">
          <AlertCircle size={18} style={{ color: '#EF4444', flexShrink: 0 }} />
          <span style={{ flex: 1, minWidth: 0 }}>{error || 'Order not found.'}</span>
        </div>
        <Link to="/my-orders" className="gk-od-btn is-primary" style={{ marginTop: '1.25rem' }}>
          <ArrowLeft size={15} /> Back to my orders
        </Link>
      </div>
    );
  }

  const items = Array.isArray(order.items) ? order.items : [];
  const paid = order.payment?.status === 'paid';
  const cancelled = order.status === 'cancelled';
  const canCancel = ['placed', 'confirmed'].includes(order.status) && !paid;
  const currentIdx = STEPS.indexOf(order.status);
  const addr = order.deliveryAddress || {};

  return (
    <div style={{ minHeight: '100vh', background: '#FFFFFF' }}>
      <style>{STYLES}</style>

      <div className="gk-od-wrap">
        <Link to="/my-orders" className="gk-od-back"><ArrowLeft size={15} /> My orders</Link>

        <header className="gk-od-head">
          <div style={{ minWidth: 0 }}>
            <p className="gk-od-eyebrow">Order</p>
            <h1 className="gk-od-title">#{String(order._id).slice(-8).toUpperCase()}</h1>
            <p className="gk-od-date">Placed {longDate(order.createdAt)}</p>
          </div>
          <div className="gk-od-headside">
            <span className={`gk-od-status ${cancelled ? 'is-cancelled' : ''}`}>{order.status}</span>
            <span className={`gk-od-pay ${paid ? 'is-paid' : ''}`}>
              <CreditCard size={13} /> {paid ? 'Paid online' : 'Payment pending'}
            </span>
          </div>
        </header>

        {!cancelled && (
          <section className="gk-od-card">
            <div className="gk-od-track">
              {STEPS.map((s, i) => {
                const done = i <= currentIdx;
                return (
                  <div key={s} className="gk-od-track-step">
                    <div style={{ display: 'flex', alignItems: 'center', width: '100%' }}>
                      <span className="gk-od-rail" style={{ background: done && i > 0 ? '#1567D3' : '#F1F5F9', visibility: i === 0 ? 'hidden' : 'visible' }} />
                      <span className="gk-od-dot" style={{ background: done ? '#1567D3' : '#F1F5F9' }}>
                        {done ? <CheckCircle size={14} color="white" /> : <span className="gk-od-pip" />}
                      </span>
                      <span className="gk-od-rail" style={{ background: i < currentIdx ? '#1567D3' : '#F1F5F9', visibility: i === STEPS.length - 1 ? 'hidden' : 'visible' }} />
                    </div>
                    <span className="gk-od-track-label" style={{ color: done ? '#0F172A' : '#94A3B8' }}>{s}</span>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        <div className="gk-od-grid">
          <section className="gk-od-card">
            <h2 className="gk-od-h2"><Package size={16} /> Items</h2>
            {items.length === 0 ? (
              <p className="gk-od-muted">No line items were recorded on this order.</p>
            ) : (
              <ul className="gk-od-items">
                {items.map((item, idx) => {
                  const productId = item.product?._id || item.product;
                  const live = productId && item.product?.isActive !== false;
                  const body = (
                    <>
                      <img
                        className="gk-od-img"
                        src={item.image || item.product?.images?.[0] || PART_PLACEHOLDER}
                        alt=""
                        loading="lazy"
                        onError={(e) => {
                          if (!e.currentTarget.src.endsWith(PART_PLACEHOLDER)) e.currentTarget.src = PART_PLACEHOLDER;
                        }}
                      />
                      <span className="gk-od-itemtext">
                        <span className="gk-od-itemname">{item.name || item.product?.name || 'Product'}</span>
                        <span className="gk-od-itemsub">Qty: {item.quantity} · {money(item.price)} each</span>
                        {!live && <span className="gk-od-itemsub">No longer listed</span>}
                      </span>
                      <span className="gk-od-itemtotal">{money((Number(item.price) || 0) * (Number(item.quantity) || 0))}</span>
                    </>
                  );
                  return (
                    <li key={item._id || `${productId}-${idx}`}>
                      {live
                        ? <Link to={`/parts/${productId}`} className="gk-od-item">{body}</Link>
                        : <span className="gk-od-item">{body}</span>}
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          <aside className="gk-od-side">
            <section className="gk-od-card">
              <h2 className="gk-od-h2"><Truck size={16} /> Summary</h2>
              <dl className="gk-od-sum">
                <div><dt>Subtotal</dt><dd>{money(order.subtotal)}</dd></div>
                <div>
                  <dt>Delivery</dt>
                  <dd>{Number(order.shippingCharge) > 0 ? money(order.shippingCharge) : 'Free'}</dd>
                </div>
                <div className="is-total"><dt>Total</dt><dd>{money(order.total)}</dd></div>
              </dl>
            </section>

            <section className="gk-od-card">
              <h2 className="gk-od-h2"><MapPin size={16} /> Delivery address</h2>
              {addr.street ? (
                <address className="gk-od-addr">
                  {addr.street}<br />
                  {[addr.city, addr.state].filter(Boolean).join(', ')}<br />
                  {addr.pincode}
                </address>
              ) : (
                <p className="gk-od-muted">No address recorded.</p>
              )}
            </section>

            {Array.isArray(order.statusHistory) && order.statusHistory.length > 0 && (
              <section className="gk-od-card">
                <h2 className="gk-od-h2">History</h2>
                <ul className="gk-od-history">
                  {order.statusHistory.map((h, i) => (
                    <li key={h._id || `${h.status}-${i}`}>
                      <span className="gk-od-hist-status">{h.status?.replace(/_/g, ' ')}</span>
                      <span className="gk-od-itemsub">{longDate(h.updatedAt)}</span>
                      {h.note && <span className="gk-od-itemsub">{h.note}</span>}
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {canCancel && (
              <button className="gk-od-btn" disabled={cancelling} onClick={handleCancel}>
                {cancelling ? 'Cancelling…' : 'Cancel order'}
              </button>
            )}
          </aside>
        </div>
      </div>
    </div>
  );
}

const STYLES = `
  .gk-od-wrap { width: 100%; max-width: 1000px; margin: 0 auto; padding: 1.5rem 1rem 3.5rem; }
  .gk-od-back { display: inline-flex; align-items: center; gap: 0.4rem; min-height: 40px; color: #475569; text-decoration: none; font-weight: 700; font-size: 0.85rem; }
  .gk-od-back:hover { color: #0F172A; }
  .gk-od-head { display: flex; gap: 1rem; align-items: flex-start; justify-content: space-between; flex-wrap: wrap; margin: 0.75rem 0 1.5rem; }
  .gk-od-eyebrow { color: #1567D3; font-weight: 800; font-size: 0.68rem; letter-spacing: 0.18em; text-transform: uppercase; margin: 0 0 0.25rem; }
  .gk-od-title { font-family: 'Space Grotesk', sans-serif; font-size: clamp(1.4rem, 5vw, 2.1rem); font-weight: 900; color: #0F172A; margin: 0; overflow-wrap: anywhere; }
  .gk-od-date { color: #64748B; font-size: 0.82rem; font-weight: 600; margin: 0.3rem 0 0; }
  .gk-od-headside { display: flex; flex-direction: column; align-items: flex-end; gap: 0.45rem; }
  .gk-od-status { text-transform: capitalize; background: #EFF6FF; color: #1567D3; border-radius: 999px; padding: 0.3rem 0.8rem; font-weight: 800; font-size: 0.78rem; }
  .gk-od-status.is-cancelled { background: #FEF2F2; color: #B91C1C; }
  .gk-od-pay { display: inline-flex; align-items: center; gap: 0.3rem; font-size: 0.72rem; font-weight: 800; padding: 0.24rem 0.6rem; border-radius: 999px; background: #FFF7ED; color: #C2410C; white-space: nowrap; }
  .gk-od-pay.is-paid { background: #ECFDF5; color: #047857; }

  .gk-od-grid { display: grid; grid-template-columns: minmax(0, 1fr) 320px; gap: 1rem; align-items: start; }
  .gk-od-side { display: flex; flex-direction: column; gap: 1rem; min-width: 0; }
  .gk-od-card { background: #FFFFFF; border: 1px solid #E7EDF7; border-radius: 16px; padding: 1.1rem; margin-bottom: 1rem; box-shadow: 0 4px 18px rgba(15,23,42,0.04); }
  .gk-od-side .gk-od-card { margin-bottom: 0; }
  .gk-od-h2 { display: flex; align-items: center; gap: 0.45rem; font-family: 'Space Grotesk', sans-serif; font-size: 1rem; font-weight: 900; color: #0F172A; margin: 0 0 0.85rem; }
  .gk-od-muted { color: #94A3B8; font-size: 0.82rem; font-weight: 600; margin: 0; }

  .gk-od-items { list-style: none; margin: 0; padding: 0; }
  .gk-od-items li + li { border-top: 1px solid #F1F5F9; }
  .gk-od-item { display: flex; align-items: center; gap: 0.8rem; padding: 0.7rem 0; text-decoration: none; color: inherit; }
  a.gk-od-item:hover .gk-od-itemname { color: #1567D3; }
  .gk-od-img { width: 54px; height: 54px; border-radius: 10px; object-fit: contain; background: #F8FAFC; border: 1px solid #EEF2F8; flex-shrink: 0; }
  .gk-od-itemtext { display: flex; flex-direction: column; gap: 0.15rem; min-width: 0; flex: 1; }
  .gk-od-itemname { font-weight: 800; font-size: 0.9rem; color: #0F172A; overflow-wrap: anywhere; }
  .gk-od-itemsub { color: #64748B; font-size: 0.75rem; font-weight: 600; overflow-wrap: anywhere; }
  .gk-od-itemtotal { font-family: 'Space Grotesk', sans-serif; font-weight: 900; font-size: 1rem; color: #0F172A; white-space: nowrap; flex-shrink: 0; }

  .gk-od-sum { margin: 0; }
  .gk-od-sum > div { display: flex; justify-content: space-between; gap: 1rem; padding: 0.4rem 0; }
  .gk-od-sum dt { color: #64748B; font-size: 0.83rem; font-weight: 600; }
  .gk-od-sum dd { margin: 0; font-weight: 800; font-size: 0.88rem; color: #0F172A; white-space: nowrap; }
  .gk-od-sum .is-total { border-top: 1px solid #F1F5F9; margin-top: 0.35rem; padding-top: 0.7rem; }
  .gk-od-sum .is-total dd { font-family: 'Space Grotesk', sans-serif; font-size: 1.3rem; font-weight: 900; }

  .gk-od-addr { font-style: normal; color: #475569; font-size: 0.85rem; font-weight: 600; line-height: 1.7; overflow-wrap: anywhere; }
  .gk-od-history { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 0.7rem; }
  .gk-od-history li { display: flex; flex-direction: column; gap: 0.1rem; border-left: 2px solid #E2E8F0; padding-left: 0.7rem; }
  .gk-od-hist-status { font-weight: 800; font-size: 0.82rem; color: #0F172A; text-transform: capitalize; }

  .gk-od-track { display: flex; }
  .gk-od-track-step { flex: 1; display: flex; flex-direction: column; align-items: center; min-width: 0; }
  .gk-od-rail { flex: 1; height: 3px; border-radius: 2px; }
  .gk-od-dot { width: 24px; height: 24px; border-radius: 50%; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
  .gk-od-pip { width: 7px; height: 7px; border-radius: 50%; background: #CBD5E1; }
  .gk-od-track-label { font-size: 0.7rem; margin-top: 0.45rem; font-weight: 800; text-transform: capitalize; font-family: 'Space Grotesk', sans-serif; text-align: center; overflow-wrap: anywhere; }

  .gk-od-btn { display: inline-flex; align-items: center; justify-content: center; gap: 0.4rem; min-height: 44px; padding: 0 1.2rem; border-radius: 11px; border: 1.5px solid #E2E8F0; background: #FFFFFF; color: #475569; font-weight: 800; font-size: 0.85rem; cursor: pointer; text-decoration: none; }
  .gk-od-btn.is-primary { background: #1567D3; border-color: #1567D3; color: #FFFFFF; }
  .gk-od-btn:disabled { opacity: 0.6; cursor: not-allowed; }
  .gk-od-error { display: flex; align-items: center; gap: 0.6rem; background: #FEF2F2; border: 1.5px solid #FECACA; border-radius: 12px; padding: 1rem; color: #991B1B; font-weight: 600; font-size: 0.85rem; }

  @media (max-width: 860px) {
    .gk-od-grid { grid-template-columns: 1fr; }
  }
  @media (max-width: 560px) {
    .gk-od-card { padding: 0.95rem; border-radius: 14px; }
    .gk-od-headside { align-items: flex-start; flex-direction: row; flex-wrap: wrap; }
    .gk-od-img { width: 46px; height: 46px; }
    .gk-od-track-label { font-size: 0.62rem; }
  }
`;
