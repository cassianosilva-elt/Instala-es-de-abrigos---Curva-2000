
import React, { useState, useMemo } from 'react';
import { User } from '../types';
import { FileSpreadsheet, Download, Upload, TrendingUp, CheckCircle, Clock, AlertTriangle, Search, Activity } from 'lucide-react';
import * as XLSX from 'xlsx';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, PieChart, Pie } from 'recharts';

interface RouteData {
    id: string;
    route: string;
    technician: string;
    status: 'CONCLUÍDO' | 'PENDENTE' | 'EXECUÇÃO';
    date: string;
    city: string;
}

export const RouteControlView: React.FC<{ currentUser: User }> = ({ currentUser }) => {
    const [routes, setRoutes] = useState<RouteData[]>([]);
    const [importing, setImporting] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');

    const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setImporting(true);
        const reader = new FileReader();
        reader.onload = (evt) => {
            try {
                const bstr = evt.target?.result;
                const wb = XLSX.read(bstr, { type: 'binary' });
                const wsname = wb.SheetNames[0];
                const ws = wb.Sheets[wsname];
                const data = XLSX.utils.sheet_to_json(ws) as any[];

                // Process data mapping
                const mappedRoutes: RouteData[] = data.map((row, idx) => ({
                    id: String(row.ID || idx),
                    route: String(row.Rota || row.Route || 'Rota ' + idx),
                    technician: String(row.Tecnico || row.Technician || 'N/A'),
                    status: (row.Status || '').toUpperCase().includes('CONCLU') ? 'CONCLUÍDO' : (row.Status || '').toUpperCase().includes('EXECU') ? 'EXECUÇÃO' : 'PENDENTE',
                    date: String(row.Data || row.Date || new Date().toLocaleDateString()),
                    city: String(row.Cidade || row.City || 'SP')
                }));

                setRoutes(mappedRoutes);
            } catch (err) {
                console.error(err);
                alert('Erro ao importar arquivo.');
            } finally {
                setImporting(false);
            }
        };
        reader.readAsBinaryString(file);
    };

    const stats = useMemo(() => {
        const total = routes.length;
        if (total === 0) return { total: 0, completed: 0, pending: 0, execution: 0, percent: 0 };
        const completed = routes.filter(r => r.status === 'CONCLUÍDO').length;
        const pending = routes.filter(r => r.status === 'PENDENTE').length;
        const execution = routes.filter(r => r.status === 'EXECUÇÃO').length;
        return {
            total,
            completed,
            pending,
            execution,
            percent: (completed / total) * 100
        };
    }, [routes]);

    const chartData = [
        { name: 'Concluído', value: stats.completed, color: '#10b981' },
        { name: 'Em Execução', value: stats.execution, color: '#3b82f6' },
        { name: 'Pendente', value: stats.pending, color: '#f59e0b' }
    ];

    const filteredRoutes = routes.filter(r =>
        r.route.toLowerCase().includes(searchTerm.toLowerCase()) ||
        r.technician.toLowerCase().includes(searchTerm.toLowerCase()) ||
        r.city.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <div className="space-y-8 pb-20">
            {/* Header */}
            <div className="bg-white p-6 md:p-8 rounded-3xl border border-slate-200 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div>
                    <h2 className="text-2xl font-black text-slate-900 uppercase tracking-tighter flex items-center gap-2">
                        <Activity className="text-primary" />
                        Controle de Rotas Field Service
                    </h2>
                    <p className="text-slate-400 font-bold text-xs uppercase tracking-widest mt-1">Sincronização entre Field Service e Curva 2000</p>
                </div>

                <div className="flex items-center gap-3">
                    <label className="flex items-center gap-2 px-6 py-3 bg-primary text-white rounded-2xl text-xs font-black uppercase tracking-widest cursor-pointer hover:bg-primary-600 transition-all shadow-lg shadow-primary/20">
                        {importing ? <Clock className="animate-spin" size={18} /> : <Upload size={18} />}
                        Importar Field Service
                        <input type="file" hidden onChange={handleImport} accept=".xlsx, .xls, .csv" />
                    </label>
                    <button className="flex items-center gap-2 px-6 py-3 bg-slate-100 text-slate-600 rounded-2xl text-xs font-black uppercase tracking-widest hover:bg-slate-200 transition-all">
                        <Download size={18} />
                        Exportar Curva 2000
                    </button>
                </div>
            </div>

            {/* Dashboard Stats */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <StatCard label="Total de Rotas" value={stats.total} icon={<Activity />} color="bg-slate-500" />
                <StatCard label="Concluídas" value={stats.completed} icon={<CheckCircle />} color="bg-emerald-500" />
                <StatCard label="Eficiência" value={`${stats.percent.toFixed(1)}%`} icon={<TrendingUp />} color="bg-primary" />
                <StatCard label="Pendentes" value={stats.pending} icon={<Clock />} color="bg-amber-500" />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Chart */}
                <div className="lg:col-span-1 bg-white p-8 rounded-3xl border border-slate-200 shadow-sm">
                    <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-8 border-l-4 border-primary pl-4">Distribuição de Status</h3>
                    <div className="h-64">
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie
                                    data={chartData}
                                    cx="50%"
                                    cy="50%"
                                    innerRadius={60}
                                    outerRadius={80}
                                    paddingAngle={5}
                                    dataKey="value"
                                >
                                    {chartData.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={entry.color} />
                                    ))}
                                </Pie>
                                <Tooltip />
                            </PieChart>
                        </ResponsiveContainer>
                    </div>
                    <div className="mt-8 space-y-3">
                        {chartData.map(item => (
                            <div key={item.name} className="flex items-center justify-between">
                                <span className="flex items-center gap-2 text-xs font-bold text-slate-500">
                                    <div className="w-2 h-2 rounded-full" style={{ backgroundColor: item.color }} />
                                    {item.name}
                                </span>
                                <span className="text-xs font-black text-slate-900">{item.value}</span>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Table */}
                <div className="lg:col-span-2 bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
                    <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-white/50">
                        <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest">Detalhamento de Rotas</h3>
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                            <input
                                type="text"
                                placeholder="Filtrar..."
                                value={searchTerm}
                                onChange={e => setSearchTerm(e.target.value)}
                                className="pl-9 pr-4 py-2 bg-slate-50 border-none rounded-xl text-xs font-bold outline-none focus:ring-2 focus:ring-primary/20"
                            />
                        </div>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full text-left">
                            <thead className="bg-slate-50/50">
                                <tr>
                                    <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Rota</th>
                                    <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Técnico</th>
                                    <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Cidade</th>
                                    <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Status</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {filteredRoutes.length === 0 ? (
                                    <tr>
                                        <td colSpan={4} className="px-6 py-20 text-center text-slate-400 text-xs font-bold italic">Nenhuma rota importada</td>
                                    </tr>
                                ) : filteredRoutes.map(route => (
                                    <tr key={route.id} className="hover:bg-slate-50 transition-all">
                                        <td className="px-6 py-4">
                                            <span className="text-xs font-black text-slate-800 uppercase">{route.route}</span>
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className="text-xs font-bold text-slate-600 underline decoration-primary/30">{route.technician}</span>
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{route.city}</span>
                                        </td>
                                        <td className="px-6 py-4 text-center">
                                            <StatusBadge status={route.status} />
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>
    );
};

const StatCard: React.FC<{ label: string, value: string | number, icon: React.ReactNode, color: string }> = ({ label, value, icon, color }) => (
    <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm flex items-center gap-5 hover:shadow-xl transition-all group">
        <div className={`p-4 rounded-2xl ${color} text-white shadow-lg shadow-black/5`}>{icon}</div>
        <div>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-1">{label}</p>
            <h3 className="text-2xl font-black text-slate-900 leading-none">{value}</h3>
        </div>
    </div>
);

const StatusBadge: React.FC<{ status: 'CONCLUÍDO' | 'PENDENTE' | 'EXECUÇÃO' }> = ({ status }) => {
    const config = {
        'CONCLUÍDO': 'bg-emerald-50 text-emerald-600 border-emerald-100',
        'PENDENTE': 'bg-amber-50 text-amber-600 border-amber-100',
        'EXECUÇÃO': 'bg-blue-50 text-blue-600 border-blue-100'
    };
    return (
        <span className={`px-2.5 py-1.5 rounded-lg border text-[8px] font-black uppercase tracking-widest ${config[status]}`}>
            {status}
        </span>
    );
};
