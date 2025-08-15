
import api from './api';
import { Order } from '../types';

type CreateOrderPayload = {
  storeId: string;
  items: { productId: string, quantity: number, specialPrice?: number }[];
  desiredDeliveryDate?: string;
}

type UpdateOrderPayload = {
    id: string;
    items: { productId: string, quantity: number, specialPrice?: number }[];
    assignedVehicleId: string | null;
    desiredDeliveryDate?: string;
}

type BatchAssignPayload = {
  orderIds: string[];
  vehicleId: string;
  deliveryDate: string;
};

export const getOrders = async (): Promise<Order[]> => {
    const response = await api.get('/orders');
    return response.data;
};

export const createOrder = async (orderData: CreateOrderPayload): Promise<Order> => {
    const response = await api.post('/orders', orderData);
    return response.data;
};

export const updateOrder = async (orderData: UpdateOrderPayload): Promise<Order> => {
    const { id, ...updateData } = orderData;
    const response = await api.put(`/orders/${id}`, updateData);
    return response.data;
};

export const deleteOrder = async (orderId: string): Promise<void> => {
    await api.delete(`/orders/${orderId}`);
};

export const batchAssignOrders = async (payload: BatchAssignPayload): Promise<{ message: string }> => {
    const response = await api.post('/orders/batch-assign', payload);
    return response.data;
};
