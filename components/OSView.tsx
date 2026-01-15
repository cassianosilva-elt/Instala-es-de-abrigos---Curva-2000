
import React, { useState, useMemo } from 'react';
import { Task, TaskStatus, User, UserRole, AssetType, ServiceType, AuditLog } from '../types';
import { ClipboardList, Search, Filter, AlertCircle, CheckCircle, Clock, MapPin, Plus, Box, History, X, ChevronRight } from 'lucide-react';
import SimpleModal from './SimpleModal';
import SearchableSelect from './SearchableSelect';
import { getAssets, getAuditLogs, getEvidenceByTaskId } from '../api/fieldManagerApi';

interface Props {
    tasks: Task[];
    users: User[];
    currentUser: User;
    onUpdateTask: (task: Task) => void;
    onCreateTask?: (task: Omit<Task, 'id'>) => void;
}

const OSView: React.FC<Props> = ({ tasks, users, currentUser, onUpdateTask, onCreateTask }) => {
    const [filterStatus, setFilterStatus] = useState<string>('all');
    const [searchTerm, setSearchTerm] = useState('');
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [assets, setAssets] = useState<any[]>([]);
    const [isAssetLoading, setIsAssetLoading] = useState(false);

    // Detailed View State
    const [selectedTask, setSelectedTask] = useState<Task | null>(null);
    const [taskLogs, setTaskLogs] = useState<AuditLog[]>([]);
    const [isLoadingLogs, setIsLoadingLogs] = useState(false);

    // Form State (Ported from ChiefView)
    const [assetType, setAssetType] = useState<AssetType>(AssetType.BUS_SHELTER);
    const [assetId, setAssetId] = useState('');
    const [serviceType, setServiceType] = useState<ServiceType>(ServiceType.PREVENTIVE);
    const [technicianId, setTechnicianId] = useState('');
    const [scheduledDate, setScheduledDate] = useState('');
    const [description, setDescription] = useState('');
    const [address, setAddress] = useState('');

    React.useEffect(() => {
        if (isModalOpen) {
            setIsAssetLoading(true);
            getAssets().then(data => {
                setAssets(data);
                setIsAssetLoading(false);
            });
        }
    }, [isModalOpen]);

    const handleViewDetails = async (task: Task) => {
        setSelectedTask(task);
        setIsLoadingLogs(true);
        try {
            const logs = await getAuditLogs('tasks', task.id);
            setTaskLogs(logs);
        } catch (err) {
            console.error('Error fetching logs:', err);
        } finally {
            setIsLoadingLogs(false);
        }
    };

    const handleAssetChange = (code: string) => {
        setAssetId(code);
        const selected = assets.find(a => a.code === code);
        if (selected) {
            setAssetType(selected.type as AssetType);
            setAddress(selected.address);
        }
    };

    const isInternalUser = currentUser.role === UserRole.CHEFE || currentUser.role === UserRole.LIDER;

    const availableTechnicians = useMemo(() => {
        if (isInternalUser) {
            // Usuário interno vê todos os técnicos
            return users.filter(u => u.role === UserRole.TECNICO || u.role === UserRole.PARCEIRO_TECNICO);
        }
        // Usuário parceiro vê apenas técnicos da sua própria empresa
        return users.filter(u => (u.role === UserRole.TECNICO || u.role === UserRole.PARCEIRO_TECNICO) && u.companyId === currentUser.companyId);
    }, [users, isInternalUser, currentUser.companyId]);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (onCreateTask && assetId && technicianId && scheduledDate) {
            const tech = users.find(u => u.id === technicianId);

            const newAsset = {
                id: assetId,
                code: assetId,
                type: assetType,
                location: { lat: -23.5505, lng: -46.6333, address: address },
                companyId: tech?.companyId || currentUser.companyId
            };

            onCreateTask({
                assetId: assetId,
                asset: newAsset,
                serviceType,
                technicianId,
                leaderId: currentUser.id,
                companyId: tech?.companyId || currentUser.companyId,
                scheduledDate,
                description,
                status: TaskStatus.PENDING,
                evidence: []
            });

            setIsModalOpen(false);
            // Reset form
            setAssetId('');
            setTechnicianId('');
            setScheduledDate('');
            setDescription('');
            setAddress('');
        }
    };

    const filteredTasks = useMemo(() => {
        return tasks.filter(task => {
            const matchesStatus = filterStatus === 'all' || task.status === filterStatus;
            const matchesSearch = (task.assetId?.toLowerCase() || '').includes(searchTerm.toLowerCase()) ||
                (task.asset?.location?.address?.toLowerCase() || '').includes(searchTerm.toLowerCase());
            return matchesStatus && matchesSearch;
        });
    }, [tasks, filterStatus, searchTerm]);

    const getStatusColor = (status: TaskStatus) => {
        switch (status) {
            case TaskStatus.COMPLETED: return 'text-green-600 bg-green-50 border-green-200';
            case TaskStatus.IN_PROGRESS: return 'text-blue-600 bg-blue-50 border-blue-200';
            case TaskStatus.PENDING: return 'text-primary bg-primary/5 border-primary/20';
            case TaskStatus.BLOCKED: return 'text-slate-500 bg-slate-100 border-slate-200';
            case TaskStatus.NOT_PERFORMED: return 'text-red-600 bg-red-50 border-red-200';
            default: return 'text-slate-600 bg-white border-slate-200';
        }
    };

    const isManager = currentUser.role === UserRole.CHEFE || currentUser.role === UserRole.LIDER || currentUser.role === UserRole.PARCEIRO_CHEFE || currentUser.role === UserRole.PARCEIRO_LIDER;

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h2 className="text-xl md:text-2xl font-black text-slate-800 flex items-center gap-2">
                        <ClipboardList className="text-primary w-5 h-5 md:w-6 md:h-6" />
                        Gestão de OS
                    </h2>
                    <p className="text-slate-500 font-bold text-[10px] md:text-sm">Visualização completa de todas as OS</p>
                </div>

                {isManager && onCreateTask && (
                    <button
                        onClick={() => setIsModalOpen(true)}
                        className="flex items-center justify-center gap-2 bg-slate-900 text-white px-4 md:px-5 py-2.5 md:py-3 rounded-lg md:rounded-xl hover:bg-slate-800 transition-colors font-bold shadow-lg shadow-slate-200 text-xs md:text-sm"
                    >
                        <Plus size={18} />
                        Nova OS
                    </button>
                )}
            </div>

            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col md:flex-row gap-4 items-center">
                <div className="relative flex-1 w-full">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                    <input
                        type="text"
                        placeholder="Buscar por ID ou Endereço..."
                        className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-700 outline-none focus:ring-2 focus:ring-primary/20"
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                    />
                </div>

                <div className="flex items-center gap-2 w-full md:w-auto overflow-x-auto pb-2 md:pb-0">
                    <Filter size={18} className="text-slate-400 shrink-0" />
                    <select
                        className="px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-700 outline-none focus:ring-2 focus:ring-primary/20 min-w-[200px]"
                        value={filterStatus}
                        onChange={e => setFilterStatus(e.target.value)}
                    >
                        <option value="all">Todos os Status</option>
                        {Object.values(TaskStatus).map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                </div>
            </div>

            <div className="grid grid-cols-1 gap-4">
                {filteredTasks.length === 0 ? (
                    <div className="text-center py-20 bg-slate-50 rounded-3xl border border-dashed border-slate-300">
                        <p className="text-slate-400 font-bold">Nenhuma OS encontrada com os filtros atuais.</p>
                    </div>
                ) : (
                    filteredTasks.map(task => {
                        const tech = users.find(u => u.id === task.technicianId);
                        return (
                            <div
                                key={task.id}
                                onClick={() => handleViewDetails(task)}
                                className="bg-white rounded-2xl border border-slate-200 p-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-6 shadow-sm hover:shadow-md transition-shadow group cursor-pointer"
                            >
                                <div className="flex items-start gap-4 flex-1">
                                    <div className={`p-3 rounded-xl ${getStatusColor(task.status)} shrink-0`}>
                                        {task.status === TaskStatus.COMPLETED ? <CheckCircle size={24} /> :
                                            task.status === TaskStatus.BLOCKED ? <AlertCircle size={24} /> : <Clock size={24} />}
                                    </div>
                                    <div>
                                        <div className="flex items-center gap-2 mb-1">
                                            <span className="text-[10px] font-black uppercase tracking-widest text-primary bg-primary/5 px-2 py-1 rounded-md">{task.asset?.type || 'Ativo'}</span>
                                            <span className={`text-[10px] font-black uppercase tracking-widest px-2 py-1 rounded-md border ${getStatusColor(task.status)}`}>{task.status}</span>
                                        </div>
                                        <h3 className="text-lg font-black text-slate-800 group-hover:text-primary transition-colors">{task.serviceType} <span className="text-primary/40 text-xs ml-1">#{task.assetId}</span></h3>
                                        <p className="text-sm font-bold text-slate-500 flex items-center gap-1 mt-1">
                                            <MapPin size={14} /> {task.asset?.location?.address || 'Sem endereço'}
                                        </p>
                                    </div>
                                </div>

                                <div className="flex items-center gap-3 md:gap-6 w-full md:w-auto border-t md:border-t-0 md:border-l border-slate-100 pt-3 md:pt-0 md:pl-6 justify-between md:justify-end">
                                    <div className="flex items-center gap-2 md:gap-3">
                                        <div className="text-right">
                                            <p className="text-[8px] md:text-[10px] font-black uppercase text-slate-400 tracking-widest">Técnico</p>
                                            <p className="text-xs md:text-sm font-bold text-slate-700 truncate max-w-[80px] md:max-w-none">{tech?.name || 'Não atribuído'}</p>
                                        </div>
                                        <img src={tech?.avatar || 'https://i.pravatar.cc/150'} alt="" className="w-8 h-8 md:w-10 md:h-10 rounded-full border-2 border-white shadow-sm" />
                                    </div>

                                    <div className="text-right">
                                        <p className="text-[8px] md:text-[10px] font-black uppercase text-slate-400 tracking-widest">Data</p>
                                        <p className="text-xs md:text-sm font-bold text-slate-700">{task.scheduledDate}</p>
                                    </div>
                                    <ChevronRight className="text-slate-300 group-hover:translate-x-1 transition-transform" size={20} />
                                </div>
                            </div>
                        );
                    })
                )}
            </div>

            {/* Task Details & Audit Modal */}
            <SimpleModal isOpen={!!selectedTask} onClose={() => setSelectedTask(null)} title="Histórico e Detalhes da Ordem de Serviço">
                {selectedTask && (
                    <div className="space-y-6">
                        <div className="grid grid-cols-2 gap-4">
                            <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Status Atual</p>
                                <span className={`inline-block text-xs font-black uppercase tracking-widest px-3 py-1.5 rounded-lg border ${getStatusColor(selectedTask.status)}`}>
                                    {selectedTask.status}
                                </span>
                            </div>
                            <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Empresa Responsável</p>
                                <p className="text-xs font-black text-slate-700 uppercase">{selectedTask.companyId}</p>
                            </div>
                        </div>

                        <div>
                            <h4 className="flex items-center gap-2 text-xs font-black text-primary uppercase tracking-[0.2em] mb-4">
                                <History size={16} /> Linha do Tempo de Auditoria
                            </h4>
                            <div className="space-y-4 max-h-[300px] overflow-y-auto pr-2 scrollbar-thin">
                                {isLoadingLogs ? (
                                    <div className="flex items-center justify-center py-8">
                                        <div className="w-6 h-6 border-2 border-primary border-t-transparent animate-spin rounded-full" />
                                    </div>
                                ) : taskLogs.length === 0 ? (
                                    <p className="text-center py-8 text-slate-400 font-bold text-sm italic">Nenhum histórico disponível para esta OS.</p>
                                ) : (
                                    taskLogs.map((log, idx) => (
                                        <div key={log.id} className="relative pl-6 pb-4 border-l-2 border-slate-100 last:border-0 last:pb-0">
                                            <div className="absolute left-[-9px] top-0 w-4 h-4 rounded-full bg-white border-2 border-primary" />
                                            <div className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm">
                                                <div className="flex justify-between items-start mb-2">
                                                    <div>
                                                        <p className="text-xs font-black text-slate-800">{log.userName}</p>
                                                        <p className="text-[10px] font-bold text-slate-400">{log.createdAt.toLocaleString('pt-BR')}</p>
                                                    </div>
                                                    <span className={`text-[8px] font-black uppercase px-2 py-0.5 rounded-md ${log.action === 'INSERT' ? 'bg-green-100 text-green-700' :
                                                            log.action === 'UPDATE' ? 'bg-blue-100 text-blue-700' : 'bg-red-100 text-red-700'
                                                        }`}>
                                                        {log.action === 'INSERT' ? 'CRIADO' : log.action === 'UPDATE' ? 'ATUALIZADO' : 'DELETADO'}
                                                    </span>
                                                </div>
                                                {log.action === 'UPDATE' && log.newData.status !== log.oldData.status && (
                                                    <p className="text-[10px] font-bold text-slate-600">
                                                        Alterou status de <span className="text-slate-400 line-through">{log.oldData.status}</span> para <span className="text-primary">{log.newData.status}</span>
                                                    </p>
                                                )}
                                                {log.action === 'INSERT' && (
                                                    <p className="text-[10px] font-bold text-slate-600">Ordem de serviço aberta no sistema.</p>
                                                )}
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>

                        <div className="pt-4 border-t border-slate-100">
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Descrição do Serviço</p>
                            <div className="bg-slate-50 p-4 rounded-xl text-xs font-bold text-slate-600 leading-relaxed">
                                {selectedTask.description || 'Sem descrição detalhada.'}
                            </div>
                        </div>
                    </div>
                )}
            </SimpleModal>

            <SimpleModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="Nova Ordem de Serviço">
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs font-black text-slate-500 uppercase tracking-widest mb-2">Tipo de Ativo</label>
                            <select
                                value={assetType} onChange={e => setAssetType(e.target.value as AssetType)}
                                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-800 text-xs"
                            >
                                {Object.values(AssetType).map(v => <option key={v} value={v}>{v}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="block text-xs font-black text-slate-500 uppercase tracking-widest mb-2">ID do Ativo</label>
                            <SearchableSelect
                                required
                                value={assetId}
                                onChange={handleAssetChange}
                                isLoading={isAssetLoading}
                                placeholder="Selecionar Ativo..."
                                options={assets.map(a => ({
                                    value: a.code,
                                    label: a.code,
                                    sublabel: a.city
                                }))}
                            />
                        </div>
                    </div>

                    <div className="bg-primary/5 p-4 rounded-xl border border-primary/10 mb-4">
                        <p className="text-[10px] font-black text-primary uppercase tracking-widest mb-1">Detalhes Automáticos</p>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <p className="text-[9px] text-slate-400 uppercase font-bold">Tipo</p>
                                <p className="text-xs font-black text-slate-700">{assetType || '---'}</p>
                            </div>
                            <div>
                                <p className="text-[9px] text-slate-400 uppercase font-bold">Endereço</p>
                                <p className="text-xs font-black text-slate-700 truncate">{address || '---'}</p>
                            </div>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs font-black text-slate-500 uppercase tracking-widest mb-2">Tipo de Serviço</label>
                            <select
                                value={serviceType} onChange={e => setServiceType(e.target.value as ServiceType)}
                                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-800 text-xs"
                            >
                                {Object.values(ServiceType).map(v => <option key={v} value={v}>{v}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="block text-xs font-black text-slate-500 uppercase tracking-widest mb-2">Data Agendada</label>
                            <input
                                type="date" required value={scheduledDate} onChange={e => setScheduledDate(e.target.value)}
                                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-800 text-xs"
                            />
                        </div>
                    </div>

                    <div>
                        <label className="block text-xs font-black text-slate-500 uppercase tracking-widest mb-2">Técnico Responsável</label>
                        <select
                            required value={technicianId} onChange={e => setTechnicianId(e.target.value)}
                            className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-800 text-xs"
                        >
                            <option value="">Selecione...</option>
                            {availableTechnicians.map(t => <option key={t.id} value={t.id}>{t.name} ({t.companyName})</option>)}
                        </select>
                    </div>

                    <div>
                        <label className="block text-xs font-black text-slate-500 uppercase tracking-widest mb-2">Endereço / Localização</label>
                        <input
                            type="text" required value={address} onChange={e => setAddress(e.target.value)}
                            className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-800 text-xs"
                            placeholder="Endereço da ocorrência"
                        />
                    </div>

                    <div>
                        <label className="block text-xs font-black text-slate-500 uppercase tracking-widest mb-2">Descrição</label>
                        <textarea
                            required value={description} onChange={e => setDescription(e.target.value)}
                            className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-800 text-xs h-24 resize-none"
                            placeholder="Descreva o serviço a ser realizado..."
                        />
                    </div>

                    <button
                        type="submit"
                        className="w-full py-4 bg-primary text-white font-black rounded-xl hover:bg-primary-600 transition-all shadow-lg shadow-primary/20"
                    >
                        Criar Ordem de Serviço
                    </button>
                </form>
            </SimpleModal>
        </div>
    );
};

export default OSView;
