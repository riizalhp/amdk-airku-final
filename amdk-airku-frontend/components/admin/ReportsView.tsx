import React, { useState, useMemo, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Card } from '../ui/Card';
import { getOrders } from '../../services/orderApiService';
import { getProducts } from '../../services/productApiService';
import { getStores } from '../../services/storeApiService';
import { getUsers } from '../../services/userApiService';
import { getDeliveryRoutes } from '../../services/routeApiService';
import { getVehicles } from '../../services/vehicleApiService';
import { getVisits } from '../../services/visitApiService';
import { getSurveys } from '../../services/surveyApiService';
import { Order, Product, OrderStatus, Store, User, Role, RoutePlan, Vehicle, Visit, SurveyResponse, VisitStatus, RouteStop } from '../../types';
import { ICONS } from '../../constants';

// Reusable hook to fetch all data needed for reports
const useReportData = () => {
    const { data: orders = [], isLoading: l1 } = useQuery<Order[]>({ queryKey: ['orders'], queryFn: getOrders });
    const { data: products = [], isLoading: l2 } = useQuery<Product[]>({ queryKey: ['products'], queryFn: getProducts });
    const { data: stores = [], isLoading: l3 } = useQuery<Store[]>({ queryKey: ['stores'], queryFn: getStores });
    const { data: users = [], isLoading: l4 } = useQuery<User[]>({ queryKey: ['users'], queryFn: getUsers });
    const { data: routes = [], isLoading: l5 } = useQuery<RoutePlan[]>({ queryKey: ['deliveryRoutes'], queryFn: () => getDeliveryRoutes() });
    const { data: vehicles = [], isLoading: l6 } = useQuery<Vehicle[]>({ queryKey: ['vehicles'], queryFn: getVehicles });
    const { data: visits = [], isLoading: l7 } = useQuery<Visit[]>({ queryKey: ['visits'], queryFn: getVisits });
    const { data: surveys = [], isLoading: l8 } = useQuery<SurveyResponse[]>({ queryKey: ['surveys'], queryFn: getSurveys });

    const isLoading = l1 || l2 || l3 || l4 || l5 || l6 || l7 || l8;

    return { orders, products, stores, users, routes, vehicles, visits, surveys, isLoading };
};

// Generic Date Filter Component
const DateFilter: React.FC<{
    startDate: string;
    endDate: string;
    setStartDate: (date: string) => void;
    setEndDate: (date: string) => void;
    onExport: () => void;
    isExportDisabled: boolean;
    title?: string;
}> = ({ startDate, endDate, setStartDate, setEndDate, onExport, isExportDisabled, title = "Filter Laporan" }) => (
    <Card>
        <h2 className="text-xl font-semibold mb-4 text-brand-dark">{title}</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4 items-end">
            <div><label className="text-sm">Tanggal Mulai</label><input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="w-full p-2 border rounded mt-1" /></div>
            <div><label className="text-sm">Tanggal Akhir</label><input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="w-full p-2 border rounded mt-1" /></div>
            <button onClick={onExport} disabled={isExportDisabled} className="bg-brand-primary text-white font-bold py-2 px-4 rounded-lg flex items-center justify-center gap-2 disabled:bg-gray-400">
                <ICONS.fileText /> Ekspor ke PDF
            </button>
        </div>
    </Card>
);

const exportWithHeader = (
    doc: jsPDF,
    title: string,
    periodText: string,
    tableConfig: { head: any[][], body: any[][] }
) => {
    autoTable(doc, {
        ...tableConfig,
        didDrawPage: (data) => {
            doc.setFontSize(18);
            doc.setTextColor(40);
            doc.text(title, data.settings.margin.left, 22);
            doc.setFontSize(11);
            doc.setTextColor(100);
            doc.text(periodText, data.settings.margin.left, 30);
        },
        margin: { top: 35 }
    });
};

