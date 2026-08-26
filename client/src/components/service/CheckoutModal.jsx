import { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  X, Calendar, MapPin, CreditCard, ChevronLeft, ChevronRight, Check,
  Crosshair, Loader, Plus, AlertCircle, Car as CarIcon, Truck, Home,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuth } from '../../context/AuthContext';
import { useServiceCart } from '../../context/CartContext';
import {
  getAvailability, createServiceBooking, createServicePayment, verifyServicePayment,
  reportServicePaymentFailed,
} from '../../api/serviceApi';
import { getMe, addAddress } from '../../api/authApi';
import { reportApiError } from '../../api/apiError';
import { cleanText, textError, pincodeError, validateAll } from '../../utils/validate';
import { istNow, slotMinutes, addIstDays, formatIstDate } from '../../utils/istTime';

const MAX_DAYS_AHEAD = 30;
const LAST_BOOKABLE_HOUR = 18;   // same-day bookings close once 18:00 passes

// The workshop. Shown as the drop-off point when the customer brings the car
// in, and as the collection point when they choose to pick it up themselves.
const SERVICE_CENTER = {
  label: 'GK Motors Service Centre',
  street: 'Sheela By Pass, near New Railway Crossing, Jasbir Colony, Sector-5',
  city: 'Rohtak',
  state: 'Haryana',
  pincode: '124001',
  fullAddress:
    'GK Motors, Sheela By Pass, near New Railway Crossing, Jasbir Colony, Sector-5, Rohtak, Haryana 124001',
};

// Doorstep pickup runs 09:00-18:00, so the 18:00 slot — the last one bookable —
// is out: there is no room after it for a driver to collect the car and get it
// back the same day. The server re-checks this; this is just the UI half.
/**
 * Mirrors the same check on the server (controllers/serviceController.js).
 * A slot qualifies when it sits inside the 9-to-6 window and, if the customer
 * picked today, has not already passed in Rohtak. Judged in IST so a phone set
 * to another timezone still sees the workshop's real availability.
 */
const isPickupDropAvailable = (time, date) => {
  const mins = slotMinutes(time);
  if (mins === null) return false;

  const hour = Math.floor(mins / 60);
  if (hour < 9 || hour >= LAST_BOOKABLE_HOUR) return false;

  if (date) {
    const now = istNow();
    if (String(date).slice(0, 10) === now.date && mins <= now.minutes) return false;
  }
  return true;
};

const stripAddress = (a) => (a ? {
  label: a.label || 'Address',
  street: a.street, city: a.city, state: a.state, pincode: a.pincode,
  lat: a.lat, lng: a.lng,
} : null);

const formatAddress = (a) =>
  a ? [a.street, a.city, a.state, a.pincode].filter(Boolean).join(', ') : '';

const toISODate = (d) => {
  const local = new Date(d.getTime() - d.getTimezoneOffset() * 60000);
  return local.toISOString().split('T')[0];
};

const prettyTime = (hhmm) => {
  const [h] = hhmm.split(':').map(Number);
  const suffix = h >= 12 ? 'PM' : 'AM';
  const hour12 = h % 12 === 0 ? 12 : h % 12;
  return `${hour12}:00 ${suffix}`;
};

const loadRazorpay = () =>
  new Promise((resolve) => {
    if (window.Razorpay) return resolve(true);
    const s = document.createElement('script');
    s.src = 'https://checkout.razorpay.com/v1/checkout.js';
    s.onload = () => resolve(true);
    s.onerror = () => resolve(false);
    document.body.appendChild(s);
  });

/* ── Pending-booking handoff ───────────────────────────────────────────────
   The booking row is written before the customer ever reaches the Razorpay
   sheet, so a cancelled or failed payment leaves a real, still-payable
   booking behind. That id used to live only in component state, which is
   reset every time the modal opens — so closing the modal after a failed
   payment and trying again created a SECOND booking for the same job.

   It is parked in sessionStorage instead, tagged with a signature of the
   inputs that define the booking. Reuse requires the signature to still
   match: change the car, the services, the slot, the address or the pickup
   choice and the pending booking no longer describes what the customer is
   buying, so a fresh one is created rather than charging them for the wrong
   thing.

   sessionStorage rather than localStorage — this handoff belongs to one tab
   and one sitting, and should not outlive the browser session.            */
const PENDING_BOOKING_KEY = 'gkmotors_pending_booking';

/* Server-side an unpaid booking only holds its slot for SLOT_HOLD_MINUTES.
   Well past that there is nothing worth resuming, so the handoff is dropped
   rather than resurrected hours later. */
const PENDING_BOOKING_TTL_MS = 60 * 60 * 1000;

const readPendingBooking = () => {
  try {
    const raw = sessionStorage.getItem(PENDING_BOOKING_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed.id !== 'string' || typeof parsed.key !== 'string') return null;
    if (!Number.isFinite(parsed.at) || Date.now() - parsed.at > PENDING_BOOKING_TTL_MS) {
      sessionStorage.removeItem(PENDING_BOOKING_KEY);
      return null;
    }
    return parsed;
  } catch (err) {
    // Private browsing, quota, or corrupt JSON — behave as if there were none.
    console.error('CheckoutModal: could not read the pending booking ->', err.message);
    return null;
  }
};

const writePendingBooking = (id, key) => {
  try {
    sessionStorage.setItem(PENDING_BOOKING_KEY, JSON.stringify({ id, key, at: Date.now() }));
  } catch (err) {
    // Non-fatal: the id still lives in component state for this modal session.
    console.error('CheckoutModal: could not store the pending booking ->', err.message);
  }
};

const clearPendingBooking = () => {
  try {
    sessionStorage.removeItem(PENDING_BOOKING_KEY);
  } catch (err) {
    console.error('CheckoutModal: could not clear the pending booking ->', err.message);
  }
};

/**
 * Everything that decides what this booking *is*.
 *
 * Two checkouts with the same signature are the same purchase and may share a
 * booking row; anything else must not.
 */
const checkoutSignature = ({ car, services, scheduledDate, scheduledTime, addressId, pickupDrop }) =>
  JSON.stringify({
    car: car
      ? [car.carId ?? '', car.brand, car.model, car.year, car.isManualEntry ? 1 : 0]
      : null,
    services: services.map((s) => String(s.serviceType || s.serviceId)).sort(),
    scheduledDate,
    scheduledTime,
    addressId: addressId || '',
    pickup: pickupDrop.enabled
      ? [
          1,
          pickupDrop.dropType,
          pickupDrop.pickupAddress?._id || formatAddress(pickupDrop.pickupAddress),
          pickupDrop.dropType === 'different'
            ? (pickupDrop.dropAddress?._id || formatAddress(pickupDrop.dropAddress))
            : '',
        ]
      : [0],
  });

