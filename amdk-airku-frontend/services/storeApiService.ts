
import api from './api';
import { Store, Coordinate } from '../types';

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

export const classifyRegion = async (coords: Coordinate): Promise<{ region: string }> => {
    const response = await api.post('/stores/classify-region', coords);
    return response.data;
};

export const geocodeAndClassifyAddress = async (address: string): Promise<{ coordinates: Coordinate, region: string, success: boolean, message: string }> => {
    const response = await api.post('/stores/geocode-classify', { address });
    return response.data;
};