// --- 1. Sales Summary Report ---
const SalesSummaryReport: React.FC = () => {
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const { orders, isLoading } = useReportData();

    const filteredOrders = useMemo(() => {
        const allDelivered = orders.filter(o => o.status === OrderStatus.DELIVERED);
        if (!startDate || !endDate) return allDelivered;
        return allDelivered.filter(o => o.orderDate >= startDate && o.orderDate <= endDate);
    }, [orders, startDate, endDate]);

    const totalSales = useMemo(() => filteredOrders.reduce((sum, order) => sum + Number(order.totalAmount), 0), [filteredOrders]);

    const exportToPDF = () => {
        const doc = new jsPDF();
        const periodText = startDate && endDate ? `Periode: ${new Date(startDate).toLocaleDateString('id-ID')} - ${new Date(endDate).toLocaleDateString('id-ID')}` : 'Periode: Semua Waktu';
        
        doc.setFontSize(18);
        doc.text("Laporan Ringkasan Penjualan", 14, 22);
        doc.setFontSize(11);
        doc.text(periodText, 14, 30);
        
        autoTable(doc, {
            startY: 35,
            body: [
                ['Total Pendapatan', `Rp ${totalSales.toLocaleString('id-ID')}`],
                ['Total Pesanan Terkirim', `${filteredOrders.length}`],
            ], theme: 'plain'
        });

        let lastY = (doc as any).lastAutoTable.finalY;
        
        exportWithHeader(doc, 'Daftar Transaksi', periodText, {
            head: [['ID', 'Tanggal', 'Toko', 'Nilai (Rp)']],
            body: filteredOrders.map(o => [o.id.slice(0, 6).toUpperCase(), o.orderDate, o.storeName, Number(o.totalAmount).toLocaleString('id-ID')])
        });

        const fileName = `Laporan_Ringkasan_Penjualan_${startDate || 'all'}_${endDate || 'all'}.pdf`;
        doc.save(fileName);
    };

    if (isLoading) return <p>Memuat data...</p>;

    return (
        <div className="space-y-6">
            <DateFilter title="Filter Ringkasan Penjualan" startDate={startDate} endDate={endDate} setStartDate={setStartDate} setEndDate={setEndDate} onExport={exportToPDF} isExportDisabled={filteredOrders.length === 0} />
            <div className="mt-6 space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <Card><p className="text-sm text-gray-500">Total Pendapatan</p><p className="text-2xl font-bold">Rp {totalSales.toLocaleString('id-ID')}</p></Card>
                    <Card><p className="text-sm text-gray-500">Pesanan Terkirim</p><p className="text-2xl font-bold">{filteredOrders.length}</p></Card>
                </div>
                <Card><h3 className="font-semibold mb-2">Daftar Transaksi</h3><div className="overflow-auto max-h-96"><table className="min-w-full text-sm"><thead className="bg-gray-100 sticky top-0 z-10"><tr><th className="px-3 py-2 text-left">ID</th><th className="px-3 py-2 text-left">Tanggal</th><th className="px-3 py-2 text-left">Toko</th><th className="px-3 py-2 text-right">Nilai (Rp)</th></tr></thead><tbody>{filteredOrders.map(o => (<tr key={o.id} className="border-b"><td className="px-3 py-2 font-mono text-xs">{o.id.slice(0,6).toUpperCase()}</td><td className="px-3 py-2">{o.orderDate}</td><td className="px-3 py-2">{o.storeName}</td><td className="px-3 py-2 text-right">Rp {Number(o.totalAmount).toLocaleString('id-ID')}</td></tr>))}</tbody></table></div></Card>
            </div>
        </div>
    );
};

