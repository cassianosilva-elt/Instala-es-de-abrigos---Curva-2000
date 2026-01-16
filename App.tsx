
import React, { useState, useMemo, useEffect } from 'react';
import { User, UserRole, Task, TaskStatus, Team, ServiceType } from './types';
import TechnicianView from './components/TechnicianView';
import LeaderView from './components/LeaderView';
import ChiefView from './components/ChiefView';
import EquipesView from './components/EquipesView';
import MapaView from './components/MapaView';
import OSView from './components/OSView';
import { TeamStatusView } from './components/TeamStatusView';
import { ChatWidget } from './components/ChatWidget';
import Login from './components/Login';
import { ProfileSettings } from './components/ProfileSettings';
import { NotificationCenter } from './components/NotificationCenter';
import { MeasurementView } from './components/MeasurementView';
import { EmployeesView } from './components/EmployeesView';
import { VehicleControlView } from './components/VehicleControlView';
import OpecManagementView from './components/OpecManagementView';
import { ReportsView } from './components/ReportsView';
import { DailyReportView } from './components/DailyReportView';
import { RouteControlView } from './components/RouteControlView';
import { supabase } from './api/supabaseClient';
import { ThemeProvider, companyThemes } from './contexts/ThemeContext';
import { LogOut, LayoutGrid, Users, Map as MapIcon, ClipboardList, ShieldCheck, Building2, Activity, Loader2, X, Settings, Calculator, Menu, ChevronLeft, ChevronRight, Car, Smartphone, FileSpreadsheet, ListTodo, Map } from 'lucide-react';
import { getTasksByUserId, getTeams, getAllUsers, createTeam, updateTeam, deleteTeam } from './api/fieldManagerApi';
import { useOfflineSync } from './hooks/useOfflineSync';

type Tab = 'dashboard' | 'equipes' | 'mapa' | 'os' | 'monitoramento' | 'medicao' | 'funcionarios' | 'veiculos' | 'opec' | 'reports' | 'daily_report' | 'route_control';

