import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getVehicleAssignments } from '../../services/vehicleApiService';
import { Card } from '../ui/Card';
import { ICONS } from '../../constants';

// Definisikan tipe data sementara di sini, idealnya ini ada di types.ts
interface AssignedOrder {
    id: string;
    storeName: string;
    status: string;
    isRouted: boolean;
}

interface VehicleWithAssignments {
    id: string;
    plateNumber: string;
    model: string;
    region: string;
    assignedOrders: AssignedOrder[];
}

export const FleetLoadManagement: React.FC = () => {
    const [expandedId, setExpandedId] = useState<string | null>(null);

    const { data: vehicles = [], isLoading } = useQuery<VehicleWithAssignments[]>({
        queryKey: ['vehicleAssignments'],
        queryFn: getVehicleAssignments,
    });

    const toggleExpand = (vehicleId: string) => {
        setExpandedId(expandedId === vehicleId ? null : vehicleId);
    };

    if (isLoading) {
        return <div className="p-8">Memuat data muatan armada...</div>;
    }

    return (
        <div className="p-8 space-y-6">
            <h1 className="text-3xl font-bold text-brand-dark">Manajemen Muatan Per Rute</h1>
            <Card className="bg-blue-50 border border-blue-200">
                <div className="flex items-start gap-4">
                    <div className="flex-shrink-0 text-brand-primary pt-1">
                        <ICONS.info />
                    </div>
                    <div>
                        <h3 className="text-md font-bold text-brand-dark">Alur Kerja Baru</h3>
                        <p className="text-sm text-gray-700 mt-1">
                            Halaman ini menampilkan pesanan yang telah ditugaskan ke setiap armada (muatan). 
                            Setelah muatan siap, buka halaman <strong>Perencanaan Rute</strong> untuk menghasilkan urutan pengiriman yang optimal.
                        </p>
                    </div>
                </div>
            </Card>

            <div className="space-y-4">
                {vehicles.length === 0 ? (
                    <Card><p className="text-center py-10 text-gray-500">Tidak ada kendaraan.</p></Card>
                ) : (
                    vehicles.map(vehicle => (
                        <Card key={vehicle.id} className="!p-0">
                            <div 
                                className="flex justify-between items-center p-4 cursor-pointer hover:bg-gray-50"
                                onClick={() => toggleExpand(vehicle.id)}
                            >
                                <div>
                                    <p className="font-bold text-lg text-brand-primary">{vehicle.plateNumber} <span className="text-sm font-normal text-gray-600">({vehicle.model})</span></p>
                                    <p className="text-sm text-gray-500">Wilayah: {vehicle.region}</p>
                                </div>
                                <div className="flex items-center gap-4">
                                    <span className="font-mono text-lg">{vehicle.assignedOrders.length} Pesanan</span>
                                    <ICONS.chevronDown className={`transition-transform duration-200 ${expandedId === vehicle.id ? 'rotate-180' : ''}`} />
                                </div>
                            </div>

                            {expandedId === vehicle.id && (
                                <div className="border-t p-4 bg-gray-50/50">
                                    {vehicle.assignedOrders.length === 0 ? (
                                        <p className="text-sm text-center text-gray-500 py-4">Belum ada pesanan yang ditugaskan ke armada ini.</p>
                                    ) : (
                                        <table className="min-w-full text-sm">
                                            <thead className="text-left text-gray-500">
                                                <tr>
                                                    <th className="p-2">ID Pesanan</th>
                                                    <th className="p-2">Toko</th>
                                                    <th className="p-2">Status Pesanan</th>
                                                    <th className="p-2">Status Rute</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {vehicle.assignedOrders.map(order => (
                                                    <tr key={order.id} className="border-b">
                                                        <td className="p-2 font-mono text-xs">{order.id.slice(-12).toUpperCase()}</td>
                                                        <td className="p-2">{order.storeName}</td>
                                                        <td className="p-2">
                                                            <span className="px-2 py-1 text-xs font-semibold rounded-full bg-yellow-100 text-yellow-800">
                                                                {order.status}
                                                            </span>
                                                        </td>
                                                        <td className="p-2">
                                                            {order.isRouted ? (
                                                                <span className="px-2 py-1 text-xs font-semibold rounded-full bg-green-100 text-green-800">
                                                                    Dirutekan
                                                                </span>
                                                            ) : (
                                                                <span className="px-2 py-1 text-xs font-semibold rounded-full bg-blue-100 text-blue-800">
                                                                    Belum Dirutekan
                                                                </span>
                                                            )}
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    )}
                                </div>
                            )}
                        </Card>
                    ))
                )}
            </div>
        </div>
    );
};