// --- 2. Product Sales Report ---
const ProductSalesReport: React.FC = () => {
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const { orders, products, isLoading } = useReportData();
    
    const productSales = useMemo(() => {
        const filtered = orders.filter(o => o.status === OrderStatus.DELIVERED && (!startDate || o.orderDate >= startDate) && (!endDate || o.orderDate <= endDate));
        const sales = filtered.flatMap(o => o.items).reduce<Record<string, { quantity: number; totalValue: number }>>((acc, item) => {
            const product = products.find(p => p.id === item.productId);
            if (!product) return acc;
            const price = item.specialPrice ?? item.originalPrice;
            if (!acc[product.name]) acc[product.name] = { quantity: 0, totalValue: 0 };
            acc[product.name].quantity += item.quantity;
            acc[product.name].totalValue += item.quantity * price;
            return acc;
        }, {});
        return Object.entries(sales).sort((a, b) => b[1].totalValue - a[1].totalValue);
    }, [orders, products, startDate, endDate]);

    const exportToPDF = () => {
        const doc = new jsPDF();
        const periodText = startDate && endDate ? `Periode: ${new Date(startDate).toLocaleDateString('id-ID')} - ${new Date(endDate).toLocaleDateString('id-ID')}` : 'Periode: Semua Waktu';
        exportWithHeader(doc, "Laporan Penjualan per Produk", periodText, {
            head: [['Produk', 'Jumlah (Unit)', 'Total Nilai (Rp)']],
            body: productSales.map(([name, data]) => [name, data.quantity, data.totalValue.toLocaleString('id-ID')])
        });
        doc.save(`Laporan_Penjualan_Produk_${startDate || 'all'}_${endDate || 'all'}.pdf`);
    };

    if (isLoading) return <p>Memuat data...</p>;
    
    return (
        <div className="space-y-6">
            <DateFilter title="Filter Penjualan per Produk" startDate={startDate} endDate={endDate} setStartDate={setStartDate} setEndDate={setEndDate} onExport={exportToPDF} isExportDisabled={productSales.length === 0} />
            <Card><div className="overflow-auto max-h-screen"><table className="min-w-full text-sm"><thead className="bg-gray-100 sticky top-0 z-10"><tr><th className="px-3 py-2 text-left">Produk</th><th className="px-3 py-2 text-right">Unit Terjual</th><th className="px-3 py-2 text-right">Total Nilai (Rp)</th></tr></thead><tbody>{productSales.map(([name, data]) => (<tr key={name} className="border-b"><td className="px-3 py-2">{name}</td><td className="px-3 py-2 text-right">{data.quantity}</td><td className="px-3 py-2 text-right">{data.totalValue.toLocaleString('id-ID')}</td></tr>))}</tbody></table></div></Card>
        </div>
    );
};

// --- 3. Region Sales Report ---
const RegionSalesReport: React.FC = () => {
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const { orders, stores, isLoading } = useReportData();

    const salesByRegion = useMemo(() => {
        const filtered = orders.filter(o => o.status === OrderStatus.DELIVERED && (!startDate || o.orderDate >= startDate) && (!endDate || o.orderDate <= endDate));
        const sales = filtered.reduce<Record<string, { totalValue: number; orderCount: number; }>>((acc, order) => {
            const store = stores.find(s => s.id === order.storeId);
            if (!store) return acc;
            if (!acc[store.region]) acc[store.region] = { totalValue: 0, orderCount: 0 };
            acc[store.region].totalValue += Number(order.totalAmount);
            acc[store.region].orderCount += 1;
            return acc;
        }, {});
        return Object.entries(sales).sort((a, b) => b[1].totalValue - a[1].totalValue);
    }, [orders, stores, startDate, endDate]);

    const exportToPDF = () => {
        const doc = new jsPDF();
        const periodText = startDate && endDate ? `Periode: ${new Date(startDate).toLocaleDateString('id-ID')} - ${new Date(endDate).toLocaleDateString('id-ID')}` : 'Periode: Semua Waktu';
        exportWithHeader(doc, "Laporan Penjualan per Wilayah", periodText, {
            head: [['Wilayah', 'Jumlah Pesanan', 'Total Nilai (Rp)']],
            body: salesByRegion.map(([name, data]) => [name, data.orderCount, data.totalValue.toLocaleString('id-ID')])
        });
        doc.save(`Laporan_Penjualan_Wilayah_${startDate || 'all'}_${endDate || 'all'}.pdf`);
    };

    if (isLoading) return <p>Memuat data...</p>;
    
    return (
        <div className="space-y-6">
            <DateFilter title="Filter Penjualan per Wilayah" startDate={startDate} endDate={endDate} setStartDate={setStartDate} setEndDate={setEndDate} onExport={exportToPDF} isExportDisabled={salesByRegion.length === 0} />
            <Card><div className="overflow-auto max-h-screen"><table className="min-w-full text-sm"><thead className="bg-gray-100 sticky top-0 z-10"><tr><th className="px-3 py-2 text-left">Wilayah</th><th className="px-3 py-2 text-right">Jumlah Pesanan</th><th className="px-3 py-2 text-right">Total Nilai (Rp)</th></tr></thead><tbody>{salesByRegion.map(([name, data]) => (<tr key={name} className="border-b"><td className="px-3 py-2">{name}</td><td className="px-3 py-2 text-right">{data.orderCount}</td><td className="px-3 py-2 text-right">{data.totalValue.toLocaleString('id-ID')}</td></tr>))}</tbody></table></div></Card>
        </div>
    );
};


