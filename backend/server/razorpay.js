import Razorpay from 'razorpay';

let razorpayInstance = null;

export function getRazorpayInstance() {
  const keyId = process.env.RAZORPAY_KEY_ID;
  const keySecret = process.env.RAZORPAY_KEY_SECRET;

  if (!keyId || !keySecret) {
    throw new Error('Razorpay credentials are missing. Set RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET.');
  }

  if (!razorpayInstance) {
    razorpayInstance = new Razorpay({
      key_id: keyId,
      key_secret: keySecret,
    });
  }

  return razorpayInstance;
}

export function getRazorpayKeyId() {
  if (!process.env.RAZORPAY_KEY_ID) {
    throw new Error('RAZORPAY_KEY_ID is missing.');
  }
  return process.env.RAZORPAY_KEY_ID;
}