export default function CheckoutModal({ open, onClose }) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { car, services, totalAmount, clearCart } = useServiceCart();

  const [step, setStep] = useState(1);
  const [scheduledDate, setScheduledDate] = useState('');
  const [scheduledTime, setScheduledTime] = useState('');
  const [slots, setSlots] = useState([]);
  const [slotsLoading, setSlotsLoading] = useState(false);

  const [addresses, setAddresses] = useState([]);
  const [addressesLoading, setAddressesLoading] = useState(true);
  const [selectedAddressId, setSelectedAddressId] = useState(null);
  const [addingAddress, setAddingAddress] = useState(false);
  const [savingAddress, setSavingAddress] = useState(false);
  const [locating, setLocating] = useState(false);
  const [addressForm, setAddressForm] = useState({
    label: 'Home', street: '', city: '', state: '', pincode: '', lat: null, lng: null,
  });
  const [addressErrors, setAddressErrors] = useState({});

  // Doorstep pickup & drop. `pickupAddress` / `dropAddress` hold resolved
  // address objects rather than ids, because one of them can come from the
  // browser's geolocation and so has no id at all.
  const [pickupDrop, setPickupDrop] = useState({
    enabled: false,
    pickupAddress: null,
    dropType: 'service_center',
    dropAddress: null,
  });
  const [pickupLocating, setPickupLocating] = useState(false);

  const [paying, setPaying] = useState(false);
  const [payError, setPayError] = useState('');
  // Mirrors the sessionStorage handoff above. sessionStorage is the source of
  // truth, so the id survives the modal being closed and reopened; this is
  // just the copy the current render needs.
  const [bookingId, setBookingId] = useState(() => readPendingBooking()?.id ?? null);

  // ── date bounds ──
  const { minDate, maxDate } = useMemo(() => {
    // Anchored to Rohtak, not to the device. A phone in another timezone would
    // otherwise offer a day that has already ended at the workshop, or refuse
    // one that has not started.
    const now = istNow();
    const firstDay = now.hour >= LAST_BOOKABLE_HOUR ? addIstDays(now.date, 1) : now.date;
    return { minDate: firstDay, maxDate: addIstDays(now.date, MAX_DAYS_AHEAD) };
  }, []);

  // Reset to a clean state each time the modal opens.
  useEffect(() => {
    if (!open) return;
    setStep(1);
    setScheduledDate(minDate);
    setScheduledTime('');
    setPayError('');
    // NOT reset to null: an unpaid booking from an earlier attempt is still
    // payable, and throwing the id away here is what used to make a retry
    // create a duplicate. handlePay re-checks the signature before reusing it.
    setBookingId(readPendingBooking()?.id ?? null);
    setPickupDrop({ enabled: false, pickupAddress: null, dropType: 'service_center', dropAddress: null });
  }, [open, minDate]);

  // Changing to the 18:00 slot after opting in has to revoke the option, or a
  // request the server will reject sits quietly in state until payment.
  useEffect(() => {
    if (scheduledTime && !isPickupDropAvailable(scheduledTime, scheduledDate)) {
      setPickupDrop((prev) => (prev.enabled
        ? { enabled: false, pickupAddress: null, dropType: 'service_center', dropAddress: null }
        : prev));
    }
  }, [scheduledTime, scheduledDate]);

  // ── slots for the chosen day ──
  useEffect(() => {
    if (!open || !scheduledDate) return;
    let cancelled = false;
    setSlotsLoading(true);
    setScheduledTime('');
    getAvailability(scheduledDate)
      .then(({ data }) => { if (!cancelled) setSlots(data.slots || []); })
      .catch((err) => {
        if (cancelled) return;
        reportApiError('CheckoutModal.getAvailability', err);
        // Availability is an enhancement — fall back to every slot open so a
        // failing lookup never blocks a booking.
        setSlots(['09:00','10:00','11:00','12:00','13:00','14:00','15:00','16:00','17:00','18:00']
          .map((time) => ({ time, available: true })));
      })
      .finally(() => { if (!cancelled) setSlotsLoading(false); });
    return () => { cancelled = true; };
  }, [open, scheduledDate]);

  // ── saved addresses ──
  // The login response omits `addresses`, so read the full profile.
  const loadAddresses = useCallback(() => {
    setAddressesLoading(true);
    getMe()
      .then(({ data }) => {
        const list = data.user?.addresses || [];
        setAddresses(list);
        if (list.length) {
          // Drop a selection that no longer exists on the account rather than
          // holding an id the server would reject, and never leave the step
          // with nothing chosen.
          setSelectedAddressId((prev) =>
            (prev && list.some((a) => a._id === prev)) ? prev : list[0]._id
          );
        } else {
          setSelectedAddressId(null);
          setAddingAddress(true);
        }
      })
      .catch((err) => {
        reportApiError('CheckoutModal.getMe', err);
        setAddresses([]);
        setAddingAddress(true);
      })
      .finally(() => setAddressesLoading(false));
  }, []);

  useEffect(() => { if (open && user) loadAddresses(); }, [open, user, loadAddresses]);

  if (!open) return null;

  // ── address helpers ──
  /* Mirrors the rules authController.cleanAddressInput enforces, so an address
     the form accepts is one the API will store. The presence checks were
     already here; what is added is minimum and maximum lengths, and the fact
     that a value made only of markup no longer counts as filled in. */
  const validateAddress = () => {
    const e = validateAll({
      label: () => textError(addressForm.label, { label: 'Label', max: 40 }),
      street: () => textError(addressForm.street, { label: 'Street address', min: 3, max: 200, required: true }),
      city: () => textError(addressForm.city, { label: 'City', min: 2, max: 80, required: true }),
      state: () => textError(addressForm.state, { label: 'State', min: 2, max: 80, required: true }),
      pincode: () => pincodeError(addressForm.pincode),
    });
    setAddressErrors(e);
    return Object.keys(e).length === 0;
  };

  const fetchCurrentAddress = () => {
    if (!navigator.geolocation) {
      toast.error('Your browser does not support location lookup');
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude: lat, longitude: lng } = pos.coords;
        try {
          const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`);
          const data = await res.json();
          const a = data.address || {};
          setAddressForm((prev) => ({
            ...prev,
            street: [a.house_number, a.road, a.neighbourhood, a.suburb].filter(Boolean).join(', ') || prev.street,
            city: a.city || a.town || a.village || a.county || prev.city,
            state: a.state || prev.state,
            pincode: a.postcode || prev.pincode,
            lat, lng,
          }));
          toast.success('Address filled from your location');
        } catch (err) {
          console.error('[CheckoutModal.reverseGeocode]', err);
          setAddressForm((prev) => ({ ...prev, lat, lng }));
          toast.error('Found your location but could not read the address. Please fill it in.');
        } finally {
          setLocating(false);
        }
      },
      (err) => {
        setLocating(false);
        console.error('[CheckoutModal.geolocation]', err);
        if (err.code === err.PERMISSION_DENIED) {
          toast.error('Location permission denied. Please enter your address manually.');
        } else if (err.code === err.TIMEOUT) {
          toast.error('Location lookup timed out. Please enter your address manually.');
        } else {
          toast.error('Could not get your location. Please enter your address manually.');
        }
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  };

  // Same reverse-geocode as the address form, but the result becomes a one-off
  // pickup address rather than being written to the saved-address list.
  const fetchPickupFromLocation = () => {
    if (!navigator.geolocation) {
      toast.error('Your browser does not support location lookup');
      return;
    }
    setPickupLocating(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude: lat, longitude: lng } = pos.coords;
        try {
          const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`);
          const data = await res.json();
          const a = data.address || {};
          const street = [a.house_number, a.road, a.neighbourhood, a.suburb].filter(Boolean).join(', ');
          const city = a.city || a.town || a.village || a.county || '';
          if (!street || !city) {
            toast.error('Could not read a full address from your location. Please pick a saved address.');
            return;
          }
          setPickupDrop((prev) => ({
            ...prev,
            pickupAddress: {
              label: 'Current location',
              street, city,
              state: a.state || '',
              pincode: a.postcode || '',
              lat, lng,
            },
            // A "same as pickup" drop has to follow the pickup point when it moves.
            dropAddress: prev.dropType === 'same' ? null : prev.dropAddress,
          }));
          toast.success('Pickup point set from your location');
        } catch (err) {
          console.error('[CheckoutModal.pickupGeocode]', err);
          toast.error('Found your location but could not read the address. Please pick a saved address.');
        } finally {
          setPickupLocating(false);
        }
      },
      (err) => {
        setPickupLocating(false);
        console.error('[CheckoutModal.pickupGeolocation]', err);
        toast.error(
          err.code === err.PERMISSION_DENIED
            ? 'Location permission denied. Please pick a saved address.'
            : 'Could not get your location. Please pick a saved address.'
        );
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  };

  const saveAddress = async () => {
    if (!validateAddress()) {
      toast.error('Please fix the highlighted fields');
      return;
    }
    setSavingAddress(true);
    try {
      const { data } = await addAddress({
        // Sanitised, not just trimmed: markup and invisible characters are
        // removed here as well as on the server, so what is sent matches what
        // the customer saw in the field.
        label: cleanText(addressForm.label) || 'Home',
        street: cleanText(addressForm.street),
        city: cleanText(addressForm.city),
        state: cleanText(addressForm.state),
        pincode: cleanText(addressForm.pincode),
        lat: addressForm.lat, lng: addressForm.lng,
      });
      const list = data.addresses || [];
      setAddresses(list);
      setSelectedAddressId(list[list.length - 1]?._id || null);
      setAddingAddress(false);
      setAddressForm({ label: 'Home', street: '', city: '', state: '', pincode: '', lat: null, lng: null });
      toast.success('Address saved');
    } catch (err) {
      toast.error(reportApiError('CheckoutModal.addAddress', err, 'Could not save the address'));
    } finally {
      setSavingAddress(false);
    }
  };

  const selectedAddress = addresses.find((a) => a._id === selectedAddressId) || null;

  // ── payment ──
  const handlePay = async () => {
    if (paying) return;                       // guard against a double click
    setPaying(true);
    setPayError('');

    try {
      /* The address is looked up by id from a list refetched on open, so it can
         legitimately be missing: deleted from another tab or on /profile, or a
         stale id left selected. Dereferencing it below used to throw a
         TypeError inside the click handler and leave the button spinning. */
      if (!selectedAddress) {
        setPayError('Please choose a delivery address before paying.');
        setPaying(false);
        setStep(3);
        loadAddresses();
        return;
      }

      // 1. Create (or reuse) the booking.
      //    A pending booking from an earlier attempt is reused only when it
      //    still describes this exact checkout — see checkoutSignature.
      const signature = checkoutSignature({
        car, services, scheduledDate, scheduledTime,
        addressId: selectedAddress?._id, pickupDrop,
      });
      const pending = readPendingBooking();
      let id = pending && pending.key === signature ? pending.id : null;

      if (!id) {
        const { data } = await createServiceBooking({
          selectedCar: {
            carId: car.carId, brand: car.brand, model: car.model, year: car.year,
            fuelType: car.fuelType, transmission: car.transmission,
            image: car.image, isManualEntry: car.isManualEntry,
          },
          services: services.map((s) => ({
            serviceType: s.serviceType || s.serviceId,
            categoryId: s.categoryId,
            category: s.category,
          })),
          scheduledDate, scheduledTime,
          address: {
            street: selectedAddress.street, city: selectedAddress.city,
            state: selectedAddress.state, pincode: selectedAddress.pincode,
            lat: selectedAddress.lat, lng: selectedAddress.lng,
          },
          // Only the stored fields, never the whole mongoose subdocument —
          // _id and __v on an address the server is about to re-create are
          // noise at best and a cast error at worst.
          pickupDrop: pickupDrop.enabled
            ? {
                enabled: true,
                dropType: pickupDrop.dropType,
                pickupAddress: stripAddress(pickupDrop.pickupAddress),
                dropAddress: pickupDrop.dropType === 'different'
                  ? stripAddress(pickupDrop.dropAddress)
                  : undefined,
              }
            : { enabled: false },
          totalAmount,
        });
        id = data.booking._id;
        writePendingBooking(id, signature);
      }
      setBookingId(id);

      // 2. Razorpay order
      const { data: pay } = await createServicePayment(id);

      const ok = await loadRazorpay();
      if (!ok) throw new Error('Could not load the payment gateway. Check your connection and retry.');

      const key = pay.key || import.meta.env.VITE_RAZORPAY_KEY_ID;
      if (!key) throw new Error('Payment is not configured. Please contact support.');

      // 3. Checkout
      await new Promise((resolve) => {
        const rzp = new window.Razorpay({
          key,
          amount: pay.order.amount,
          currency: pay.order.currency || 'INR',
          name: 'GK Motors',
          description: services.map((s) => s.name).join(', ').slice(0, 240),
          order_id: pay.order.id,
          prefill: { name: user?.name || '', email: user?.email || '', contact: user?.phone || '' },
          theme: { color: '#2563EB' },
          modal: {
            ondismiss: () => {
              // Booking stays payable so the customer can retry — the id is
              // kept in sessionStorage so the retry reuses it rather than
              // creating a second booking.
              setPayError('Payment was cancelled. Your booking is saved — you can pay again below.');
              setPaying(false);
              // Tell the server, so a slot is not held for someone who walked
              // away. Best-effort: the webhook is the authoritative source.
              reportServicePaymentFailed(id, {
                cancelled: true,
                reason: 'Customer closed the payment sheet',
              }).catch((e) => console.error('[CheckoutModal.reportCancelled]', e?.message));
              resolve();
            },
          },
          handler: async (response) => {
            try {
              // 4. Verify signature server-side
              await verifyServicePayment(id, {
                razorpay_order_id: response.razorpay_order_id,
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_signature: response.razorpay_signature,
              });
              // Paid: the handoff has done its job. Dropping it here is what
              // stops the next checkout from trying to pay this booking again.
              clearPendingBooking();
              clearCart();                    // only ever cleared on success
              toast.success('Booking confirmed. See you soon.');
              onClose();
              navigate('/my-bookings?tab=services');
            } catch (err) {
              setPayError(reportApiError(
                'CheckoutModal.verifyServicePayment', err,
                'We could not confirm your payment. If you were charged, contact support with your booking id.'
              ));
            } finally {
              setPaying(false);
              resolve();
            }
          },
        });
        rzp.on('payment.failed', (resp) => {
          console.error('[CheckoutModal.payment.failed]', resp?.error);
          setPayError(resp?.error?.description || 'Payment failed. Please try again.');
          setPaying(false);
          // Record the failure so the booking stops holding its slot. The
          // booking itself stays, so "Retry Payment" reuses it.
          reportServicePaymentFailed(id, {
            reason: resp?.error?.description || 'Payment failed',
          }).catch((e) => console.error('[CheckoutModal.reportFailed]', e?.message));
          resolve();
        });
        rzp.open();
      });
    } catch (err) {
      /* 409 means the slot went to someone else while this booking sat unpaid.
         Retrying the same booking can never succeed, so drop the handoff and
         let the customer start a clean one on a slot that is still free. */
      if (err.response?.status === 409) {
        clearPendingBooking();
        setBookingId(null);
      }
      setPayError(err.response ? reportApiError('CheckoutModal.handlePay', err) : err.message);
      setPaying(false);
    }
  };

  // ── step gating ──
  const canContinueFromDate = Boolean(scheduledDate && scheduledTime);
  // Step 2 is always passable — declining doorstep pickup is a valid answer.
  // Opting in and leaving it half-filled is not.
  const canContinueFromPickup =
    !pickupDrop.enabled
    || (Boolean(pickupDrop.pickupAddress)
        && (pickupDrop.dropType !== 'different' || Boolean(pickupDrop.dropAddress)));
  // Boolean(selectedAddress) alone passed when a stale id happened to match
  // nothing: `find` returns undefined, but so does an empty list — this makes
  // the requirement explicit.
  const canContinueFromAddress = Boolean(selectedAddress && selectedAddress._id);
  const canContinue =
    step === 1 ? canContinueFromDate
    : step === 2 ? canContinueFromPickup
    : canContinueFromAddress;

  const STEPS = [
    { n: 1, label: 'Date & Time', icon: Calendar },
    { n: 2, label: 'Pickup', icon: Truck },
    { n: 3, label: 'Address', icon: MapPin },
    { n: 4, label: 'Payment', icon: CreditCard },
  ];

  // A saved address the customer taps for pickup or drop.
  const chooseAddress = (which, addr) => setPickupDrop((prev) => ({
    ...prev,
    [which]: addr,
    ...(which === 'pickupAddress' && prev.dropType === 'same' ? { dropAddress: addr } : {}),
  }));

  const inputStyle = (hasError) => ({
    width: '100%', padding: '0.7rem 0.9rem', borderRadius: '10px',
    border: `1.5px solid ${hasError ? '#EF4444' : '#E2E8F0'}`,
    fontSize: '0.9rem', fontWeight: 600, color: '#0F172A', outline: 'none', background: '#FFF',
  });
  const labelStyle = {
    display: 'block', fontSize: '0.72rem', fontWeight: 800, color: '#64748B',
    textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '0.35rem',
  };
  const errStyle = { color: '#EF4444', fontSize: '0.72rem', fontWeight: 700, marginTop: '0.25rem' };

  // Selectable card + radio dot, shared by every choice on the pickup step.
  const pickCardStyle = (sel) => ({
    display: 'flex', alignItems: 'flex-start', gap: '0.6rem', textAlign: 'left',
    border: `1.5px solid ${sel ? '#2563EB' : '#E2E8F0'}`,
    background: sel ? '#FFF' : '#FFF',
    boxShadow: sel ? 'inset 0 0 0 1px #2563EB' : 'none',
    borderRadius: '10px', padding: '0.65rem 0.8rem', cursor: 'pointer', width: '100%',
  });
  const pickDotStyle = (sel) => ({
    width: 15, height: 15, borderRadius: '50%', marginTop: '0.12rem', flexShrink: 0,
    border: `2px solid ${sel ? '#2563EB' : '#CBD5E1'}`,
    background: sel ? '#2563EB' : 'transparent',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
  });

  return (
    <div
      onClick={(e) => { if (e.target === e.currentTarget && !paying) onClose(); }}
      style={{
        position: 'fixed', inset: 0, zIndex: 9999, background: 'rgba(15, 23, 42, 0.65)',
        backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center',
        justifyContent: 'center', padding: '1rem', overflowY: 'auto',
      }}
    >
      <div className="gk-co-modal" style={{ background: '#FFF', borderRadius: '20px', width: '100%', maxWidth: '620px', maxHeight: '92vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <style>{CHECKOUT_STYLES}</style>
        {/* Header */}
        <div className="gk-co-head" style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid #E2E8F0', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <h2 style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 950, fontSize: '1.35rem', color: '#0F172A' }}>
            Complete Your Booking
          </h2>
          <button onClick={onClose} disabled={paying} style={{ background: 'none', border: 'none', cursor: paying ? 'not-allowed' : 'pointer', color: '#94A3B8', display: 'flex' }}>
            <X size={20} />
          </button>
        </div>

        {/* Stepper */}
        <div className="gk-co-steps" style={{ display: 'flex', gap: '0.5rem', padding: '1rem 1.5rem', borderBottom: '1px solid #F1F5F9' }}>
          {STEPS.map(({ n, label, icon: Icon }) => {
            const active = step === n;
            const done = step > n;
            return (
              <div key={n} className="gk-co-step" style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                <div style={{
                  width: 28, height: 28, borderRadius: '50%', flexShrink: 0,
                  background: done ? '#DCFCE7' : active ? '#2563EB' : '#F1F5F9',
                  color: done ? '#166534' : active ? '#FFF' : '#94A3B8',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  {done ? <Check size={14} /> : <Icon size={13} />}
                </div>
                <span className="gk-co-step-label" style={{ fontSize: '0.75rem', fontWeight: 800, color: active ? '#0F172A' : '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  {label}
                </span>
              </div>
            );
          })}
        </div>

        {/* Body */}
        <div className="gk-co-body" style={{ padding: '1.5rem', overflowY: 'auto', flex: 1 }}>
          {/* ── STEP 1 ── */}
          {step === 1 && (
            <div>
              <label style={labelStyle}>Service Date</label>
              <input
                type="date" value={scheduledDate} min={minDate} max={maxDate}
                onChange={(e) => setScheduledDate(e.target.value)}
                style={{ ...inputStyle(false), marginBottom: '0.4rem' }}
              />
              {/* The input shows the raw ISO value on some browsers, so spell
                  the chosen day out underneath it. */}
              <p style={{ color: '#475569', fontSize: '0.8rem', fontWeight: 700, marginBottom: '1.25rem' }}>
                {scheduledDate ? formatIstDate(scheduledDate, { long: true }) : 'Pick a date'}
              </p>

              <label style={labelStyle}>Time Slot</label>
              {slotsLoading ? (
                <div style={{ padding: '1.5rem 0' }}><Loader size={20} style={{ color: '#2563EB' }} /></div>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(105px, 1fr))', gap: '0.6rem' }}>
                  {slots.map(({ time, available }) => {
                    const sel = scheduledTime === time;
                    return (
                      <button
                        key={time}
                        onClick={() => available && setScheduledTime(time)}
                        disabled={!available}
                        style={{
                          padding: '0.65rem 0.4rem', borderRadius: '10px',
                          border: `1.5px solid ${sel ? '#2563EB' : available ? '#E2E8F0' : '#F1F5F9'}`,
                          background: sel ? '#2563EB' : available ? '#FFF' : '#F8FAFC',
                          color: sel ? '#FFF' : available ? '#0F172A' : '#CBD5E1',
                          fontWeight: 800, fontSize: '0.82rem',
                          cursor: available ? 'pointer' : 'not-allowed',
                          textDecoration: available ? 'none' : 'line-through',
                          transition: 'all 0.15s',
                        }}
                      >
                        {prettyTime(time)}
                      </button>
                    );
                  })}
                </div>
              )}
              {!slotsLoading && slots.every((s) => !s.available) && (
                <p style={{ color: '#EF4444', fontSize: '0.8rem', fontWeight: 700, marginTop: '0.9rem' }}>
                  All slots on this date are taken. Please pick another day.
                </p>
              )}
            </div>
          )}

          {/* ── STEP 2 ── */}
          {step === 2 && (
            <div>
              {/* Bring it in yourself */}
              <button
                onClick={() => setPickupDrop({
                  enabled: false, pickupAddress: null, dropType: 'service_center', dropAddress: null,
                })}
                style={{
                  width: '100%', textAlign: 'left', cursor: 'pointer',
                  display: 'flex', alignItems: 'flex-start', gap: '0.8rem',
                  border: `1.5px solid ${!pickupDrop.enabled ? '#2563EB' : '#E2E8F0'}`,
                  background: !pickupDrop.enabled ? '#EFF6FF' : '#FFF',
                  borderRadius: '14px', padding: '1rem', marginBottom: '0.8rem',
                }}
              >
                <div style={{
                  width: 18, height: 18, borderRadius: '50%', marginTop: '0.15rem', flexShrink: 0,
                  border: `2px solid ${!pickupDrop.enabled ? '#2563EB' : '#CBD5E1'}`,
                  background: !pickupDrop.enabled ? '#2563EB' : 'transparent',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  {!pickupDrop.enabled && <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#FFF' }} />}
                </div>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontWeight: 900, fontSize: '0.9rem', color: '#0F172A', marginBottom: '0.2rem' }}>
                    I'll drop the car at the workshop
                  </div>
                  <div style={{ color: '#2563EB', fontSize: '0.8rem', fontWeight: 600, lineHeight: 1.5 }}>
                    {SERVICE_CENTER.fullAddress}
                  </div>
                </div>
              </button>

              {/* Doorstep pickup */}
              {isPickupDropAvailable(scheduledTime, scheduledDate) ? (
                <div style={{
                  border: `1.5px solid ${pickupDrop.enabled ? '#2563EB' : '#E2E8F0'}`,
                  background: pickupDrop.enabled ? '#EFF6FF' : '#FFF',
                  borderRadius: '14px', padding: '1rem',
                }}>
                  <button
                    onClick={() => setPickupDrop((prev) => ({
                      ...prev,
                      enabled: true,
                      dropType: prev.dropType || 'service_center',
                    }))}
                    style={{
                      width: '100%', textAlign: 'left', cursor: 'pointer', background: 'none',
                      border: 'none', padding: 0, display: 'flex', alignItems: 'flex-start', gap: '0.8rem',
                    }}
                  >
                    <div style={{
                      width: 18, height: 18, borderRadius: '50%', marginTop: '0.15rem', flexShrink: 0,
                      border: `2px solid ${pickupDrop.enabled ? '#2563EB' : '#CBD5E1'}`,
                      background: pickupDrop.enabled ? '#2563EB' : 'transparent',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                      {pickupDrop.enabled && <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#FFF' }} />}
                    </div>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.2rem' }}>
                        <Truck size={15} style={{ color: '#2563EB' }} />
                        <span style={{ fontWeight: 900, fontSize: '0.9rem', color: '#0F172A' }}>Doorstep pickup &amp; drop</span>
                      </div>
                      <div style={{ color: '#64748B', fontSize: '0.8rem', fontWeight: 500, lineHeight: 1.5 }}>
                        We collect your car and bring it back after the service. Free.
                      </div>
                    </div>
                  </button>

                  {pickupDrop.enabled && (
                    <div style={{ marginTop: '1rem', paddingTop: '1rem', borderTop: '1px solid #DBEAFE' }}>
                      {/* Pickup point */}
                      <label style={labelStyle}>Collect the car from</label>
                      <div style={{ display: 'grid', gap: '0.5rem', marginBottom: '0.7rem' }}>
                        {addresses.map((a) => {
                          const sel = pickupDrop.pickupAddress?._id
                            ? pickupDrop.pickupAddress._id === a._id
                            : false;
                          return (
                            <button key={a._id} onClick={() => chooseAddress('pickupAddress', a)}
                              style={pickCardStyle(sel)}>
                              <div style={pickDotStyle(sel)}>
                                {sel && <div style={{ width: 5, height: 5, borderRadius: '50%', background: '#FFF' }} />}
                              </div>
                              <div style={{ minWidth: 0 }}>
                                <div style={{ fontWeight: 900, fontSize: '0.8rem', color: '#0F172A' }}>{a.label || 'Address'}</div>
                                <div style={{ color: '#64748B', fontSize: '0.76rem', fontWeight: 500, lineHeight: 1.4 }}>{formatAddress(a)}</div>
                              </div>
                            </button>
                          );
                        })}

                        {pickupDrop.pickupAddress && !pickupDrop.pickupAddress._id && (
                          <div style={pickCardStyle(true)}>
                            <div style={pickDotStyle(true)}>
                              <div style={{ width: 5, height: 5, borderRadius: '50%', background: '#FFF' }} />
                            </div>
                            <div style={{ minWidth: 0 }}>
                              <div style={{ fontWeight: 900, fontSize: '0.8rem', color: '#0F172A' }}>Current location</div>
                              <div style={{ color: '#64748B', fontSize: '0.76rem', fontWeight: 500, lineHeight: 1.4 }}>
                                {formatAddress(pickupDrop.pickupAddress)}
                              </div>
                            </div>
                          </div>
                        )}
                      </div>

                      <button
                        onClick={fetchPickupFromLocation}
                        disabled={pickupLocating}
                        style={{
                          display: 'inline-flex', alignItems: 'center', gap: '0.4rem',
                          background: '#FFF', border: '1.5px solid #2563EB', color: '#2563EB',
                          borderRadius: '10px', padding: '0.55rem 0.9rem', fontSize: '0.78rem',
                          fontWeight: 800, cursor: pickupLocating ? 'wait' : 'pointer', marginBottom: '1.1rem',
                        }}
                      >
                        <Crosshair size={14} />
                        {pickupLocating ? 'Finding you…' : 'Use my current location'}
                      </button>

                      {/* Drop point */}
                      <label style={labelStyle}>Return the car to</label>
                      <div style={{ display: 'grid', gap: '0.5rem' }}>
                        {[
                          { key: 'same', icon: Home, title: 'The same address', sub: formatAddress(pickupDrop.pickupAddress) || 'Wherever we collect it from' },
                          { key: 'different', icon: MapPin, title: 'A different address', sub: 'Choose from your saved addresses' },
                          { key: 'service_center', icon: CarIcon, title: "I'll collect it from the workshop", sub: SERVICE_CENTER.fullAddress },
                        ].map(({ key, icon: Icon, title, sub }) => {
                          const sel = pickupDrop.dropType === key;
                          return (
                            <button
                              key={key}
                              onClick={() => setPickupDrop((prev) => ({
                                ...prev,
                                dropType: key,
                                dropAddress: key === 'same' ? prev.pickupAddress : null,
                              }))}
                              style={pickCardStyle(sel)}
                            >
                              <div style={pickDotStyle(sel)}>
                                {sel && <div style={{ width: 5, height: 5, borderRadius: '50%', background: '#FFF' }} />}
                              </div>
                              <div style={{ minWidth: 0 }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                                  <Icon size={13} style={{ color: '#2563EB' }} />
                                  <span style={{ fontWeight: 900, fontSize: '0.8rem', color: '#0F172A' }}>{title}</span>
                                </div>
                                <div style={{ color: '#64748B', fontSize: '0.76rem', fontWeight: 500, lineHeight: 1.4 }}>{sub}</div>
                              </div>
                            </button>
                          );
                        })}
                      </div>

                      {/* Saved addresses again, only when returning elsewhere */}
                      {pickupDrop.dropType === 'different' && (
                        <div style={{ display: 'grid', gap: '0.5rem', marginTop: '0.6rem', paddingLeft: '0.8rem', borderLeft: '2px solid #DBEAFE' }}>
                          {addresses.length === 0 && (
                            <p style={{ color: '#64748B', fontSize: '0.78rem', fontWeight: 600, margin: 0 }}>
                              You have no saved addresses yet. Add one on the next step, then come back.
                            </p>
                          )}
                          {addresses.map((a) => {
                            const sel = pickupDrop.dropAddress?._id === a._id;
                            return (
                              <button key={a._id} onClick={() => chooseAddress('dropAddress', a)} style={pickCardStyle(sel)}>
                                <div style={pickDotStyle(sel)}>
                                  {sel && <div style={{ width: 5, height: 5, borderRadius: '50%', background: '#FFF' }} />}
                                </div>
                                <div style={{ minWidth: 0 }}>
                                  <div style={{ fontWeight: 900, fontSize: '0.8rem', color: '#0F172A' }}>{a.label || 'Address'}</div>
                                  <div style={{ color: '#64748B', fontSize: '0.76rem', fontWeight: 500, lineHeight: 1.4 }}>{formatAddress(a)}</div>
                                </div>
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ) : (
                <div style={{
                  background: '#FFFBEB', border: '1.5px solid #FCD34D', borderRadius: '14px',
                  padding: '1rem', display: 'flex', gap: '0.7rem', alignItems: 'flex-start',
                }}>
                  <AlertCircle size={17} style={{ color: '#B45309', flexShrink: 0, marginTop: '0.1rem' }} />
                  <div>
                    <div style={{ fontWeight: 900, fontSize: '0.85rem', color: '#92400E', marginBottom: '0.2rem' }}>
                      Doorstep pickup isn't available at {scheduledTime ? prettyTime(scheduledTime) : 'this time'}
                    </div>
                    <div style={{ color: '#92400E', fontSize: '0.79rem', fontWeight: 500, lineHeight: 1.5 }}>
                      We run pickups between 9:00 AM and 6:00 PM. Pick an earlier slot on the previous
                      step, or drop the car at the workshop yourself.
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── STEP 3 ── */}
          {step === 3 && (
            <div>
              {addressesLoading ? (
                <div style={{ padding: '1.5rem 0', textAlign: 'center' }}><Loader size={20} style={{ color: '#2563EB' }} /></div>
              ) : (
                <>
                  {addresses.length > 0 && !addingAddress && (
                    <>
                      {/* Once pickup has its own address, this one is no longer
                          "where we collect from" — it is the customer's own
                          address, used for contact and the invoice. */}
                      <label style={labelStyle}>Your address</label>
                      <p style={{ color: '#64748B', fontSize: '0.76rem', fontWeight: 500, margin: '-0.15rem 0 0.6rem' }}>
                        {pickupDrop.enabled
                          ? 'Used for your invoice and so the driver can reach you.'
                          : 'Used for your invoice and service records.'}
                      </p>
                      <div style={{ display: 'grid', gap: '0.6rem', marginBottom: '1rem' }}>
                        {addresses.map((a) => {
                          const sel = a._id === selectedAddressId;
                          return (
                            <button
                              key={a._id}
                              onClick={() => setSelectedAddressId(a._id)}
                              style={{
                                display: 'flex', alignItems: 'flex-start', gap: '0.7rem', textAlign: 'left',
                                border: `1.5px solid ${sel ? '#2563EB' : '#E2E8F0'}`,
                                background: sel ? '#EFF6FF' : '#FFF',
                                borderRadius: '12px', padding: '0.85rem 1rem', cursor: 'pointer',
                              }}
                            >
                              <div style={{
                                width: 18, height: 18, borderRadius: '50%', marginTop: '0.1rem', flexShrink: 0,
                                border: `2px solid ${sel ? '#2563EB' : '#CBD5E1'}`,
                                background: sel ? '#2563EB' : 'transparent',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                              }}>
                                {sel && <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#FFF' }} />}
                              </div>
                              <div style={{ minWidth: 0 }}>
                                <div style={{ fontWeight: 900, fontSize: '0.85rem', color: '#0F172A', marginBottom: '0.15rem' }}>{a.label || 'Address'}</div>
                                <div style={{ color: '#64748B', fontSize: '0.8rem', fontWeight: 500, lineHeight: 1.45 }}>
                                  {[a.street, a.city, a.state, a.pincode].filter(Boolean).join(', ')}
                                </div>
                              </div>
                            </button>
                          );
                        })}
                      </div>
                      <button
                        onClick={() => setAddingAddress(true)}
                        style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', background: 'none', border: '1.5px dashed #2563EB', color: '#2563EB', borderRadius: '10px', padding: '0.65rem 1rem', fontWeight: 800, fontSize: '0.82rem', cursor: 'pointer', width: '100%', justifyContent: 'center' }}
                      >
                        <Plus size={14} /> Add New Address
                      </button>
                    </>
                  )}

                  {addingAddress && (
                    <div>
                      {addresses.length === 0 && (
                        <p style={{ color: '#64748B', fontSize: '0.85rem', fontWeight: 600, marginBottom: '1rem' }}>
                          You have no saved addresses yet. Add one to continue.
                        </p>
                      )}

                      <button
                        onClick={fetchCurrentAddress}
                        disabled={locating}
                        style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', background: '#EBF0FF', border: 'none', color: '#2563EB', borderRadius: '10px', padding: '0.6rem 1rem', fontWeight: 800, fontSize: '0.8rem', cursor: locating ? 'wait' : 'pointer', marginBottom: '1rem' }}
                      >
                        <Crosshair size={14} /> {locating ? 'Locating…' : 'Fetch Current Address'}
                      </button>

                      <div style={{ display: 'grid', gap: '0.85rem' }}>
                        <div>
                          <label style={labelStyle}>Label</label>
                          <input type="text" value={addressForm.label} onChange={(e) => setAddressForm({ ...addressForm, label: e.target.value })} placeholder="Home / Office" style={inputStyle(false)} />
                        </div>
                        <div>
                          <label style={labelStyle}>Street Address *</label>
                          <input type="text" value={addressForm.street} onChange={(e) => setAddressForm({ ...addressForm, street: e.target.value })} placeholder="House no., street, area" style={inputStyle(addressErrors.street)} />
                          {addressErrors.street && <p style={errStyle}>{addressErrors.street}</p>}
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.85rem' }}>
                          <div>
                            <label style={labelStyle}>City *</label>
                            <input type="text" value={addressForm.city} onChange={(e) => setAddressForm({ ...addressForm, city: e.target.value })} style={inputStyle(addressErrors.city)} />
                            {addressErrors.city && <p style={errStyle}>{addressErrors.city}</p>}
                          </div>
                          <div>
                            <label style={labelStyle}>State *</label>
                            <input type="text" value={addressForm.state} onChange={(e) => setAddressForm({ ...addressForm, state: e.target.value })} style={inputStyle(addressErrors.state)} />
                            {addressErrors.state && <p style={errStyle}>{addressErrors.state}</p>}
                          </div>
                        </div>
                        <div>
                          <label style={labelStyle}>Pincode *</label>
                          <input type="text" inputMode="numeric" maxLength={6} value={addressForm.pincode}
                            onChange={(e) => setAddressForm({ ...addressForm, pincode: e.target.value.replace(/\D/g, '').slice(0, 6) })}
                            style={inputStyle(addressErrors.pincode)} />
                          {addressErrors.pincode && <p style={errStyle}>{addressErrors.pincode}</p>}
                        </div>
                      </div>

                      <div style={{ display: 'flex', gap: '0.6rem', marginTop: '1.1rem' }}>
                        <button onClick={saveAddress} disabled={savingAddress}
                          style={{ flex: 1, background: 'linear-gradient(135deg, #2563EB 0%, #0F172A 100%)', color: '#FFF', border: 'none', borderRadius: '10px', padding: '0.8rem', fontWeight: 900, fontSize: '0.85rem', cursor: savingAddress ? 'wait' : 'pointer', fontFamily: "'Space Grotesk', sans-serif", letterSpacing: '0.06em', textTransform: 'uppercase' }}>
                          {savingAddress ? 'Saving…' : 'Save Address'}
                        </button>
                        {addresses.length > 0 && (
                          <button onClick={() => { setAddingAddress(false); setAddressErrors({}); }}
                            style={{ background: '#F1F5F9', color: '#475569', border: 'none', borderRadius: '10px', padding: '0.8rem 1.2rem', fontWeight: 800, fontSize: '0.85rem', cursor: 'pointer' }}>
                            Cancel
                          </button>
                        )}
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {/* ── STEP 4 ── */}
          {step === 4 && (
            <div>
              <div style={{ background: '#F8FAFC', border: '1.5px solid #E2E8F0', borderRadius: '14px', padding: '1.1rem', marginBottom: '1rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.85rem' }}>
                  <CarIcon size={16} style={{ color: '#2563EB' }} />
                  <span style={{ fontWeight: 900, fontSize: '0.9rem', color: '#0F172A' }}>
                    {car?.brand} {car?.model} · {car?.year}
                  </span>
                </div>
                {services.map((s) => (
                  <div key={s.serviceId} style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', padding: '0.4rem 0', fontSize: '0.85rem' }}>
                    <span style={{ color: '#475569', fontWeight: 600 }}>{s.name}</span>
                    <span style={{ color: '#0F172A', fontWeight: 800, whiteSpace: 'nowrap' }}>₹{Number(s.price).toLocaleString('en-IN')}</span>
                  </div>
                ))}
                <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '2px solid #0F172A', marginTop: '0.7rem', paddingTop: '0.7rem' }}>
                  <span style={{ fontWeight: 900, fontSize: '0.8rem', color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Total</span>
                  <span style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 950, fontSize: '1.4rem', color: '#0F172A' }}>
                    ₹{Number(totalAmount).toLocaleString('en-IN')}
                  </span>
                </div>
              </div>

              <div style={{ display: 'grid', gap: '0.5rem', fontSize: '0.82rem', color: '#475569', fontWeight: 600, marginBottom: '1.1rem' }}>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <Calendar size={14} style={{ color: '#2563EB', flexShrink: 0, marginTop: '0.1rem' }} />
                  <span>{formatIstDate(scheduledDate, { long: true })}{scheduledTime ? ` at ${prettyTime(scheduledTime)}` : ''}</span>
                </div>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <MapPin size={14} style={{ color: '#2563EB', flexShrink: 0, marginTop: '0.1rem' }} />
                  <span>{selectedAddress && [selectedAddress.street, selectedAddress.city, selectedAddress.pincode].filter(Boolean).join(', ')}</span>
                </div>
                {pickupDrop.enabled ? (
                  <>
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                      <Truck size={14} style={{ color: '#2563EB', flexShrink: 0, marginTop: '0.1rem' }} />
                      <span>We collect from {formatAddress(pickupDrop.pickupAddress)}</span>
                    </div>
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                      <Home size={14} style={{ color: '#2563EB', flexShrink: 0, marginTop: '0.1rem' }} />
                      <span>
                        {pickupDrop.dropType === 'service_center'
                          ? `You collect it from ${SERVICE_CENTER.fullAddress}`
                          : `We return it to ${formatAddress(
                              pickupDrop.dropType === 'same' ? pickupDrop.pickupAddress : pickupDrop.dropAddress
                            )}`}
                      </span>
                    </div>
                  </>
                ) : (
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <CarIcon size={14} style={{ color: '#2563EB', flexShrink: 0, marginTop: '0.1rem' }} />
                    <span>You bring the car to {SERVICE_CENTER.fullAddress}</span>
                  </div>
                )}
              </div>

              {payError && (
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.55rem', background: '#FEF2F2', border: '1.5px solid #FECACA', borderRadius: '12px', padding: '0.85rem 1rem', marginBottom: '1rem' }}>
                  <AlertCircle size={16} style={{ color: '#EF4444', flexShrink: 0, marginTop: '0.1rem' }} />
                  <span style={{ color: '#991B1B', fontSize: '0.82rem', fontWeight: 600, lineHeight: 1.5 }}>{payError}</span>
                </div>
              )}

              <div className="gk-co-pay-wrap">
              <button
                onClick={handlePay}
                disabled={paying}
                style={{
                  width: '100%',
                  background: paying ? '#94A3B8' : 'linear-gradient(135deg, #2563EB 0%, #0F172A 100%)',
                  color: '#FFF', border: 'none', borderRadius: '12px', padding: '1rem',
                  fontFamily: "'Space Grotesk', sans-serif", fontWeight: 950, fontSize: '0.95rem',
                  letterSpacing: '0.08em', textTransform: 'uppercase',
                  cursor: paying ? 'wait' : 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem',
                }}
              >
                <CreditCard size={17} />
                {paying ? 'Processing…' : payError ? 'Retry Payment' : `Pay ₹${Number(totalAmount).toLocaleString('en-IN')}`}
              </button>
              </div>
            </div>
          )}
        </div>

        {/* Footer nav */}
        {step < 4 && (
          <div className="gk-co-foot" style={{ padding: '1rem 1.5rem', borderTop: '1px solid #E2E8F0', display: 'flex', gap: '0.7rem' }}>
            {step > 1 && (
              <button onClick={() => setStep(step - 1)}
                style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', background: '#F1F5F9', color: '#475569', border: 'none', borderRadius: '10px', padding: '0.8rem 1.2rem', fontWeight: 800, fontSize: '0.85rem', cursor: 'pointer' }}>
                <ChevronLeft size={15} /> Back
              </button>
            )}
            <button
              onClick={() => {
                // Tell the customer what is missing rather than leaving a dead
                // button they have to reverse-engineer.
                if (step === 2 && pickupDrop.enabled && !pickupDrop.pickupAddress) {
                  toast.error('Choose where we should collect the car');
                  return;
                }
                if (step === 2 && pickupDrop.enabled
                    && pickupDrop.dropType === 'different' && !pickupDrop.dropAddress) {
                  toast.error('Choose where we should return the car');
                  return;
                }
                setStep(step + 1);
              }}
              disabled={!canContinue}
              style={{
                flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem',
                background: canContinue
                  ? 'linear-gradient(135deg, #2563EB 0%, #0F172A 100%)' : '#E2E8F0',
                color: canContinue ? '#FFF' : '#94A3B8',
                border: 'none', borderRadius: '10px', padding: '0.8rem',
                fontFamily: "'Space Grotesk', sans-serif", fontWeight: 900, fontSize: '0.88rem',
                letterSpacing: '0.07em', textTransform: 'uppercase',
                cursor: canContinue ? 'pointer' : 'not-allowed',
              }}
            >
              Continue <ChevronRight size={15} />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

/* Responsive rules for the modal.
 *
 * This component previously had NO media queries at all: a 620px card with
 * 1.5rem padding throughout and a four-item horizontal stepper carrying
 * uppercase labels, rendered identically at 1440px and at 320px. Everything
 * below is layout only — no colour, no spacing on desktop, no behaviour. */
const CHECKOUT_STYLES = `
  @media (max-width: 560px) {
    /* Use the full height rather than floating a 92vh card inside a scrolling
       overlay: two nested scroll containers is what makes iOS scroll-chain
       unpredictably here. */
    .gk-co-modal {
      max-height: 100dvh !important;
      height: 100dvh !important;
      border-radius: 0 !important;
    }
    .gk-co-head  { padding: 1rem 1.1rem !important; }
    .gk-co-steps { padding: 0.75rem 1.1rem !important; gap: 0.35rem !important; }
    .gk-co-body  { padding: 1.1rem !important; }
    .gk-co-foot  {
      padding: 0.85rem 1.1rem calc(0.85rem + env(safe-area-inset-bottom, 0px)) !important;
    }

    /* Icons only. Four uppercase labels cannot fit across a 320px row, and
       truncating them left four meaningless fragments. The circles keep their
       done/active states, and each step now carries its name as an accessible
       title instead. */
    .gk-co-step-label { display: none !important; }
    .gk-co-step { flex: 0 0 auto !important; }
    .gk-co-steps { justify-content: space-between !important; }

    /* The footer is hidden on the payment step, so the pay button would sit at
       the end of a scrolling body. Pin it to the bottom of that body. */
    .gk-co-pay-wrap {
      position: sticky;
      bottom: calc(-1.1rem - env(safe-area-inset-bottom, 0px));
      background: #FFFFFF;
      padding: 0.75rem 0 calc(0.75rem + env(safe-area-inset-bottom, 0px));
      margin: 0 0 -1.1rem;
      box-shadow: 0 -8px 12px -8px rgba(15, 23, 42, 0.15);
    }
  }

  /* The address form's two-up City/State row is tight below 380px. */
  @media (max-width: 380px) {
    .gk-co-body input, .gk-co-body select { font-size: 16px !important; }  /* iOS: <16px triggers zoom-on-focus */
  }
`;
