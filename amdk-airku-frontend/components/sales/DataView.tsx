import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card } from '../ui/Card';
import { Store, Product } from '../../types';
import { getStores } from '../../services/storeApiService';
import { getProducts } from '../../services/productApiService';
import { ICONS } from '../../constants';

type ActiveTab = 'stores' | 'products';

const StoreList: React.FC = () => {
    const [searchTerm, setSearchTerm] = useState('');
    const [filterRegion, setFilterRegion] = useState('all');
    const [filterPartnerStatus, setFilterPartnerStatus] = useState('all');
    
    const { data: stores = [], isLoading } = useQuery<Store[]>({ queryKey: ['stores'], queryFn: getStores });

    const filteredStores = useMemo(() => {
        return stores.filter(store => {
            const term = searchTerm.toLowerCase();
            const searchMatch = term === '' || store.name.toLowerCase().includes(term) || store.owner.toLowerCase().includes(term) || store.address.toLowerCase().includes(term);
            const regionMatch = filterRegion === 'all' || store.region === filterRegion;
            const partnerMatch = filterPartnerStatus === 'all' || (filterPartnerStatus === 'yes' && store.isPartner) || (filterPartnerStatus === 'no' && !store.isPartner);
            return searchMatch && regionMatch && partnerMatch;
        });
    }, [stores, searchTerm, filterRegion, filterPartnerStatus]);
    
    if (isLoading) return <p>Memuat data toko...</p>;

    return (
        <div className="space-y-4">
            <Card className="p-4">
                <div className="space-y-4">
                    <input 
                        type="text" 
                        placeholder="Cari nama, pemilik, alamat..." 
                        value={searchTerm} 
                        onChange={e => setSearchTerm(e.target.value)} 
                        className="w-full p-2 border rounded-md"
                    />
                    <div className="grid grid-cols-2 gap-4">
                        <select value={filterRegion} onChange={e => setFilterRegion(e.target.value)} className="w-full p-2 border rounded-md bg-white text-sm">
                            <option value="all">Semua Wilayah</option>
                            <option value="Timur">Timur</option>
                            <option value="Barat">Barat</option>
                        </select>
                        <select value={filterPartnerStatus} onChange={e => setFilterPartnerStatus(e.target.value)} className="w-full p-2 border rounded-md bg-white text-sm">
                            <option value="all">Semua Status Mitra</option>
                            <option value="yes">Mitra</option>
                            <option value="no">Bukan Mitra</option>
                        </select>
                    </div>
                </div>
            </Card>
            <div className="space-y-3">
                {filteredStores.length > 0 ? filteredStores.map(store => (
                    <Card key={store.id} className="p-3">
                        <p className="font-bold">{store.name}</p>
                        <p className="text-sm text-gray-600">{store.address}</p>
                        <p className="text-xs text-gray-500 mt-1">Pemilik: {store.owner} | Telp: {store.phone}</p>
                        {store.isPartner && <span className="mt-2 inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-yellow-100 text-yellow-800"><ICONS.handshake width={14} height={14} /> Mitra ({store.partnerCode})</span>}
                    </Card>
                )) : <p className="text-center text-gray-500 py-8">Tidak ada toko yang cocok dengan filter.</p>}
            </div>
        </div>
    );
};

const ProductList: React.FC = () => {
    const { data: products = [], isLoading } = useQuery<Product[]>({ queryKey: ['products'], queryFn: getProducts });
    if (isLoading) return <p>Memuat data produk...</p>;
    return (
        <div className="space-y-3">
            {products.map(product => (
                <Card key={product.id} className="p-3 flex justify-between items-center">
                    <div>
                        <p className="font-bold">{product.name}</p>
                        <p className="text-sm text-gray-600">Rp {product.price.toLocaleString('id-ID')}</p>
                    </div>
                    <p className="text-sm font-semibold">Stok: {product.stock - product.reservedStock}</p>
                </Card>
            ))}
        </div>
    );
};

export const DataView: React.FC = () => {
    const [activeTab, setActiveTab] = useState<ActiveTab>('stores');

    return (
        <div>
            <div className="flex border-b mb-4">
                <button 
                    onClick={() => setActiveTab('stores')}
                    className={`flex-1 py-2 text-center font-semibold ${activeTab === 'stores' ? 'border-b-2 border-brand-primary text-brand-primary' : 'text-gray-500'}`}
                >
                    Data Toko
                </button>
                <button 
                    onClick={() => setActiveTab('products')}
                    className={`flex-1 py-2 text-center font-semibold ${activeTab === 'products' ? 'border-b-2 border-brand-primary text-brand-primary' : 'text-gray-500'}`}
                >
                    Data Produk
                </button>
            </div>
            {activeTab === 'stores' ? <StoreList /> : <ProductList />}
        </div>
    );
};