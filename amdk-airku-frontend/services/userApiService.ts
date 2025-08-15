
import api from './api';
import { User } from '../types';

export const getUsers = async (): Promise<User[]> => {
    const response = await api.get('/users');
    return response.data;
};

export const registerUser = async (userData: Omit<User, 'id' | 'role'>): Promise<{ message: string }> => {
    const response = await api.post('/auth/register', userData);
    return response.data;
};

export const createUser = async (userData: Omit<User, 'id'>): Promise<User> => {
    const response = await api.post('/users', userData);
    return response.data;
};

export const updateUser = async (userData: User): Promise<User> => {
    const { id, ...updateData } = userData;
    const response = await api.put(`/users/${id}`, updateData);
    return response.data;
};

export const deleteUser = async (userId: string): Promise<void> => {
    await api.delete(`/users/${userId}`);
};
