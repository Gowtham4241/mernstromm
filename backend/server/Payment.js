import mongoose from 'mongoose';

export const PaymentSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  userId: { type: String, required: true, index: true },
  planId: { type: String, required: true, enum: ['basic', 'standard', 'premium'] },
  planName: { type: String, required: true },
  razorpayOrderId: { type: String, required: true, unique: true },
  razorpayPaymentId: { type: String },
  amount: { type: Number, required: true },
  currency: { type: String, required: true, default: 'INR' },
  status: { type: String, required: true, enum: ['Pending', 'Success', 'Failed'], default: 'Pending' },
  paymentDate: { type: String },
  createdAt: { type: String, required: true },
}, { strict: false });

export const PaymentModel = mongoose.models.Payment || mongoose.model('Payment', PaymentSchema);

