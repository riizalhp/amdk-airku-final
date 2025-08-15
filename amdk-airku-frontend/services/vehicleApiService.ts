
import api from './api';
import { Vehicle } from '../types';

export const getVehicles = async (): Promise<Vehicle[]> => {
    const response = await api.get('/vehicles');
    return response.data;
};

export const createVehicle = async (vehicleData: Omit<Vehicle, 'id'>): Promise<Vehicle> => {
    const response = await api.post('/vehicles', vehicleData);
    return response.data;
};

export const updateVehicle = async (vehicleData: Vehicle): Promise<Vehicle> => {
    const { id, ...updateData } = vehicleData;
    const response = await api.put(`/vehicles/${id}`, updateData);
    return response.data;
};

export const deleteVehicle = async (vehicleId: string): Promise<void> => {
    await api.delete(`/vehicles/${vehicleId}`);
};

export const getVehicleAssignments = async (): Promise<any[]> => {
    const response = await api.get('/vehicles/assignments');
    return response.data;
};
