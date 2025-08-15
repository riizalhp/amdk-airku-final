import api from './api';
import { Order, Store, User, RoutePlan, SalesVisitRoutePlan, Visit, SurveyResponse } from '../types';

interface DashboardData {
    orders: Order[];
    stores: Store[];
    users: User[];
    routes: RoutePlan[];
    salesRoutes: SalesVisitRoutePlan[];
    visits: Visit[];
    surveys: SurveyResponse[];
}

export const getDashboardData = async (): Promise<DashboardData> => {
    // Gunakan Promise.all untuk mengambil data secara bersamaan untuk performa yang lebih baik
    const [ordersRes, storesRes, usersRes, routesRes, salesRoutesRes, visitsRes, surveysRes] = await Promise.all([
        api.get('/orders'),
        api.get('/stores'),
        api.get('/users'),
        api.get('/routes'),
        api.get('/sales-routes'),
        api.get('/visits'),
        api.get('/surveys'),
    ]);

    return {
        orders: ordersRes.data,
        stores: storesRes.data,
        users: usersRes.data,
        routes: routesRes.data,
        salesRoutes: salesRoutesRes.data,
        visits: visitsRes.data,
        surveys: surveysRes.data,
    };
};