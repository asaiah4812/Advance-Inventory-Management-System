import AsyncStorage from '@react-native-async-storage/async-storage';
import api from './api';
import 'react-native-get-random-values';
import { v4 as uuidv4 } from 'uuid';

const SYNC_QUEUE_KEY = '@sync_queue_sales';

export const SyncService = {
  async queueSale(saleData: any) {
    try {
      const currentQueue = await this.getQueue();
      const newSale = {
        ...saleData,
        client_id: uuidv4(),
        queued_at: new Date().toISOString(),
      };

      currentQueue.push(newSale);
      await AsyncStorage.setItem(SYNC_QUEUE_KEY, JSON.stringify(currentQueue));
      return newSale;
    } catch (e) {
      console.error('Error queueing sale', e);
      throw e;
    }
  },

  async getQueue() {
    try {
      const queue = await AsyncStorage.getItem(SYNC_QUEUE_KEY);
      return queue ? JSON.parse(queue) : [];
    } catch (e) {
      console.error('Error getting queue', e);
      return [];
    }
  },

  /** Post sale to server immediately when online; queue if offline or request fails. */
  async submitSale(saleData: any) {
    const payload = {
      ...saleData,
      client_id: saleData.client_id || uuidv4(),
    };

    try {
      const response = await api.post('/api/sales/', payload);
      return { ok: true as const, data: response.data, queued: false };
    } catch (e) {
      console.warn('Direct sale failed, queueing offline', e);
      const queued = await this.queueSale(saleData);
      return { ok: false as const, queued: true, data: queued };
    }
  },

  async syncNow() {
    try {
      const queue = await this.getQueue();
      if (queue.length === 0) return { message: 'Nothing to sync' };

      const response = await api.post('/api/sync/', { sales: queue });

      if (response.status === 200 || response.status === 201) {
        await AsyncStorage.setItem(SYNC_QUEUE_KEY, JSON.stringify([]));
        return response.data;
      }
    } catch (e) {
      console.error('Sync failed, will retry later', e);
      throw e;
    }
  },
};
