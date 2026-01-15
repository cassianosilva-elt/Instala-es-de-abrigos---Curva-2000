import React, { useMemo, useState } from 'react';
import { Task, TaskStatus, User, UserRole } from '../types';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, Cell, PieChart, Pie } from 'recharts';
import { FileSpreadsheet, TrendingUp, Users, Activity, Download, Calendar, Filter, Building2, ChevronDown } from 'lucide-react';

interface Props {
    tasks: Task[];
    users: User[];
    currentUser: User;
}

export const ReportsView: React.FC<Props> = ({ tasks, users, currentUser }) => {
    const [selectedMonth, setSelectedMonth] = useState<string>(new Date().toISOString().slice(0, 7)); // YYYY-MM
    const [selectedCompany, setSelectedCompany] = useState<string>('all');

    const companies = useMemo(() => {
        const unique = Array.from(new Set(tasks.map(t => t.companyId)));
        return unique.map(id => ({
            id: id as string,
            name: id === 'internal' ? 'Eletromidia (Interno)' : (id as string).toUpperCase()
        }));
    }, [tasks]);

    const filteredTasks = useMemo(() => {
        return tasks.filter(t => {
            const matchesMonth = t.scheduledDate.startsWith(selectedMonth);
            const matchesCompany = selectedCompany === 'all' || t.companyId === selectedCompany;
            return matchesMonth && matchesCompany;
        });
    }, [tasks, selectedMonth, selectedCompany]);

    const stats = useMemo(() => {
        const total = filteredTasks.length;
        const completed = filteredTasks.filter(t => t.status === TaskStatus.COMPLETED).length;
        const sla = total > 0 ? (completed / total) * 100 : 0;
        const blocked = filteredTasks.filter(t => t.status === TaskStatus.BLOCKED).length;
        const pending = filteredTasks.filter(t => t.status === TaskStatus.PENDING || t.status === TaskStatus.IN_PROGRESS).length;

        return { total, completed, sla, blocked, pending };
    }, [filteredTasks]);

    const performanceByCompany = useMemo(() => {
        const groups: Record<string, { name: string, total: number, completed: number }> = {};

        filteredTasks.forEach(t => {
            if (!groups[t.companyId]) {
                groups[t.companyId] = {
                    name: t.companyId === 'internal' ? 'Interno' : t.companyId.toUpperCase(),
                    total: 0,
                    completed: 0
                };
            }
            groups[t.companyId].total++;
            if (t.status === TaskStatus.COMPLETED) groups[t.companyId].completed++;
        });

        return Object.values(groups).map(g => ({
            name: g.name,
            sla: (g.completed / g.total) * 100,
            total: g.total
        })).sort((a, b) => b.sla - a.sla);
    }, [filteredTasks]);

    const techProductivity = useMemo(() => {
        const groups: Record<string, { name: string, completed: number }> = {};

        filteredTasks.forEach(t => {
            if (t.status === TaskStatus.COMPLETED) {
                if (!groups[t.technicianId]) {
                    const user = users.find(u => u.id === t.technicianId);
                    groups[t.technicianId] = { name: user?.name || '---', completed: 0 };
                }
                groups[t.technicianId].completed++;
            }
        });

        return Object.values(groups)
            .sort((a, b) => b.completed - a.completed)
            .slice(0, 5);
    }, [filteredTasks, users]);

    const handleExportFullReport = () => {
        const headers = ['Data', 'Ativo', 'Tipo', 'Servico', 'Status', 'Tecnico', 'Empresa'];
        const csvRows = filteredTasks.map(t => [
            t.scheduledDate,
            t.assetId,
            t.asset?.type || '',
            t.serviceType,
            t.status,
            users.find(u => u.id === t.technicianId)?.name || '---',
            t.companyId
        ]);

        const content = [headers, ...csvRows].map(r => r.join(';')).join('\n');
        const blob = new Blob(["\ufeff" + content], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `Relatorio_Consolidado_${selectedMonth}.csv`;
        link.click();
    };

    return (
        <div className="space-y-8 pb-12 animate-in fade-in slide-in-from-bottom-4 duration-700">
            {/* Header com Filtros */}
            <div className="bg-white p-6 md:p-8 rounded-[32px] border border-slate-100 shadow-sm flex flex-col xl:flex-row justify-between gap-6">
                <div>
                    <h2 className="text-2xl font-black text-slate-900 uppercase tracking-tight">Performance Analytics</h2>
                    <p className="text-sm text-slate-400 font-bold uppercase tracking-widest mt-1">Visão holística da operação campo</p>
                </div>

                <div className="flex flex-wrap items-center gap-4">
                    <div className="flex items-center gap-2 bg-slate-50 px-4 py-2 rounded-2xl border border-slate-100">
                        <Calendar size={18} className="text-primary" />
                        <input
                            type="month"
                            className="bg-transparent border-none text-sm font-black text-slate-700 outline-none"
                            value={selectedMonth}
                            onChange={(e) => setSelectedMonth(e.target.value)}
                        />
                    </div>

                    <div className="flex items-center gap-2 bg-slate-50 px-4 py-2 rounded-2xl border border-slate-100">
                        <Building2 size={18} className="text-primary" />
                        <select
                            className="bg-transparent border-none text-sm font-black text-slate-700 outline-none min-w-[150px]"
                            value={selectedCompany}
                            onChange={(e) => setSelectedCompany(e.target.value)}
                        >
                            <option value="all">Todas as Empresas</option>
                            {companies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                        </select>
                    </div>

                    <button
                        onClick={handleExportFullReport}
                        className="flex items-center gap-2 bg-primary text-white px-6 py-3 rounded-2xl font-black text-xs uppercase tracking-widest hover:scale-105 transition-all shadow-lg shadow-primary/20"
                    >
                        <FileSpreadsheet size={18} />
                        Exportar CSV
                    </button>
                </div>
            </div>

            {/* KPIs Principais */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <KPICard label="Volume Total" value={stats.total} icon={<Activity className="text-blue-500" />} color="blue" />
                <KPICard label="Concluídas" value={stats.completed} icon={<CheckCircle size={20} className="text-green-500" />} color="green" />
                <KPICard label="SLA Global" value={`${stats.sla.toFixed(1)}%`} icon={<TrendingUp className="text-primary" />} color="orange" />
                <KPICard label="Bloqueios" value={stats.blocked} icon={<AlertCircle size={20} className="text-red-500" />} color="red" />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Ranking de Parceiros */}
                <div className="bg-white p-8 rounded-[32px] border border-slate-100 shadow-sm">
                    <h3 className="text-xs font-black text-slate-400 uppercase tracking-[0.2em] mb-8 flex items-center gap-2">
                        <Building2 size={16} className="text-primary" /> Performance por Parceiro (SLA)
                    </h3>
                    <div className="space-y-6">
                        {performanceByCompany.map((pc, idx) => (
                            <div key={idx} className="space-y-2">
                                <div className="flex justify-between items-end">
                                    <div>
                                        <p className="text-sm font-black text-slate-800">{pc.name}</p>
                                        <p className="text-[10px] font-bold text-slate-400 uppercase">{pc.total} Ordens de Serviço</p>
                                    </div>
                                    <p className="text-sm font-black text-primary">{pc.sla.toFixed(1)}%</p>
                                </div>
                                <div className="h-2 bg-slate-50 rounded-full overflow-hidden">
                                    <div
                                        className="h-full bg-primary transition-all duration-1000"
                                        style={{ width: `${pc.sla}%` }}
                                    />
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Produtividade Técnica */}
                <div className="bg-white p-8 rounded-[32px] border border-slate-100 shadow-sm">
                    <h3 className="text-xs font-black text-slate-400 uppercase tracking-[0.2em] mb-8 flex items-center gap-2">
                        <Users size={16} className="text-primary" /> Top 5 Produtividade (Tecnicos)
                    </h3>
                    <div className="h-[300px]">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={techProductivity} layout="vertical">
                                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
                                <XAxis type="number" hide />
                                <YAxis dataKey="name" type="category" axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 800, fill: '#64748b' }} width={100} />
                                <Tooltip
                                    cursor={{ fill: '#f8fafc' }}
                                    contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                                />
                                <Bar dataKey="completed" fill="#FA3A00" radius={[0, 8, 8, 0]} barSize={20}>
                                    {techProductivity.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fillOpacity={1 - index * 0.15} />
                                    ))}
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            </div>
        </div>
    );
};

const KPICard = ({ label, value, icon, color }: { label: string, value: string | number, icon: React.ReactNode, color: string }) => {
    const colors = {
        blue: 'bg-blue-50 text-blue-600',
        green: 'bg-green-50 text-green-600',
        orange: 'bg-primary/5 text-primary',
        red: 'bg-red-50 text-red-600'
    };

    return (
        <div className="bg-white p-8 rounded-[32px] border border-slate-100 shadow-sm flex flex-col gap-4 group hover:shadow-xl hover:shadow-slate-100 transition-all">
            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-transform group-hover:scale-110 ${colors[color as keyof typeof colors]}`}>
                {icon}
            </div>
            <div>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">{label}</p>
                <p className="text-3xl font-black text-slate-900 tracking-tight">{value}</p>
            </div>
        </div>
    );
};

const AlertCircle = ({ size, className }: { size: number, className: string }) => (
    <Activity size={size} className={className} /> // Fallback placeholder
);

const CheckCircle = ({ size, className }: { size: number, className: string }) => (
    <Activity size={size} className={className} /> // Fallback placeholder
);
