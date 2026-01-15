import React, { useState, useRef } from 'react';
import * as XLSX from 'xlsx';
import { Upload, X, FileSpreadsheet, CheckCircle2, AlertCircle, Loader2, Building2 } from 'lucide-react';
import SimpleModal from './SimpleModal';
import { bulkCreateAssets } from '../api/fieldManagerApi';

interface AssetImportModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
    companies: { id: string, name: string }[];
}

const AssetImportModal: React.FC<AssetImportModalProps> = ({ isOpen, onClose, onSuccess, companies }) => {
    const [file, setFile] = useState<File | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [successCount, setSuccessCount] = useState<number | null>(null);
    const [selectedCompanyId, setSelectedCompanyId] = useState<string>('');
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const selectedFile = e.target.files?.[0];
        if (selectedFile) {
            setFile(selectedFile);
            setError(null);
            setSuccessCount(null);
        }
    };

    const processFile = async () => {
        if (!file || !selectedCompanyId) {
            setError('Selecione um arquivo e uma empresa de destino.');
            return;
        }

        setLoading(true);
        setError(null);

        try {
            const data = await file.arrayBuffer();
            const workbook = XLSX.read(data);
            const worksheet = workbook.Sheets[workbook.SheetNames[0]];
            const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 'A' }) as any[];

            // Skip header (row 1 is generally jsonData[0] if it has headers, 
            // but sheet_to_json with header: 'A' maps columns to A, B, C...)
            // Based on user screenshot, headers are in row 1. Data starts in row 2.

            const rawAssets = jsonData.slice(1).map((row: any, index: number) => {
                // Mapping based on screenshot:
                // B: Nº ELETRO
                // C: Nº PARADA
                // D: DISTRITO
                // E: TIPO (Logradouro)
                // F: ENDEREÇO
                // G: NR (Número)
                // K: MODELO
                // L: LATITUDE
                // M: LONGITUDE

                const code = row['C'] || row['B'] || `REF-${Date.now()}-${index}`;
                const address = `${row['E'] || ''} ${row['F'] || ''}, ${row['G'] || 'S/N'}`.trim();
                const type = row['K'] || row['I'] || 'Abrigo de Ônibus';
                const city = 'São Paulo'; // Defaulting to SP based on districts in image

                // Parse lat/lng
                let lat = parseFloat(String(row['L']).replace(',', '.'));
                let lng = parseFloat(String(row['M']).replace(',', '.'));

                // Basic validation
                if (isNaN(lat) || isNaN(lng)) {
                    // Fallback to center of SP if invalid
                    lat = -23.5505;
                    lng = -46.6333;
                }

                return {
                    id: `asset_${selectedCompanyId}_${code}`.toLowerCase().replace(/\s+/g, '_'),
                    code: String(code),
                    type,
                    address,
                    lat,
                    lng,
                    city,
                    company_id: selectedCompanyId
                };
            });

            // Filter out duplicate codes to avoid the "ON CONFLICT DO UPDATE command cannot affect row a second time" error
            const assetsToUpload = rawAssets.filter((asset, index, self) =>
                index === self.findIndex((t) => t.code === asset.code)
            );

            if (assetsToUpload.length === 0) {
                throw new Error('Nenhum dado válido encontrado na planilha.');
            }

            await bulkCreateAssets(assetsToUpload);
            setSuccessCount(assetsToUpload.length);
            setLoading(false);
            setTimeout(() => {
                onSuccess();
                handleClose();
            }, 2000);

        } catch (err: any) {
            console.error('Erro ao importar ativos:', err);
            setError(err.message || 'Erro ao processar o arquivo. Verifique o formato.');
            setLoading(false);
        }
    };

    const handleClose = () => {
        setFile(null);
        setError(null);
        setSuccessCount(null);
        setSelectedCompanyId('');
        onClose();
    };

    return (
        <SimpleModal isOpen={isOpen} onClose={handleClose} title="Importar Abrigos (Excel/CSV)">
            <div className="space-y-6 py-4">
                {/* Company Selection */}
                <div>
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 flex items-center gap-2">
                        <Building2 size={12} />
                        Empresa de Destino
                    </label>
                    <select
                        value={selectedCompanyId}
                        onChange={(e) => setSelectedCompanyId(e.target.value)}
                        className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-800 text-sm focus:ring-2 focus:ring-primary/20 outline-none transition-all"
                    >
                        <option value="">Selecione a empresa...</option>
                        {companies.map(c => (
                            <option key={c.id} value={c.id}>{c.name}</option>
                        ))}
                    </select>
                </div>

                {/* File Upload Area */}
                <div
                    onClick={() => fileInputRef.current?.click()}
                    className={`
                        relative group cursor-pointer border-2 border-dashed rounded-2xl p-8 transition-all
                        flex flex-col items-center justify-center gap-4
                        ${file ? 'border-primary bg-primary/5' : 'border-slate-200 hover:border-primary/50 hover:bg-slate-50'}
                    `}
                >
                    <input
                        type="file"
                        ref={fileInputRef}
                        className="hidden"
                        accept=".xlsx, .xls, .csv"
                        onChange={handleFileChange}
                    />

                    {file ? (
                        <div className="text-center">
                            <FileSpreadsheet className="w-12 h-12 text-primary mx-auto mb-2" />
                            <p className="text-sm font-black text-slate-700">{file.name}</p>
                            <p className="text-[10px] text-slate-400 font-bold uppercase mt-1">
                                {(file.size / 1024).toFixed(1)} KB
                            </p>
                        </div>
                    ) : (
                        <>
                            <div className="w-12 h-12 bg-slate-100 rounded-2xl flex items-center justify-center text-slate-400 group-hover:bg-primary/10 group-hover:text-primary transition-all">
                                <Upload size={24} />
                            </div>
                            <div className="text-center">
                                <p className="text-sm font-black text-slate-700">Clique para selecionar ou arraste o arquivo</p>
                                <p className="text-[10px] text-slate-400 font-bold uppercase mt-1">Suporta XLSX, XLS e CSV</p>
                            </div>
                        </>
                    )}
                </div>

                {/* Status Messages */}
                {error && (
                    <div className="p-4 bg-red-50 border border-red-100 rounded-xl flex items-center gap-3 text-red-600">
                        <AlertCircle size={18} className="shrink-0" />
                        <p className="text-xs font-bold">{error}</p>
                    </div>
                )}

                {successCount !== null && (
                    <div className="p-4 bg-green-50 border border-green-100 rounded-xl flex items-center gap-3 text-green-600">
                        <CheckCircle2 size={18} className="shrink-0" />
                        <p className="text-xs font-bold">Sucesso! {successCount} ativos importados.</p>
                    </div>
                )}

                {/* Action Buttons */}
                <div className="flex gap-3">
                    <button
                        onClick={handleClose}
                        className="flex-1 py-4 bg-slate-100 text-slate-600 font-black rounded-xl hover:bg-slate-200 transition-all text-xs uppercase tracking-widest"
                    >
                        Cancelar
                    </button>
                    <button
                        disabled={!file || !selectedCompanyId || loading || successCount !== null}
                        onClick={processFile}
                        className={`
                            flex-[2] py-4 font-black rounded-xl transition-all text-xs uppercase tracking-widest flex items-center justify-center gap-2 shadow-lg
                            ${(!file || !selectedCompanyId || loading || successCount !== null)
                                ? 'bg-slate-300 text-white cursor-not-allowed shadow-none'
                                : 'bg-primary text-white hover:bg-primary-600 shadow-primary/20'}
                        `}
                    >
                        {loading ? (
                            <>
                                <Loader2 size={18} className="animate-spin" />
                                Processando...
                            </>
                        ) : (
                            <>
                                <CheckCircle2 size={18} />
                                Confirmar Importação
                            </>
                        )}
                    </button>
                </div>

                {/* Info Note */}
                <div className="bg-blue-50/50 p-4 rounded-xl border border-blue-100/50">
                    <p className="text-[10px] text-blue-600 font-bold leading-relaxed">
                        <span className="uppercase block mb-1">Dica de Formato:</span>
                        A planilha deve seguir o modelo padrão com as colunas: Nº PARADA (C), TIPO (E), ENDEREÇO (F), LATITUDE (L) e LONGITUDE (M).
                    </p>
                </div>
            </div>
        </SimpleModal>
    );
};

export default AssetImportModal;
