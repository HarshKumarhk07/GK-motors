import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { getMyBookings } from '../api/serviceApi';
import { getMySellRequests, getMyOrders } from '../api/storeApi';
import { getMyEnquiries } from '../api/bikeApi';
import { getMyRentalBookings, cancelMyRentalBooking, createRentalBalanceOrder, verifyRentalBalancePayment } from '../api/rentalApi';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { PageLoader } from '../components/common/LoadingSpinner';
import { Wrench, TrendingUp, ShoppingBag, Clock, CheckCircle, XCircle, Loader, MessageSquare, Car, Calendar, MapPin } from 'lucide-react';

const statusBadge = (status) => {
  const map = {
    requested: 'badge-orange', accepted: 'badge-blue', in_progress: 'badge-blue',
    completed: 'badge-green', cancelled: 'badge-red', active: 'badge-blue',
    pending: 'badge-orange', under_review: 'badge-blue', approved: 'badge-green',
    rejected: 'badge-red', placed: 'badge-blue', confirmed: 'badge-blue',
    shipped: 'badge-orange', delivered: 'badge-green',
  };
  return <span className={`badge ${map[status] || 'badge-gray'}`}>{status?.replace(/_/g, ' ')}</span>;
};

export default function MyBookings() {
  const { user } = useAuth();
  const navigate = useNavigate();
  // [GK MOTORS] Only the services tab is live; marketplace tabs are disabled.
  const [activeTab, setActiveTab] = useState('services');
  const [services, setServices] = useState([]);
  const [sells, setSells] = useState([]);
  const [orders, setOrders] = useState([]);
  const [enquiries, setEnquiries] = useState([]);
  const [rentals, setRentals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expandedRental, setExpandedRental] = useState(null);

  useEffect(() => {
    if (!user) { navigate('/login'); return; }
    // [GK MOTORS] Marketplace fetches disabled. Restore the full list to bring the
    // sells / orders / enquiries / rentals tabs back to life:
    // Promise.allSettled([getMyBookings(), getMySellRequests(), getMyOrders(), getMyEnquiries(), getMyRentalBookings()])
    Promise.allSettled([getMyBookings()])
      .then((results) => {
        if (results[0].status === 'fulfilled') setServices(results[0].value.data.bookings);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const handleCancelRental = async (id) => {
    if (!window.confirm('Cancel this rental booking?')) return;
    try {
      await cancelMyRentalBooking(id);
      setRentals(rentals.map(r => r._id === id ? { ...r, status: 'cancelled' } : r));
      toast.success('Rental cancelled');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to cancel');
    }
  };

  const handlePayBalance = async (booking) => {
    try {
      const { data: { order, key } } = await createRentalBalanceOrder(booking._id);
      const options = {
        key,
        amount: order.amount,
        currency: order.currency,
        name: 'GK Motors',
        description: `Balance Payment for ${booking.carSnapshot?.brand} ${booking.carSnapshot?.model}`,
        order_id: order.id,
        handler: async (response) => {
          try {
            const { data } = await verifyRentalBalancePayment(booking._id, response);
            setRentals(prev => prev.map(r => r._id === booking._id ? data.booking : r));
            toast.success('Balance paid successfully!');
          } catch (err) {
            toast.error(err.response?.data?.message || 'Verification failed');
          }
        },
        prefill: {
          name: user.name,
          email: user.email,
          contact: booking.contactPhone || user.phone,
        },
        theme: { color: '#1E3A8A' },
      };
      const rzp = new window.Razorpay(options);
      rzp.open();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to initialize payment');
    }
  };

  if (loading) return <PageLoader />;

  const tabs = [
    { id: 'services', label: `Services (${services.length})`, icon: Wrench },
    /* [GK MOTORS TRANSFORM] Marketplace tabs disabled. The render blocks for these
       ids still exist below and go live again the moment they are re-listed here.
    { id: 'rentals', label: `Rentals (${rentals.length})`, icon: Car },
    { id: 'enquiries', label: `Buy Requests (${enquiries.length})`, icon: MessageSquare },
    { id: 'sells', label: `Sell Requests (${sells.length})`, icon: TrendingUp },
    { id: 'orders', label: `Orders (${orders.length})`, icon: ShoppingBag },
    */
  ];

  return (
    <div style={{ minHeight: '100vh', background: '#FFFFFF' }}>
      <div style={{ background: '#F9F9F9', borderBottom: '1px solid #EEE', padding: '2.5rem 0' }}>
        <div className="max-w-4xl mx-auto px-4">
          <h1 style={{ fontFamily: 'Rajdhani, sans-serif', fontSize: '2.8rem', fontWeight: 950, color: '#0F172A', letterSpacing: '0.02em' }}>
            MY <span style={{ color: '#1E3A8A' }}>DASHBOARD</span>
          </h1>
          <p style={{ color: '#64748B', marginTop: '0.6rem', fontWeight: 600, fontSize: '1.1rem' }}>Track your premium services, showroom requests, and orders</p>
 
          <div style={{ display: 'flex', gap: '0.6rem', marginTop: '1.8rem', overflowX: 'auto', paddingBottom: '5px' }} className="hide-scrollbar">
            {tabs.map(({ id, label, icon: Icon }) => (
              <button key={id} onClick={() => setActiveTab(id)}
                style={{
                  display: 'flex', alignItems: 'center', gap: '0.6rem',
                  padding: '0.8rem 1.6rem', borderRadius: '14px', border: '2px solid',
                  borderColor: activeTab === id ? '#1E3A8A' : '#E2E8F0',
                  background: activeTab === id ? '#EFF6FF' : '#F8FAFC',
                  color: activeTab === id ? '#1E3A8A' : '#64748B',
                  cursor: 'pointer', fontSize: '0.95rem', fontWeight: 900, transition: 'all 0.3s',
                  whiteSpace: 'nowrap',
                  boxShadow: activeTab === id ? '0 10px 25px rgba(30, 58, 138, 0.15)' : 'none',
                  fontFamily: 'Rajdhani, sans-serif', letterSpacing: '0.05em'
                }}>
                <Icon size={16} /> {label}
              </button>
            ))}
          </div>
        </div>
      </div>
 
      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* SERVICE BOOKINGS */}
        {activeTab === 'services' && (
          <div className="animate-fadeInUp">
            {services.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '5rem 2rem', background: '#F9F9F9', borderRadius: '24px', border: '1.5px dashed #EEE' }}>
                <div style={{ background: '#FFF', width: 80, height: 80, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1.5rem', boxShadow: '0 10px 30px rgba(0,0,0,0.04)' }}>
                  <Wrench size={40} style={{ color: '#CCC' }} />
                </div>
                <p style={{ color: '#888', fontSize: '1.1rem', fontWeight: 500, marginBottom: '2rem' }}>No service bookings yet</p>
                <button onClick={() => navigate('/services')} className="btn-primary" style={{ padding: '0.8rem 2.5rem', fontWeight: 700 }}>Book a Service</button>
              </div>
            ) : services.map((booking) => (
              <div key={booking._id} style={{ background: '#FFF', border: '1px solid #EEE', borderRadius: '20px', padding: '1.8rem', marginBottom: '1.5rem', boxShadow: '0 4px 20px rgba(0,0,0,0.02)', transition: 'all 0.3s' }}
                onMouseEnter={e => e.currentTarget.style.borderColor = '#111'}
                onMouseLeave={e => e.currentTarget.style.borderColor = '#EEE'}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
                  <div style={{ flex: 1, minWidth: '250px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '0.8rem' }}>
                      <div style={{ background: '#F8FAFC', width: 44, height: 44, borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 8px 20px rgba(30, 58, 138, 0.15)', border: '1.5px solid rgba(30, 58, 138, 0.2)' }}>
                        <Wrench size={20} style={{ color: '#1E3A8A' }} />
                      </div>
                      <div>
                        <h3 style={{ color: '#111', fontWeight: 900, fontFamily: 'Rajdhani, sans-serif', fontSize: '1.25rem', lineHeight: 1 }}>{booking.serviceLabel}</h3>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.4rem' }}>
                          {statusBadge(booking.status)}
                        </div>
                      </div>
                    </div>
                    <p style={{ color: '#555', fontSize: '0.95rem', fontWeight: 600 }}>
                      {booking.bikeBrand} {booking.bikeModel}
                    </p>
                    <p style={{ color: '#888', fontSize: '0.88rem', marginTop: '0.3rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                      <Clock size={14} /> {new Date(booking.scheduledDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })} at {booking.scheduledTime}
                    </p>
                  </div>
                  <div style={{ textAlign: 'right', display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '0.5rem' }}>
                    {booking.estimatedCost && (
                      <div style={{ background: '#EFF6FF', padding: '0.8rem 1.2rem', borderRadius: '14px', border: '1px solid rgba(30, 58, 138, 0.1)' }}>
                        <div style={{ color: '#1E3A8A', fontSize: '0.75rem', fontWeight: 950, letterSpacing: '0.06em', textTransform: 'uppercase', fontFamily: 'Rajdhani, sans-serif' }}>ESTIMATED COST</div>
                        <div style={{ fontFamily: 'Rajdhani, sans-serif', fontSize: '1.6rem', fontWeight: 950, color: '#0F172A' }}>₹{booking.estimatedCost?.toLocaleString('en-IN')}</div>
                      </div>
                    )}
                    {booking.payment && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: booking.payment.status === 'paid' ? '#2E7D32' : '#FB8C00', fontWeight: 800, fontSize: '0.8rem', padding: '0.2rem 0.6rem', background: booking.payment.status === 'paid' ? 'rgba(46,125,50,0.06)' : 'rgba(251,140,0,0.06)', borderRadius: '999px' }}>
                        {booking.payment.status === 'paid' ? '✓ ADVANCE PAID' : 'PENDING PAYMENT'}
                      </div>
                    )}
                  </div>
                </div>
 
                {/* Status Timeline */}
                <div style={{ marginTop: '1.5rem', paddingTop: '1.5rem', borderTop: '1px solid #F5F5F5' }}>
                  <div style={{ display: 'flex', gap: '0' }}>
                    {['requested', 'accepted', 'in_progress', 'completed'].map((s, i) => {
                      const statusOrder = ['requested', 'accepted', 'in_progress', 'completed'];
                      const currentIdx = statusOrder.indexOf(booking.status);
                      const stepIdx = statusOrder.indexOf(s);
                      const isComplete = stepIdx <= currentIdx;
                      return (
                        <div key={s} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                          <div style={{ display: 'flex', alignItems: 'center', width: '100%' }}>
                            {i > 0 && <div style={{ flex: 1, height: 3, background: isComplete ? '#1E3A8A' : '#F1F5F9' }} />}
                            <div style={{ width: 24, height: 24, borderRadius: '50%', background: isComplete ? '#1E3A8A' : '#F1F5F9', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, boxShadow: isComplete ? '0 6px 15px rgba(30, 58, 138, 0.25)' : 'none' }}>
                              {isComplete ? <CheckCircle size={14} color="white" /> : <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#CCC' }} />}
                            </div>
                            {i < 3 && <div style={{ flex: 1, height: 3, background: stepIdx < currentIdx ? '#1E3A8A' : '#F1F5F9' }} />}
                          </div>
                          <span style={{ color: isComplete ? '#111' : '#AAA', fontSize: '0.75rem', marginTop: '0.5rem', fontWeight: 800, textTransform: 'capitalize', fontFamily: 'Rajdhani, sans-serif', letterSpacing: '0.02em' }}>{s.replace('_', ' ')}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
 
        {/* SELL REQUESTS */}
        {activeTab === 'sells' && (
          <div className="animate-fadeInUp">
            {sells.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '5rem 2rem', background: '#F9F9F9', borderRadius: '24px', border: '1.5px dashed #EEE' }}>
                <div style={{ background: '#FFF', width: 80, height: 80, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1.5rem', boxShadow: '0 10px 30px rgba(0,0,0,0.04)' }}>
                  <TrendingUp size={40} style={{ color: '#CCC' }} />
                </div>
                <p style={{ color: '#888', fontSize: '1.1rem', fontWeight: 500, marginBottom: '2rem' }}>No valuation requests yet</p>
                <button onClick={() => navigate('/sell')} className="btn-primary" style={{ background: '#0F172A', padding: '0.8rem 2.5rem', fontWeight: 900, borderRadius: '14px' }}>Sell a Car</button>
              </div>
            ) : sells.map((req) => (
              <div key={req._id} style={{ background: '#FFF', border: '1px solid #EEE', borderRadius: '20px', padding: '1.8rem', marginBottom: '1.5rem', boxShadow: '0 4px 20px rgba(0,0,0,0.02)', transition: 'all 0.3s' }}
                onMouseEnter={e => e.currentTarget.style.borderColor = '#111'}
                onMouseLeave={e => e.currentTarget.style.borderColor = '#EEE'}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '0.8rem' }}>
                      <div style={{ position: 'relative' }}>
                        {req.images && req.images.length > 0 ? (
                          <img src={req.images[0]} alt={req.model} style={{ width: 80, height: 60, borderRadius: '12px', objectFit: 'cover', border: '1px solid #EEE' }} />
                        ) : (
                          <div style={{ background: 'rgba(46,125,50,0.05)', width: 44, height: 44, borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid rgba(46,125,50,0.1)' }}>
                            <TrendingUp size={20} style={{ color: '#2E7D32' }} />
                          </div>
                        )}
                      </div>
                      <div>
                        <h3 style={{ color: '#111', fontWeight: 900, fontFamily: 'Rajdhani, sans-serif', fontSize: '1.3rem', lineHeight: 1 }}>{req.brand} {req.model}</h3>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.4rem' }}>
                          <span style={{ color: '#666', fontSize: '0.85rem', fontWeight: 600 }}>{req.year} Model</span>
                          {statusBadge(req.status)}
                        </div>
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: '1rem', marginTop: '0.5rem' }}>
                      <div style={{ background: '#F5F5F5', padding: '0.3rem 0.8rem', borderRadius: '8px', fontSize: '0.85rem', color: '#555', fontWeight: 700 }}>Condition: {req.condition}</div>
                      <div style={{ background: '#F5F5F5', padding: '0.3rem 0.8rem', borderRadius: '8px', fontSize: '0.85rem', color: '#555', fontWeight: 700 }}>KMs: {req.kmDriven?.toLocaleString()}</div>
                    </div>
                  </div>
                  <div style={{ textAlign: 'right', display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '0.5rem' }}>
                    {req.offeredPrice ? (
                      <div style={{ background: '#EFF6FF', padding: '0.8rem 1.2rem', borderRadius: '14px', border: '1px solid rgba(30, 58, 138, 0.1)' }}>
                        <div style={{ color: '#1E3A8A', fontSize: '0.75rem', fontWeight: 950, letterSpacing: '0.06em', textTransform: 'uppercase', fontFamily: 'Rajdhani, sans-serif' }}>FINAL OFFER</div>
                        <div style={{ fontFamily: 'Rajdhani, sans-serif', fontSize: '1.8rem', fontWeight: 950, color: '#0F172A' }}>₹{req.offeredPrice?.toLocaleString('en-IN')}</div>
                      </div>
                    ) : req.estimatedPrice && (
                      <div style={{ color: '#1E3A8A', fontWeight: 950, fontFamily: 'Rajdhani, sans-serif', fontSize: '1.4rem', letterSpacing: '0.02em' }}>EST: ₹{req.estimatedPrice?.toLocaleString('en-IN')}</div>
                    )}
                  </div>
                </div>
                {/* Pickup info */}
                {req.pickupAddress && (
                  <div style={{ marginTop: '1.2rem', paddingTop: '1.2rem', borderTop: '1px solid #F5F5F5', display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                    <div style={{ background: 'rgba(30, 58, 138, 0.08)', padding: '0.5rem', borderRadius: '10px' }}>
                      <CheckCircle size={16} style={{ color: '#1E3A8A' }} />
                    </div>
                    <span style={{ color: '#64748B', fontSize: '0.9rem', fontWeight: 700 }}>
                      Inspection Scheduled: {[req.pickupAddress.street, req.pickupAddress.city].filter(Boolean).join(', ')}
                    </span>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
 
        {/* ORDERS */}
        {activeTab === 'orders' && (
          <div className="animate-fadeInUp">
            {orders.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '5rem 2rem', background: '#F9F9F9', borderRadius: '24px', border: '1.5px dashed #EEE' }}>
                <div style={{ background: '#FFF', width: 80, height: 80, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1.5rem', boxShadow: '0 10px 30px rgba(0,0,0,0.04)' }}>
                  <ShoppingBag size={40} style={{ color: '#CCC' }} />
                </div>
                <p style={{ color: '#888', fontSize: '1.1rem', fontWeight: 500, marginBottom: '2rem' }}>No orders yet</p>
                <button onClick={() => navigate('/parts')} className="btn-primary" style={{ background: '#0F172A', padding: '0.8rem 2.5rem', fontWeight: 900, borderRadius: '14px' }}>Browse Genuine Spares</button>
              </div>
            ) : orders.map((order) => (
              <div key={order._id} style={{ background: '#FFF', border: '1px solid #EEE', borderRadius: '20px', padding: '1.8rem', marginBottom: '1.5rem', boxShadow: '0 4px 20px rgba(0,0,0,0.02)', transition: 'all 0.3s' }}
                onMouseEnter={e => e.currentTarget.style.borderColor = '#111'}
                onMouseLeave={e => e.currentTarget.style.borderColor = '#EEE'}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem', marginBottom: '1.2rem' }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.8rem' }}>
                      <div style={{ background: '#F5F5F5', padding: '0.4rem 0.8rem', borderRadius: '8px', fontSize: '0.75rem', fontWeight: 800, color: '#111', fontFamily: 'monospace' }}>#{order._id.slice(-8).toUpperCase()}</div>
                      {statusBadge(order.status)}
                    </div>
                    <p style={{ color: '#888', fontSize: '0.85rem', marginTop: '0.6rem', fontWeight: 600 }}>Ordered: {new Date(order.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })} • Payment: {order.payment.method.toUpperCase()}</p>
                  </div>
                  <div style={{ fontFamily: 'Rajdhani, sans-serif', fontSize: '1.8rem', fontWeight: 900, color: '#111' }}>
                    ₹{order.total?.toLocaleString('en-IN')}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap', marginBottom: '1.5rem' }}>
                  {order.items?.map((item) => (
                    <div key={item._id} style={{ fontSize: '0.8rem', color: '#0F172A', background: '#F8FAFC', padding: '0.4rem 0.8rem', borderRadius: '10px', border: '1px solid #E2E8F0', fontWeight: 800 }}>
                      {item.name} <span style={{ color: '#1E3A8A' }}>×{item.quantity}</span>
                    </div>
                  ))}
                </div>
                {/* Order status timeline */}
                <div style={{ marginTop: '1rem', paddingTop: '1.5rem', borderTop: '1px solid #F5F5F5' }}>
                  <div style={{ display: 'flex', gap: '0' }}>
                    {['placed', 'confirmed', 'shipped', 'delivered'].map((s, i) => {
                      const statusOrder = ['placed', 'confirmed', 'shipped', 'delivered'];
                      const currentIdx = statusOrder.indexOf(order.status);
                      const stepIdx = statusOrder.indexOf(s);
                      const isComplete = stepIdx <= currentIdx;
                      return (
                        <div key={s} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                          <div style={{ display: 'flex', alignItems: 'center', width: '100%' }}>
                            {i > 0 && <div style={{ flex: 1, height: 3, background: isComplete ? '#1E3A8A' : '#F1F5F9' }} />}
                            <div style={{ width: 22, height: 22, borderRadius: '50%', background: isComplete ? '#1E3A8A' : '#F1F5F9', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                              {isComplete ? <CheckCircle size={14} color="white" /> : <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#CBD5E1' }} />}
                            </div>
                            {i < 3 && <div style={{ flex: 1, height: 3, background: stepIdx < currentIdx ? '#1E3A8A' : '#F1F5F9' }} />}
                          </div>
                          <span style={{ color: isComplete ? '#111' : '#AAA', fontSize: '0.72rem', marginTop: '0.4rem', fontWeight: 800, textTransform: 'uppercase', fontFamily: 'Rajdhani, sans-serif' }}>{s}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
        {/* RENTAL BOOKINGS */}
        {activeTab === 'rentals' && (
          <div className="animate-fadeInUp">
            {rentals.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '5rem 2rem', background: '#F9F9F9', borderRadius: '24px', border: '1.5px dashed #EEE' }}>
                <div style={{ background: '#FFF', width: 80, height: 80, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1.5rem', boxShadow: '0 10px 30px rgba(0,0,0,0.04)' }}>
                  <Car size={40} style={{ color: '#CCC' }} />
                </div>
                <p style={{ color: '#888', fontSize: '1.1rem', fontWeight: 500, marginBottom: '2rem' }}>No rental bookings yet</p>
                <button onClick={() => navigate('/rentals')} className="btn-primary" style={{ background: '#1E3A8A', padding: '0.8rem 2.5rem', fontWeight: 900, borderRadius: '14px' }}>Rent a Car</button>
              </div>
            ) : rentals.map((booking) => {
              const isHour = booking.rentalUnit === 'hour';
              const duration = isHour ? `${booking.totalHours} hour(s)` : `${booking.totalDays} day(s)`;
              const unitPrice = isHour ? booking.pricePerHour : booking.pricePerDay;
              const car = booking.rentalCar || {};
              return (
              <div key={booking._id} style={{ background: '#FFF', border: '1px solid #EEE', borderRadius: '24px', padding: '1.8rem', marginBottom: '1.5rem', boxShadow: expandedRental === booking._id ? '0 20px 40px rgba(0,0,0,0.08)' : '0 4px 20px rgba(0,0,0,0.02)', transition: 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)', cursor: 'pointer', overflow: 'hidden', position: 'relative' }}
                onClick={() => setExpandedRental(expandedRental === booking._id ? null : booking._id)}
                onMouseEnter={e => e.currentTarget.style.borderColor = '#1E3A8A'}
                onMouseLeave={e => e.currentTarget.style.borderColor = expandedRental === booking._id ? '#1E3A8A' : '#EEE'}>
                {/* Booking ID strip */}
                <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: '0.6rem', paddingBottom: '0.8rem', borderBottom: '1px dashed #E2E8F0', marginBottom: '1rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap' }}>
                    <span style={{ background: '#0F172A', color: 'white', padding: '0.3rem 0.7rem', borderRadius: '8px', fontSize: '0.72rem', fontWeight: 900, fontFamily: 'monospace', letterSpacing: '0.05em' }}>
                      #{booking._id.slice(-8).toUpperCase()}
                    </span>
                    {statusBadge(booking.status)}
                    <span style={{ background: booking.payment?.status === 'paid' ? '#DCFCE7' : booking.payment?.status === 'refunded' ? '#FEF3C7' : '#FEE2E2', color: booking.payment?.status === 'paid' ? '#16A34A' : booking.payment?.status === 'refunded' ? '#CA8A04' : '#DC2626', padding: '0.25rem 0.7rem', borderRadius: '999px', fontSize: '0.68rem', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                      {(booking.payment?.method || 'cod').toUpperCase()} • {(booking.payment?.status || 'pending').toUpperCase()}
                    </span>
                  </div>
                  <span style={{ color: '#94A3B8', fontSize: '0.72rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                    {expandedRental === booking._id ? 'Click to collapse' : 'Click to view details'}
                    <div style={{ transform: expandedRental === booking._id ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'all 0.3s' }}>▼</div>
                  </span>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
                  <div style={{ flex: 1, minWidth: '250px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '0.8rem' }}>
                      {booking.carSnapshot?.image || car.images?.[0] ? (
                        <img src={booking.carSnapshot?.image || car.images?.[0]} alt="" style={{ width: 80, height: 60, borderRadius: '12px', objectFit: 'cover', border: '1px solid #EEE' }} />
                      ) : (
                        <div style={{ background: '#EFF6FF', width: 80, height: 60, borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1.5px solid rgba(30, 58, 138, 0.15)' }}>
                          <Car size={24} style={{ color: '#1E3A8A' }} />
                        </div>
                      )}
                      <div>
                        <h3 style={{ color: '#111', fontWeight: 900, fontFamily: 'Rajdhani, sans-serif', fontSize: '1.3rem', lineHeight: 1 }}>
                          {booking.carSnapshot?.brand || car.brand} {booking.carSnapshot?.model || car.model}
                        </h3>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.4rem' }}>
                          <span style={{ color: '#666', fontSize: '0.85rem', fontWeight: 600 }}>{booking.carSnapshot?.year || car.year} • {duration}</span>
                          {car.registrationNumber && (
                            <span style={{ background: '#0F172A', color: 'white', padding: '2px 8px', borderRadius: '6px', fontSize: '0.7rem', fontWeight: 800, fontFamily: 'Rajdhani, sans-serif', letterSpacing: '0.05em' }}>{car.registrationNumber}</span>
                          )}
                        </div>
                      </div>
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.6rem', marginTop: '0.8rem' }}>
                      <div style={{ background: '#F5F5F5', padding: '0.3rem 0.8rem', borderRadius: '8px', fontSize: '0.82rem', color: '#555', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                        <Calendar size={13} /> Pickup: {new Date(booking.pickupDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })} • {booking.pickupTime}
                      </div>
                      <div style={{ background: '#F5F5F5', padding: '0.3rem 0.8rem', borderRadius: '8px', fontSize: '0.82rem', color: '#555', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                        <Calendar size={13} /> Return: {new Date(booking.returnDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })} • {booking.returnTime}
                      </div>
                      {car.dropLocation?.city && (
                        <div style={{ background: 'rgba(22, 163, 74, 0.05)', padding: '0.3rem 0.8rem', borderRadius: '8px', fontSize: '0.82rem', color: '#16A34A', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.3rem', border: '1px solid rgba(22, 163, 74, 0.1)' }}>
                          <MapPin size={13} /> Drop: {car.dropLocation.address}, {car.dropLocation.city}
                        </div>
                      )}
                    </div>
                  </div>
                  <div style={{ textAlign: 'right', display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '0.5rem' }}>
                    <div style={{ background: '#EFF6FF', padding: '0.8rem 1.2rem', borderRadius: '14px', border: '1px solid rgba(30, 58, 138, 0.1)' }}>
                      <div style={{ color: '#1E3A8A', fontSize: '0.75rem', fontWeight: 950, letterSpacing: '0.06em', textTransform: 'uppercase', fontFamily: 'Rajdhani, sans-serif' }}>TOTAL</div>
                      <div style={{ fontFamily: 'Rajdhani, sans-serif', fontSize: '1.6rem', fontWeight: 950, color: '#0F172A' }}>₹{booking.totalAmount?.toLocaleString('en-IN')}</div>
                    </div>
                    {['requested', 'confirmed'].includes(booking.status) && (
                      <button onClick={() => handleCancelRental(booking._id)} style={{ background: 'rgba(239, 68, 68, 0.08)', color: '#DC2626', border: 'none', borderRadius: '10px', padding: '0.5rem 1rem', fontWeight: 800, fontSize: '0.78rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                        <XCircle size={13} /> CANCEL
                      </button>
                    )}
                  </div>
                </div>

                {/* Collapsible Content */}
                <div style={{ maxHeight: expandedRental === booking._id ? '2000px' : '0', opacity: expandedRental === booking._id ? 1 : 0, transition: 'all 0.5s cubic-bezier(0.4, 0, 0.2, 1)', visibility: expandedRental === booking._id ? 'visible' : 'hidden' }}>
                  {/* Price + identity breakdown */}
                  <div style={{ marginTop: '1.2rem', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.6rem' }}>
                    <div style={{ background: '#F8FAFC', border: '1px solid #E2E8F0', padding: '0.6rem 0.8rem', borderRadius: '10px' }}>
                      <div style={{ color: '#64748B', fontSize: '0.65rem', fontWeight: 800, letterSpacing: '0.05em', textTransform: 'uppercase' }}>Rate</div>
                      <div style={{ color: '#0F172A', fontWeight: 800, fontSize: '0.9rem', marginTop: '2px' }}>₹{unitPrice?.toLocaleString('en-IN')} / {isHour ? 'hour' : 'day'} × {isHour ? booking.totalHours : booking.totalDays}</div>
                    </div>
                    {booking.securityDeposit > 0 && (
                      <div style={{ background: '#F8FAFC', border: '1px solid #E2E8F0', padding: '0.6rem 0.8rem', borderRadius: '10px' }}>
                        <div style={{ color: '#64748B', fontSize: '0.65rem', fontWeight: 800, letterSpacing: '0.05em', textTransform: 'uppercase' }}>Security Deposit</div>
                        <div style={{ color: '#0F172A', fontWeight: 800, fontSize: '0.9rem', marginTop: '2px' }}>₹{booking.securityDeposit.toLocaleString('en-IN')} <span style={{ fontSize: '0.6rem', color: '#16A34A', fontWeight: 800 }}>REFUNDABLE</span></div>
                      </div>
                    )}
                    <div style={{ background: '#F8FAFC', border: '1px solid #E2E8F0', padding: '0.6rem 0.8rem', borderRadius: '10px' }}>
                      <div style={{ color: '#64748B', fontSize: '0.65rem', fontWeight: 800, letterSpacing: '0.05em', textTransform: 'uppercase' }}>Contact</div>
                      <div style={{ color: '#0F172A', fontWeight: 800, fontSize: '0.85rem', marginTop: '2px', display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                        <span>👤 {booking.fullName || user.name}</span>
                        <span>📞 {booking.contactPhone || '-'}</span>
                      </div>
                    </div>
                    {booking.payment?.razorpayPaymentId && (
                  <div style={{ background: '#F8FAFC', border: '1px solid #E2E8F0', padding: '0.6rem 0.8rem', borderRadius: '10px' }}>
                        <div style={{ color: '#64748B', fontSize: '0.65rem', fontWeight: 800, letterSpacing: '0.05em', textTransform: 'uppercase' }}>Payment ID</div>
                        <div style={{ color: '#0F172A', fontWeight: 700, fontSize: '0.78rem', marginTop: '2px', fontFamily: 'monospace', wordBreak: 'break-all' }}>{booking.payment.razorpayPaymentId}</div>
                      </div>
                    )}
                    <div style={{ background: (booking.payment?.balanceDue > 0 || booking.payment?.status === 'pending') ? '#FFF7ED' : '#F0FDF4', border: (booking.payment?.balanceDue > 0 || booking.payment?.status === 'pending') ? '1px solid #FFEDD5' : '1px solid #DCFCE7', padding: '0.6rem 0.8rem', borderRadius: '10px' }}>
                      <div style={{ color: (booking.payment?.balanceDue > 0 || booking.payment?.status === 'pending') ? '#C2410C' : '#16A34A', fontSize: '0.65rem', fontWeight: 800, letterSpacing: '0.05em', textTransform: 'uppercase' }}>Payment Status</div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.8rem', marginTop: '2px' }}>
                        <div style={{ color: '#0F172A', fontWeight: 800, fontSize: '0.85rem' }}>
                          {booking.payment?.balanceDue > 0 ? `Balance: ₹${booking.payment.balanceDue.toLocaleString('en-IN')}` : booking.payment?.status === 'paid' ? 'FULLY PAID' : 'PENDING'}
                        </div>
                        {booking.payment?.balanceDue > 0 && (
                          <button onClick={(e) => { e.stopPropagation(); handlePayBalance(booking); }} 
                            style={{ background: '#1E3A8A', color: 'white', border: 'none', borderRadius: '6px', padding: '0.3rem 0.6rem', fontSize: '0.65rem', fontWeight: 900, cursor: 'pointer', fontFamily: 'Rajdhani, sans-serif', textTransform: 'uppercase' }}>
                            PAY NOW
                          </button>
                        )}
                      </div>
                    </div>
                  </div>

                  {booking.notes && (
                    <div style={{ marginTop: '1rem', background: '#FFFBEB', border: '1px solid #FDE68A', padding: '0.6rem 0.9rem', borderRadius: '10px', fontSize: '0.85rem', color: '#92400E', fontWeight: 600 }}>
                      <strong>Note:</strong> {booking.notes}
                    </div>
                  )}

                  {/* Car Specifications */}
                  <div style={{ marginTop: '1.2rem', paddingTop: '1.2rem', borderTop: '1px solid #F5F5F5' }}>
                    <h4 style={{ color: '#0F172A', fontWeight: 900, fontFamily: 'Rajdhani, sans-serif', fontSize: '0.95rem', marginBottom: '0.6rem', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Car Specifications</h4>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '0.5rem' }}>
                      {[
                        ['Transmission', car.transmission?.toUpperCase()],
                        ['Fuel', car.fuelType?.toUpperCase()],
                        ['Seats', car.seats],
                        ['Doors', car.doors],
                        ['Body', car.bodyType?.toUpperCase()],
                        ['Color', car.color],
                        ['Mileage', car.mileage],
                        ['Airbags', car.airbags],
                      ].filter(([, v]) => v != null && v !== '').map(([k, v]) => (
                        <div key={k} style={{ background: '#F8FAFC', border: '1px solid #E2E8F0', padding: '0.5rem 0.7rem', borderRadius: '8px' }}>
                          <div style={{ color: '#64748B', fontSize: '0.6rem', fontWeight: 800, letterSpacing: '0.05em', textTransform: 'uppercase' }}>{k}</div>
                          <div style={{ color: '#0F172A', fontWeight: 800, fontSize: '0.82rem', marginTop: '2px' }}>{v}</div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Pickup & Drop Locations */}
                  {(car.location?.city || car.dropLocation?.city) && (
                    <div style={{ marginTop: '1rem', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.6rem' }}>
                      {car.location?.city && (
                        <div style={{ background: '#EFF6FF', border: '1px solid rgba(30,58,138,0.15)', padding: '0.7rem 0.9rem', borderRadius: '10px' }}>
                          <div style={{ color: '#1E3A8A', fontSize: '0.65rem', fontWeight: 900, letterSpacing: '0.05em', textTransform: 'uppercase', marginBottom: '0.2rem' }}>📍 Pickup</div>
                          <div style={{ color: '#0F172A', fontWeight: 700, fontSize: '0.82rem' }}>{[car.location.address, car.location.city, car.location.state, car.location.pincode].filter(Boolean).join(', ')}</div>
                        </div>
                      )}
                      {car.dropLocation?.city && (
                        <div style={{ background: '#ECFDF5', border: '1px solid rgba(22,163,74,0.2)', padding: '0.7rem 0.9rem', borderRadius: '10px' }}>
                          <div style={{ color: '#16A34A', fontSize: '0.65rem', fontWeight: 900, letterSpacing: '0.05em', textTransform: 'uppercase', marginBottom: '0.2rem' }}>📍 Drop</div>
                          <div style={{ color: '#0F172A', fontWeight: 700, fontSize: '0.82rem' }}>{[car.dropLocation.address, car.dropLocation.city, car.dropLocation.state, car.dropLocation.pincode].filter(Boolean).join(', ')}</div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Timing Details */}
                  <div style={{ marginTop: '1rem', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: '0.5rem' }}>
                    <div style={{ background: '#F8FAFC', border: '1px solid #E2E8F0', padding: '0.55rem 0.8rem', borderRadius: '10px' }}>
                      <div style={{ color: '#64748B', fontSize: '0.62rem', fontWeight: 800, letterSpacing: '0.05em', textTransform: 'uppercase' }}>Booked At</div>
                      <div style={{ color: '#0F172A', fontWeight: 700, fontSize: '0.78rem', marginTop: '2px' }}>{new Date(booking.createdAt).toLocaleString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</div>
                    </div>
                    {booking.statusHistory?.slice().reverse().find(h => h.status === 'active') && (
                      <div style={{ background: '#EFF6FF', border: '1px solid #DBEAFE', padding: '0.55rem 0.8rem', borderRadius: '10px' }}>
                        <div style={{ color: '#1E3A8A', fontSize: '0.62rem', fontWeight: 800, letterSpacing: '0.05em', textTransform: 'uppercase' }}>Actual Pickup</div>
                        <div style={{ color: '#1E3A8A', fontWeight: 700, fontSize: '0.78rem', marginTop: '2px' }}>{new Date(booking.statusHistory.slice().reverse().find(h => h.status === 'active').updatedAt).toLocaleString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</div>
                      </div>
                    )}
                    {booking.statusHistory?.slice().reverse().find(h => h.status === 'completed') && (
                      <div style={{ background: '#F0FDF4', border: '1px solid #DCFCE7', padding: '0.55rem 0.8rem', borderRadius: '10px' }}>
                        <div style={{ color: '#16A34A', fontSize: '0.62rem', fontWeight: 800, letterSpacing: '0.05em', textTransform: 'uppercase' }}>Actual Drop</div>
                        <div style={{ color: '#16A34A', fontWeight: 700, fontSize: '0.78rem', marginTop: '2px' }}>{new Date(booking.statusHistory.slice().reverse().find(h => h.status === 'completed').updatedAt).toLocaleString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</div>
                      </div>
                    )}
                    {booking.payment?.paidAt && (
                      <div style={{ background: '#F8FAFC', border: '1px solid #E2E8F0', padding: '0.55rem 0.8rem', borderRadius: '10px' }}>
                        <div style={{ color: '#64748B', fontSize: '0.62rem', fontWeight: 800, letterSpacing: '0.05em', textTransform: 'uppercase' }}>Paid At</div>
                        <div style={{ color: '#0F172A', fontWeight: 700, fontSize: '0.78rem', marginTop: '2px' }}>{new Date(booking.payment.paidAt).toLocaleString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</div>
                      </div>
                    )}
                  </div>

                  {/* KYC Documents */}
                  {(booking.kyc?.aadharNumber || booking.kyc?.panNumber || booking.kyc?.aadharImage || booking.kyc?.panImage || booking.kyc?.licenseImage) && (
                    <div style={{ marginTop: '1.2rem', paddingTop: '1.2rem', borderTop: '1px solid #F5F5F5' }}>
                      <h4 style={{ color: '#0F172A', fontWeight: 900, fontFamily: 'Rajdhani, sans-serif', fontSize: '0.95rem', marginBottom: '0.6rem', textTransform: 'uppercase', letterSpacing: '0.04em' }}>KYC Documents</h4>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.5rem', marginBottom: '0.7rem' }}>
                        {booking.kyc?.aadharNumber && (
                          <div style={{ background: '#F8FAFC', border: '1px solid #E2E8F0', padding: '0.55rem 0.8rem', borderRadius: '10px' }}>
                            <div style={{ color: '#64748B', fontSize: '0.62rem', fontWeight: 800, letterSpacing: '0.05em', textTransform: 'uppercase' }}>Aadhar No.</div>
                            <div style={{ color: '#0F172A', fontWeight: 800, fontSize: '0.82rem', marginTop: '2px', fontFamily: 'monospace' }}>{booking.kyc.aadharNumber.replace(/(\d{4})(\d{4})(\d{4})/, '$1 $2 $3')}</div>
                          </div>
                        )}
                        {booking.kyc?.panNumber && (
                          <div style={{ background: '#F8FAFC', border: '1px solid #E2E8F0', padding: '0.55rem 0.8rem', borderRadius: '10px' }}>
                            <div style={{ color: '#64748B', fontSize: '0.62rem', fontWeight: 800, letterSpacing: '0.05em', textTransform: 'uppercase' }}>PAN No.</div>
                            <div style={{ color: '#0F172A', fontWeight: 800, fontSize: '0.82rem', marginTop: '2px', fontFamily: 'monospace' }}>{booking.kyc.panNumber}</div>
                          </div>
                        )}
                        {booking.driverLicense && (
                          <div style={{ background: '#F8FAFC', border: '1px solid #E2E8F0', padding: '0.55rem 0.8rem', borderRadius: '10px' }}>
                            <div style={{ color: '#64748B', fontSize: '0.62rem', fontWeight: 800, letterSpacing: '0.05em', textTransform: 'uppercase' }}>Driving License No.</div>
                            <div style={{ color: '#0F172A', fontWeight: 800, fontSize: '0.82rem', marginTop: '2px', fontFamily: 'monospace' }}>{booking.driverLicense}</div>
                          </div>
                        )}
                      </div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                        {[
                          ['Aadhar', booking.kyc?.aadharImage],
                          ['PAN', booking.kyc?.panImage],
                          ['License', booking.kyc?.licenseImage],
                        ].filter(([, url]) => url).map(([label, url]) => (
                          <a key={label} href={url} target="_blank" rel="noopener noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.3rem', textDecoration: 'none' }}>
                            <div style={{ width: 90, height: 65, borderRadius: '8px', overflow: 'hidden', border: '1.5px solid #E2E8F0', background: '#F1F5F9', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                              {/\.pdf$/i.test(url) ? (
                                <span style={{ fontSize: '0.7rem', fontWeight: 800, color: '#475569' }}>PDF</span>
                              ) : (
                                <img src={url} alt={label} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                              )}
                            </div>
                            <span style={{ fontSize: '0.65rem', fontWeight: 800, color: '#475569', letterSpacing: '0.05em', textTransform: 'uppercase' }}>{label}</span>
                          </a>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Status Timeline */}
                  <div style={{ marginTop: '1.5rem', paddingTop: '1.5rem', borderTop: '1px solid #F5F5F5' }}>
                    <div style={{ display: 'flex', gap: '0' }}>
                      {['requested', 'confirmed', 'active', 'completed'].map((s, i) => {
                        const order = ['requested', 'confirmed', 'active', 'completed'];
                        const currentIdx = order.indexOf(booking.status);
                        const stepIdx = order.indexOf(s);
                        const isComplete = stepIdx <= currentIdx;
                        return (
                          <div key={s} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                            <div style={{ display: 'flex', alignItems: 'center', width: '100%' }}>
                              {i > 0 && <div style={{ flex: 1, height: 3, background: isComplete ? '#1E3A8A' : '#F1F5F9' }} />}
                              <div style={{ width: 22, height: 22, borderRadius: '50%', background: isComplete ? '#1E3A8A' : '#F1F5F9', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                {isComplete ? <CheckCircle size={14} color="white" /> : <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#CBD5E1' }} />}
                              </div>
                              {i < 3 && <div style={{ flex: 1, height: 3, background: stepIdx < currentIdx ? '#1E3A8A' : '#F1F5F9' }} />}
                            </div>
                            <span style={{ color: isComplete ? '#111' : '#AAA', fontSize: '0.72rem', marginTop: '0.4rem', fontWeight: 800, textTransform: 'uppercase', fontFamily: 'Rajdhani, sans-serif' }}>{s}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>
              );
            })}
          </div>
        )}

        {/* CAR ENQUIRIES */}
        {activeTab === 'enquiries' && (
          <div className="animate-fadeInUp">
            {enquiries.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '5rem 2rem', background: '#F9F9F9', borderRadius: '24px', border: '1.5px dashed #EEE' }}>
                <div style={{ background: '#FFF', width: 80, height: 80, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1.5rem', boxShadow: '0 10px 30px rgba(0,0,0,0.04)' }}>
                  <MessageSquare size={40} style={{ color: '#CCC' }} />
                </div>
                <p style={{ color: '#888', fontSize: '1.1rem', fontWeight: 500, marginBottom: '2rem' }}>No showroom requests yet</p>
                <button onClick={() => navigate('/bikes')} className="btn-primary" style={{ background: '#0F172A', padding: '0.8rem 2.5rem', fontWeight: 900, borderRadius: '14px' }}>Browse Cars</button>
              </div>
            ) : enquiries.map((enq) => (
              <div key={enq._id} style={{ background: '#FFF', border: '1px solid #EEE', borderRadius: '20px', padding: '1.8rem', marginBottom: '1.5rem', boxShadow: '0 4px 20px rgba(0,0,0,0.02)', transition: 'all 0.3s' }}
                onMouseEnter={e => e.currentTarget.style.borderColor = '#111'}
                onMouseLeave={e => e.currentTarget.style.borderColor = '#EEE'}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '0.8rem' }}>
                      <div style={{ position: 'relative' }}>
                        {enq.bike?.images?.[0] ? (
                          <img src={enq.bike.images[0]} alt={enq.bike.model} style={{ width: 80, height: 60, borderRadius: '12px', objectFit: 'cover', border: '1px solid #EEE' }} />
                        ) : (
                          <div style={{ background: '#EFF6FF', width: 80, height: 60, borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1.5px solid rgba(30, 58, 138, 0.15)' }}>
                            <MessageSquare size={20} style={{ color: '#1E3A8A' }} />
                          </div>
                        )}
                      </div>
                      <div>
                        <h3 style={{ color: '#111', fontWeight: 900, fontFamily: 'Rajdhani, sans-serif', fontSize: '1.3rem', lineHeight: 1 }}>{enq.bike?.brand} {enq.bike?.model}</h3>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.4rem' }}>
                          <span style={{ color: '#666', fontSize: '0.85rem', fontWeight: 600 }}>Enquiry Date: {new Date(enq.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</span>
                          {statusBadge(enq.status)}
                        </div>
                      </div>
                    </div>
                    {enq.message && (
                      <div style={{ background: '#F8FAFC', padding: '1rem', borderRadius: '12px', fontSize: '0.95rem', color: '#334155', fontWeight: 700, borderLeft: '4px solid #1E3A8A' }}>
                        "{enq.message}"
                      </div>
                    )}
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontFamily: 'Rajdhani, sans-serif', fontSize: '1.6rem', fontWeight: 950, color: '#1E3A8A' }}>
                      ₹{enq.bike?.discountedPrice || enq.bike?.price?.toLocaleString('en-IN')}
                    </div>
                    <div style={{ color: '#888', fontSize: '0.75rem', fontWeight: 700, marginTop: '0.3rem' }}>Registered Ph: {enq.phone || 'N/A'}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