// --- 4. Delivery Manifest Report ---
const DeliveryManifestReport: React.FC = () => {
    const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
    const [selectedDriverId, setSelectedDriverId] = useState('all');
    const { routes, users, vehicles, orders, products, isLoading } = useReportData();
    
    const routesForDate = useMemo(() => routes.filter(r => r.date === selectedDate), [routes, selectedDate]);
    
    const driversOnDate = useMemo(() => {
        const driverIds = new Set(routesForDate.map(r => r.driverId));
        return users.filter(u => u.role === Role.DRIVER && driverIds.has(u.id));
    }, [routesForDate, users]);

    useEffect(() => { setSelectedDriverId('all'); }, [selectedDate]);

    const manifestsByDriver = useMemo(() => {
        const manifestMap = new Map();
        routesForDate.forEach(route => {
            const driverId = route.driverId;
            if (!manifestMap.has(driverId)) {
                const driver = users.find(u => u.id === driverId);
                const vehicle = vehicles.find(v => v.id === route.vehicleId);
                manifestMap.set(driverId, { driverId, driverName: driver?.name, vehiclePlate: vehicle?.plateNumber, date: selectedDate, stops: [] });
            }
            const manifest = manifestMap.get(driverId);
            const stopsWithItems = route.stops.map(stop => {
                const order = orders.find(o => o.id === stop.orderId);
                const items = order?.items.map(item => ({ name: products.find(p => p.id === item.productId)?.name || 'N/A', quantity: item.quantity })) || [];
                return { ...stop, items };
            });
            manifest.stops.push(...stopsWithItems);
        });
        return Array.from(manifestMap.values());
    }, [routesForDate, users, vehicles, orders, products, selectedDate]);
    
    const displayedManifests = useMemo(() => {
        if (selectedDriverId === 'all') return manifestsByDriver;
        return manifestsByDriver.filter(m => m.driverId === selectedDriverId);
    }, [manifestsByDriver, selectedDriverId]);
    
    const exportToPDF = (manifestData: any) => {
        const doc = new jsPDF();
        
        let lastY = 35;
        
        manifestData.stops.forEach((stop: any, index: number) => {
            const stopHeader = [[`Pemberhentian ${index + 1}: ${stop.storeName}`, `Alamat: ${stop.address}`]];
            const itemsBody = stop.items.map((item: any) => [item.quantity, item.name]);
            
            const tableHeight = (itemsBody.length + 2) * 10 + 20; 
            if (lastY + tableHeight > doc.internal.pageSize.getHeight() - 20) {
                doc.addPage();
                lastY = 15;
            }
            
            autoTable(doc, {
                startY: index === 0 ? undefined : lastY + 5,
                body: stopHeader,
                theme: 'grid',
                didDrawPage: (data) => {
                    doc.setFontSize(16);
                    doc.text("Manifest Pengiriman Harian", 105, 15, { align: 'center' });
                    doc.setFontSize(10);
                    doc.text(`Pengemudi: ${manifestData.driverName}`, 14, 25);
                    doc.text(`Armada: ${manifestData.vehiclePlate}`, 14, 30);
                    doc.text(`Tanggal: ${new Date(manifestData.date).toLocaleDateString('id-ID')}`, 14, 35);
                },
                margin: { top: 40 }
            });
            autoTable(doc, {
                head: [['Jumlah', 'Nama Barang']],
                body: itemsBody,
                theme: 'striped',
                headStyles: { fillColor: '#f3f4f6', textColor: '#1f2937' }
            });
            
            lastY = (doc as any).lastAutoTable.finalY + 5;
        });

        doc.save(`Manifest_${manifestData.driverName}_${manifestData.date}.pdf`);
    };

    if (isLoading) return <p>Memuat data manifest...</p>;

    return (
        <Card>
            <h2 className="text-xl font-semibold mb-4 text-brand-dark">Pilih Manifest Pengiriman</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                <div><label className="text-sm">Tanggal</label><input type="date" value={selectedDate} onChange={e => setSelectedDate(e.target.value)} className="w-full p-2 border rounded mt-1" /></div>
                <div><label className="text-sm">Pengemudi</label><select value={selectedDriverId} onChange={e => setSelectedDriverId(e.target.value)} className="w-full p-2 border rounded mt-1 bg-white" disabled={driversOnDate.length === 0}><option value="all">-- Semua Pengemudi --</option>{driversOnDate.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}</select></div>
            </div>
            
            {displayedManifests.length === 0 ? <p className="text-center py-4 text-gray-500">Tidak ada rute untuk filter yang dipilih.</p> :
            <div className="mt-6 space-y-8">
                {displayedManifests.map(manifestData => (
                    <div key={manifestData.driverId} className="p-4 border rounded-lg space-y-4 bg-gray-50">
                        <div className="flex justify-between items-start border-b pb-4 mb-4">
                            <div><h3 className="text-lg font-bold">{manifestData.driverName}</h3><p className="text-sm text-gray-600">Armada: {manifestData.vehiclePlate}</p></div>
                            <button onClick={() => exportToPDF(manifestData)} className="bg-brand-primary text-white font-bold py-2 px-4 rounded-lg flex items-center gap-2"><ICONS.fileText /> Cetak Manifest</button>
                        </div>
                        <div className="space-y-6 max-h-[60vh] overflow-y-auto pr-2">
                        {manifestData.stops.map((stop: any, index: number) => (
                            <div key={stop.id} className="p-4 border bg-white rounded-md shadow-sm">
                                <h4 className="font-bold text-md text-brand-primary">{index + 1}. {stop.storeName}</h4>
                                <p className="text-xs text-gray-500 mb-2">{stop.address}</p>
                                <table className="min-w-full text-xs">
                                    <thead className="bg-gray-100"><tr><th className="px-2 py-1 text-left">Jumlah</th><th className="px-2 py-1 text-left">Nama Barang</th></tr></thead>
                                    <tbody>{stop.items.map((item: any, itemIndex: number) => (<tr key={itemIndex} className="border-b"><td className="px-2 py-1 font-semibold">{item.quantity}</td><td className="px-2 py-1">{item.name}</td></tr>))}</tbody>
                                </table>
                            </div>
                        ))}
                        </div>
                    </div>
                ))}
            </div>}
        </Card>
    );
};

