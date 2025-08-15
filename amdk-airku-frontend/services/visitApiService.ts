
import api from './api';
import { Visit, VisitStatus } from '../types';

export const getVisits = async (): Promise<Visit[]> => {
    const response = await api.get('/visits');
    return response.data;
};

export const createVisit = async (visitData: Omit<Visit, 'id' | 'status'>): Promise<Visit> => {
    const response = await api.post('/visits', visitData);
    return response.data;
};

// Now accepts a more flexible payload for both Sales and Admin updates
export const updateVisit = async (payload: { id: string } & Partial<Omit<Visit, 'id'>>): Promise<Visit> => {
    const { id, ...updateData } = payload;
    const response = await api.put(`/visits/${id}`, updateData);
    return response.data;
};

export const deleteVisit = async (visitId: string): Promise<void> => {
    await api.delete(`/visits/${visitId}`);
};
