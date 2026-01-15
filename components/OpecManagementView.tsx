import React, { useState, useEffect, useMemo, useRef } from 'react';
import { User, OpecItem, OpecDevice, UserRole } from '../types';
import { getOpecItems, createOpecItem, updateOpecItem, deleteOpecItem, getAllUsers, getOpecDevices, createOpecDevice, updateOpecDevice, deleteOpecDevice, bulkCreateOpecDevices } from '../api/fieldManagerApi';
import { Smartphone, Plus, Search, Trash2, Edit2, Calendar, User as UserIcon, AlertCircle, CheckCircle2, Loader2, X, ClipboardList, Package, Fingerprint, Info, Upload } from 'lucide-react';
import SimpleModal from './SimpleModal';
import readXlsxFile from 'read-excel-file';

interface Props {
    currentUser: User;
}

type SubTab = 'assignments' | 'inventory';

const OpecManagementView: React.FC<Props> = ({ currentUser }) => {
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [activeSubTab, setActiveSubTab] = useState<SubTab>('assignments');
    const [items, setItems] = useState<OpecItem[]>([]);
    const [devices, setDevices] = useState<OpecDevice[]>([]);
    const [users, setUsers] = useState<User[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [isAssignmentModalOpen, setIsAssignmentModalOpen] = useState(false);
    const [isDeviceModalOpen, setIsDeviceModalOpen] = useState(false);
    const [editingItem, setEditingItem] = useState<OpecItem | null>(null);
    const [editingDevice, setEditingDevice] = useState<OpecDevice | null>(null);

    // Import State
    const [importing, setImporting] = useState(false);
    const [importStats, setImportStats] = useState<{ total: number; success: number } | null>(null);

    // Assignment Form State
    const [opecName, setOpecName] = useState('');
    const [employeeId, setEmployeeId] = useState('');
    const [assignmentDate, setAssignmentDate] = useState(new Date().toISOString().split('T')[0]);

    // Device Form State
    const [deviceForm, setDeviceForm] = useState<Partial<OpecDevice>>({
        assetCode: '',
        phoneNumber: '',
        brand: 'SAMSUNG',
        model: '',
        serialNumber: '',
        capacity: '',
        imei1: '',
        imei2: '',
        observations: ''
    });

    const [submitting, setSubmitting] = useState(false);

    useEffect(() => {
        loadData();
    }, [currentUser, activeSubTab]);

    const loadData = async () => {
        setLoading(true);
        try {
            if (activeSubTab === 'assignments') {
                const [opecData, userData] = await Promise.all([
                    getOpecItems(currentUser.companyId),
                    getAllUsers(currentUser.companyId)
                ]);
                setItems(opecData);
                setUsers(userData);
            } else {
                const deviceData = await getOpecDevices(currentUser.companyId);
                setDevices(deviceData);
            }
        } catch (err) {
            console.error('Error loading OPEC data:', err);
        } finally {
            setLoading(false);
        }
    };

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setImporting(true);
        setImportStats(null);

        try {
            const rows = await readXlsxFile(file);
            if (rows.length < 2) throw new Error('Arquivo vazio ou inválido.');

            // ATIVO ELETROMIDIA	Nº DA LINHA2	MARCA	MODELO	Nº SÉRIE	CAPACIDADE	IMEI 1	IMEI 2	OBS
            const headers = (rows[0] as string[]).map(h => h?.toString().toUpperCase().trim());

            const findCol = (name: string) => headers.findIndex(h => h?.includes(name));

            const colIdx = {
                asset: findCol('ATIVO'),
                line: findCol('LINHA'),
                brand: findCol('MARCA'),
                model: findCol('MODELO'),
                serial: findCol('SÉRIE'),
                capacity: findCol('CAPACIDADE'),
                imei1: findCol('IMEI 1'),
                imei2: findCol('IMEI 2'),
                obs: findCol('OBS')
            };

            const newDevices: Omit<OpecDevice, 'id' | 'createdAt'>[] = rows.slice(1).map((row: any) => ({
                assetCode: row[colIdx.asset]?.toString() || '',
                phoneNumber: row[colIdx.line]?.toString() || '',
                brand: row[colIdx.brand]?.toString() || '',
                model: row[colIdx.model]?.toString() || '',
                serialNumber: row[colIdx.serial]?.toString() || '',
                capacity: row[colIdx.capacity]?.toString() || '',
                imei1: row[colIdx.imei1]?.toString() || '',
                imei2: row[colIdx.imei2]?.toString() || '',
                observations: row[colIdx.obs]?.toString() || '',
                companyId: currentUser.companyId
            })).filter(d => d.assetCode);

            if (newDevices.length === 0) throw new Error('Nenhum dispositivo válido encontrado.');

            await bulkCreateOpecDevices(newDevices);
            setImportStats({ total: newDevices.length, success: newDevices.length });
            loadData();
        } catch (err: any) {
            console.error('Import error:', err);
            alert(err.message || 'Erro ao processar arquivo.');
        } finally {
            setImporting(false);
            if (fileInputRef.current) fileInputRef.current.value = '';
        }
    };

    const handleOpenAssignmentModal = (item?: OpecItem) => {
        if (item) {
            setEditingItem(item);
            setOpecName(item.opecName);
            setEmployeeId(item.employeeId);
            setAssignmentDate(new Date(item.assignmentDate).toISOString().split('T')[0]);
        } else {
            setEditingItem(null);
            setOpecName('');
            setEmployeeId('');
            setAssignmentDate(new Date().toISOString().split('T')[0]);
        }
        setIsAssignmentModalOpen(true);
    };

    const handleOpenDeviceModal = (device?: OpecDevice) => {
        if (device) {
            setEditingDevice(device);
            setDeviceForm({ ...device });
        } else {
            setEditingDevice(null);
            setDeviceForm({
                assetCode: '',
                phoneNumber: '',
                brand: 'SAMSUNG',
                model: '',
                serialNumber: '',
                capacity: '',
                imei1: '',
                imei2: '',
                observations: ''
            });
        }
        setIsDeviceModalOpen(true);
    };

    const handleAssignmentSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setSubmitting(true);
        try {
            if (editingItem) {
                await updateOpecItem(editingItem.id, {
                    opecName,
                    employeeId,
                    assignmentDate: new Date(assignmentDate).toISOString()
                });
            } else {
                await createOpecItem({
                    opecName,
                    employeeId,
                    assignmentDate: new Date(assignmentDate).toISOString(),
                    companyId: currentUser.companyId
                });
            }
            setIsAssignmentModalOpen(false);
            loadData();
        } catch (err: any) {
            console.error('Error saving OPEC item:', err);
            alert(`Erro ao salvar registro: ${err.message || 'Erro desconhecido'}`);
        } finally {
            setSubmitting(false);
        }
    };

    const handleDeviceSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setSubmitting(true);
        try {
            if (editingDevice) {
                await updateOpecDevice(editingDevice.id, deviceForm);
            } else {
                await createOpecDevice({
                    assetCode: deviceForm.assetCode!,
                    phoneNumber: deviceForm.phoneNumber,
                    brand: deviceForm.brand,
                    model: deviceForm.model,
                    serialNumber: deviceForm.serialNumber,
                    capacity: deviceForm.capacity,
                    imei1: deviceForm.imei1,
                    imei2: deviceForm.imei2,
                    observations: deviceForm.observations,
                    companyId: currentUser.companyId
                });
            }
            setIsDeviceModalOpen(false);
            loadData();
        } catch (err: any) {
            console.error('Error saving OPEC device:', err);
            alert(`Erro ao salvar dispositivo: ${err.message || 'Erro desconhecido'}`);
        } finally {
            setSubmitting(false);
        }
    };

    const handleAssignmentDelete = async (id: string) => {
        if (!confirm('Tem certeza que deseja excluir esta atribuição?')) return;
        try {
            await deleteOpecItem(id);
            loadData();
        } catch (err) {
            console.error('Error deleting OPEC item:', err);
            alert('Erro ao excluir registro.');
        }
    };

    const handleDeviceDelete = async (id: string) => {
        if (!confirm('Tem certeza que deseja excluir este dispositivo do inventário?')) return;
        try {
            await deleteOpecDevice(id);
            loadData();
        } catch (err) {
            console.error('Error deleting OPEC device:', err);
            alert('Erro ao excluir dispositivo.');
        }
    };

    const filteredItems = useMemo(() => {
        return items.filter(item => {
            const employee = users.find(u => u.id === item.employeeId);
            const searchStr = `${item.opecName} ${employee?.name || ''}`.toLowerCase();
            return searchStr.includes(searchTerm.toLowerCase());
        });
    }, [items, users, searchTerm]);

    const filteredDevices = useMemo(() => {
        return devices.filter(device => {
            const searchStr = `${device.assetCode} ${device.phoneNumber || ''} ${device.model || ''} ${device.serialNumber || ''}`.toLowerCase();
            return searchStr.includes(searchTerm.toLowerCase());
        });
    }, [devices, searchTerm]);

    const renderHeader = () => (
        <div className="flex flex-col gap-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h2 className="text-2xl font-black text-slate-800 uppercase tracking-tight">Gestão de OPEC</h2>
                    <p className="text-slate-500 text-sm font-medium">Controle e Inventário de Celulares</p>
                </div>

                <div className="flex items-center gap-3">
                    {activeSubTab === 'inventory' && (
                        <>
                            <input
                                type="file"
                                ref={fileInputRef}
                                className="hidden"
                                accept=".xlsx, .xls"
                                onChange={handleFileUpload}
                            />
                            <button
                                onClick={() => fileInputRef.current?.click()}
                                disabled={importing}
                                className="flex items-center justify-center gap-2 bg-slate-800 text-white px-6 py-3 rounded-2xl font-black uppercase tracking-wider text-xs transition-all shadow-lg shadow-slate-200 hover:bg-slate-900 active:scale-95 disabled:opacity-50"
                            >
                                {importing ? <Loader2 size={18} className="animate-spin" /> : <Upload size={18} />}
                                <span>Importar Excel</span>
                            </button>
                        </>
                    )}
                    <button
                        onClick={() => activeSubTab === 'assignments' ? handleOpenAssignmentModal() : handleOpenDeviceModal()}
                        className="flex items-center justify-center gap-2 bg-primary text-white px-6 py-3 rounded-2xl font-black uppercase tracking-wider text-xs transition-all shadow-lg shadow-primary/20 hover:scale-[1.02] active:scale-95"
                    >
                        <Plus size={18} />
                        <span>{activeSubTab === 'assignments' ? 'Nova Atribuição' : 'Novo Dispositivo'}</span>
                    </button>
                </div>
            </div>

            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex gap-2 p-1 bg-slate-100 w-fit rounded-2xl">
                    <button
                        onClick={() => { setActiveSubTab('assignments'); setSearchTerm(''); }}
                        className={`flex items-center gap-2 px-6 py-2.5 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all ${activeSubTab === 'assignments' ? 'bg-white text-primary shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                    >
                        <ClipboardList size={14} /> Atribuições
                    </button>
                    <button
                        onClick={() => { setActiveSubTab('inventory'); setSearchTerm(''); }}
                        className={`flex items-center gap-2 px-6 py-2.5 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all ${activeSubTab === 'inventory' ? 'bg-white text-primary shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                    >
                        <Package size={14} /> Inventário
                    </button>
                </div>

                {importStats && (
                    <div className="flex items-center gap-2 px-4 py-2 bg-green-50 text-green-700 rounded-xl text-[10px] font-black uppercase tracking-widest animate-in fade-in slide-in-from-right-4">
                        <CheckCircle2 size={14} />
                        <span>Importado: {importStats.success} de {importStats.total} dispositivos</span>
                        <button onClick={() => setImportStats(null)} className="ml-2 hover:text-green-900"><X size={14} /></button>
                    </div>
                )}
            </div>
        </div>
    );

    const renderAssignmentsTable = () => (
        <div className="bg-white rounded-3xl shadow-sm border border-slate-100 overflow-hidden">
            <div className="p-4 border-b border-slate-50 bg-slate-50/50 flex items-center gap-4">
                <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                    <input
                        type="text"
                        placeholder="Buscar por OPEC ou Colaborador..."
                        className="w-full pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all font-medium text-slate-600"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
                <div className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                    Total: {filteredItems.length}
                </div>
            </div>

            <div className="overflow-x-auto">
                <table className="w-full text-left">
                    <thead>
                        <tr className="border-b border-slate-100 bg-slate-50/50">
                            <th className="p-4 text-[10px] font-black uppercase tracking-widest text-slate-400">OPEC</th>
                            <th className="p-4 text-[10px] font-black uppercase tracking-widest text-slate-400">Colaborador</th>
                            <th className="p-4 text-[10px] font-black uppercase tracking-widest text-slate-400">Data de Atribuição</th>
                            <th className="p-4 text-[10px] font-black uppercase tracking-widest text-slate-400 text-right">Ações</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                        {loading ? (
                            <tr><td colSpan={4} className="p-12 text-center"><Loader2 className="w-8 h-8 text-primary animate-spin mx-auto" /></td></tr>
                        ) : filteredItems.length === 0 ? (
                            <tr><td colSpan={4} className="p-12 text-center text-slate-400 text-sm">Nenhuma atribuição encontrada.</td></tr>
                        ) : (
                            filteredItems.map(item => {
                                const employee = users.find(u => u.id === item.employeeId);
                                return (
                                    <tr key={item.id} className="group hover:bg-slate-50 transition-colors">
                                        <td className="p-4">
                                            <div className="flex items-center gap-3">
                                                <div className="p-2 bg-primary/10 text-primary rounded-lg">
                                                    <Smartphone size={16} />
                                                </div>
                                                <span className="font-bold text-slate-700">{item.opecName}</span>
                                            </div>
                                        </td>
                                        <td className="p-4">
                                            <div className="flex items-center gap-3">
                                                <img
                                                    src={employee?.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(employee?.name || 'U')}`}
                                                    className="w-8 h-8 rounded-full bg-slate-100 border border-white shadow-sm"
                                                    alt=""
                                                />
                                                <div>
                                                    <span className="font-bold text-slate-700 text-sm block">{employee?.name || 'Não encontrado'}</span>
                                                    <span className="text-[10px] text-slate-400 uppercase font-black">{employee?.role.replace('PARCEIRO_', '') || '---'}</span>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="p-4 text-xs font-bold text-slate-500">
                                            <div className="flex items-center gap-2">
                                                <Calendar size={14} className="text-slate-300" />
                                                {new Date(item.assignmentDate).toLocaleDateString('pt-BR')}
                                            </div>
                                        </td>
                                        <td className="p-4 text-right">
                                            <div className="flex items-center justify-end gap-2">
                                                <button onClick={() => handleOpenAssignmentModal(item)} className="p-2 text-slate-400 hover:text-primary hover:bg-primary/5 rounded-lg transition-all"><Edit2 size={16} /></button>
                                                <button onClick={() => handleAssignmentDelete(item.id)} className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"><Trash2 size={16} /></button>
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );

    const renderInventoryTable = () => (
        <div className="bg-white rounded-3xl shadow-sm border border-slate-100 overflow-hidden">
            <div className="p-4 border-b border-slate-50 bg-slate-50/50 flex items-center gap-4">
                <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                    <input
                        type="text"
                        placeholder="Buscar por Ativo, Linha, Marca ou Modelo..."
                        className="w-full pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all font-medium text-slate-600"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
                <div className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                    Dispositivos: {filteredDevices.length}
                </div>
            </div>

            <div className="overflow-x-auto">
                <table className="w-full text-left">
                    <thead>
                        <tr className="border-b border-slate-100 bg-slate-50/50">
                            <th className="p-4 text-[10px] font-black uppercase tracking-widest text-slate-400">Ativo</th>
                            <th className="p-4 text-[10px] font-black uppercase tracking-widest text-slate-400">Cpf/Linha</th>
                            <th className="p-4 text-[10px] font-black uppercase tracking-widest text-slate-400">Marca/Modelo</th>
                            <th className="p-4 text-[10px] font-black uppercase tracking-widest text-slate-400">IMEI(s)</th>
                            <th className="p-4 text-[10px] font-black uppercase tracking-widest text-slate-400">Obs</th>
                            <th className="p-4 text-[10px] font-black uppercase tracking-widest text-slate-400 text-right">Ações</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                        {loading ? (
                            <tr><td colSpan={6} className="p-12 text-center"><Loader2 className="w-8 h-8 text-primary animate-spin mx-auto" /></td></tr>
                        ) : filteredDevices.length === 0 ? (
                            <tr><td colSpan={6} className="p-12 text-center text-slate-400 text-sm">Nenhum dispositivo cadastrado.</td></tr>
                        ) : (
                            filteredDevices.map(device => (
                                <tr key={device.id} className="group hover:bg-slate-50 transition-colors">
                                    <td className="p-4">
                                        <div className="flex flex-col">
                                            <span className="font-black text-slate-900 text-xs">{device.assetCode}</span>
                                            <span className="text-[10px] text-slate-400 font-bold">Ref: {device.serialNumber || '---'}</span>
                                        </div>
                                    </td>
                                    <td className="p-4">
                                        <div className="flex flex-col">
                                            <span className="font-bold text-slate-700 text-xs">{device.phoneNumber || 'S/N'}</span>
                                            <span className="text-[10px] text-slate-400 font-bold uppercase">{device.capacity || '---'}</span>
                                        </div>
                                    </td>
                                    <td className="p-4">
                                        <div className="flex flex-col">
                                            <span className="font-black text-slate-800 text-xs">{device.brand}</span>
                                            <span className="text-[10px] text-slate-500 font-bold uppercase">{device.model || '---'}</span>
                                        </div>
                                    </td>
                                    <td className="p-4">
                                        <div className="flex flex-col gap-0.5">
                                            <div className="flex items-center gap-1.5">
                                                <Fingerprint size={10} className="text-slate-300" />
                                                <span className="text-[9px] font-mono text-slate-500">{device.imei1 || '---'}</span>
                                            </div>
                                            {device.imei2 && (
                                                <div className="flex items-center gap-1.5">
                                                    <Fingerprint size={10} className="text-slate-300" />
                                                    <span className="text-[9px] font-mono text-slate-500">{device.imei2}</span>
                                                </div>
                                            )}
                                        </div>
                                    </td>
                                    <td className="p-4">
                                        {device.observations ? (
                                            <div className="group relative w-fit">
                                                <Info size={14} className="text-slate-300 cursor-help" />
                                                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-48 p-2 bg-slate-900 text-white text-[10px] rounded-lg opacity-0 group-hover:opacity-100 transition-opacity z-10 pointer-events-none">
                                                    {device.observations}
                                                </div>
                                            </div>
                                        ) : <span className="text-slate-200">---</span>}
                                    </td>
                                    <td className="p-4 text-right">
                                        <div className="flex items-center justify-end gap-2">
                                            <button onClick={() => handleOpenDeviceModal(device)} className="p-2 text-slate-400 hover:text-primary hover:bg-primary/5 rounded-lg transition-all"><Edit2 size={16} /></button>
                                            <button onClick={() => handleDeviceDelete(device.id)} className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"><Trash2 size={16} /></button>
                                        </div>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            {renderHeader()}

            {activeSubTab === 'assignments' ? renderAssignmentsTable() : renderInventoryTable()}

            {/* Assignment Modal */}
            <SimpleModal
                isOpen={isAssignmentModalOpen}
                onClose={() => setIsAssignmentModalOpen(false)}
                title={editingItem ? 'Editar Atribuição OPEC' : 'Nova Atribuição OPEC'}
            >
                <form onSubmit={handleAssignmentSubmit} className="space-y-4">
                    <div>
                        <label className="block text-xs font-black text-slate-500 uppercase tracking-widest mb-2">Identificação do OPEC (Ativo)</label>
                        <select
                            required
                            className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-800 text-sm focus:ring-2 focus:ring-primary/20 outline-none"
                            value={opecName}
                            onChange={e => setOpecName(e.target.value)}
                        >
                            <option value="">Selecione um dispositivo...</option>
                            {devices.map(d => (
                                <option key={d.id} value={d.assetCode}>{d.assetCode} - {d.model || d.brand}</option>
                            ))}
                        </select>
                    </div>

                    <div>
                        <label className="block text-xs font-black text-slate-500 uppercase tracking-widest mb-2">Colaborador Responsável</label>
                        <select
                            required
                            className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-800 text-sm focus:ring-2 focus:ring-primary/20 outline-none"
                            value={employeeId}
                            onChange={e => setEmployeeId(e.target.value)}
                        >
                            <option value="">Selecione um colaborador...</option>
                            {users.map(user => (
                                <option key={user.id} value={user.id}>
                                    {user.name} ({user.role.replace('PARCEIRO_', '')})
                                </option>
                            ))}
                        </select>
                    </div>

                    <div>
                        <label className="block text-xs font-black text-slate-500 uppercase tracking-widest mb-2">Data de Atribuição</label>
                        <input
                            type="date"
                            required
                            className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-800 text-sm focus:ring-2 focus:ring-primary/20 outline-none"
                            value={assignmentDate}
                            onChange={e => setAssignmentDate(e.target.value)}
                        />
                    </div>

                    <div className="pt-4">
                        <button type="submit" disabled={submitting} className="w-full py-4 bg-primary text-white font-black rounded-xl hover:bg-primary-600 transition-all shadow-lg shadow-primary/20 flex items-center justify-center gap-2 disabled:opacity-50">
                            {submitting ? <Loader2 className="w-5 h-5 animate-spin" /> : <CheckCircle2 size={20} />}
                            <span>{editingItem ? 'Atualizar Registro' : 'Salvar Atribuição'}</span>
                        </button>
                    </div>
                </form>
            </SimpleModal>

            {/* Device Modal */}
            <SimpleModal
                isOpen={isDeviceModalOpen}
                onClose={() => setIsDeviceModalOpen(false)}
                title={editingDevice ? 'Editar Dispositivo' : 'Novo Dispositivo no Inventário'}
            >
                <form onSubmit={handleDeviceSubmit} className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs font-black text-slate-500 uppercase tracking-widest mb-2">Ativo Eletromidia</label>
                            <input
                                type="text" required
                                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-800 text-sm outline-none"
                                value={deviceForm.assetCode}
                                onChange={e => setDeviceForm({ ...deviceForm, assetCode: e.target.value })}
                                placeholder="Ex: OPEC-M-045"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-black text-slate-500 uppercase tracking-widest mb-2">Nº da Linha</label>
                            <input
                                type="text"
                                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-800 text-sm outline-none"
                                value={deviceForm.phoneNumber}
                                onChange={e => setDeviceForm({ ...deviceForm, phoneNumber: e.target.value })}
                                placeholder="(11) 9XXXX-XXXX"
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs font-black text-slate-500 uppercase tracking-widest mb-2">Marca</label>
                            <select
                                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-800 text-sm outline-none"
                                value={deviceForm.brand}
                                onChange={e => setDeviceForm({ ...deviceForm, brand: e.target.value })}
                            >
                                <option value="SAMSUNG">SAMSUNG</option>
                                <option value="MOTOROLA">MOTOROLA</option>
                                <option value="APPLE">APPLE</option>
                                <option value="XIAOMI">XIAOMI</option>
                                <option value="OUTRO">OUTRO</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-xs font-black text-slate-500 uppercase tracking-widest mb-2">Modelo</label>
                            <input
                                type="text"
                                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-800 text-sm outline-none"
                                value={deviceForm.model}
                                onChange={e => setDeviceForm({ ...deviceForm, model: e.target.value })}
                                placeholder="Ex: GALAXY A23"
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs font-black text-slate-500 uppercase tracking-widest mb-2">Nº de Série</label>
                            <input
                                type="text"
                                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-800 text-sm outline-none"
                                value={deviceForm.serialNumber}
                                onChange={e => setDeviceForm({ ...deviceForm, serialNumber: e.target.value })}
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-black text-slate-500 uppercase tracking-widest mb-2">Capacidade</label>
                            <input
                                type="text"
                                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-800 text-sm outline-none"
                                value={deviceForm.capacity}
                                onChange={e => setDeviceForm({ ...deviceForm, capacity: e.target.value })}
                                placeholder="128 GB"
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs font-black text-slate-500 uppercase tracking-widest mb-2">IMEI 1</label>
                            <input
                                type="text"
                                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-800 text-sm outline-none"
                                value={deviceForm.imei1}
                                onChange={e => setDeviceForm({ ...deviceForm, imei1: e.target.value })}
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-black text-slate-500 uppercase tracking-widest mb-2">IMEI 2</label>
                            <input
                                type="text"
                                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-800 text-sm outline-none"
                                value={deviceForm.imei2}
                                onChange={e => setDeviceForm({ ...deviceForm, imei2: e.target.value })}
                            />
                        </div>
                    </div>

                    <div>
                        <label className="block text-xs font-black text-slate-500 uppercase tracking-widest mb-2">Observações</label>
                        <textarea
                            className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-800 text-sm outline-none h-20 resize-none"
                            value={deviceForm.observations}
                            onChange={e => setDeviceForm({ ...deviceForm, observations: e.target.value })}
                            placeholder="Ex: modelo antigo, extraviado..."
                        />
                    </div>

                    <div className="pt-4">
                        <button type="submit" disabled={submitting} className="w-full py-4 bg-primary text-white font-black rounded-xl hover:bg-primary-600 transition-all shadow-lg shadow-primary/20 flex items-center justify-center gap-2 disabled:opacity-50">
                            {submitting ? <Loader2 className="w-5 h-5 animate-spin" /> : <CheckCircle2 size={20} />}
                            <span>{editingDevice ? 'Atualizar Dispositivo' : 'Cadastrar Dispositivo'}</span>
                        </button>
                    </div>
                </form>
            </SimpleModal>
        </div>
    );
};

export default OpecManagementView;
