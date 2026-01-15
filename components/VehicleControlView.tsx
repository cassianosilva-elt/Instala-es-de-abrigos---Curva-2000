
import React, { useState, useEffect, useMemo } from 'react';
import { User, VehicleLog, Vehicle } from '../types';
import {
    getVehicleLogs,
    createVehicleLog,
    closeVehicleLog,
    getVehicles,
    createVehicle,
    updateVehicle,
    deleteVehicle,
    getEmployees
} from '../api/fieldManagerApi';
import { Employee } from '../types';
import {
    Car,
    User as UserIcon,
    Clock,
    Hash,
    Plus,
    Loader2,
    Calendar,
    Search,
    Gauge,
    AlertCircle,
    CheckCircle2,
    FileText,
    ArrowRightLeft,
    Settings2,
    Trash2,
    ChevronDown,
    Users as UsersIcon,
    X
} from 'lucide-react';

interface VehicleControlViewProps {
    currentUser: User;
}

export const VehicleControlView: React.FC<VehicleControlViewProps> = ({ currentUser }) => {
    const [activeTab, setActiveTab] = useState<'registros' | 'frota'>('registros');
    const [logs, setLogs] = useState<VehicleLog[]>([]);
    const [vehicles, setVehicles] = useState<Vehicle[]>([]);
    const [loading, setLoading] = useState(true);
    const [isLogModalOpen, setIsLogModalOpen] = useState(false);
    const [isVehicleModalOpen, setIsVehicleModalOpen] = useState(false);
    const [isCheckinModalOpen, setIsCheckinModalOpen] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [availableEmployees, setAvailableEmployees] = useState<Employee[]>([]);


    // New Log Form State
    const [formShift, setFormShift] = useState('Manhã');
    const [selectedVehicleId, setSelectedVehicleId] = useState('');
    const [formStartKm, setFormStartKm] = useState<number | ''>('');
    const [additionalCollabs, setAdditionalCollabs] = useState<string[]>([]);
    const [collabSearchTerm, setCollabSearchTerm] = useState('');
    const [isCollabListOpen, setIsCollabListOpen] = useState(false);


    // Check-in Form State
    const [activeLogForCheckin, setActiveLogForCheckin] = useState<VehicleLog | null>(null);
    const [formEndKm, setFormEndKm] = useState<number | ''>('');

    // New Vehicle Form State
    const [vehModel, setVehModel] = useState('');
    const [vehPlate, setVehPlate] = useState('');
    const [vehKm, setVehKm] = useState<number | ''>('');
    const [vehLastMaint, setVehLastMaint] = useState<number | ''>('');

    const [submitting, setSubmitting] = useState(false);

    useEffect(() => {
        loadAllData();
    }, [currentUser.companyId]);

    const loadAllData = async () => {
        setLoading(true);
        try {
            const [logsData, vehiclesData, employeesData] = await Promise.all([
                getVehicleLogs(currentUser.companyId),
                getVehicles(currentUser.companyId),
                getEmployees(currentUser.companyId)
            ]);
            setLogs(logsData);
            setVehicles(vehiclesData);
            // Filter out current user if they are also in employees list (by email)
            setAvailableEmployees(employeesData.filter(e => e.email !== currentUser.email));

        } catch (err) {
            console.error('Error loading data:', err);
        } finally {
            setLoading(false);
        }
    };

    const handleCreateLog = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedVehicleId || formStartKm === '') return;

        const vehicle = vehicles.find(v => v.id === selectedVehicleId);
        if (!vehicle) return;

        setSubmitting(true);
        try {
            await createVehicleLog({
                userId: currentUser.id,
                userName: currentUser.name,
                shift: formShift,
                occurrenceTime: new Date(),
                plate: vehicle.plate,
                model: vehicle.model,
                companyId: currentUser.companyId,
                vehicleId: vehicle.id,
                startKm: Number(formStartKm),
                additionalCollaborators: additionalCollabs,
                isActive: true
            });
            setIsLogModalOpen(false);
            setSelectedVehicleId('');
            setFormStartKm('');
            setAdditionalCollabs([]);
            loadAllData();

        } catch (err) {
            console.error('Error creating vehicle log:', err);
        } finally {
            setSubmitting(false);
        }
    };

    const handleCheckin = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!activeLogForCheckin || formEndKm === '' || !activeLogForCheckin.vehicleId) return;

        setSubmitting(true);
        try {
            await closeVehicleLog(activeLogForCheckin.id, activeLogForCheckin.vehicleId, Number(formEndKm));
            setIsCheckinModalOpen(false);
            setActiveLogForCheckin(null);
            setFormEndKm('');
            loadAllData();
        } catch (err) {
            console.error('Error during check-in:', err);
        } finally {
            setSubmitting(false);
        }
    };

    const handleCreateVehicle = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!vehModel || !vehPlate || vehKm === '') return;

        setSubmitting(true);
        try {
            await createVehicle({
                model: vehModel,
                plate: vehPlate.toUpperCase(),
                companyId: currentUser.companyId,
                currentKm: Number(vehKm),
                lastMaintenanceKm: Number(vehLastMaint || vehKm),
                status: 'Disponível'
            });
            setIsVehicleModalOpen(false);
            setVehModel('');
            setVehPlate('');
            setVehKm('');
            setVehLastMaint('');
            loadAllData();
        } catch (err) {
            console.error('Error creating vehicle:', err);
        } finally {
            setSubmitting(false);
        }
    };

    const handleDeleteVehicle = async (id: string) => {
        if (!confirm('Tem certeza que deseja remover este veículo da frota?')) return;
        try {
            await deleteVehicle(id);
            loadAllData();
        } catch (err) {
            console.error('Error deleting vehicle:', err);
        }
    };

    const filteredLogs = logs.filter(log =>
        log.userName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        log.plate.toLowerCase().includes(searchTerm.toLowerCase()) ||
        log.model.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const filteredVehicles = vehicles.filter(v =>
        v.model.toLowerCase().includes(searchTerm.toLowerCase()) ||
        v.plate.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const stats = useMemo(() => {
        const active = logs.filter(l => l.isActive).length;
        const maintenance = vehicles.filter(v => (v.currentKm - v.lastMaintenanceKm) >= 10000).length;
        return { active, maintenance };
    }, [logs, vehicles]);

    const generateReport = () => {
        window.print();
    };

    return (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700 pb-20">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 print:hidden">
                <div>
                    <h2 className="text-4xl font-black text-slate-900 tracking-tighter uppercase mb-2">Controle de Frota</h2>
                    <p className="text-slate-500 font-medium">Gestão de veículos, manutenções e logs de uso</p>
                </div>

                <div className="flex gap-3">
                    <button
                        onClick={generateReport}
                        className="flex items-center justify-center gap-3 px-6 py-4 bg-white border border-slate-200 text-slate-600 rounded-3xl font-black text-xs uppercase tracking-[0.2em] shadow-sm hover:bg-slate-50 transition-all"
                    >
                        <FileText size={18} />
                        Relatório
                    </button>

                    {activeTab === 'registros' ? (
                        <button
                            onClick={() => setIsLogModalOpen(true)}
                            className="flex items-center justify-center gap-3 px-8 py-4 bg-primary text-white rounded-3xl font-black text-xs uppercase tracking-[0.2em] shadow-2xl shadow-primary/20 hover:scale-105 transition-all group"
                        >
                            <ArrowRightLeft size={18} className="group-hover:rotate-180 transition-transform duration-500" />
                            Registrar Saída
                        </button>
                    ) : (
                        <button
                            onClick={() => setIsVehicleModalOpen(true)}
                            className="flex items-center justify-center gap-3 px-8 py-4 bg-primary text-white rounded-3xl font-black text-xs uppercase tracking-[0.2em] shadow-2xl shadow-primary/20 hover:scale-105 transition-all group"
                        >
                            <Plus size={18} className="group-hover:rotate-90 transition-transform duration-300" />
                            Novo Veículo
                        </button>
                    )}
                </div>
            </div>

            {/* Tabs */}
            <div className="flex gap-2 p-1 bg-slate-100 rounded-[2rem] w-fit print:hidden">
                <button
                    onClick={() => setActiveTab('registros')}
                    className={`px-8 py-3 rounded-[1.5rem] font-black text-[10px] uppercase tracking-widest transition-all ${activeTab === 'registros' ? 'bg-white text-primary shadow-sm' : 'text-slate-400 hover:text-slate-600'
                        }`}
                >
                    Registros de Uso
                </button>
                <button
                    onClick={() => setActiveTab('frota')}
                    className={`px-8 py-3 rounded-[1.5rem] font-black text-[10px] uppercase tracking-widest transition-all ${activeTab === 'frota' ? 'bg-white text-primary shadow-sm' : 'text-slate-400 hover:text-slate-600'
                        }`}
                >
                    Frota da Empresa
                </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-6 print:hidden">
                <div className="md:col-span-2">
                    <div className="relative group">
                        <Search className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-primary transition-colors" size={20} />
                        <input
                            type="text"
                            placeholder={activeTab === 'registros' ? "Pesquisar logs..." : "Pesquisar frota..."}
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full pl-16 pr-8 py-6 bg-white border border-slate-100 rounded-[2rem] text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-4 focus:ring-primary/5 focus:border-primary transition-all shadow-sm"
                        />
                    </div>
                </div>

                <div className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm flex items-center gap-4">
                    <div className="w-12 h-12 bg-orange-50 rounded-2xl flex items-center justify-center text-orange-600">
                        <ArrowRightLeft size={24} />
                    </div>
                    <div>
                        <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Veículos em Uso</p>
                        <p className="text-2xl font-black text-slate-900">{stats.active}</p>
                    </div>
                </div>

                <div className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm flex items-center gap-4">
                    <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${stats.maintenance > 0 ? 'bg-red-50 text-red-600 animate-pulse' : 'bg-green-50 text-green-600'}`}>
                        <AlertCircle size={24} />
                    </div>
                    <div>
                        <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Alertas Manutenção</p>
                        <p className="text-2xl font-black text-slate-900">{stats.maintenance}</p>
                    </div>
                </div>
            </div>

            <div className="bg-white rounded-[2.5rem] border border-slate-100 shadow-xl shadow-slate-200/50 overflow-hidden print:shadow-none print:border-none">
                {activeTab === 'registros' ? (
                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="border-b border-slate-50">
                                    <th className="px-8 py-6 text-[10px] font-black uppercase text-slate-400 tracking-[0.2em]">Motorista</th>
                                    <th className="px-8 py-6 text-[10px] font-black uppercase text-slate-400 tracking-[0.2em]">Veículo</th>
                                    <th className="px-8 py-6 text-[10px] font-black uppercase text-slate-400 tracking-[0.2em]">KM Rodados</th>
                                    <th className="px-8 py-6 text-[10px] font-black uppercase text-slate-400 tracking-[0.2em]">Status/Hora</th>
                                    <th className="px-8 py-6 text-right print:hidden"></th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-50">
                                {loading ? (
                                    <tr><td colSpan={5} className="py-20 text-center"><Loader2 className="w-10 h-10 text-primary animate-spin mx-auto" /></td></tr>
                                ) : filteredLogs.length === 0 ? (
                                    <tr><td colSpan={5} className="py-20 text-center text-slate-400 font-medium">Nenhum registro encontrado</td></tr>
                                ) : (
                                    filteredLogs.map((log) => {
                                        const kmDriven = log.endKm && log.startKm ? log.endKm - log.startKm : null;
                                        return (
                                            <tr key={log.id} className="hover:bg-slate-50/50 transition-colors group">
                                                <td className="px-8 py-6">
                                                    <div className="flex items-center gap-4">
                                                        <div className="w-10 h-10 bg-primary-50 rounded-2xl flex items-center justify-center text-primary font-black text-xs uppercase">
                                                            {log.userName.charAt(0)}
                                                        </div>
                                                        <div>
                                                            <p className="text-sm font-black text-slate-900 tracking-tight">{log.userName}</p>
                                                            {log.additionalCollaborators && log.additionalCollaborators.length > 0 && (
                                                                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-tight">
                                                                    + {log.additionalCollaborators.join(', ')}
                                                                </p>
                                                            )}
                                                        </div>
                                                    </div>
                                                </td>

                                                <td className="px-8 py-6">
                                                    <p className="text-sm font-black text-slate-900 tracking-tight uppercase">{log.model}</p>
                                                    <p className="text-[10px] font-bold text-slate-400 tracking-wider font-mono">{log.plate}</p>
                                                </td>
                                                <td className="px-8 py-6">
                                                    {log.isActive ? (
                                                        <div className="flex items-center gap-1.5 text-orange-600 font-bold text-xs uppercase tracking-wider">
                                                            <Gauge size={14} /> Em percurso...
                                                        </div>
                                                    ) : (
                                                        <div className="space-y-1">
                                                            <p className="text-sm font-black text-slate-900">{kmDriven} KM</p>
                                                            <p className="text-[10px] text-slate-400 font-medium">{log.startKm} → {log.endKm}</p>
                                                        </div>
                                                    )}
                                                </td>
                                                <td className="px-8 py-6">
                                                    <div className="flex items-center gap-2 mb-1">
                                                        <Clock size={12} className="text-slate-400" />
                                                        <span className={`text-[10px] font-black uppercase tracking-widest ${log.isActive ? 'text-orange-600' : 'text-slate-400'}`}>
                                                            {log.isActive ? 'Em Aberto' : 'Finalizado'}
                                                        </span>
                                                    </div>
                                                    <p className="text-[10px] text-slate-400 font-medium uppercase tracking-tighter">
                                                        Saída: {log.occurrenceTime.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                                                        {log.checkinTime && ` | Volta: ${log.checkinTime.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`}
                                                    </p>
                                                </td>
                                                <td className="px-8 py-6 text-right print:hidden">
                                                    {log.isActive && (
                                                        <button
                                                            onClick={() => {
                                                                setActiveLogForCheckin(log);
                                                                setIsCheckinModalOpen(true);
                                                            }}
                                                            className="px-4 py-2 bg-slate-900 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-black transition-all"
                                                        >
                                                            Dar Entrada
                                                        </button>
                                                    )}
                                                </td>
                                            </tr>
                                        );
                                    })
                                )}
                            </tbody>
                        </table>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="border-b border-slate-50">
                                    <th className="px-8 py-6 text-[10px] font-black uppercase text-slate-400 tracking-[0.2em]">Veículo</th>
                                    <th className="px-8 py-6 text-[10px] font-black uppercase text-slate-400 tracking-[0.2em]">Quilometragem</th>
                                    <th className="px-8 py-6 text-[10px] font-black uppercase text-slate-400 tracking-[0.2em]">Próx. Manutenção</th>
                                    <th className="px-8 py-6 text-[10px] font-black uppercase text-slate-400 tracking-[0.2em]">Status</th>
                                    <th className="px-8 py-6 text-right print:hidden"></th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-50">
                                {filteredVehicles.map(v => {
                                    const kmSinceLast = v.currentKm - v.lastMaintenanceKm;
                                    const progress = Math.min(100, (kmSinceLast / 10000) * 100);
                                    const isAlert = kmSinceLast >= 10000;
                                    return (
                                        <tr key={v.id} className="hover:bg-slate-50/50 transition-colors group">
                                            <td className="px-8 py-6">
                                                <div className="flex items-center gap-4">
                                                    <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${isAlert ? 'bg-red-50 text-red-600' : 'bg-slate-50 text-slate-400'}`}>
                                                        <Car size={24} />
                                                    </div>
                                                    <div>
                                                        <p className="text-sm font-black text-slate-900 tracking-tight uppercase">{v.model}</p>
                                                        <p className="text-[10px] font-bold text-slate-400 tracking-wider font-mono uppercase">{v.plate}</p>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-8 py-6">
                                                <div className="flex items-center gap-2 text-slate-900 font-bold mb-1">
                                                    <Gauge size={14} className="text-slate-400" />
                                                    {v.currentKm.toLocaleString()} KM
                                                </div>
                                                <p className="text-[10px] text-slate-400 font-medium">Última revisão: {v.lastMaintenanceKm.toLocaleString()} KM</p>
                                            </td>
                                            <td className="px-8 py-6 max-w-[200px]">
                                                <div className="flex justify-between items-center mb-1.5">
                                                    <span className="text-[9px] font-black uppercase tracking-widest text-slate-400">Progresso</span>
                                                    <span className={`text-[10px] font-black ${isAlert ? 'text-red-600' : 'text-slate-600'}`}>{10000 - kmSinceLast} KM falta</span>
                                                </div>
                                                <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                                                    <div
                                                        className={`h-full transition-all duration-1000 ${isAlert ? 'bg-red-500' : 'bg-primary'}`}
                                                        style={{ width: `${progress}%` }}
                                                    />
                                                </div>
                                            </td>
                                            <td className="px-8 py-6">
                                                <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${v.status === 'Disponível' ? 'bg-green-50 text-green-600' :
                                                    v.status === 'Em Uso' ? 'bg-orange-50 text-orange-600' :
                                                        'bg-red-50 text-red-600'
                                                    }`}>
                                                    {v.status === 'Disponível' ? <CheckCircle2 size={12} /> : <AlertCircle size={12} />}
                                                    {v.status}
                                                </span>
                                            </td>
                                            <td className="px-8 py-6 text-right print:hidden">
                                                <div className="flex justify-end gap-2">
                                                    <button className="p-2 text-slate-400 hover:text-primary transition-colors"><Settings2 size={16} /></button>
                                                    <button
                                                        onClick={() => handleDeleteVehicle(v.id)}
                                                        className="p-2 text-slate-400 hover:text-red-600 transition-colors"
                                                    >
                                                        <Trash2 size={16} />
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* MODAL: SAÍDA (CHECKOUT) */}
            {isLogModalOpen && (
                <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-white w-full max-w-lg rounded-[3rem] shadow-2xl animate-in zoom-in-95 fade-in duration-300 overflow-hidden max-h-[90vh] flex flex-col">
                        <div className="px-10 py-10 bg-primary/5 border-b border-primary/10 flex items-center justify-between shrink-0">
                            <div>
                                <h3 className="text-2xl font-black text-slate-900 tracking-tighter uppercase mb-1">Registrar Saída</h3>
                                <p className="text-slate-500 text-sm font-medium">Início de percurso do colaborador</p>
                            </div>
                            <ArrowRightLeft className="text-primary" size={32} />
                        </div>

                        <form onSubmit={handleCreateLog} className="p-10 space-y-6 overflow-y-auto">
                            <div className="space-y-2">
                                <label className="text-[10px] font-black uppercase text-slate-400 tracking-[0.2em] ml-2">Selecione o Veículo</label>
                                <div className="relative">
                                    <Car className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                                    <select
                                        required
                                        value={selectedVehicleId}
                                        onChange={(e) => {
                                            const vehId = e.target.value;
                                            setSelectedVehicleId(vehId);
                                            const veh = vehicles.find(v => v.id === vehId);
                                            if (veh) setFormStartKm(veh.currentKm);
                                        }}
                                        className="w-full pl-12 pr-6 py-4 bg-slate-50 border-none rounded-2xl text-slate-900 appearance-none focus:ring-4 focus:ring-primary/5 transition-all text-sm font-black uppercase tracking-tight"
                                    >
                                        <option value="">Escolha um carro disponível</option>
                                        {vehicles.filter(v => v.status === 'Disponível').map(v => (
                                            <option key={v.id} value={v.id}>{v.model} - {v.plate}</option>
                                        ))}
                                    </select>
                                    <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={18} />
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black uppercase text-slate-400 tracking-[0.2em] ml-2">Turno</label>
                                    <select
                                        value={formShift}
                                        onChange={(e) => setFormShift(e.target.value)}
                                        className="w-full px-6 py-4 bg-slate-50 border-none rounded-2xl text-slate-900 focus:ring-4 focus:ring-primary/5 transition-all text-xs font-black uppercase"
                                    >
                                        <option>Manhã</option>
                                        <option>Tarde</option>
                                        <option>Noite</option>
                                    </select>
                                </div>
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black uppercase text-slate-400 tracking-[0.2em] ml-2">KM Inicial</label>
                                    <div className="relative">
                                        <Gauge className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                                        <input
                                            type="number"
                                            required
                                            placeholder="00000"
                                            value={formStartKm}
                                            onChange={(e) => setFormStartKm(e.target.value ? Number(e.target.value) : '')}
                                            className="w-full pl-10 pr-6 py-4 bg-slate-50 border-none rounded-2xl text-slate-900 focus:ring-4 focus:ring-primary/5 transition-all text-sm font-bold"
                                        />
                                    </div>
                                </div>
                            </div>

                            <div className="space-y-4">
                                <label className="text-[10px] font-black uppercase text-slate-400 tracking-[0.2em] ml-2 flex items-center gap-2">
                                    <UsersIcon size={14} /> Equipe (Mínimo 2 pessoas)
                                </label>

                                <div className="flex flex-wrap gap-2 mb-4">
                                    <div className="px-4 py-2 bg-primary/10 text-primary border border-primary/20 rounded-xl text-[10px] font-black uppercase tracking-wider flex items-center gap-2">
                                        <div className="w-1.5 h-1.5 bg-primary rounded-full animate-pulse" />
                                        {currentUser.name} (Você)
                                    </div>
                                    {additionalCollabs.map(collab => (
                                        <button
                                            key={collab}
                                            type="button"
                                            onClick={() => setAdditionalCollabs(prev => prev.filter(c => c !== collab))}
                                            className="px-4 py-2 bg-slate-100 text-slate-600 border border-slate-200 rounded-xl text-[10px] font-black uppercase tracking-wider hover:bg-red-50 hover:text-red-600 hover:border-red-100 transition-all flex items-center gap-2 group"
                                        >
                                            {collab}
                                            <X size={12} className="group-hover:scale-110 transition-transform" />
                                        </button>
                                    ))}
                                </div>

                                <div className="relative group">
                                    <div className="relative">
                                        <UsersIcon className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                                        <input
                                            type="text"
                                            placeholder="Pesquisar colaborador por nome..."
                                            value={collabSearchTerm}
                                            onChange={(e) => {
                                                setCollabSearchTerm(e.target.value);
                                                setIsCollabListOpen(true);
                                            }}
                                            onFocus={() => setIsCollabListOpen(true)}
                                            className="w-full pl-12 pr-6 py-4 bg-slate-50 border-none rounded-2xl text-slate-900 focus:ring-4 focus:ring-primary/5 transition-all text-sm font-bold placeholder:text-slate-400"
                                        />
                                        {collabSearchTerm && (
                                            <button
                                                type="button"
                                                onClick={() => setCollabSearchTerm('')}
                                                className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-300 hover:text-slate-500"
                                            >
                                                <X size={14} />
                                            </button>
                                        )}
                                    </div>

                                    {isCollabListOpen && (
                                        <>
                                            <div
                                                className="fixed inset-0 z-[55]"
                                                onClick={() => setIsCollabListOpen(false)}
                                            />
                                            <div className="absolute top-full left-0 right-0 mt-2 bg-white border border-slate-100 rounded-2xl shadow-xl z-[60] max-h-60 overflow-y-auto animate-in fade-in slide-in-from-top-2 duration-200">
                                                {availableEmployees
                                                    .filter(e =>
                                                        !additionalCollabs.includes(e.name) &&
                                                        e.name.toLowerCase().includes(collabSearchTerm.toLowerCase())
                                                    )
                                                    .length === 0 ? (
                                                    <div className="p-4 text-center text-slate-400 text-xs font-bold uppercase tracking-widest">
                                                        Nenhum colaborador encontrado
                                                    </div>
                                                ) : (
                                                    availableEmployees
                                                        .filter(e =>
                                                            !additionalCollabs.includes(e.name) &&
                                                            e.name.toLowerCase().includes(collabSearchTerm.toLowerCase())
                                                        )
                                                        .map(e => (
                                                            <button
                                                                key={e.id}
                                                                type="button"
                                                                onClick={() => {
                                                                    setAdditionalCollabs(prev => [...prev, e.name]);
                                                                    setCollabSearchTerm('');
                                                                    setIsCollabListOpen(false);
                                                                }}
                                                                className="w-full p-4 text-left hover:bg-slate-50 transition-colors border-b border-slate-50 last:border-none flex items-center justify-between group"
                                                            >
                                                                <div>
                                                                    <p className="text-sm font-black text-slate-700 uppercase">{e.name}</p>
                                                                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">{e.role.replace('PARCEIRO_', '').toLowerCase()}</p>
                                                                </div>
                                                                <Plus size={14} className="text-slate-300 group-hover:text-primary transition-colors" />
                                                            </button>
                                                        ))
                                                )
                                                }
                                            </div>
                                        </>
                                    )}
                                </div>

                                {additionalCollabs.length < 2 && (
                                    <div className="flex items-center gap-2 p-4 bg-orange-50 text-orange-600 rounded-2xl border border-orange-100 animate-in fade-in slide-in-from-top-2">
                                        <AlertCircle size={16} />
                                        <p className="text-[10px] font-black uppercase tracking-widest">É obrigatório pelo menos +2 colaboradores</p>
                                    </div>
                                )}
                            </div>

                            <div className="flex gap-4 pt-4">
                                <button type="button" onClick={() => setIsLogModalOpen(false)} className="flex-1 py-5 rounded-2xl font-black text-xs uppercase tracking-widest text-slate-400 hover:bg-slate-50 transition-all">Cancelar</button>
                                <button
                                    type="submit"
                                    disabled={submitting || !selectedVehicleId || additionalCollabs.length < 2}
                                    className="flex-[2] py-5 bg-primary text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl shadow-primary/20 disabled:opacity-50 disabled:shadow-none hover:scale-[1.02] active:scale-95 transition-all flex items-center justify-center gap-2"
                                >
                                    {submitting ? <Loader2 size={18} className="animate-spin" /> : 'Confirmar Saída'}
                                </button>
                            </div>

                        </form>
                    </div>
                </div>
            )}

            {/* MODAL: ENTRADA (CHECK-IN) */}
            {isCheckinModalOpen && activeLogForCheckin && (
                <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-white w-full max-w-lg rounded-[3rem] shadow-2xl animate-in zoom-in-95 fade-in duration-300 overflow-hidden max-h-[90vh] flex flex-col">
                        <div className="px-10 py-10 bg-slate-900 text-white flex items-center justify-between shrink-0">
                            <div>
                                <h3 className="text-2xl font-black tracking-tighter uppercase mb-1">Registrar Entrada</h3>
                                <p className="text-slate-400 text-sm font-medium">Finalização do percurso</p>
                            </div>
                            <Car className="text-primary" size={32} />
                        </div>

                        <form onSubmit={handleCheckin} className="p-10 space-y-6 overflow-y-auto">
                            <div className="p-6 bg-slate-50 rounded-2xl space-y-2">
                                <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Resumo da Saída</p>
                                <div className="flex justify-between items-end">
                                    <div>
                                        <p className="text-sm font-black text-slate-900 uppercase">{activeLogForCheckin.model}</p>
                                        <p className="text-xs text-slate-500 font-bold">{activeLogForCheckin.plate}</p>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-[10px] font-black text-slate-400 uppercase">KM Inicial</p>
                                        <p className="text-sm font-black text-slate-900">{activeLogForCheckin.startKm} KM</p>
                                    </div>
                                </div>
                            </div>

                            <div className="space-y-2">
                                <label className="text-[10px] font-black uppercase text-slate-400 tracking-[0.2em] ml-2">KM Final ao Chegar</label>
                                <div className="relative">
                                    <Gauge className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
                                    <input
                                        type="number"
                                        autoFocus
                                        required
                                        min={activeLogForCheckin.startKm}
                                        placeholder="00000"
                                        value={formEndKm}
                                        onChange={(e) => setFormEndKm(e.target.value ? Number(e.target.value) : '')}
                                        className="w-full pl-16 pr-8 py-6 bg-slate-50 border-none rounded-[1.5rem] text-2xl font-black text-slate-900 focus:ring-4 focus:ring-primary/5 transition-all"
                                    />
                                </div>
                            </div>

                            {formEndKm !== '' && (
                                <div className="flex items-center gap-2 p-4 bg-primary-50 text-primary rounded-2xl animate-in fade-in slide-in-from-top-2 duration-300">
                                    <div className="w-8 h-8 bg-white rounded-xl flex items-center justify-center shadow-sm">
                                        <ArrowRightLeft size={16} />
                                    </div>
                                    <p className="text-xs font-black uppercase tracking-widest">
                                        Distância total: <span className="text-lg ml-1">{(Number(formEndKm) - (activeLogForCheckin.startKm || 0))} KM</span>
                                    </p>
                                </div>
                            )}

                            <div className="flex gap-4 pt-4">
                                <button type="button" onClick={() => setIsCheckinModalOpen(false)} className="flex-1 py-5 rounded-2xl font-black text-xs uppercase tracking-widest text-slate-400 hover:bg-slate-50 transition-all">Cancelar</button>
                                <button
                                    type="submit"
                                    disabled={submitting || formEndKm === ''}
                                    className="flex-[2] py-5 bg-slate-900 text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl shadow-slate-900/10 hover:scale-[1.02] active:scale-95 transition-all flex items-center justify-center gap-2"
                                >
                                    {submitting ? <Loader2 size={18} className="animate-spin" /> : 'Finalizar Percurso'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* MODAL: NOVO VEÍCULO */}
            {isVehicleModalOpen && (
                <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-white w-full max-w-lg rounded-[3rem] shadow-2xl animate-in zoom-in-95 fade-in duration-300 overflow-hidden max-h-[90vh] flex flex-col">
                        <div className="px-10 py-10 bg-primary text-white flex items-center justify-between shrink-0">
                            <div>
                                <h3 className="text-2xl font-black tracking-tighter uppercase mb-1">Adicionar Veículo</h3>
                                <p className="text-primary-100 text-sm font-medium">Cadastrar novo carro na frota</p>
                            </div>
                            <Car size={32} />
                        </div>

                        <form onSubmit={handleCreateVehicle} className="p-10 space-y-5 overflow-y-auto">
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black uppercase text-slate-400 tracking-[0.2em] ml-2">Modelo</label>
                                    <input
                                        type="text"
                                        required
                                        placeholder="Ex: Fiat Mobi"
                                        value={vehModel}
                                        onChange={(e) => setVehModel(e.target.value)}
                                        className="w-full px-6 py-4 bg-slate-50 border-none rounded-2xl text-slate-900 focus:ring-4 focus:ring-primary/5 transition-all text-sm font-bold uppercase"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black uppercase text-slate-400 tracking-[0.2em] ml-2">Placa</label>
                                    <input
                                        type="text"
                                        required
                                        placeholder="ABC1D23"
                                        value={vehPlate}
                                        onChange={(e) => setVehPlate(e.target.value)}
                                        className="w-full px-6 py-4 bg-slate-50 border-none rounded-2xl text-slate-900 focus:ring-4 focus:ring-primary/5 transition-all text-sm font-bold uppercase font-mono"
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black uppercase text-slate-400 tracking-[0.2em] ml-2">KM Atual</label>
                                    <input
                                        type="number"
                                        required
                                        placeholder="0"
                                        value={vehKm}
                                        onChange={(e) => setVehKm(e.target.value ? Number(e.target.value) : '')}
                                        className="w-full px-6 py-4 bg-slate-50 border-none rounded-2xl text-slate-900 focus:ring-4 focus:ring-primary/5 transition-all text-sm font-bold"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black uppercase text-slate-400 tracking-[0.2em] ml-2">Última Revisão (KM)</label>
                                    <input
                                        type="number"
                                        required
                                        placeholder="0"
                                        value={vehLastMaint}
                                        onChange={(e) => setVehLastMaint(e.target.value ? Number(e.target.value) : '')}
                                        className="w-full px-6 py-4 bg-slate-50 border-none rounded-2xl text-slate-900 focus:ring-4 focus:ring-primary/5 transition-all text-sm font-bold"
                                    />
                                </div>
                            </div>

                            <div className="flex gap-4 pt-4">
                                <button type="button" onClick={() => setIsVehicleModalOpen(false)} className="flex-1 py-5 rounded-2xl font-black text-xs uppercase tracking-widest text-slate-400 hover:bg-slate-50 transition-all">Cancelar</button>
                                <button
                                    type="submit"
                                    disabled={submitting}
                                    className="flex-[2] py-5 bg-primary text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl shadow-primary/20 hover:scale-[1.02] active:scale-95 transition-all flex items-center justify-center gap-2"
                                >
                                    {submitting ? <Loader2 size={18} className="animate-spin" /> : 'Cadastrar na Frota'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};
