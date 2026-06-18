import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Check, Crown, Loader2, Shield, ShieldCheck, XCircle } from 'lucide-react';
import { createPaymentOrder, getPaymentPlans, verifyPayment } from '../paymentService.js';

const fallbackPlans = [
  {
    id: 'basic',
    name: 'Basic',
    displayName: 'Basic Plan',
    amount: 99,
    features: ['Monthly protection', 'Basic support', 'Incident history'],
  },
  {
    id: 'standard',
    name: 'Standard',
    displayName: 'Standard Plan',
    amount: 199,
    features: ['Everything in Basic', 'Priority support', 'Faster claim assistance'],
  },
  {
    id: 'premium',
    name: 'Premium',
    displayName: 'Premium Plan',
    amount: 299,
    features: ['Everything in Standard', 'Premium assistance', 'Complete protection insights'],
  },
];

function loadRazorpayCheckout() {
  return new Promise((resolve) => {
    if (window.Razorpay) {
      resolve(true);
      return;
    }

    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
}

function PaymentModal({ type, message, onClose }) {
  const isSuccess = type === 'success';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 px-4 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-2xl border border-slate-800 bg-slate-900 p-6 text-center shadow-2xl">
        <div className={`mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full ${isSuccess ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400'}`}>
          {isSuccess ? <ShieldCheck className="h-7 w-7" /> : <XCircle className="h-7 w-7" />}
        </div>
        <h2 className="text-xl font-black text-white">
          {isSuccess ? 'Payment Successful' : 'Payment Failed'}
        </h2>
        <p className="mt-2 text-sm leading-6 text-slate-400">{message}</p>
        <button
          type="button"
          onClick={onClose}
          className={`mt-6 w-full rounded-xl px-4 py-3 text-sm font-black text-white transition ${isSuccess ? 'bg-emerald-600 hover:bg-emerald-500' : 'bg-red-600 hover:bg-red-500'}`}
        >
          {isSuccess ? 'Go to Dashboard' : 'Try Again'}
        </button>
      </div>
    </div>
  );
}

export default function Payment({ token, currentUser, onPaymentSuccess }) {
  const navigate = useNavigate();
  const [plans, setPlans] = useState(fallbackPlans);
  const [loadingPlanId, setLoadingPlanId] = useState(null);
  const [pageError, setPageError] = useState('');
  const [modal, setModal] = useState(null);

  const planIcons = useMemo(() => ({
    basic: <Shield className="h-6 w-6" />,
    standard: <ShieldCheck className="h-6 w-6" />,
    premium: <Crown className="h-6 w-6" />,
  }), []);

  useEffect(() => {
    let mounted = true;

    getPaymentPlans(token)
      .then((remotePlans) => {
        if (mounted && Array.isArray(remotePlans) && remotePlans.length > 0) {
          setPlans(remotePlans);
        }
      })
      .catch((err) => {
        console.error('[Payment] Failed loading plans:', err);
      });

    return () => {
      mounted = false;
    };
  }, [token]);

  const handleBuyPlan = async (plan) => {
    setPageError('');
    setLoadingPlanId(plan.id);

    try {
      const checkoutReady = await loadRazorpayCheckout();
      if (!checkoutReady) {
        throw new Error('Unable to load Razorpay Checkout. Please check your connection and try again.');
      }

      const order = await createPaymentOrder(token, plan);

      const checkout = new window.Razorpay({
        key: order.keyId,
        amount: order.amount,
        currency: order.currency,
        name: 'MicroShield',
        description: `${plan.displayName || `${plan.name} Plan`} subscription`,
        order_id: order.orderId,
        prefill: {
          name: currentUser?.name || '',
          email: currentUser?.email || '',
        },
        theme: {
          color: '#dc2626',
        },
        handler: async (response) => {
          try {
            const verification = await verifyPayment(token, response);
            if (!verification.success) {
              throw new Error(verification.error || 'Payment verification failed.');
            }

            await onPaymentSuccess?.(verification.payment);
            setModal({
              type: 'success',
              message: `${verification.payment.planName} Plan is now active on your account.`,
            });
          } catch (err) {
            setModal({
              type: 'failure',
              message: err.response?.data?.error || err.message || 'Payment could not be verified.',
            });
          } finally {
            setLoadingPlanId(null);
          }
        },
        modal: {
          ondismiss: () => {
            setLoadingPlanId(null);
          },
        },
      });

      checkout.open();
    } catch (err) {
      setLoadingPlanId(null);
      const message = err.response?.data?.error || err.message || 'Unable to start payment.';
      setPageError(message);
      setModal({ type: 'failure', message });
    }
  };

  const handleModalClose = () => {
    const wasSuccess = modal?.type === 'success';
    setModal(null);
    if (wasSuccess) {
      navigate('/dashboard');
    }
  };

  return (
    <div className="space-y-8 py-4">
      <div className="flex flex-col gap-3 border-b border-slate-900 pb-6 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-xs font-black uppercase tracking-widest text-red-500">Payment</p>
          <h1 className="mt-2 text-3xl font-black tracking-tight text-white">Choose Your Protection Plan</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">
            Purchase a monthly MicroShield plan and activate account protection after Razorpay signature verification.
          </p>
        </div>
        <div className="rounded-full border border-emerald-500/20 bg-emerald-500/10 px-4 py-2 text-xs font-black uppercase tracking-wider text-emerald-400">
          Secure Razorpay Checkout
        </div>
      </div>

      {pageError && (
        <div className="rounded-xl border border-red-500/30 bg-red-950/30 p-4 text-sm text-red-300">
          {pageError}
        </div>
      )}

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        {plans.map((plan) => {
          const isPremium = plan.id === 'premium';
          const isLoading = loadingPlanId === plan.id;

          return (
            <div
              key={plan.id}
              className={`relative flex min-h-[420px] flex-col rounded-2xl border bg-slate-900/70 p-6 shadow-xl shadow-slate-950/30 transition hover:-translate-y-1 hover:border-red-500/40 ${isPremium ? 'border-red-500/40 ring-1 ring-red-500/20' : 'border-slate-800'}`}
            >
              {isPremium && (
                <div className="absolute right-5 top-5 rounded-full bg-red-500/10 px-3 py-1 text-[10px] font-black uppercase tracking-wider text-red-300">
                  Best Value
                </div>
              )}

              <div className={`mb-5 flex h-12 w-12 items-center justify-center rounded-xl ${isPremium ? 'bg-red-500/10 text-red-400' : 'bg-slate-950 text-slate-300'}`}>
                {planIcons[plan.id] || <Shield className="h-6 w-6" />}
              </div>

              <h2 className="text-xl font-black text-white">{plan.displayName || `${plan.name} Plan`}</h2>
              <div className="mt-4 flex items-end gap-1">
                <span className="text-4xl font-black text-white">₹{plan.amount}</span>
                <span className="pb-1 text-sm font-semibold text-slate-500">/month</span>
              </div>

              <div className="mt-6 space-y-3">
                {plan.features.map((feature) => (
                  <div key={feature} className="flex items-start gap-3 text-sm text-slate-300">
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" />
                    <span>{feature}</span>
                  </div>
                ))}
              </div>

              <button
                type="button"
                onClick={() => handleBuyPlan(plan)}
                disabled={Boolean(loadingPlanId)}
                className={`mt-auto flex w-full items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-black text-white transition disabled:cursor-not-allowed disabled:opacity-60 ${isPremium ? 'bg-red-600 hover:bg-red-500' : 'bg-slate-800 hover:bg-slate-700'}`}
              >
                {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
                <span>{isLoading ? 'Processing...' : 'Buy Plan'}</span>
              </button>
            </div>
          );
        })}
      </div>

      {loadingPlanId && (
        <div className="fixed bottom-6 right-6 z-40 flex items-center gap-3 rounded-xl border border-slate-800 bg-slate-900 px-4 py-3 text-sm font-semibold text-slate-200 shadow-2xl">
          <Loader2 className="h-4 w-4 animate-spin text-red-400" />
          Processing payment
        </div>
      )}

      {modal && (
        <PaymentModal
          type={modal.type}
          message={modal.message}
          onClose={handleModalClose}
        />
      )}
    </div>
  );
}

