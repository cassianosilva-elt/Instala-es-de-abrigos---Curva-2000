
import React, { useState, useMemo, useEffect } from 'react';
import { Asset, User, TaskEvidence, AssetMeasurement, UserRole, Task, TaskStatus } from '../types';
import { getAssets, getEvidenceByAssetId, getMeasurementPrices, saveAssetMeasurement, updateAssetMeasurement, getTasksByCompanyId, upsertAsset } from '../api/fieldManagerApi';
import { Search, Building2, CheckCircle2, ChevronDown, Download, Plus, Trash2, Calculator, Save, Image as ImageIcon, X, Upload, Check, ChevronRight, ChevronLeft, LayoutDashboard, DollarSign, ListTodo, MapPin, Calendar, AlertCircle, Clock } from 'lucide-react';

import { createEletromidiaWorkbook, styleHeaderRow, styleDataRows, autoFitColumns, saveWorkbook } from '../utils/excelExport';
import { MeasurementAdminView } from './MeasurementAdminView';
import { MeasurementPriceManager } from './MeasurementPriceManager';

const ASSET_TYPES = [
    { id: 'totem', label: 'Totem', category: 'TOTEM' },
    { id: 'abrigo_caos_leve', label: 'Caos Leve', category: 'ABRIGO DE ÔNIBUS CAOS LEVE' },
    { id: 'abrigo_caos_top', label: 'Caos Top', category: 'ABRIGO DE ÔNIBUS CAOS TOP' },
    { id: 'abrigo_minimalista_leve', label: 'Minimalista Leve', category: 'ABRIGO DE ÔNIBUS MINIMALISTA LEVE' },
    { id: 'abrigo_minimalista_top', label: 'Minimalista Top', category: 'ABRIGO DE ÔNIBUS MINIMALISTA TOP' },
    { id: 'abrigo_brutalista_leve', label: 'Brutalista Leve', category: 'ABRIGO DE ÔNIBUS BRUTALISTA LEVE' },
    { id: 'abrigo_brutalista_top', label: 'Brutalista Top', category: 'ABRIGO DE ÔNIBUS BRUTALISTA TOP' },
    { id: 'painel_digital', label: 'Painel Digital', category: 'INSTALAÇÃO PAINEL DIGITAL' },
    { id: 'painel_estatico', label: 'Painel Estático', category: 'PAINEL ESTÁTICO' },
    { id: 'poste', label: 'Poste', category: 'POSTE' }
];

const getIconForDescription = (description: string) => {
    const lower = description.toLowerCase();
    if (lower.includes('fundação') || lower.includes('civil')) return <Building2 size={16} />;
    if (lower.includes('implantação') || lower.includes('instalação')) return <Plus size={16} />;
    if (lower.includes('montagem') || lower.includes('recomposição')) return <Calculator size={16} />;
    if (lower.includes('elétrica') || lower.includes('energização')) return <Check size={16} />;
    if (lower.includes('supressão') || lower.includes('retirada')) return <Trash2 size={16} />;
    if (lower.includes('visita')) return <Search size={16} />;
    return <ListTodo size={16} />;
};

const getStatusColor = (status: TaskStatus) => {
    switch (status) {
        case TaskStatus.COMPLETED: return 'bg-green-100 text-green-700 border-green-200';
        case TaskStatus.IN_PROGRESS: return 'bg-blue-100 text-blue-700 border-blue-200';
        case TaskStatus.PENDING: return 'bg-amber-100 text-amber-700 border-amber-200';
        case TaskStatus.BLOCKED: return 'bg-red-100 text-red-700 border-red-200';
        default: return 'bg-slate-100 text-slate-700 border-slate-200';
    }
};

const getStatusLabel = (status: TaskStatus) => {
    switch (status) {
        case TaskStatus.COMPLETED: return 'Concluída';
        case TaskStatus.IN_PROGRESS: return 'Em Andamento';
        case TaskStatus.PENDING: return 'Pendente';
        case TaskStatus.BLOCKED: return 'Bloqueada';
        case TaskStatus.NOT_PERFORMED: return 'Não Realizada';
        default: return status;
    }
};

