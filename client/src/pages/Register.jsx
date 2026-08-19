import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';
import { User, Mail, Phone, Lock, Eye, EyeOff, ArrowRight, Loader } from 'lucide-react';
import { useState } from 'react';

export default function Register() {
  const { register: registerUser, loading } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const rawRedirect = searchParams.get('redirect') || '/';
  const redirectTo = rawRedirect.startsWith('/') && !rawRedirect.startsWith('//') ? rawRedirect : '/';
  const [showPass, setShowPass] = useState(false);
  const { register, handleSubmit, watch, formState: { errors } } = useForm();

  const onSubmit = async (data) => {
    try {
      await registerUser(data);
      toast.success('Account created! Welcome');
      navigate(redirectTo, { replace: true });
    } catch (err) {
      toast.error(err.message);
    }
  };

  return (
    <div style={{ minHeight: '100vh', background: '#FFFFFF', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0.5rem 1rem' }}>
      <style>{`
        @media (max-width: 640px) {
          .register-container { padding: 1rem !important; border-radius: 16px !important; }
          .register-logo img { height: 36px !important; }
          .register-logo span { font-size: 1.15rem !important; }
          .register-title { font-size: 1.2rem !important; margin-top: 0.6rem !important; }
          .register-subtitle { font-size: 0.7rem !important; margin-top: 0.1rem !important; }
          .form-label { font-size: 0.7rem !important; margin-bottom: 0.2rem !important; }
          .form-input-wrapper { margin-bottom: 0.6rem !important; }
          .form-input { height: 38px !important; font-size: 0.8rem !important; }
          .submit-btn { padding: 0.7rem !important; font-size: 0.85rem !important; border-radius: 10px !important; }
          .terms-text { font-size: 0.65rem !important; margin-bottom: 0.6rem !important; line-height: 1.2 !important; }
          .signin-text { margin-top: 0.8rem !important; font-size: 0.8rem !important; }
        }
      `}</style>
      <div style={{ width: '100%', maxWidth: 460 }}>
        <div style={{ textAlign: 'center', marginBottom: '1.2rem' }}>
          <Link to="/" className="register-logo" style={{ textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}>
            <img src="/gkmotorslogo.png" alt="GK Motors" style={{ height: 54, width: 'auto', objectFit: 'contain', display: 'block' }} />
            <span style={{ fontFamily: 'Rajdhani, sans-serif', fontWeight: 900, color: '#0F172A', fontSize: '1.6rem', letterSpacing: '0.03em' }}>
              GK Motors
            </span>
          </Link>
          <h1 className="register-title" style={{ color: '#111', fontSize: '1.6rem', fontWeight: 900, marginTop: '1rem', fontFamily: 'Rajdhani, sans-serif' }}>Create Account</h1>
          <p className="register-subtitle" style={{ color: '#64748B', marginTop: '0.3rem', fontWeight: 600, fontSize: '0.9rem' }}>Join India's most elite car marketplace</p>
        </div>
 
        <div className="register-container" style={{ background: '#FFF', border: '1px solid #EEE', borderRadius: '20px', padding: '1.5rem', boxShadow: '0 10px 40px rgba(0,0,0,0.03)' }}>
          <form onSubmit={handleSubmit(onSubmit)}>
            {[
              { name: 'name', label: 'Full Name', icon: User, placeholder: 'John Doe', type: 'text', rules: { required: 'Name is required' } },
              { name: 'email', label: 'Email Address', icon: Mail, placeholder: 'you@example.com', type: 'email', rules: { pattern: { value: /^\S+@\S+$/i, message: 'Invalid email' } } },
              { name: 'phone', label: 'Mobile Number', icon: Phone, placeholder: '+91 98765 43210', type: 'tel', rules: {} },
            ].map(({ name, label, icon: Icon, placeholder, type, rules }) => (
              <div key={name} className="form-input-wrapper" style={{ marginBottom: '0.8rem' }}>
                <label className="form-label" style={{ color: '#333', fontSize: '0.8rem', fontWeight: 700, display: 'block', marginBottom: '0.3rem' }}>{label}</label>
                <div style={{ position: 'relative' }}>
                  <Icon size={15} style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: '#AAA' }} />
                  <input type={type} className="input-light form-input" style={{ paddingLeft: '2.8rem', height: '44px', fontSize: '0.85rem' }} placeholder={placeholder} {...register(name, rules)} />
                </div>
                {errors[name] && <p style={{ color: '#1E3A8A', fontSize: '0.82rem', marginTop: '0.4rem', fontWeight: 700 }}>{errors[name].message}</p>}
              </div>
            ))}
 
            <div className="form-input-wrapper" style={{ marginBottom: '1rem' }}>
              <label className="form-label" style={{ color: '#333', fontSize: '0.8rem', fontWeight: 700, display: 'block', marginBottom: '0.3rem' }}>Password</label>
              <div style={{ position: 'relative' }}>
                <Lock size={15} style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: '#AAA' }} />
                <input type={showPass ? 'text' : 'password'} className="input-light form-input" style={{ paddingLeft: '2.8rem', paddingRight: '2.8rem', height: '44px', fontSize: '0.85rem' }}
                  placeholder="Min. 6 characters"
                  {...register('password', { required: 'Password required', minLength: { value: 6, message: 'Min 6 characters' } })} />
                <button type="button" onClick={() => setShowPass(!showPass)}
                  style={{ position: 'absolute', right: 14, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: '#AAA', cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
                  {showPass ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
              {errors.password && <p style={{ color: '#1E3A8A', fontSize: '0.82rem', marginTop: '0.4rem', fontWeight: 700 }}>{errors.password.message}</p>}
            </div>
 
            <p className="terms-text" style={{ color: '#94A3B8', fontSize: '0.78rem', marginBottom: '1.2rem', lineHeight: 1.4, fontWeight: 500 }}>
              By creating an account, you agree to our{' '}
              <Link to="/terms" style={{ color: '#1E3A8A', textDecoration: 'none', fontWeight: 800 }}>Terms</Link> and{' '}
              <Link to="/privacy" style={{ color: '#1E3A8A', textDecoration: 'none', fontWeight: 800 }}>Privacy</Link>.
            </p>
 
            <button type="submit" className="btn-primary submit-btn" 
              style={{ width: '100%', justifyContent: 'center', padding: '1rem', fontSize: '1rem', fontWeight: 800, borderRadius: '16px', background: '#1E3A8A', border: 'none', color: 'white', cursor: 'pointer', fontFamily: 'Rajdhani, sans-serif', letterSpacing: '0.1em', boxShadow: '0 12px 30px rgba(30, 58, 138, 0.25)', transition: 'all 0.3s' }} 
              disabled={loading}
              onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-5px)'; e.currentTarget.style.background = '#172554'; }}
              onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.background = '#1E3A8A'; }}>
              {loading ? <Loader size={20} style={{ animation: 'spin 1s linear infinite' }} /> : <><ArrowRight size={20} /> AUTHORIZE ACCOUNT</>}
            </button>
          </form>
        </div>
 
        <p className="signin-text" style={{ textAlign: 'center', color: '#64748B', marginTop: '1.2rem', fontSize: '0.9rem', fontWeight: 600 }}>
          Already have an account?{' '}
          <Link to={redirectTo !== '/' ? `/login?redirect=${encodeURIComponent(redirectTo)}` : "/login"} style={{ color: '#1E3A8A', textDecoration: 'none', fontWeight: 800 }}>Sign in</Link>
        </p>
      </div>
    </div>
  );
}

