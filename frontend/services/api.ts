import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { router } from 'expo-router';
import { getApiBaseUrl } from './serverConfig';

const api = axios.create({
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 15000,
});

api.interceptors.request.use(
  async (config) => {
    config.baseURL = await getApiBaseUrl();
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
  (error) => Promise.reject(error)
);

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response && error.response.status === 401) {
      await AsyncStorage.removeItem('@auth_token');
      try {
        router.replace('/login');
      } catch {
        // Router might not be mounted yet
      }
    }
    return Promise.reject(error);
  }
);

/**
 * Quick check that the phone can reach Django.
 * Pass overrideUrl to test a specific URL directly (used when saving a new IP).
 */
export async function testServerConnection(
  overrideUrl?: string,
): Promise<{ ok: boolean; url: string; message: string }> {
  const url = overrideUrl ?? (await getApiBaseUrl());
  try {
    const res = await axios.get(`${url}/api/categories/`, { timeout: 8000 });
    if (res.status >= 200 && res.status < 300) {
      return { ok: true, url, message: 'Connected to server' };
    }
    return { ok: false, url, message: `Unexpected response (${res.status})` };
  } catch (e: unknown) {
    const err = e as { message?: string; code?: string };
    const hint =
      err.code === 'ECONNABORTED'
        ? 'Request timed out — check IP, Wi-Fi, and that Django is running on 0.0.0.0:8000'
        : `Cannot reach ${url}\n\nCheck:\n• Django running: python manage.py runserver 0.0.0.0:8000\n• Phone on same Wi-Fi as PC\n• Correct IP (run ipconfig on PC)`;
    return { ok: false, url, message: hint };
  }
}

export default api;
