import React, { useMemo } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { useQuery } from '@tanstack/react-query';
import { Card } from '../ui/Card';
import { ICONS } from '../../constants';
import { OrderStatus, Role, VisitStatus, RoutePlan, SalesVisitRoutePlan, VehicleStatus } from '../../types';
import { getDashboardData } from '../../services/dashboardApiService';

const kpiData = [
  { title: "Penjualan Item", icon: <span className="text-green-500"><ICONS.product /></span>, key: 'totalItemsSold', changeKey: 'totalItemsSoldChange', changeText: 'hari ini' },
  { title: "Pesanan Pending", icon: <span className="text-yellow-500"><ICONS.orders /></span>, key: 'pendingOrders', changeKey: 'pendingOrdersChange', changeText: 'hari ini' },
  { title: "Total Toko", icon: <span className="text-blue-500"><ICONS.store /></span>, key: 'totalStores', changeKey: 'totalStoresChange', changeText: 'hari ini' },
  { title: "Total Survei", icon: <span className="text-purple-500"><ICONS.survey /></span>, key: 'totalSurveys', changeKey: 'totalSurveysChange', changeText: 'hari ini' },
];

const formatTimeAgo = (date: Date): string => {
    const now = new Date();
    const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);
    
    let interval = seconds / 31536000;
    if (interval > 1) return Math.floor(interval) + " tahun lalu";
    interval = seconds / 2592000;
    if (interval > 1) return Math.floor(interval) + " bulan lalu";
    interval = seconds / 86400;
    if (interval > 1) return Math.floor(interval) + " hari lalu";
    interval = seconds / 3600;
    if (interval > 1) return Math.floor(interval) + " jam lalu";
    interval = seconds / 60;
    if (interval > 1) return Math.floor(interval) + " menit lalu";
    return "Baru saja";
};


