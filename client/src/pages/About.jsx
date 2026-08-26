import { Shield, Clock, MapPin, Star, Zap, Award, Users, CheckCircle, Heart } from 'lucide-react';

export default function About() {
  return (
    <div style={{ flex: '1 0 auto', background: '#FFFFFF', width: '100%' }}>
      <style>{`
        @media (max-width: 768px) {
          section { padding: 3rem 0 !important; }
          .max-w-4xl, .max-w-6xl { padding: 0 1.5rem !important; }
          h1 { font-size: 2.2rem !important; margin-bottom: 1rem !important; }
          h2 { font-size: 2rem !important; margin-bottom: 1rem !important; }
          p { font-size: 0.9rem !important; line-height: 1.6 !important; }
          
          /* Hero */
          .about-hero { padding: 4rem 1rem !important; }
          
          /* Stats */
          .stats-grid { grid-template-columns: repeat(2, 1fr) !important; gap: 1rem !important; }
          .stat-value { font-size: 1.6rem !important; }
          .stat-label { font-size: 0.65rem !important; }
          
          /* Journey */
          .journey-grid { grid-template-columns: 1fr !important; gap: 2.5rem !important; }
          .journey-image-wrapper { margin-top: 1rem !important; }
          .journey-subgrid { grid-template-columns: 1fr !important; gap: 1rem !important; }
          
          /* Values */
          .values-grid { grid-template-columns: repeat(2, 1fr) !important; gap: 0.75rem !important; }
          .value-card-img { height: 140px !important; }
          .value-card-content { padding: 1.5rem !important; }
          .value-card-title { font-size: 1.3rem !important; }
        }
      `}</style>

      {/* Hero Section */}
      <section className="about-hero" style={{ 
        background: '#0F172A', 
        padding: '6rem 0', 
        position: 'relative', 
        overflow: 'hidden',
        textAlign: 'center'
      }}>
        {/* Glow Background */}
        <div style={{ position: 'absolute', inset: 0, backgroundImage: 'radial-gradient(circle at 50% 50%, rgba(37,99,235,0.2) 0%, transparent 60%)' }} />
        
        <div className="max-w-4xl mx-auto px-4 relative z-10">
          <p style={{ color: '#93C5FD', fontSize: '0.9rem', fontWeight: 800, letterSpacing: '0.3em', textTransform: 'uppercase', marginBottom: '1rem' }}>Our Story</p>
          <h1 style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 'clamp(2.5rem, 6vw, 4.5rem)', fontWeight: 950, color: 'white', lineHeight: 1, marginBottom: '1.5rem' }}>
            REVOLUTIONIZING <br />
            <span style={{ color: '#93C5FD' }}>CAR OWNERSHIP</span>
          </h1>
          <p style={{ color: '#94A3B8', fontSize: '1.1rem', lineHeight: 1.7, fontWeight: 500 }}>
            Founded with a passion for automobiles and a vision for convenience, GK Motors is a trusted name in professional car service and repair. Certified technicians, genuine parts and transparent pricing — delivered to your doorstep.
          </p>
        </div>
      </section>

      {/* Stats Section */}
      <section style={{ background: '#FFF', padding: '4rem 0', borderBottom: '1px solid #EEE' }}>
        <div className="max-w-6xl mx-auto px-4">
          <div className="stats-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '2rem', textAlign: 'center' }}>
            {[
              { value: '25K+', label: 'Happy Customers', icon: Users },
              { value: '150+', label: 'Quality Checks', icon: CheckCircle },
              { value: '500+', label: 'Certified Cars', icon: Award },
              { value: '60 Min', label: 'Service Promise', icon: Clock },
            ].map((stat, i) => (
              <div key={i} style={{ padding: '1rem' }}>
                <stat.icon size={28} style={{ color: '#2563EB', marginBottom: '0.8rem' }} />
                <div className="stat-value" style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: '2.2rem', fontWeight: 900, color: '#111', lineHeight: 1 }}>{stat.value}</div>
                <div className="stat-label" style={{ color: '#888', fontSize: '0.8rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', marginTop: '0.3rem' }}>{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Journey Section */}
      <section style={{ padding: '6rem 0', background: '#F9F9F9' }}>
        <div className="max-w-6xl mx-auto px-4">
          <div className="journey-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: '4rem', alignItems: 'center' }}>
            <div>
              <div style={{ width: 40, height: 4, background: '#2563EB', marginBottom: '1.5rem', borderRadius: '2px' }} />
              <h2 style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: '2.8rem', fontWeight: 900, color: '#111', lineHeight: 1.1, marginBottom: '1.5rem' }}>
                A JOURNEY DRIVEN BY <span style={{ color: '#2563EB' }}>EXCELLENCE</span>
              </h2>
              <p style={{ color: '#555', fontSize: '1.05rem', lineHeight: 1.8, marginBottom: '1.5rem' }}>
                GK Motors started as a small garage in 2018. Today we run a full-service workshop network with factory-trained technicians and modern diagnostics. From a routine periodic service to a full engine rebuild, we keep the process transparent and the pricing upfront at every step.
              </p>
              <div className="journey-subgrid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
                <div style={{ background: '#FFF', padding: '1.5rem', borderRadius: '16px', border: '1px solid #EEE', boxShadow: '0 4px 15px rgba(0,0,0,0.03)' }}>
                  <Zap size={22} style={{ color: '#2563EB', marginBottom: '0.8rem' }} />
                  <h4 style={{ color: '#111', fontWeight: 800 }}>Fast Turnaround</h4>
                  <p style={{ color: '#777', fontSize: '0.85rem' }}>Most routine services completed and returned the same day.</p>
                </div>
                <div style={{ background: '#FFF', padding: '1.5rem', borderRadius: '16px', border: '1px solid #EEE', boxShadow: '0 4px 15px rgba(0,0,0,0.03)' }}>
                  <Shield size={22} style={{ color: '#2563EB', marginBottom: '0.8rem' }} />
                  <h4 style={{ color: '#111', fontWeight: 800 }}>Certified Quality</h4>
                  <p style={{ color: '#777', fontSize: '0.85rem' }}>Every service ends with a 40-point health check report.</p>
                </div>
              </div>
            </div>
            <div className="journey-image-wrapper" style={{ position: 'relative' }}>
              <div style={{ position: 'absolute', inset: '-10px', border: '2px solid #2563EB', borderRadius: '24px', zIndex: 0 }} />
              <img 
                src="https://images.unsplash.com/photo-1625047509248-ec889cbff17f?q=80&w=800&auto=format&fit=crop" 
                alt="GK Motors Workshop" 
                style={{ width: '100%', height: '100%', borderRadius: '20px', objectFit: 'cover', position: 'relative', zIndex: 1, boxShadow: '0 20px 40px rgba(0,0,0,0.1)' }} 
              />
            </div>
          </div>
        </div>
      </section>

      {/* Values Section */}
      <section style={{ padding: '6rem 0', background: '#FFF' }}>
        <div className="max-w-6xl mx-auto px-4">
          <div style={{ textAlign: 'center', marginBottom: '4rem' }}>
            <h2 style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: '2.5rem', fontWeight: 900, color: '#111' }}>OUR CORE <span style={{ color: '#2563EB' }}>VALUES</span></h2>
            <p style={{ color: '#666' }}>The principles that guide everything we do</p>
          </div>
          <div className="values-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '2rem' }}>
            {[
              { title: 'Transparency', icon: Shield, desc: 'No hidden costs, no surprise line items. You approve the estimate before we touch a single bolt.', num: '01', bg: 'https://images.unsplash.com/photo-1542362567-b07e54358753?q=80&w=400&auto=format&fit=crop' },
              { title: 'Innovation', icon: Zap, desc: 'Modern diagnostics, live job tracking and digital service records — doorstep servicing done properly.', num: '02', bg: 'https://images.unsplash.com/photo-1518987048-93e29699e79a?q=80&w=400&auto=format&fit=crop' },
              { title: 'Customer First', icon: Heart, desc: 'From pickup to delivery, your convenience is our highest priority. Premium service, every single time.', num: '03', bg: 'https://images.unsplash.com/photo-1549317661-bd32c8ce0db2?q=80&w=400&auto=format&fit=crop' },
            ].map((value, i) => (
              <div key={i} style={{ 
                borderRadius: '24px', 
                border: '1px solid #EEE',
                transition: 'all 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275)',
                overflow: 'hidden',
                background: '#FFF',
                display: 'flex',
                flexDirection: 'column'
              }}
              onMouseEnter={e => { 
                e.currentTarget.style.transform = 'translateY(-10px)'; 
                e.currentTarget.style.borderColor = '#2563EB';
                e.currentTarget.style.boxShadow = '0 20px 40px rgba(37,99,235,0.1)';
              }}
              onMouseLeave={e => { 
                e.currentTarget.style.transform = 'translateY(0)'; 
                e.currentTarget.style.borderColor = '#EEE';
                e.currentTarget.style.boxShadow = 'none';
              }}>
                {/* Image Section */}
                <div className="value-card-img" style={{ 
                  height: '180px', 
                  backgroundImage: `url(${value.bg})`, 
                  backgroundSize: 'cover', 
                  backgroundPosition: 'center',
                  position: 'relative'
                }}>
                  <div style={{ 
                    position: 'absolute', top: '15px', right: '15px', 
                    background: 'rgba(255,255,255,0.9)', padding: '4px 12px', 
                    borderRadius: '20px', fontSize: '1.2rem', fontWeight: 900, 
                    fontFamily: "'Space Grotesk', sans-serif", color: '#111' 
                  }}>
                    {value.num}
                  </div>
                </div>

                {/* Content Section */}
                <div className="value-card-content" style={{ padding: '2rem', position: 'relative' }}>
                  <div style={{ 
                    position: 'absolute', top: '-25px', left: '25px', 
                    width: '50px', height: '50px', borderRadius: '50%', 
                    background: '#2563EB', display: 'flex', alignItems: 'center', 
                    justifyContent: 'center', boxShadow: '0 8px 20px rgba(37,99,235,0.3)',
                    border: '3px solid white'
                  }}>
                    <value.icon size={20} style={{ color: 'white' }} />
                  </div>

                  <h3 className="value-card-title" style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: '1.5rem', fontWeight: 800, color: '#111', marginTop: '0.5rem', marginBottom: '0.8rem' }}>{value.title}</h3>
                  <p style={{ color: '#666', lineHeight: 1.6, fontSize: '0.9rem' }}>{value.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
