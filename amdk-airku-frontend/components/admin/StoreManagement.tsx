import React, { useState, useMemo, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card } from '../ui/Card';
import { ICONS } from '../../constants';
import { Store, Coordinate } from '../../types';
import { Modal } from '../ui/Modal';
import { getStores, createStore, updateStore, deleteStore } from '../../services/storeApiService';
import { checkRegion } from '../../services/regionApiService'; 

export const StoreManagement: React.FC = () => {
    const queryClient = useQueryClient();
    const [isModalOpen, setIsModalOpen] = useState(false);
    const initialFormState: Omit<Store, 'id'> & { lat: string; lng: string } = { 
        name: '', address: '', location: { lat: 0, lng: 0 }, region: '', 
        owner: '', phone: '', subscribedSince: '', lastOrder: 'N/A', 
        isPartner: false, partnerCode: '', lat: '', lng: '' 
    };
    const [currentStore, setCurrentStore] = useState<Omit<Store, 'id'> | (Store & { lat: string; lng: string })>(initialFormState);
    const [isEditing, setIsEditing] = useState(false);
    const [apiError, setApiError] = useState('');
    
    const [detectedRegion, setDetectedRegion] = useState('');
    const [isRegionChecked, setIsRegionChecked] = useState(false);

    const [searchTerm, setSearchTerm] = useState('');
    const [filterRegion, setFilterRegion] = useState('all');
    const [filterPartnerStatus, setFilterPartnerStatus] = useState('all');

    const { data: stores = [], isLoading } = useQuery<Store[]>({
        queryKey: ['stores'],
        queryFn: getStores,
    });
    
    const createMutation = useMutation({
        mutationFn: createStore,
        onSuccess: () => { 
            queryClient.invalidateQueries({ queryKey: ['stores'] }); 
            setIsModalOpen(false);
            alert('Toko baru berhasil ditambahkan!');
        },
        onError: (err: any) => setApiError(err.response?.data?.message || 'Gagal membuat toko.'),
    });

    const updateMutation = useMutation({
        mutationFn: updateStore,
        onSuccess: () => { 
            queryClient.invalidateQueries({ queryKey: ['stores'] }); 
            setIsModalOpen(false); 
            alert('Data toko berhasil diperbarui!');
        },
        onError: (err: any) => setApiError(err.response?.data?.message || 'Gagal memperbarui toko.'),
    });

    const deleteMutation = useMutation({
        mutationFn: deleteStore,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['stores'] });
            alert('Toko berhasil dihapus.');
        },
        onError: (err: any) => alert(err.response?.data?.message || 'Gagal menghapus toko.'),
    });
    
    const regionCheckMutation = useMutation({
        mutationFn: (coords: { lat: number; lng: number }) => checkRegion(coords.lat, coords.lng),
        onSuccess: (data) => {
            if (data.success) {
                setApiError('');
                setDetectedRegion(data.region);
                setIsRegionChecked(true);
            } else {
                setApiError(data.message || 'Gagal mengecek wilayah.');
                setDetectedRegion('');
                setIsRegionChecked(false);
            }
        },
        onError: (err: any) => {
            setApiError(err.response?.data?.message || 'Terjadi kesalahan pada server.');
            setDetectedRegion('');
            setIsRegionChecked(false);
        },
    });

    const filteredStores = useMemo(() => {
        const filtered = stores.filter(store => {
            const term = searchTerm.toLowerCase();
            const searchMatch = term === '' || store.name.toLowerCase().includes(term) || store.owner.toLowerCase().includes(term) || store.address.toLowerCase().includes(term);
            const regionMatch = filterRegion === 'all' || store.region === filterRegion;
            const partnerMatch = filterPartnerStatus === 'all' || (filterPartnerStatus === 'yes' && store.isPartner) || (filterPartnerStatus === 'no' && !store.isPartner);
            return searchMatch && regionMatch && partnerMatch;
        });
        return filtered.sort((a, b) => new Date(b.subscribedSince).getTime() - new Date(a.subscribedSince).getTime());
    }, [stores, searchTerm, filterRegion, filterPartnerStatus]);
    
    const resetForm = () => {
        setIsEditing(false);
        setCurrentStore(initialFormState);
        setApiError('');
        setDetectedRegion('');
        setIsRegionChecked(false);
    }

    const openModalForAdd = () => {
        resetForm();
        setIsModalOpen(true);
    };

    const openModalForEdit = (store: Store) => {
        resetForm();
        setIsEditing(true);
        setCurrentStore({
            ...store,
            lat: store.location.lat.toString(),
            lng: store.location.lng.toString(),
        });
        setDetectedRegion(store.region);
        setIsRegionChecked(true); // Anggap sudah terverifikasi saat edit
        setIsModalOpen(true);
    };

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
        const target = e.target;
        const name = target.name;
        const value = target.type === 'checkbox' ? (target as HTMLInputElement).checked : target.value;
        
        setCurrentStore(prev => ({
            ...prev,
            [name]: value
        }));

        if (name === 'lat' || name === 'lng') {
            setIsRegionChecked(false);
            setDetectedRegion('');
        }
    };
    
    const handleRegionCheck = () => {
        const lat = parseFloat((currentStore as any).lat);
        const lng = parseFloat((currentStore as any).lng);

        if (isNaN(lat) || isNaN(lng)) {
            setApiError('Latitude dan Longitude harus berupa angka yang valid.');
            return;
        }
        regionCheckMutation.mutate({ lat, lng } as Coordinate);
    };
    
    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        setApiError('');

        if (!isRegionChecked) {
            setApiError('Harap cek wilayah terlebih dahulu menggunakan tombol "Cek Wilayah".');
            return;
        }
        
        if (detectedRegion === 'Bukan di Kulon Progo') {
            setApiError('Lokasi toko berada di luar wilayah layanan Kulon Progo.');
            return;
        }

        if (currentStore.isPartner && !currentStore.partnerCode) {
            setApiError('Kode Mitra wajib diisi jika toko adalah mitra.');
            return;
        }

        const { lat, lng, ...restOfStore } = currentStore as any;

        const storeData: any = { 
            ...restOfStore,
            lat: parseFloat(lat),
            lng: parseFloat(lng),
            region: detectedRegion
        };
        delete storeData.location;

        if (!storeData.isPartner) storeData.partnerCode = '';

        if(isEditing) {
            updateMutation.mutate(storeData as Store);
        } else {
            createMutation.mutate(storeData as Omit<Store, 'id'>);
        }
    };

    const handleDelete = (storeId: string) => {
        if(window.confirm('Apakah Anda yakin ingin menghapus toko ini?')) {
            deleteMutation.mutate(storeId);
        }
    };
    
    const canSubmit = currentStore.name && currentStore.owner && currentStore.phone && isRegionChecked && detectedRegion !== 'Bukan di Kulon Progo' && !regionCheckMutation.isPending && (!currentStore.isPartner || (currentStore.isPartner && currentStore.partnerCode));

    return (
        <div className="p-8 space-y-6">
            <div className="flex justify-between items-center">
                <h1 className="text-3xl font-bold text-brand-dark">Manajemen Toko</h1>
                <button
                    onClick={openModalForAdd}
                    className="flex items-center gap-2 bg-brand-primary text-white font-bold py-2 px-4 rounded-lg shadow-md hover:bg-brand-dark transition duration-300"
                >
                    <ICONS.plus />
                    Tambah Toko
                </button>
            </div>
            
            <Card className="bg-blue-50 border border-blue-200">
                <div className="flex items-start gap-4">
                    <div className="flex-shrink-0 text-brand-primary pt-1">
                        <ICONS.mapPin />
                    </div>
                    <div>
                        <h3 className="text-md font-bold text-brand-dark">Informasi Pembagian Wilayah</h3>
                        <p className="text-sm text-gray-700 mt-1">
                            Titik penentu wilayah <strong>Timur</strong> dan <strong>Barat</strong> adalah garis bujur (longitude) kantor PDAM Tirta Binangun di <strong>110.1486773</strong>.
                            Deteksi wilayah otomatis akan mengklasifikasikan lokasi toko berdasarkan titik ini.
                        </p>
                    </div>
                </div>
            </Card>

            <Card>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div><label className="block text-sm font-medium text-gray-700">Pencarian</label><input type="text" placeholder="Cari nama, pemilik, alamat..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="w-full p-2 border rounded-md mt-1"/></div>
                    <div><label className="block text-sm font-medium text-gray-700">Wilayah</label><select value={filterRegion} onChange={e => setFilterRegion(e.target.value)} className="w-full p-2 border rounded-md bg-white mt-1"><option value="all">Semua Wilayah</option><option value="Timur">Timur</option><option value="Barat">Barat</option></select></div>
                    <div><label className="block text-sm font-medium text-gray-700">Status Mitra</label><select value={filterPartnerStatus} onChange={e => setFilterPartnerStatus(e.target.value)} className="w-full p-2 border rounded-md bg-white mt-1"><option value="all">Semua Status</option><option value="yes">Mitra</option><option value="no">Bukan Mitra</option></select></div>
                </div>
            </Card>

            <Card className="!p-0">
                <div className="overflow-x-auto">
                    <table className="min-w-full text-sm text-left text-gray-700">
                        <thead className="bg-gray-50 text-xs text-gray-700 uppercase">
                            <tr><th scope="col" className="px-6 py-3">Nama Toko</th><th scope="col" className="px-6 py-3">Pemilik</th><th scope="col" className="px-6 py-3">Wilayah</th><th scope="col" className="px-6 py-3">Status Mitra</th><th scope="col" className="px-6 py-3">Telepon</th><th scope="col" className="px-6 py-3">Aksi</th></tr>
                        </thead>
                        <tbody>
                            {isLoading ? (<tr><td colSpan={6} className="text-center p-4">Memuat data toko...</td></tr>) : filteredStores.map((store: Store) => (
                                <tr key={store.id} className="bg-white border-b hover:bg-gray-50">
                                    <td className="px-6 py-4 font-medium text-gray-900">{store.name}</td>
                                    <td className="px-6 py-4">{store.owner}</td>
                                    <td className="px-6 py-4">{store.region}</td>
                                    <td className="px-6 py-4">{store.isPartner ? (<span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-yellow-100 text-yellow-800 font-mono">{store.partnerCode}</span>) : (<span className="text-gray-400">-</span>)}</td>
                                    <td className="px-6 py-4">{store.phone}</td>
                                    <td className="px-6 py-4 flex space-x-2">
                                        <button onClick={() => openModalForEdit(store)} className="text-blue-600 hover:text-blue-800 p-1"><ICONS.edit width={20} height={20} /></button>
                                        <button onClick={() => handleDelete(store.id)} disabled={deleteMutation.isPending} className="text-red-600 hover:text-red-800 p-1 disabled:text-gray-400"><ICONS.trash width={20} height={20} /></button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                    {!isLoading && filteredStores.length === 0 && (<p className="text-center text-gray-500 py-6">Tidak ada toko ditemukan.</p>)}
                </div>
            </Card>

             <Modal title={isEditing ? "Edit Toko" : "Tambah Toko Baru"} isOpen={isModalOpen} onClose={() => setIsModalOpen(false)}>
                <form onSubmit={handleSubmit} className="space-y-4">
                    {apiError && <p className="text-sm text-red-600 bg-red-100 p-2 rounded">{apiError}</p>}
                    <input type="text" name="name" placeholder="Nama Toko" value={currentStore.name} onChange={handleInputChange} className="w-full p-2 border rounded" required />
                    <input type="text" name="owner" placeholder="Nama Pemilik" value={currentStore.owner} onChange={handleInputChange} className="w-full p-2 border rounded" required />
                    <input type="text" name="phone" placeholder="Nomor Telepon" value={currentStore.phone} onChange={handleInputChange} className="w-full p-2 border rounded" required />
                    <textarea name="address" placeholder="Alamat Lengkap Toko" value={currentStore.address} onChange={handleInputChange} className="w-full p-2 border rounded" rows={3} required />
                    
                    <div className="space-y-2 p-3 bg-gray-50 rounded-lg border">
                        <label className="block text-sm font-medium text-gray-700">Koordinat Lokasi</label>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <input 
                                type="text" 
                                name="lat" 
                                placeholder="Latitude" 
                                value={(currentStore as any).lat} 
                                onChange={handleInputChange} 
                                className="w-full p-2 border rounded" 
                                required 
                            />
                            <input 
                                type="text" 
                                name="lng" 
                                placeholder="Longitude" 
                                value={(currentStore as any).lng} 
                                onChange={handleInputChange} 
                                className="w-full p-2 border rounded" 
                                required 
                            />
                        </div>
                        <button
                            type="button"
                            onClick={handleRegionCheck}
                            disabled={!(currentStore as any).lat || !(currentStore as any).lng || regionCheckMutation.isPending}
                            className="w-full flex items-center justify-center gap-2 bg-brand-secondary text-white font-bold py-2 px-4 rounded-lg shadow-md hover:bg-brand-dark transition duration-300 disabled:bg-gray-400"
                        >
                            {regionCheckMutation.isPending ? 'Mengecek Wilayah...' : 'Cek Wilayah dari Koordinat'}
                        </button>
                    </div>
                    
                    {isRegionChecked && detectedRegion && (
                        <div className="space-y-3 p-3 bg-green-50 rounded-lg border border-green-200">
                            <h3 className="text-sm font-bold text-green-800">Hasil Pengecekan Wilayah</h3>
                            <p className={`font-bold p-1 rounded border ${detectedRegion === 'Bukan di Kulon Progo' ? 'bg-red-100 text-red-700' : 'bg-white'}`}>{detectedRegion}</p>
                        </div>
                    )}
                    
                    <div className="pt-4 border-t">
                        <div className="flex items-center space-x-3"><input type="checkbox" id="isPartner" name="isPartner" checked={currentStore.isPartner} onChange={handleInputChange} className="h-4 w-4 text-brand-primary" /><label htmlFor="isPartner" className="text-sm font-medium text-gray-800">Jadikan sebagai Mitra</label></div>
                        {currentStore.isPartner && (<div className="mt-4"><label htmlFor="partnerCode" className="block text-sm font-medium text-gray-700">Kode Mitra</label><input type="text" name="partnerCode" id="partnerCode" value={currentStore.partnerCode || ''} onChange={handleInputChange} className="mt-1 block w-full p-2 border rounded" required={currentStore.isPartner} /></div>)}
                    </div>
                    
                    <div className="flex justify-end pt-4">
                        <button type="button" onClick={() => setIsModalOpen(false)} className="bg-gray-200 text-gray-700 font-bold py-2 px-4 rounded-lg mr-2 hover:bg-gray-300">Batal</button>
                        <button type="submit" disabled={!canSubmit || createMutation.isPending || updateMutation.isPending} className="bg-brand-primary text-white font-bold py-2 px-4 rounded-lg hover:bg-brand-dark disabled:bg-gray-400">
                            {createMutation.isPending || updateMutation.isPending ? 'Menyimpan...' : (isEditing ? "Simpan Perubahan" : "Tambah Toko")}
                        </button>
                    </div>
                </form>
            </Modal>
        </div>
    );
};
