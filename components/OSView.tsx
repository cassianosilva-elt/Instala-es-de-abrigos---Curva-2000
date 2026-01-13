
import React, { useState, useMemo } from 'react';
import { Task, TaskStatus, User, UserRole, AssetType, ServiceType } from '../types';
import { ClipboardList, Search, Filter, AlertCircle, CheckCircle, Clock, MapPin, Plus } from 'lucide-react';
import SimpleModal from './SimpleModal';

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

    // Form State (Ported from ChiefView)
    const [assetType, setAssetType] = useState<AssetType>(AssetType.BUS_SHELTER);
    const [assetId, setAssetId] = useState('');
    const [serviceType, setServiceType] = useState<ServiceType>(ServiceType.PREVENTIVE);
    const [technicianId, setTechnicianId] = useState('');
    const [scheduledDate, setScheduledDate] = useState('');
    const [description, setDescription] = useState('');
    const [address, setAddress] = useState('');

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
                            <div key={task.id} className="bg-white rounded-2xl border border-slate-200 p-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-6 shadow-sm hover:shadow-md transition-shadow group">
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
                                        <h3 className="text-lg font-black text-slate-800">{task.serviceType} <span className="text-primary/40 text-xs ml-1">#{task.assetId}</span></h3>
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
                                </div>
                            </div>
                        );
                    })
                )}
            </div>
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
                            <input
                                type="text" required value={assetId} onChange={e => setAssetId(e.target.value)}
                                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-800 text-xs"
                                placeholder="Ex: ABR-001"
                            />
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
