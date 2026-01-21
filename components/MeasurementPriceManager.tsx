
import React, { useState, useEffect, useRef } from 'react';
import { User, UserRole } from '../types';
import { getMeasurementPrices } from '../api/fieldManagerApi';
import { supabase } from '../api/supabaseClient';
import { Plus, Edit2, Trash2, Save, X, Search, Filter, Zap, Check, FileSpreadsheet, Upload, AlertCircle } from 'lucide-react';
import * as XLSX from 'xlsx';

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
    'PAINEL DIGITAL/ESTÁTICO',
    'POSTE'
];

interface PriceItem {
    id?: string;
    itemCode?: string;
    description: string;
    unit: string;
    price: number;
    category: string;
    company_id: string; // Needed for internal logic
}

interface QuickAddItem {
    tempId: string;
    itemCode: string;
    description: string;
    unit: string;
    price: string;
    category: string;
    saving?: boolean;
    saved?: boolean;
}

interface ImportPreviewItem {
    tempId: string;
    item: string;
    description: string;
    unit: string;
    price: number;
    category: string;
    selected: boolean;
}

export const MeasurementPriceManager: React.FC = () => {
    const [selectedCompany, setSelectedCompany] = useState<string>('gf1');
    const [selectedCategory, setSelectedCategory] = useState<string>('all');
    const [prices, setPrices] = useState<PriceItem[]>([]);
    const [loading, setLoading] = useState(false);
    const [editingItem, setEditingItem] = useState<PriceItem | null>(null);
    const [isModalOpen, setIsModalOpen] = useState(false);

    // Quick add mode
    const [isQuickAddMode, setIsQuickAddMode] = useState(false);
    const [quickAddItems, setQuickAddItems] = useState<QuickAddItem[]>([]);

    // Import spreadsheet mode
    const [isImportModalOpen, setIsImportModalOpen] = useState(false);
    const [importPreviewItems, setImportPreviewItems] = useState<ImportPreviewItem[]>([]);
    const [isImporting, setIsImporting] = useState(false);
    const [importError, setImportError] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Initial state for new item
    const emptyItem: PriceItem = {
        description: '',
        unit: 'UN',
        price: 0,
        category: CATEGORIES[0],
        company_id: selectedCompany
    };
    const [newItem, setNewItem] = useState<PriceItem>(emptyItem);

    // Generate a new quick add row
    const createQuickAddRow = (): QuickAddItem => ({
        tempId: Date.now().toString() + Math.random().toString(36).substr(2, 9),
        itemCode: '',
        description: '',
        unit: 'UN',
        price: '',
        category: selectedCategory !== 'all' ? selectedCategory : CATEGORIES[0]
    });

    // Toggle quick add mode
    const toggleQuickAddMode = () => {
        if (!isQuickAddMode) {
            setQuickAddItems([createQuickAddRow()]);
        } else {
            setQuickAddItems([]);
        }
        setIsQuickAddMode(!isQuickAddMode);
    };

    // Add another quick add row
    const addQuickAddRow = () => {
        setQuickAddItems([...quickAddItems, createQuickAddRow()]);
    };

    // Update a quick add row
    const updateQuickAddRow = (tempId: string, field: keyof QuickAddItem, value: string) => {
        setQuickAddItems(items =>
            items.map(item =>
                item.tempId === tempId ? { ...item, [field]: value } : item
            )
        );
    };

    // Remove a quick add row
    const removeQuickAddRow = (tempId: string) => {
        setQuickAddItems(items => items.filter(item => item.tempId !== tempId));
    };

    // Save a single quick add item
    const saveQuickAddItem = async (item: QuickAddItem) => {
        if (!item.description || !item.price) {
            alert('Preencha descrição e preço.');
            return;
        }

        setQuickAddItems(items =>
            items.map(i => i.tempId === item.tempId ? { ...i, saving: true } : i)
        );

        try {
            const payload = {
                company_id: selectedCompany,
                category: item.category,
                item_code: item.itemCode,
                description: item.description,
                unit: item.unit,
                price: parseFloat(item.price)
            };

            const { error } = await supabase
                .from('measurement_prices')
                .insert(payload);

            if (error) throw error;

            // Mark as saved and remove after animation
            setQuickAddItems(items =>
                items.map(i => i.tempId === item.tempId ? { ...i, saving: false, saved: true } : i)
            );

            setTimeout(() => {
                setQuickAddItems(items => items.filter(i => i.tempId !== item.tempId));
                // Add a new empty row if this was the last one
                setQuickAddItems(current => {
                    if (current.length === 0) {
                        return [createQuickAddRow()];
                    }
                    return current;
                });
            }, 500);

            loadPrices();
        } catch (error) {
            console.error('Error saving price:', error);
            alert('Erro ao salvar preço.');
            setQuickAddItems(items =>
                items.map(i => i.tempId === item.tempId ? { ...i, saving: false } : i)
            );
        }
    };

    // Save all quick add items
    const saveAllQuickAddItems = async () => {
        const validItems = quickAddItems.filter(item => item.description && item.price);
        if (validItems.length === 0) {
            alert('Nenhum item válido para salvar.');
            return;
        }

        for (const item of validItems) {
            await saveQuickAddItem(item);
        }
    };

    // Handle file selection for import
    const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setImportError(null);

        try {
            const data = await file.arrayBuffer();
            const workbook = XLSX.read(data, { type: 'array' });
            const sheetName = workbook.SheetNames[0];
            const worksheet = workbook.Sheets[sheetName];
            const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as any[][];

            const items = parseSpreadsheet(jsonData);

            if (items.length === 0) {
                setImportError('Nenhum item válido encontrado na planilha.');
                return;
            }

            setImportPreviewItems(items);
            setIsImportModalOpen(true);
        } catch (error) {
            console.error('Error reading file:', error);
            setImportError('Erro ao ler o arquivo. Verifique o formato.');
        }

        // Reset file input
        if (fileInputRef.current) {
            fileInputRef.current.value = '';
        }
    };

    // Parse spreadsheet data based on the layout
    const parseSpreadsheet = (data: any[][]): ImportPreviewItem[] => {
        const items: ImportPreviewItem[] = [];
        let currentCategory = '';

        // Find header row (contains ITEM, DESCRITIVO, etc.)
        let headerRowIndex = -1;
        for (let i = 0; i < Math.min(5, data.length); i++) {
            const row = data[i];
            if (row && row.some(cell => String(cell).toUpperCase().includes('DESCRITIVO'))) {
                headerRowIndex = i;
                break;
            }
        }

        // Process rows after header
        const startRow = headerRowIndex >= 0 ? headerRowIndex + 1 : 0;

        for (let i = startRow; i < data.length; i++) {
            const row = data[i];
            if (!row || row.length === 0) continue;

            const itemCode = String(row[0] || '').trim();
            const description = String(row[1] || '').trim();
            const unit = String(row[2] || 'UN').trim();
            // Skip QTD column (row[3])
            // CUSTO UNITÁRIO is usually at index 4
            const priceRaw = row[4];

            // Check if this is a category header (highlighted row with category name)
            // Categories usually don't have proper item codes (like 1.1, 2.3) or have just numbers
            const isCategory = (
                !itemCode.includes('.') &&
                description &&
                (!priceRaw || priceRaw === 0 || priceRaw === '')
            );

            if (isCategory) {
                // Try to match with known categories
                const upperDesc = description.toUpperCase();
                const matchedCategory = CATEGORIES.find(cat =>
                    upperDesc.includes(cat.toUpperCase()) ||
                    cat.toUpperCase().includes(upperDesc.replace('ABRIGO DE ÔNIBUS ', ''))
                );
                currentCategory = matchedCategory || description;
                continue;
            }

            // Parse price value
            let price = 0;
            if (priceRaw !== undefined && priceRaw !== null && priceRaw !== '') {
                if (typeof priceRaw === 'number') {
                    price = priceRaw;
                } else {
                    // Handle BR format: R$ 1.234,56
                    const cleaned = String(priceRaw)
                        .replace(/R\$\s*/g, '')
                        .replace(/\./g, '')
                        .replace(',', '.');
                    price = parseFloat(cleaned) || 0;
                }
            }

            // Skip rows without valid description or price
            if (!description || price <= 0) continue;

            items.push({
                tempId: `import-${i}-${Date.now()}`,
                item: itemCode,
                description,
                unit: unit || 'UN',
                price,
                category: currentCategory || CATEGORIES[0],
                selected: true
            });
        }

        return items;
    };

    // Toggle item selection in import preview
    const toggleImportItem = (tempId: string) => {
        setImportPreviewItems(items =>
            items.map(item =>
                item.tempId === tempId ? { ...item, selected: !item.selected } : item
            )
        );
    };

    // Toggle all items selection
    const toggleAllImportItems = (selected: boolean) => {
        setImportPreviewItems(items =>
            items.map(item => ({ ...item, selected }))
        );
    };

    // Import selected items
    const importSelectedItems = async () => {
        const selectedItems = importPreviewItems.filter(item => item.selected);
        if (selectedItems.length === 0) {
            alert('Selecione pelo menos um item para importar.');
            return;
        }

        setIsImporting(true);
        let successCount = 0;
        let errorCount = 0;
        let lastError = '';

        try {
            // Insert items one by one to handle potential RLS issues
            for (const item of selectedItems) {
                // Generate unique ID since table doesn't auto-generate
                const generatedId = `price_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

                const payload = {
                    id: generatedId,
                    company_id: selectedCompany,
                    category: item.category,
                    item_code: item.item,
                    description: item.description,
                    unit: item.unit,
                    price: item.price
                };

                const { error } = await supabase
                    .from('measurement_prices')
                    .insert(payload);

                if (error) {
                    console.error('Error inserting item:', item.description, error);
                    errorCount++;
                    lastError = error.message || JSON.stringify(error);
                } else {
                    successCount++;
                }
            }

            setIsImportModalOpen(false);
            setImportPreviewItems([]);
            loadPrices();

            if (errorCount === 0) {
                alert(`${successCount} itens importados com sucesso!`);
            } else if (successCount > 0) {
                alert(`${successCount} itens importados, ${errorCount} com erro.\nÚltimo erro: ${lastError}`);
            } else {
                alert(`Erro ao importar: ${lastError}`);
            }
        } catch (error: any) {
            console.error('Error importing prices:', error);
            alert(`Erro ao importar preços: ${error?.message || JSON.stringify(error)}`);
        } finally {
            setIsImporting(false);
        }
    };

    useEffect(() => {
        loadPrices();
    }, [selectedCompany]);

    const loadPrices = async () => {
        setLoading(true);
        const data = await getMeasurementPrices(selectedCompany);
        // Map API response to PriceItem (API returns fields as is)
        const mapped: PriceItem[] = data.map(d => ({
            id: d.id,
            itemCode: d.itemCode,
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
                item_code: item.itemCode,
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
                .eq('id', id)
                .eq('company_id', selectedCompany);

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
                        onClick={toggleQuickAddMode}
                        className={`flex items-center gap-2 px-6 py-3 rounded-2xl font-black uppercase text-xs tracking-widest transition-all ${isQuickAddMode
                            ? 'bg-amber-500 text-white shadow-lg shadow-amber-500/20 hover:bg-amber-600'
                            : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                            }`}
                    >
                        <Zap size={18} />
                        {isQuickAddMode ? 'Sair Modo Rápido' : 'Adição Rápida'}
                    </button>

                    {/* Import Spreadsheet Button */}
                    <label className="flex items-center gap-2 px-6 py-3 bg-emerald-500 text-white rounded-2xl font-black uppercase text-xs tracking-widest hover:bg-emerald-600 transition-all shadow-lg shadow-emerald-500/20 cursor-pointer">
                        <FileSpreadsheet size={18} />
                        Importar Planilha
                        <input
                            ref={fileInputRef}
                            type="file"
                            accept=".xlsx, .xls"
                            onChange={handleFileSelect}
                            className="hidden"
                        />
                    </label>

                    <button
                        onClick={openNew}
                        className="flex items-center gap-2 px-6 py-3 bg-primary text-white rounded-2xl font-black uppercase text-xs tracking-widest hover:bg-primary-600 transition-all shadow-lg shadow-primary/20"
                    >
                        <Plus size={18} />
                        Novo Preço
                    </button>
                </div>
            </div>

            {/* Import Error Message */}
            {importError && (
                <div className="bg-red-50 border border-red-200 rounded-2xl p-4 flex items-center gap-3 text-red-700">
                    <AlertCircle size={20} />
                    <span className="font-medium">{importError}</span>
                    <button onClick={() => setImportError(null)} className="ml-auto p-1 hover:bg-red-100 rounded-full">
                        <X size={16} />
                    </button>
                </div>
            )}

            {/* List */}
            <div className="bg-white rounded-[32px] border border-slate-100 shadow-sm overflow-hidden">
                <table className="w-full text-left border-collapse">
                    <thead>
                        <tr className="border-b border-slate-100 bg-slate-50/50">
                            <th className="p-6 text-[10px] font-black text-slate-400 uppercase tracking-widest">Categoria</th>
                            <th className="p-6 text-[10px] font-black text-slate-400 uppercase tracking-widest">Item</th>
                            <th className="p-6 text-[10px] font-black text-slate-400 uppercase tracking-widest">Descrição (Etapa)</th>
                            <th className="p-6 text-[10px] font-black text-slate-400 uppercase tracking-widest">Unidade</th>
                            <th className="p-6 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Preço</th>
                            <th className="p-6 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Ações</th>
                        </tr>
                    </thead>
                    <tbody>
                        {/* Quick Add Rows */}
                        {isQuickAddMode && quickAddItems.map((item) => (
                            <tr
                                key={item.tempId}
                                className={`border-b border-amber-100 transition-all duration-300 ${item.saved ? 'bg-green-50' : 'bg-amber-50/50'
                                    }`}
                            >
                                <td className="p-3">
                                    <select
                                        value={item.category}
                                        onChange={e => updateQuickAddRow(item.tempId, 'category', e.target.value)}
                                        className="w-full p-2 bg-white rounded-lg border border-amber-200 text-xs font-bold text-slate-700 focus:ring-2 focus:ring-amber-400 focus:border-transparent"
                                        disabled={item.saving || item.saved}
                                    >
                                        {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                                    </select>
                                </td>
                                <td className="p-3">
                                    <input
                                        type="text"
                                        value={item.itemCode}
                                        onChange={e => updateQuickAddRow(item.tempId, 'itemCode', e.target.value)}
                                        placeholder="Cód..."
                                        className="w-20 p-2 bg-white rounded-lg border border-amber-200 text-xs font-bold text-slate-700 focus:ring-2 focus:ring-amber-400 focus:border-transparent placeholder:text-slate-300"
                                        disabled={item.saving || item.saved}
                                    />
                                </td>
                                <td className="p-3">
                                    <input
                                        type="text"
                                        value={item.description}
                                        onChange={e => updateQuickAddRow(item.tempId, 'description', e.target.value)}
                                        placeholder="Descrição do item..."
                                        className="w-full p-2 bg-white rounded-lg border border-amber-200 text-sm font-bold text-slate-700 focus:ring-2 focus:ring-amber-400 focus:border-transparent placeholder:text-slate-300"
                                        disabled={item.saving || item.saved}
                                    />
                                </td>
                                <td className="p-3">
                                    <input
                                        type="text"
                                        value={item.unit}
                                        onChange={e => updateQuickAddRow(item.tempId, 'unit', e.target.value)}
                                        className="w-16 p-2 bg-white rounded-lg border border-amber-200 text-xs font-bold text-slate-700 focus:ring-2 focus:ring-amber-400 focus:border-transparent"
                                        disabled={item.saving || item.saved}
                                    />
                                </td>
                                <td className="p-3">
                                    <input
                                        type="number"
                                        step="0.01"
                                        value={item.price}
                                        onChange={e => updateQuickAddRow(item.tempId, 'price', e.target.value)}
                                        placeholder="0,00"
                                        className="w-28 p-2 bg-white rounded-lg border border-amber-200 text-sm font-bold text-slate-700 focus:ring-2 focus:ring-amber-400 focus:border-transparent text-right"
                                        disabled={item.saving || item.saved}
                                    />
                                </td>
                                <td className="p-3 text-right">
                                    <div className="flex justify-end gap-1">
                                        {item.saved ? (
                                            <span className="p-2 text-green-600">
                                                <Check size={16} />
                                            </span>
                                        ) : (
                                            <>
                                                <button
                                                    onClick={() => saveQuickAddItem(item)}
                                                    disabled={item.saving}
                                                    className="p-2 text-amber-600 hover:text-green-600 hover:bg-green-50 rounded-lg transition-colors disabled:opacity-50"
                                                >
                                                    {item.saving ? (
                                                        <div className="w-4 h-4 border-2 border-amber-400 border-t-transparent rounded-full animate-spin" />
                                                    ) : (
                                                        <Save size={16} />
                                                    )}
                                                </button>
                                                <button
                                                    onClick={() => removeQuickAddRow(item.tempId)}
                                                    disabled={item.saving}
                                                    className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50"
                                                >
                                                    <X size={16} />
                                                </button>
                                            </>
                                        )}
                                    </div>
                                </td>
                            </tr>
                        ))}

                        {/* Quick Add Actions Row */}
                        {isQuickAddMode && (
                            <tr className="bg-amber-50/30 border-b border-amber-100">
                                <td colSpan={5} className="p-3">
                                    <div className="flex items-center justify-between">
                                        <button
                                            onClick={addQuickAddRow}
                                            className="flex items-center gap-2 px-4 py-2 text-amber-600 hover:bg-amber-100 rounded-xl font-bold text-xs uppercase tracking-wide transition-colors"
                                        >
                                            <Plus size={16} />
                                            Adicionar Linha
                                        </button>
                                        <button
                                            onClick={saveAllQuickAddItems}
                                            className="flex items-center gap-2 px-4 py-2 bg-green-500 text-white rounded-xl font-bold text-xs uppercase tracking-wide hover:bg-green-600 transition-colors shadow-sm"
                                        >
                                            <Save size={16} />
                                            Salvar Todos
                                        </button>
                                    </div>
                                </td>
                            </tr>
                        )}

                        {loading ? (
                            <tr><td colSpan={5} className="p-8 text-center text-slate-400">Carregando...</td></tr>
                        ) : filteredPrices.length === 0 && !isQuickAddMode ? (
                            <tr><td colSpan={5} className="p-8 text-center text-slate-400">Nenhum preço encontrado.</td></tr>
                        ) : (
                            filteredPrices.map((item) => (
                                <tr key={item.id} className="border-b border-slate-50 hover:bg-slate-50/50 transition-colors">
                                    <td className="p-6 text-xs font-bold text-slate-500">{item.category}</td>
                                    <td className="p-6 text-xs font-black text-slate-900">{item.itemCode || '-'}</td>
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
                                <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-2">Item / Código</label>
                                <input
                                    type="text"
                                    value={newItem.itemCode}
                                    onChange={e => setNewItem({ ...newItem, itemCode: e.target.value })}
                                    placeholder="Ex: 1.1, 2.3..."
                                    className="w-full p-3 bg-slate-50 rounded-xl border-none font-bold text-slate-700 focus:ring-2 focus:ring-primary placeholder:text-slate-300"
                                />
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

            {/* Import Preview Modal */}
            {isImportModalOpen && (
                <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-[32px] w-full max-w-4xl shadow-2xl animate-in zoom-in-95 duration-200 max-h-[90vh] flex flex-col">
                        {/* Modal Header */}
                        <div className="p-6 border-b border-slate-100 flex justify-between items-center">
                            <div>
                                <h3 className="text-xl font-black text-slate-900 flex items-center gap-3">
                                    <FileSpreadsheet className="text-emerald-500" size={24} />
                                    Importar Planilha
                                </h3>
                                <p className="text-sm text-slate-400 font-medium mt-1">
                                    {importPreviewItems.filter(i => i.selected).length} de {importPreviewItems.length} itens selecionados • Empresa: {PARTNER_COMPANIES.find(c => c.id === selectedCompany)?.name}
                                </p>
                            </div>
                            <button
                                onClick={() => { setIsImportModalOpen(false); setImportPreviewItems([]); }}
                                className="p-2 hover:bg-slate-100 rounded-full text-slate-400 hover:text-slate-900"
                            >
                                <X size={20} />
                            </button>
                        </div>

                        {/* Selection Controls */}
                        <div className="px-6 py-3 bg-slate-50 border-b border-slate-100 flex items-center gap-4">
                            <label className="flex items-center gap-2 cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={importPreviewItems.every(i => i.selected)}
                                    onChange={e => toggleAllImportItems(e.target.checked)}
                                    className="w-4 h-4 rounded border-slate-300 text-emerald-500 focus:ring-emerald-500"
                                />
                                <span className="text-sm font-bold text-slate-600">Selecionar todos</span>
                            </label>
                        </div>

                        {/* Items Table */}
                        <div className="flex-1 overflow-auto">
                            <table className="w-full text-left border-collapse">
                                <thead className="sticky top-0 bg-white">
                                    <tr className="border-b border-slate-100">
                                        <th className="p-4 text-[10px] font-black text-slate-400 uppercase tracking-widest w-12"></th>
                                        <th className="p-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Item</th>
                                        <th className="p-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Categoria</th>
                                        <th className="p-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Descrição</th>
                                        <th className="p-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Unidade</th>
                                        <th className="p-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Preço</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {importPreviewItems.map((item) => (
                                        <tr
                                            key={item.tempId}
                                            className={`border-b border-slate-50 hover:bg-slate-50/50 transition-colors cursor-pointer ${!item.selected ? 'opacity-40' : ''}`}
                                            onClick={() => toggleImportItem(item.tempId)}
                                        >
                                            <td className="p-4" onClick={e => e.stopPropagation()}>
                                                <input
                                                    type="checkbox"
                                                    checked={item.selected}
                                                    onChange={() => toggleImportItem(item.tempId)}
                                                    className="w-4 h-4 rounded border-slate-300 text-emerald-500 focus:ring-emerald-500"
                                                />
                                            </td>
                                            <td className="p-4 text-xs font-medium text-slate-400">{item.item}</td>
                                            <td className="p-4 text-xs font-bold text-slate-500">{item.category}</td>
                                            <td className="p-4 text-sm font-bold text-slate-900">{item.description}</td>
                                            <td className="p-4 text-xs text-slate-500 font-medium">{item.unit}</td>
                                            <td className="p-4 text-sm font-black text-emerald-600 text-right">
                                                {item.price.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>

                        {/* Modal Footer */}
                        <div className="p-6 border-t border-slate-100 flex justify-between items-center">
                            <button
                                onClick={() => { setIsImportModalOpen(false); setImportPreviewItems([]); }}
                                className="px-6 py-3 text-slate-600 font-bold rounded-2xl hover:bg-slate-100 transition-colors"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={importSelectedItems}
                                disabled={isImporting || importPreviewItems.filter(i => i.selected).length === 0}
                                className="flex items-center gap-2 px-6 py-3 bg-emerald-500 text-white rounded-2xl font-black uppercase text-xs tracking-widest hover:bg-emerald-600 transition-all shadow-lg shadow-emerald-500/20 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {isImporting ? (
                                    <>
                                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                        Importando...
                                    </>
                                ) : (
                                    <>
                                        <Upload size={18} />
                                        Importar {importPreviewItems.filter(i => i.selected).length} Itens
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
