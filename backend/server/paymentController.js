import crypto from 'crypto';
import { db } from './db.js';
import { getRazorpayInstance, getRazorpayKeyId } from './razorpay.js';

export const PROTECTION_PLANS = [
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

function normalizePlanName(planName) {
  return String(planName || '').trim().toLowerCase().replace(/\s+plan$/, '');
}

function findPlan(planName) {
  const normalized = normalizePlanName(planName);
  return PROTECTION_PLANS.find((plan) => plan.id === normalized || plan.name.toLowerCase() === normalized);
}

function sanitizePayment(payment) {
  if (!payment) return null;
  return {
    id: payment.id,
    userId: payment.userId,
    planId: payment.planId,
    planName: payment.planName,
    razorpayOrderId: payment.razorpayOrderId,
    razorpayPaymentId: payment.razorpayPaymentId,
    amount: payment.amount,
    currency: payment.currency,
    status: payment.status,
    paymentDate: payment.paymentDate,
    createdAt: payment.createdAt,
  };
}

export function getPaymentPlans(req, res) {
  return res.json({ plans: PROTECTION_PLANS });
}

export async function createRazorpayOrder(req, res) {
  try {
    const { planName, amount } = req.body;
    const plan = findPlan(planName);

    if (!plan) {
      return res.status(400).json({ error: 'Invalid protection plan selected.' });
    }

    if (Number(amount) !== plan.amount) {
      return res.status(400).json({ error: 'Invalid amount for selected protection plan.' });
    }

    const amountInPaise = plan.amount * 100;
    const razorpay = getRazorpayInstance();
    const receipt = `rcpt_${req.user.id}_${Date.now()}`.slice(0, 40);

    const order = await razorpay.orders.create({
      amount: amountInPaise,
      currency: 'INR',
      receipt,
      notes: {
        userId: req.user.id,
        planId: plan.id,
        planName: plan.name,
      },
    });

    const payment = db.payments.create({
      userId: req.user.id,
      planId: plan.id,
      planName: plan.name,
      razorpayOrderId: order.id,
      amount: amountInPaise,
      currency: order.currency || 'INR',
      status: 'Pending',
    });

    return res.status(201).json({
      orderId: order.id,
      amount: amountInPaise,
      currency: order.currency || 'INR',
      keyId: getRazorpayKeyId(),
      payment: sanitizePayment(payment),
    });
  } catch (err) {
    console.error('[Payment] Create order failed:', err);
    return res.status(500).json({ error: err.message || 'Unable to create payment order.' });
  }
}

export async function verifyRazorpayPayment(req, res) {
  try {
    const {
      razorpay_order_id: razorpayOrderId,
      razorpay_payment_id: razorpayPaymentId,
      razorpay_signature: razorpaySignature,
    } = req.body;

    if (!razorpayOrderId || !razorpayPaymentId || !razorpaySignature) {
      return res.status(400).json({ error: 'Missing Razorpay payment verification fields.' });
    }

    const payment = db.payments.findOne((p) => p.razorpayOrderId === razorpayOrderId && p.userId === req.user.id);
    if (!payment) {
      return res.status(404).json({ error: 'Payment order not found for this user.' });
    }

    const expectedSignature = crypto
      .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
      .update(`${razorpayOrderId}|${razorpayPaymentId}`)
      .digest('hex');

    const isValidSignature = crypto.timingSafeEqual(
      Buffer.from(expectedSignature),
      Buffer.from(razorpaySignature)
    );

    if (!isValidSignature) {
      const failed = db.payments.update(payment.id, {
        razorpayPaymentId,
        status: 'Failed',
        paymentDate: new Date().toISOString(),
      });

      return res.status(400).json({
        success: false,
        error: 'Payment signature verification failed.',
        payment: sanitizePayment(failed),
      });
    }

    const successfulPayment = db.payments.update(payment.id, {
      razorpayPaymentId,
      status: 'Success',
      paymentDate: new Date().toISOString(),
    });

    return res.json({
      success: true,
      message: 'Payment verified successfully.',
      payment: sanitizePayment(successfulPayment),
      subscription: {
        userId: req.user.id,
        planId: successfulPayment.planId,
        planName: successfulPayment.planName,
        status: 'Active',
        activatedAt: successfulPayment.paymentDate,
      },
    });
  } catch (err) {
    console.error('[Payment] Verification failed:', err);
    return res.status(500).json({ error: err.message || 'Unable to verify payment.' });
  }
}

export function getActivePaymentPlan(req, res) {
  const successfulPayments = db.payments
    .find((payment) => payment.userId === req.user.id && payment.status === 'Success')
    .sort((a, b) => new Date(b.paymentDate || b.createdAt).getTime() - new Date(a.paymentDate || a.createdAt).getTime());

  const activePayment = successfulPayments[0] || null;

  return res.json({
    activePlan: activePayment
      ? {
          planId: activePayment.planId,
          planName: activePayment.planName,
          amount: activePayment.amount,
          currency: activePayment.currency,
          status: 'Active',
          paymentDate: activePayment.paymentDate,
        }
      : null,
  });
}

