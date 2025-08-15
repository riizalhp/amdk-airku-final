
import api from './api';
import { Product } from '../types';

export const getProducts = async (): Promise<Product[]> => {
    const response = await api.get('/products');
    return response.data;
};

export const createProduct = async (productData: Omit<Product, 'id' | 'reservedStock'>): Promise<Product> => {
    const response = await api.post('/products', productData);
    return response.data;
};

export const updateProduct = async (productData: Product): Promise<Product> => {
    const { id, ...updateData } = productData;
    const response = await api.put(`/products/${id}`, updateData);
    return response.data;
};

export const deleteProduct = async (productId: string): Promise<void> => {
    await api.delete(`/products/${productId}`);
};
