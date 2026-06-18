import axios from 'axios';

const api = axios.create({
  baseURL: '/api',
  headers: {
    'Content-Type': 'application/json',
  },
});

const authHeaders = (token) => (
  token ? { Authorization: `Bearer ${token}` } : {}
);

export const getMechanics = async (params = {}) => {
  const response = await api.get('/mechanics', { params });
  return response.data;
};

export const assignMechanicToClaim = async ({ claimId, mechanicId, token }) => {
  const response = await api.put(
    `/claims/${claimId}/assign-mechanic`,
    { mechanicId },
    { headers: authHeaders(token) }
  );
  return response.data;
};

export default {
  getMechanics,
  assignMechanicToClaim,
};
