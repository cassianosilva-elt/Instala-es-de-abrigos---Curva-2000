import React, { useState, useRef } from 'react';
import * as XLSX from 'xlsx';
import { Upload, X, FileSpreadsheet, CheckCircle2, AlertCircle, Loader2, ClipboardList, Eye, Search } from 'lucide-react';
import SimpleModal from './SimpleModal';
import { bulkCreateTasks, getAssets } from '../api/fieldManagerApi';
import { User, TaskStatus, ServiceType, AssetType } from '../types';

interface TaskImportModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
    users: User[];
    currentUser: User;
}

interface ParsedTask {
    id: string;
    asset_id: string;
    asset_json: any;
    service_type: ServiceType;
    status: TaskStatus;
    technician_id: null;
    leader_id: string;
    company_id: string;
    scheduled_date: string;
    description: string;
    created_at: string;
}

const TaskImportModal: React.FC<TaskImportModalProps> = ({ isOpen, onClose, onSuccess, users, currentUser }) => {
    const [file, setFile] = useState<File | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [successCount, setSuccessCount] = useState<number | null>(null);

    // Configs
    const [batchServiceType, setBatchServiceType] = useState<ServiceType>(ServiceType.PREVENTIVE);
    const [batchDate, setBatchDate] = useState<string>(new Date().toISOString().split('T')[0]);
    const [assetModel, setAssetModel] = useState<'SHELTER' | 'PANEL' | 'TOTEM'>('SHELTER');

    // Preview State
    const [previewData, setPreviewData] = useState<ParsedTask[]>([]);
    const [stats, setStats] = useState<{ total: number; valid: number; skipped: number }>({ total: 0, valid: 0, skipped: 0 });
    const [headersFound, setHeadersFound] = useState<string[]>([]);
    const [isPreviewMode, setIsPreviewMode] = useState(false);

    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const selectedFile = e.target.files?.[0];
        if (selectedFile) {
            setFile(selectedFile);
            setError(null);
            setSuccessCount(null);
            setPreviewData([]);
            setIsPreviewMode(false);
            analyzeFile(selectedFile); // Auto-analyze on select
        }
    };

    const normalizeHeader = (h: string) => String(h).toUpperCase().trim().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

    const analyzeFile = async (fileToAnalyze: File) => {
        setLoading(true);
        setError(null);
        try {
            const data = await fileToAnalyze.arrayBuffer();
            const workbook = XLSX.read(data);
            const sheetName = workbook.SheetNames[0];
            const worksheet = workbook.Sheets[sheetName];

            // Get raw data array of arrays to inspect headers row 0
            const rawData = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as any[][];

            if (rawData.length === 0) throw new Error("O arquivo está vazio.");

            // Find Header Row (scan first 10 just in case)
            let headerRowIndex = -1;
            let headerRow: string[] = [];

            for (let i = 0; i < Math.min(rawData.length, 10); i++) {
                const normalized = rawData[i].map(cell => normalizeHeader(String(cell || '')));
                const hasKeyColumns = normalized.some(h =>
                    h.includes("PARADA") || h.includes("CODIGO") || h.includes("ATIVO") || h.includes("ENDERECO")
                );
                if (hasKeyColumns) {
                    headerRowIndex = i;
                    headerRow = normalized;
                    break;
                }
            }

            if (headerRowIndex === -1) {
                // Fallback to row 0 if nothing found
                headerRowIndex = 0;
                headerRow = rawData[0].map(cell => normalizeHeader(String(cell || '')));
            }

            setHeadersFound(headerRow);

            // Dynamic Column Mapping
            const colMap = {
                code: -1,
                altCode: -1,
                address: -1,
                bairro: -1,
                tipo: -1,
                numero: -1,
                lat: -1,
                lng: -1,
                digital: -1
            };

            // Heuristic search for columns
            headerRow.forEach((h, i) => {
                const hn = h.toUpperCase();
                if (hn.includes("PARADA") || hn.includes("CODIGO") || hn.includes("ATIVO") || hn.includes("ELETR")) colMap.code = i;
                if (hn.includes("ELETRO")) colMap.altCode = i;
                if (hn.includes("ENDERECO") || hn.includes("LOCAL") || hn.includes("NOME") || hn.includes("LOGRADOURO")) colMap.address = i;
                if (hn.includes("BAIRRO") || hn.includes("DISTRITO")) colMap.bairro = i;
                if (hn.includes("NUMERO") || hn === "Nº" || hn === "SN") colMap.numero = i;
                if (hn.includes("TIPO") && !hn.includes("SERVICO")) colMap.tipo = i;
                if (hn.includes("LAT") || h === "M") colMap.lat = i;
                if (hn.includes("LON") || h === "N") colMap.lng = i;
                if (hn.includes("DIGITAL") || h === "O") colMap.digital = i;
            });

            // Special handling for sheets with missing headers but fixed positions (like user screenshot)
            if (colMap.code === 0 && colMap.address === 3) {
                if (colMap.bairro === -1) colMap.bairro = 1;
                if (colMap.tipo === -1) colMap.tipo = 2;
                if (colMap.numero === -1) colMap.numero = 4;
            }

            const existingAssets = await getAssets();
            const parsedTasks: ParsedTask[] = [];
            let skipped = 0;

            // Iterate rows starting after header
            for (let i = headerRowIndex + 1; i < rawData.length; i++) {
                const row = rawData[i];
                if (!row || row.length === 0) continue;

                let assetCode = '';
                let address = '';
                let lat = -23.5505;
                let lng = -46.6333;
                let assetType = AssetType.BUS_SHELTER;

                // 1. Extract Asset Code (Always prioritized)
                if (colMap.code !== -1) assetCode = String(row[colMap.code] || '').trim();
                else if (colMap.altCode !== -1) assetCode = String(row[colMap.altCode] || '').trim();
                else {
                    // Legacy/Positional Fallbacks
                    if (assetModel === 'PANEL') assetCode = String(row[2] || row[1] || '').trim();
                    else assetCode = String(row[1] || row[0] || '').trim();
                }

                // Normalization for SN
                const normalizedCode = assetCode.toUpperCase().replace(/\s/g, '');
                const isSN = !assetCode || normalizedCode === 'SN' || normalizedCode === 'S/N' || normalizedCode === 'SEM';

                // 2. Extract Address components and Concatenate
                const addrPart = colMap.address !== -1 ? String(row[colMap.address] || '').trim() : '';
                const bairroPart = colMap.bairro !== -1 ? String(row[colMap.bairro] || '').trim() : '';
                const tipoPart = colMap.tipo !== -1 ? String(row[colMap.tipo] || '').trim() : '';
                const numeroPart = colMap.numero !== -1 ? String(row[colMap.numero] || '').trim() : '';

                // Build full address: "TIPO NOME, NUMERO - BAIRRO"
                const fullAddressParts = [];
                if (tipoPart) fullAddressParts.push(tipoPart);
                if (addrPart) fullAddressParts.push(addrPart);
                let baseAddr = fullAddressParts.join(' ');

                if (numeroPart && numeroPart.toUpperCase() !== 'SN' && numeroPart.toUpperCase() !== 'S/N') {
                    baseAddr += `, ${numeroPart}`;
                } else if (numeroPart) {
                    baseAddr += ` - ${numeroPart}`;
                }

                if (bairroPart) {
                    baseAddr += (baseAddr ? ` - ${bairroPart}` : bairroPart);
                }

                address = baseAddr || addrPart || 'Endereço não informado';

                // Handle SN/Empty Code
                if (isSN) {
                    // Use a deterministic SN ID based on address or row to avoid collision
                    assetCode = `SN-${address.substring(0, 10)}-${i}`;
                }

                // 3. Extract GPS
                if (colMap.lat !== -1 && row[colMap.lat] !== undefined) {
                    const l = parseFloat(String(row[colMap.lat]).replace(',', '.'));
                    if (!isNaN(l) && l !== 0) lat = l;
                }
                if (colMap.lng !== -1 && row[colMap.lng] !== undefined) {
                    const g = parseFloat(String(row[colMap.lng]).replace(',', '.'));
                    if (!isNaN(g) && g !== 0) lng = g;
                }

                // 4. Extract Digital/Static
                let digitalVal = '';
                if (colMap.digital !== -1) digitalVal = String(row[colMap.digital] || '');

                if (assetModel === 'PANEL') {
                    assetType = digitalVal.startsWith('D') ? AssetType.DIGITAL_PANEL : AssetType.STATIC_PANEL;
                } else if (assetModel === 'TOTEM') {
                    assetType = AssetType.TOTEM;
                } else {
                    assetType = AssetType.BUS_SHELTER;
                }

                // Check Asset Existence
                const asset = existingAssets.find(a => a.code === assetCode);

                const newTask = {
                    id: `task_${Date.now()}_${i}`,
                    asset_id: isSN ? 'SN' : assetCode,
                    asset_json: asset ? {
                        id: asset.id,
                        code: asset.code,
                        type: asset.type,
                        location: asset.location,
                        companyId: asset.companyId || currentUser.companyId
                    } : {
                        id: assetCode,
                        code: isSN ? 'SN' : assetCode,
                        type: assetType,
                        location: {
                            lat: lat,
                            lng: lng,
                            address: address || 'Endereço não informado'
                        },
                        companyId: currentUser.companyId
                    },
                    service_type: batchServiceType,
                    status: TaskStatus.PENDING,
                    technician_id: null,
                    leader_id: currentUser.id,
                    company_id: currentUser.companyId,
                    scheduled_date: batchDate,
                    description: `Carga automática (${assetModel}): ${address}`,
                    created_at: new Date().toISOString()
                };
                parsedTasks.push(newTask as ParsedTask);
            }

            setStats({
                total: rawData.length - 1,
                valid: parsedTasks.length,
                skipped: skipped
            });
            setPreviewData(parsedTasks);
            setIsPreviewMode(true);

        } catch (err: any) {
            console.error(err);
            setError(err.message || "Erro ao analisar arquivo.");
        } finally {
            setLoading(false);
        }
    };

    const confirmImport = async () => {
        if (previewData.length === 0) return;
        setLoading(true);
        try {
            await bulkCreateTasks(previewData);
            setSuccessCount(previewData.length);
            setLoading(false);
            setTimeout(() => {
                onSuccess();
                handleClose();
            }, 2000);
        } catch (err: any) {
            setError("Erro ao salvar no banco de dados: " + err.message);
            setLoading(false);
        }
    };

    const handleClose = () => {
        setFile(null);
        setError(null);
        setSuccessCount(null);
        setPreviewData([]);
        setIsPreviewMode(false);
        onClose();
    };

    const resetSelection = () => {
        setFile(null);
        setPreviewData([]);
        setIsPreviewMode(false);
        if (fileInputRef.current) fileInputRef.current.value = '';
    }

    return (
        <SimpleModal isOpen={isOpen} onClose={handleClose} title="Importar Ordens de Serviço">
            <div className="space-y-6 py-4">

                {/* CONFIGS */}
                <div className="bg-primary/5 p-4 rounded-xl border border-primary/10 space-y-4">
                    <p className="text-xs font-bold text-primary flex items-center gap-2">
                        <ClipboardList size={14} />
                        Configurações do Lote:
                    </p>
                    <div className="grid grid-cols-3 gap-4">
                        <div>
                            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Modelo</label>
                            <select
                                value={assetModel}
                                onChange={(e) => {
                                    setAssetModel(e.target.value as any);
                                    if (file) analyzeFile(file); // Re-analyze if model changes
                                }}
                                className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg font-bold text-slate-800 text-xs outline-none focus:ring-2 focus:ring-primary/20"
                            >
                                <option value="SHELTER">Abrigo (Padrão)</option>
                                <option value="PANEL">Painéis (Digital)</option>
                                <option value="TOTEM">Totem</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Serviço</label>
                            <select
                                value={batchServiceType}
                                onChange={(e) => setBatchServiceType(e.target.value as ServiceType)}
                                className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg font-bold text-slate-800 text-xs outline-none focus:ring-2 focus:ring-primary/20"
                            >
                                {Object.values(ServiceType).map(v => <option key={v} value={v}>{v}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Data</label>
                            <input
                                type="date"
                                value={batchDate}
                                onChange={(e) => setBatchDate(e.target.value)}
                                className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg font-bold text-slate-800 text-xs outline-none focus:ring-2 focus:ring-primary/20"
                            />
                        </div>
                    </div>
                </div>

                {/* UPLOAD / PREVIEW */}
                {!isPreviewMode ? (
                    <div
                        onClick={() => fileInputRef.current?.click()}
                        className={`
                            relative group cursor-pointer border-2 border-dashed rounded-2xl p-8 transition-all
                            flex flex-col items-center justify-center gap-4
                            border-slate-200 hover:border-primary/50 hover:bg-slate-50
                        `}
                    >
                        <input
                            type="file"
                            ref={fileInputRef}
                            className="hidden"
                            accept=".xlsx, .xls, .csv"
                            onChange={handleFileChange}
                        />
                        {loading ? (
                            <div className="text-center text-primary">
                                <Loader2 className="w-10 h-10 animate-spin mx-auto mb-2" />
                                <p className="text-sm font-black">Analisando arquivo...</p>
                            </div>
                        ) : (
                            <>
                                <div className="w-12 h-12 bg-slate-100 rounded-2xl flex items-center justify-center text-slate-400 group-hover:bg-primary/10 group-hover:text-primary transition-all">
                                    <Upload size={24} />
                                </div>
                                <div className="text-center">
                                    <p className="text-sm font-black text-slate-700">Selecione o arquivo</p>
                                    <p className="text-[10px] text-slate-400 font-bold uppercase mt-1">XLSX, CSV</p>
                                </div>
                            </>
                        )}
                    </div>
                ) : (
                    <div className="space-y-4">
                        <div className="flex items-center justify-between bg-slate-50 p-3 rounded-xl border border-slate-200">
                            <div className="flex items-center gap-3">
                                <div className="bg-green-100 p-2 rounded-lg text-green-700">
                                    <FileSpreadsheet size={20} />
                                </div>
                                <div>
                                    <p className="text-xs font-black text-slate-700">{file?.name}</p>
                                    <p className="text-[10px] text-slate-500 font-bold">
                                        {stats.total} linhas encontradas • {stats.valid} válidas • <span className="text-red-500">{stats.skipped} ignoradas</span>
                                    </p>
                                </div>
                            </div>
                            <button onClick={resetSelection} className="p-2 hover:bg-white rounded-lg text-slate-400 hover:text-red-500 transition-colors">
                                <X size={20} />
                            </button>
                        </div>

                        {/* PREVIEW TABLE */}
                        <div className="border border-slate-200 rounded-xl overflow-hidden max-h-[200px] overflow-y-auto">
                            <table className="w-full text-left text-[10px]">
                                <thead className="bg-slate-50 font-black text-slate-400 uppercase tracking-wider sticky top-0">
                                    <tr>
                                        <th className="p-3">Nº Eletr</th>
                                        <th className="p-3">Endereço</th>
                                        <th className="p-3">Tipo</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {previewData.slice(0, 5).map((curr, idx) => (
                                        <tr key={idx} className="hover:bg-slate-50">
                                            <td className="p-3 font-bold text-slate-700">{curr.asset_id}</td>
                                            <td className="p-3 text-slate-600 truncate max-w-[150px]">{curr.asset_json.location.address}</td>
                                            <td className="p-3 text-slate-500">{curr.asset_json.type}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                            {previewData.length > 5 && (
                                <div className="p-2 text-center text-[10px] text-slate-400 font-bold bg-slate-50 border-t border-slate-100">
                                    + {previewData.length - 5} outras linhas...
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {error && (
                    <div className="p-4 bg-red-50 border border-red-100 rounded-xl flex items-center gap-3 text-red-600 animate-in slide-in-from-top-2">
                        <AlertCircle size={18} className="shrink-0" />
                        <p className="text-xs font-bold">{error}</p>
                    </div>
                )}

                {successCount !== null && (
                    <div className="p-4 bg-green-50 border border-green-100 rounded-xl flex items-center gap-3 text-green-600 animate-in slide-in-from-top-2">
                        <CheckCircle2 size={18} className="shrink-0" />
                        <p className="text-xs font-bold">Sucesso! {successCount} Ordens de Serviço criadas.</p>
                    </div>
                )}

                <div className="flex gap-3">
                    <button
                        onClick={handleClose}
                        className="flex-1 py-4 bg-slate-100 text-slate-600 font-black rounded-xl hover:bg-slate-200 transition-all text-xs uppercase tracking-widest"
                    >
                        Cancelar
                    </button>
                    {isPreviewMode && successCount === null && (
                        <button
                            disabled={loading || previewData.length === 0}
                            onClick={confirmImport}
                            className="flex-[2] py-4 bg-primary text-white font-black rounded-xl hover:bg-primary-600 transition-all text-xs uppercase tracking-widest flex items-center justify-center gap-2 shadow-lg shadow-primary/20"
                        >
                            {loading ? <Loader2 className="animate-spin" /> : <CheckCircle2 size={18} />}
                            Confirmar Importação ({stats.valid})
                        </button>
                    )}
                </div>
            </div>
        </SimpleModal>
    );
};

export default TaskImportModal;
