
import axios from 'axios';

const api = axios.create({
  baseURL: 'http://localhost:3001/api', // Adjust if your backend runs on a different port
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
