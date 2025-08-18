
import api from './api';
import { Store } from '../types';

export const getStores = async (): Promise<Store[]> => {
    const response = await api.get('/stores');
    return response.data;
};

export const createStore = async (storeData: Omit<Store, 'id' | 'subscribedSince' | 'lastOrder'>): Promise<Store> => {
    const response = await api.post('/stores', storeData);
    return response.data;
};

export const updateStore = async (storeData: Store): Promise<Store> => {
    const { id, ...updateData } = storeData;
    const response = await api.put(`/stores/${id}`, updateData);
    return response.data;
};

export const deleteStore = async (storeId: string): Promise<void> => {
    await api.delete(`/stores/${storeId}`);
};
