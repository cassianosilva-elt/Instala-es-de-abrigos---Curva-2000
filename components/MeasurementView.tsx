
import React, { useState, useMemo, useEffect } from 'react';
import { Asset, User, TaskEvidence } from '../types';
import { getAssets, getEvidenceByAssetId, getMeasurementPrices, bulkUpdateMeasurementPrices } from '../api/fieldManagerApi';
import { Search, Building2, CheckCircle2, ChevronDown, Download, Plus, Trash2, Calculator, Save, Image as ImageIcon, X, Upload, Check } from 'lucide-react';
import * as XLSX from 'xlsx';

export interface MeasurementItem {
    id: string;
    description: string;
    unit: string;
    price: number;
    category: string;
}

interface SelectedAssetMeasurement {
    asset: Asset;
    items: string[]; // item IDs
}

export const MeasurementView: React.FC<{ currentUser: User }> = ({ currentUser }) => {
    const [assets, setAssets] = useState<Asset[]>([]);
    const [selectedCompany, setSelectedCompany] = useState<string>('gf1');
    const [currentPriceList, setCurrentPriceList] = useState<MeasurementItem[]>([]);
    const [selectedAssets, setSelectedAssets] = useState<SelectedAssetMeasurement[]>([]);
    const [assetEvidences, setAssetEvidences] = useState<Record<string, TaskEvidence[]>>({});
    const [searchQuery, setSearchQuery] = useState('');
    const [activitySearch, setActivitySearch] = useState('');
    const [loading, setLoading] = useState(true);
    const [selectedPhoto, setSelectedPhoto] = useState<string | null>(null);
    const [importing, setImporting] = useState(false);
    const [importSuccess, setImportSuccess] = useState(false);
    const [importCategory, setImportCategory] = useState<string>('all');

    useEffect(() => {
        loadAssets();
    }, []);

    useEffect(() => {
        // Partners can only see their own company (case-insensitive check)
        const userCid = currentUser.companyId?.toLowerCase();
        if (userCid && userCid !== 'internal' && selectedCompany !== userCid) {
            setSelectedCompany(userCid);
        }
        loadPrices();
    }, [selectedCompany, currentUser.companyId]);

    const loadAssets = async () => {
        setLoading(true);
        const data = await getAssets();
        setAssets(data);
        setLoading(false);
    };

    const loadPrices = async () => {
        const prices = await getMeasurementPrices(selectedCompany);
        setCurrentPriceList(prices);
    };

    useEffect(() => {
        // Fetch evidence for newly added selected assets
        selectedAssets.forEach(async (sa) => {
            if (!assetEvidences[sa.asset.id]) {
                const evidences = await getEvidenceByAssetId(sa.asset.id);
                setAssetEvidences(prev => ({ ...prev, [sa.asset.id]: evidences }));
            }
        });
    }, [selectedAssets]);

    const companies = useMemo(() => {
        const all = [
            { id: 'gf1', name: 'GF1' },
            { id: 'alvares', name: 'Alvares' },
            { id: 'bassi', name: 'Bassi' }
        ];
        const userCid = currentUser.companyId?.toLowerCase();
        if (userCid && userCid !== 'internal') {
            return all.filter(c => c.id === userCid);
        }
        return all;
    }, [currentUser.companyId]);

    const isInternal = currentUser.companyId?.toLowerCase() === 'internal';
    const canManagePrices = currentUser.role.includes('CHEFE') || currentUser.role.includes('LIDER');

    const filteredAssets = assets.filter(a =>
        a.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
        a.location.address.toLowerCase().includes(searchQuery.toLowerCase())
    ).slice(0, 10);

    const handleAddAsset = (asset: Asset) => {
        if (selectedAssets.some(sa => sa.asset.id === asset.id)) return;
        setSelectedAssets(prev => [...prev, { asset, items: [] }]);
    };

    const handleRemoveAsset = (assetId: string) => {
        setSelectedAssets(prev => prev.filter(sa => sa.asset.id !== assetId));
    };

    const toggleItem = (assetId: string, itemId: string) => {
        setSelectedAssets(prev => prev.map(sa => {
            if (sa.asset.id === assetId) {
                const newItems = sa.items.includes(itemId)
                    ? sa.items.filter(id => id !== itemId)
                    : [...sa.items, itemId];
                return { ...sa, items: newItems };
            }
            return sa;
        }));
    };

    const calculateAssetTotal = (sa: SelectedAssetMeasurement) => {
        return sa.items.reduce((acc, itemId) => {
            const item = currentPriceList.find(i => i.id === itemId);
            return acc + (item?.price || 0);
        }, 0);
    };

    const grandTotal = useMemo(() => {
        return selectedAssets.reduce((acc, sa) => acc + calculateAssetTotal(sa), 0);
    }, [selectedAssets, currentPriceList]);

    const exportToExcel = () => {
        const data = selectedAssets.flatMap(sa => {
            return sa.items.map(itemId => {
                const item = currentPriceList.find(i => i.id === itemId);
                return {
                    'Empresa': companies.find(c => c.id === selectedCompany)?.name,
                    'Código Abrigo': sa.asset.code,
                    'Endereço': sa.asset.location.address,
                    'Cidade': sa.asset.city,
                    'ID Item': item?.id,
                    'Atividade': item?.description,
                    'Unidade': item?.unit,
                    'Valor Unitário': item?.price,
                    'Total': item?.price
                };
            });
        });

        const worksheet = XLSX.utils.json_to_sheet(data);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, 'Medição');
        XLSX.writeFile(workbook, `Medicao_${new Date().toISOString().split('T')[0]}.xlsx`);
    };

    const handleImportPrices = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        setImporting(true);
        const reader = new FileReader();

        reader.onload = async (e) => {
            try {
                const data = e.target?.result;
                const workbook = XLSX.read(data, { type: 'binary' });
                const sheetName = workbook.SheetNames[0];
                const sheet = workbook.Sheets[sheetName];
                const json = XLSX.utils.sheet_to_json(sheet) as any[];

                if (!json || json.length === 0) {
                    throw new Error('A planilha está vazia.');
                }

                // Helper to parse Brazilian currency strings or regular numbers
                const parsePrice = (val: any): number => {
                    if (typeof val === 'number') return val;
                    if (!val) return 0;
                    // Remove R$, spaces, and handle dots/commas
                    const clean = String(val)
                        .replace(/[R$\s]/g, '')
                        .replace(/\./g, '')
                        .replace(',', '.');
                    return parseFloat(clean) || 0;
                };

                // Map JSON to MeasurementItem
                let currentDetectedCategory = '';
                const newPrices = json.map(row => {
                    const price = parsePrice(row['PROPOSTA REVISADA'] || row.Preco || row.price || row.Valor || 0);
                    const description = String(row.DESCRITIVO || row.Descritivo || row.Descricao || row.description || row.Atividade || '');

                    // If price is 0, this might be a category header row
                    if (price === 0 && description) {
                        currentDetectedCategory = description.toUpperCase();
                    }

                    return {
                        id: String(row.ITEM || row.Item || row.ID || row.id || ''),
                        category: importCategory === 'all'
                            ? (String(row.Categoria || row.category || row.CATEGORIA || '') || currentDetectedCategory)
                            : (importCategory === 'abrigo' ? 'ABRIGO' : importCategory === 'totem' ? 'TOTEM' : 'DIGITAL'),
                        description: description,
                        unit: String(row.UM || row.Um || row.Unidade || row.unit || 'UN'),
                        price: price
                    };
                }).filter(p => p.id && p.description && p.price > 0);

                if (newPrices.length === 0) {
                    throw new Error('Nenhum preço válido encontrado. Verifique os cabeçalhos das colunas.');
                }

                await bulkUpdateMeasurementPrices(selectedCompany, newPrices, importCategory);
                setImportSuccess(true);
                await loadPrices();
                setTimeout(() => setImportSuccess(false), 3000);
            } catch (error: any) {
                console.error('Error importing prices:', error);
                alert(`Erro ao importar preços: ${error.message || 'Verifique o formato do arquivo.'}`);
            } finally {
                setImporting(false);
                event.target.value = '';
            }
        };

        reader.onerror = () => {
            alert('Erro ao ler o arquivo.');
            setImporting(false);
        };

        reader.readAsBinaryString(file);
    };

    const groupedPrices = useMemo(() => {
        const filtered = activitySearch
            ? currentPriceList.filter(i => i.description.toLowerCase().includes(activitySearch.toLowerCase()))
            : currentPriceList;

        return filtered.reduce((acc, item) => {
            if (!acc[item.category]) acc[item.category] = [];
            acc[item.category].push(item);
            return acc;
        }, {} as Record<string, MeasurementItem[]>);
    }, [currentPriceList, activitySearch]);

    return (
        <div className="flex flex-col gap-8 pb-20">
            {/* Header & Company Selection */}
            <div className="bg-white p-5 md:p-8 rounded-[32px] border border-slate-100 shadow-sm">
                <div className="flex flex-col 2xl:flex-row 2xl:items-center justify-between gap-6">
                    <div className="flex items-center gap-4 shrink-0">
                        <div className="p-3 bg-primary-50 text-primary rounded-2xl">
                            <Calculator size={24} />
                        </div>
                        <div>
                            <h2 className="text-xl font-black text-slate-900 uppercase tracking-tight">Medição e Orçamento</h2>
                            <p className="text-sm text-slate-400 font-medium">Calcule o custo das atividades por abrigo</p>
                        </div>
                    </div>

                    <div className="flex flex-col md:flex-row items-stretch md:items-center gap-3 md:gap-4 w-full 2xl:w-auto flex-wrap 2xl:justify-end">
                        {companies.length > 1 && (
                            <div className="relative group w-full md:w-auto shrink-0">
                                <Building2 className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                                <select
                                    value={selectedCompany}
                                    onChange={(e) => setSelectedCompany(e.target.value)}
                                    className="w-full md:w-auto pl-12 pr-10 py-3 bg-slate-50 border-none rounded-2xl text-sm font-bold text-slate-700 focus:ring-2 focus:ring-primary/20 appearance-none cursor-pointer"
                                >
                                    {companies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                                </select>
                            </div>
                        )}

                        {canManagePrices && (
                            <div className="flex flex-col md:flex-row items-stretch md:items-center gap-3 md:gap-4 lg:gap-2 shrink-0 flex-wrap">
                                <div className="flex items-center gap-2 bg-slate-50 rounded-xl px-2 py-1 md:py-0 md:bg-transparent w-full md:w-auto shrink-0">
                                    <Calculator size={16} className="text-slate-400 ml-2 md:ml-0" />
                                    <select
                                        value={importCategory}
                                        onChange={(e) => setImportCategory(e.target.value)}
                                        className="w-full md:w-auto bg-transparent md:bg-slate-50 border-none rounded-xl text-[10px] font-black uppercase tracking-widest px-2 md:px-4 py-3 focus:ring-2 focus:ring-primary/20 appearance-none cursor-pointer"
                                    >
                                        <option value="all">Sincronizar Tudo (Planilha Completa)</option>
                                        <option value="abrigo">Apenas Abrigos</option>
                                        <option value="totem">Apenas Totens</option>
                                        <option value="digital">Apenas Digitais</option>
                                    </select>
                                </div>

                                <label className={`flex items-center justify-center gap-2 px-6 py-3 rounded-2xl text-xs font-black uppercase tracking-widest transition-all cursor-pointer whitespace-nowrap ${importSuccess ? 'bg-green-500 text-white' : 'bg-primary/10 text-primary hover:bg-primary/20'
                                    }`}>
                                    {importing ? <div className="w-4 h-4 border-2 border-primary border-t-transparent animate-spin rounded-full" /> : (importSuccess ? <Check size={18} /> : <Upload size={18} />)}
                                    {importSuccess ? 'Importado!' : 'Importar Preços'}
                                    <input type="file" accept=".xlsx, .xls" onChange={handleImportPrices} className="hidden" />
                                </label>
                            </div>
                        )}

                        <button
                            onClick={exportToExcel}
                            disabled={selectedAssets.length === 0}
                            className="flex items-center justify-center gap-2 px-6 py-3 bg-secondary text-primary rounded-2xl text-xs font-black uppercase tracking-widest hover:scale-105 transition-all disabled:opacity-50 disabled:scale-100 whitespace-nowrap w-full md:w-auto shrink-0"
                        >
                            <Download size={18} />
                            Exportar Planilha
                        </button>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                {/* Left Side: Search and Selection */}
                <div className="lg:col-span-4 flex flex-col gap-6">
                    <div className="bg-white p-6 rounded-[32px] border border-slate-100 shadow-sm flex flex-col gap-4">
                        <h3 className="text-xs font-black text-primary uppercase tracking-[0.2em]">Buscar Abrigos</h3>
                        <div className="relative">
                            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                            <input
                                type="text"
                                placeholder="Código ou Endereço..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="w-full pl-12 pr-4 py-4 bg-slate-50 border-none rounded-2xl text-sm focus:ring-2 focus:ring-primary/20"
                            />
                        </div>

                        <div className="flex flex-col gap-2 mt-2">
                            {filteredAssets.map(asset => (
                                <button
                                    key={asset.id}
                                    onClick={() => handleAddAsset(asset)}
                                    className="flex items-center justify-between p-4 rounded-2xl hover:bg-primary-50 transition-all text-left group"
                                >
                                    <div>
                                        <p className="font-black text-slate-900 text-sm uppercase">{asset.code}</p>
                                        <p className="text-[10px] text-slate-400 font-medium truncate max-w-[200px]">{asset.location.address}</p>
                                    </div>
                                    <div className="p-2 bg-white rounded-xl shadow-sm opacity-0 group-hover:opacity-100 transition-opacity">
                                        <Plus size={16} className="text-primary" />
                                    </div>
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Grand Total Summary */}
                    <div className="bg-primary p-6 md:p-8 rounded-3xl shadow-2xl shadow-primary/30 text-white flex flex-col gap-2">
                        <p className="text-[10px] font-black uppercase tracking-[0.22em] opacity-80">Total Geral Acumulado</p>
                        <p className="text-3xl md:text-4xl font-black tracking-tighter">
                            {grandTotal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                        </p>
                        <div className="mt-4 pt-4 border-t border-white/10 flex justify-between items-center">
                            <span className="text-[10px] font-black uppercase tracking-widest opacity-60">Itens Selecionados</span>
                            <span className="font-black">{selectedAssets.reduce((acc, sa) => acc + sa.items.length, 0)}</span>
                        </div>
                    </div>
                </div>

                {/* Right Side: Selected Assets & Measurements */}
                <div className="lg:col-span-8 flex flex-col gap-6">
                    {/* Activity Filter Search */}
                    {selectedAssets.length > 0 && (
                        <div className="bg-white p-6 rounded-[32px] border border-slate-100 shadow-sm flex flex-col gap-4">
                            <h3 className="text-xs font-black text-primary uppercase tracking-[0.2em]">Filtrar Atividades (Geral)</h3>
                            <div className="relative">
                                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                                <input
                                    type="text"
                                    placeholder="Pesquisar atividade (ex: passagem de cabo pp)..."
                                    value={activitySearch}
                                    onChange={(e) => setActivitySearch(e.target.value)}
                                    className="w-full pl-12 pr-4 py-4 bg-primary-50/30 border-none rounded-2xl text-sm font-bold focus:ring-2 focus:ring-primary/20"
                                />
                            </div>
                        </div>
                    )}

                    {selectedAssets.length === 0 ? (
                        <div className="bg-white border-2 border-dashed border-slate-100 rounded-[32px] p-20 flex flex-col items-center justify-center text-center gap-4">
                            <div className="p-6 bg-slate-50 text-slate-300 rounded-[32px]">
                                <Calculator size={48} />
                            </div>
                            <div>
                                <h3 className="text-lg font-black text-slate-900 uppercase">Nenhum abrigo selecionado</h3>
                                <p className="text-sm text-slate-400 max-w-xs">Busque e adicione abrigos ao lado para começar a medição das atividades.</p>
                            </div>
                        </div>
                    ) : (
                        <div className="flex flex-col gap-6">
                            {selectedAssets.map((sa) => (
                                <div key={sa.asset.id} className="bg-white rounded-[32px] border border-slate-100 shadow-sm overflow-hidden flex flex-col">
                                    {/* Asset Header */}
                                    <div className="p-6 bg-slate-50/50 flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-50">
                                        <div className="flex items-center gap-4">
                                            <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center text-primary shadow-sm">
                                                <Building2 size={24} />
                                            </div>
                                            <div>
                                                <h4 className="font-black text-slate-900 uppercase">{sa.asset.code}</h4>
                                                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">{sa.asset.location.address}</p>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-6">
                                            <div className="text-right">
                                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">Total do Abrigo</p>
                                                <p className="text-xl font-black text-primary">
                                                    {calculateAssetTotal(sa).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                                                </p>
                                            </div>
                                            <button
                                                onClick={() => handleRemoveAsset(sa.asset.id)}
                                                className="p-3 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-2xl transition-all"
                                            >
                                                <Trash2 size={20} />
                                            </button>
                                        </div>
                                    </div>

                                    {/* Photos Section */}
                                    <div className="p-6 border-b border-slate-50">
                                        <div className="flex items-center gap-2 mb-4">
                                            <ImageIcon size={16} className="text-primary" />
                                            <h5 className="text-[10px] font-black text-slate-900 uppercase tracking-widest">Evidências Técnicas</h5>
                                        </div>
                                        <div className="flex gap-4 overflow-x-auto pb-2 scrollbar-hide">
                                            {assetEvidences[sa.asset.id]?.length === 0 && (
                                                <p className="text-[10px] text-slate-400 font-bold uppercase">Nenhuma foto encontrada para este abrigo.</p>
                                            )}
                                            {assetEvidences[sa.asset.id]?.map((ev) => (
                                                <button
                                                    key={ev.id}
                                                    onClick={() => setSelectedPhoto(ev.photoUrl)}
                                                    className="w-24 h-24 rounded-xl overflow-hidden shrink-0 border border-slate-100 hover:scale-105 transition-transform"
                                                >
                                                    <img src={ev.photoUrl} alt="Evidence" className="w-full h-full object-cover" />
                                                </button>
                                            ))}
                                        </div>
                                    </div>

                                    {/* Activity Selection */}
                                    <div className="p-8">
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-8">
                                            {(Object.entries(groupedPrices) as [string, MeasurementItem[]][]).map(([category, items]) => (
                                                <div key={category} className="flex flex-col gap-4">
                                                    <h5 className="text-[10px] font-black text-primary uppercase tracking-[0.25em] mb-2">{category}</h5>
                                                    <div className="flex flex-col gap-3">
                                                        {items.map(item => (
                                                            <button
                                                                key={item.id}
                                                                onClick={() => toggleItem(sa.asset.id, item.id)}
                                                                className={`flex items-center justify-between p-4 rounded-2xl border transition-all text-left ${sa.items.includes(item.id)
                                                                    ? 'bg-primary/5 border-primary shadow-sm'
                                                                    : 'bg-white border-slate-100 hover:border-primary-100'
                                                                    }`}
                                                            >
                                                                <div className="flex items-center gap-3">
                                                                    <div className={`w-5 h-5 rounded-lg border-2 flex items-center justify-center transition-all ${sa.items.includes(item.id)
                                                                        ? 'bg-primary border-primary'
                                                                        : 'border-slate-200'
                                                                        }`}>
                                                                        {sa.items.includes(item.id) && <CheckCircle2 size={12} className="text-white" />}
                                                                    </div>
                                                                    <div>
                                                                        <p className={`text-xs font-black uppercase tracking-tight ${sa.items.includes(item.id) ? 'text-primary' : 'text-slate-600'}`}>{item.description}</p>
                                                                        <p className="text-[9px] text-slate-400 font-bold">{item.unit} • {item.price.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</p>
                                                                    </div>
                                                                </div>
                                                            </button>
                                                        ))}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {/* Photo Modal */}
            {selectedPhoto && (
                <div
                    className="fixed inset-0 bg-slate-900/90 backdrop-blur-sm z-[100] flex items-center justify-center p-4"
                    onClick={() => setSelectedPhoto(null)}
                >
                    <button className="absolute top-8 right-8 text-white hover:text-primary transition-colors">
                        <X size={32} />
                    </button>
                    <img src={selectedPhoto} alt="Evidence Full" className="max-w-full max-h-full rounded-3xl shadow-2xl" />
                </div>
            )}
        </div>
    );
};
