import { useState } from 'react';
import { Mail, Phone, MapPin, Clock, Send, User, Bike, ChevronDown, Loader } from 'lucide-react';
import toast from 'react-hot-toast';
import { sendContactMessage } from '../api/contactApi';
import { reportApiError } from '../api/apiError';

export default function Contact() {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    serviceType: 'Engine Repair',
    message: ''
  });

  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (submitting) return;   // guard against a double click

    if (!formData.name.trim() || !formData.message.trim()) {
      toast.error('Please fill in your name and a message');
      return;
    }
    if (!formData.email.trim() && !formData.phone.trim()) {
      toast.error('Leave an email or a phone number so we can reply');
      return;
    }

    setSubmitting(true);
    try {
      const { data } = await sendContactMessage(formData);
      toast.success(data.message || "Thanks — we'll be in touch shortly.");
      setFormData({ name: '', email: '', phone: '', serviceType: 'Engine Repair', message: '' });
    } catch (err) {
      toast.error(reportApiError('Contact.handleSubmit', err, 'Could not send your message'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div style={{ background: '#FFFFFF', minHeight: '100vh', color: '#111' }}>
      {/* Hero Header */}
      <section style={{ 
        background: 'linear-gradient(to bottom, #F9F9F9, #FFFFFF)', 
        padding: '5rem 0 3rem',
        textAlign: 'center',
        borderBottom: '1px solid #EEE'
      }}>
        <div className="max-w-7xl mx-auto px-4">
          <h1 style={{ fontFamily: 'Rajdhani, sans-serif', fontSize: 'clamp(2.5rem, 8vw, 3.5rem)', fontWeight: 900, marginBottom: '1rem', color: '#111' }}>
            GET IN <span style={{ color: '#1E3A8A' }}>TOUCH</span>
          </h1>
          <p style={{ color: '#666', fontSize: '1.1rem', maxWidth: '600px', margin: '0 auto' }}>
            India's most trusted auto platform. Have questions? Our experts are here to help you 24/7.
          </p>
        </div>
      </section>

      {/* Contact Content */}
      <section style={{ padding: '5rem 0' }}>
        <div className="max-w-7xl mx-auto px-4 grid md:grid-cols-2 gap-10">
          
          {/* Left Side: Contact Info */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
            <div style={{ background: '#FFF', padding: '2.5rem', borderRadius: '16px', border: '1px solid #EEE', boxShadow: '0 4px 20px rgba(0,0,0,0.03)' }}>
              <h2 style={{ fontFamily: 'Rajdhani, sans-serif', fontSize: '1.8rem', fontWeight: 800, marginBottom: '2rem', display: 'flex', alignItems: 'center', gap: '0.8rem' }}>
                <div style={{ width: 4, height: 24, background: '#1E3A8A' }} />
                Contact Information
              </h2>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.8rem' }}>
                <div style={{ display: 'flex', gap: '1.2rem', alignItems: 'flex-start' }}>
                  <div style={{ background: 'rgba(229,57,53,0.05)', padding: '0.75rem', borderRadius: '12px' }}>
                    <span style={{ fontSize: '1.4rem' }}>📍</span>
                  </div>
                  <div>
                    <p style={{ color: '#111', fontWeight: 700, marginBottom: '0.3rem', fontSize: '1.05rem' }}>Our Locations</p>
                    <p style={{ color: '#666', fontSize: '0.92rem', lineHeight: 1.6 }}>
                      <b>Gurgaon:</b> Tower B, 3rd Floor, Unitech Cyber Park, Sector 39, 122002<br/>
                      <b>Mumbai:</b> Third Floor, Vasudev Chamber, Teli Galli Cross Rd, Andheri East, 400069<br/>
                      <b>Rohtak:</b> 106, First Floor, Agro Mall, Rohtak<br/>
                      <b>Australia:</b> Australia
                    </p>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '1.2rem', alignItems: 'flex-start' }}>
                  <div style={{ background: 'rgba(30,58,138,0.05)', padding: '0.75rem', borderRadius: '12px' }}>
                    <span style={{ fontSize: '1.4rem' }}>📞</span>
                  </div>
                  <div>
                    <p style={{ color: '#111', fontWeight: 700, marginBottom: '0.3rem', fontSize: '1.05rem' }}>Call Us</p>
                    <p style={{ color: '#666', fontSize: '0.92rem' }}>+91 9253625099</p>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '1.2rem', alignItems: 'flex-start' }}>
                  <div style={{ background: 'rgba(229,57,53,0.05)', padding: '0.75rem', borderRadius: '12px' }}>
                    <span style={{ fontSize: '1.4rem' }}>✉️</span>
                  </div>
                  <div>
                    <p style={{ color: '#111', fontWeight: 700, marginBottom: '0.3rem', fontSize: '1.05rem' }}>Email Us</p>
                    <p style={{ color: '#666', fontSize: '0.92rem' }}>kp@avanienterprises.in</p>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '1.2rem', alignItems: 'flex-start' }}>
                  <div style={{ background: 'rgba(229,57,53,0.05)', padding: '0.75rem', borderRadius: '12px' }}>
                    <span style={{ fontSize: '1.4rem' }}>⏰</span>
                  </div>
                  <div>
                    <p style={{ color: '#111', fontWeight: 700, marginBottom: '0.3rem', fontSize: '1.05rem' }}>Working Hours</p>
                    <p style={{ color: '#666', fontSize: '0.92rem' }}>Mon - Sat: 9:00 AM - 8:00 PM</p>
                    <p style={{ color: '#666', fontSize: '0.92rem' }}>Sunday: 10:00 AM - 4:00 PM</p>
                  </div>
                </div>
              </div>
            </div>

            <div style={{ padding: '0 1rem' }}>
              <p style={{ color: '#888', fontSize: '0.88rem', fontStyle: 'italic' }}>
                * Our customer support team typically responds to inquiries within 1 hour during business operations.
              </p>
            </div>
          </div>

          {/* Right Side: Booking Form */}
          <div style={{ background: '#FFF', padding: '2.5rem', borderRadius: '16px', border: '1px solid #EEE', boxShadow: '0 10px 40px rgba(0,0,0,0.04)' }}>
            <h2 style={{ fontFamily: 'Rajdhani, sans-serif', fontSize: '1.8rem', fontWeight: 800, marginBottom: '2.2rem', display: 'flex', alignItems: 'center', gap: '0.8rem' }}>
              <div style={{ width: 4, height: 24, background: '#1E3A8A' }} />
              Quick Inquiry / Booking
            </h2>

            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.4rem' }}>
              <div style={{ position: 'relative' }}>
                <User size={18} style={{ position: 'absolute', left: '1.1rem', top: '1.1rem', color: '#AAA' }} />
                <input 
                  type="text" 
                  placeholder="Your Name" 
                  required
                  value={formData.name}
                  onChange={e => setFormData({...formData, name: e.target.value})}
                  className="input-light" 
                  style={{ paddingLeft: '3.2rem', height: '52px' }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '1.4rem' }} className="sm:grid-cols-2">
                <div style={{ position: 'relative' }}>
                  <Mail size={18} style={{ position: 'absolute', left: '1.1rem', top: '1.1rem', color: '#AAA' }} />
                  <input 
                    type="email" 
                    placeholder="Email Address" 
                    required
                    value={formData.email}
                    onChange={e => setFormData({...formData, email: e.target.value})}
                    className="input-light" 
                    style={{ paddingLeft: '3.2rem', height: '52px' }}
                  />
                </div>
                <div style={{ position: 'relative' }}>
                  <Phone size={18} style={{ position: 'absolute', left: '1.1rem', top: '1.1rem', color: '#AAA' }} />
                  <input 
                    type="tel" 
                    placeholder="Phone Number" 
                    required
                    value={formData.phone}
                    onChange={e => setFormData({...formData, phone: e.target.value})}
                    className="input-light" 
                    style={{ paddingLeft: '3.2rem', height: '52px' }}
                  />
                </div>
              </div>


              <textarea 
                placeholder="How can we assist you today? (Optional)" 
                rows="4"
                value={formData.message}
                onChange={e => setFormData({...formData, message: e.target.value})}
                className="input-light"
                style={{ resize: 'none', padding: '1rem', height: 'auto' }}
              />

              <button type="submit" disabled={submitting} className="btn-primary" style={{ padding: '1.1rem', width: '100%', justifyContent: 'center', fontSize: '1rem', letterSpacing: '0.05em', opacity: submitting ? 0.7 : 1, cursor: submitting ? 'wait' : 'pointer' }}>
                {submitting ? <>SENDING… <Loader size={18} /></> : <>SUBMIT REQUEST <Send size={18} /></>}
              </button>
            </form>
          </div>
        </div>
      </section>

      {/* Map Section - Placed above footer */}
      <div style={{ width: '100%', borderTop: '1px solid #EEE' }}>
        <h3 style={{ textAlign: 'center', padding: '2.5rem 0', fontFamily: 'Rajdhani, sans-serif', color: '#888', letterSpacing: '0.3em', fontSize: '0.85rem', background: '#F9F9F9' }}>FIND US ON MAP</h3>
        <div style={{ width: '100%', height: '480px', background: '#FAFAFA', position: 'relative' }}>
          <iframe 
            title="Avani Enterprises Showroom Location"
            src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d120638.16345638!2d72.8258!3d19.076!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x3be7c6306644edc1%3A0x5da4ed8f8d646c1e!2sMumbai%2C%20Maharashtra!5e0!3m2!1sen!2sin!4v1649160000000!5m2!1sen!2sin" 
            width="100%" 
            height="100%" 
            style={{ border: 0 }} 
            allowFullScreen="" 
            loading="lazy"
          />
        </div>
      </div>
    </div>
  );
}

