
import React, { useState, useEffect, useMemo } from 'react';
import { AssetMeasurement, User } from '../types';
import { getAllAssetMeasurements } from '../api/fieldManagerApi';
import { Download, Building2, Filter, Calendar, TrendingUp, DollarSign, Search } from 'lucide-react';
import { createEletromidiaWorkbook, styleHeaderRow, styleDataRows, autoFitColumns, saveWorkbook } from '../utils/excelExport';

const PARTNER_COMPANIES = [
    { id: 'gf1', name: 'GF1', color: '#16A34A', logoUrl: '/assets/logo_gf1.png' },
    { id: 'alvares', name: 'Alvares', color: '#002c4d', logoUrl: '/assets/logo_alvares.png' },
    { id: 'bassi', name: 'Bassi', color: '#DC2626', logoUrl: '/assets/logo_bassi.png' },
    { id: 'afn_nogueira', name: 'AFN Nogueira', color: '#7C3AED', logoUrl: '/assets/logo_afn_nogueira.png' }
];

export const MeasurementAdminView: React.FC<{ currentUser: User }> = ({ currentUser }) => {
    const [measurements, setMeasurements] = useState<AssetMeasurement[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedCompany, setSelectedCompany] = useState<string>('all');
    const [dateFilter, setDateFilter] = useState('');

    useEffect(() => {
        loadData();
    }, [selectedCompany]); // Reload when company filter changes

    const loadData = async () => {
        setLoading(true);
        const data = await getAllAssetMeasurements(selectedCompany);
        setMeasurements(data);
        setLoading(false);
    };

    const filteredMeasurements = useMemo(() => {
        if (!dateFilter) return measurements;
        return measurements.filter(m =>
            m.createdAt && m.createdAt.startsWith(dateFilter)
        );
    }, [measurements, dateFilter]);

    const metrics = useMemo(() => {
        const totalValue = filteredMeasurements.reduce((acc, m) => acc + m.totalValue, 0);
        const count = filteredMeasurements.length;

        // Group by company
        const byCompany = filteredMeasurements.reduce((acc, m) => {
            acc[m.companyId] = (acc[m.companyId] || 0) + m.totalValue;
            return acc;
        }, {} as Record<string, number>);

        return { totalValue, count, byCompany };
    }, [filteredMeasurements]);

    const handleExport = async () => {
        const partner = PARTNER_COMPANIES.find(c => c.id === selectedCompany);
        const logoUrl = partner?.logoUrl || null;

        const title = selectedCompany === 'all'
            ? 'Medições Consolidadas - Todas as Empresas'
            : `Medições Consolidadas - ${partner?.name || selectedCompany}`;

        const { workbook, worksheet, startRow } = await createEletromidiaWorkbook(
            title,
            'Medições',
            logoUrl
        );

        // Header
        const headers = ['Data', 'Empresa', 'Ativo / Local', 'Serviço', 'Etapas', 'Valor Total'];
        const headerRow = worksheet.getRow(startRow);
        headerRow.values = headers;
        styleHeaderRow(headerRow);

        // Data
        filteredMeasurements.forEach(m => {
            const companyName = PARTNER_COMPANIES.find(c => c.id === m.companyId)?.name || m.companyId;
            const row = worksheet.addRow([
                m.createdAt ? new Date(m.createdAt).toLocaleDateString('pt-BR') : '-',
                companyName,
                `${m.assetCode || m.assetId} - ${m.assetType}`,
                m.assetType,
                m.stages.join(', '),
                m.totalValue
            ]);

            // Format Currency Column
            row.getCell(6).numFmt = '"R$ "#,##0.00';
        });

        // Add Total Row
        const totalRow = worksheet.addRow(['', '', '', '', 'TOTAL GERAL', metrics.totalValue]);
        totalRow.font = { bold: true };
        totalRow.getCell(6).numFmt = '"R$ "#,##0.00';
        totalRow.getCell(5).alignment = { horizontal: 'right' };

        styleDataRows(worksheet, startRow);
        autoFitColumns(worksheet);

        const fileName = `Relatorio_Medicoes_${selectedCompany}_${new Date().toISOString().split('T')[0]}`;
        await saveWorkbook(workbook, fileName);
    };

    return (
        <div className="space-y-6 pb-20">
            {/* Header */}
            <div className="bg-white p-6 rounded-[32px] border border-slate-100 shadow-sm flex flex-col md:flex-row items-center justify-between gap-6">
                <div>
                    <h2 className="text-2xl font-black text-slate-900 uppercase tracking-tight">Medições Consolidadas</h2>
                    <p className="text-sm text-slate-400 font-medium">Gestão financeira de serviços terceiros</p>
                </div>

                <div className="flex flex-wrap gap-3">
                    <div className="relative">
                        <Filter className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                        <select
                            value={selectedCompany}
                            onChange={(e) => setSelectedCompany(e.target.value)}
                            className="pl-12 pr-10 py-3 bg-slate-50 border-none rounded-2xl text-sm font-bold text-slate-700 appearance-none cursor-pointer hover:bg-slate-100 transition-colors"
                        >
                            <option value="all">Todas as Empresas</option>
                            {PARTNER_COMPANIES.map(c => (
                                <option key={c.id} value={c.id}>{c.name}</option>
                            ))}
                        </select>
                    </div>

                    <div className="relative">
                        <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                        <input
                            type="date"
                            value={dateFilter}
                            onChange={(e) => setDateFilter(e.target.value)}
                            className="pl-12 pr-4 py-3 bg-slate-50 border-none rounded-2xl text-sm font-bold text-slate-700 hover:bg-slate-100 transition-colors"
                        />
                    </div>

                    <button
                        onClick={handleExport}
                        className="flex items-center gap-2 px-6 py-3 bg-primary text-white rounded-2xl font-black uppercase text-xs tracking-widest hover:bg-primary-600 transition-all shadow-lg shadow-primary/20"
                    >
                        <Download size={18} />
                        Exportar
                    </button>
                </div>
            </div>

            {/* KPI Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Total Geral</p>
                    <div className="flex items-center gap-3 mb-2">
                        <div className="p-2 bg-green-50 text-green-600 rounded-xl">
                            <DollarSign size={20} />
                        </div>
                        <span className="text-2xl font-black text-slate-900">
                            {metrics.totalValue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                        </span>
                    </div>
                    <p className="text-xs text-slate-400 font-bold">{metrics.count} medições registradas</p>
                </div>

                {PARTNER_COMPANIES.filter(c => selectedCompany === 'all' || selectedCompany === c.id).map(company => (
                    <div key={company.id} className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm relative overflow-hidden">
                        <div className="absolute top-0 right-0 w-16 h-16 opacity-5 -translate-y-1/2 translate-x-1/2 rounded-full" style={{ backgroundColor: company.color }} />
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">{company.name}</p>
                        <span className="text-xl font-black text-slate-900 block mb-1">
                            {(metrics.byCompany[company.id] || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                        </span>
                        <div className="h-1 bg-slate-100 rounded-full overflow-hidden w-full mt-2">
                            <div
                                className="h-full rounded-full transition-all duration-1000"
                                style={{
                                    width: `${metrics.totalValue ? ((metrics.byCompany[company.id] || 0) / metrics.totalValue) * 100 : 0}%`,
                                    backgroundColor: company.color
                                }}
                            />
                        </div>
                    </div>
                ))}
            </div>

            {/* Data Table */}
            <div className="bg-white rounded-[32px] border border-slate-100 shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="border-b border-slate-100">
                                <th className="p-6 text-[10px] font-black text-slate-400 uppercase tracking-widest">Data</th>
                                <th className="p-6 text-[10px] font-black text-slate-400 uppercase tracking-widest">Empresa</th>
                                <th className="p-6 text-[10px] font-black text-slate-400 uppercase tracking-widest">Ativo / Local</th>
                                <th className="p-6 text-[10px] font-black text-slate-400 uppercase tracking-widest">Serviço</th>
                                <th className="p-6 text-[10px] font-black text-slate-400 uppercase tracking-widest">Etapas</th>
                                <th className="p-6 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Valor</th>
                            </tr>
                        </thead>
                        <tbody>
                            {loading ? (
                                <tr>
                                    <td colSpan={6} className="p-12 text-center text-slate-400 font-bold">Carregando dados...</td>
                                </tr>
                            ) : filteredMeasurements.length === 0 ? (
                                <tr>
                                    <td colSpan={6} className="p-12 text-center text-slate-400 font-bold">Nenhuma medição encontrada neste filtro.</td>
                                </tr>
                            ) : (
                                filteredMeasurements.map((m) => (
                                    <tr key={m.id} className="border-b border-slate-50 hover:bg-slate-50/50 transition-colors">
                                        <td className="p-6 text-sm font-bold text-slate-600">
                                            {m.createdAt ? new Date(m.createdAt).toLocaleDateString() : '-'}
                                        </td>
                                        <td className="p-6">
                                            <span
                                                className="px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest"
                                                style={{
                                                    backgroundColor: `${PARTNER_COMPANIES.find(c => c.id === m.companyId)?.color}15`,
                                                    color: PARTNER_COMPANIES.find(c => c.id === m.companyId)?.color
                                                }}
                                            >
                                                {PARTNER_COMPANIES.find(c => c.id === m.companyId)?.name || m.companyId}
                                            </span>
                                        </td>
                                        <td className="p-6">
                                            <div className="flex flex-col">
                                                <span className="text-sm font-black text-slate-900">{m.assetCode || m.assetId}</span>
                                                <span className="text-xs font-bold text-slate-400">{m.assetType}</span>
                                            </div>
                                        </td>
                                        <td className="p-6 text-xs font-bold text-slate-600">
                                            {m.assetType}
                                        </td>
                                        <td className="p-6">
                                            <div className="flex flex-wrap gap-1">
                                                {m.stages.map(s => (
                                                    <span key={s} className="px-2 py-1 bg-slate-100 text-slate-500 rounded-md text-[10px] font-bold uppercase">
                                                        {s}
                                                    </span>
                                                ))}
                                            </div>
                                        </td>
                                        <td className="p-6 text-right">
                                            <span className="text-sm font-black text-primary">
                                                {m.totalValue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                                            </span>
                                            {m.itemsSnapshot && m.itemsSnapshot.length > 0 && (
                                                <p className="text-[10px] text-slate-400 font-bold mt-1">Snapshot OK</p>
                                            )}
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};
