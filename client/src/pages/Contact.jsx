/* ═══════════════════════════════════════════════════════════════════════════
   CONTACT — rebuilt on the design system

   The form's BEHAVIOUR is carried over unchanged: the same client-side checks
   mirroring the server's, the same "leave an email or a phone number" rule,
   the same double-submit guard and the same error reporting. This is the most
   exposed input on the site — public and unauthenticated — so none of that
   validation was touched, only the markup around it.

   What did change:

   • THE MAP SHOWED MUMBAI. The embedded iframe was a place-ID URL for central
     Mumbai, inherited from the template this project was forked from. It now
     uses BIZ.mapEmbed, which points at Sheela Bypass.
   • "India's most trusted auto platform" was the page's opening line. GK
     Motors is one workshop in Rohtak — that sentence is untrue, and generic
     besides.
   • Every contact detail is read from BIZ rather than typed in, so this page
     cannot drift away from the nav, the footer and the booking flow again.
   • The inputs get real <label>s. They were placeholder-only, which vanishes
     the moment someone starts typing and leaves a screen reader with an
     unnamed field.
   ═══════════════════════════════════════════════════════════════════════════ */
import { useState } from 'react';
import {
  Mail, Phone, MapPin, Clock, Send, User, Loader, MessageCircle, Navigation,
} from 'lucide-react';
import toast from 'react-hot-toast';
import {
  cleanText, cleanMultiline, textError, multilineError, emailError, phoneError, validateAll,
} from '../utils/validate';
import { sendContactMessage } from '../api/contactApi';
import { reportApiError } from '../api/apiError';
import PageHero from '../components/common/PageHero';
import { Reveal } from '../components/common/Motion';
import { C, BIZ } from '../theme';

const SERVICE_TYPES = [
  'Periodic service', 'AC service & repair', 'Denting & painting',
  'Insurance claim', 'Batteries', 'Tyres & wheels', 'Something else',
];

