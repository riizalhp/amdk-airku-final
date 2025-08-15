import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card } from '../ui/Card';
import { ICONS } from '../../constants';
import { User, Role } from '../../types';
import { Modal } from '../ui/Modal';
import { getUsers, createUser, updateUser, deleteUser } from '../../services/userApiService';
import { useAppContext } from '../../hooks/useAppContext';

export const UserManagement: React.FC = () => {
    const queryClient = useQueryClient();
    const { currentUser: loggedInUser } = useAppContext();
    const [isModalOpen, setIsModalOpen] = useState(false);
    const initialFormState: Omit<User, 'id'> = { name: '', email: '', role: Role.SALES, password: '' };
    const [currentUser, setCurrentUser] = useState<Omit<User, 'id'> | User>(initialFormState);
    const [isEditing, setIsEditing] = useState(false);
    const [apiError, setApiError] = useState<string | null>(null);

    const [searchTerm, setSearchTerm] = useState('');
    const [filterRole, setFilterRole] = useState<Role | 'all'>('all');

    const { data: users = [], isLoading } = useQuery<User[]>({
        queryKey: ['users'],
        queryFn: getUsers,
    });

    const createUserMutation = useMutation({
        mutationFn: createUser,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['users'] });
            setIsModalOpen(false);
            alert('Pengguna baru berhasil ditambahkan!');
        },
        onError: (error: any) => {
            setApiError(error.response?.data?.message || 'Gagal membuat pengguna.');
        },
    });

    const updateUserMutation = useMutation({
        mutationFn: updateUser,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['users'] });
            setIsModalOpen(false);
            alert('Data pengguna berhasil diperbarui!');
        },
        onError: (error: any) => {
            setApiError(error.response?.data?.message || 'Gagal memperbarui pengguna.');
        },
    });

    const deleteUserMutation = useMutation({
        mutationFn: deleteUser,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['users'] });
            alert('Pengguna berhasil dihapus.');
        },
        onError: (error: any) => {
            alert(error.response?.data?.message || 'Gagal menghapus pengguna.');
        },
    });

    const filteredUsers = useMemo(() => {
        // Reverse the array to show newest users first, then filter
        return [...users].reverse().filter(user => {
            const term = searchTerm.toLowerCase();
            const searchMatch = term === '' ||
                user.name.toLowerCase().includes(term) ||
                user.email.toLowerCase().includes(term);
            const roleMatch = filterRole === 'all' || user.role === filterRole;
            return searchMatch && roleMatch;
        });
    }, [users, searchTerm, filterRole]);

    const openModalForAdd = () => {
        setIsEditing(false);
        setCurrentUser(initialFormState);
        setApiError(null);
        setIsModalOpen(true);
    };

    const openModalForEdit = (user: User) => {
        setIsEditing(true);
        setCurrentUser({ ...user, password: '' });
        setApiError(null);
        setIsModalOpen(true);
    };

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        setCurrentUser(prev => ({ ...prev, [name]: value }));
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        setApiError(null);
        if (currentUser.name && currentUser.email) {
            if (isEditing) {
                updateUserMutation.mutate(currentUser as User);
            } else {
                createUserMutation.mutate(currentUser as Omit<User, 'id'>);
            }
        }
    };
    
    const handleDelete = (userId: string) => {
        if (window.confirm('Anda yakin ingin menghapus pengguna ini?')) {
            deleteUserMutation.mutate(userId);
        }
    };

    return (
        <div className="p-8 space-y-6">
            <div className="flex justify-between items-center">
                <h1 className="text-3xl font-bold text-brand-dark">User Management</h1>
                <button
                    onClick={openModalForAdd}
                    className="flex items-center gap-2 bg-brand-primary text-white font-bold py-2 px-4 rounded-lg shadow-md hover:bg-brand-dark transition duration-300"
                >
                    <ICONS.plus />
                    Add User
                </button>
            </div>

            <Card>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <label htmlFor="searchUser" className="block text-sm font-medium text-gray-700">Cari Pengguna</label>
                        <input
                            id="searchUser"
                            type="text"
                            placeholder="Masukkan nama atau email..."
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                            className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md"
                        />
                    </div>
                    <div>
                        <label htmlFor="roleFilter" className="block text-sm font-medium text-gray-700">Filter Peran</label>
                        <select
                            id="roleFilter"
                            value={filterRole}
                            onChange={e => setFilterRole(e.target.value as any)}
                            className="mt-1 block w-full px-3 py-2 border border-gray-300 bg-white rounded-md"
                        >
                            <option value="all">Semua Peran</option>
                            {Object.values(Role).map(role => <option key={role} value={role}>{role}</option>)}
                        </select>
                    </div>
                </div>
            </Card>

            <Card className="!p-0">
                <div className="overflow-x-auto">
                    <table className="min-w-full text-sm text-left text-gray-700">
                        <thead className="bg-gray-50 text-xs text-gray-700 uppercase">
                            <tr>
                                <th scope="col" className="px-6 py-3">Name</th>
                                <th scope="col" className="px-6 py-3">Email</th>
                                <th scope="col" className="px-6 py-3">Role</th>
                                <th scope="col" className="px-6 py-3">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {isLoading ? (
                                <tr><td colSpan={4} className="text-center p-4">Loading users...</td></tr>
                            ) : filteredUsers.map((user: User) => {
                                const isSelf = loggedInUser?.id === user.id;
                                return (
                                <tr key={user.id} className="bg-white border-b hover:bg-gray-50">
                                    <td className="px-6 py-4 font-medium text-gray-900">{user.name}</td>
                                    <td className="px-6 py-4">{user.email}</td>
                                    <td className="px-6 py-4">
                                        <span className={`px-2 py-1 text-xs font-semibold rounded-full ${user.role === Role.ADMIN ? 'bg-red-100 text-red-800' : 'bg-blue-100 text-blue-800'}`}>
                                            {user.role}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 flex space-x-2">
                                        <button onClick={() => openModalForEdit(user)} className="text-blue-600 hover:text-blue-800 p-1"><ICONS.edit width={20} height={20} /></button>
                                        <button
                                            onClick={() => handleDelete(user.id)}
                                            disabled={isSelf || deleteUserMutation.isPending}
                                            className="text-red-600 hover:text-red-800 p-1 disabled:text-gray-400 disabled:cursor-not-allowed"
                                        >
                                            <ICONS.trash width={20} height={20} />
                                        </button>
                                    </td>
                                </tr>
                            )})}
                        </tbody>
                    </table>
                    {!isLoading && filteredUsers.length === 0 && (
                        <p className="text-center text-gray-500 py-6">Tidak ada pengguna yang cocok dengan filter.</p>
                    )}
                </div>
            </Card>

            <Modal title={isEditing ? "Edit User" : "Add New User"} isOpen={isModalOpen} onClose={() => setIsModalOpen(false)}>
                <form onSubmit={handleSubmit} className="space-y-4">
                    {apiError && <p className="text-sm text-red-600 bg-red-100 p-2 rounded">{apiError}</p>}
                    <div>
                        <label htmlFor="name" className="block text-sm font-medium text-gray-700">Full Name</label>
                        <input type="text" name="name" id="name" value={currentUser.name} onChange={handleInputChange} className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-brand-primary focus:border-brand-primary" required />
                    </div>
                    <div>
                        <label htmlFor="email" className="block text-sm font-medium text-gray-700">Email Address</label>
                        <input type="email" name="email" id="email" value={currentUser.email} onChange={handleInputChange} className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-brand-primary focus:border-brand-primary" required />
                    </div>
                     <div>
                        <label htmlFor="password" className="block text-sm font-medium text-gray-700">Password</label>
                        <input type="password" name="password" id="password" value={currentUser.password} onChange={handleInputChange} className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-brand-primary focus:border-brand-primary" placeholder={isEditing ? "Biarkan kosong untuk mempertahankan password" : ""} required={!isEditing} />
                    </div>
                    <div>
                        <label htmlFor="role" className="block text-sm font-medium text-gray-700">Role</label>
                        <select name="role" id="role" value={currentUser.role} onChange={handleInputChange} className="mt-1 block w-full px-3 py-2 border border-gray-300 bg-white rounded-md shadow-sm focus:outline-none focus:ring-brand-primary focus:border-brand-primary">
                            {Object.values(Role).map(role => <option key={role} value={role}>{role}</option>)}
                        </select>
                    </div>
                    <div className="flex justify-end pt-4">
                        <button type="button" onClick={() => setIsModalOpen(false)} className="bg-gray-200 text-gray-700 font-bold py-2 px-4 rounded-lg mr-2 hover:bg-gray-300">Batal</button>
                        <button type="submit" disabled={createUserMutation.isPending || updateUserMutation.isPending} className="bg-brand-primary text-white font-bold py-2 px-4 rounded-lg hover:bg-brand-dark disabled:bg-gray-400">
                            {createUserMutation.isPending || updateUserMutation.isPending ? 'Menyimpan...' : (isEditing ? "Simpan Perubahan" : "Tambah Pengguna")}
                        </button>
                    </div>
                </form>
            </Modal>
        </div>
    );
};