// --- 5. Inventory Report ---
const InventoryReport: React.FC = () => {
    const { products, isLoading } = useReportData();
    const inventoryData = useMemo(() => products.map(p => ({ ...p, availableStock: p.stock - p.reservedStock })).sort((a,b) => a.name.localeCompare(b.name)), [products]);

    const exportToPDF = () => {
        const doc = new jsPDF();
        const periodText = `Per Tanggal: ${new Date().toLocaleDateString('id-ID')}`;
        exportWithHeader(doc, "Laporan Stok Gudang", periodText, {
            head: [['SKU', 'Nama Produk', 'Stok Fisik', 'Dipesan', 'Tersedia']],
            body: inventoryData.map(p => [ p.sku, p.name, p.stock, p.reservedStock, p.availableStock ])
        });
        doc.save(`Laporan_Stok_${new Date().toISOString().split('T')[0]}.pdf`);
    };

    if(isLoading) return <p>Memuat data stok...</p>;

    return (
        <Card>
            <div className="flex justify-between items-center mb-4"><h2 className="text-xl font-semibold text-brand-dark">Laporan Stok Gudang</h2><button onClick={exportToPDF} className="bg-brand-primary text-white font-bold py-2 px-4 rounded-lg flex items-center gap-2 disabled:bg-gray-400" disabled={inventoryData.length === 0}><ICONS.fileText /> Ekspor ke PDF</button></div>
            <div className="overflow-x-auto max-h-[70vh]"><table className="min-w-full text-sm"><thead className="bg-gray-100 sticky top-0 z-10"><tr><th className="px-4 py-2 text-left">SKU</th><th className="px-4 py-2 text-left">Produk</th><th className="px-4 py-2 text-right">Stok Fisik</th><th className="px-4 py-2 text-right">Dipesan</th><th className="px-4 py-2 text-right font-bold">Tersedia</th></tr></thead><tbody>{inventoryData.map(p => (<tr key={p.id} className={`border-b ${p.availableStock < 10 ? 'bg-red-50 hover:bg-red-100' : 'hover:bg-gray-50'}`}><td className="px-4 py-2 font-mono">{p.sku}</td><td className="px-4 py-2">{p.name}</td><td className="px-4 py-2 text-right">{p.stock}</td><td className="px-4 py-2 text-right">{p.reservedStock}</td><td className="px-4 py-2 text-right font-bold text-brand-dark">{p.availableStock}</td></tr>))}</tbody></table></div>
        </Card>
    );
};

