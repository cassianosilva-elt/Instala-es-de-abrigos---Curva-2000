
import React, { useState, useEffect, useMemo } from 'react';
import { User, DailyReport, DailyActivity, Team, UserRole, Absence, Vehicle, OpecDevice } from '../types';
import { ACTIVITY_TYPES } from '../api/activityTypes';
import { getTeams, getAllUsers, getDailyReportByTeamAndDate, upsertDailyReport, createAbsence, getAbsences, deleteAbsence, getVehicles, getOpecDevices, getDailyReports, subscribeToDailyActivities, deleteDailyActivity, updateDailyActivityQuantity } from '../api/fieldManagerApi';
import { supabase } from '../api/supabaseClient';
import { ClipboardList, Users, Calendar, Plus, Save, History, X, AlertCircle, Download, Trash2, Car, Smartphone, Search } from 'lucide-react';
import { createEletromidiaWorkbook, styleHeaderRow, styleDataRows, autoFitColumns, saveWorkbook } from '../utils/excelExport';

interface Props {
    currentUser: User;
}

export const DailyReportView: React.FC<Props> = ({ currentUser }) => {
    const [selectedTeam, setSelectedTeam] = useState<string>('');
    const [selectedTechnicianIds, setSelectedTechnicianIds] = useState<string[]>([]);
    const [date, setDate] = useState<string>(new Date().toISOString().split('T')[0]);
    const [teams, setTeams] = useState<Team[]>([]);
    const [users, setUsers] = useState<User[]>([]);
    const [vehicles, setVehicles] = useState<Vehicle[]>([]);
    const [opecDevices, setOpecDevices] = useState<OpecDevice[]>([]);
    const [loading, setLoading] = useState(false);
    const [report, setReport] = useState<Partial<DailyReport> | null>(null);
    const [selectedActivities, setSelectedActivities] = useState<DailyActivity[]>([]);
    const [absences, setAbsences] = useState<Absence[]>([]);
    const [allDayReports, setAllDayReports] = useState<DailyReport[]>([]);
    const [isSaving, setIsSaving] = useState(false);
    const [isTechModalOpen, setIsTechModalOpen] = useState(false);
    const [techSearch, setTechSearch] = useState('');
    const [isVehicleModalOpen, setIsVehicleModalOpen] = useState(false);
    const [vehicleSearch, setVehicleSearch] = useState('');
    const [isOpecModalOpen, setIsOpecModalOpen] = useState(false);
    const [opecSearch, setOpecSearch] = useState('');

    const isToday = useMemo(() => {
        const today = new Date().toISOString().split('T')[0];
        return date === today;
    }, [date]);

    const isChief = currentUser.role === UserRole.CHEFE || currentUser.role === UserRole.PARCEIRO_CHEFE;
    // REGRA 2: Chefes e Líderes veem visualização consolidada
    const isLeaderOrChief = [UserRole.LIDER, UserRole.CHEFE, UserRole.PARCEIRO_LIDER, UserRole.PARCEIRO_CHEFE].includes(currentUser.role);


    useEffect(() => {
        loadInitialData();
    }, []);

    useEffect(() => {
        if (date) {
            loadReport();
        }
    }, [selectedTeam, date]);

    // REGRA 4: Realtime subscription para Live Feed
    useEffect(() => {
        if (isLeaderOrChief && date) {
            const channel = subscribeToDailyActivities(currentUser.companyId, date, (payload) => {
                // Quando uma nova atividade é inserida, recarrega os relatórios
                if (payload.eventType === 'INSERT') {
                    loadReport();
                }
            });

            return () => {
                supabase.removeChannel(channel);
            };
        }
    }, [currentUser.companyId, date, isLeaderOrChief]);

    const loadInitialData = async () => {
        setLoading(true);
        try {
            const [teamsData, usersData, vehiclesData, opecData] = await Promise.all([
                getTeams(currentUser.companyId),
                getAllUsers(currentUser.companyId),
                getVehicles(currentUser.companyId),
                getOpecDevices(currentUser.companyId)
            ]);
            setTeams(teamsData);
            setUsers(usersData);
            setVehicles(vehiclesData);
            setOpecDevices(opecData);

            // If user is a leader, pre-select their team
            const userTeam = teamsData.find(t => t.leaderId === currentUser.id);
            if (userTeam) {
                setSelectedTeam(userTeam.id);
                setSelectedTechnicianIds(userTeam.technicianIds);
            }
        } catch (err) {
            console.error('Error loading initial data:', err);
        } finally {
            setLoading(false);
        }
    };

    const loadReport = async () => {
        setLoading(true);
        try {
            const [reportData, companyReports] = await Promise.all([
                getDailyReportByTeamAndDate(
                    selectedTeam ? selectedTeam : null,
                    date,
                    selectedTeam ? undefined : selectedTechnicianIds,
                    currentUser.id,
                    currentUser.companyId
                ),
                getDailyReports(currentUser.companyId, undefined, date)
            ]);

            setAllDayReports(companyReports);

            if (reportData) {
                setReport(reportData);
                setSelectedActivities(reportData.activities);
                if (!selectedTeam && reportData.technicianIds) {
                    setSelectedTechnicianIds(reportData.technicianIds);
                }
            } else {
                setReport({
                    date,
                    teamId: selectedTeam || undefined,
                    technicianIds: selectedTeam ? undefined : selectedTechnicianIds,
                    userId: currentUser.id,
                    companyId: currentUser.companyId,
                    activities: []
                });
                setSelectedActivities([]);
            }

            // Load absences for this date and team/techs
            const allAbsences = await getAbsences(currentUser.companyId);
            const reportTechIds = selectedTeam
                ? (teams.find(t => t.id === selectedTeam)?.technicianIds || [])
                : selectedTechnicianIds;

            const dayAbsences = allAbsences.filter(a => a.date === date && reportTechIds.includes(a.employeeId));
            setAbsences(dayAbsences);

        } catch (err) {
            console.error('Error loading report:', err);
        } finally {
            setLoading(false);
        }
    };

    const handleAddActivity = (activityType: string) => {
        if (!isToday && !isChief) return;

        // Verify if technicians are selected
        const currentTechs = selectedTeam
            ? (teams.find(t => t.id === selectedTeam)?.technicianIds || [])
            : selectedTechnicianIds;

        if (currentTechs.length === 0) {
            alert('Selecione os técnicos ou equipe antes de adicionar uma atividade.');
            return;
        }

        setSelectedActivities(prev => [
            ...prev,
            {
                activityType,
                quantity: 1,
                technicianIds: currentTechs,
                // Generate a temp ID for UI distinction if needed, but not strictly required
            }
        ]);
    };

    const handleDeleteActivity = (index: number) => {
        if (!isToday && !isChief) return;
        setSelectedActivities(prev => prev.filter((_, i) => i !== index));
    };

    // Quantity change now needs index because we can have multiple of same type
    const handleQuantityChange = (index: number, quantity: number) => {
        if (!isToday && !isChief) return;
        setSelectedActivities(prev => prev.map((a, i) =>
            i === index ? { ...a, quantity: Math.max(1, quantity) } : a
        ));
    };


    const handleSave = async () => {
        if (!selectedTeam && selectedTechnicianIds.length === 0 && selectedActivities.length === 0) {
            alert('Adicione atividades ou selecione técnicos.');
            return;
        }

        if (!report?.carPlate || !report?.opecId) {
            alert('Seleção obrigatória: Por favor, selecione o VEÍCULO e o OPEC antes de salvar o relatório.');
            return;
        }

        setIsSaving(true);
        try {
            // Calculate aggregate technician IDs from all activities for the main report record
            const allTechIds = new Set<string>();
            selectedActivities.forEach(a => {
                a.technicianIds?.forEach(tid => allTechIds.add(tid));
            });
            // Include manually selected techs to avoid state loss
            selectedTechnicianIds.forEach(tid => allTechIds.add(tid));

            const finalTechIds = selectedTeam ? undefined : Array.from(allTechIds);

            const reportToSave: Omit<DailyReport, 'id'> = {
                date,
                userId: currentUser.id,
                teamId: selectedTeam || undefined,
                technicianIds: finalTechIds,
                companyId: currentUser.companyId,
                activities: selectedActivities,
                carPlate: report?.carPlate,
                opecId: report?.opecId,
                route: report?.route,
                notes: report?.notes
            };

            await upsertDailyReport(reportToSave, report?.id);

            alert('Relatório salvo com sucesso!');
            loadReport();
        } catch (err) {
            console.error('Error saving report:', err);
            alert('Erro ao salvar relatório.');
        } finally {
            setIsSaving(false);
        }
    };

    const handleAddAbsence = async (employeeId: string, reason: string) => {
        if (!isToday && !isChief) return;
        const employee = users.find(u => u.id === employeeId);
        if (!employee) return;

        try {
            await createAbsence({
                employeeId,
                employeeName: employee.name,
                date,
                reason: reason as any,
                companyId: currentUser.companyId
            });
            loadReport();
        } catch (err) {
            console.error('Error recording absence:', err);
        }
    };

    const handleDeleteAbsence = async (id: string) => {
        if (!isToday && !isChief) return;
        if (!confirm('Tem certeza que deseja remover esta falta?')) return;

        try {
            await deleteAbsence(id);
            loadReport();
        } catch (err) {
            console.error('Error deleting absence:', err);
            alert('Erro ao remover falta.');
        }
    };

    const handleExportExcel = async () => {
        const teamName = selectedTeam
            ? teams.find(t => t.id === selectedTeam)?.name || 'Equipe'
            : 'Equipe Personalizada';

        // 1. Calculate all unique participants FROM ALL REPORTS OF THE DAY
        const participantIds = new Set<string>();
        let maxTechs = 0; // Initialize maxTechs here

        allDayReports.forEach(r => {
            if (r.teamId) {
                const team = teams.find(t => t.id === r.teamId);
                team?.technicianIds.forEach(id => participantIds.add(id));
                if (team?.leaderId) participantIds.add(team.leaderId);
            }
            if (r.technicianIds) {
                r.technicianIds.forEach(id => participantIds.add(id));
            }
            r.activities.forEach(a => {
                a.technicianIds?.forEach(tid => participantIds.add(tid));
                // Update maxTechs based on ALL activities in ALL reports
                maxTechs = Math.max(maxTechs, a.technicianIds?.length || 0);
            });
            if (r.userId) participantIds.add(r.userId);
        });

        const participants = users.filter(u => participantIds.has(u.id));

        // 2. Info for header
        // For Consolidated, we use the header of Sheet1 based on the first report or current selection,
        // but rows will have their own metadata.
        const currentCarInfo = vehicles.find(v => v.plate === report?.carPlate);
        const currentOpecInfo = opecDevices.find(o => o.id === report?.opecId);

        // 3. Create Workbook and Sheets
        const { workbook, worksheet: wsActivities, startRow } = await createEletromidiaWorkbook(
            `Relatório Diário Consolidado - ${date}`,
            'Atividades'
        );

        // --- SHEET 1: ATIVIDADES ---
        // Header row - REGRA 3: Inclui coluna Líder Responsável
        const activitiesHeader = ['Data', 'Veículo', 'OPEC', 'Rota', 'Tipo de Atividade', 'Quantidade', 'Líder Responsável', 'Observações'];
        // Use maxTechs calculated from all reports
        for (let i = 0; i < Math.max(maxTechs, 1); i++) {
            activitiesHeader.push(`Técnico ${i + 1}`);
        }

        const headerRow = wsActivities.getRow(startRow);
        headerRow.values = activitiesHeader;
        styleHeaderRow(headerRow);

        // Data rows - ALL REPORTS FOR THE DAY
        allDayReports.forEach((r) => {
            const rowCarInfo = vehicles.find(v => v.plate === r.carPlate);
            const rowOpecInfo = opecDevices.find(o => o.id === r.opecId);

            r.activities.forEach((a) => {
                // REGRA 3: Inclui liderName no Excel
                const rowData: (string | number)[] = [
                    date,
                    rowCarInfo ? `${rowCarInfo.model} (${rowCarInfo.plate})` : '',
                    rowOpecInfo ? `${rowOpecInfo.assetCode}` : '',
                    r.route || '',
                    a.activityType,
                    a.quantity,
                    a.liderName || users.find(u => u.id === r.userId)?.name || 'Desconhecido', // Líder Responsável
                    r.notes || ''
                ];

                if (a.technicianIds && a.technicianIds.length > 0) {
                    a.technicianIds.forEach(tid => {
                        const techName = users.find(u => u.id === tid)?.name || 'Desconhecido';
                        rowData.push(techName);
                    });
                } else {
                    rowData.push('Equipe Completa');
                }

                wsActivities.addRow(rowData);
            });
        });

        styleDataRows(wsActivities, startRow);
        autoFitColumns(wsActivities);

        // --- SHEET 2: PARTICIPANTES ---
        const wsMembers = workbook.addWorksheet('Participantes');
        const membersHeader = ['Nome', 'Função', 'Status'];
        const mHeaderRow = wsMembers.getRow(1);
        mHeaderRow.values = membersHeader;
        styleHeaderRow(mHeaderRow);

        participants.forEach(m => {
            const absence = absences.find(a => a.employeeId === m.id);
            wsMembers.addRow([
                m.name,
                m.role.replace('PARCEIRO_', ''),
                absence ? `AUSENTE: ${absence.reason}` : 'PRESENTE'
            ]);
        });

        styleDataRows(wsMembers, 1);
        autoFitColumns(wsMembers);

        // --- SHEET 3: RESUMO ---
        const wsSummary = workbook.addWorksheet('Resumo');
        const summaryHeader = ['Campo', 'Valor'];
        const sHeaderRow = wsSummary.getRow(1);
        sHeaderRow.values = summaryHeader;
        styleHeaderRow(sHeaderRow);

        const summaryData = [
            ['Data', date],
            ['Equipe/Referência', teamName],
            ['Veículo (Principal)', currentCarInfo ? `${currentCarInfo.model} (${currentCarInfo.plate})` : 'N/A'],
            ['OPEC (Principal)', currentOpecInfo ? `${currentOpecInfo.assetCode} - ${currentOpecInfo.model}` : 'N/A'],
            ['Total de Lançamentos (Dia)', allDayReports.reduce((acc, r) => acc + r.activities.length, 0)],
            ['Total de Peças/Qtd (Dia)', allDayReports.reduce((acc, r) => acc + r.activities.reduce((sum, a) => sum + a.quantity, 0), 0)],
            ['Relatórios Consolidados', allDayReports.length],
            ['Participantes Únicos', participants.length],
            ['Ausências Registradas', absences.length],
            ['Rota', report?.route || ''],
            ['Observação', report?.notes || '']
        ];

        summaryData.forEach(row => wsSummary.addRow(row));
        styleDataRows(wsSummary, 1);
        autoFitColumns(wsSummary);

        // Save
        const fileName = `Relatorio_${date}_${teamName.replace(/\s/g, '_')}`;
        await saveWorkbook(workbook, fileName);
    };

    const teamMembers = useMemo(() => {
        if (selectedTeam) {
            const team = teams.find(t => t.id === selectedTeam);
            if (!team) return [];
            return users.filter(u => team.technicianIds.includes(u.id) || u.id === team.leaderId);
        } else {
            return users.filter(u => selectedTechnicianIds.includes(u.id));
        }
    }, [selectedTeam, selectedTechnicianIds, teams, users]);

    const handleToggleTechnician = (techId: string) => {
        setSelectedTechnicianIds(prev =>
            prev.includes(techId) ? prev.filter(id => id !== techId) : [...prev, techId]
        );
        if (selectedTeam) setSelectedTeam('');
    };

    const hasActivitiesInDay = useMemo(() => {
        return allDayReports.some(r => r.activities && r.activities.length > 0);
    }, [allDayReports]);

    return (
        <div className="space-y-6 max-w-6xl mx-auto pb-20">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
                <div>
                    <h2 className="text-2xl font-black text-slate-800 flex items-center gap-2 uppercase tracking-tighter">
                        <ClipboardList className="text-primary" />
                        Relatório Diário
                    </h2>
                    <p className="text-slate-500 font-bold text-xs uppercase tracking-widest mt-1">Controle de atividades e presenças</p>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                    <div className="flex items-center gap-2 bg-slate-50 p-2 rounded-2xl border border-slate-100">
                        <Calendar size={18} className="text-slate-400 ml-2" />
                        <input
                            type="date"
                            value={date}
                            onChange={e => setDate(e.target.value)}
                            max={new Date().toISOString().split('T')[0]}
                            className="bg-transparent border-none font-black text-slate-700 outline-none p-1 text-sm"
                        />
                    </div>

                    <div className="flex items-center gap-2 bg-slate-50 p-2 rounded-2xl border border-slate-100">
                        <Users size={18} className="text-slate-400 ml-2" />
                        <select
                            value={selectedTeam}
                            onChange={e => setSelectedTeam(e.target.value)}
                            className="bg-transparent border-none font-black text-slate-700 outline-none p-1 text-sm min-w-[150px]"
                        >
                            <option value="">Selecionar Equipe</option>
                            {teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                        </select>
                    </div>

                    <button
                        onClick={() => { setSelectedTeam(''); setIsTechModalOpen(true); }}
                        className={`flex items-center gap-2 px-4 py-2 rounded-2xl font-black text-xs transition-all border ${!selectedTeam && selectedTechnicianIds.length > 0
                            ? 'bg-primary/10 border-primary text-primary'
                            : 'bg-slate-50 border-slate-100 text-slate-500 hover:border-slate-300'
                            }`}
                    >
                        <Plus size={14} />
                        {selectedTechnicianIds.length > 0 && !selectedTeam
                            ? `${selectedTechnicianIds.length} Técnicos`
                            : 'Personalizar'}
                    </button>

                    <div className="h-6 w-px bg-slate-200 mx-2 hidden md:block"></div>

                    {/* Selections for Vehicle and OPEC */}
                    <button
                        onClick={() => setIsVehicleModalOpen(true)}
                        className="flex items-center gap-2 bg-slate-50 p-3 rounded-2xl border border-slate-100 hover:border-slate-200 transition-all text-xs font-black text-slate-700 min-w-[150px] group"
                    >
                        <Car size={18} className="text-slate-400 group-hover:text-primary transition-colors" />
                        <span className="truncate">
                            {report?.carPlate
                                ? `${vehicles.find(v => v.plate === report.carPlate)?.tag || 'S/T'} - ${report.carPlate}`
                                : 'Selecionar Veículo'}
                        </span>
                    </button>

                    <button
                        onClick={() => setIsOpecModalOpen(true)}
                        className="flex items-center gap-2 bg-slate-50 p-3 rounded-2xl border border-slate-100 hover:border-slate-200 transition-all text-xs font-black text-slate-700 min-w-[150px] group"
                    >
                        <Smartphone size={18} className="text-slate-400 group-hover:text-primary transition-colors" />
                        <span className="truncate">
                            {report?.opecId
                                ? opecDevices.find(d => d.id === report.opecId)?.assetCode || 'Selecionar OPEC'
                                : 'Selecionar OPEC'}
                        </span>
                    </button>

                    <div className="flex-1"></div>


                    <button
                        onClick={handleSave}
                        disabled={isSaving || (!isToday && !isChief)}
                        className="flex items-center gap-2 bg-primary text-white px-6 py-3 rounded-2xl font-black text-sm hover:bg-primary-600 transition-all shadow-lg shadow-primary/20 disabled:opacity-50 disabled:grayscale"
                    >
                        {isSaving ? <History className="animate-spin" /> : <Save size={18} />}
                        Salvar Relatório
                    </button>

                    <button
                        onClick={handleExportExcel}
                        disabled={!hasActivitiesInDay}
                        className="flex items-center gap-2 bg-slate-700 text-white px-4 py-3 rounded-2xl font-black text-sm hover:bg-slate-800 transition-all shadow-lg disabled:opacity-50 disabled:grayscale"
                    >
                        <Download size={18} />
                        Exportar
                    </button>

                </div>
            </div>

            {(!isToday && !isChief) && (
                <div className="bg-orange-50 border border-orange-200 p-4 rounded-2xl flex items-center gap-3 text-orange-700 font-bold text-sm">
                    <AlertCircle size={20} />
                    Modo Leitura: Edições só são permitidas no dia vigente.
                </div>
            )}

            {report?.id && (
                <div className="bg-green-50 border border-green-200 p-4 rounded-2xl flex items-center gap-3 text-green-700 font-bold text-sm">
                    <ClipboardList size={20} />
                    Relatório salvo encontrado para {date}. Os dados foram carregados.
                </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Atividades */}
                <div className="lg:col-span-2 space-y-6">
                    <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
                        <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-6 flex items-center gap-2">
                            <Plus size={16} className="text-primary" /> Atividades Realizadas
                        </h3>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-8">
                            {ACTIVITY_TYPES.map(type => (
                                <button
                                    key={type}
                                    onClick={() => handleAddActivity(type)}
                                    className="p-4 rounded-2xl border bg-slate-50 border-slate-100 hover:border-primary hover:bg-primary/5 hover:text-primary transition-all flex items-center justify-between gap-4 group cursor-pointer select-none relative active:scale-[0.98] focus:outline-none focus:ring-2 focus:ring-primary/20"
                                >
                                    <span className="text-[11px] font-black uppercase leading-tight text-slate-600 group-hover:text-primary text-left">
                                        {type}
                                    </span>
                                    <div className="w-6 h-6 rounded-full bg-white border border-slate-200 flex items-center justify-center group-hover:border-primary group-active:scale-90 transition-transform">
                                        <Plus size={14} className="text-slate-400 group-hover:text-primary" />
                                    </div>
                                </button>
                            ))}
                        </div>

                        {/* Log de Atividades Adicionadas */}
                        <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2 border-t pt-6">
                            <ClipboardList size={16} /> Lançamentos do Dia
                        </h3>

                        <div className="space-y-3">
                            {selectedActivities.length === 0 ? (
                                <p className="text-center text-slate-400 text-xs py-8">Nenhuma atividade lançada ainda.</p>
                            ) : (
                                selectedActivities.map((activity, index) => {
                                    // Resolve Tech Names
                                    const techNames = activity.technicianIds?.map(tid => users.find(u => u.id === tid)?.name || 'Desconhecido').join(', ') || 'Equipe Completa';

                                    return (
                                        <div key={`edit-${index}`} className="flex items-center gap-4 p-4 bg-slate-50 rounded-2xl border border-slate-100 ring-2 ring-primary/10">
                                            <div className="flex-1">
                                                <div className="flex items-center justify-between mb-1">
                                                    <div className="flex items-center gap-2">
                                                        <span className="text-[10px] font-black px-2 py-0.5 bg-primary/10 text-primary rounded-full uppercase">Editando</span>
                                                        <span className="text-xs font-black uppercase text-slate-700">{activity.activityType}</span>
                                                    </div>
                                                    <button onClick={() => handleDeleteActivity(index)} className="text-red-400 hover:text-red-600 p-1">
                                                        <X size={14} />
                                                    </button>
                                                </div>
                                                <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wide mb-2 line-clamp-1">
                                                    {techNames}
                                                </p>
                                                <div className="flex items-center gap-2">
                                                    <span className="text-[10px] font-bold text-slate-400 uppercase">Qtd:</span>
                                                    <input
                                                        type="number"
                                                        value={activity.quantity}
                                                        onChange={e => handleQuantityChange(index, parseInt(e.target.value))}
                                                        className="w-16 p-1 text-center font-black text-slate-700 bg-white border border-slate-200 rounded-lg text-xs outline-none focus:border-primary"
                                                    />
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })
                            )}

                            {/* Mostrar atividades de OUTROS relatórios do mesmo dia */}
                            {allDayReports.filter(r => r.id !== report?.id).length > 0 && (
                                <div className="mt-8 space-y-3 pt-6 border-t border-slate-100">
                                    <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Outros Lançamentos do Dia</h4>
                                    {allDayReports
                                        .filter(r => r.id !== report?.id)
                                        .map(otherReport => {
                                            const reporter = users.find(u => u.id === otherReport.userId);
                                            const team = teams.find(t => t.id === otherReport.teamId);
                                            const sourceName = team ? team.name : (reporter?.name || 'Desconhecido');

                                            return otherReport.activities.map((activity, aIdx) => {
                                                const techNames = activity.technicianIds?.map(tid => users.find(u => u.id === tid)?.name || 'Desconhecido').join(', ') || 'Equipe Completa';
                                                return (
                                                    <div key={`view-${otherReport.id}-${aIdx}`} className="flex items-center gap-4 p-4 bg-slate-50/50 rounded-2xl border border-slate-100 opacity-60">
                                                        <div className="flex-1">
                                                            <div className="flex items-center justify-between mb-1">
                                                                <div className="flex items-center gap-2">
                                                                    <span className="text-[10px] font-black px-2 py-0.5 bg-slate-200 text-slate-500 rounded-full uppercase">{sourceName}</span>
                                                                    <span className="text-xs font-black uppercase text-slate-400">{activity.activityType}</span>
                                                                </div>
                                                            </div>
                                                            <p className="text-[9px] text-slate-400 font-bold uppercase tracking-wide mb-1 line-clamp-1">
                                                                {techNames}
                                                            </p>
                                                            <div className="flex items-center gap-2">
                                                                <span className="text-[9px] font-bold text-slate-300 uppercase">Qtd: {activity.quantity}</span>
                                                                <span className="text-[9px] font-bold text-slate-300 uppercase px-2">|</span>
                                                                <span className="text-[9px] font-bold text-slate-300 uppercase">Rota: {otherReport.route || 'N/A'}</span>
                                                            </div>
                                                        </div>
                                                    </div>
                                                );
                                            });
                                        })
                                    }
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Equipe e Ausências */}
                <div className="space-y-6">
                    <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
                        <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-6 flex items-center gap-2">
                            Membros da Equipe
                        </h3>

                        <div className="space-y-4">
                            {teamMembers.length === 0 ? (
                                <p className="text-center py-8 text-slate-400 text-xs italic">Nenhuma equipe selecionada.</p>
                            ) : teamMembers.map(member => {
                                const absence = absences.find(a => a.employeeId === member.id);
                                return (
                                    <div key={member.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-2xl border border-slate-100">
                                        <div className="flex items-center gap-3">
                                            <img src={member.avatar} alt="" className="w-8 h-8 rounded-xl" />
                                            <div>
                                                <p className="text-xs font-black text-slate-700 leading-none">{member.name}</p>
                                                <p className="text-[9px] font-bold text-slate-400 uppercase mt-1">
                                                    {member.role.replace('PARCEIRO_', '')}
                                                </p>
                                            </div>
                                        </div>

                                        {absence ? (
                                            <div className="flex items-center gap-2">
                                                <span className="text-[8px] font-black uppercase px-2 py-1 bg-red-100 text-red-600 rounded-md">
                                                    AUSENTE: {absence.reason}
                                                </span>
                                                <button
                                                    onClick={() => handleDeleteAbsence(absence.id!)}
                                                    className="p-1 hover:bg-slate-100 rounded text-slate-400 hover:text-red-500 transition-colors"
                                                    title="Remover falta"
                                                >
                                                    <Trash2 size={12} />
                                                </button>
                                            </div>
                                        ) : (
                                            <div className="flex items-center gap-1">
                                                <button
                                                    onClick={() => handleAddAbsence(member.id, 'Falta Injustificada')}
                                                    disabled={!isToday && !isChief}
                                                    className="p-1.5 hover:bg-red-50 text-slate-300 hover:text-red-500 rounded-lg transition-colors"
                                                    title="Marcar Falta"
                                                >
                                                    <X size={16} />
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
                        <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-4">Rota</h3>
                        <input
                            type="text"
                            value={report?.route || ''}
                            onChange={e => setReport(prev => ({ ...prev, route: e.target.value }))}
                            disabled={!isToday && !isChief}
                            placeholder="Digite a rota manualmente..."
                            className="w-full p-4 mb-6 bg-slate-50 border border-slate-100 rounded-2xl text-xs font-bold text-slate-600 outline-none focus:ring-2 focus:ring-primary/20"
                        />

                        <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-4">Observação</h3>
                        <textarea
                            value={report?.notes || ''}
                            onChange={e => setReport(prev => ({ ...prev, notes: e.target.value }))}
                            disabled={!isToday && !isChief}
                            placeholder="Observações adicionais..."
                            className="w-full h-32 p-4 bg-slate-50 border border-slate-100 rounded-2xl text-xs font-bold text-slate-600 outline-none focus:ring-2 focus:ring-primary/20 resize-none"
                        />
                    </div>
                </div>
            </div>

            {/* Modal de Seleção de Técnicos */}
            {isTechModalOpen && (
                <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-[32px] w-full max-w-md overflow-hidden shadow-2xl border border-slate-200 animate-in fade-in zoom-in duration-200">
                        <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                            <div>
                                <h3 className="text-lg font-black text-slate-800 uppercase tracking-tighter">Selecionar Técnicos</h3>
                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Monte sua equipe do dia</p>
                            </div>
                            <button onClick={() => setIsTechModalOpen(false)} className="p-2 hover:bg-white rounded-xl text-slate-400 transition-colors shadow-sm">
                                <X size={20} />
                            </button>
                        </div>
                        <div className="px-6 py-4 border-b border-slate-100 bg-white">
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                                <input
                                    type="text"
                                    placeholder="Pesquisar por nome..."
                                    value={techSearch}
                                    onChange={(e) => setTechSearch(e.target.value)}
                                    className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-100 rounded-2xl text-xs font-bold text-slate-600 outline-none focus:ring-2 focus:ring-primary/20"
                                />
                                {techSearch && (
                                    <button
                                        onClick={() => setTechSearch('')}
                                        className="absolute right-3 top-1/2 -translate-y-1/2 p-1 hover:bg-slate-200 rounded-lg text-slate-400"
                                    >
                                        <X size={12} />
                                    </button>
                                )}
                            </div>
                        </div>

                        <div className="p-4 max-h-[400px] overflow-y-auto space-y-2">
                            {users
                                .filter(u => u.role === UserRole.TECNICO || u.role === UserRole.PARCEIRO_TECNICO || u.role === UserRole.LIDER || u.role === UserRole.PARCEIRO_LIDER)
                                .filter(u => u.name.toLowerCase().includes(techSearch.toLowerCase()))
                                .map(user => (
                                    <div
                                        key={user.id}
                                        onClick={() => handleToggleTechnician(user.id)}
                                        className={`flex items-center gap-3 p-3 rounded-2xl border transition-all cursor-pointer ${selectedTechnicianIds.includes(user.id)
                                            ? 'bg-primary/5 border-primary shadow-sm'
                                            : 'bg-slate-50 border-slate-100 hover:border-slate-200'
                                            }`}
                                    >
                                        <img src={user.avatar} className="w-8 h-8 rounded-xl" alt="" />
                                        <div className="flex-1">
                                            <p className={`text-xs font-black ${selectedTechnicianIds.includes(user.id) ? 'text-primary' : 'text-slate-700'}`}>
                                                {user.name}
                                            </p>
                                            <p className="text-[9px] font-bold text-slate-400 uppercase">
                                                {user.role.replace('PARCEIRO_', '')}
                                            </p>
                                        </div>
                                        <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all ${selectedTechnicianIds.includes(user.id) ? 'bg-primary border-primary' : 'border-slate-200'
                                            }`}>
                                            {selectedTechnicianIds.includes(user.id) && <Plus size={12} className="text-white rotate-45" />}
                                        </div>
                                    </div>
                                ))}
                        </div>
                        <div className="p-6 bg-slate-50 border-t border-slate-100">
                            <button
                                onClick={() => { setIsTechModalOpen(false); setTechSearch(''); }}
                                className="w-full bg-slate-800 text-white py-4 rounded-2xl font-black text-sm hover:bg-slate-900 transition-all shadow-lg"
                            >
                                Confirmar Seleção
                            </button>
                        </div>
                    </div>
                </div>
            )}
            {/* Modal de Seleção de Veículo */}
            {isVehicleModalOpen && (
                <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-[32px] w-full max-w-md overflow-hidden shadow-2xl border border-slate-200 animate-in fade-in zoom-in duration-200">
                        <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                            <div>
                                <h3 className="text-lg font-black text-slate-800 uppercase tracking-tighter">Selecionar Veículo</h3>
                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Escolha o veículo utilizado hoje</p>
                            </div>
                            <button onClick={() => { setIsVehicleModalOpen(false); setVehicleSearch(''); }} className="p-2 hover:bg-white rounded-xl text-slate-400 transition-colors shadow-sm">
                                <X size={20} />
                            </button>
                        </div>

                        <div className="px-6 py-4 border-b border-slate-100 bg-white">
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                                <input
                                    type="text"
                                    placeholder="Pesquisar por tag, modelo ou placa..."
                                    value={vehicleSearch}
                                    onChange={(e) => setVehicleSearch(e.target.value)}
                                    className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-100 rounded-2xl text-xs font-bold text-slate-600 outline-none focus:ring-2 focus:ring-primary/20"
                                />
                                {vehicleSearch && (
                                    <button
                                        onClick={() => setVehicleSearch('')}
                                        className="absolute right-3 top-1/2 -translate-y-1/2 p-1 hover:bg-slate-200 rounded-lg text-slate-400"
                                    >
                                        <X size={12} />
                                    </button>
                                )}
                            </div>
                        </div>

                        <div className="p-4 max-h-[400px] overflow-y-auto space-y-2">
                            {vehicles
                                .filter(v =>
                                    (v.tag?.toLowerCase() || '').includes(vehicleSearch.toLowerCase()) ||
                                    v.model.toLowerCase().includes(vehicleSearch.toLowerCase()) ||
                                    v.plate.toLowerCase().includes(vehicleSearch.toLowerCase())
                                )
                                .sort((a, b) => (a.tag || '').localeCompare(b.tag || ''))
                                .map(vehicle => (
                                    <div
                                        key={vehicle.id}
                                        onClick={() => {
                                            setReport(prev => ({ ...prev, carPlate: vehicle.plate }));
                                            setIsVehicleModalOpen(false);
                                            setVehicleSearch('');
                                        }}
                                        className={`flex items-center gap-3 p-3 rounded-2xl border transition-all cursor-pointer ${report?.carPlate === vehicle.plate
                                            ? 'bg-primary/5 border-primary shadow-sm'
                                            : 'bg-slate-50 border-slate-100 hover:border-slate-200'
                                            }`}
                                    >
                                        <div className="w-10 h-10 rounded-xl bg-white border border-slate-100 flex items-center justify-center text-slate-400 shadow-sm">
                                            <Car size={20} />
                                        </div>
                                        <div className="flex-1">
                                            <p className={`text-xs font-black ${report?.carPlate === vehicle.plate ? 'text-primary' : 'text-slate-700'}`}>
                                                {vehicle.tag ? `${vehicle.tag} - ` : ''}{vehicle.model} - {vehicle.plate}
                                            </p>
                                            <p className="text-[9px] font-bold text-slate-400 uppercase">
                                                {vehicle.status}
                                            </p>
                                        </div>
                                        {report?.carPlate === vehicle.plate && (
                                            <div className="w-5 h-5 rounded-full bg-primary flex items-center justify-center">
                                                <Plus size={12} className="text-white rotate-45" />
                                            </div>
                                        )}
                                    </div>
                                ))}
                        </div>
                    </div>
                </div>
            )}
            {/* Modal de Seleção de OPEC */}
            {isOpecModalOpen && (
                <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-[32px] w-full max-w-md overflow-hidden shadow-2xl border border-slate-200 animate-in fade-in zoom-in duration-200">
                        <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                            <div>
                                <h3 className="text-lg font-black text-slate-800 uppercase tracking-tighter">Selecionar OPEC</h3>
                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Escolha o dispositivo OPEC utilizado</p>
                            </div>
                            <button onClick={() => { setIsOpecModalOpen(false); setOpecSearch(''); }} className="p-2 hover:bg-white rounded-xl text-slate-400 transition-colors shadow-sm">
                                <X size={20} />
                            </button>
                        </div>

                        <div className="px-6 py-4 border-b border-slate-100 bg-white">
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                                <input
                                    type="text"
                                    placeholder="Pesquisar por código ou modelo..."
                                    value={opecSearch}
                                    onChange={(e) => setOpecSearch(e.target.value)}
                                    className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-100 rounded-2xl text-xs font-bold text-slate-600 outline-none focus:ring-2 focus:ring-primary/20"
                                />
                                {opecSearch && (
                                    <button
                                        onClick={() => setOpecSearch('')}
                                        className="absolute right-3 top-1/2 -translate-y-1/2 p-1 hover:bg-slate-200 rounded-lg text-slate-400"
                                    >
                                        <X size={12} />
                                    </button>
                                )}
                            </div>
                        </div>

                        <div className="p-4 max-h-[400px] overflow-y-auto space-y-2">
                            {opecDevices
                                .filter(d =>
                                    d.assetCode.toLowerCase().includes(opecSearch.toLowerCase()) ||
                                    d.model.toLowerCase().includes(opecSearch.toLowerCase())
                                )
                                .sort((a, b) => a.assetCode.localeCompare(b.assetCode))
                                .map(device => (
                                    <div
                                        key={device.id}
                                        onClick={() => {
                                            setReport(prev => ({ ...prev, opecId: device.id }));
                                            setIsOpecModalOpen(false);
                                            setOpecSearch('');
                                        }}
                                        className={`flex items-center gap-3 p-3 rounded-2xl border transition-all cursor-pointer ${report?.opecId === device.id
                                            ? 'bg-primary/5 border-primary shadow-sm'
                                            : 'bg-slate-50 border-slate-100 hover:border-slate-200'
                                            }`}
                                    >
                                        <div className="w-10 h-10 rounded-xl bg-white border border-slate-100 flex items-center justify-center text-slate-400 shadow-sm">
                                            <Smartphone size={20} />
                                        </div>
                                        <div className="flex-1">
                                            <p className={`text-xs font-black ${report?.opecId === device.id ? 'text-primary' : 'text-slate-700'}`}>
                                                {device.assetCode} - {device.model}
                                            </p>
                                        </div>
                                        {report?.opecId === device.id && (
                                            <div className="w-5 h-5 rounded-full bg-primary flex items-center justify-center">
                                                <Plus size={12} className="text-white rotate-45" />
                                            </div>
                                        )}
                                    </div>
                                ))}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
