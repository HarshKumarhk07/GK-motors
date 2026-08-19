import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { updateProfile, addAddress, updateAddress, deleteAddress } from '../api/authApi';
import { useForm } from 'react-hook-form';
import toast from 'react-hot-toast';
import { User, Mail, Phone, MapPin, Plus, Save, Loader, Camera, Navigation, Map as MapIcon, X, Crosshair, Edit2, Trash2 } from 'lucide-react';
import { Navigate } from 'react-router-dom';
import { MapContainer, TileLayer, Marker, useMapEvents, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';

// Fix Leaflet marker missing icon issue in Vite
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
    iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
    iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
    shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png'
});

const mapContainerStyle = { width: '100%', height: '350px', borderRadius: '8px', zIndex: 1 };
const defaultCenter = { lat: 19.0760, lng: 72.8777 }; // Default Mumbai

export default function Profile() {
  const { user, updateUser } = useAuth();
  const [activeTab, setActiveTab] = useState('details'); // details, addresses
  const [loading, setLoading] = useState(false);
  const [addrLoading, setAddrLoading] = useState(false);
  const [avatarPreview, setAvatarPreview] = useState(null);
  const [editingAddressId, setEditingAddressId] = useState(null);
  
  // Map Modal State
  const [showMapModal, setShowMapModal] = useState(false);
  const [mapLocation, setMapLocation] = useState(defaultCenter);
  const [locationSet, setLocationSet] = useState(false);
  const [humanAddress, setHumanAddress] = useState('');
  const [isGeocoding, setIsGeocoding] = useState(false);

  const fetchAddress = async (lat, lng) => {
    setIsGeocoding(true);
    try {
      const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`);
      const data = await res.json();
      if (data && data.display_name) {
        setHumanAddress(data.display_name);
      } else {
        setHumanAddress('Location selected');
      }
    } catch (err) {
      setHumanAddress('Location selected');
    } finally {
      setIsGeocoding(false);
    }
  };

  function MapClickHandler() {
    const map = useMap();
    useMapEvents({
      click(e) {
        setMapLocation(e.latlng);
        fetchAddress(e.latlng.lat, e.latlng.lng);
      },
    });

    return <Marker position={mapLocation}></Marker>;
  }

  const { register: regProfile, handleSubmit: handleProfileSubmit } = useForm({
    defaultValues: { name: user?.name, email: user?.email, phone: user?.phone }
  });
  
  const { register: regAddr, handleSubmit: handleAddrSubmit, reset: resetAddr } = useForm();

  if (!user) return <Navigate to="/login" replace />;

  const onProfileUpdate = async (data) => {
    setLoading(true);
    try {
      const formData = new FormData();
      if (data.name) formData.append('name', data.name);
      if (data.email) formData.append('email', data.email);
      if (data.phone) formData.append('phone', data.phone);
      if (data.avatar && data.avatar[0]) formData.append('avatar', data.avatar[0]);

      const res = await updateProfile(formData);
      updateUser(res.data.user);
      toast.success('Profile updated successfully!');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to update profile');
    } finally {
      setLoading(false);
    }
  };

  const onAddAddress = async (data) => {
    setAddrLoading(true);
    try {
      const addressData = { ...data, lat: mapLocation.lat, lng: mapLocation.lng };
      let res;
      if (editingAddressId) {
        res = await updateAddress(editingAddressId, addressData);
        toast.success('Address updated successfully!');
      } else {
        res = await addAddress(addressData);
        toast.success('Address added successfully!');
      }
      updateUser({ addresses: res.data.addresses });
      resetAddr();
      setMapLocation(defaultCenter);
      setLocationSet(false);
      setEditingAddressId(null);
      setActiveTab('addresses');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to save address');
    } finally {
      setAddrLoading(false);
    }
  };

  const handleEditAddress = (addr) => {
    setEditingAddressId(addr._id || addr.id);
    resetAddr({ label: addr.label, street: addr.street, city: addr.city, state: addr.state, pincode: addr.pincode });
    if (addr.lat && addr.lng) {
      setMapLocation({ lat: addr.lat, lng: addr.lng });
      setLocationSet(true);
      fetchAddress(addr.lat, addr.lng);
    } else {
      setMapLocation(defaultCenter);
      setLocationSet(false);
      setHumanAddress('');
    }
    setActiveTab('add_address');
  };

  const handleDeleteAddress = async (id) => {
    if (!window.confirm('Are you sure you want to delete this address?')) return;
    try {
      const res = await deleteAddress(id);
      updateUser({ addresses: res.data.addresses });
      toast.success('Address deleted!');
    } catch (err) {
      toast.error('Failed to delete address');
    }
  };

  const handleAvatarChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      setAvatarPreview(URL.createObjectURL(e.target.files[0]));
    }
  };

  return (
    <div style={{ minHeight: '100vh', background: '#FFFFFF', padding: '2.5rem 0' }}>
      <style>{`
        @media (max-width: 640px) {
          .profile-header { flex-direction: column; text-align: center; padding: 1.2rem !important; gap: 0.8rem !important; }
          .profile-header > div:first-child { width: 70px !important; height: 70px !important; }
          .profile-header h1 { font-size: 1.5rem !important; }
          .profile-tabs-btn { font-size: 0.75rem !important; padding: 0.6rem 0.8rem !important; gap: 0.4rem !important; }
          .profile-content { padding: 1.2rem !important; }
          .profile-content h3 { font-size: 1.2rem !important; margin-bottom: 1.2rem !important; }
          .profile-form-grid { gap: 1rem !important; }
          .profile-form-grid input { height: 44px !important; font-size: 0.85rem !important; }
          .profile-form-grid label { font-size: 0.75rem !important; }
          .profile-save-btn { width: 100% !important; padding: 0.8rem !important; font-size: 0.9rem !important; }
          .address-card { padding: 1.2rem !important; }
          .address-card h4 { font-size: 0.95rem !important; }
          .map-locate-btn { padding: 0.4rem 0.8rem !important; font-size: 0.7rem !important; bottom: 0.8rem !important; right: 0.6rem !important; border-radius: 8px !important; }
          .map-modal-content { padding: 0.8rem !important; margin-top: 1rem !important; }
          .map-modal-header { padding: 0.8rem 1rem !important; }
          .map-container-mobile { height: 250px !important; }
          .map-confirm-btn { padding: 0.8rem !important; font-size: 0.9rem !important; border-radius: 10px !important; }
        }
      `}</style>
      <div className="max-w-4xl mx-auto px-4">

        {/* Header */}
        <div className="profile-header" style={{ display: 'flex', alignItems: 'center', gap: '1.5rem', background: '#F9F9F9', padding: '2rem', borderRadius: '24px', border: '1px solid #EEE', marginBottom: '2.5rem', boxShadow: '0 10px 40px rgba(0,0,0,0.02)' }}>
          <div style={{ position: 'relative', width: 100, height: 100 }}>
            {avatarPreview || user.avatar ? (
              <img src={avatarPreview || user.avatar} alt={user.name} style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover', border: '3px solid #1E3A8A' }} />
            ) : (
              <div style={{ width: '100%', height: '100%', borderRadius: '50%', background: 'linear-gradient(135deg, #1E3A8A, #172554)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '2.8rem', fontWeight: 900, color: 'white' }}>
                {user.name?.charAt(0).toUpperCase()}
              </div>
            )}
          </div>
          <div>
            <h1 style={{ fontFamily: 'Rajdhani, sans-serif', fontSize: '2.2rem', fontWeight: 900, color: '#111', lineHeight: 1 }}>{user.name}</h1>
            <p style={{ color: '#666', display: 'flex', alignItems: 'center', gap: '0.4rem', marginTop: '0.6rem', fontWeight: 500, fontSize: '1rem' }}>
              <Mail size={16} /> {user.email || 'No email added'}
            </p>
          </div>
        </div>
 
        {/* Tabs */}
        <div style={{ display: 'flex', gap: '0.6rem', marginBottom: '2rem', overflowX: 'auto', paddingBottom: '0.5rem' }} className="hide-scrollbar">
          {[
            { id: 'details', label: 'Personal Details', icon: User },
            { id: 'addresses', label: 'Saved Addresses', icon: MapPin },
            { id: 'add_address', label: editingAddressId ? 'Edit Address' : 'Add New Address', icon: Plus },
          ].map(({ id, label, icon: Icon }) => (
            <button key={id} 
              className="profile-tabs-btn"
              onClick={() => {
                setActiveTab(id);
                if (id === 'add_address' && editingAddressId) {
                  setEditingAddressId(null);
                  resetAddr({}); 
                  setMapLocation(defaultCenter);
                  setLocationSet(false);
                  setHumanAddress('');
                } else if (id !== 'add_address') {
                  setEditingAddressId(null);
                  resetAddr();
                  setMapLocation(defaultCenter);
                  setLocationSet(false);
                  setHumanAddress('');
                }
              }}
              style={{
                display: 'flex', alignItems: 'center', gap: '0.6rem', padding: '0.8rem 1.4rem', borderRadius: '12px', border: '1.5px solid',
                borderColor: activeTab === id ? '#1E3A8A' : '#EEE',
                background: activeTab === id ? '#FFF' : '#F9F9F9',
                color: activeTab === id ? '#1E3A8A' : '#666',
                cursor: 'pointer', fontWeight: 800, fontSize: '0.9rem', transition: 'all 0.25s',
                whiteSpace: 'nowrap',
                boxShadow: activeTab === id ? '0 8px 20px rgba(30, 58, 138, 0.1)' : 'none'
              }}>
              <Icon size={16} /> {label}
            </button>
          ))}
        </div>
 
        {/* Content Area */}
        <div className="profile-content" style={{ background: '#FFF', border: '1px solid #EEE', borderRadius: '24px', padding: '2.5rem', boxShadow: '0 15px 50px rgba(0,0,0,0.03)' }}>
          
          {/* PERSONAL DETAILS TAB */}
          {activeTab === 'details' && (
            <form onSubmit={handleProfileSubmit(onProfileUpdate)} className="animate-fadeInUp">
              <h3 style={{ color: '#111', fontSize: '1.4rem', fontWeight: 900, marginBottom: '2rem', fontFamily: 'Rajdhani, sans-serif' }}>UPDATE PROFILE</h3>
              
              <div className="profile-form-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.5rem' }}>
                <div>
                  <label style={{ color: '#333', fontSize: '0.85rem', fontWeight: 700, display: 'block', marginBottom: '0.6rem' }}>Full Name</label>
                  <div style={{ position: 'relative' }}>
                    <User size={16} style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: '#AAA' }} />
                    <input className="input-light" style={{ paddingLeft: '2.5rem', height: '52px' }} {...regProfile('name')} />
                  </div>
                </div>
                <div>
                  <label style={{ color: '#333', fontSize: '0.85rem', fontWeight: 700, display: 'block', marginBottom: '0.6rem' }}>Email Address</label>
                  <div style={{ position: 'relative' }}>
                    <Mail size={16} style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: '#AAA' }} />
                    <input type="email" className="input-light" style={{ paddingLeft: '2.5rem', height: '52px' }} {...regProfile('email')} />
                  </div>
                </div>
                <div>
                  <label style={{ color: '#333', fontSize: '0.85rem', fontWeight: 700, display: 'block', marginBottom: '0.6rem' }}>Mobile Number</label>
                  <div style={{ position: 'relative' }}>
                    <Phone size={16} style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: '#AAA' }} />
                    <input type="tel" className="input-light" style={{ paddingLeft: '2.5rem', height: '52px' }} {...regProfile('phone')} />
                  </div>
                </div>
                <div>
                  <label style={{ color: '#333', fontSize: '0.85rem', fontWeight: 700, display: 'block', marginBottom: '0.6rem' }}>Profile Picture</label>
                  <div style={{ position: 'relative' }}>
                    <Camera size={16} style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: '#AAA' }} />
                    <input type="file" accept="image/*" className="input-light" style={{ paddingLeft: '2.5rem', height: '52px', padding: '12px 12px 12px 40px' }} {...regProfile('avatar')} onChange={handleAvatarChange} />
                  </div>
                </div>
              </div>
 
              <button type="submit" className="btn-primary profile-save-btn" style={{ marginTop: '2.5rem', padding: '0.8rem 2.5rem', fontWeight: 700, borderRadius: '10px' }} disabled={loading}>
                {loading ? <Loader size={20} style={{ animation: 'spin 1s linear infinite' }} /> : <><Save size={20} /> SAVE PROFILE</>}
              </button>
            </form>
          )}
 
          {/* SAVED ADDRESSES TAB */}
          {activeTab === 'addresses' && (
            <div className="animate-fadeInUp">
              <h3 style={{ color: '#111', fontSize: '1.4rem', fontWeight: 900, marginBottom: '2rem', fontFamily: 'Rajdhani, sans-serif' }}>YOUR SAVED ADDRESSES</h3>
              {(!user.addresses || user.addresses.length === 0) ? (
                <div style={{ textAlign: 'center', padding: '4rem 2rem', background: '#F9F9F9', borderRadius: '16px', border: '1.5px dashed #EEE' }}>
                  <div style={{ background: '#FFF', width: 70, height: 70, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1.5rem', boxShadow: '0 8px 20px rgba(0,0,0,0.03)' }}>
                    <MapPin size={32} style={{ color: '#CCC' }} />
                  </div>
                  <p style={{ color: '#888', marginBottom: '1.5rem', fontSize: '1.05rem', fontWeight: 500 }}>You haven't saved any addresses yet.</p>
                  <button onClick={() => setActiveTab('add_address')} className="btn-outline-dark" style={{ fontWeight: 700, padding: '0.7rem 2rem' }}>Add New Address</button>
                </div>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1.5rem' }}>
                  {user.addresses.map((addr, i) => (
                    <div key={i} className="address-card" style={{ background: '#FFF', padding: '1.80rem', borderRadius: '20px', border: '1px solid #EEE', position: 'relative', transition: 'all 0.3s', boxShadow: '0 4px 15px rgba(0,0,0,0.02)' }}
                      onMouseEnter={e => e.currentTarget.style.borderColor = '#111'}
                      onMouseLeave={e => e.currentTarget.style.borderColor = '#EEE'}>
                      <div style={{ position: 'absolute', top: 18, right: 18, display: 'flex', gap: '0.6rem', alignItems: 'center' }}>
                        <span style={{ background: 'rgba(30,58,138,0.06)', color: '#1E3A8A', fontSize: '0.7rem', fontWeight: 800, padding: '0.4rem 0.8rem', borderRadius: '999px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                          {addr.label || 'Home'}
                        </span>
                        <div style={{ display: 'flex', gap: '0.4rem' }}>
                          <button onClick={() => handleEditAddress(addr)} style={{ background: '#F5F5F5', border: 'none', color: '#666', cursor: 'pointer', padding: '7px', borderRadius: '8px', display: 'flex' }} title="Edit"><Edit2 size={15} /></button>
                          <button onClick={() => handleDeleteAddress(addr._id || addr.id)} style={{ background: 'rgba(30,58,138,0.08)', border: 'none', color: '#1E3A8A', cursor: 'pointer', padding: '7px', borderRadius: '8px', display: 'flex' }} title="Delete"><Trash2 size={15} /></button>
                        </div>
                      </div>
                      <div style={{ background: '#FFF', width: 44, height: 44, borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '1.2rem', boxShadow: '0 4px 12px rgba(30,58,138,0.15)', border: '1px solid rgba(30,58,138,0.1)' }}>
                        <MapPin size={22} style={{ color: '#1E3A8A' }} />
                      </div>
                      <p style={{ color: '#111', fontWeight: 800, fontSize: '1.05rem', marginBottom: '0.4rem' }}>{addr.street}</p>
                      <p style={{ color: '#666', fontSize: '0.92rem', lineHeight: 1.5 }}>{addr.city}, {addr.state} - {addr.pincode}</p>
                      {addr.lat && addr.lng && (
                        <p style={{ color: '#AAA', fontSize: '0.8rem', marginTop: '1rem', display: 'flex', alignItems: 'center', gap: '0.4rem', fontWeight: 600 }}>
                          <Navigation size={12} /> {addr.lat.toFixed(4)}, {addr.lng.toFixed(4)}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
 
          {/* ADD / EDIT ADDRESS TAB */}
          {activeTab === 'add_address' && (
            <form onSubmit={handleAddrSubmit(onAddAddress)} className="animate-fadeInUp">
              <h3 style={{ color: '#111', fontSize: '1.4rem', fontWeight: 900, marginBottom: '2rem', fontFamily: 'Rajdhani, sans-serif' }}>{editingAddressId ? 'EDIT ADDRESS' : 'ADD NEW ADDRESS'}</h3>
              
              <div className="profile-form-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.5rem' }}>
                <div>
                  <label style={{ color: '#333', fontSize: '0.85rem', fontWeight: 700, display: 'block', marginBottom: '0.6rem' }}>Label (e.g. Home, Work)</label>
                  <input className="input-light" placeholder="Home" {...regAddr('label')} style={{ height: '52px' }} />
                </div>
                <div style={{ gridColumn: '1 / -1' }}>
                  <label style={{ color: '#333', fontSize: '0.85rem', fontWeight: 700, display: 'block', marginBottom: '0.6rem' }}>Street Address *</label>
                  <input className="input-light" placeholder="123 Main St, Apartment 4B" {...regAddr('street', { required: true })} style={{ height: '52px' }} />
                </div>
                <div>
                  <label style={{ color: '#333', fontSize: '0.85rem', fontWeight: 700, display: 'block', marginBottom: '0.6rem' }}>City *</label>
                  <input className="input-light" placeholder="Mumbai" {...regAddr('city', { required: true })} style={{ height: '52px' }} />
                </div>
                <div>
                  <label style={{ color: '#333', fontSize: '0.85rem', fontWeight: 700, display: 'block', marginBottom: '0.6rem' }}>State *</label>
                  <input className="input-light" placeholder="Maharashtra" {...regAddr('state', { required: true })} style={{ height: '52px' }} />
                </div>
                <div>
                  <label style={{ color: '#333', fontSize: '0.85rem', fontWeight: 700, display: 'block', marginBottom: '0.6rem' }}>Pincode *</label>
                  <input className="input-light" placeholder="400001" {...regAddr('pincode', { required: true })} style={{ height: '52px' }} />
                </div>
              </div>
 
              <div style={{ marginTop: '2rem', gridColumn: '1 / -1' }}>
                <label style={{ color: '#111', fontSize: '0.9rem', display: 'block', marginBottom: '0.8rem', textTransform: 'uppercase', fontWeight: 900, fontFamily: 'Rajdhani, sans-serif' }}>
                  <img src="https://cdn-icons-png.flaticon.com/512/2776/2776067.png" alt="pin" style={{ width: 18, height: 18, display: 'inline', marginRight: 6, verticalAlign: 'middle' }}/> Set Location on Map
                </label>
                
                <div 
                  onClick={() => setShowMapModal(true)}
                  style={{
                    border: '2px dashed #EEE',
                    background: locationSet ? 'rgba(46,125,50,0.03)' : '#F9F9F9',
                    borderColor: locationSet ? '#2E7D32' : '#EEE',
                    borderRadius: '16px',
                    padding: '1.2rem 1.5rem',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    cursor: 'pointer',
                    transition: 'all 0.3s',
                  }}
                  onMouseEnter={(e) => {
                    if(!locationSet) e.currentTarget.style.borderColor = '#111';
                  }}
                  onMouseLeave={(e) => {
                    if(!locationSet) e.currentTarget.style.borderColor = '#EEE';
                  }}
                >
                  <div style={{ flex: 1 }}>
                    <h4 style={{ color: locationSet ? '#2E7D32' : '#333', fontSize: '1rem', fontWeight: 800, margin: 0, fontFamily: 'Rajdhani, sans-serif', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                      {locationSet ? <><Check size={18} /> LOCATION CONFIGURED</> : <><img src="https://cdn-icons-png.flaticon.com/512/2776/2776067.png" alt="pin" style={{ width: 22, height: 22 }}/> PINPOINT ON MAP</>}
                    </h4>
                    <p style={{ color: '#666', fontSize: '0.88rem', margin: 0, marginTop: 4, display: '-webkit-box', WebkitLineClamp: 1, WebkitBoxOrient: 'vertical', overflow: 'hidden', fontWeight: 500 }}>
                      {locationSet ? (humanAddress || `Lat: ${mapLocation.lat.toFixed(4)}, Lng: ${mapLocation.lng.toFixed(4)}`) : 'Help us find your doorstep exactly'}
                    </p>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginLeft: '1.5rem' }}>
                    <img src="https://cdn-icons-png.flaticon.com/512/2776/2776067.png" alt="pin" style={{ width: 32, height: 32 }} />
                  </div>
                </div>
              </div>
 
              <div style={{ marginTop: '3rem', display: 'flex', gap: '1.2rem', flexWrap: 'wrap' }}>
                <button type="button" className="btn-outline-dark profile-save-btn" style={{ fontWeight: 700, padding: '0.8rem 2.5rem', flex: 1 }} onClick={() => {
                  setActiveTab('addresses');
                  setEditingAddressId(null);
                  resetAddr();
                  setMapLocation(defaultCenter);
                  setLocationSet(false);
                  setHumanAddress('');
                }}>CANCEL</button>
                <button type="submit" className="btn-primary profile-save-btn" style={{ fontWeight: 700, padding: '0.8rem 2.5rem', borderRadius: '12px', flex: 1 }} disabled={addrLoading}>
                  {addrLoading ? <Loader size={20} style={{ animation: 'spin 1s linear infinite' }} /> : <><Save size={20} /> {editingAddressId ? 'UPDATE' : 'SAVE'}</>}
                </button>
              </div>
            </form>
          )}
 
        </div>
      </div>
 
      {/* MAP MODAL */}
      {showMapModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.6)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem', backdropFilter: 'blur(5px)' }}>
          <div style={{ background: '#FFF', width: '100%', maxWidth: '550px', borderRadius: '24px', border: '1px solid #EEE', overflow: 'hidden', display: 'flex', flexDirection: 'column', boxShadow: '0 25px 60px rgba(0,0,0,0.15)' }}>
            
            {/* Modal Header */}
            <div className="map-modal-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1.2rem 1.5rem', borderBottom: '1px solid #EEE' }}>
              <div>
                <h3 style={{ color: '#111', fontWeight: 900, margin: 0, fontSize: '1.1rem', fontFamily: 'Rajdhani, sans-serif', letterSpacing: '0.02em' }}>PINPOINT LOCATION</h3>
                <p style={{ color: '#888', margin: 0, fontSize: '0.75rem', fontWeight: 600 }}>Select the exact service location</p>
              </div>
              <button 
                onClick={() => setShowMapModal(false)}
                style={{ background: '#F5F5F5', border: 'none', color: '#666', cursor: 'pointer', padding: '0.5rem', borderRadius: '50%', display: 'flex' }}
              >
                <X size={18} />
              </button>
            </div>
 
            {/* Modal Body / Map */}
            <div style={{ padding: '1rem', position: 'relative' }}>
              <div style={{ position: 'relative', border: '1px solid #EEE', borderRadius: '16px', overflow: 'hidden', boxShadow: '0 10px 30px rgba(0,0,0,0.04)' }}>
                <div className="map-container-mobile" style={{ width: '100%', height: '350px', borderRadius: '8px', zIndex: 1 }}>
                  <MapContainer center={mapLocation} zoom={14} style={{ width: '100%', height: '100%' }}>
                    <TileLayer
                      url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                      attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                    />
                    <MapClickHandler />
                  </MapContainer>
                </div>
                
                {/* Locate Me Button Overlay */}
                <button 
                  type="button"
                  className="map-locate-btn"
                  onClick={() => {
                    if (navigator.geolocation) {
                      navigator.geolocation.getCurrentPosition(
                        (pos) => {
                          const newLoc = { lat: pos.coords.latitude, lng: pos.coords.longitude };
                          setMapLocation(newLoc);
                          fetchAddress(newLoc.lat, newLoc.lng);
                        },
                        (err) => toast.error('Could not access GPS location')
                      );
                    }
                  }}
                  style={{ position: 'absolute', bottom: '1.5rem', right: '1rem', background: '#111', color: '#FFF', border: 'none', borderRadius: '12px', padding: '0.7rem 1.2rem', display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 700, fontSize: '0.85rem', cursor: 'pointer', boxShadow: '0 8px 20px rgba(0,0,0,0.2)', zIndex: 1000 }}
                >
                  <Crosshair size={16} style={{ color: '#1E3A8A' }}/> LOCATE ME
                </button>
              </div>
 
              {/* Final Address Details Label */}
              <div className="map-modal-content" style={{ background: '#F9F9F9', borderRadius: '12px', padding: '0.8rem 1rem', border: '1px solid #EEE', marginTop: '1rem' }}>
                <p style={{ color: '#1E3A8A', fontSize: '0.7rem', fontWeight: 900, margin: 0, marginBottom: '0.3rem', letterSpacing: '0.04em' }}>SELECTED ADDRESS:</p>
                
                {isGeocoding ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#666', fontSize: '0.85rem', marginTop: '0.2rem', fontWeight: 600 }}>
                    <Loader size={14} style={{ animation: 'spin 1s linear infinite' }} /> Fetching geolocation...
                  </div>
                ) : (
                  <>
                    <p style={{ color: '#111', fontSize: '0.88rem', fontWeight: 800, margin: 0, lineHeight: 1.3 }}>
                      {humanAddress ? humanAddress : 'Click anywhere on the map to set location'}
                    </p>
                    <p style={{ color: '#AAA', fontSize: '0.75rem', marginTop: '0.2rem', margin: 0, fontWeight: 700 }}>
                      {mapLocation.lat.toFixed(6)}, {mapLocation.lng.toFixed(6)}
                    </p>
                  </>
                )}
              </div>
            </div>
 
            {/* Modal Footer */}
            <div style={{ padding: '0 1rem 1.5rem 1.5rem' }}>
              <button 
                type="button"
                onClick={() => {
                  setLocationSet(true);
                  setShowMapModal(false);
                }}
                className="btn-primary map-confirm-btn" 
                style={{ width: '100%', justifyContent: 'center', padding: '0.8rem', fontSize: '0.95rem', fontWeight: 800, borderRadius: '10px' }}
              >
                CONFIRM THIS LOCATION
              </button>
            </div>
            
          </div>
        </div>
      )}
    </div>
  );
}

