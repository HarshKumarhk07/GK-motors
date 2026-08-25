import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import {
  getMyBookings, createServicePayment, verifyServicePayment, reportServicePaymentFailed,
} from '../api/serviceApi';
import { getMyOrders, cancelMyOrder } from '../api/storeApi';
import { useNavigate, useLocation, useSearchParams, Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { PageLoader } from '../components/common/LoadingSpinner';
import { reportApiError } from '../api/apiError';
import {
  Wrench, ShoppingBag, Clock, CheckCircle, Package, Car, AlertCircle,
  ArrowRight, RefreshCw, CreditCard,
} from 'lucide-react';

const PART_PLACEHOLDER = '/part-images/_placeholder.svg';

const SERVICE_STEPS = ['requested', 'accepted', 'in_progress', 'completed'];
const ORDER_STEPS = ['placed', 'confirmed', 'shipped', 'delivered'];

const loadRazorpay = () =>
  new Promise((resolve) => {
    if (window.Razorpay) return resolve(true);
    const s = document.createElement('script');
    s.src = 'https://checkout.razorpay.com/v1/checkout.js';
    s.onload = () => resolve(true);
    s.onerror = () => resolve(false);
    document.body.appendChild(s);
  });

/**
 * Can this booking still be paid for?
 *
 * Anything not already paid and not cancelled, as long as there is an amount
 * to pay. `failed` is included on purpose — a declined card is exactly the
 * case where the customer needs to try again, and a booking whose payment
 * failed is otherwise a dead end.
 */
const isPayable = (b) =>
  b?.status !== 'cancelled'
  && b?.payment?.status !== 'paid'
  && Number(b?.totalAmount ?? b?.estimatedCost ?? 0) > 0;

/** Wording for the payment pill, so a failed attempt does not read as merely pending. */
const paymentLabel = (status) => {
  if (status === 'paid') return 'Paid';
  if (status === 'failed') return 'Payment failed';
  if (status === 'refunded') return 'Refunded';
  return 'Payment pending';
};

const statusBadge = (status) => {
  const map = {
    requested: 'badge-orange', accepted: 'badge-blue', in_progress: 'badge-blue',
    completed: 'badge-green', cancelled: 'badge-red',
    placed: 'badge-blue', confirmed: 'badge-blue',
    shipped: 'badge-orange', delivered: 'badge-green',
  };
  return <span className={`badge ${map[status] || 'badge-gray'}`}>{status?.replace(/_/g, ' ') || 'unknown'}</span>;
};

const money = (n) => `₹${Number(n || 0).toLocaleString('en-IN')}`;

const shortDate = (d) => {
  if (!d) return '—';
  const parsed = new Date(d);
  if (Number.isNaN(parsed.getTime())) return '—';
  return parsed.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
};

/**
 * A booking's title. New GK Motors bookings carry a `services[]` array; the
 * older single-service ones only have `serviceLabel`. Read both so historical
 * bookings do not render as a blank heading.
 */
const bookingTitle = (b) => {
  if (Array.isArray(b.services) && b.services.length) {
    const [first, ...rest] = b.services;
    return rest.length ? `${first.name} +${rest.length} more` : first.name;
  }
  return b.serviceLabel || b.serviceType || 'Service booking';
};

const bookingCar = (b) => {
  const car = b.selectedCar;
  if (car?.brand || car?.model) {
    return [car.brand, car.model, car.year].filter(Boolean).join(' ');
  }
  return [b.bikeBrand, b.bikeModel, b.bikeYear].filter(Boolean).join(' ') || 'Vehicle';
};

const bookingAmount = (b) =>
  [b.finalCost, b.totalAmount, b.estimatedCost].find((v) => Number(v) > 0) ?? 0;

/* ── shared pieces ─────────────────────────────────────────────────────── */

const Timeline = ({ steps, current }) => {
  const currentIdx = steps.indexOf(current);
  const cancelled = current === 'cancelled';
  return (
    <div className="gk-dash-timeline">
      {steps.map((s, i) => {
        const done = !cancelled && steps.indexOf(s) <= currentIdx;
        return (
          <div key={s} className="gk-dash-step">
            <div style={{ display: 'flex', alignItems: 'center', width: '100%' }}>
              <span className="gk-dash-rail" style={{ background: done && i > 0 ? '#1E3A8A' : '#F1F5F9', visibility: i === 0 ? 'hidden' : 'visible' }} />
              <span className="gk-dash-dot" style={{ background: done ? '#1E3A8A' : '#F1F5F9' }}>
                {done ? <CheckCircle size={13} color="white" /> : <span className="gk-dash-pip" />}
              </span>
              <span className="gk-dash-rail" style={{ background: steps.indexOf(s) < currentIdx && !cancelled ? '#1E3A8A' : '#F1F5F9', visibility: i === steps.length - 1 ? 'hidden' : 'visible' }} />
            </div>
            <span className="gk-dash-step-label" style={{ color: done ? '#0F172A' : '#94A3B8' }}>
              {s.replace('_', ' ')}
            </span>
          </div>
        );
      })}
    </div>
  );
};

const EmptyState = ({ icon: Icon, title, body, cta, onCta }) => (
  <div className="gk-dash-empty">
    <div className="gk-dash-empty-icon"><Icon size={30} style={{ color: '#94A3B8' }} /></div>
    <h3 className="gk-dash-empty-title">{title}</h3>
    <p className="gk-dash-empty-body">{body}</p>
    <button onClick={onCta} className="gk-dash-cta">{cta} <ArrowRight size={15} /></button>
  </div>
);

const ErrorState = ({ message, onRetry }) => (
  <div className="gk-dash-error">
    <AlertCircle size={16} style={{ color: '#EF4444', flexShrink: 0 }} />
    <span style={{ flex: 1, minWidth: 0 }}>{message}</span>
    <button onClick={onRetry} className="gk-dash-retry"><RefreshCw size={13} /> Retry</button>
  </div>
);

/* ── page ──────────────────────────────────────────────────────────────── */

export default function MyBookings() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();

  // Landing on /my-orders (where checkout sends people after a successful
  // parts payment) has to open the Parts Orders tab, not Services — otherwise
  // the order they just paid for is one click out of sight.
  const initialTab =
    searchParams.get('tab') === 'orders' || location.pathname.startsWith('/my-orders')
      ? 'orders'
      : 'services';

  const [activeTab, setActiveTab] = useState(initialTab);
  const [services, setServices] = useState([]);
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [serviceError, setServiceError] = useState('');
  const [orderError, setOrderError] = useState('');
  const [cancelling, setCancelling] = useState('');
  const [payingId, setPayingId] = useState('');

  const loadServices = useCallback(
    () =>
      getMyBookings()
        .then(({ data }) => { setServices(data.bookings || []); setServiceError(''); })
        .catch((err) => setServiceError(
          reportApiError('Dashboard.getMyBookings', err, 'We could not load your service bookings.')
        )),
    []
  );

  const loadOrders = useCallback(
    () =>
      getMyOrders()
        .then(({ data }) => { setOrders(data.orders || []); setOrderError(''); })
        .catch((err) => setOrderError(
          reportApiError('Dashboard.getMyOrders', err, 'We could not load your parts orders.')
        )),
    []
  );

  useEffect(() => {
    if (!user) { navigate('/login?redirect=/my-bookings'); return; }
    // Both verticals load together: a customer who bought a part and booked a
    // service sees accurate counts on both tabs without a second round trip.
    Promise.allSettled([loadServices(), loadOrders()]).finally(() => setLoading(false));
  }, [user, navigate, loadServices, loadOrders]);

  const switchTab = (id) => {
    setActiveTab(id);
    const next = new URLSearchParams(searchParams);
    if (id === 'orders') next.set('tab', 'orders'); else next.delete('tab');
    setSearchParams(next, { replace: true });
  };

  /**
   * Pay for a booking that already exists.
   *
   * Deliberately reuses the booking rather than creating one: the row, its
   * server-resolved prices and its slot are already there, and POST
   * /services/:id/payment re-derives the amount from that row, so nothing the
   * browser sends can change what is charged.
   *
   * Everything mirrors CheckoutModal's payment step, including reporting a
   * cancellation or failure back so the slot stops being held.
   */
  const handleCompletePayment = async (booking) => {
    if (payingId) return;                       // guard against a double tap
    setPayingId(booking._id);

    try {
      const { data: pay } = await createServicePayment(booking._id);

      const ok = await loadRazorpay();
      if (!ok) throw new Error('Could not load the payment gateway. Check your connection and retry.');

      const key = pay.key || import.meta.env.VITE_RAZORPAY_KEY_ID;
      if (!key) throw new Error('Payment is not configured. Please contact support.');

      await new Promise((resolve) => {
        const rzp = new window.Razorpay({
          key,
          amount: pay.order.amount,
          currency: pay.order.currency || 'INR',
          name: 'GK Motors',
          description: bookingTitle(booking).slice(0, 240),
          order_id: pay.order.id,
          prefill: { name: user?.name || '', email: user?.email || '', contact: user?.phone || '' },
          theme: { color: '#1E3A8A' },
          modal: {
            ondismiss: () => {
              setPayingId('');
              reportServicePaymentFailed(booking._id, {
                cancelled: true,
                reason: 'Customer closed the payment sheet',
              }).catch((e) => console.error('[MyBookings.reportCancelled]', e?.message));
              resolve();
            },
          },
          handler: async (response) => {
            try {
              await verifyServicePayment(booking._id, {
                razorpay_order_id: response.razorpay_order_id,
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_signature: response.razorpay_signature,
              });
              toast.success('Payment received. Your booking is confirmed.');
              await loadServices();             // pull the now-paid booking back
            } catch (err) {
              toast.error(reportApiError(
                'MyBookings.verifyServicePayment', err,
                'We could not confirm your payment. If you were charged, contact support.'
              ));
            } finally {
              setPayingId('');
              resolve();
            }
          },
        });
        rzp.on('payment.failed', (resp) => {
          console.error('[MyBookings.payment.failed]', resp?.error);
          toast.error(resp?.error?.description || 'Payment failed. Please try again.');
          setPayingId('');
          reportServicePaymentFailed(booking._id, {
            reason: resp?.error?.description || 'Payment failed',
          }).catch((e) => console.error('[MyBookings.reportFailed]', e?.message));
          resolve();
        });
        rzp.open();
      });
    } catch (err) {
      // 409 means the slot was released after the payment hold expired and
      // has since gone to someone else. Refresh so the customer sees why.
      toast.error(err.response
        ? reportApiError('MyBookings.completePayment', err, 'Could not start the payment.')
        : err.message);
      if (err.response?.status === 409) loadServices();
      setPayingId('');
    }
  };

  const handleCancelOrder = async (order) => {
    if (!window.confirm('Cancel this order? Any reserved stock is released.')) return;
    setCancelling(order._id);
    try {
      const { data } = await cancelMyOrder(order._id);
      setOrders((prev) => prev.map((o) => (o._id === order._id ? data.order : o)));
      toast.success('Order cancelled');
    } catch (err) {
      toast.error(err.response?.data?.message || 'We could not cancel this order');
    } finally {
      setCancelling('');
    }
  };

  if (loading) return <PageLoader />;

  const tabs = [
    { id: 'services', label: 'Services', count: services.length, icon: Wrench },
    { id: 'orders', label: 'Parts Orders', count: orders.length, icon: ShoppingBag },
  ];

  return (
    <div style={{ flex: '1 0 auto', width: '100%', background: '#FFFFFF' }}>
      <style>{DASHBOARD_STYLES}</style>

      <header className="gk-dash-head">
        <div className="gk-dash-wrap">
          <h1 className="gk-dash-title">MY <span style={{ color: '#1E3A8A' }}>DASHBOARD</span></h1>
          <p className="gk-dash-sub">Your service bookings and spare-parts orders in one place.</p>

          <div className="gk-dash-tabs" role="tablist">
            {tabs.map(({ id, label, count, icon: Icon }) => (
              <button
                key={id}
                role="tab"
                aria-selected={activeTab === id}
                onClick={() => switchTab(id)}
                className={`gk-dash-tab${activeTab === id ? ' is-active' : ''}`}
              >
                <Icon size={15} />
                <span className="gk-dash-tab-label">{label}</span>
                <span className="gk-dash-tab-count">{count}</span>
              </button>
            ))}
          </div>
        </div>
      </header>

      <div className="gk-dash-wrap gk-dash-body">
        {/* ── SERVICE BOOKINGS ── */}
        {activeTab === 'services' && (
          <div className="animate-fadeInUp">
            {serviceError && <ErrorState message={serviceError} onRetry={loadServices} />}

            {!serviceError && services.length === 0 ? (
              <EmptyState
                icon={Wrench}
                title="No service bookings yet"
                body="Book a periodic service, AC repair or detailing and it will show up here with live status."
                cta="Book a service"
                onCta={() => navigate('/services')}
              />
            ) : (
              services.map((booking) => (
                <article key={booking._id} className="gk-dash-card">
                  <div className="gk-dash-card-top">
                    <div className="gk-dash-card-main">
                      <div className="gk-dash-thumb gk-dash-thumb--icon">
                        <Wrench size={19} style={{ color: '#1E3A8A' }} />
                      </div>
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <h3 className="gk-dash-card-title">{bookingTitle(booking)}</h3>
                        <div className="gk-dash-meta">
                          {statusBadge(booking.status)}
                          <span className="gk-dash-meta-item"><Car size={13} /> {bookingCar(booking)}</span>
                        </div>
                        <p className="gk-dash-meta-item" style={{ marginTop: '0.4rem' }}>
                          <Clock size={13} /> {shortDate(booking.scheduledDate)}
                          {booking.scheduledTime ? ` at ${booking.scheduledTime}` : ''}
                        </p>
                        {Array.isArray(booking.services) && booking.services.length > 1 && (
                          <div className="gk-dash-chips">
                            {booking.services.map((s, i) => (
                              <span key={s.serviceType || `${s.name}-${i}`} className="gk-dash-chip">{s.name}</span>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="gk-dash-card-side">
                      {bookingAmount(booking) > 0 && (
                        <div className="gk-dash-amount">
                          <span className="gk-dash-amount-label">Total</span>
                          <span className="gk-dash-amount-value">{money(bookingAmount(booking))}</span>
                        </div>
                      )}
                      <span className={`gk-dash-pay ${booking.payment?.status === 'paid' ? 'is-paid' : ''}${booking.payment?.status === 'failed' ? ' is-failed' : ''}`}>
                        <CreditCard size={12} />
                        {paymentLabel(booking.payment?.status)}
                      </span>

                      {/* An unpaid booking used to be a dead end here: the pill
                          said "Payment pending" and there was no way to act on
                          it. This pays the existing booking — it never creates
                          a second one. */}
                      {isPayable(booking) && (
                        <button
                          onClick={() => handleCompletePayment(booking)}
                          disabled={Boolean(payingId)}
                          className="gk-dash-paynow"
                        >
                          <CreditCard size={13} />
                          {payingId === booking._id ? 'Opening…' : 'Complete Payment'}
                        </button>
                      )}
                    </div>
                  </div>

                  {isPayable(booking) && (
                    <p className="gk-dash-paynote">
                      Your slot is only held for a short time while payment is pending — complete it to secure this booking.
                    </p>
                  )}

                  {booking.status !== 'cancelled' && (
                    <Timeline steps={SERVICE_STEPS} current={booking.status} />
                  )}
                </article>
              ))
            )}
          </div>
        )}

        {/* ── PARTS ORDERS ── */}
        {activeTab === 'orders' && (
          <div className="animate-fadeInUp">
            {orderError && <ErrorState message={orderError} onRetry={loadOrders} />}

            {!orderError && orders.length === 0 ? (
              <EmptyState
                icon={Package}
                title="No parts orders yet"
                body="Genuine spares and accessories you order will appear here with their delivery status."
                cta="Shop car essentials"
                onCta={() => navigate('/parts')}
              />
            ) : (
              orders.map((order) => {
                const items = Array.isArray(order.items) ? order.items : [];
                const units = items.reduce((n, i) => n + (Number(i.quantity) || 0), 0);
                const paid = order.payment?.status === 'paid';
                const canCancel = ['placed', 'confirmed'].includes(order.status) && !paid;
                return (
                  <article key={order._id} className="gk-dash-card">
                    <div className="gk-dash-order-head">
                      <div className="gk-dash-meta">
                        <span className="gk-dash-orderid">#{String(order._id).slice(-8).toUpperCase()}</span>
                        {statusBadge(order.status)}
                        <span className={`gk-dash-pay ${paid ? 'is-paid' : ''}`}>
                          <CreditCard size={12} /> {paid ? 'Paid online' : 'Payment pending'}
                        </span>
                      </div>
                      <div className="gk-dash-order-total">
                        <span className="gk-dash-amount-label">{units} item{units === 1 ? '' : 's'}</span>
                        <span className="gk-dash-amount-value">{money(order.total)}</span>
                      </div>
                    </div>

                    <p className="gk-dash-meta-item" style={{ margin: '0 0 0.9rem' }}>
                      <Clock size={13} /> Ordered {shortDate(order.createdAt)}
                    </p>

                    {items.length === 0 ? (
                      <p className="gk-dash-note">This order has no line items recorded.</p>
                    ) : (
                      <ul className="gk-dash-items">
                        {items.map((item, idx) => {
                          const productId = item.product?._id || item.product;
                          const image = item.image || item.product?.images?.[0] || PART_PLACEHOLDER;
                          const row = (
                            <>
                              <img
                                className="gk-dash-item-img"
                                src={image}
                                alt=""
                                loading="lazy"
                                onError={(e) => {
                                  if (!e.currentTarget.src.endsWith(PART_PLACEHOLDER)) {
                                    e.currentTarget.src = PART_PLACEHOLDER;
                                  }
                                }}
                              />
                              <span className="gk-dash-item-text">
                                <span className="gk-dash-item-name">{item.name || item.product?.name || 'Product'}</span>
                                <span className="gk-dash-item-sub">
                                  Qty: {item.quantity} · {money(item.price)} each
                                </span>
                              </span>
                              <span className="gk-dash-item-total">{money((Number(item.price) || 0) * (Number(item.quantity) || 0))}</span>
                            </>
                          );
                          return (
                            <li key={item._id || `${productId}-${idx}`} className="gk-dash-item">
                              {/* A deleted product has no live page to link to. */}
                              {productId && item.product?.isActive !== false ? (
                                <Link to={`/parts/${productId}`} className="gk-dash-item-link">{row}</Link>
                              ) : (
                                <span className="gk-dash-item-link">{row}</span>
                              )}
                            </li>
                          );
                        })}
                      </ul>
                    )}

                    {order.status !== 'cancelled' && (
                      <Timeline steps={ORDER_STEPS} current={order.status} />
                    )}

                    <div className="gk-dash-actions">
                      <Link to={`/orders/${order._id}`} className="gk-dash-btn is-primary">
                        View Order <ArrowRight size={14} />
                      </Link>
                      {canCancel && (
                        <button
                          className="gk-dash-btn"
                          disabled={cancelling === order._id}
                          onClick={() => handleCancelOrder(order)}
                        >
                          {cancelling === order._id ? 'Cancelling…' : 'Cancel order'}
                        </button>
                      )}
                    </div>
                  </article>
                );
              })
            )}
          </div>
        )}
      </div>
    </div>
  );
}

/* Layout lives in one stylesheet rather than per-element inline objects so the
   same card can be restyled at each breakpoint — inline styles cannot carry a
   media query, which is what left this page wide on small screens. */
const DASHBOARD_STYLES = `
  .gk-dash-wrap { width: 100%; max-width: 960px; margin: 0 auto; padding: 0 1rem; }
  .gk-dash-head { background: #F8FAFC; border-bottom: 1px solid #E2E8F0; padding: 2.25rem 0 0; }
  .gk-dash-title { font-family: Rajdhani, sans-serif; font-size: clamp(1.6rem, 6vw, 2.6rem); font-weight: 900; color: #0F172A; letter-spacing: 0.02em; margin: 0; line-height: 1.1; }
  .gk-dash-sub { color: #64748B; margin: 0.4rem 0 0; font-weight: 600; font-size: 0.9rem; }
  .gk-dash-body { padding: 1.75rem 1rem 3.5rem; }

  .gk-dash-tabs { display: flex; gap: 0.5rem; margin-top: 1.4rem; }
  .gk-dash-tab {
    display: inline-flex; align-items: center; gap: 0.45rem; min-height: 44px;
    padding: 0.6rem 1rem; border-radius: 12px 12px 0 0; cursor: pointer;
    border: 1px solid #E2E8F0; border-bottom: none; background: #FFFFFF;
    color: #64748B; font-weight: 800; font-size: 0.85rem;
    font-family: Rajdhani, sans-serif; letter-spacing: 0.03em;
    transition: color .2s, background .2s, border-color .2s;
    flex: 1 1 0; min-width: 0; justify-content: center;
  }
  .gk-dash-tab.is-active { color: #1E3A8A; border-color: #BFD4F7; box-shadow: inset 0 3px 0 #1E3A8A; }
  .gk-dash-tab-label { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .gk-dash-tab-count {
    display: inline-flex; align-items: center; justify-content: center;
    min-width: 22px; height: 20px; padding: 0 6px; border-radius: 999px;
    background: #EFF6FF; color: #1E3A8A; font-size: 0.72rem; font-weight: 900; flex-shrink: 0;
  }
  .gk-dash-tab.is-active .gk-dash-tab-count { background: #1E3A8A; color: #FFFFFF; }

  .gk-dash-card {
    background: #FFFFFF; border: 1px solid #E7EDF7; border-radius: 16px;
    padding: 1.15rem; margin-bottom: 1rem; box-shadow: 0 4px 18px rgba(15,23,42,0.04);
  }
  .gk-dash-card-top { display: flex; gap: 1rem; align-items: flex-start; justify-content: space-between; flex-wrap: wrap; }
  .gk-dash-card-main { display: flex; gap: 0.85rem; align-items: flex-start; flex: 1 1 260px; min-width: 0; }
  .gk-dash-card-side { display: flex; flex-direction: column; align-items: flex-end; gap: 0.5rem; flex-shrink: 0; }
  .gk-dash-card-title {
    font-family: Rajdhani, sans-serif; font-weight: 900; font-size: 1.1rem; color: #0F172A;
    margin: 0 0 0.35rem; line-height: 1.25; overflow-wrap: anywhere;
  }
  .gk-dash-thumb { width: 42px; height: 42px; border-radius: 11px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; overflow: hidden; }
  .gk-dash-thumb--icon { background: #EFF6FF; border: 1px solid #DBE7FB; }

  .gk-dash-meta { display: flex; align-items: center; gap: 0.5rem; flex-wrap: wrap; }
  .gk-dash-meta-item { display: inline-flex; align-items: center; gap: 0.35rem; color: #64748B; font-size: 0.8rem; font-weight: 600; overflow-wrap: anywhere; }
  .gk-dash-chips { display: flex; flex-wrap: wrap; gap: 0.35rem; margin-top: 0.6rem; }
  .gk-dash-chip { background: #F8FAFC; border: 1px solid #E2E8F0; border-radius: 8px; padding: 0.18rem 0.5rem; font-size: 0.72rem; font-weight: 700; color: #475569; }

  .gk-dash-amount { text-align: right; }
  .gk-dash-amount-label { display: block; color: #94A3B8; font-size: 0.68rem; font-weight: 800; text-transform: uppercase; letter-spacing: 0.08em; }
  .gk-dash-amount-value { font-family: Rajdhani, sans-serif; font-size: 1.35rem; font-weight: 900; color: #0F172A; white-space: nowrap; }
  .gk-dash-pay { display: inline-flex; align-items: center; gap: 0.3rem; font-size: 0.7rem; font-weight: 800; padding: 0.22rem 0.55rem; border-radius: 999px; background: #FFF7ED; color: #C2410C; white-space: nowrap; }
  .gk-dash-pay.is-paid { background: #ECFDF5; color: #047857; }
  .gk-dash-pay.is-failed { background: #FEF2F2; color: #B91C1C; }
  .gk-dash-paynow {
    display: inline-flex; align-items: center; justify-content: center; gap: 0.4rem;
    background: linear-gradient(135deg, #1E3A8A 0%, #0F172A 100%); color: #FFF;
    border: none; border-radius: 9px; padding: 0.5rem 0.9rem; min-height: 38px;
    font-family: Rajdhani, sans-serif; font-weight: 900; font-size: 0.78rem;
    letter-spacing: 0.06em; text-transform: uppercase; cursor: pointer; white-space: nowrap;
  }
  .gk-dash-paynow:disabled { background: #E2E8F0; color: #94A3B8; cursor: not-allowed; }
  .gk-dash-paynote {
    margin: 0.7rem 0 0; color: #B45309; background: #FFFBEB;
    border: 1px solid #FCD34D; border-radius: 9px; padding: 0.5rem 0.7rem;
    font-size: 0.74rem; font-weight: 600; line-height: 1.5;
  }

  .gk-dash-order-head { display: flex; gap: 0.75rem; align-items: flex-start; justify-content: space-between; flex-wrap: wrap; margin-bottom: 0.5rem; }
  .gk-dash-order-total { text-align: right; margin-left: auto; }
  .gk-dash-orderid { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 0.72rem; font-weight: 800; color: #0F172A; background: #F1F5F9; border-radius: 7px; padding: 0.25rem 0.5rem; }

  .gk-dash-items { list-style: none; margin: 0 0 1rem; padding: 0; border: 1px solid #EEF2F8; border-radius: 12px; overflow: hidden; }
  .gk-dash-item + .gk-dash-item { border-top: 1px solid #EEF2F8; }
  .gk-dash-item-link { display: flex; align-items: center; gap: 0.75rem; padding: 0.7rem 0.8rem; text-decoration: none; color: inherit; }
  a.gk-dash-item-link:hover { background: #F8FAFC; }
  .gk-dash-item-img { width: 46px; height: 46px; border-radius: 9px; object-fit: contain; background: #F8FAFC; border: 1px solid #EEF2F8; flex-shrink: 0; }
  .gk-dash-item-text { display: flex; flex-direction: column; gap: 0.15rem; min-width: 0; flex: 1; }
  .gk-dash-item-name { font-weight: 800; font-size: 0.86rem; color: #0F172A; overflow-wrap: anywhere; }
  .gk-dash-item-sub { color: #64748B; font-size: 0.75rem; font-weight: 600; }
  .gk-dash-item-total { font-family: Rajdhani, sans-serif; font-weight: 900; font-size: 0.95rem; color: #0F172A; white-space: nowrap; flex-shrink: 0; }
  .gk-dash-note { color: #94A3B8; font-size: 0.82rem; font-weight: 600; margin: 0 0 1rem; }

  .gk-dash-timeline { display: flex; margin-top: 1rem; padding-top: 1rem; border-top: 1px solid #F1F5F9; }
  .gk-dash-step { flex: 1; display: flex; flex-direction: column; align-items: center; min-width: 0; }
  .gk-dash-rail { flex: 1; height: 3px; border-radius: 2px; }
  .gk-dash-dot { width: 22px; height: 22px; border-radius: 50%; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
  .gk-dash-pip { width: 7px; height: 7px; border-radius: 50%; background: #CBD5E1; }
  .gk-dash-step-label { font-size: 0.68rem; margin-top: 0.4rem; font-weight: 800; text-transform: capitalize; font-family: Rajdhani, sans-serif; text-align: center; overflow-wrap: anywhere; }

  .gk-dash-actions { display: flex; gap: 0.6rem; flex-wrap: wrap; margin-top: 1rem; }
  .gk-dash-btn {
    display: inline-flex; align-items: center; justify-content: center; gap: 0.4rem;
    min-height: 42px; padding: 0 1.1rem; border-radius: 10px; cursor: pointer;
    border: 1.5px solid #E2E8F0; background: #FFFFFF; color: #475569;
    font-weight: 800; font-size: 0.82rem; text-decoration: none; transition: all .2s;
  }
  .gk-dash-btn:hover { border-color: #CBD5E1; color: #0F172A; }
  .gk-dash-btn.is-primary { background: #1E3A8A; border-color: #1E3A8A; color: #FFFFFF; }
  .gk-dash-btn.is-primary:hover { background: #17306F; color: #FFFFFF; }
  .gk-dash-btn:disabled { opacity: 0.6; cursor: not-allowed; }

  .gk-dash-empty { text-align: center; padding: 3rem 1.25rem; background: #F8FAFC; border: 1.5px dashed #DCE5F2; border-radius: 18px; }
  .gk-dash-empty-icon { width: 66px; height: 66px; border-radius: 50%; background: #FFFFFF; border: 1px solid #E2E8F0; display: flex; align-items: center; justify-content: center; margin: 0 auto 1rem; }
  .gk-dash-empty-title { font-family: Rajdhani, sans-serif; font-size: 1.15rem; font-weight: 900; color: #0F172A; margin: 0 0 0.4rem; }
  .gk-dash-empty-body { color: #64748B; font-size: 0.88rem; font-weight: 500; max-width: 380px; margin: 0 auto 1.5rem; line-height: 1.6; }
  .gk-dash-cta {
    display: inline-flex; align-items: center; gap: 0.45rem; min-height: 44px;
    padding: 0 1.5rem; border-radius: 11px; border: none; cursor: pointer;
    background: #1E3A8A; color: #FFFFFF; font-weight: 800; font-size: 0.85rem;
  }

  .gk-dash-error {
    display: flex; align-items: center; gap: 0.6rem; flex-wrap: wrap;
    background: #FEF2F2; border: 1.5px solid #FECACA; border-radius: 12px;
    padding: 0.85rem 1rem; margin-bottom: 1.25rem;
    color: #991B1B; font-size: 0.82rem; font-weight: 600;
  }
  .gk-dash-retry { display: inline-flex; align-items: center; gap: 0.35rem; background: #EF4444; color: #FFF; border: none; border-radius: 8px; padding: 0.45rem 0.9rem; font-weight: 800; font-size: 0.78rem; cursor: pointer; }

  @media (max-width: 560px) {
    .gk-dash-card { padding: 0.95rem; border-radius: 14px; }
    .gk-dash-card-side { align-items: flex-start; flex-direction: row; width: 100%; justify-content: space-between; align-self: stretch; }
    .gk-dash-amount { text-align: left; }
    .gk-dash-order-total { text-align: left; margin-left: 0; }
    .gk-dash-order-head { flex-direction: column; gap: 0.6rem; }
    .gk-dash-tab { padding: 0.55rem 0.6rem; font-size: 0.78rem; gap: 0.3rem; }
    .gk-dash-step-label { font-size: 0.6rem; }
    .gk-dash-item-img { width: 40px; height: 40px; }
    .gk-dash-actions .gk-dash-btn { flex: 1 1 100%; }
  }
  @media (max-width: 380px) {
    .gk-dash-tab { padding: 0.5rem 0.4rem; font-size: 0.72rem; }
    .gk-dash-tab svg { display: none; }
  }
`;
