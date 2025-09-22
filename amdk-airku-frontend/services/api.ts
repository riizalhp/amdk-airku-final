
import axios from 'axios';

const api = axios.create({
  baseURL: 'https://amdk-airku-final-production-cdc3.up.railway.app/api', // Adjust if your backend runs on a different port
  headers: {
    'Content-Type': 'application/json',
  },
});

export const setAuthToken = (token: string | null) => {
  if (token) {
    api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
  } else {
    delete api.defaults.headers.common['Authorization'];
  }
};

export default api;
