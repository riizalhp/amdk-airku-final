
import api from './api';
import { RoutePlan, SalesVisitRoutePlan } from '../types';

// --- Delivery Routes ---
export const getDeliveryRoutes = async (filters: { driverId?: string, date?: string } = {}): Promise<RoutePlan[]> => {
    const response = await api.get('/routes', { params: filters });
    return response.data;
};

export const createDeliveryRoute = async (payload: { deliveryDate: string, vehicleId: string, driverId: string }): Promise<{ success: boolean, message: string, routes: RoutePlan[] }> => {
    const response = await api.post('/routes/plan', payload);
    return response.data;
};

export const deleteDeliveryRoute = async (routeId: string): Promise<void> => {
    // Backend should handle reverting order statuses
    await api.delete(`/routes/${routeId}`);
};

export const updateDeliveryStopStatus = async (payload: { stopId: string, status: 'Completed' | 'Failed', proofImage?: string, failureReason?: string }): Promise<void> => {
    await api.put(`/routes/stops/${payload.stopId}/status`, payload);
}

export const startOrCompleteTrip = async(vehicleId: string, action: 'start' | 'complete'): Promise<void> => {
    await api.post(`/vehicles/${vehicleId}/trip-status`, { action });
}

export const moveOrder = async (payload: { orderId: string, newVehicleId: string | null }): Promise<void> => {
    await api.post('/routes/move-order', payload);
};


// --- Sales Visit Routes ---
export const getSalesRoutes = async (filters: { salesPersonId?: string, date?: string } = {}): Promise<SalesVisitRoutePlan[]> => {
    const response = await api.get('/sales-routes', { params: filters });
    return response.data;
};

export const createSalesRoute = async (payload: { salesPersonId: string, visitDate: string }): Promise<{ success: boolean, message: string, plan: SalesVisitRoutePlan }> => {
    const response = await api.post('/sales-routes/plan', payload);
    return response.data;
};

export const deleteSalesRoute = async (routeId: string): Promise<void> => {
    await api.delete(`/sales-routes/${routeId}`);
};