export const Dashboard: React.FC = () => {
    const { data, isLoading, error } = useQuery({
      queryKey: ['dashboardData'],
      queryFn: getDashboardData
    });

    const kpiValues = useMemo(() => {
        if (!data) return {};
        
        const { orders = [], surveys = [], stores = [] } = data;
        
        const today = new Date();
        const todayStr = today.toISOString().split('T')[0];
        
        // Items Sold
        const deliveredOrders = orders.filter(o => o.status === OrderStatus.DELIVERED);
        const totalItemsSold = deliveredOrders.reduce((sum, order) => sum + order.items.reduce((itemSum, item) => itemSum + item.quantity, 0), 0);
        const totalItemsSoldChange = deliveredOrders
            .filter(o => o.orderDate === todayStr)
            .reduce((sum, order) => sum + order.items.reduce((itemSum, item) => itemSum + item.quantity, 0), 0);

        // Pending Orders
        const pendingOrders = orders.filter(o => o.status === OrderStatus.PENDING).length;
        const pendingOrdersChange = orders.filter(o => o.orderDate === todayStr).length;
        
        // Total Stores
        const totalStores = stores.length;
        const totalStoresChange = stores.filter(s => s.subscribedSince === todayStr).length;

        // Total Surveys
        const totalSurveys = surveys.length;
        const totalSurveysChange = surveys.filter(s => s.surveyDate === todayStr).length;

        return {
            totalItemsSold,
            totalItemsSoldChange,
            pendingOrders,
            pendingOrdersChange,
            totalStores,
            totalStoresChange,
            totalSurveys,
            totalSurveysChange
        };
    }, [data]);

    const weeklySalesData = useMemo(() => {
        if (!data) return [];
        const { orders = [] } = data;

        const last7Days = Array.from({ length: 7 }, (_, i) => {
            const d = new Date();
            d.setDate(d.getDate() - i);
            return d;
        }).reverse();

        return last7Days.map(date => {
            const dayStr = date.toISOString().split('T')[0];
            const dayName = date.toLocaleDateString('en-US', { weekday: 'short' });
            
            const total = orders
                .filter(o => o.status === OrderStatus.DELIVERED && o.orderDate === dayStr)
                .reduce((sum, o) => sum + Number(o.totalAmount), 0);

            return { name: dayName, sales: total / 1000 };
        });
    }, [data]);
    
    type Activity = {
        id: string;
        timestamp: Date;
        Icon: React.FC<React.SVGProps<SVGSVGElement>>;
        text: React.ReactNode;
        iconBgClass: string;
    };

    const activityFeed = useMemo(() => {
        if (!data) return [];
        const { orders = [], routes = [], visits = [], surveys = [], stores = [], users = [] } = data;
        const activities: Activity[] = [];

        orders.forEach(order => {
            if (order.status === OrderStatus.PENDING) {
                activities.push({
                    id: `order-new-${order.id}`,
                    timestamp: new Date(order.orderDate),
                    Icon: ICONS.orders,
                    iconBgClass: 'bg-blue-100 text-blue-600',
                    text: <p>Pesanan baru untuk <strong>{order.storeName}</strong> oleh <strong>{order.orderedBy.name}</strong>.</p>
                });
            }
        });

        routes.forEach(route => {
            route.stops.forEach(stop => {
                const driverName = users.find(u => u.id === route.driverId)?.name || 'Pengemudi';
                if (stop.status === 'Completed') {
                     activities.push({
                        id: `stop-comp-${stop.id}`,
                        timestamp: new Date(route.date),
                        Icon: ICONS.checkCircle,
                        iconBgClass: 'bg-green-100 text-green-600',
                        text: <p>Pengiriman ke <strong>{stop.storeName}</strong> oleh <strong>{driverName}</strong> selesai.</p>
                     });
                } else if (stop.status === 'Failed') {
                    activities.push({
                        id: `stop-fail-${stop.id}`,
                        timestamp: new Date(route.date),
                        Icon: ICONS.xCircle,
                        iconBgClass: 'bg-red-100 text-red-600',
                        text: <p>Pengiriman ke <strong>{stop.storeName}</strong> oleh <strong>{driverName}</strong> gagal.</p>
                    });
                }
            });
        });

        visits.forEach(visit => {
             const salesName = users.find(u => u.id === visit.salesPersonId)?.name || 'Sales';
             const storeName = stores.find(s => s.id === visit.storeId)?.name || 'Toko';
             if (visit.status === VisitStatus.COMPLETED) {
                 activities.push({
                    id: `visit-comp-${visit.id}`,
                    timestamp: new Date(visit.visitDate),
                    Icon: ICONS.calendar,
                    iconBgClass: 'bg-green-100 text-green-600',
                    text: <p>Kunjungan ke <strong>{storeName}</strong> oleh <strong>{salesName}</strong> selesai.</p>
                 });
             } else if (visit.status === VisitStatus.SKIPPED) {
                  activities.push({
                    id: `visit-skip-${visit.id}`,
                    timestamp: new Date(visit.visitDate),
                    Icon: ICONS.calendar,
                    iconBgClass: 'bg-yellow-100 text-yellow-600',
                    text: <p>Kunjungan ke <strong>{storeName}</strong> oleh <strong>{salesName}</strong> dilewati.</p>
                 });
             }
        });
        
        surveys.forEach(survey => {
             const salesName = users.find(u => u.id === survey.salesPersonId)?.name || 'Sales';
             activities.push({
                id: `survey-${survey.id}`,
                timestamp: new Date(survey.surveyDate),
                Icon: ICONS.survey,
                iconBgClass: 'bg-purple-100 text-purple-600',
                text: <p><strong>{salesName}</strong> mengirimkan survei baru untuk <strong>{survey.storeName}</strong>.</p>
             });
        });
        
        stores.forEach(store => {
             activities.push({
                id: `store-${store.id}`,
                timestamp: new Date(store.subscribedSince),
                Icon: ICONS.store,
                iconBgClass: 'bg-indigo-100 text-indigo-600',
                text: <p>Toko baru <strong>{store.name}</strong> ditambahkan di wilayah <strong>{store.region}</strong>.</p>
             });
        });

        return activities
            .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
            .slice(0, 15);
    }, [data]);


    if (isLoading) {
        return <div className="p-8">Memuat data dasbor...</div>;
    }

    if (error) {
        return <div className="p-8 text-red-500">Gagal memuat dasbor: {(error as Error).message}</div>;
    }

    return (
        <div className="p-8 space-y-8">
            <h1 className="text-3xl font-bold text-brand-dark">Dasbor Admin</h1>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                 {kpiData.map(kpi => {
                    const value = (kpiValues as any)[kpi.key];
                    const changeValue = kpi.changeKey ? (kpiValues as any)[kpi.changeKey] : null;

                    return (
                        <Card key={kpi.title} className="flex items-start space-x-4">
                            <div className="p-3 bg-gray-100 rounded-full mt-1">
                                <span className="w-8 h-8 flex items-center justify-center">{kpi.icon}</span>
                            </div>
                            <div>
                                <p className="text-sm text-gray-500">{kpi.title}</p>
                                <p className="text-3xl font-bold text-brand-dark">
                                    {value !== undefined ? value.toLocaleString('id-ID') : '...'}
                                </p>
                                {changeValue > 0 && kpi.changeText && (
                                    <p className="text-xs text-green-600 mt-1 flex items-center font-semibold">
                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 15l7-7 7 7" />
                                        </svg>
                                        +{changeValue.toLocaleString('id-ID')} {kpi.changeText}
                                    </p>
                                )}
                            </div>
                        </Card>
                    );
                })}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
                <Card className="lg:col-span-3">
                    <h2 className="text-xl font-semibold text-brand-dark mb-4">Performa Penjualan Mingguan</h2>
                    <ResponsiveContainer width="100%" height={350}>
                        <LineChart data={weeklySalesData}>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis dataKey="name" />
                            <YAxis tickFormatter={(value) => `Rp ${Number(value)}k`} />
                            <Tooltip formatter={(value: number) => `Rp ${(value * 1000).toLocaleString('id-ID')}`} />
                            <Legend />
                            <Line type="monotone" dataKey="sales" stroke="#0077B6" strokeWidth={2} activeDot={{ r: 8 }} />
                        </LineChart>
                    </ResponsiveContainer>
                </Card>
                <Card className="lg:col-span-2">
                    <h2 className="text-xl font-semibold text-brand-dark mb-4">Aktivitas Terbaru</h2>
                    <div className="space-y-4 max-h-[350px] overflow-y-auto pr-2">
                        {activityFeed.length === 0 ? (<p className="text-center text-gray-500 py-10">Tidak ada aktivitas terbaru.</p>) : (
                           activityFeed.map(activity => {
                               const Icon = activity.Icon;
                               return (
                                   <div key={activity.id} className="flex items-start space-x-3">
                                       <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${activity.iconBgClass}`}>
                                           <Icon width={18} height={18} />
                                       </div>
                                       <div className="flex-1 text-sm">
                                           {activity.text}
                                           <p className="text-xs text-gray-400 mt-0.5">{formatTimeAgo(activity.timestamp)}</p>
                                       </div>
                                   </div>
                               );
                           })
                        )}
                    </div>
                </Card>
            </div>
        </div>
    );
};