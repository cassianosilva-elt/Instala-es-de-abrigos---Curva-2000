import React, { useState, useEffect } from 'react';
import { User, Employee, UserRole, Absence } from '../types';
import { getEmployees, bulkCreateEmployees, deleteEmployeeInvite, createAbsence, getAbsences, bulkDeleteInvites, uploadAbsenceEvidence } from '../api/fieldManagerApi';
import { Users, Upload, Search, Download, Trash2, Mail, CheckCircle2, Clock, AlertCircle, CalendarOff, Plus, ChevronUp, ChevronDown, Filter, Eye, FileText } from 'lucide-react';
import readXlsxFile from 'read-excel-file';
import { createEletromidiaWorkbook, styleHeaderRow, styleDataRows, autoFitColumns, saveWorkbook } from '../utils/excelExport';

interface EmployeesViewProps {
    currentUser: User;
}

export const EmployeesView: React.FC<EmployeesViewProps> = ({ currentUser }) => {
    const [employees, setEmployees] = useState<Employee[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [isImportModalOpen, setIsImportModalOpen] = useState(false);
    const [importing, setImporting] = useState(false);
    const [importStats, setImportStats] = useState<{ total: number; success: number } | null>(null);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);

    const [absences, setAbsences] = useState<Absence[]>([]);
    const [isAbsenceModalOpen, setIsAbsenceModalOpen] = useState(false);
    const [selectedEmployeeForAbsence, setSelectedEmployeeForAbsence] = useState<Employee | null>(null);
    const [absenceForm, setAbsenceForm] = useState<{ date: string; reason: string; description: string; evidenceFile: File | null; evidenceUrl: string }>({
        date: new Date().toISOString().split('T')[0],
        reason: 'Falta Injustificada',
        description: '',
        evidenceFile: null,
        evidenceUrl: ''
    });

    const [selectedIds, setSelectedIds] = useState<string[]>([]);
    const [isDeletingBulk, setIsDeletingBulk] = useState(false);

    const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' } | null>(null);
    const [filters, setFilters] = useState({
        role: '',
        originalStatus: '',
        shift: '',
        leaderName: ''
    });
    const [isFilterBarOpen, setIsFilterBarOpen] = useState(false);
    const [selectedEvidenceUrl, setSelectedEvidenceUrl] = useState<string | null>(null);

    const [isReportModalOpen, setIsReportModalOpen] = useState(false);
    const [reportMonth, setReportMonth] = useState<number>(new Date().getMonth() + 1);
    const [reportYear, setReportYear] = useState<number>(new Date().getFullYear());

    useEffect(() => {
        loadEmployees();
        loadAbsences();
    }, [currentUser]);

    const loadAbsences = async () => {
        try {
            const data = await getAbsences(currentUser.companyId);
            setAbsences(data);
        } catch (err) {
            console.error('Error loading absences:', err);
        }
    };

    const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.checked) {
            // Only select pending employees for deletion safety
            const pendingIds = filteredEmployees.filter(emp => emp.status === 'PENDING').map(emp => emp.id);
            setSelectedIds(pendingIds);
        } else {
            setSelectedIds([]);
        }
    };

    const handleSelectEmployee = (id: string) => {
        setSelectedIds(prev =>
            prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
        );
    };

    const handleBulkDelete = async () => {
        if (selectedIds.length === 0) return;
        if (!confirm(`Tem certeza que deseja excluir ${selectedIds.length} convites selecionados ? `)) return;

        setIsDeletingBulk(true);
        try {
            await bulkDeleteInvites(selectedIds);
            alert(`${selectedIds.length} convites excluídos com sucesso!`);
            setSelectedIds([]);
            loadEmployees();
        } catch (err) {
            console.error('Error bulk deleting:', err);
            alert('Erro ao excluir convites.');
        } finally {
            setIsDeletingBulk(false);
        }
    };

    const handleOpenAbsenceModal = (employee: Employee) => {
        setSelectedEmployeeForAbsence(employee);
        setAbsenceForm({
            date: new Date().toISOString().split('T')[0],
            reason: 'Falta Injustificada',
            description: '',
            evidenceFile: null,
            evidenceUrl: ''
        });
        setIsAbsenceModalOpen(true);
    };

    const handleAbsenceFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            setAbsenceForm(prev => ({ ...prev, evidenceFile: file }));
        }
    };

    const handleSubmitAbsence = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedEmployeeForAbsence) return;

        setLoading(true);
        try {
            let evidenceUrl = '';
            if (absenceForm.evidenceFile) {
                evidenceUrl = await uploadAbsenceEvidence(absenceForm.evidenceFile);
            }

            await createAbsence({
                employeeId: selectedEmployeeForAbsence.id,
                employeeName: selectedEmployeeForAbsence.name,
                date: absenceForm.date,
                reason: absenceForm.reason as any,
                description: absenceForm.description,
                companyId: currentUser.companyId,
                evidenceUrl: evidenceUrl
            });
            alert('Ausência registrada com sucesso!');
            setIsAbsenceModalOpen(false);
            loadAbsences();
        } catch (err) {
            console.error('Error creating absence:', err);
            alert('Erro ao registrar ausência.');
        } finally {
            setLoading(false);
        }
    };


    const loadEmployees = async () => {
        setLoading(true);
        try {
            const data = await getEmployees(currentUser.companyId);
            setEmployees(data);
        } catch (err) {
            console.error('Error loading employees:', err);
        } finally {
            setLoading(false);
        }
    };

    const handleDeleteInvite = async (inviteId: string) => {
        if (!confirm('Tem certeza que deseja remover este convite?')) return;
        try {
            await deleteEmployeeInvite(inviteId);
            loadEmployees();
        } catch (err) {
            console.error('Error deleting invite:', err);
            alert('Erro ao remover convite.');
        }
    };

    const handleDownloadTemplate = () => {
        const headers = ['Turno', 'Cadastro', 'Lider', 'Nome', 'Cargo', 'Status', 'Empresa'];
        const rows = [
            ['DIA', '12345', 'Maria Supervisor', 'Joao Silva', 'Técnico', 'ativo', 'Interno'],
            ['NOITE', '67890', 'Jose Chefe', 'Pedro Souza', 'Líder', 'ativo - adm', 'Interno']
        ];

        const csvContent = "data:text/csv;charset=utf-8,"
            + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');

        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", "modelo_funcionarios.csv");
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const handleExportAbsences = async () => {
        const filteredAbsences = absences.filter(a => {
            const date = new Date(a.date);
            return (date.getMonth() + 1) === reportMonth && date.getFullYear() === reportYear;
        });

        if (filteredAbsences.length === 0) {
            alert('Nenhuma ausência encontrada para o período selecionado.');
            return;
        }

        const monthName = new Intl.DateTimeFormat('pt-BR', { month: 'long' }).format(new Date(2000, reportMonth - 1));
        const { workbook, worksheet, startRow } = await createEletromidiaWorkbook(
            `Relatório de Ausências - ${monthName} / ${reportYear}`,
            'Ausências'
        );

        // Header row
        const headers = [
            'Data', 'Funcionário', 'Matrícula/ID', 'Cargo', 'Turno',
            'Líder', 'Motivo', 'Observação', 'Possui Comprovante', 'URL Comprovante'
        ];
        const headerRow = worksheet.getRow(startRow);
        headerRow.values = headers;
        styleHeaderRow(headerRow);

        // Data rows
        filteredAbsences.forEach(a => {
            const employee = employees.find(e => e.id === a.employeeId);
            worksheet.addRow([
                new Date(a.date).toLocaleDateString('pt-BR'),
                a.employeeName,
                employee?.code || '-',
                employee?.role.replace('PARCEIRO_', '').replace('_', ' ') || '-',
                employee?.shift || '-',
                employee?.leaderName || '-',
                a.reason,
                a.description || '-',
                a.evidenceUrl ? 'SIM' : 'NÃO',
                a.evidenceUrl || '-'
            ]);
        });

        styleDataRows(worksheet, startRow);
        autoFitColumns(worksheet);

        const fileName = `Relatorio_Ausencias_${monthName}_${reportYear}`;
        await saveWorkbook(workbook, fileName);
        setIsReportModalOpen(false);
    };

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setImporting(true);
        setErrorMessage(null);
        setImportStats(null);

        try {
            const rows = await readXlsxFile(file);
            if (rows.length === 0) throw new Error('Arquivo vazio');

            // Find headers
            const headers = rows[0].map(h => h?.toString().toLowerCase().trim());
            const colMap = {
                name: headers.findIndex(h => h === 'nome' || h === 'funcionario' || h === 'colaborador' || h === 'nome do colaborador'),
                email: headers.findIndex(h => h === 'email' || h === 'e-mail'),
                role: headers.findIndex(h => h === 'cargo' || h === 'funcao'),
                code: headers.findIndex(h => h === 'cadastro' || h === 'matricula' || h === 'id'),
                shift: headers.findIndex(h => h === 'turno'),
                leader: headers.findIndex(h => h === 'lider' || h === 'liderança' || h === 'lideranca'),
                status: headers.findIndex(h => h === 'status')
            };

            const dataRows = rows.slice(1);
            const newEmployees: Omit<Employee, 'id' | 'status' | 'avatar'>[] = [];

            for (const row of dataRows) {
                const name = colMap.name !== -1 ? row[colMap.name]?.toString() : null;
                // Use email column if exists, otherwise generate from Name
                let email = colMap.email !== -1 ? row[colMap.email]?.toString() : null;
                const code = colMap.code !== -1 ? row[colMap.code]?.toString() : null;
                const roleInput = colMap.role !== -1 ? row[colMap.role]?.toString()?.toUpperCase() : '';
                const shift = colMap.shift !== -1 ? row[colMap.shift]?.toString() : undefined;
                const leaderName = colMap.leader !== -1 ? row[colMap.leader]?.toString() : undefined;
                const rawStatus = colMap.status !== -1 ? row[colMap.status]?.toString() : undefined;

                // Generate email if missing: firstname.lastname@eletromidia.com.br
                if (!email && name) {
                    const cleanName = name.trim().toLowerCase().replace(/\s+/g, ' ');
                    const parts = cleanName.split(' ');
                    if (parts.length > 1) {
                        const first = parts[0];
                        const last = parts[parts.length - 1];
                        email = `${first}.${last} @eletromidia.com.br`;
                    } else {
                        email = `${parts[0]} @eletromidia.com.br`;
                    }
                }

                if (!name) continue;

                // Map Role
                let role: UserRole = UserRole.TECNICO;
                if (roleInput?.includes('LIDER') || roleInput?.includes('LÍDER') || roleInput?.includes('SUPERVISOR') || roleInput?.includes('COORDENADOR')) role = UserRole.LIDER;
                if (roleInput?.includes('CHEFE') || roleInput?.includes('GERENTE')) role = UserRole.CHEFE;

                // Adjust for partners
                if (currentUser.companyId !== 'internal') {
                    if (role === UserRole.TECNICO) role = UserRole.PARCEIRO_TECNICO;
                    if (role === UserRole.LIDER) role = UserRole.PARCEIRO_LIDER;
                    if (role === UserRole.CHEFE) role = UserRole.PARCEIRO_CHEFE;
                }

                newEmployees.push({
                    name,
                    email: email!,
                    role,
                    companyId: currentUser.companyId,
                    companyName: currentUser.companyName,
                    shift,
                    code,
                    leaderName,
                    originalStatus: rawStatus
                });
            }

            if (newEmployees.length === 0) {
                setErrorMessage('Nenhum funcionário válido encontrado.');
                setImporting(false);
                return;
            }

            await bulkCreateEmployees(newEmployees);
            setImportStats({ total: newEmployees.length, success: newEmployees.length });
            loadEmployees();
            setTimeout(() => {
                // Keep modal open
            }, 1000);

        } catch (err: any) {
            console.error('Import error:', err);
            setErrorMessage(err.message || 'Erro ao processar arquivo.');
        } finally {
            setImporting(false);
        }
    };

    const requestSort = (key: string) => {
        let direction: 'asc' | 'desc' = 'asc';
        if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
            direction = 'desc';
        }
        setSortConfig({ key, direction });
    };

    const filteredEmployees = employees.filter(employee => {
        const matchesSearch =
            employee.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            employee.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
            (employee.code && employee.code.toLowerCase().includes(searchTerm.toLowerCase()));

        const matchesRole = !filters.role || employee.role === filters.role;
        const matchesStatus = !filters.originalStatus || employee.originalStatus === filters.originalStatus;
        const matchesShift = !filters.shift || employee.shift === filters.shift;
        const matchesLeader = !filters.leaderName || employee.leaderName === filters.leaderName;

        return matchesSearch && matchesRole && matchesStatus && matchesShift && matchesLeader;
    }).sort((a, b) => {
        if (!sortConfig) return 0;

        let aValue: any = (a as any)[sortConfig.key] || '';
        let bValue: any = (b as any)[sortConfig.key] || '';

        // Special case for Name column (it's nested in a UI sense, but data-wise it's flat)
        if (sortConfig.key === 'name') {
            aValue = a.name.toLowerCase();
            bValue = b.name.toLowerCase();
        }

        if (aValue < bValue) {
            return sortConfig.direction === 'asc' ? -1 : 1;
        }
        if (aValue > bValue) {
            return sortConfig.direction === 'asc' ? 1 : -1;
        }
        return 0;
    });

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h2 className="text-2xl font-black text-slate-800 uppercase tracking-tight">Gestão de Funcionários</h2>
                    <p className="text-slate-500 text-sm font-medium">Visualize e gerencie sua equipe</p>
                </div>

                <div className="flex items-center gap-3">
                    <button
                        onClick={() => setIsReportModalOpen(true)}
                        className="flex items-center gap-2 bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 px-4 py-2.5 rounded-xl font-bold uppercase tracking-wider text-xs transition-all shadow-sm"
                    >
                        <FileText size={16} /> Relatórios
                    </button>
                    <button
                        onClick={() => setIsImportModalOpen(true)}
                        className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white px-4 py-2.5 rounded-xl font-bold uppercase tracking-wider text-xs transition-all shadow-md hover:shadow-lg"
                    >
                        <Upload size={16} /> Importar Excel
                    </button>
                </div>
            </div>

            <div className="bg-white rounded-3xl shadow-sm border border-slate-100 overflow-hidden">
                <div className="p-4 border-b border-slate-50 bg-slate-50/50 flex items-center gap-4">
                    <div className="relative flex-1">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                        <input
                            type="text"
                            placeholder="Buscar por nome, email ou cadastro..."
                            className="w-full pl-10 pr-10 py-2 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all font-medium text-slate-600"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                        {searchTerm && (
                            <button
                                onClick={() => setSearchTerm('')}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-300 hover:text-slate-500"
                            >
                                <AlertCircle size={14} className="rotate-45" />
                            </button>
                        )}
                    </div>

                    <button
                        onClick={() => setIsFilterBarOpen(!isFilterBarOpen)}
                        className={`flex items - center gap - 2 px - 4 py - 2 rounded - xl text - xs font - bold uppercase tracking - wider transition - all border ${isFilterBarOpen || Object.values(filters).some(v => v !== '')
                            ? 'bg-primary/10 border-primary/20 text-primary'
                            : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                            } `}
                    >
                        <Filter size={16} className={Object.values(filters).some(v => v !== '') ? 'animate-pulse' : ''} />
                        Filtros {Object.values(filters).filter(v => v !== '').length > 0 && `(${Object.values(filters).filter(v => v !== '').length})`}
                    </button>

                    {selectedIds.length > 0 && (
                        <button
                            onClick={handleBulkDelete}
                            disabled={isDeletingBulk}
                            className="flex items-center gap-2 bg-red-50 text-red-600 hover:bg-red-100 px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wider transition-all border border-red-100"
                        >
                            <Trash2 size={16} /> Excluir ({selectedIds.length})
                        </button>
                    )}

                    <div className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                        Total: {filteredEmployees.length}
                    </div>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead>
                            <tr className="border-b border-slate-100 bg-slate-50/50">
                                <th className="p-4 w-10">
                                    <input
                                        type="checkbox"
                                        className="rounded border-slate-300 text-primary focus:ring-primary"
                                        onChange={handleSelectAll}
                                        checked={selectedIds.length > 0 && selectedIds.length === filteredEmployees.filter(e => e.status === 'PENDING').length}
                                    />
                                </th>
                                {[
                                    { key: 'shift', label: 'Turno' },
                                    { key: 'code', label: 'Cadastro' },
                                    { key: 'leaderName', label: 'Líder' },
                                    { key: 'name', label: 'Nome' },
                                    { key: 'role', label: 'Cargo' },
                                    { key: 'originalStatus', label: 'Original Status' }
                                ].map(col => (
                                    <th
                                        key={col.key}
                                        className="p-4 text-[10px] font-black uppercase tracking-widest text-slate-400 cursor-pointer hover:text-primary transition-colors group"
                                        onClick={() => requestSort(col.key)}
                                    >
                                        <div className="flex items-center gap-1">
                                            {col.label}
                                            <div className={`transition - opacity ${sortConfig?.key === col.key ? 'opacity-100 text-primary' : 'opacity-0 group-hover:opacity-40'} `}>
                                                {sortConfig?.key === col.key && sortConfig.direction === 'desc' ? <ChevronDown size={12} /> : <ChevronUp size={12} />}
                                            </div>
                                        </div>
                                    </th>
                                ))}
                                <th className="p-4 text-[10px] font-black uppercase tracking-widest text-slate-400 text-right">Ações</th>
                            </tr>

                            {isFilterBarOpen && (
                                <tr className="bg-slate-50/30 border-b border-slate-50 animate-in slide-in-from-top-2">
                                    <td className="p-2"></td>
                                    <td className="p-2">
                                        <select
                                            value={filters.shift}
                                            onChange={(e) => setFilters(prev => ({ ...prev, shift: e.target.value }))}
                                            className="w-full p-1 bg-white border border-slate-200 rounded-lg text-[10px] font-bold text-slate-600 focus:ring-1 focus:ring-primary"
                                        >
                                            <option value="">TODOS</option>
                                            {Array.from(new Set(employees.map(e => e.shift).filter(Boolean))).map(s => <option key={s} value={s!}>{s}</option>)}
                                        </select>
                                    </td>
                                    <td className="p-2"></td>
                                    <td className="p-2">
                                        <select
                                            value={filters.leaderName}
                                            onChange={(e) => setFilters(prev => ({ ...prev, leaderName: e.target.value }))}
                                            className="w-full p-1 bg-white border border-slate-200 rounded-lg text-[10px] font-bold text-slate-600 focus:ring-1 focus:ring-primary"
                                        >
                                            <option value="">TODOS</option>
                                            {Array.from(new Set(employees.map(e => e.leaderName).filter(Boolean))).map(l => <option key={l} value={l!}>{l}</option>)}
                                        </select>
                                    </td>
                                    <td className="p-2"></td>
                                    <td className="p-2">
                                        <select
                                            value={filters.role}
                                            onChange={(e) => setFilters(prev => ({ ...prev, role: e.target.value }))}
                                            className="w-full p-1 bg-white border border-slate-200 rounded-lg text-[10px] font-bold text-slate-600 focus:ring-1 focus:ring-primary"
                                        >
                                            <option value="">TODOS</option>
                                            {Array.from(new Set(employees.map(e => e.role))).sort().map(r => (
                                                <option key={r} value={r}>{(r as string).replace('PARCEIRO_', '').replace('_', ' ')}</option>
                                            ))}
                                        </select>
                                    </td>
                                    <td className="p-2">
                                        <select
                                            value={filters.originalStatus}
                                            onChange={(e) => setFilters(prev => ({ ...prev, originalStatus: e.target.value }))}
                                            className="w-full p-1 bg-white border border-slate-200 rounded-lg text-[10px] font-bold text-slate-600 focus:ring-1 focus:ring-primary"
                                        >
                                            <option value="">TODOS</option>
                                            {Array.from(new Set(employees.map(e => e.originalStatus).filter(Boolean))).map(s => <option key={s} value={s!}>{s}</option>)}
                                        </select>
                                    </td>
                                    <td className="p-2 text-right">
                                        <button
                                            onClick={() => {
                                                setFilters({ role: '', originalStatus: '', shift: '', leaderName: '' });
                                                setSortConfig(null);
                                            }}
                                            className="text-[9px] font-black text-slate-400 hover:text-red-500 uppercase tracking-tighter"
                                        >
                                            Reset
                                        </button>
                                    </td>
                                </tr>
                            )}
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                            {loading ? (
                                <tr><td colSpan={8} className="p-8 text-center text-slate-400 text-sm">Carregando...</td></tr>
                            ) : filteredEmployees.length === 0 ? (
                                <tr><td colSpan={8} className="p-8 text-center text-slate-400 text-sm">Nenhum funcionário encontrado</td></tr>
                            ) : (
                                filteredEmployees.map(employee => (
                                    <tr key={employee.id} className={`group hover: bg - slate - 50 transition - colors ${selectedIds.includes(employee.id) ? 'bg-primary/5' : ''} `}>
                                        <td className="p-4">
                                            {employee.status === 'PENDING' ? (
                                                <input
                                                    type="checkbox"
                                                    className="rounded border-slate-300 text-primary focus:ring-primary"
                                                    checked={selectedIds.includes(employee.id)}
                                                    onChange={() => handleSelectEmployee(employee.id)}
                                                />
                                            ) : (
                                                <div className="w-4" />
                                            )}
                                        </td>
                                        <td className="p-4 text-xs font-medium text-slate-500">{employee.shift || '-'}</td>
                                        <td className="p-4 text-xs font-mono text-slate-500">{employee.code || '-'}</td>
                                        <td className="p-4 text-xs font-medium text-slate-500">{employee.leaderName || '-'}</td>
                                        <td className="p-4">
                                            <div className="flex items-center gap-3">
                                                <div className="relative">
                                                    <img src={employee.avatar} alt={employee.name} className="w-8 h-8 rounded-full bg-slate-200 object-cover border border-white shadow-sm" />
                                                    {employee.status === 'ACTIVE' ? (
                                                        <div className="absolute -bottom-1 -right-1 w-3 h-3 bg-green-500 border-2 border-white rounded-full" title="Ativo" />
                                                    ) : (
                                                        <div className="absolute -bottom-1 -right-1 w-3 h-3 bg-amber-500 border-2 border-white rounded-full animate-pulse" title="Convite Pendente" />
                                                    )}
                                                </div>
                                                <div>
                                                    <div className="flex items-center gap-2">
                                                        <span className="font-bold text-slate-700 text-sm block">{employee.name}</span>
                                                        {absences.filter(a => a.employeeId === employee.id && a.date === new Date().toISOString().split('T')[0]).map(a => (
                                                            <div key={a.id} className="flex items-center gap-1">
                                                                <span className="bg-red-100 text-red-700 rounded-full text-[8px] font-black px-1.5 py-0.5 uppercase tracking-tighter">
                                                                    Ausente
                                                                </span>
                                                                {a.evidenceUrl && (
                                                                    <button
                                                                        onClick={() => setSelectedEvidenceUrl(a.evidenceUrl!)}
                                                                        className="p-0.5 text-red-400 hover:text-red-600 transition-colors"
                                                                        title="Ver comprovante"
                                                                    >
                                                                        <Eye size={12} />
                                                                    </button>
                                                                )}
                                                            </div>
                                                        ))}
                                                    </div>
                                                    <span className="text-[10px] text-slate-400 block">{employee.email}</span>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="p-4">
                                            <span className="text-xs font-bold text-slate-500 px-2 py-1 bg-slate-100 rounded-md uppercase tracking-wider">
                                                {employee.role.replace('PARCEIRO_', '').replace('_', ' ')}
                                            </span>
                                        </td>
                                        <td className="p-4 text-xs font-medium text-slate-500">
                                            {employee.originalStatus && (
                                                <span className={`px-2 py-1 rounded-md uppercase text-[10px] font-bold tracking-wider ${employee.originalStatus.includes('afastado') ? 'bg-red-100 text-red-600' : 'bg-slate-100 text-slate-500'}`}>
                                                    {employee.originalStatus}
                                                </span>
                                            )}
                                        </td>
                                        <td className="p-4 text-right">
                                            <div className="flex items-center justify-end gap-2">
                                                <button
                                                    onClick={() => handleOpenAbsenceModal(employee)}
                                                    className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"
                                                    title="Registrar Ausência"
                                                >
                                                    <CalendarOff size={16} />
                                                </button>
                                                {employee.status === 'PENDING' && (
                                                    <button
                                                        onClick={() => handleDeleteInvite(employee.id)}
                                                        className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"
                                                        title="Remover convite"
                                                    >
                                                        <Trash2 size={16} />
                                                    </button>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {isImportModalOpen && (
                <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-300">
                    <div className="bg-white rounded-3xl shadow-2xl p-8 max-w-md w-full relative max-h-[90vh] overflow-y-auto">
                        <button
                            onClick={() => setIsImportModalOpen(false)}
                            className="absolute top-4 right-4 p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-50 rounded-full"
                        >
                            <AlertCircle size={20} />
                        </button>

                        <h3 className="text-xl font-black text-slate-800 mb-2">Importar Funcionários</h3>
                        <p className="text-slate-500 text-sm mb-6">Selecione um arquivo Excel contendo as colunas: <strong>Turno, Cadastro, Lider, Nome, Cargo, Status</strong>.</p>

                        <div className="border-2 border-dashed border-slate-200 rounded-2xl p-8 flex flex-col items-center justify-center gap-4 hover:border-primary/50 hover:bg-primary/5 transition-all text-center group cursor-pointer relative">
                            <input
                                type="file"
                                accept=".xlsx"
                                onChange={handleFileUpload}
                                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                                disabled={importing}
                            />
                            <div className="w-12 h-12 bg-primary-50 text-primary rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform">
                                <Upload size={24} />
                            </div>
                            <div>
                                <p className="font-bold text-slate-700">Clique para selecionar</p>
                                <p className="text-xs text-slate-400">ou arraste o arquivo aqui</p>
                            </div>
                        </div>

                        {importing && (
                            <div className="mt-6 flex flex-col items-center gap-2 text-center animate-in fade-in">
                                <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
                                <p className="text-xs font-bold text-primary uppercase tracking-widest">Processando...</p>
                            </div>
                        )}

                        {errorMessage && (
                            <div className="mt-6 p-4 bg-red-50 text-red-600 rounded-xl text-sm font-medium flex items-center gap-2 animate-in slide-in-from-bottom-2">
                                <AlertCircle size={16} /> {errorMessage}
                            </div>
                        )}

                        {importStats && (
                            <div className="mt-6 p-4 bg-green-50 text-green-700 rounded-xl text-sm font-bold flex items-center gap-2 animate-in slide-in-from-bottom-2">
                                <CheckCircle2 size={20} />
                                <span>Sucesso! {importStats.success} funcionários importados via convite.</span>
                            </div>
                        )}

                        <div className="mt-6 flex justify-end">
                            <button
                                onClick={handleDownloadTemplate}
                                className="text-primary text-xs font-black uppercase tracking-widest hover:underline mr-auto"
                            >
                                Baixar Modelo
                            </button>
                        </div>
                    </div>
                </div>
            )}
            {isAbsenceModalOpen && (
                <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-300">
                    <div className="bg-white rounded-3xl shadow-2xl p-8 max-w-md w-full relative max-h-[90vh] overflow-y-auto">
                        <button
                            onClick={() => setIsAbsenceModalOpen(false)}
                            className="absolute top-4 right-4 p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-50 rounded-full"
                        >
                            <AlertCircle size={20} />
                        </button>

                        <h3 className="text-xl font-black text-slate-800 mb-2">Registrar Ausência</h3>
                        <p className="text-slate-500 text-sm mb-6">Colaborador: <strong>{selectedEmployeeForAbsence?.name}</strong></p>

                        <form onSubmit={handleSubmitAbsence} className="space-y-4">
                            <div>
                                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-2">Motivo</label>
                                <select
                                    required
                                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-slate-700 font-medium focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
                                    value={absenceForm.reason}
                                    onChange={e => setAbsenceForm({ ...absenceForm, reason: e.target.value })}
                                >
                                    <option value="Falta Injustificada">Falta Injustificada</option>
                                    <option value="Falta Justificada">Falta Justificada</option>
                                    <option value="Day Off">Day Off</option>
                                    <option value="Atestado">Atestado</option>
                                    <option value="Banco de Horas">Banco de Horas</option>
                                    <option value="Outros">Outros</option>
                                </select>
                            </div>

                            <div>
                                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-2">Data</label>
                                <input
                                    type="date"
                                    required
                                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-slate-700 font-medium focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
                                    value={absenceForm.date}
                                    onChange={e => setAbsenceForm({ ...absenceForm, date: e.target.value })}
                                />
                            </div>

                            <div>
                                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-2">Comprovante (Imagem/Doc)</label>
                                <div className="relative">
                                    <input
                                        type="file"
                                        accept="image/*,.pdf"
                                        onChange={handleAbsenceFileChange}
                                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                                    />
                                    <div className="w-full bg-slate-50 border border-slate-200 border-dashed rounded-xl p-4 flex items-center justify-center gap-2 text-slate-500 group-hover:bg-slate-100 transition-colors">
                                        <Upload size={16} />
                                        <span className="text-xs font-bold">
                                            {absenceForm.evidenceFile ? absenceForm.evidenceFile.name : 'Anexar conversa ou atestado'}
                                        </span>
                                    </div>
                                </div>
                            </div>

                            <div>
                                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-2">Observação (Opcional)</label>
                                <textarea
                                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-slate-700 font-medium focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none resize-none h-24"
                                    value={absenceForm.description}
                                    onChange={e => setAbsenceForm({ ...absenceForm, description: e.target.value })}
                                    placeholder="Detalhes adicionais..."
                                />
                            </div>

                            <button
                                type="submit"
                                className="w-full bg-red-600 hover:bg-red-700 text-white font-bold py-3 rounded-xl shadow-lg shadow-red-200 transition-all active:scale-95"
                            >
                                Confirmar Ausência
                            </button>
                        </form>
                    </div>
                </div>
            )}
            {selectedEvidenceUrl && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-[60] flex items-center justify-center p-4 animate-in fade-in duration-300">
                    <div className="bg-white rounded-3xl shadow-2xl p-4 max-w-2xl w-full relative">
                        <button
                            onClick={() => setSelectedEvidenceUrl(null)}
                            className="absolute top-2 right-2 p-2 bg-white text-slate-400 hover:text-slate-600 rounded-full shadow-md z-10"
                        >
                            <AlertCircle size={20} />
                        </button>

                        <div className="relative rounded-2xl overflow-hidden bg-slate-100 flex items-center justify-center min-h-[300px]">
                            {selectedEvidenceUrl.toLowerCase().endsWith('.pdf') ? (
                                <iframe src={selectedEvidenceUrl} className="w-full h-[70vh]" />
                            ) : (
                                <img src={selectedEvidenceUrl} alt="Evidência" className="max-w-full max-h-[80vh] object-contain" />
                            )}
                        </div>

                        <div className="mt-4 flex justify-between items-center px-2">
                            <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">Comprovante de Ausência</span>
                            <a
                                href={selectedEvidenceUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center gap-2 bg-primary text-white px-4 py-2 rounded-xl text-xs font-bold hover:bg-primary/90 transition-all"
                            >
                                <Download size={14} /> Abrir Original
                            </a>
                        </div>
                    </div>
                </div>
            )}
            {isReportModalOpen && (
                <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-300">
                    <div className="bg-white rounded-3xl shadow-2xl p-8 max-w-md w-full relative">
                        <button
                            onClick={() => setIsReportModalOpen(false)}
                            className="absolute top-4 right-4 p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-50 rounded-full"
                        >
                            <AlertCircle size={20} />
                        </button>

                        <h3 className="text-xl font-black text-slate-800 mb-2">Exportar Relatórios</h3>
                        <p className="text-slate-500 text-sm mb-6">Selecione o período para gerar o relatório de ausências (RH).</p>

                        <div className="space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-2">Mês</label>
                                    <select
                                        value={reportMonth}
                                        onChange={(e) => setReportMonth(parseInt(e.target.value))}
                                        className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-slate-700 font-medium focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
                                    >
                                        {Array.from({ length: 12 }, (_, i) => (
                                            <option key={i + 1} value={i + 1}>
                                                {new Intl.DateTimeFormat('pt-BR', { month: 'long' }).format(new Date(2000, i))}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                                <div>
                                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-2">Ano</label>
                                    <select
                                        value={reportYear}
                                        onChange={(e) => setReportYear(parseInt(e.target.value))}
                                        className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-slate-700 font-medium focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
                                    >
                                        {[2024, 2025, 2026].map(y => (
                                            <option key={y} value={y}>{y}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>

                            <button
                                onClick={handleExportAbsences}
                                className="w-full bg-primary hover:bg-primary/90 text-white font-bold py-3 rounded-xl shadow-lg transition-all active:scale-95 flex items-center justify-center gap-2"
                            >
                                <Download size={20} /> Gerar Excel de Ausências
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
