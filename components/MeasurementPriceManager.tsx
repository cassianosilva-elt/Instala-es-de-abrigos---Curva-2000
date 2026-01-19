
import React, { useState, useEffect } from 'react';
import { User, UserRole } from '../types';
import { getMeasurementPrices } from '../api/fieldManagerApi';
import { supabase } from '../api/supabaseClient';
import { Plus, Edit2, Trash2, Save, X, Search, Filter } from 'lucide-react';

const PARTNER_COMPANIES = [
    { id: 'gf1', name: 'GF1' },
    { id: 'alvares', name: 'Alvares' },
    { id: 'bassi', name: 'Bassi' },
    { id: 'afn_nogueira', name: 'AFN Nogueira' }
];

const CATEGORIES = [
    'TOTEM',
    'ABRIGO DE ÔNIBUS CAOS LEVE',
    'ABRIGO DE ÔNIBUS CAOS TOP',
    'ABRIGO DE ÔNIBUS MINIMALISTA LEVE',
    'ABRIGO DE ÔNIBUS MINIMALISTA TOP',
    'ABRIGO DE ÔNIBUS BRUTALISTA LEVE',
    'ABRIGO DE ÔNIBUS BRUTALISTA TOP',
    'INSTALAÇÃO PAINEL DIGITAL',
    'PAINEL ESTÁTICO',
    'POSTE'
];

interface PriceItem {
    id?: string;
    description: string;
    unit: string;
    price: number;
    category: string;
    company_id: string; // Needed for internal logic
}