export const MeasurementView: React.FC<{ currentUser: User }> = ({ currentUser }) => {
    // Admin Tabs State
    const [adminTab, setAdminTab] = useState<'new' | 'dashboard' | 'prices'>('new');
    const isInternalAdmin = currentUser.role === UserRole.CHEFE || currentUser.role === UserRole.LIDER; // CHEFE and LIDER are admins

    // --------------------------------------------------------------------------
    // Existing "New Measurement" Logic (Preserved)
    // --------------------------------------------------------------------------
    const [assets, setAssets] = useState<Asset[]>([]);
    const [companyTasks, setCompanyTasks] = useState<Task[]>([]);
    const [selectedCompany, setSelectedCompany] = useState<string>('gf1');
    const [currentPriceList, setCurrentPriceList] = useState<any[]>([]);

    // Wizard State
    const [currentStep, setCurrentStep] = useState(1);
    const [selectedAsset, setSelectedAsset] = useState<Asset | null>(null);
    const [selectedTask, setSelectedTask] = useState<Task | null>(null);
    const [selectedAssetType, setSelectedAssetType] = useState<string | null>(null);
    const [selectedStages, setSelectedStages] = useState<Record<string, number>>({}); // Stores IDs mapped to quantity
    const [assetEvidences, setAssetEvidences] = useState<Record<string, TaskEvidence[]>>({});

    const [searchQuery, setSearchQuery] = useState('');
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [saveSuccess, setSaveSuccess] = useState(false);

    // Edit State
    const [editingMeasurement, setEditingMeasurement] = useState<AssetMeasurement | null>(null);

    useEffect(() => {
        loadAssets();
    }, []);

    useEffect(() => {
        const userCid = currentUser.companyId?.toLowerCase();
        if (userCid && userCid !== 'internal' && selectedCompany !== userCid) {
            setSelectedCompany(userCid);
        }
        loadPrices();
        loadCompanyTasks();
    }, [selectedCompany, currentUser.companyId]);

    const loadAssets = async () => {
        setLoading(true);
        const data = await getAssets();
        setAssets(data);
        setLoading(false);
    };

    const loadCompanyTasks = async () => {
        setLoading(true);
        const tasks = await getTasksByCompanyId(selectedCompany);
        setCompanyTasks(tasks);
        setLoading(false);
    };

    const loadPrices = async () => {
        const prices = await getMeasurementPrices(selectedCompany);
        setCurrentPriceList(prices);
    };

    const fetchEvidence = async (assetId: string) => {
        if (!assetEvidences[assetId]) {
            const evidences = await getEvidenceByAssetId(assetId);
            setAssetEvidences(prev => ({ ...prev, [assetId]: evidences }));
        }
    };

    const companies = useMemo(() => {
        const all = [
            { id: 'gf1', name: 'GF1' },
            { id: 'alvares', name: 'Alvares' },
            { id: 'bassi', name: 'Bassi' },
            { id: 'afn_nogueira', name: 'AFN Nogueira' }
        ];
        const userCid = currentUser.companyId?.toLowerCase();
        if (userCid && userCid !== 'internal') {
            return all.filter(c => c.id === userCid);
        }
        return all;
    }, [currentUser.companyId]);

    // Filter Tasks instead of assets
    const filteredTasks = companyTasks.filter(t =>
        t.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
        t.asset?.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
        t.asset?.location.address.toLowerCase().includes(searchQuery.toLowerCase()) ||
        t.id.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const handleSelectTask = (task: Task) => {
        if (!task.asset) {
            alert("Esta atividade não tem um ativo vinculado.");
            return;
        }
        setSelectedTask(task);
        setSelectedAsset(task.asset);
        fetchEvidence(task.assetId);
        setCurrentStep(1);
    };

    const handleSelectAsset = (asset: Asset) => {
        setEditingMeasurement(null);
        setSelectedAsset(asset);
        setSelectedTask(null); // Manual asset selection clears task context
        fetchEvidence(asset.id);
        setCurrentStep(1);
    };

    const handleEditMeasurement = (m: AssetMeasurement) => {
        setEditingMeasurement(m);

        // Fix: Use the company from the measurement to load the correct price list
        if (m.companyId !== selectedCompany) {
            setSelectedCompany(m.companyId);
        }

        setSelectedAsset({
            id: m.assetId,
            code: m.assetCode || '',
            type: m.assetType as any,
            location: { address: m.assetAddress || '', lat: 0, lng: 0 }, // Minimal for UI
            city: ''
        });

        // Fix: Better matching for asset type (case insensitive and check both ID and Category)
        const matchedType = ASSET_TYPES.find(t =>
            t.category.toUpperCase() === m.assetType.toUpperCase() ||
            t.id === m.assetType
        );
        setSelectedAssetType(matchedType ? matchedType.id : m.assetType);

        // Fix: Fetch evidence to show photo
        fetchEvidence(m.assetId);

        const initialStages: Record<string, number> = {};
        if (m.itemsSnapshot && m.itemsSnapshot.length > 0) {
            m.itemsSnapshot.forEach(item => {
                initialStages[item.stage] = item.quantity;
            });
        } else {
            m.stages.forEach(s => {
                initialStages[s] = 1;
            });
        }
        setSelectedStages(initialStages);
        setAdminTab('new');
        setCurrentStep(2); // Jump to stages
    };

    const toggleStage = (stageId: string) => {
        // If editing, don't allow unchecking stages that were already in the original measurement
        if (editingMeasurement) {
            const isOriginal = editingMeasurement.itemsSnapshot
                ? editingMeasurement.itemsSnapshot.some(item => item.stage === stageId)
                : editingMeasurement.stages.includes(stageId);

            if (isOriginal) {
                alert("Não é possível desabilitar atividades que já foram marcadas na medição original.");
                return;
            }
        }

        setSelectedStages(prev => {
            const next = { ...prev };
            if (next[stageId]) {
                delete next[stageId];
            } else {
                next[stageId] = 1;
            }
            return next;
        });
    };

    const updateStageQuantity = (stageId: string, quantity: number) => {
        if (quantity < 1) return;
        setSelectedStages(prev => ({
            ...prev,
            [stageId]: quantity
        }));
    };

    const calculateTotal = () => {
        return Object.entries(selectedStages).reduce((acc, [stageId, quantity]) => {
            const priceItem = currentPriceList.find(i => i.id === stageId);
            return acc + ((priceItem?.price || 0) * Number(quantity));
        }, 0);
    };

    const calculateOriginalTotal = () => {
        if (!editingMeasurement) return 0;
        return editingMeasurement.totalValue;
    };

    const calculateAdditionalValue = () => {
        if (!editingMeasurement) return 0;
        return calculateTotal() - calculateOriginalTotal();
    };

    const exportToExcel = async () => {
        if (!selectedAsset || !selectedAssetType) return;

        const { workbook, worksheet, startRow } = await createEletromidiaWorkbook(
            `Medição de Ativo - ${selectedAsset.code}`,
            'Medição'
        );

        const headers = [
            'Empresa', 'Código Ativo', 'Endereço', 'Cidade',
            'Tipo de Ativo', 'Etapa', 'Descrição', 'Unidade',
            'Valor Unitário', 'Total'
        ];
        const headerRow = worksheet.getRow(startRow);
        headerRow.values = headers;
        styleHeaderRow(headerRow);

        const typeInfo = ASSET_TYPES.find(t => t.id === selectedAssetType);

        Object.entries(selectedStages).forEach(([sid, quantity]) => {
            const priceItem = currentPriceList.find(i => i.id === sid);
            const qty = Number(quantity);

            worksheet.addRow([
                companies.find(c => c.id === selectedCompany)?.name,
                selectedAsset.code,
                selectedAsset.location.address,
                selectedAsset.city,
                typeInfo?.label,
                priceItem?.itemCode || priceItem?.description, // Use code if available, else description
                priceItem?.description,
                priceItem?.unit || 'UN',
                priceItem?.price || 0,
                (priceItem?.price || 0) * qty
            ]);
        });

        const totalRow = worksheet.addRow(['', '', '', '', '', '', '', '', 'TOTAL', calculateTotal()]);
        totalRow.font = { bold: true };
        totalRow.getCell(10).numFmt = '"R$ "#,##0.00';

        styleDataRows(worksheet, startRow);
        autoFitColumns(worksheet);

        const fileName = `Medicao_${selectedAsset.code}_${new Date().toISOString().split('T')[0]}`;
        await saveWorkbook(workbook, fileName);
    };

    const handleSave = async () => {
        if (!selectedAsset || !selectedAssetType) return;

        if (editingMeasurement && (editingMeasurement.editCount || 0) >= 4) {
            alert("Limite máximo de 4 edições atingido para esta medição.");
            return;
        }

        setSaving(true);
        try {
            const typeInfo = ASSET_TYPES.find(t => t.id === selectedAssetType);

            const itemsSnapshot = Object.entries(selectedStages).map(([sid, quantity]) => {
                const priceItem = currentPriceList.find(i => i.id === sid);
                const qty = Number(quantity);
                return {
                    stage: sid, // ID of the price item
                    itemCode: priceItem?.itemCode,
                    description: priceItem?.description || '',
                    price: priceItem?.price || 0,
                    unit: priceItem?.unit || 'UN',
                    quantity: qty
                };
            });

            // Ensure asset exists in DB to prevent FK error. Use returned ID in case it was generated.
            const verifiedAssetId = await upsertAsset(selectedAsset);

            if (editingMeasurement && editingMeasurement.id) {
                await updateAssetMeasurement(editingMeasurement.id, {
                    stages: Object.keys(selectedStages),
                    totalValue: calculateTotal(),
                    itemsSnapshot: itemsSnapshot,
                    editCount: (editingMeasurement.editCount || 0) + 1
                });
            } else {
                await saveAssetMeasurement({
                    assetId: verifiedAssetId,
                    technicianId: currentUser.id,
                    companyId: selectedCompany,
                    assetType: typeInfo?.category || selectedAssetType,
                    stages: Object.keys(selectedStages),
                    totalValue: calculateTotal(),
                    itemsSnapshot: itemsSnapshot,
                    editCount: 0,
                    isPaid: false
                });
            }
            setSaveSuccess(true);
            setTimeout(() => {
                setSaveSuccess(false);
                setSelectedAsset(null);
                setSelectedTask(null);
                setSelectedAssetType(null);
                setSelectedStages({});
                setEditingMeasurement(null);
                setCurrentStep(1);
            }, 3000);
        } catch (error: any) {
            console.error('Error saving measurement:', error);
            alert(`Erro ao salvar medição: ${error.message || 'Erro desconhecido'}`);
        } finally {
            setSaving(false);
        }
    };

    const renderAssetPhoto = () => {
        if (!selectedAsset) return null;
        const evidences = assetEvidences[selectedAsset.id] || [];
        const mainPhoto = evidences.find(ev => ev.stage === 'AFTER' || ev.stage === 'DURING' || ev.stage === 'BEFORE')?.photoUrl;

        return (
            <div className="w-full h-48 md:h-64 bg-slate-100 rounded-3xl overflow-hidden relative">
                {mainPhoto ? (
                    <img src={mainPhoto} alt="Asset" className="w-full h-full object-cover" />
                ) : (
                    <div className="w-full h-full flex flex-col items-center justify-center text-slate-400 gap-2">
                        <ImageIcon size={48} />
                        <span className="text-xs font-bold uppercase">Sem fotos registradas</span>
                    </div>
                )}
                <div className="absolute top-4 left-4 bg-white/90 backdrop-blur px-4 py-2 rounded-xl shadow-sm border border-white">
                    <p className="text-[10px] font-black text-slate-400 uppercase leading-none mb-1">Ponto Selecionado</p>
                    <p className="text-sm font-black text-slate-900 uppercase">{selectedAsset.code}</p>
                </div>
            </div>
        );
    };

    const renderNewMeasurementContent = () => (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Search Sidebar */}
            <div className="lg:col-span-4 flex flex-col gap-4">
                <div className="bg-white p-6 rounded-[32px] border border-slate-100 shadow-sm max-h-[800px] flex flex-col">
                    <h3 className="text-xs font-black text-primary uppercase tracking-[0.2em] mb-4">Atividades da Empresa</h3>
                    <div className="relative mb-4">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                        <input
                            type="text"
                            placeholder="Buscar por ID ou Endereço..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full pl-12 pr-4 py-4 bg-slate-50 border-none rounded-2xl text-sm focus:ring-2 focus:ring-primary/20"
                        />
                    </div>
                    <div className="flex flex-col gap-2 overflow-y-auto pr-2 custom-scrollbar">
                        {loading && (
                            <div className="p-8 text-center text-slate-400">
                                <div className="animate-spin w-6 h-6 border-2 border-primary border-t-transparent rounded-full mx-auto mb-2" />
                                <span className="text-xs">Carregando atividades...</span>
                            </div>
                        )}
                        {!loading && filteredTasks.length === 0 && (
                            <div className="p-8 text-center text-slate-400 bg-slate-50 rounded-2xl">
                                <ListTodo size={32} className="mx-auto mb-2 opacity-50" />
                                <span className="text-xs font-bold">Nenhuma atividade encontrada</span>
                            </div>
                        )}
                        {filteredTasks.map(task => (
                            <button
                                key={task.id}
                                onClick={() => handleSelectTask(task)}
                                className={`flex flex-col gap-2 p-4 rounded-2xl transition-all text-left border ${selectedTask?.id === task.id
                                    ? 'bg-primary text-white shadow-lg border-primary'
                                    : 'bg-white hover:bg-slate-50 border-slate-100'
                                    }`}
                            >
                                <div className="flex items-center justify-between w-full">
                                    <span className={`text-[10px] font-black uppercase tracking-wider px-2 py-1 rounded-lg border ${selectedTask?.id === task.id
                                        ? 'bg-white/20 text-white border-white/20'
                                        : getStatusColor(task.status)
                                        }`}>
                                        {getStatusLabel(task.status)}
                                    </span>
                                    <span className={`text-[10px] font-bold ${selectedTask?.id === task.id ? 'text-white/70' : 'text-slate-400'}`}>
                                        {task.scheduledDate ? new Date(task.scheduledDate).toLocaleDateString('pt-BR') : 'S/ Data'}
                                    </span>
                                </div>

                                <div>
                                    <div className="flex items-center gap-2 mb-1">
                                        <p className={`font-black text-sm uppercase truncate ${selectedTask?.id === task.id ? 'text-white' : 'text-slate-900'}`}>
                                            {task.serviceType}
                                        </p>
                                        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${selectedTask?.id === task.id ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-500'}`}>
                                            #{task.asset?.code || '?'}
                                        </span>
                                    </div>

                                    <div className="flex items-start gap-1.5">
                                        <MapPin size={12} className={`mt-0.5 ${selectedTask?.id === task.id ? 'text-white/70' : 'text-slate-400'}`} />
                                        <p className={`text-[10px] font-medium leading-relaxed line-clamp-2 ${selectedTask?.id === task.id ? 'text-white/70' : 'text-slate-500'}`}>
                                            {task.asset?.location.address || 'Sem endereço'}
                                        </p>
                                    </div>
                                </div>
                            </button>
                        ))}
                    </div>
                </div>

                {selectedAsset && (
                    <div className="bg-primary p-6 md:p-8 rounded-[32px] shadow-2xl shadow-primary/30 text-white flex flex-col gap-2">
                        <p className="text-[10px] font-black uppercase tracking-[0.22em] opacity-80">Total Calculado</p>
                        <div className="flex flex-col gap-1">
                            <p className="text-3xl md:text-4xl font-black tracking-tighter">
                                {calculateTotal().toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                            </p>
                            {editingMeasurement && (
                                <div className="mt-2 pt-3 border-t border-white/20 flex flex-col gap-1">
                                    <div className="flex justify-between items-center opacity-80 text-[10px] font-black uppercase tracking-wider">
                                        <span>Valor Original:</span>
                                        <span>{calculateOriginalTotal().toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
                                    </div>
                                    <div className="flex justify-between items-center text-green-300 font-black text-xs uppercase tracking-wider">
                                        <span>Adicional (Novo):</span>
                                        <span>+ {calculateAdditionalValue().toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
                                    </div>
                                </div>
                            )}
                        </div>
                        <div className="mt-4 flex gap-2">
                            {Object.entries(selectedStages).map(([sId, qty]) => {
                                const item = currentPriceList.find(i => i.id === sId);
                                if (!item) return null;
                                return (
                                    <div key={sId} className="p-2 bg-white/10 rounded-lg relative" title={`${qty}x ${item.description}`}>
                                        {getIconForDescription(item.description)}
                                        {Number(qty) > 1 && (
                                            <span className="absolute -top-1 -right-1 bg-white text-primary text-[8px] font-black w-3.5 h-3.5 rounded-full flex items-center justify-center">
                                                {qty}
                                            </span>
                                        )}
                                    </div>
                                )
                            })}
                        </div>
                    </div>
                )}
            </div>

            {/* Wizard Area */}
            <div className="lg:col-span-8">
                {!selectedAsset ? (
                    <div className="bg-white border-2 border-dashed border-slate-100 rounded-[32px] p-20 flex flex-col items-center justify-center text-center gap-4 h-full">
                        <div className="p-6 bg-slate-50 text-slate-300 rounded-[32px]">
                            <Calculator size={48} />
                        </div>
                        <div>
                            <h3 className="text-lg font-black text-slate-900 uppercase">Selecione um ponto</h3>
                            <p className="text-sm text-slate-400 max-w-xs">Escolha um abrigo ou totem no buscador para iniciar a medição</p>
                        </div>
                    </div>
                ) : (
                    <div className="bg-white rounded-[32px] border border-slate-100 shadow-sm overflow-hidden flex flex-col min-h-[600px]">
                        {/* Wizard Progress bar */}
                        <div className="px-8 pt-8 flex items-center justify-between mb-8">
                            {[1, 2, 3].map(step => (
                                <div key={step} className="flex items-center flex-1 last:flex-none">
                                    <div className={`w-10 h-10 rounded-2xl flex items-center justify-center text-sm font-black transition-all ${currentStep === step ? 'bg-primary text-white shadow-lg' :
                                        currentStep > step ? 'bg-green-500 text-white' : 'bg-slate-100 text-slate-400'
                                        }`}>
                                        {currentStep > step ? <Check size={20} /> : step}
                                    </div>
                                    {step < 3 && <div className={`h-1 flex-1 mx-4 rounded-full transition-all ${currentStep > step ? 'bg-green-500' : 'bg-slate-100'}`} />}
                                </div>
                            ))}
                        </div>

                        <div className="px-8 pb-8 flex-1 flex flex-col">
                            {currentStep === 1 && (
                                <div className="flex flex-col gap-6 animate-in slide-in-from-right duration-300">
                                    <h4 className="text-xl font-black text-slate-900 uppercase">Qual o tipo de Ativo?</h4>
                                    {renderAssetPhoto()}
                                    <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                                        {ASSET_TYPES.map(type => (
                                            <button
                                                key={type.id}
                                                onClick={() => {
                                                    setSelectedAssetType(type.id);
                                                    setSelectedStages([]); // Clear stages when type changes
                                                }}
                                                className={`p-4 rounded-2xl border-2 text-left transition-all ${selectedAssetType === type.id
                                                    ? 'border-primary bg-primary/5 text-primary shadow-sm'
                                                    : 'border-slate-50 hover:border-slate-200 text-slate-600'
                                                    }`}
                                            >
                                                <p className="text-[10px] font-black uppercase tracking-widest">{type.label}</p>
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {currentStep === 2 && (
                                <div className="flex flex-col gap-6 animate-in slide-in-from-right duration-300">
                                    <h4 className="text-xl font-black text-slate-900 uppercase">Etapas Realizadas</h4>
                                    {renderAssetPhoto()}
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        {currentPriceList
                                            .filter(item => {
                                                const typeInfo = ASSET_TYPES.find(t => t.id === selectedAssetType);
                                                if (!typeInfo) return false;

                                                // Always show items matching the exact category
                                                if (item.category === typeInfo.category) return true;

                                                // Special Rule: All Shelters (Abrigos) also include Totem items
                                                if (selectedAssetType?.startsWith('abrigo') && item.category === 'TOTEM') return true;

                                                // Special Rule: Shared Panel Items
                                                if ((selectedAssetType === 'painel_digital' || selectedAssetType === 'painel_estatico') &&
                                                    item.category === 'PAINEL DIGITAL/ESTÁTICO') {
                                                    return true;
                                                }

                                                return false;
                                            })
                                            .map(item => (
                                                <div key={item.id} className="flex flex-col gap-2">
                                                    <button
                                                        onClick={() => toggleStage(item.id)}
                                                        className={`flex items-center gap-4 p-6 rounded-3xl border-2 transition-all ${selectedStages[item.id]
                                                            ? 'border-primary bg-primary/5'
                                                            : 'border-slate-50 hover:border-slate-200'
                                                            }`}
                                                    >
                                                        <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${selectedStages[item.id] ? 'bg-primary text-white' : 'bg-slate-100 text-slate-400'
                                                            }`}>
                                                            {getIconForDescription(item.description)}
                                                        </div>
                                                        <div className="flex-1 text-left">
                                                            <p className="text-sm font-black text-slate-900 uppercase">{item.description}</p>
                                                            <p className="text-[10px] text-slate-400 font-bold uppercase">{item.unit || 'Medição Técnica'}</p>
                                                        </div>
                                                        <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all ${selectedStages[item.id] ? 'bg-primary border-primary' : 'border-slate-200'
                                                            }`}>
                                                            {selectedStages[item.id] && <Check size={14} className="text-white" />}
                                                        </div>
                                                    </button>

                                                    {selectedStages[item.id] && (
                                                        <div className="flex items-center gap-3 px-6 py-3 bg-white border border-slate-100 rounded-2xl self-end mr-4 -mt-6 z-10 shadow-sm animate-in slide-in-from-top-2 duration-200">
                                                            <button
                                                                onClick={() => updateStageQuantity(item.id, selectedStages[item.id] - 1)}
                                                                className="w-8 h-8 flex items-center justify-center bg-slate-50 rounded-lg hover:bg-slate-100 text-slate-500 transition-colors"
                                                            >
                                                                <Trash2 size={14} />
                                                            </button>
                                                            <span className="text-sm font-black text-primary min-w-[20px] text-center">
                                                                {selectedStages[item.id]}
                                                            </span>
                                                            <button
                                                                onClick={() => updateStageQuantity(item.id, selectedStages[item.id] + 1)}
                                                                className="w-8 h-8 flex items-center justify-center bg-primary text-white rounded-lg hover:bg-primary-600 transition-colors"
                                                            >
                                                                <Plus size={14} />
                                                            </button>
                                                        </div>
                                                    )}
                                                </div>
                                            ))}
                                        {currentPriceList.filter(item => {
                                            const typeInfo = ASSET_TYPES.find(t => t.id === selectedAssetType);
                                            if (!typeInfo) return false;
                                            if (item.category === typeInfo.category) return true;
                                            if (selectedAssetType?.startsWith('abrigo') && item.category === 'TOTEM') return true;
                                            if ((selectedAssetType === 'painel_digital' || selectedAssetType === 'painel_estatico') &&
                                                item.category === 'PAINEL DIGITAL/ESTÁTICO') return true;
                                            return false;
                                        }).length === 0 && (
                                                <div className="col-span-full p-8 text-center bg-slate-50 rounded-3xl text-slate-400">
                                                    Nenhuma atividade encontrada para este tipo de ativo.
                                                </div>
                                            )}
                                    </div>
                                </div>
                            )}

                            {currentStep === 3 && (
                                <div className="flex flex-col gap-6 animate-in slide-in-from-right duration-300">
                                    <h4 className="text-xl font-black text-slate-900 uppercase">Resumo e Finalização</h4>
                                    <div className="bg-slate-50 rounded-3xl p-8 flex flex-col gap-6">
                                        <div className="flex justify-between items-start">
                                            <div>
                                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Ativo Selecionado</p>
                                                <p className="text-lg font-black text-slate-900 uppercase">{selectedAsset.code}</p>
                                                <p className="text-xs text-slate-400">{selectedAsset.location.address}</p>
                                            </div>
                                            <div className="text-right">
                                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Tipo Identificado</p>
                                                <p className="text-lg font-black text-primary uppercase">
                                                    {ASSET_TYPES.find(t => t.id === selectedAssetType)?.label || 'Não definido'}
                                                </p>
                                            </div>
                                        </div>

                                        <div className="h-px bg-slate-200" />

                                        <div>
                                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">Detalhamento das Etapas</p>
                                            <div className="flex flex-col gap-2">
                                                {Object.entries(selectedStages).map(([sid, quantity]) => {
                                                    const priceItem = currentPriceList.find(i => i.id === sid);
                                                    const unitPrice = priceItem?.price || 0;
                                                    const qty = Number(quantity);
                                                    const totalPrice = unitPrice * qty;

                                                    return (
                                                        <div key={sid} className="flex justify-between items-center text-sm">
                                                            <div className="flex items-center gap-2">
                                                                <div className="w-2 h-2 rounded-full bg-green-500" />
                                                                <span className="font-bold text-slate-700 uppercase">
                                                                    {qty > 1 ? `${qty}x ` : ''}{priceItem?.description}
                                                                </span>
                                                            </div>
                                                            <span className="font-black text-slate-900">
                                                                {totalPrice.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                                                            </span>
                                                        </div>
                                                    );
                                                })}
                                                {Object.keys(selectedStages).length === 0 && (
                                                    <p className="text-xs text-red-500 font-bold uppercase">Nenhuma etapa selecionada</p>
                                                )}
                                            </div>
                                        </div>

                                        <div className="h-px bg-slate-200" />

                                        <div className="flex flex-col gap-4 bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
                                            {editingMeasurement && (
                                                <div className="flex flex-col gap-2 pb-4 border-b border-slate-50">
                                                    <div className="flex justify-between items-center text-sm">
                                                        <span className="font-bold text-slate-400 uppercase tracking-widest">Valor da 1ª Medição</span>
                                                        <span className="font-black text-slate-400">
                                                            {calculateOriginalTotal().toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                                                        </span>
                                                    </div>
                                                    <div className="flex justify-between items-center text-sm">
                                                        <span className="font-bold text-green-600 uppercase tracking-widest">Atividades Novas</span>
                                                        <span className="font-black text-green-600">
                                                            + {calculateAdditionalValue().toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                                                        </span>
                                                    </div>
                                                </div>
                                            )}

                                            <div className="flex justify-between items-center">
                                                <span className="text-sm font-black text-slate-400 uppercase tracking-widest">
                                                    {editingMeasurement ? 'Valor Total Atualizado' : 'Valor Final'}
                                                </span>
                                                <span className="text-2xl font-black text-primary">
                                                    {calculateTotal().toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}

                            <div className="mt-12 flex items-center justify-between">
                                <button
                                    onClick={() => setCurrentStep(prev => Math.max(1, prev - 1))}
                                    disabled={currentStep === 1 || saving}
                                    className="flex items-center gap-2 px-8 py-4 text-slate-400 font-black uppercase tracking-widest hover:text-primary transition-all disabled:opacity-30"
                                >
                                    <ChevronLeft size={20} />
                                    Anterior
                                </button>

                                {currentStep < 3 ? (
                                    <button
                                        onClick={() => setCurrentStep(prev => prev + 1)}
                                        disabled={currentStep === 1 && !selectedAssetType}
                                        className="flex items-center gap-2 px-10 py-5 bg-primary text-white rounded-2xl font-black uppercase tracking-widest shadow-xl shadow-primary/20 hover:scale-105 transition-all disabled:opacity-50 disabled:scale-100"
                                    >
                                        Próximo Passo
                                        <ChevronRight size={20} />
                                    </button>
                                ) : (
                                    <div className="flex gap-4">
                                        <button
                                            onClick={exportToExcel}
                                            className="flex items-center gap-3 px-8 py-5 bg-secondary text-primary rounded-2xl font-black uppercase tracking-widest hover:scale-105 transition-all"
                                        >
                                            <Download size={22} />
                                            Planilha
                                        </button>
                                        <button
                                            onClick={handleSave}
                                            disabled={saving || saveSuccess || Object.keys(selectedStages).length === 0}
                                            className={`flex items-center gap-3 px-10 py-5 rounded-2xl font-black uppercase tracking-widest shadow-xl transition-all ${saveSuccess ? 'bg-green-500 text-white shadow-green-200' : 'bg-primary text-white shadow-primary/20 hover:scale-105'
                                                }`}
                                        >
                                            {saving ? <div className="w-5 h-5 border-2 border-white border-t-transparent animate-spin rounded-full" /> : (saveSuccess ? <Check size={22} /> : <Save size={22} />)}
                                            {saveSuccess ? (editingMeasurement ? 'Edição Salva!' : 'Medição Salva!') : (editingMeasurement ? 'Salvar Edição' : 'Finalizar e Salvar')}
                                        </button>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    )

    return (
        <div className="flex flex-col gap-6 pb-20">
            {/* Admin Tabs */}
            {isInternalAdmin && (
                <div className="flex gap-2 p-1 bg-slate-100 rounded-[20px] w-fit">
                    <button
                        onClick={() => setAdminTab('new')}
                        className={`px-6 py-3 rounded-2xl text-xs font-black uppercase tracking-widest transition-all ${adminTab === 'new' ? 'bg-white text-primary shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                    >
                        <div className="flex items-center gap-2">
                            <Calculator size={16} />
                            Nova Medição
                        </div>
                    </button>
                    <button
                        onClick={() => setAdminTab('dashboard')}
                        className={`px-6 py-3 rounded-2xl text-xs font-black uppercase tracking-widest transition-all ${adminTab === 'dashboard' ? 'bg-white text-primary shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                    >
                        <div className="flex items-center gap-2">
                            <LayoutDashboard size={16} />
                            Dashboard Admin
                        </div>
                    </button>
                    <button
                        onClick={() => setAdminTab('prices')}
                        className={`px-6 py-3 rounded-2xl text-xs font-black uppercase tracking-widest transition-all ${adminTab === 'prices' ? 'bg-white text-primary shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                    >
                        <div className="flex items-center gap-2">
                            <DollarSign size={16} />
                            Tabelas de Preço
                        </div>
                    </button>
                </div>
            )}

            {/* Content Rendering */}
            {adminTab === 'new' && (
                <>
                    {/* Header (Only show in 'new' mode, others have their own headers) */}
                    <div className="bg-white p-6 rounded-[32px] border border-slate-100 shadow-sm flex flex-col md:flex-row items-center justify-between gap-4">
                        <div className="flex items-center gap-4">
                            <div className="p-3 bg-primary-50 text-primary rounded-2xl">
                                <Calculator size={24} />
                            </div>
                            <div>
                                <h2 className="text-xl font-black text-slate-900 uppercase tracking-tight">Nova Medição</h2>
                                <p className="text-sm text-slate-400 font-medium">Siga os 3 passos para registrar a atividade</p>
                            </div>
                        </div>

                        {companies.length > 1 && (
                            <div className="relative group">
                                <Building2 className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                                <select
                                    value={selectedCompany}
                                    onChange={(e) => setSelectedCompany(e.target.value)}
                                    className="pl-12 pr-10 py-3 bg-slate-50 border-none rounded-2xl text-sm font-bold text-slate-700 appearance-none cursor-pointer"
                                >
                                    {companies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                                </select>
                            </div>
                        )}
                    </div>
                    {renderNewMeasurementContent()}
                </>
            )}

            {adminTab === 'dashboard' && isInternalAdmin && (
                <MeasurementAdminView currentUser={currentUser} onEdit={handleEditMeasurement} />
            )}

            {adminTab === 'prices' && isInternalAdmin && (
                <MeasurementPriceManager />
            )}
        </div>
    );
};