export default function Contact() {
  const [formData, setFormData] = useState({
    name: '', email: '', phone: '',
    serviceType: SERVICE_TYPES[0],
    message: '',
  });
  const [submitting, setSubmitting] = useState(false);

  const set = (k) => (e) => setFormData((f) => ({ ...f, [k]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (submitting) return;   // guard against a double click

    /* This form is public and unauthenticated, so it is the most exposed input
       on the site. The checks mirror the server's exactly. */
    const errors = validateAll({
      name: () => textError(formData.name, { label: 'Name', min: 2, max: 80, required: true }),
      message: () => multilineError(formData.message, { label: 'Message', min: 2, max: 4000, required: true }),
      email: () => emailError(formData.email),
      phone: () => phoneError(formData.phone),
    });
    const firstError = Object.values(errors)[0];
    if (firstError) {
      toast.error(firstError);
      return;
    }
    if (!cleanText(formData.email) && !cleanText(formData.phone)) {
      toast.error('Leave an email or a phone number so we can reply');
      return;
    }

    setSubmitting(true);
    try {
      const { data } = await sendContactMessage({
        name: cleanText(formData.name),
        email: cleanText(formData.email).toLowerCase(),
        phone: cleanText(formData.phone),
        serviceType: cleanText(formData.serviceType),
        message: cleanMultiline(formData.message),
      });
      toast.success(data.message || "Thanks — we'll be in touch shortly.");
      setFormData({ name: '', email: '', phone: '', serviceType: SERVICE_TYPES[0], message: '' });
    } catch (err) {
      toast.error(reportApiError('Contact.handleSubmit', err, 'Could not send your message'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div style={{ flex: '1 0 auto', background: C.white, width: '100%' }}>
      <style>{CONTACT_STYLES}</style>

      <PageHero
        crumb={{ label: 'Contact' }}
        eyebrow="Get in touch"
        title="Tell us what the"
        highlight="car is doing."
        lede="Describe the noise, send a photo, or just ask what something costs. Someone at the workshop answers — there is no call centre in between."
      >
        <a href={`tel:${BIZ.phoneTel}`} className="gk-btn gk-btn--primary gk-btn--lg">
          <Phone size={17} /> {BIZ.phoneDisplay}
        </a>
        <a href={`https://wa.me/${BIZ.whatsapp}`} target="_blank" rel="noreferrer noopener"
          className="gk-btn gk-btn--ghost gk-btn--lg">
          <MessageCircle size={17} /> WhatsApp us
        </a>
      </PageHero>

      <section className="gk-sec">
        <div className="gk-wrap">
          <div className="gk-ct-grid">

            {/* ── Details ─────────────────────────────────────────────── */}
            <Reveal x={-18} y={0}>
              <p className="gk-eyebrow">Where and when</p>
              <h2 className="gk-h2">
                One workshop, <span className="gk-grad">one number</span>
              </h2>

              <ul className="gk-ct-rows">
                <li>
                  <span className="gk-chip gk-chip--sm gk-chip--on"><MapPin size={18} /></span>
                  <span>
                    <b>{BIZ.name}</b>
                    <span>{BIZ.addressLine1}<br />{BIZ.addressLine2}</span>
                    <a href={BIZ.mapsUrl} target="_blank" rel="noreferrer noopener">
                      <Navigation size={13} /> Get directions
                    </a>
                  </span>
                </li>
                <li>
                  <span className="gk-chip gk-chip--sm"><Phone size={18} /></span>
                  <span>
                    <b><a href={`tel:${BIZ.phoneTel}`}>{BIZ.phoneDisplay}</a></b>
                    <span>Call or WhatsApp, seven days a week</span>
                  </span>
                </li>
                <li>
                  <span className="gk-chip gk-chip--sm"><Mail size={18} /></span>
                  <span>
                    <b><a href={`mailto:${BIZ.email}`}>{BIZ.email}</a></b>
                    <span>For invoices, claim paperwork and anything in writing</span>
                  </span>
                </li>
                <li>
                  <span className="gk-chip gk-chip--sm"><Clock size={18} /></span>
                  <span>
                    <b>{BIZ.hours}</b>
                    <span>{BIZ.hoursSunday}</span>
                  </span>
                </li>
              </ul>
            </Reveal>

            {/* ── Form ────────────────────────────────────────────────── */}
            <Reveal x={18} y={0} delay={0.08}>
              <div className="gk-card gk-ct-form">
                <h2 className="gk-h3" style={{ fontSize: '1.3rem' }}>Send us a message</h2>
                <p className="gk-ct-formsub">
                  We read every one. Leave a phone number if you would rather we called.
                </p>

                {/* noValidate: the browser's own validation bubbles would fire
                    before our checks run and would word things differently. */}
                <form onSubmit={handleSubmit} noValidate className="gk-ct-fields">
                  <div className="gk-field">
                    <label htmlFor="ct-name">Your name</label>
                    <span className="gk-field-wrap">
                      <User size={17} aria-hidden="true" />
                      <input id="ct-name" type="text" autoComplete="name"
                        placeholder="Rajender Dahiya"
                        value={formData.name} onChange={set('name')} />
                    </span>
                  </div>

                  <div className="gk-field-row">
                    <div className="gk-field">
                      <label htmlFor="ct-phone">Phone</label>
                      <span className="gk-field-wrap">
                        <Phone size={17} aria-hidden="true" />
                        <input id="ct-phone" type="tel" autoComplete="tel"
                          inputMode="tel" placeholder="09355 99664"
                          value={formData.phone} onChange={set('phone')} />
                      </span>
                    </div>
                    <div className="gk-field">
                      <label htmlFor="ct-email">Email</label>
                      <span className="gk-field-wrap">
                        <Mail size={17} aria-hidden="true" />
                        <input id="ct-email" type="email" autoComplete="email"
                          inputMode="email" placeholder="you@example.com"
                          value={formData.email} onChange={set('email')} />
                      </span>
                    </div>
                  </div>
                  <p className="gk-field-hint">Either one is enough — we just need a way to reply.</p>

                  <div className="gk-field">
                    <label htmlFor="ct-service">What is it about?</label>
                    <span className="gk-field-wrap">
                      <select id="ct-service" value={formData.serviceType} onChange={set('serviceType')}>
                        {SERVICE_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                      </select>
                    </span>
                  </div>

                  <div className="gk-field">
                    <label htmlFor="ct-message">Message</label>
                    <span className="gk-field-wrap">
                      <textarea id="ct-message" rows={4}
                        placeholder="A rattle from the front left when I go over speed breakers…"
                        value={formData.message} onChange={set('message')} />
                    </span>
                  </div>

                  <button type="submit" disabled={submitting}
                    className="gk-btn gk-btn--primary" style={{ width: '100%' }}>
                    {submitting
                      ? <>Sending… <Loader size={17} className="gk-spin" /></>
                      : <>Send message <Send size={17} /></>}
                  </button>
                </form>
              </div>
            </Reveal>
          </div>
        </div>
      </section>

      {/* ── Map ──────────────────────────────────────────────────────────
          Lazy: an embedded map pulls in a substantial amount of Google's own
          script and tiles, and it sits below the fold at every screen size. */}
      <section className="gk-ct-map">
        <div className="gk-wrap">
          <Reveal y={16} className="gk-ct-maphead">
            <div>
              <p className="gk-eyebrow">Find us</p>
              <h2 className="gk-h3" style={{ fontSize: '1.15rem' }}>
                Sheela Bypass, near the new railway crossing
              </h2>
            </div>
            <a href={BIZ.mapsUrl} target="_blank" rel="noreferrer noopener"
              className="gk-btn gk-btn--outline gk-btn--sm">
              <Navigation size={15} /> Open in Google Maps
            </a>
          </Reveal>
        </div>
        <div className="gk-ct-mapframe">
          <iframe
            title={`${BIZ.name} on Google Maps — ${BIZ.addressShort}`}
            src={BIZ.mapEmbed}
            loading="lazy"
            referrerPolicy="no-referrer-when-downgrade"
            allowFullScreen
          />
        </div>
      </section>
    </div>
  );
}

const CONTACT_STYLES = `
  .gk-ct-grid {
    display: grid;
    grid-template-columns: minmax(0, 0.9fr) minmax(0, 1.1fr);
    gap: clamp(2rem, 5vw, 4rem);
    align-items: start;
  }
  @media (max-width: 940px) { .gk-ct-grid { grid-template-columns: minmax(0, 1fr); } }

  /* ── Detail rows ───────────────────────────────────────────────────────── */
  .gk-ct-rows { list-style: none; margin: 2rem 0 0; padding: 0; }
  .gk-ct-rows li {
    display: flex; align-items: flex-start; gap: 0.95rem;
    padding: 1.2rem 0;
    border-bottom: 1px solid var(--gk-hairline);
  }
  .gk-ct-rows li:last-child { border-bottom: 0; }
  .gk-ct-rows li > span:last-child { display: flex; flex-direction: column; min-width: 0; }
  .gk-ct-rows b {
    font-family: var(--gk-font-display); font-size: 0.95rem; font-weight: 700;
    color: var(--gk-navy); letter-spacing: -.01em;
  }
  .gk-ct-rows b a { color: inherit; text-decoration: none; transition: color .25s; }
  .gk-ct-rows b a:hover { color: var(--gk-blue); }
  .gk-ct-rows li > span:last-child > span {
    font-size: 0.85rem; line-height: 1.6; color: var(--gk-body); margin-top: 0.25rem;
  }
  .gk-ct-rows li > span:last-child > a {
    display: inline-flex; align-items: center; gap: 0.35rem;
    margin-top: 0.6rem; text-decoration: none;
    color: var(--gk-blue); font-size: 0.82rem; font-weight: 700;
  }
  .gk-ct-rows li > span:last-child > a:hover { text-decoration: underline; }

  /* ── Form ──────────────────────────────────────────────────────────────── */
  .gk-ct-form { padding: clamp(1.5rem, 3vw, 2.1rem); }
  .gk-ct-formsub {
    font-size: 0.86rem; line-height: 1.6; color: var(--gk-body); margin: 0.5rem 0 0;
  }
  .gk-ct-fields { display: flex; flex-direction: column; gap: 1.05rem; margin-top: 1.6rem; }

  .gk-field { display: flex; flex-direction: column; gap: 0.4rem; min-width: 0; }
  .gk-field label {
    font-family: var(--gk-font-display);
    font-size: 0.75rem; font-weight: 700; letter-spacing: .06em;
    text-transform: uppercase; color: var(--gk-meta);
  }
  .gk-field-wrap { position: relative; display: block; }
  .gk-field-wrap > svg {
    position: absolute; left: 0.95rem; top: 0.95rem;
    color: var(--gk-meta); pointer-events: none;
  }
  .gk-field input, .gk-field select, .gk-field textarea {
    width: 100%;
    /* 16px on the control itself: below that, iOS zooms the whole page in when
       a field is focused, which on a form this long is disorienting. */
    font-size: 16px;
    font-family: var(--gk-font-sans);
    color: var(--gk-navy);
    background: #FFFFFF;
    border: 1.5px solid var(--gk-hairline);
    border-radius: 12px;
    padding: 0.85rem 1rem 0.85rem 2.85rem;
    transition: border-color .25s, box-shadow .25s;
    -webkit-appearance: none; appearance: none;
  }
  /* No leading icon on these two, so the padding goes back. */
  .gk-field textarea, .gk-field select { padding-left: 1rem; }
  .gk-field textarea { resize: vertical; min-height: 118px; line-height: 1.6; }
  .gk-field select {
    /* appearance:none removes the native arrow, so one is drawn back in. An
       inline data URI rather than a file: it is a few bytes and cannot 404. */
    background-image: url("data:image/svg+xml;charset=utf-8,%3Csvg xmlns='http://www.w3.org/2000/svg' width='14' height='14' viewBox='0 0 24 24' fill='none' stroke='%2377879C' stroke-width='2.5' stroke-linecap='round'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E");
    background-repeat: no-repeat;
    background-position: right 1rem center;
    padding-right: 2.6rem;
    cursor: pointer;
  }
  .gk-field input::placeholder, .gk-field textarea::placeholder { color: #A8B6C6; }
  .gk-field input:focus, .gk-field select:focus, .gk-field textarea:focus {
    outline: none;
    border-color: var(--gk-blue);
    box-shadow: 0 0 0 4px rgba(21,103,211,.12);
  }

  .gk-field-row { display: grid; grid-template-columns: 1fr 1fr; gap: 1.05rem; }
  @media (max-width: 560px) { .gk-field-row { grid-template-columns: 1fr; } }

  .gk-field-hint { font-size: 0.78rem; color: var(--gk-meta); margin: -0.5rem 0 0; }

  .gk-spin { animation: gk-rot .9s linear infinite; }
  @keyframes gk-rot { to { transform: rotate(360deg); } }
  @media (prefers-reduced-motion: reduce) { .gk-spin { animation: none; } }

  /* ── Map ───────────────────────────────────────────────────────────────── */
  .gk-ct-map {
    background: var(--gk-surface);
    border-top: 1px solid var(--gk-hairline);
    padding-top: clamp(2rem, 4vw, 3rem);
  }
  .gk-ct-maphead {
    display: flex; flex-wrap: wrap; gap: 1rem;
    align-items: flex-end; justify-content: space-between;
    margin-bottom: 1.5rem;
  }
  /* aspect-ratio with a max-height rather than a fixed 480px: at phone width a
     fixed height is a letterbox, and on a very wide screen it is a strip. */
  .gk-ct-mapframe {
    width: 100%;
    aspect-ratio: 21 / 9;
    max-height: 520px;
    min-height: 300px;
    background: var(--gk-surface-alt);
  }
  .gk-ct-mapframe iframe { width: 100%; height: 100%; border: 0; display: block; }
`;
