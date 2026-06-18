import { Router } from 'express';
import { requireAuth } from './auth.js';
import {
  createRazorpayOrder,
  getActivePaymentPlan,
  getPaymentPlans,
  verifyRazorpayPayment,
} from './paymentController.js';

const paymentRouter = Router();

paymentRouter.get('/plans', requireAuth, getPaymentPlans);
paymentRouter.get('/active-plan', requireAuth, getActivePaymentPlan);
paymentRouter.post('/create-order', requireAuth, createRazorpayOrder);
paymentRouter.post('/verify-payment', requireAuth, verifyRazorpayPayment);

export default paymentRouter;

