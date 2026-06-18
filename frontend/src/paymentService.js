import axios from 'axios';

function authHeaders(token) {
  return {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  };
}

export async function getPaymentPlans(token) {
  const { data } = await axios.get('/api/payment/plans', authHeaders(token));
  return data.plans;
}

export async function getActivePlan(token) {
  const { data } = await axios.get('/api/payment/active-plan', authHeaders(token));
  return data.activePlan;
}

export async function createPaymentOrder(token, plan) {
  const { data } = await axios.post(
    '/api/payment/create-order',
    {
      planName: plan.name,
      amount: plan.amount,
    },
    authHeaders(token)
  );
  return data;
}

export async function verifyPayment(token, paymentResponse) {
  const { data } = await axios.post(
    '/api/payment/verify-payment',
    paymentResponse,
    authHeaders(token)
  );
  return data;
}