const App: React.FC = () => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [activeTab, setActiveTab] = useState<Tab>('dashboard');
  const [loading, setLoading] = useState(true);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);

  // Background sync for offline evidence
  useOfflineSync(() => {
    // Optionally reload tasks if in a view that needs it
    // loadTasks(); 
  });

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (session) {
        const { data: { user } } = await supabase.auth.getUser();
        const meta = user?.user_metadata || {};
        const userCompanyId = meta.company_id || 'internal';
        const isUserInternal = userCompanyId === 'internal';
        const savedPortal = localStorage.getItem('active_portal');

        if (savedPortal && (
          (savedPortal === 'internal' && !isUserInternal) ||
          (savedPortal === 'partner' && isUserInternal)
        )) {
          console.warn('Portal mismatch detected:', { savedPortal, isUserInternal });
          await supabase.auth.signOut();
          localStorage.removeItem('active_portal');
          setLoading(false);
          return;
        }

        fetchProfile(session.user.id);
      } else {
        setLoading(false);
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_OUT' || !session) {
        setCurrentUser(null);
        setLoading(false);
        return;
      }
      fetchProfile(session.user.id);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const fetchProfile = async (userId: string) => {
    setLoading(true);
    try {
      const { data: profile, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();

      if (profile && !error) {
        console.log('Profile loaded successfully:', profile);
        setCurrentUser({
          id: profile.id,
          name: profile.name,
          email: profile.email,
          role: profile.role as UserRole,
          companyId: profile.company_id,
          companyName: profile.company_name,
          avatar: profile.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(profile.name)}`,
        });
      } else {
        console.error('Profile not found or error fetching:', { userId, error });
        // If profile is missing (PGRST116), sign out to allow fresh login/signup
        if (error && error.code === 'PGRST116') {
          console.warn('Profile missing. Signing out...');
          await supabase.auth.signOut();
          setCurrentUser(null);
        } else {
          // General fetch error (like "Failed to fetch")
          // Just set loading to false to show login screen or error state
          setCurrentUser(null);
        }
      }
    } catch (err) {
      console.error('Error fetching profile:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (currentUser) {
      loadAllData();

      // Real-time subscriptions
      const tasksSubscription = supabase
        .channel('tasks-changes')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'tasks' }, () => {
          loadTasks();
        })
        .subscribe();

      const teamsSubscription = supabase
        .channel('teams-changes')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'teams' }, () => {
          loadTeams();
        })
        .subscribe();

      const profilesSubscription = supabase
        .channel('profiles-changes')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles' }, () => {
          loadUsers();
        })
        .subscribe();

      return () => {
        tasksSubscription.unsubscribe();
        teamsSubscription.unsubscribe();
        profilesSubscription.unsubscribe();
      };
    }
  }, [currentUser]);

  const loadAllData = async () => {
    if (!currentUser) return;
    await Promise.all([
      loadTasks(),
      loadTeams(),
      loadUsers()
    ]);
  };

  const loadTasks = async () => {
    if (!currentUser) return;
    const data = await getTasksByUserId(currentUser.id);
    setTasks(data);
  };

  const loadTeams = async () => {
    if (!currentUser) return;
    const data = await getTeams(currentUser.companyId);
    setTeams(data);
  };

  const loadUsers = async () => {
    if (!currentUser) return;
    const data = await getAllUsers(currentUser.companyId);
    setUsers(data);
  };

  const handleUpdateTask = async (updatedTask: Task) => {
    try {
      setTasks(prev => prev.map(t => t.id === updatedTask.id ? updatedTask : t));
      const { error } = await supabase
        .from('tasks')
        .update({
          status: updatedTask.status,
          blocking_reason: updatedTask.blockingReason,
          not_performed_reason: updatedTask.notPerformedReason,
          started_at: updatedTask.startedAt?.toISOString(),
          completed_at: updatedTask.completedAt?.toISOString()
        })
        .eq('id', updatedTask.id);
      if (error) throw error;
    } catch (err) {
      console.error('Error updating task:', err);
      loadTasks(); // Rollback
    }
  };

  const handleCreateTask = async (newTaskPartial: Omit<Task, 'id'>) => {
    try {
      const dbTask = {
        id: `task_${Date.now()}`,
        asset_id: newTaskPartial.assetId,
        asset_json: newTaskPartial.asset,
        service_type: newTaskPartial.serviceType,
        status: newTaskPartial.status,
        technician_id: newTaskPartial.technicianId,
        leader_id: newTaskPartial.leaderId,
        company_id: newTaskPartial.companyId,
        scheduled_date: newTaskPartial.scheduledDate,
        description: newTaskPartial.description
      };
      const { error } = await supabase.from('tasks').insert(dbTask);
      if (error) throw error;
      loadTasks();
    } catch (err) {
      console.error('Error creating task:', err);
    }
  };

  const handleCreateTeam = async (newTeamPartial: Omit<Team, 'id'>) => {
    try {
      await createTeam(newTeamPartial);
      loadTeams();
    } catch (err) {
      console.error('Error creating team:', err);
    }
  };

  const handleDeleteTeam = async (teamId: string) => {
    try {
      await deleteTeam(teamId);
      loadTeams();
    } catch (err) {
      console.error('Error deleting team:', err);
    }
  };

  const handleUpdateTeam = async (updatedTeam: Team) => {
    try {
      await updateTeam(updatedTeam.id, updatedTeam);
      loadTeams();
    } catch (err) {
      console.error('Error updating team:', err);
    }
  };

  const logout = async () => {
    await supabase.auth.signOut();
    setCurrentUser(null);
    setActiveTab('dashboard');
  };

  const isTechnician = useMemo(() =>
    currentUser?.role === UserRole.TECNICO || currentUser?.role === UserRole.PARCEIRO_TECNICO,
    [currentUser]);

  const visibleTasks = useMemo(() => {
    if (!currentUser) return [];
    let filtered = tasks;
    if (currentUser.role !== UserRole.CHEFE) {
      filtered = tasks.filter(t => t.companyId === currentUser.companyId);
    }
    if (isTechnician) {
      return filtered.filter(t => t.technicianId === currentUser.id);
    }
    return filtered;
  }, [tasks, currentUser, isTechnician]);

  const visibleTeams = useMemo(() => {
    if (!currentUser) return [];
    if (isTechnician) return [];
    if (currentUser.role === UserRole.CHEFE) return teams;
    return teams.filter(t => t.companyId === currentUser.companyId);
  }, [currentUser, isTechnician, teams]);

  const visibleUsers = useMemo(() => {
    if (!currentUser) return [];
    if (isTechnician) return users.filter(u => u.id === currentUser.id);
    if (currentUser.role === UserRole.CHEFE) return users;
    return users.filter(u => u.companyId === currentUser.companyId);
  }, [currentUser, isTechnician, users]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-primary-50">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-12 h-12 text-primary animate-spin" />
          <p className="text-primary font-black animate-pulse uppercase tracking-[0.3em] text-[10px]">Carregando</p>
        </div>
      </div>
    );
  }

  if (!currentUser) {
    return <Login onLoginSuccess={(session) => fetchProfile(session.user.id)} />;
  }

  const renderContent = () => {
    switch (activeTab) {
      case 'equipes':
        return isTechnician ? null : (
          <EquipesView
            teams={visibleTeams}
            users={visibleUsers}
            onCreateTeam={handleCreateTeam}
            onDeleteTeam={handleDeleteTeam}
            onUpdateTeam={handleUpdateTeam}
          />
        );
      case 'monitoramento':
        return isTechnician ? null : <TeamStatusView currentUser={currentUser} />;
      case 'mapa':
        return isTechnician ? null : <MapaView tasks={visibleTasks} />;
      case 'os':
        return <OSView tasks={visibleTasks} users={visibleUsers} currentUser={currentUser} onUpdateTask={handleUpdateTask} onCreateTask={handleCreateTask} />;
      case 'medicao':
        return <MeasurementView currentUser={currentUser} />;
      case 'funcionarios':
        return <EmployeesView currentUser={currentUser} />;
      case 'veiculos':
        return isPartner ? null : <VehicleControlView currentUser={currentUser} />;
      case 'opec':
        return isPartner ? null : <OpecManagementView currentUser={currentUser} />;
      case 'reports':
        return <ReportsView tasks={visibleTasks} users={visibleUsers} currentUser={currentUser} />;
      case 'daily_report':
        return <DailyReportView currentUser={currentUser} />;
      case 'route_control':
        return <RouteControlView currentUser={currentUser} />;
      case 'dashboard':
      default:
        const role = currentUser.role;
        if (role === UserRole.TECNICO || role === UserRole.PARCEIRO_TECNICO) {
          return <TechnicianView technician={currentUser} tasks={visibleTasks} onUpdateTask={handleUpdateTask} />;
        }
        if (role === UserRole.LIDER || role === UserRole.PARCEIRO_LIDER) {
          return <LeaderView leader={currentUser} tasks={visibleTasks} users={visibleUsers} onUpdateTask={handleUpdateTask} onCreateTask={handleCreateTask} />;
        }
        return <ChiefView chief={currentUser} tasks={visibleTasks} teams={visibleTeams} users={visibleUsers} onUpdateTask={handleUpdateTask} onCreateTask={handleCreateTask} />;
    }
  };

  const isPartner = currentUser.companyId !== 'internal';

  return (
    <ThemeProvider companyId={currentUser.companyId || 'internal'}>
      <div className="min-h-screen bg-white flex flex-col md:flex-row font-sans">
        {/* Sidebar */}
        <aside className={`hidden md:flex flex-col bg-white border-r border-slate-100 text-slate-900 shrink-0 transition-all duration-300 ${isSidebarCollapsed ? 'w-20' : 'w-80'} ${isPartner ? 'ring-4 ring-primary-500/10' : ''}`}>
          <div className={`p-6 flex flex-col gap-6 relative ${isSidebarCollapsed ? 'items-center' : ''}`}>
            {/* Collapse Toggle Button */}
            <button
              onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
              className="absolute -right-3 top-10 w-6 h-6 bg-white border border-slate-200 rounded-full flex items-center justify-center text-slate-400 hover:text-primary shadow-sm z-10"
            >
              {isSidebarCollapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
            </button>

            <div>
              <img
                src={isSidebarCollapsed
                  ? "/assets/em_minimized.png"
                  : "https://gvlhjjonhwhifxomwpgu.supabase.co/storage/v1/object/public/assets/Eletromidia%20Horizontal%20(3).png"
                }
                alt="Eletromidia"
                className={`${isSidebarCollapsed ? 'h-8' : 'h-6'} w-auto transition-all ${isSidebarCollapsed ? '' : 'opacity-70'}`}
              />
            </div>

            {isPartner && companyThemes[currentUser.companyId]?.logoUrl ? (
              <div className={`flex flex-col gap-3 ${isSidebarCollapsed ? 'items-center' : ''}`}>
                <img
                  src={companyThemes[currentUser.companyId].logoUrl}
                  alt={currentUser.companyName}
                  className={`${isSidebarCollapsed ? 'h-8 w-8 object-contain' : 'h-14 w-auto object-contain object-left'}`}
                />
                {!isSidebarCollapsed && (
                  <div className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-secondary text-primary text-[9px] font-black uppercase rounded-lg tracking-[0.2em] w-fit">
                    <Building2 size={10} /> Parceiro
                  </div>
                )}
              </div>
            ) : (isPartner && (
              <div className={`mt-1 inline-flex items-center gap-1.5 px-2.5 py-1 bg-secondary text-primary text-[9px] font-black uppercase rounded-lg tracking-[0.2em] ${isSidebarCollapsed ? 'p-1.5' : ''}`}>
                {isSidebarCollapsed ? <Building2 size={14} /> : <><Building2 size={10} /> Parceiro</>}
              </div>
            ))}
          </div>

          <nav className="flex-1 px-6 space-y-2">
            <SidebarLink icon={<LayoutGrid size={20} />} label="Dashboard" active={activeTab === 'dashboard'} collapsed={isSidebarCollapsed} onClick={() => setActiveTab('dashboard')} />

            {/* Technicians cannot see "Equipes" or "Mapa Operativo" */}
            {!isTechnician && (
              <>
                <SidebarLink icon={<MapIcon size={20} />} label="Mapa Operativo" active={activeTab === 'mapa'} collapsed={isSidebarCollapsed} onClick={() => setActiveTab('mapa')} />
                <SidebarLink icon={<ClipboardList size={20} />} label="Gestão de OS" active={activeTab === 'os'} collapsed={isSidebarCollapsed} onClick={() => setActiveTab('os')} />
                <SidebarLink icon={<ListTodo size={20} />} label="Relatório Diário" active={activeTab === 'daily_report'} collapsed={isSidebarCollapsed} onClick={() => setActiveTab('daily_report')} />
                <SidebarLink icon={<FileSpreadsheet size={20} />} label="Relatórios" active={activeTab === 'reports'} collapsed={isSidebarCollapsed} onClick={() => setActiveTab('reports')} />
                <SidebarLink icon={<Calculator size={20} />} label="Medição" active={activeTab === 'medicao'} collapsed={isSidebarCollapsed} onClick={() => setActiveTab('medicao')} />
                <SidebarLink icon={<Users size={20} />} label="Funcionários" active={activeTab === 'funcionarios'} collapsed={isSidebarCollapsed} onClick={() => setActiveTab('funcionarios')} />
                <SidebarLink icon={<Users size={20} />} label="Equipes" active={activeTab === 'equipes'} collapsed={isSidebarCollapsed} onClick={() => setActiveTab('equipes')} />
                {!isPartner && (
                  <>
                    <SidebarLink icon={<Smartphone size={20} />} label="Gestão de OPEC" active={activeTab === 'opec'} collapsed={isSidebarCollapsed} onClick={() => setActiveTab('opec')} />
                    <SidebarLink icon={<Car size={20} />} label="Controle de Frota" active={activeTab === 'veiculos'} collapsed={isSidebarCollapsed} onClick={() => setActiveTab('veiculos')} />
                  </>
                )}
                <SidebarLink icon={<Activity size={20} />} label="Monitoramento" active={activeTab === 'monitoramento'} collapsed={isSidebarCollapsed} onClick={() => setActiveTab('monitoramento')} />
              </>
            )}
          </nav>

          <div className={`p-4 border-t border-slate-50 ${isSidebarCollapsed ? 'flex flex-col items-center' : 'p-8'}`}>
            <button
              onClick={() => setIsProfileModalOpen(true)}
              className={`flex items-center gap-3 mb-4 rounded-[24px] border transition-all w-full text-left group overflow-hidden ${isPartner ? 'bg-secondary border-slate-800' : 'bg-primary-50/50 border-primary-100 hover:bg-primary-50'} ${isSidebarCollapsed ? 'p-2 justify-center aspect-square' : 'p-5'}`}
            >
              <div className="relative shrink-0">
                <img src={currentUser.avatar} alt={currentUser.name} className="w-10 h-10 rounded-2xl border-2 border-white shadow-sm object-cover" />
                {!isSidebarCollapsed && (
                  <div className="absolute -bottom-1 -right-1 p-1 bg-primary text-white rounded-lg shadow-lg opacity-0 group-hover:opacity-100 transition-opacity">
                    <Settings size={10} />
                  </div>
                )}
              </div>

              {!isSidebarCollapsed && (
                <div className="overflow-hidden">
                  <p className={`font-black text-sm truncate tracking-tight ${isPartner ? 'text-white' : 'text-slate-900'}`}>{currentUser.name}</p>
                  <p className={`text-[10px] font-black uppercase tracking-[0.2em] ${isPartner ? 'text-primary' : 'text-primary-600'}`}>{currentUser.role.replace('PARCEIRO_', '')}</p>
                </div>
              )}
            </button>
            <button onClick={logout} className={`flex items-center gap-3 w-full text-slate-400 hover:text-primary hover:bg-primary-50 rounded-2xl transition-all font-black text-xs uppercase tracking-widest ${isSidebarCollapsed ? 'justify-center p-3' : 'p-4'}`}>
              <LogOut size={isSidebarCollapsed ? 20 : 18} />
              {!isSidebarCollapsed && <span>Sair do Sistema</span>}
            </button>
          </div>
        </aside>

        <main className="flex-1 flex flex-col h-screen overflow-hidden bg-slate-50/30">
          <header className="bg-white/90 backdrop-blur-xl border-b border-slate-100 px-4 py-4 md:px-10 md:py-6 flex justify-between items-center shrink-0 z-10">
            <div className="flex items-center gap-6">
              <button
                onClick={() => setIsMobileMenuOpen(true)}
                className="md:hidden p-2 -ml-2 text-slate-400 hover:text-slate-900"
              >
                <Menu size={24} />
              </button>
              <img src="https://gvlhjjonhwhifxomwpgu.supabase.co/storage/v1/object/public/assets/LOGOELETRO.png" alt="Eletromidia" className="h-8 w-auto md:hidden" />
              <div className="flex flex-col">
                <h1 className="text-xl md:text-3xl font-black text-slate-900 tracking-tighter uppercase leading-none">OPERAÇÃO CONCESSÃO SP - MATRIZ</h1>
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-primary animate-pulse"></span>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">{activeTab} • {currentUser.companyName}</p>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <NotificationCenter currentUser={currentUser} />
              <button className="md:hidden p-3 text-primary bg-primary-50 rounded-2xl" onClick={logout}>
                <LogOut size={24} />
              </button>
            </div>
          </header>

          <div className="flex-1 overflow-y-auto p-4 md:p-10">
            {renderContent()}
          </div>
        </main>

        {/* Mobile Sidebar Overlay */}
        {isMobileMenuOpen && (
          <div
            className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-40 md:hidden animate-in fade-in duration-300"
            onClick={() => setIsMobileMenuOpen(false)}
          />
        )}

        {/* Mobile Sidebar */}
        <aside className={`fixed top-0 left-0 bottom-0 w-80 bg-white z-50 md:hidden transition-transform duration-300 ease-out shadow-2xl flex flex-col ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'}`}>
          <div className="p-8 flex flex-col gap-4 border-b border-slate-50 relative">
            <button
              onClick={() => setIsMobileMenuOpen(false)}
              className="absolute top-8 right-8 p-2 text-slate-400 hover:text-slate-900 transition-colors"
            >
              <X size={24} />
            </button>
            <img src="https://gvlhjjonhwhifxomwpgu.supabase.co/storage/v1/object/public/assets/Eletromidia%20Horizontal%20(3).png" alt="Eletromidia" className="h-5 w-auto opacity-70 self-start" />
            {isPartner && companyThemes[currentUser.companyId]?.logoUrl && (
              <img
                src={companyThemes[currentUser.companyId].logoUrl}
                alt={currentUser.companyName}
                className="h-10 w-auto object-contain object-left"
              />
            )}
          </div>

          <nav className="flex-1 px-6 py-8 space-y-2 overflow-y-auto">
            <SidebarLink
              icon={<LayoutGrid size={20} />}
              label="Dashboard"
              active={activeTab === 'dashboard'}
              onClick={() => { setActiveTab('dashboard'); setIsMobileMenuOpen(false); }}
            />

            {!isTechnician && (
              <>
                <SidebarLink icon={<MapIcon size={20} />} label="Mapa Operativo" active={activeTab === 'mapa'} onClick={() => { setActiveTab('mapa'); setIsMobileMenuOpen(false); }} />
                <SidebarLink icon={<ClipboardList size={20} />} label="Gestão de OS" active={activeTab === 'os'} onClick={() => { setActiveTab('os'); setIsMobileMenuOpen(false); }} />
                <SidebarLink icon={<ListTodo size={20} />} label="Relatório Diário" active={activeTab === 'daily_report'} onClick={() => { setActiveTab('daily_report'); setIsMobileMenuOpen(false); }} />
                <SidebarLink icon={<FileSpreadsheet size={20} />} label="Relatórios" active={activeTab === 'reports'} onClick={() => { setActiveTab('reports'); setIsMobileMenuOpen(false); }} />
                <SidebarLink icon={<Calculator size={20} />} label="Medição" active={activeTab === 'medicao'} onClick={() => { setActiveTab('medicao'); setIsMobileMenuOpen(false); }} />
                <SidebarLink icon={<Users size={20} />} label="Funcionários" active={activeTab === 'funcionarios'} onClick={() => { setActiveTab('funcionarios'); setIsMobileMenuOpen(false); }} />
                <SidebarLink icon={<Users size={20} />} label="Equipes" active={activeTab === 'equipes'} onClick={() => { setActiveTab('equipes'); setIsMobileMenuOpen(false); }} />
                {!isPartner && (
                  <>
                    <SidebarLink icon={<Smartphone size={20} />} label="Gestão de OPEC" active={activeTab === 'opec'} onClick={() => { setActiveTab('opec'); setIsMobileMenuOpen(false); }} />
                    <SidebarLink icon={<Car size={20} />} label="Controle de Frota" active={activeTab === 'veiculos'} onClick={() => { setActiveTab('veiculos'); setIsMobileMenuOpen(false); }} />
                  </>
                )}
                <SidebarLink icon={<Activity size={20} />} label="Monitoramento" active={activeTab === 'monitoramento'} onClick={() => { setActiveTab('monitoramento'); setIsMobileMenuOpen(false); }} />
              </>
            )}
          </nav>

          <div className="p-6 border-t border-slate-50 space-y-4">
            <div className={`flex flex-col gap-3 p-4 rounded-2xl border ${isPartner ? 'bg-slate-900 border-slate-800' : 'bg-orange-50 border-orange-100'}`}>
              <div className="flex items-center gap-3">
                <img src={currentUser.avatar} alt={currentUser.name} className="w-10 h-10 rounded-full border-2 border-white shadow-sm" />
                <div className="overflow-hidden">
                  <p className={`font-black text-sm truncate ${isPartner ? 'text-white' : 'text-slate-800'}`}>{currentUser.name}</p>
                  <p className={`text-[9px] font-black uppercase tracking-widest ${isPartner ? 'text-orange-500' : 'text-orange-600'}`}>{currentUser.role.replace('PARCEIRO_', '')}</p>
                </div>
              </div>
              <div className={`text-[8px] font-black uppercase py-1 px-2 rounded-md text-center ${isPartner ? 'bg-orange-500/20 text-orange-500' : 'bg-white text-orange-600'}`}>
                {currentUser.companyName}
              </div>
            </div>
            <button onClick={logout} className="flex items-center gap-3 w-full p-3 text-slate-400 hover:text-orange-600 hover:bg-orange-50 rounded-xl transition-all font-bold text-sm">
              <LogOut size={20} />
              Sair do Sistema
            </button>
          </div>
        </aside>

        {/* Chat Widget available for all logged in users */}
        <ChatWidget currentUser={currentUser} />

        {/* Profile Settings Modal */}
        {isProfileModalOpen && (
          <ProfileSettings
            user={currentUser}
            onClose={() => setIsProfileModalOpen(false)}
            onUpdate={(updatedUser) => {
              setCurrentUser(updatedUser);
            }}
          />
        )}
      </div>
    </ThemeProvider>
  );
};

const SidebarLink: React.FC<{ icon: React.ReactNode, label: string, active?: boolean, collapsed?: boolean, onClick?: () => void }> = ({ icon, label, active, collapsed, onClick }) => (
  <button
    onClick={onClick}
    title={collapsed ? label : undefined}
    className={`flex items-center gap-4 w-full px-6 py-4.5 rounded-[20px] transition-all font-black text-xs uppercase tracking-[0.1em] ${active
      ? 'bg-primary text-white shadow-2xl shadow-primary-200 scale-[1.02]'
      : 'text-slate-400 hover:bg-primary-50 hover:text-primary'
      } ${collapsed ? 'justify-center px-0' : ''}`}
  >
    <div className={active ? 'text-white' : 'text-slate-400 group-hover:text-primary'}>
      {React.cloneElement(icon as React.ReactElement, { size: 18 })}
    </div>
    {!collapsed && <span className="truncate">{label}</span>}
  </button>
);

export default App;
