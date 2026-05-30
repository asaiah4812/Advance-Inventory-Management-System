import AsyncStorage from '@react-native-async-storage/async-storage';
import api from './api';

const TOKEN_KEY = '@auth_token';

export const AuthService = {
  async login(username: string, password: string) {
    try {
      const response = await api.post('/api/token/', { username, password });
      if (response.data && response.data.access) {
        await AsyncStorage.setItem(TOKEN_KEY, response.data.access);
        api.defaults.headers.common['Authorization'] = `Bearer ${response.data.access}`;
        return true;
      }
      return false;
    } catch (e) {
      console.error('Login error', e);
      throw e;
    }
  },

  async logout() {
    await AsyncStorage.removeItem(TOKEN_KEY);
    delete api.defaults.headers.common['Authorization'];
  },

  async getToken() {
    return await AsyncStorage.getItem(TOKEN_KEY);
  },

  async isAuthenticated() {
    const token = await this.getToken();
    if (token) {
      api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
      return true;
    }
    return false;
  }
};