// --- 6. Sales Performance Report ---
const SalesPerformanceReport: React.FC = () => {
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const { users, orders, visits, surveys, isLoading } = useReportData();

    const salesPerformance = useMemo(() => {
        const filterByDate = (dateStr: string) => (!startDate || !endDate) || (dateStr >= startDate && dateStr <= endDate);
        return users.filter(u => u.role === Role.SALES).map(salesperson => {
            const salesOrders = orders.filter(o => o.orderedBy.id === salesperson.id && filterByDate(o.orderDate) && o.status === 'Delivered');
            const salesVisits = visits.filter(v => v.salesPersonId === salesperson.id && filterByDate(v.visitDate));
            const salesSurveys = surveys.filter(s => s.salesPersonId === salesperson.id && filterByDate(s.surveyDate));
            return { name: salesperson.name, ordersCreated: salesOrders.length, salesValue: salesOrders.reduce((sum, o) => sum + Number(o.totalAmount), 0), visitsCompleted: salesVisits.filter(v => v.status === VisitStatus.COMPLETED).length, surveysConducted: salesSurveys.length };
        }).sort((a,b) => b.salesValue - a.salesValue);
    }, [startDate, endDate, users, orders, visits, surveys]);

    const exportToPDF = () => {
        const doc = new jsPDF();
        const periodText = startDate && endDate ? `Periode: ${new Date(startDate).toLocaleDateString('id-ID')} - ${new Date(endDate).toLocaleDateString('id-ID')}` : 'Periode: Semua Waktu';
        exportWithHeader(doc, "Laporan Kinerja Sales", periodText, {
            head: [['Nama Sales', 'Pesanan Sukses', 'Nilai Penjualan (Rp)', 'Kunjungan Selesai', 'Survei Dilakukan']],
            body: salesPerformance.map(s => [s.name, s.ordersCreated, s.salesValue.toLocaleString('id-ID'), s.visitsCompleted, s.surveysConducted])
        });
        doc.save(`Laporan_Kinerja_Sales_${startDate || 'all'}_${endDate || 'all'}.pdf`);
    };

    if (isLoading) return <p>Memuat data...</p>;

    return (
        <div className="space-y-6">
            <DateFilter title="Filter Kinerja Sales" startDate={startDate} endDate={endDate} setStartDate={setStartDate} setEndDate={setEndDate} onExport={exportToPDF} isExportDisabled={salesPerformance.length === 0} />
            <Card><div className="overflow-x-auto"><table className="min-w-full text-sm"><thead className="bg-gray-100"><tr><th className="px-4 py-2 text-left">Nama</th><th className="px-4 py-2 text-right">Pesanan Sukses</th><th className="px-4 py-2 text-right">Nilai Penjualan</th><th className="px-4 py-2 text-right">Kunjungan</th><th className="px-4 py-2 text-right">Survei</th></tr></thead><tbody>{salesPerformance.map(s => <tr key={s.name} className="border-b"><td className="px-4 py-2">{s.name}</td><td className="px-4 py-2 text-right">{s.ordersCreated}</td><td className="px-4 py-2 text-right">Rp {s.salesValue.toLocaleString('id-ID')}</td><td className="px-4 py-2 text-right">{s.visitsCompleted}</td><td className="px-4 py-2 text-right">{s.surveysConducted}</td></tr>)}</tbody></table></div></Card>
        </div>
    );
};

