import React, { useState, useRef } from 'react';
import * as XLSX from 'xlsx';
import { Upload, X, FileSpreadsheet, CheckCircle2, AlertCircle, Loader2, Car } from 'lucide-react';
import SimpleModal from './SimpleModal';
import { createVehicle, bulkUpsertVehicles } from '../api/fieldManagerApi';
import { User, Vehicle } from '../types';

interface VehicleImportModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
    currentUser: User;
}

interface ParsedVehicle {
    tag?: string;
    model: string;
    plate: string;
    currentKm: number;
    lastMaintenanceKm: number;
    status: 'Disponível' | 'Em Uso' | 'Em Manutenção';
    maintenanceNotes?: string;
    companyId: string;
}

const VehicleImportModal: React.FC<VehicleImportModalProps> = ({ isOpen, onClose, onSuccess, currentUser }) => {
    const [file, setFile] = useState<File | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [successCount, setSuccessCount] = useState<number | null>(null);

    // Preview State
    const [previewData, setPreviewData] = useState<ParsedVehicle[]>([]);
    const [stats, setStats] = useState<{ total: number; valid: number; skipped: number }>({ total: 0, valid: 0, skipped: 0 });
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
            analyzeFile(selectedFile);
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

            // Get raw data array of arrays
            const rawData = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as any[][];
            console.log("File analysis started. Total rows:", rawData.length);

            if (rawData.length === 0) throw new Error("O arquivo está vazio.");

            // Find Header Row
            let headerRowIndex = -1;
            let colIndexPlate = -1;
            let colIndexTag = -1;
            let colIndexOperator = -1;

            // Search for "PLACA" in the first 10 rows
            for (let i = 0; i < Math.min(rawData.length, 10); i++) {
                const row = rawData[i];
                if (!row) continue;

                row.forEach((cell, idx) => {
                    const val = normalizeHeader(cell);
                    if (val.includes("PLACA")) colIndexPlate = idx;
                    if (val === "TAG") colIndexTag = idx;
                    if (val.includes("OPERADOR")) colIndexOperator = idx;
                });

                if (colIndexPlate !== -1) {
                    headerRowIndex = i;
                    break;
                }
            }

            if (headerRowIndex === -1 || colIndexPlate === -1) {
                throw new Error("Não foi possível encontrar a coluna 'PLACA' ou 'PLACA: MATRIZ' no arquivo.");
            }

            const parsedVehicles: ParsedVehicle[] = [];
            let skipped = 0;

            // Use a chunked processing approach to keep the UI responsive
            const CHUNK_SIZE = 200; // Increased chunk size for efficiency
            for (let i = headerRowIndex + 1; i < rawData.length; i += CHUNK_SIZE) {
                const endIndex = Math.min(i + CHUNK_SIZE, rawData.length);

                for (let j = i; j < endIndex; j++) {
                    const row = rawData[j];
                    if (!row || row.length === 0) continue;

                    const rawValue = String(row[colIndexPlate] || '').trim();
                    const tagValue = colIndexTag !== -1 ? String(row[colIndexTag] || '').trim() : '';
                    const operatorValue = colIndexOperator !== -1 ? String(row[colIndexOperator] || '').trim() : '';

                    if (!rawValue || rawValue.toUpperCase() === "LÍDERES") {
                        continue;
                    }

                    const plateRegex = /([A-Za-z]{3})[-]?([0-9][0-9A-Za-z][0-9]{2})/;
                    const match = rawValue.match(plateRegex);

                    if (match) {
                        const p1 = match[1].toUpperCase();
                        const p2 = match[2].toUpperCase();
                        const fullPlate = `${p1}-${p2}`;
                        let rawModel = rawValue.replace(match[0], '').replace(fullPlate, '').trim();
                        rawModel = rawModel.replace(/^-+|-+$/g, '').trim();
                        const model = rawModel.length > 2 ? rawModel.toUpperCase() : 'VEÍCULO';

                        const notesParts = [];
                        if (operatorValue) notesParts.push(`Op: ${operatorValue}`);

                        parsedVehicles.push({
                            tag: tagValue,
                            plate: fullPlate,
                            model: model,
                            currentKm: 0,
                            lastMaintenanceKm: 0,
                            status: 'Disponível',
                            companyId: currentUser.companyId,
                            maintenanceNotes: notesParts.length > 0 ? notesParts.join(' | ') : undefined
                        });
                    } else if (rawValue) {
                        skipped++;
                    }
                }

                // Allow UI to breathe
                if (endIndex < rawData.length) {
                    console.log(`Processed up to row ${endIndex}...`);
                    await new Promise(resolve => setTimeout(resolve, 0));
                }
            }
            console.log("Analysis finished. Valid vehicles:", parsedVehicles.length);

            setStats({
                total: rawData.length - (headerRowIndex + 1),
                valid: parsedVehicles.length,
                skipped: skipped
            });
            setPreviewData(parsedVehicles);
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
            // Deduplicate by plate locally before sending to backend to avoid "ON CONFLICT DO UPDATE command cannot affect row a second time" error
            const uniqueVehicles = Array.from(
                previewData.reduce((map, vehicle) => {
                    map.set(vehicle.plate.toUpperCase(), vehicle);
                    return map;
                }, new Map<string, ParsedVehicle>()).values()
            );

            console.log(`Starting bulk upsert of ${uniqueVehicles.length} unique vehicles (original: ${previewData.length})`);
            await bulkUpsertVehicles(uniqueVehicles);

            setSuccessCount(previewData.length);
            setLoading(false);
            setTimeout(() => {
                onSuccess();
                handleClose();
            }, 2000);
        } catch (err: any) {
            console.error("Import error details:", err);
            setError("Erro ao salvar no banco de dados (Upsert): " + (err.message || 'Erro desconhecido'));
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
        <SimpleModal isOpen={isOpen} onClose={handleClose} title="Importar Veículos">
            <div className="space-y-6 py-4">
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
                                    <p className="text-sm font-black text-slate-700">Selecione o arquivo de frota</p>
                                    <p className="text-[10px] text-slate-400 font-bold uppercase mt-1">XLSX com dados de Placa e Modelo</p>
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
                                        {stats.valid} veículos identificados
                                    </p>
                                </div>
                            </div>
                            <button onClick={resetSelection} className="p-2 hover:bg-white rounded-lg text-slate-400 hover:text-red-500 transition-colors">
                                <X size={20} />
                            </button>
                        </div>

                        {/* PREVIEW TABLE */}
                        <div className="border border-slate-200 rounded-xl overflow-hidden max-h-[250px] overflow-y-auto">
                            <table className="w-full text-left text-[10px]">
                                <thead className="bg-slate-50 font-black text-slate-400 uppercase tracking-wider sticky top-0">
                                    <tr>
                                        <th className="p-3">Tag</th>
                                        <th className="p-3">Modelo</th>
                                        <th className="p-3">Placa</th>
                                        <th className="p-3">Obs</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {previewData.map((curr, idx) => (
                                        <tr key={idx} className="hover:bg-slate-50">
                                            <td className="p-3 font-bold text-slate-900">{curr.tag || '-'}</td>
                                            <td className="p-3 font-bold text-slate-700 uppercase">{curr.model}</td>
                                            <td className="p-3 font-mono text-slate-600">{curr.plate}</td>
                                            <td className="p-3 text-slate-500">{curr.maintenanceNotes || '-'}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
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
                        <p className="text-xs font-bold">Sucesso! {successCount} veículos importados.</p>
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
                            {loading ? <Loader2 className="animate-spin" /> : <Car size={18} />}
                            Confirmar Importação
                        </button>
                    )}
                </div>
            </div>
        </SimpleModal>
    );
};

export default VehicleImportModal;
