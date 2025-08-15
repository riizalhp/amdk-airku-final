
import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getSurveys } from '../../services/surveyApiService';
import { getUsers } from '../../services/userApiService';
import { Card } from '../ui/Card';
import { Modal } from '../ui/Modal';
import { SurveyResponse, User, Role } from '../../types';

export const SurveyReports: React.FC = () => {
    const [selectedSurvey, setSelectedSurvey] = useState<SurveyResponse | null>(null);

    // Filter states
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [selectedSales, setSelectedSales] = useState('all');
    const [searchTerm, setSearchTerm] = useState('');
    
    const { data: surveys = [], isLoading: isLoadingSurveys } = useQuery<SurveyResponse[]>({
        queryKey: ['surveys'],
        queryFn: getSurveys,
    });
    const { data: users = [], isLoading: isLoadingUsers } = useQuery<User[]>({
        queryKey: ['users'],
        queryFn: getUsers
    });

    const isLoading = isLoadingSurveys || isLoadingUsers;

    const salesUsers = useMemo(() => users.filter(u => u.role === Role.SALES), [users]);

    const filteredSurveys = useMemo(() => {
        return surveys
            .map(survey => {
                const salesPerson = users.find(u => u.id === survey.salesPersonId);
                return {
                    ...survey,
                    salesPersonName: salesPerson?.name || 'N/A',
                };
            })
            .filter(survey => {
                const term = searchTerm.toLowerCase();
                const searchMatch = term === '' ||
                    survey.storeName.toLowerCase().includes(term) ||
                    survey.storeAddress.toLowerCase().includes(term) ||
                    survey.feedback.toLowerCase().includes(term);

                const dateMatch = (!startDate || survey.surveyDate >= startDate) &&
                                  (!endDate || survey.surveyDate <= endDate);

                const salesMatch = selectedSales === 'all' || survey.salesPersonId === selectedSales;

                return searchMatch && dateMatch && salesMatch;
            })
            .sort((a,b) => new Date(b.surveyDate).getTime() - new Date(a.surveyDate).getTime());
    }, [surveys, users, searchTerm, startDate, endDate, selectedSales]);

    const combinedCompetitorData = useMemo(() => {
        if (!selectedSurvey) return [];
        const dataMap = new Map<string, { price?: number; volume?: string }>();
        
        selectedSurvey.competitorPrices?.forEach(p => {
            if (!dataMap.has(p.brand)) dataMap.set(p.brand, {});
            dataMap.get(p.brand)!.price = p.price;
        });

        selectedSurvey.competitorVolumes?.forEach(v => {
            if (!dataMap.has(v.brand)) dataMap.set(v.brand, {});
            dataMap.get(v.brand)!.volume = v.volume;
        });
        
        selectedSurvey.mostSoughtProducts?.forEach(p => {
            if (p.brand.toLowerCase() !== 'airku' && !dataMap.has(p.brand)) {
                dataMap.set(p.brand, {});
            }
        });

        return Array.from(dataMap.entries());
    }, [selectedSurvey]);
    

    if (isLoading) {
        return <div className="p-8">Memuat laporan survei...</div>;
    }

    return (
        <div className="p-8 space-y-6">
            <h1 className="text-3xl font-bold text-brand-dark">Laporan Survei Pasar</h1>

            <Card>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 items-end">
                    <div><label className="text-sm font-medium">Tanggal Mulai</label><input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="w-full p-2 border rounded mt-1" /></div>
                    <div><label className="text-sm font-medium">Tanggal Akhir</label><input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="w-full p-2 border rounded mt-1" /></div>
                    <div><label className="text-sm font-medium">Sales</label><select value={selectedSales} onChange={e => setSelectedSales(e.target.value)} className="w-full p-2 border rounded mt-1 bg-white"><option value="all">-- Semua Sales --</option>{salesUsers.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}</select></div>
                    <div><label className="text-sm font-medium">Pencarian</label><input type="text" placeholder="Cari toko, alamat, feedback..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="w-full p-2 border rounded mt-1" /></div>
                </div>
            </Card>

            {filteredSurveys.length === 0 ? (
                <Card>
                    <p className="text-center py-10 text-gray-500">Belum ada laporan survei yang cocok dengan filter.</p>
                </Card>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {filteredSurveys.map(survey => (
                        <Card key={survey.id} className="flex flex-col">
                            <div className="flex-grow">
                                <p className="text-xs text-gray-500">{new Date(survey.surveyDate).toLocaleDateString('id-ID')}</p>
                                <h2 className="text-lg font-bold text-brand-dark mt-1">{survey.storeName}</h2>
                                <p className="text-sm text-gray-600">{survey.storeAddress}</p>
                                <p className="text-sm mt-2">
                                    <span className="font-semibold">Oleh:</span> {survey.salesPersonName}
                                </p>
                                <p className="mt-4 text-sm text-gray-700 line-clamp-3">
                                    <strong>Feedback:</strong> "{survey.feedback || 'Tidak ada feedback'}"
                                </p>
                            </div>
                            <button 
                                onClick={() => setSelectedSurvey(survey)}
                                className="mt-4 w-full text-center bg-brand-light text-brand-dark font-semibold py-2 rounded-lg hover:bg-brand-secondary hover:text-white transition-colors"
                            >
                                Lihat Detail
                            </button>
                        </Card>
                    ))}
                </div>
            )}

            {selectedSurvey && (
                <Modal title={`Detail Survei: ${selectedSurvey.storeName}`} isOpen={!!selectedSurvey} onClose={() => setSelectedSurvey(null)} size="lg">
                    <div className="space-y-6 text-sm">
                        
                        <div>
                            <h3 className="font-bold text-base text-brand-dark mb-2">Informasi Dasar</h3>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-2 p-3 bg-gray-50 rounded-lg">
                                <p><strong>Tanggal:</strong> {new Date(selectedSurvey.surveyDate).toLocaleDateString('id-ID')}</p>
                                <p><strong>Sales:</strong> {users.find(u => u.id === selectedSurvey.salesPersonId)?.name || 'N/A'}</p>
                                <p><strong>Alamat:</strong> {selectedSurvey.storeAddress || '-'}</p>
                                <p><strong>Telepon:</strong> {selectedSurvey.storePhone || '-'}</p>
                            </div>
                        </div>

                        <div className="pt-4 border-t">
                            <h3 className="font-semibold text-base text-brand-dark mb-2">1. Produk Paling Sering Dicari Konsumen</h3>
                            {selectedSurvey.mostSoughtProducts && selectedSurvey.mostSoughtProducts.length > 0 ? (
                                <ol className="list-decimal list-inside space-y-1 pl-4">
                                    {selectedSurvey.mostSoughtProducts.map((p, i) => <li key={i}>{p.brand} - {p.variant}</li>)}
                                </ol>
                            ) : (<p className="text-gray-500 pl-4">Tidak ada data.</p>)}
                        </div>

                         <div className="pt-4 border-t">
                            <h3 className="font-semibold text-base text-brand-dark mb-2">2. Varian AIRKU Terpopuler</h3>
                             {selectedSurvey.popularAirkuVariants && selectedSurvey.popularAirkuVariants.length > 0 ? (
                                <ol className="list-decimal list-inside space-y-1 pl-4">
                                    {selectedSurvey.popularAirkuVariants.map((v, i) => <li key={i}>{v}</li>)}
                                </ol>
                            ) : (<p className="text-gray-500 pl-4">Tidak ada data.</p>)}
                        </div>

                        <div className="pt-4 border-t">
                            <h3 className="font-semibold text-base text-brand-dark mb-2">3 & 4. Data Kompetitor</h3>
                            {combinedCompetitorData.length > 0 ? (
                                <div className="overflow-x-auto">
                                    <table className="w-full text-left">
                                        <thead className="bg-gray-100 text-xs uppercase">
                                            <tr>
                                                <th className="px-4 py-2">Merek</th>
                                                <th className="px-4 py-2 text-right">Harga Jual (Rp)</th>
                                                <th className="px-4 py-2">Volume / Bulan</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {combinedCompetitorData.map(([brand, data]) => (
                                                <tr key={brand} className="border-b">
                                                    <td className="px-4 py-2 font-medium">{brand}</td>
                                                    <td className="px-4 py-2 text-right">{data.price ? data.price.toLocaleString('id-ID') : '-'}</td>
                                                    <td className="px-4 py-2">{data.volume || '-'}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            ) : (<p className="text-gray-500 pl-4">Tidak ada data kompetitor.</p>)}
                        </div>

                        <div className="pt-4 border-t">
                            <h3 className="font-semibold text-base text-brand-dark mb-2">5. Masukan untuk AIRKU</h3>
                            <p className="mt-1 p-3 bg-gray-50 rounded-lg whitespace-pre-wrap">{selectedSurvey.feedback || "Tidak ada."}</p>
                        </div>

                        {selectedSurvey.proofOfSurveyImage && (
                            <div className="pt-4 border-t">
                                <h3 className="font-semibold text-base text-brand-dark mb-2">Bukti Survei</h3>
                                <img src={selectedSurvey.proofOfSurveyImage} alt="Bukti Survei" className="rounded-lg max-h-80 w-auto mx-auto border"/>
                            </div>
                        )}
                    </div>
                </Modal>
            )}
        </div>
    );
};
