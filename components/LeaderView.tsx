
import React, { useMemo, useState } from 'react';
import { User, Task, TaskStatus, AssetType, ServiceType, UserRole } from '../types';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { Users, CheckCircle, Clock, AlertCircle, Search, Plus } from 'lucide-react';
import SimpleModal from './SimpleModal';
import { getAssets } from '../api/fieldManagerApi';

interface Props {
  leader: User;
  tasks: Task[];
  users: User[];
  onUpdateTask: (task: Task) => void;
  onCreateTask?: (task: Omit<Task, 'id'>) => void;
}

const LeaderView: React.FC<Props> = ({ leader, tasks, users, onCreateTask }) => {
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Form State
  const [assetType, setAssetType] = useState<AssetType>(AssetType.BUS_SHELTER);
  const [assetId, setAssetId] = useState('');
  const [serviceType, setServiceType] = useState<ServiceType>(ServiceType.PREVENTIVE);
  const [technicianId, setTechnicianId] = useState('');
  const [scheduledDate, setScheduledDate] = useState('');
  const [description, setDescription] = useState('');
  const [address, setAddress] = useState('');

  const stats = useMemo(() => ({
    total: tasks.length,
    completed: tasks.filter(t => t.status === TaskStatus.COMPLETED).length,
    pending: tasks.filter(t => t.status === TaskStatus.PENDING).length,
    inProgress: tasks.filter(t => t.status === TaskStatus.IN_PROGRESS).length,
    blocked: tasks.filter(t => t.status === TaskStatus.BLOCKED).length,
  }), [tasks]);

  const chartData = [
    { name: 'Pendentes', value: stats.pending, color: '#FA3A00' },
    { name: 'Em Curso', value: stats.inProgress, color: '#3b82f6' },
    { name: 'Concluídas', value: stats.completed, color: '#22c55e' },
    { name: 'Bloqueadas', value: stats.blocked, color: '#94a3b8' },
  ];

  const typeData = useMemo(() => {
    const counts: any = {};
    tasks.forEach(t => { counts[t.assetType] = (counts[t.assetType] || 0) + 1; });
    return Object.entries(counts).map(([name, value]) => ({ name, value }));
  }, [tasks]);

  // Filter technicians
  const myTechnicians = users.filter(u => u.role === UserRole.TECNICO || u.role === UserRole.PARCEIRO_TECNICO);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const asset = {
      id: assetId,
      code: assetId,
      type: assetType,
      location: { address, lat: -23.5505, lng: -46.6333 }, // Default to SP center if unknown
      companyId: leader.companyId
    };

    onCreateTask({
      assetId: assetId,
      asset: asset,
      serviceType,
      technicianId,
      leaderId: leader.id,
      companyId: leader.companyId,
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
  };

  return (
    <div className="space-y-8">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-black text-slate-800">Dashboard Operacional</h2>
        {onCreateTask && (
          <button
            onClick={() => setIsModalOpen(true)}
            className="flex items-center gap-2 bg-primary text-white px-5 py-3 rounded-xl hover:bg-primary-600 transition-colors font-bold shadow-lg shadow-primary/20"
          >
            <Plus size={20} />
            Nova Tarefa
          </button>
        )}
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={<Clock className="text-primary" />} label="Pendentes" value={stats.pending} />
        <StatCard icon={<Users className="text-blue-500" />} label="Em Execução" value={stats.inProgress} />
        <StatCard icon={<CheckCircle className="text-green-500" />} label="Concluídas" value={stats.completed} />
        <StatCard icon={<AlertCircle className="text-slate-400" />} label="Bloqueadas" value={stats.blocked} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
          <div className="p-6 border-b border-slate-100 flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center bg-white">
            <h3 className="font-black text-slate-800 text-lg">Status da Equipe</h3>
            <div className="relative w-full sm:w-auto">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
              <input type="text" placeholder="Buscar ativo..." className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20" />
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-slate-50 text-slate-400 uppercase text-[10px] font-black tracking-widest">
                <tr>
                  <th className="px-6 py-4">Técnico</th>
                  <th className="px-6 py-4">Ativo</th>
                  <th className="px-6 py-4">Status</th>
                  <th className="px-6 py-4 text-center">Fotos</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-bold">
                {tasks.map(task => {
                  const tech = users.find(u => u.id === task.technicianId);
                  return (
                    <tr key={task.id} className="hover:bg-primary/5 transition-colors">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <img src={tech?.avatar} className="w-8 h-8 rounded-full shadow-sm" alt="" />
                          <span className="text-sm text-slate-700">{tech?.name}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <p className="text-sm text-slate-900 font-black">{task.asset ? task.asset.code : task.assetId}</p>
                        <p className="text-[10px] text-primary uppercase tracking-tighter">{task.asset ? task.asset.type : 'N/A'}</p>
                      </td>
                      <td className="px-6 py-4"><TableStatusBadge status={task.status} /></td>
                      <td className="px-6 py-4 text-center">
                        <div className="flex justify-center -space-x-1.5">
                          {[0, 1, 2].map(i => (
                            <div key={i} className={`w-5 h-5 rounded border border-white ${task.evidence && task.evidence.length > i ? 'bg-primary shadow-sm' : 'bg-slate-100'}`} />
                          ))}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        <div className="space-y-6">
          <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
            <h3 className="font-black text-slate-800 mb-6 uppercase tracking-widest text-xs">Produtividade</h3>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 9, fontWeight: 800, fill: '#94a3b8' }} />
                  <YAxis hide />
                  <Tooltip cursor={{ fill: 'transparent' }} />
                  <Bar dataKey="value" radius={[6, 6, 0, 0]} barSize={45}>
                    {chartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
            <h3 className="font-black text-slate-800 mb-6 uppercase tracking-widest text-xs">Carga por Ativo</h3>
            <div className="space-y-5">
              {typeData.map((item, i) => (
                <div key={i}>
                  <div className="flex justify-between text-xs font-black mb-1.5">
                    <span className="text-slate-500">{item.name}</span>
                    <span className="text-slate-900">{item.value}</span>
                  </div>
                  <div className="h-2 bg-slate-50 rounded-full overflow-hidden">
                    <div className="h-full bg-primary transition-all" style={{ width: `${(item.value / stats.total) * 100}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
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
              {myTechnicians.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
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

const StatCard: React.FC<{ icon: React.ReactNode, label: string, value: number }> = ({ icon, label, value }) => (
  <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm hover:border-primary/20 transition-all hover:shadow-lg group">
    <div className="flex items-center gap-3 mb-4">
      <div className="p-2.5 bg-slate-50 rounded-xl group-hover:bg-primary/10 transition-colors">{icon}</div>
      <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{label}</span>
    </div>
    <p className="text-3xl font-black text-slate-900">{value}</p>
  </div>
);

const TableStatusBadge: React.FC<{ status: TaskStatus }> = ({ status }) => {
  const configs = {
    [TaskStatus.PENDING]: 'text-primary',
    [TaskStatus.IN_PROGRESS]: 'text-blue-600',
    [TaskStatus.COMPLETED]: 'text-green-600',
    [TaskStatus.BLOCKED]: 'text-slate-400',
  };
  return <div className={`flex items-center gap-1.5 text-xs font-black uppercase tracking-tighter ${configs[status]}`}>
    <div className={`w-1.5 h-1.5 rounded-full bg-current`} />
    {status}
  </div>
};

export default LeaderView;
