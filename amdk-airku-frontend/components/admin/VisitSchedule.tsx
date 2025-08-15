import React, { useState, useMemo, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card } from '../ui/Card';
import { ICONS } from '../../constants';
import { Visit, User, Store, VisitStatus, Role } from '../../types';
import { getVisits, createVisit, updateVisit, deleteVisit } from '../../services/visitApiService';
import { getUsers } from '../../services/userApiService';
import { getStores } from '../../services/storeApiService';
import { Modal } from '../ui/Modal';

const getStatusClass = (status: VisitStatus) => {
    switch (status) {
        case VisitStatus.UPCOMING: return 'bg-blue-100 text-blue-800';
        case VisitStatus.COMPLETED: return 'bg-green-100 text-green-800';
        case VisitStatus.SKIPPED: return 'bg-red-100 text-red-800';
        default: return 'bg-gray-100 text-gray-800';
    }
};

const VisitFormModal: React.FC<{
    isOpen: boolean;
    onClose: () => void;
    salesUsers: User[];
    stores: Store[];
    visitToEdit: Visit | null;
}> = ({ isOpen, onClose, salesUsers, stores, visitToEdit }) => {
    const queryClient = useQueryClient();
    const isEditing = !!visitToEdit;
    const initialFormState = {
        salesPersonId: '',
        storeId: '',
        visitDate: new Date().toISOString().split('T')[0],
        purpose: '',
        status: VisitStatus.UPCOMING,
    };
    const [formData, setFormData] = useState(initialFormState);
    const [apiError, setApiError] = useState('');

    const createVisitMutation = useMutation({
        mutationFn: createVisit,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['visits'] });
            onClose();
            alert('Jadwal kunjungan berhasil ditambahkan!');
        },
        onError: (err: any) => {
            setApiError(err.response?.data?.message || 'Gagal menyimpan jadwal.');
        }
    });

    const updateVisitMutation = useMutation({
        mutationFn: updateVisit,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['visits'] });
            onClose();
            alert('Jadwal kunjungan berhasil diperbarui!');
        },
        onError: (err: any) => {
            setApiError(err.response?.data?.message || 'Gagal menyimpan jadwal.');
        }
    });
    
    useEffect(() => {
        if (isOpen) {
            if (visitToEdit) {
                setFormData({
                    salesPersonId: visitToEdit.salesPersonId,
                    storeId: visitToEdit.storeId,
                    visitDate: visitToEdit.visitDate,
                    purpose: visitToEdit.purpose,
                    status: visitToEdit.status,
                });
            } else {
                setFormData(initialFormState);
            }
            setApiError('');
        }
    }, [isOpen, visitToEdit]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
        setFormData(prev => ({...prev, [e.target.name]: e.target.value}));
    }

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        setApiError('');
        if (!formData.salesPersonId || !formData.storeId || !formData.visitDate || !formData.purpose) {
            setApiError('Semua kolom wajib diisi.');
            return;
        }

        if (isEditing) {
            updateVisitMutation.mutate({ id: visitToEdit!.id, ...formData });
        } else {
            createVisitMutation.mutate(formData);
        }
    }
    
    return (
        <Modal title={isEditing ? 'Edit Jadwal Kunjungan' : 'Tambah Jadwal Kunjungan'} isOpen={isOpen} onClose={onClose}>
            <form onSubmit={handleSubmit} className="space-y-4">
                 {apiError && <p className="text-sm text-red-600 bg-red-100 p-2 rounded">{apiError}</p>}
                
                 <div><label className="block text-sm font-medium">Sales</label><select name="salesPersonId" value={formData.salesPersonId} onChange={handleChange} className="w-full p-2 border rounded mt-1" required><option value="" disabled>-- Pilih Sales --</option>{salesUsers.map((u: User) => <option key={u.id} value={u.id}>{u.name}</option>)}</select></div>
                 <div><label className="block text-sm font-medium">Toko</label><select name="storeId" value={formData.storeId} onChange={handleChange} className="w-full p-2 border rounded mt-1" required><option value="" disabled>-- Pilih Toko --</option>{stores.map(s => <option key={s.id} value={s.id}>{s.name} - {s.region}</option>)}</select></div>
                 <div><label className="block text-sm font-medium">Tanggal Kunjungan</label><input type="date" name="visitDate" value={formData.visitDate} onChange={handleChange} className="w-full p-2 border rounded mt-1" required /></div>
                 <div><label className="block text-sm font-medium">Tujuan Kunjungan</label><input type="text" name="purpose" value={formData.purpose} onChange={handleChange} placeholder="Contoh: Penagihan, Cek Stok" className="w-full p-2 border rounded mt-1" required /></div>
                 {isEditing && <div><label className="block text-sm font-medium">Status</label><select name="status" value={formData.status} onChange={handleChange} className="w-full p-2 border rounded mt-1 bg-white" required>{(Object.values(VisitStatus) as VisitStatus[]).map(s => <option key={s} value={s}>{s}</option>)}</select></div>}
                
                <div className="flex justify-end pt-4 gap-2">
                    <button type="button" onClick={onClose} className="bg-gray-200 font-bold py-2 px-4 rounded-lg">Batal</button>
                    <button type="submit" disabled={createVisitMutation.isPending || updateVisitMutation.isPending} className="bg-brand-primary text-white font-bold py-2 px-4 rounded-lg disabled:bg-gray-400">
                        {createVisitMutation.isPending || updateVisitMutation.isPending ? 'Menyimpan...' : 'Simpan Jadwal'}
                    </button>
                </div>
            </form>
        </Modal>
    );
};

