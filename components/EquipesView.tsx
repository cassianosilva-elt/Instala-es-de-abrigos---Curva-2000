
import React, { useState } from 'react';
import { Team, User, UserRole } from '../types';
import { Users, ShieldCheck, Mail, Phone, Plus, Pencil, Trash2, Search } from 'lucide-react';
import SimpleModal from './SimpleModal';

interface Props {
  teams: Team[];
  users: User[];
  onCreateTeam?: (team: Omit<Team, 'id'>) => void;
  onDeleteTeam?: (teamId: string) => void;
  onUpdateTeam?: (team: Team) => void;
}

const EquipesView: React.FC<Props> = ({ teams, users, onCreateTeam, onDeleteTeam, onUpdateTeam }) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTeam, setEditingTeam] = useState<Team | null>(null);
  const [newTeamName, setNewTeamName] = useState('');
  const [selectedLeader, setSelectedLeader] = useState('');
  const [selectedTechs, setSelectedTechs] = useState<string[]>([]);
  const [techSearchTerm, setTechSearchTerm] = useState('');

  // Filter eligible leaders and technicians based on roles
  const eligibleLeaders = users.filter(u => u.role === UserRole.LIDER || u.role === UserRole.PARCEIRO_LIDER);
  const eligibleTechs = users.filter(u => {
    const isTech = u.role === UserRole.TECNICO || u.role === UserRole.PARCEIRO_TECNICO;
    const matchesSearch = u.name.toLowerCase().includes(techSearchTerm.toLowerCase()) ||
      (u.companyName?.toLowerCase().includes(techSearchTerm.toLowerCase()));
    return isTech && matchesSearch;
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (newTeamName && selectedLeader) {
      if (editingTeam && onUpdateTeam) {
        onUpdateTeam({
          ...editingTeam,
          name: newTeamName,
          leaderId: selectedLeader,
          technicianIds: selectedTechs
        });
      } else if (onCreateTeam) {
        const leaderUser = users.find(u => u.id === selectedLeader);
        onCreateTeam({
          leaderId: selectedLeader,
          technicianIds: selectedTechs,
          name: newTeamName,
          companyId: leaderUser?.companyId || 'internal'
        });
      }
      handleCloseModal();
    }
  };

  const handleOpenModal = (team?: Team) => {
    if (team) {
      setEditingTeam(team);
      setNewTeamName(team.name);
      setSelectedLeader(team.leaderId);
      setSelectedTechs(team.technicianIds);
    } else {
      setEditingTeam(null);
      setNewTeamName('');
      setSelectedLeader('');
      setSelectedTechs([]);
      setTechSearchTerm('');
    }
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingTeam(null);
    setNewTeamName('');
    setSelectedLeader('');
    setSelectedTechs([]);
    setTechSearchTerm('');
  };

  const handleDelete = (teamId: string, teamName: string) => {
    if (onDeleteTeam && window.confirm(`Tem certeza que deseja excluir a equipe "${teamName}"?`)) {
      onDeleteTeam(teamId);
    }
  };

  const toggleTech = (techId: string) => {
    setSelectedTechs(prev =>
      prev.includes(techId) ? prev.filter(id => id !== techId) : [...prev, techId]
    );
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-black text-slate-800">Equipes Operacionais</h2>
        {onCreateTeam && (
          <button
            onClick={() => handleOpenModal()}
            className="flex items-center gap-2 bg-slate-900 text-white px-5 py-3 rounded-xl hover:bg-slate-800 transition-colors font-bold shadow-lg shadow-slate-200"
          >
            <Plus size={20} />
            Criar Nova Equipe
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {teams.map(team => {
          const leader = users.find(u => u.id === team.leaderId);
          const technicians = users.filter(u => team.technicianIds.includes(u.id));

          return (
            <div key={team.id} className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden group hover:shadow-md transition-all">
              <div className="p-6 bg-primary text-white">
                <div className="flex justify-between items-center">
                  <h3 className="text-xl font-black">{team.name}</h3>
                  <div className="flex items-center gap-2">
                    {onUpdateTeam && (
                      <button
                        onClick={() => handleOpenModal(team)}
                        className="p-2 hover:bg-white/20 rounded-lg transition-colors"
                        title="Editar Equipe"
                      >
                        <Pencil size={18} />
                      </button>
                    )}
                    {onDeleteTeam && (
                      <button
                        onClick={() => handleDelete(team.id, team.name)}
                        className="p-2 hover:bg-white/20 rounded-lg transition-colors text-white/80 hover:text-white"
                        title="Excluir Equipe"
                      >
                        <Trash2 size={18} />
                      </button>
                    )}
                    <span className="bg-white/20 px-3 py-1 rounded-full text-xs font-bold uppercase ml-2">{technicians.length} Integrantes</span>
                  </div>
                </div>
              </div>

              <div className="p-6 space-y-6">
                <div className="flex items-center gap-4 p-4 bg-primary/5 rounded-2xl border border-primary/10">
                  <img src={leader?.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(leader?.name || 'L')}`} className="w-14 h-14 rounded-2xl border-4 border-white shadow-sm" alt="" />
                  <div>
                    <p className="text-[10px] font-black text-primary uppercase tracking-widest">Líder de Unidade</p>
                    <p className="text-lg font-black text-slate-800">{leader?.name}</p>
                  </div>
                </div>

                <div className="space-y-3">
                  <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest">Equipe Técnica</h4>
                  {technicians.length > 0 ? (
                    technicians.map(tech => (
                      <div key={tech.id} className="flex items-center justify-between p-3 border border-slate-50 rounded-xl hover:bg-slate-50 transition-colors">
                        <div className="flex items-center gap-3">
                          <img src={tech.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(tech.name || 'T')}`} className="w-10 h-10 rounded-full" alt="" />
                          <span className="font-bold text-slate-700">{tech.name}</span>
                        </div>
                        <div className="flex gap-2">
                          <button className="p-2 text-slate-400 hover:text-primary transition-colors"><Mail size={16} /></button>
                          <button className="p-2 text-slate-400 hover:text-primary transition-colors"><Phone size={16} /></button>
                        </div>
                      </div>
                    ))
                  ) : (
                    <p className="text-xs font-bold text-slate-400 italic py-2">Nenhum técnico designado.</p>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <SimpleModal isOpen={isModalOpen} onClose={handleCloseModal} title={editingTeam ? 'Editar Equipe' : 'Nova Equipe'}>
        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="block text-xs font-black text-slate-500 uppercase tracking-widest mb-2">Nome da Equipe</label>
            <input
              type="text"
              required
              value={newTeamName}
              onChange={e => setNewTeamName(e.target.value)}
              className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-primary/20"
              placeholder="Ex: Equipe Alpha - Zona Sul"
            />
          </div>

          <div>
            <label className="block text-xs font-black text-slate-500 uppercase tracking-widest mb-2">Líder Responsável</label>
            <select
              required
              value={selectedLeader}
              onChange={e => setSelectedLeader(e.target.value)}
              className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-primary/20"
            >
              <option value="">Selecione um líder...</option>
              {eligibleLeaders.map(l => (
                <option key={l.id} value={l.id}>{l.name} ({l.companyName})</option>
              ))}
            </select>
          </div>

          <div>
            <div className="flex justify-between items-center mb-2">
              <label className="block text-xs font-black text-slate-500 uppercase tracking-widest">Selecionar Técnicos</label>
              <div className="relative">
                <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={techSearchTerm}
                  onChange={e => setTechSearchTerm(e.target.value)}
                  placeholder="Pesquisar técnico..."
                  className="pl-8 pr-3 py-1.5 bg-slate-100 border-none rounded-lg text-[10px] font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-primary/20 w-40"
                />
              </div>
            </div>
            <div className="max-h-48 overflow-y-auto space-y-2 border border-slate-200 rounded-xl p-2 bg-slate-50">
              {eligibleTechs.map(tech => (
                <div
                  key={tech.id}
                  onClick={() => toggleTech(tech.id)}
                  className={`flex items-center gap-3 p-2 rounded-lg cursor-pointer transition-colors border ${selectedTechs.includes(tech.id) ? 'bg-primary/10 border-primary/20' : 'hover:bg-white border-transparent'}`}
                >
                  <div className={`w-5 h-5 rounded border flex items-center justify-center ${selectedTechs.includes(tech.id) ? 'bg-primary border-primary' : 'bg-white border-slate-300'}`}>
                    {selectedTechs.includes(tech.id) && <Plus size={14} className="text-white" />}
                  </div>
                  <span className="text-sm font-bold text-slate-700">{tech.name}</span>
                  <span className="text-[10px] text-slate-400 ml-auto">{tech.companyName}</span>
                </div>
              ))}
            </div>
          </div>

          <button
            type="submit"
            disabled={!newTeamName || !selectedLeader}
            className="w-full py-4 bg-primary text-white font-black rounded-xl hover:bg-primary-600 transition-all shadow-lg shadow-primary/20 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {editingTeam ? 'Salvar Alterações' : 'Criar Equipe'}
          </button>
        </form>
      </SimpleModal>
    </div>
  );
};

export default EquipesView;