export const MeasurementPriceManager: React.FC = () => {
    const [selectedCompany, setSelectedCompany] = useState<string>('gf1');
    const [selectedCategory, setSelectedCategory] = useState<string>('all');
    const [prices, setPrices] = useState<PriceItem[]>([]);
    const [loading, setLoading] = useState(false);
    const [editingItem, setEditingItem] = useState<PriceItem | null>(null);
    const [isModalOpen, setIsModalOpen] = useState(false);

    // Initial state for new item
    const emptyItem: PriceItem = {
        description: '',
        unit: 'UN',
        price: 0,
        category: CATEGORIES[0],
        company_id: selectedCompany
    };
    const [newItem, setNewItem] = useState<PriceItem>(emptyItem);

    useEffect(() => {
        loadPrices();
    }, [selectedCompany]);

    const loadPrices = async () => {
        setLoading(true);
        const data = await getMeasurementPrices(selectedCompany);
        // Map API response to PriceItem (API returns fields as is)
        const mapped: PriceItem[] = data.map(d => ({
            id: d.id,
            description: d.description,
            unit: d.unit,
            price: d.price,
            category: d.category,
            company_id: selectedCompany
        }));
        setPrices(mapped);
        setLoading(false);
    };

    const filteredPrices = prices.filter(p =>
        selectedCategory === 'all' || p.category === selectedCategory
    );

    const handleSave = async (item: PriceItem) => {
        try {
            if (!item.description || !item.price) {
                alert('Preencha descrição e preço.');
                return;
            }

            const payload = {
                company_id: selectedCompany,
                category: item.category,
                description: item.description,
                unit: item.unit,
                price: parseFloat(item.price.toString())
            };

            if (item.id) {
                // Update
                const { error } = await supabase
                    .from('measurement_prices')
                    .update(payload)
                    .eq('id', item.id);
                if (error) throw error;
            } else {
                // Insert
                const { error } = await supabase
                    .from('measurement_prices')
                    .insert(payload);
                if (error) throw error;
            }

            loadPrices();
            setIsModalOpen(false);
            setEditingItem(null);
            setNewItem({ ...emptyItem, company_id: selectedCompany });
        } catch (error) {
            console.error('Error saving price:', error);
            alert('Erro ao salvar preço.');
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm('Tem certeza que deseja excluir este item?')) return;
        try {
            const { error } = await supabase
                .from('measurement_prices')
                .delete()
                .eq('id', id);

            if (error) throw error;
            loadPrices();
        } catch (error) {
            console.error('Error deleting price:', error);
            alert('Erro ao excluir preço.');
        }
    };

    const openEdit = (item: PriceItem) => {
        setEditingItem(item);
        setNewItem({ ...item });
        setIsModalOpen(true);
    };

    const openNew = () => {
        setEditingItem(null);
        setNewItem({ ...emptyItem, company_id: selectedCompany, category: selectedCategory !== 'all' ? selectedCategory : CATEGORIES[0] });
        setIsModalOpen(true);
    };

    return (
        <div className="space-y-6 pb-20">
            {/* Header Controls */}
            <div className="bg-white p-6 rounded-[32px] border border-slate-100 shadow-sm flex flex-col md:flex-row items-center justify-between gap-6">
                <div>
                    <h2 className="text-2xl font-black text-slate-900 uppercase tracking-tight">Gestão de Tabelas</h2>
                    <p className="text-sm text-slate-400 font-medium">Configure os preços por parceiro</p>
                </div>

                <div className="flex flex-wrap gap-3 items-center">
                    <div className="relative">
                        <Filter className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                        <select
                            value={selectedCompany}
                            onChange={(e) => setSelectedCompany(e.target.value)}
                            className="pl-12 pr-10 py-3 bg-slate-50 border-none rounded-2xl text-sm font-bold text-slate-700 appearance-none cursor-pointer hover:bg-slate-100 transition-colors"
                        >
                            {PARTNER_COMPANIES.map(c => (
                                <option key={c.id} value={c.id}>{c.name}</option>
                            ))}
                        </select>
                    </div>

                    <div className="relative">
                        <Filter className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                        <select
                            value={selectedCategory}
                            onChange={(e) => setSelectedCategory(e.target.value)}
                            className="pl-12 pr-10 py-3 bg-slate-50 border-none rounded-2xl text-sm font-bold text-slate-700 appearance-none cursor-pointer hover:bg-slate-100 transition-colors"
                        >
                            <option value="all">Todas as Categorias</option>
                            {CATEGORIES.map(c => (
                                <option key={c} value={c}>{c}</option>
                            ))}
                        </select>
                    </div>

                    <button
                        onClick={openNew}
                        className="flex items-center gap-2 px-6 py-3 bg-primary text-white rounded-2xl font-black uppercase text-xs tracking-widest hover:bg-primary-600 transition-all shadow-lg shadow-primary/20"
                    >
                        <Plus size={18} />
                        Novo Preço
                    </button>
                </div>
            </div>

            {/* List */}
            <div className="bg-white rounded-[32px] border border-slate-100 shadow-sm overflow-hidden">
                <table className="w-full text-left border-collapse">
                    <thead>
                        <tr className="border-b border-slate-100 bg-slate-50/50">
                            <th className="p-6 text-[10px] font-black text-slate-400 uppercase tracking-widest">Categoria</th>
                            <th className="p-6 text-[10px] font-black text-slate-400 uppercase tracking-widest">Descrição (Item/Etapa)</th>
                            <th className="p-6 text-[10px] font-black text-slate-400 uppercase tracking-widest">Unidade</th>
                            <th className="p-6 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Preço</th>
                            <th className="p-6 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Ações</th>
                        </tr>
                    </thead>
                    <tbody>
                        {loading ? (
                            <tr><td colSpan={5} className="p-8 text-center text-slate-400">Carregando...</td></tr>
                        ) : filteredPrices.length === 0 ? (
                            <tr><td colSpan={5} className="p-8 text-center text-slate-400">Nenhum preço encontrado.</td></tr>
                        ) : (
                            filteredPrices.map((item) => (
                                <tr key={item.id} className="border-b border-slate-50 hover:bg-slate-50/50 transition-colors">
                                    <td className="p-6 text-xs font-bold text-slate-500">{item.category}</td>
                                    <td className="p-6 text-sm font-bold text-slate-900">{item.description}</td>
                                    <td className="p-6 text-xs text-slate-500 font-medium">{item.unit}</td>
                                    <td className="p-6 text-sm font-black text-primary text-right">
                                        {item.price.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                                    </td>
                                    <td className="p-6 text-right">
                                        <div className="flex justify-end gap-2">
                                            <button onClick={() => openEdit(item)} className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors">
                                                <Edit2 size={16} />
                                            </button>
                                            <button onClick={() => handleDelete(item.id!)} className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors">
                                                <Trash2 size={16} />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>

            {/* Modal */}
            {isModalOpen && (
                <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-[32px] w-full max-w-lg shadow-2xl p-8 animate-in zoom-in-95 duration-200">
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="text-xl font-black text-slate-900">{editingItem ? 'Editar Preço' : 'Novo Preço'}</h3>
                            <button onClick={() => setIsModalOpen(false)} className="p-2 hover:bg-slate-100 rounded-full text-slate-400 hover:text-slate-900">
                                <X size={20} />
                            </button>
                        </div>

                        <div className="space-y-4">
                            <div>
                                <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-2">Empresa</label>
                                <div className="p-3 bg-slate-50 rounded-xl text-slate-500 font-bold text-sm">
                                    {PARTNER_COMPANIES.find(c => c.id === selectedCompany)?.name}
                                </div>
                            </div>

                            <div>
                                <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-2">Categoria</label>
                                <select
                                    value={newItem.category}
                                    onChange={e => setNewItem({ ...newItem, category: e.target.value })}
                                    className="w-full p-3 bg-slate-50 rounded-xl border-none font-bold text-slate-700 focus:ring-2 focus:ring-primary"
                                >
                                    {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                                </select>
                            </div>

                            <div>
                                <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-2">Descrição (Etapa/Item)</label>
                                <input
                                    type="text"
                                    value={newItem.description}
                                    onChange={e => setNewItem({ ...newItem, description: e.target.value })}
                                    placeholder="Ex: Fundação, Instalação..."
                                    className="w-full p-3 bg-slate-50 rounded-xl border-none font-bold text-slate-700 focus:ring-2 focus:ring-primary placeholder:text-slate-300"
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-2">Unidade</label>
                                    <input
                                        type="text"
                                        value={newItem.unit}
                                        onChange={e => setNewItem({ ...newItem, unit: e.target.value })}
                                        className="w-full p-3 bg-slate-50 rounded-xl border-none font-bold text-slate-700 focus:ring-2 focus:ring-primary"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-2">Preço (R$)</label>
                                    <input
                                        type="number"
                                        step="0.01"
                                        value={newItem.price}
                                        onChange={e => setNewItem({ ...newItem, price: parseFloat(e.target.value) || 0 })}
                                        className="w-full p-3 bg-slate-50 rounded-xl border-none font-bold text-slate-700 focus:ring-2 focus:ring-primary"
                                    />
                                </div>
                            </div>

                            <button
                                onClick={() => handleSave(newItem)}
                                className="w-full py-4 bg-primary text-white rounded-2xl font-black uppercase tracking-widest hover:bg-primary-600 transition-all shadow-lg shadow-primary/20 mt-4"
                            >
                                Salvar
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