// --- 7. Driver Performance Report ---
const DriverPerformanceReport: React.FC = () => {
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const { users, routes, isLoading } = useReportData();

    const driverPerformance = useMemo(() => {
        const filterByDate = (dateStr: string) => (!startDate || !endDate) || (dateStr >= startDate && dateStr <= endDate);
        return users.filter(u => u.role === Role.DRIVER).map(driver => {
            const driverRoutes = routes.filter(r => r.driverId === driver.id && filterByDate(r.date));
            const stops = driverRoutes.flatMap(r => r.stops);
            return { name: driver.name, trips: driverRoutes.length, totalStops: stops.length, completedStops: stops.filter(s => s.status === 'Completed').length, failedStops: stops.filter(s => s.status === 'Failed').length };
        }).sort((a,b) => b.completedStops - a.completedStops);
    }, [startDate, endDate, users, routes]);

    const exportToPDF = () => {
        const doc = new jsPDF();
        const periodText = startDate && endDate ? `Periode: ${new Date(startDate).toLocaleDateString('id-ID')} - ${new Date(endDate).toLocaleDateString('id-ID')}` : 'Periode: Semua Waktu';
        exportWithHeader(doc, "Laporan Kinerja Pengemudi", periodText, {
            head: [['Nama Pengemudi', 'Total Perjalanan', 'Total Pemberhentian', 'Selesai', 'Gagal']],
            body: driverPerformance.map(d => [d.name, d.trips, d.totalStops, d.completedStops, d.failedStops])
        });
        doc.save(`Laporan_Kinerja_Driver_${startDate || 'all'}_${endDate || 'all'}.pdf`);
    };

    if (isLoading) return <p>Memuat data...</p>;

    return (
        <div className="space-y-6">
            <DateFilter title="Filter Kinerja Pengemudi" startDate={startDate} endDate={endDate} setStartDate={setStartDate} setEndDate={setEndDate} onExport={exportToPDF} isExportDisabled={driverPerformance.length === 0} />
            <Card><div className="overflow-x-auto"><table className="min-w-full text-sm"><thead className="bg-gray-100"><tr><th className="px-4 py-2 text-left">Nama</th><th className="px-4 py-2 text-right">Perjalanan</th><th className="px-4 py-2 text-right">Stop</th><th className="px-4 py-2 text-right text-green-600">Selesai</th><th className="px-4 py-2 text-right text-red-600">Gagal</th></tr></thead><tbody>{driverPerformance.map(d => <tr key={d.name} className="border-b"><td className="px-4 py-2">{d.name}</td><td className="px-4 py-2 text-right">{d.trips}</td><td className="px-4 py-2 text-right">{d.totalStops}</td><td className="px-4 py-2 text-right text-green-600 font-semibold">{d.completedStops}</td><td className="px-4 py-2 text-right text-red-600 font-semibold">{d.failedStops}</td></tr>)}</tbody></table></div></Card>
        </div>
    );
};


type ReportType = 'salesSummary' | 'salesByProduct' | 'salesByRegion' | 'manifest' | 'inventory' | 'salesPerformance' | 'driverPerformance';

const reportTabs: { id: ReportType, label: string, icon: React.ReactNode }[] = [
    { id: 'salesSummary', label: 'Ringkasan Penjualan', icon: <ICONS.dashboard /> },
    { id: 'salesByProduct', label: 'Penjualan per Produk', icon: <ICONS.product /> },
    { id: 'salesByRegion', label: 'Penjualan per Wilayah', icon: <ICONS.mapPin /> },
    { id: 'manifest', label: 'Manifest Pengiriman', icon: <ICONS.fleet /> },
    { id: 'inventory', label: 'Stok Gudang', icon: <ICONS.store /> },
    { id: 'salesPerformance', label: 'Kinerja Sales', icon: <ICONS.users /> },
    { id: 'driverPerformance', label: 'Kinerja Driver', icon: <ICONS.navigation /> },
];


export const ReportsView: React.FC = () => {
    const [activeReport, setActiveReport] = useState<ReportType>('salesSummary');

    const renderReport = () => {
        switch (activeReport) {
            case 'salesSummary': return <SalesSummaryReport />;
            case 'salesByProduct': return <ProductSalesReport />;
            case 'salesByRegion': return <RegionSalesReport />;
            case 'manifest': return <DeliveryManifestReport />;
            case 'inventory': return <InventoryReport />;
            case 'salesPerformance': return <SalesPerformanceReport />;
            case 'driverPerformance': return <DriverPerformanceReport />;
            default: return <SalesSummaryReport />;
        }
    }

    return (
        <div className="p-8 space-y-6">
            <h1 className="text-3xl font-bold text-brand-dark">Laporan & Analisis</h1>
            
            <div className="border-b border-gray-200">
                <nav className="-mb-px flex space-x-6 overflow-x-auto" aria-label="Tabs">
                    {reportTabs.map((tab) => (
                        <button key={tab.id} onClick={() => setActiveReport(tab.id)}
                            className={`whitespace-nowrap flex items-center gap-2 py-4 px-3 border-b-2 font-medium text-sm transition-colors duration-200 ${
                                activeReport === tab.id ? 'border-brand-primary text-brand-primary' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                            }`}
                        >
                            <span className="w-5 h-5">{tab.icon}</span>
                            {tab.label}
                        </button>
                    ))}
                </nav>
            </div>
            
            <div className="mt-6">
                {renderReport()}
            </div>
        </div>
    );
};