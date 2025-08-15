import React, { useState } from 'react';
import { ICONS } from '../../constants';
import { Dashboard } from './Dashboard';
import { RoutePlanning } from './RoutePlanning';
import { UserManagement } from './UserManagement';
import { StoreManagement } from './StoreManagement';
import { ProductManagement } from './ProductManagement';
import { OrderManagement } from './OrderManagement';
import { FleetManagement } from './Fleetmanagement';
import { VehicleManagement } from './VehicleManagement';
import { SurveyReports } from './SurveyReports';
import { VisitSchedule } from './VisitSchedule';
import { ReportsView } from './ReportsView';
import { useAppContext } from '../../hooks/useAppContext';
import { TripHistory } from './TripHistory';

type AdminPage = 'dashboard' | 'users' | 'stores' | 'products' | 'fleet' | 'vehicles' | 'orders' | 'routePlanning' | 'schedule' | 'surveys' | 'reports' | 'tripHistory';

// Menu items are ordered based on the admin's typical workflow.
const navItems: { id: AdminPage; label: string; icon: React.ReactNode }[] = [
    // --- Group 1: Overview & Analysis ---
    // High-level views to start the day.
    { id: 'dashboard', label: 'Dashboard', icon: <ICONS.dashboard /> },
    { id: 'reports', label: 'Laporan', icon: <ICONS.fileText /> },
    
    // --- Group 2: Daily Operations ---
    // Core, high-frequency operational tasks.
    { id: 'routePlanning', label: 'Perencanaan Rute', icon: <ICONS.route /> },
    { id: 'fleet', label: 'Pantau Muatan', icon: <ICONS.orders /> }, // Monitor vehicle loads and status
    { id: 'tripHistory', label: 'Riwayat Perjalanan', icon: <ICONS.history /> },
    
    // --- Group 3: Sales & Data Entry ---
    // Managing incoming data and sales activities.
    { id: 'orders', label: 'Manajemen Pesanan', icon: <ICONS.orders /> },
    { id: 'schedule', label: 'Jadwal Kunjungan', icon: <ICONS.calendar /> },
    { id: 'surveys', label: 'Laporan Survei', icon: <ICONS.survey /> },
    
    // --- Group 4: Master Data Management ---
    // Less frequent configuration and data management.
    { id: 'stores', label: 'Manajemen Toko', icon: <ICONS.store /> },
    { id: 'products', label: 'Manajemen Produk', icon: <ICONS.product /> },
    { id: 'vehicles', label: 'Manajemen Armada', icon: <ICONS.fleet /> },
    { id: 'users', label: 'Manajemen Pengguna', icon: <ICONS.users /> },
];


export const AdminView: React.FC = () => {
    const { logout, currentUser } = useAppContext();
    const [activePage, setActivePage] = useState<AdminPage>('dashboard');
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);

    const renderContent = () => {
        switch (activePage) {
            case 'dashboard':
                return <Dashboard />;
            case 'reports':
                return <ReportsView />;
            case 'routePlanning':
                return <RoutePlanning />;
            case 'tripHistory':
                return <TripHistory />;
            case 'users':
                return <UserManagement />;
            case 'stores':
                 return <StoreManagement />;
            case 'products':
                return <ProductManagement />;
            case 'orders':
                return <OrderManagement />;
            case 'vehicles':
                return <VehicleManagement />;
            case 'fleet':
                return <FleetManagement />;
            case 'schedule':
                return <VisitSchedule />;
            case 'surveys':
                return <SurveyReports />;
            default:
                return <Dashboard />;
        }
    };

    const sidebarContent = (
        <>
            <div className="p-6 text-2xl font-bold border-b border-blue-900">
                KU AIRKU
            </div>
            <nav className="flex-1 mt-6 space-y-2">
                {navItems.map(item => (
                    <button
                        key={item.id}
                        onClick={() => {
                            setActivePage(item.id);
                            setIsSidebarOpen(false); // Close on mobile navigation
                        }}
                        className={`w-full flex items-center space-x-3 px-6 py-3 text-left transition duration-200 ${
                            activePage === item.id 
                            ? 'bg-brand-primary' 
                            : 'hover:bg-brand-primary hover:bg-opacity-50'
                        }`}
                    >
                        {item.icon}
                        <span>{item.label}</span>
                    </button>
                ))}
            </nav>
            <div className="p-4 border-t border-blue-900">
                <div className="px-4 py-2 mb-2">
                  <p className="text-sm font-semibold">{currentUser?.name}</p>
                  <p className="text-xs text-blue-300">{currentUser?.role}</p>
                </div>
                 <button onClick={logout} className="w-full flex items-center space-x-3 px-4 py-3 text-left transition duration-200 hover:bg-brand-primary hover:bg-opacity-50 rounded-md">
                    <ICONS.logout />
                    <span>Keluar</span>
                </button>
            </div>
        </>
    );

    return (
        <div className="flex h-screen bg-brand-background">
             {/* Desktop Sidebar */}
            <aside className="hidden md:flex w-64 bg-brand-dark text-white flex-col flex-shrink-0 overflow-y-auto">
                {sidebarContent}
            </aside>

            {/* Mobile Sidebar (Overlay) */}
            {isSidebarOpen && (
                <div className="md:hidden fixed inset-0 z-30 bg-black bg-opacity-50" onClick={() => setIsSidebarOpen(false)}></div>
            )}
            <aside className={`md:hidden fixed top-0 left-0 h-full w-64 bg-brand-dark text-white flex flex-col z-40 transform transition-transform duration-300 ease-in-out overflow-y-auto ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
                {sidebarContent}
            </aside>

            {/* Main Content Area */}
            <main className="flex-1 flex flex-col overflow-y-auto overflow-hidden">
                {/* Mobile Header */}
                <header className="md:hidden flex justify-between items-center p-4 bg-white shadow-md sticky top-0 z-20">
                    <button onClick={() => setIsSidebarOpen(!isSidebarOpen)} className="text-gray-600 p-2">
                        <ICONS.menu />
                    </button>
                    <span className="text-lg font-bold text-brand-dark">
                        {navItems.find(item => item.id === activePage)?.label}
                    </span>
                    <div className="w-8"></div> {/* Spacer */}
                </header>

                <div className="flex-1">
                    {renderContent()}
                </div>
            </main>
        </div>
    );
};