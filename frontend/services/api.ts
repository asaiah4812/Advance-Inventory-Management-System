import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { router } from 'expo-router';

// Replace with your backend's local IP address if testing on a real device
// e.g., 'http://192.168.1.100:8000'
const API_URL = 'http://192.168.188.111:8000'; 

const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

api.interceptors.request.use(
  async (config) => {
    try {
      const token = await AsyncStorage.getItem('@auth_token');
      if (token && config.headers) {
        config.headers.Authorization = `Bearer ${token}`;
      }
    } catch (e) {
      console.error('Error fetching token for API request', e);
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response && error.response.status === 401) {
      // Token is invalid or expired
      await AsyncStorage.removeItem('@auth_token');
      // refresh_token isn't currently used but good to keep key names consistent if added later
      
      // Navigate to login
      try {
        router.replace('/login');
      } catch (e) {
        // Router might not be mounted yet
      }
    }
    return Promise.reject(error);
  }
);

export default api;