export const VisitSchedule: React.FC = () => {
    const queryClient = useQueryClient();
    const [filterDate, setFilterDate] = useState(new Date().toISOString().split('T')[0]);
    const [filterSales, setFilterSales] = useState('all');
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [visitToEdit, setVisitToEdit] = useState<Visit | null>(null);

    const { data: visits = [], isLoading: isLoadingVisits } = useQuery<Visit[]>({ queryKey: ['visits'], queryFn: getVisits });
    const { data: users = [], isLoading: isLoadingUsers } = useQuery<User[]>({ queryKey: ['users'], queryFn: getUsers });
    const { data: stores = [], isLoading: isLoadingStores } = useQuery<Store[]>({ queryKey: ['stores'], queryFn: getStores });

    const deleteVisitMutation = useMutation({
        mutationFn: deleteVisit,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['visits'] });
            alert('Jadwal kunjungan berhasil dihapus.');
        },
        onError: (err: any) => {
            alert(err.response?.data?.message || 'Gagal menghapus jadwal.');
        }
    });

    const salesUsers = useMemo(() => users.filter(u => u.role === Role.SALES), [users]);
    
    const filteredAndGroupedVisits = useMemo(() => {
        type MappedVisit = Visit & { salesName: string; storeName: string; };

        const filtered: MappedVisit[] = visits
            .filter(v => (!filterDate || v.visitDate === filterDate) && (filterSales === 'all' || v.salesPersonId === filterSales))
            .map(v => ({
                ...v,
                salesName: users.find(u => u.id === v.salesPersonId)?.name || 'N/A',
                storeName: stores.find(s => s.id === v.storeId)?.name || 'N/A',
            }))
            .sort((a,b) => a.salesName.localeCompare(b.salesName));

        return filtered.reduce<Record<string, MappedVisit[]>>((acc, visit) => {
            (acc[visit.salesName] = acc[visit.salesName] || []).push(visit);
            return acc;
        }, {});

    }, [visits, users, stores, filterDate, filterSales]);
    
    const handleOpenAddModal = () => {
        setVisitToEdit(null);
        setIsModalOpen(true);
    };
    
    const handleOpenEditModal = (visit: Visit) => {
        setVisitToEdit(visit);
        setIsModalOpen(true);
    };

    const handleDeleteVisit = (visitId: string) => {
        if (window.confirm('Anda yakin ingin menghapus jadwal kunjungan ini?')) {
            deleteVisitMutation.mutate(visitId);
        }
    };

    const isLoading = isLoadingVisits || isLoadingUsers || isLoadingStores;

    return (
        <div className="p-8 space-y-6">
             <div className="flex justify-between items-center">
                <h1 className="text-3xl font-bold text-brand-dark">Jadwal Kunjungan Sales</h1>
                <button
                    onClick={handleOpenAddModal}
                    className="flex items-center gap-2 bg-brand-primary text-white font-bold py-2 px-4 rounded-lg"
                >
                    <ICONS.plus /> Tambah Jadwal
                </button>
            </div>
            
            <Card>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <label className="text-sm font-medium">Tanggal</label>
                        <input type="date" value={filterDate} onChange={e => setFilterDate(e.target.value)} className="w-full p-2 border rounded-md mt-1"/>
                    </div>
                    <div>
                        <label className="text-sm font-medium">Sales</label>
                        <select value={filterSales} onChange={e => setFilterSales(e.target.value)} className="w-full p-2 border rounded-md bg-white mt-1">
                            <option value="all">Semua Sales</option>
                            {salesUsers.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                        </select>
                    </div>
                </div>
            </Card>

            {isLoading ? <p>Memuat jadwal...</p> : 
                Object.keys(filteredAndGroupedVisits).length === 0 ? (
                    <Card><p className="text-center py-10 text-gray-500">Tidak ada jadwal kunjungan untuk filter yang dipilih.</p></Card>
                ) : (
                    <div className="space-y-6">
                        {Object.entries(filteredAndGroupedVisits).map(([salesName, visitList]) => (
                            <div key={salesName}>
                                <h2 className="text-xl font-semibold text-brand-primary pb-2 mb-2 border-b">{salesName}</h2>
                                <div className="space-y-3">
                                    {visitList.map(visit => (
                                        <Card key={visit.id} className="p-4">
                                            <div className="flex justify-between items-start">
                                                <div>
                                                    <p className="font-bold">{visit.storeName}</p>
                                                    <p className="text-sm text-gray-500">{visit.purpose}</p>
                                                </div>
                                                <div className="flex items-center gap-3">
                                                    <span className={`px-3 py-1 text-xs font-semibold rounded-full ${getStatusClass(visit.status)}`}>
                                                        {visit.status}
                                                    </span>
                                                    <div className="flex items-center">
                                                      <button onClick={() => handleOpenEditModal(visit)} className="p-1 text-blue-600 hover:text-blue-800"><ICONS.edit /></button>
                                                      <button onClick={() => handleDeleteVisit(visit.id)} className="p-1 text-red-600 hover:text-red-800"><ICONS.trash /></button>
                                                    </div>
                                                </div>
                                            </div>
                                        </Card>
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>
                )
            }
             <VisitFormModal 
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                salesUsers={salesUsers}
                stores={stores}
                visitToEdit={visitToEdit}
            />
        </div>
    );
};