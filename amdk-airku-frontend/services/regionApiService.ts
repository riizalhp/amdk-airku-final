import api from './api';

export const checkRegion = async (lat: number, lng: number): Promise<{ success: boolean; region: string; message?: string }> => {
    try {
        const response = await api.post('/regions/check', { lat, lng });
        return response.data;
    } catch (error: any) { // eslint-disable-line @typescript-eslint/no-explicit-any
        const message = error.response?.data?.message || 'Terjadi kesalahan pada server';
        return { success: false, region: '', message };
    }
};