import { useState, useEffect } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { useAuth } from '../context/AuthContext';
import { sendOTP } from '../api/authApi';
import toast from 'react-hot-toast';
import { Eye, EyeOff, Lock, Mail, ArrowRight, Loader, RotateCw } from 'lucide-react';

export default function Login() {
  const { login, loginWithOTP, loading } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  // Where to send the user once they are in. Only same-origin paths are
  // honoured so a crafted ?redirect= cannot bounce them off-site.
  const rawRedirect = searchParams.get('redirect') || '/';
  const redirectTo = rawRedirect.startsWith('/') && !rawRedirect.startsWith('//') ? rawRedirect : '/';
  const [mode, setMode] = useState('password'); // 'password' | 'otp'
  const [otpSent, setOtpSent] = useState(false);
  const [showPass, setShowPass] = useState(false);
  const [requiresSecretKey, setRequiresSecretKey] = useState(false);
  const { register, handleSubmit, watch, setValue, formState: { errors } } = useForm();

  // Seconds until 'Resend code' becomes available again. The server caps OTP
  // requests at five per fifteen minutes, so an eager resend button just burns
  // the user's own budget.
  const [resendIn, setResendIn] = useState(0);
  useEffect(() => {
    if (resendIn <= 0) return undefined;
    const t = setTimeout(() => setResendIn((n) => n - 1), 1000);
    return () => clearTimeout(t);
  }, [resendIn]);

  const emailValue = watch('email');
  // Once a code is out, the address it was sent to is fixed — editing it here
  // and then verifying would submit a code against a different account.
  const emailLocked = mode === 'otp' && otpSent;

  const requestOtp = async (email) => {
    await sendOTP({ email });
    setOtpSent(true);
    setResendIn(30);
    setValue('otp', '');
    toast.success('Code sent — check your inbox.');
  };

  /** Back to the address step, so a typo can be corrected. */
  const changeEmail = () => {
    setOtpSent(false);
    setResendIn(0);
    setValue('otp', '');
  };

  const resend = async () => {
    if (resendIn > 0 || !emailValue) return;
    try {
      await requestOtp(emailValue);
    } catch (err) {
      toast.error(err.message);
    }
  };

  const onSubmit = async (data) => {
    try {
      if (mode === 'password') {
        const res = await login(data);
        if (res?.requiresSecretKey) {
          setRequiresSecretKey(true);
          toast.success('Admin secret key required');
          return;
        }
        toast.success('Welcome back!');
        navigate(redirectTo, { replace: true });
      } else if (!otpSent) {
        await requestOtp(data.email);
      } else {
        await loginWithOTP({ email: data.email, otp: data.otp });
        toast.success('Welcome!');
        navigate(redirectTo, { replace: true });
      }
    } catch (err) {
      toast.error(err.message);
    }
  };

  return (
    <div style={{ minHeight: '100vh', background: '#FFFFFF', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0.5rem 1rem' }}>
      <style>{`
        @media (max-width: 640px) {
          .login-container { padding: 1rem !important; border-radius: 16px !important; }
          .login-logo img { height: 36px !important; }
          .login-logo span { font-size: 1.15rem !important; }
          .login-title { font-size: 1.2rem !important; margin-top: 0.6rem !important; }
          .login-subtitle { font-size: 0.7rem !important; margin-top: 0.1rem !important; }
          .mode-toggle { margin-bottom: 1rem !important; border-radius: 10px !important; }
          .mode-toggle button { font-size: 0.7rem !important; padding: 0.4rem !important; }
          .form-label { font-size: 0.7rem !important; margin-bottom: 0.2rem !important; }
          .form-input-wrapper { margin-bottom: 0.8rem !important; }
          .form-input { height: 40px !important; font-size: 0.8rem !important; }
          .submit-btn { padding: 0.7rem !important; font-size: 0.85rem !important; border-radius: 10px !important; }
          .signup-text { margin-top: 0.8rem !important; font-size: 0.8rem !important; }
        }
      `}</style>
      <div style={{ width: '100%', maxWidth: 440 }}>
        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: '1.2rem' }}>
          <Link to="/" className="login-logo" style={{ textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}>
            <img src="/gkmotorslogo.png" alt="GK Motors" style={{ height: 54, width: 'auto', objectFit: 'contain', display: 'block' }} />
            <span style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 900, color: '#0F172A', fontSize: '1.6rem', letterSpacing: '0.03em' }}>
              GK Motors
            </span>
          </Link>
          <h1 className="login-title" style={{ color: '#111', fontSize: '1.6rem', fontWeight: 900, marginTop: '1rem', fontFamily: "'Space Grotesk', sans-serif" }}>Welcome Back</h1>
          <p className="login-subtitle" style={{ color: '#666', marginTop: '0.3rem', fontWeight: 500, fontSize: '0.9rem' }}>Login to continue to your account</p>
        </div>
 
        {/* Mode toggle */}
        <div className="mode-toggle" style={{ display: 'flex', background: '#F5F5F5', borderRadius: '12px', padding: '4px', marginBottom: '1.5rem', border: '1px solid #EEE' }}>
          {['password', 'otp'].map((m) => (
            <button key={m} onClick={() => { setMode(m); setOtpSent(false); setResendIn(0); setRequiresSecretKey(false); setValue('otp', ''); }}
              style={{
                flex: 1, padding: '0.7rem', borderRadius: '8px', border: 'none', cursor: 'pointer',
                background: mode === m ? '#FFF' : 'transparent',
                color: mode === m ? '#2563EB' : '#888',
                fontWeight: 700, fontSize: '0.9rem', transition: 'all 0.25s',
                boxShadow: mode === m ? '0 4px 12px rgba(37, 99, 235, 0.1)' : 'none'
              }}>
              {m === 'password' ? 'Password' : 'OTP Login'}
            </button>
          ))}
        </div>
 
        {/* Form card */}
        <div className="login-container" style={{ background: '#FFF', border: '1px solid #EEE', borderRadius: '20px', padding: '1.8rem', boxShadow: '0 10px 40px rgba(0,0,0,0.03)' }}>
          <form onSubmit={handleSubmit(onSubmit)}>
            {/* Email */}
            <div className="form-input-wrapper" style={{ marginBottom: '1.2rem' }}>
              <label className="form-label" style={{ color: '#333', fontSize: '0.8rem', fontWeight: 700, display: 'block', marginBottom: '0.4rem' }}>Email Address</label>
              <div style={{ position: 'relative' }}>
                <Mail size={15} style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: '#AAA' }} />
                <input type="email" className="input-light form-input" style={{ paddingLeft: '2.8rem', height: '48px', fontSize: '0.9rem', background: emailLocked ? '#F8FAFC' : undefined }}
                  placeholder="you@example.com"
                  autoComplete="email"
                  readOnly={requiresSecretKey || emailLocked}
                  {...register('email', {
                    required: 'Email address is required',
                    pattern: { value: /^\S+@\S+\.\S+$/, message: 'Enter a valid email address' },
                  })} />
              </div>
              {errors.email && <p style={{ color: '#E53935', fontSize: '0.82rem', marginTop: '0.4rem', fontWeight: 600 }}>{errors.email.message}</p>}
            </div>
 
            {/* Password */}
            {mode === 'password' && (
              <div className="form-input-wrapper" style={{ marginBottom: '1.2rem' }}>
                <label className="form-label" style={{ color: '#333', fontSize: '0.8rem', fontWeight: 700, display: 'block', marginBottom: '0.4rem' }}>Password</label>
                <div style={{ position: 'relative' }}>
                  <Lock size={15} style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: '#AAA' }} />
                  <input type={showPass ? 'text' : 'password'} className="input-light form-input" style={{ paddingLeft: '2.8rem', paddingRight: '2.8rem', height: '48px', fontSize: '0.9rem' }}
                    placeholder="••••••••"
                    readOnly={requiresSecretKey}
                    {...register('password', { required: 'Password is required' })} />
                  <button type="button" onClick={() => setShowPass(!showPass)}
                    style={{ position: 'absolute', right: 14, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: '#AAA', cursor: 'pointer', display: 'flex', alignItems: 'center' }}
                    disabled={requiresSecretKey}>
                    {showPass ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
                {errors.password && <p style={{ color: '#E53935', fontSize: '0.82rem', marginTop: '0.4rem', fontWeight: 600 }}>{errors.password.message}</p>}
              </div>
            )}

            {/* Admin Secret Key */}
            {mode === 'password' && requiresSecretKey && (
              <div className="form-input-wrapper" style={{ marginBottom: '1.2rem' }}>
                <label className="form-label" style={{ color: '#333', fontSize: '0.8rem', fontWeight: 700, display: 'block', marginBottom: '0.4rem' }}>Admin Secret Key</label>
                <div style={{ position: 'relative' }}>
                  <Lock size={15} style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: '#AAA' }} />
                  <input type="password" className="input-light form-input" style={{ paddingLeft: '2.8rem', height: '48px', fontSize: '0.9rem' }}
                    placeholder="Enter secret key"
                    autoFocus
                    {...register('secretKey', { required: 'Secret key is required' })} />
                </div>
                {errors.secretKey && <p style={{ color: '#E53935', fontSize: '0.82rem', marginTop: '0.4rem', fontWeight: 600 }}>{errors.secretKey.message}</p>}
              </div>
            )}
 
            {/* OTP Input */}
            {mode === 'otp' && otpSent && (
              <div className="form-input-wrapper" style={{ marginBottom: '1.2rem' }}>
                <label className="form-label" style={{ color: '#333', fontSize: '0.8rem', fontWeight: 700, display: 'block', marginBottom: '0.4rem' }}>Enter the 6-digit code</label>
                <input type="text" className="input-light form-input" placeholder="000000"
                  inputMode="numeric" autoComplete="one-time-code" autoFocus
                  maxLength={6} style={{ textAlign: 'center', fontSize: '1.2rem', letterSpacing: '0.4rem', height: '50px' }}
                  {...register('otp', {
                    required: 'Enter the code we emailed you',
                    pattern: { value: /^\d{6}$/, message: 'The code is 6 digits' },
                  })} />
                {errors.otp && <p style={{ color: '#E53935', fontSize: '0.82rem', marginTop: '0.4rem', fontWeight: 600 }}>{errors.otp.message}</p>}
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem 1rem', alignItems: 'center', justifyContent: 'space-between', marginTop: '0.6rem' }}>
                  <span style={{ color: '#64748B', fontSize: '0.78rem', fontWeight: 500 }}>
                    Valid for 10 minutes.
                  </span>
                  <div style={{ display: 'flex', gap: '0.9rem' }}>
                    <button type="button" onClick={resend} disabled={resendIn > 0}
                      style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem', background: 'none', border: 'none', padding: 0, fontSize: '0.78rem', fontWeight: 700, cursor: resendIn > 0 ? 'default' : 'pointer', color: resendIn > 0 ? '#94A3B8' : '#2563EB' }}>
                      <RotateCw size={13} />
                      {resendIn > 0 ? `Resend in ${resendIn}s` : 'Resend code'}
                    </button>
                    <button type="button" onClick={changeEmail}
                      style={{ background: 'none', border: 'none', padding: 0, fontSize: '0.78rem', fontWeight: 700, color: '#2563EB', cursor: 'pointer' }}>
                      Change email
                    </button>
                  </div>
                </div>
              </div>
            )}
 
            <button type="submit" className="btn-primary submit-btn" style={{ width: '100%', justifyContent: 'center', padding: '0.9rem', fontSize: '1rem', fontWeight: 700, borderRadius: '12px' }} disabled={loading}>
              {loading ? <Loader size={20} style={{ animation: 'spin 1s linear infinite' }} /> : (
                <>
                  {mode === 'password' ? 'LOGIN' : otpSent ? 'VERIFY OTP' : 'SEND OTP'}
                  <ArrowRight size={20} />
                </>
              )}
            </button>
          </form>
        </div>
 
        <p className="signup-text" style={{ textAlign: 'center', color: '#666', marginTop: '1.2rem', fontSize: '0.9rem', fontWeight: 500 }}>
          Don't have an account?{' '}
          <Link to={redirectTo !== '/' ? `/register?redirect=${encodeURIComponent(redirectTo)}` : "/register"} style={{ color: '#2563EB', textDecoration: 'none', fontWeight: 700 }}>Sign Up Now</Link>
        </p>
      </div>
    </div>
  );
}

