import React, { useState, useEffect } from 'react';
import { Task, TaskEvidence, EvidenceStage, User } from '../types';
import { getEvidenceByTaskId } from '../api/fieldManagerApi';
import SimpleModal from './SimpleModal';
import { Camera, MapPin, Clock, ChevronRight, User as UserIcon, CheckCircle, XCircle } from 'lucide-react';

interface Props {
    isOpen: boolean;
    onClose: () => void;
    tasks: Task[];
    users: User[];
}

const EvidenceAuditModal: React.FC<Props> = ({ isOpen, onClose, tasks, users }) => {
    const [selectedTask, setSelectedTask] = useState<Task | null>(null);
    const [evidences, setEvidences] = useState<TaskEvidence[]>([]);
    const [isLoading, setIsLoading] = useState(false);

    // Filter only completed tasks or tasks with status that might have evidence
    const tasksWithEvidence = tasks.filter(t => t.status !== 'PENDENTE');

    useEffect(() => {
        if (selectedTask) {
            setIsLoading(true);
            getEvidenceByTaskId(selectedTask.id).then(data => {
                setEvidences(data);
                setIsLoading(false);
            });
        } else {
            setEvidences([]);
        }
    }, [selectedTask]);

    const getTechnicianName = (id: string) => {
        return users.find(u => u.id === id)?.name || 'Técnico Desconhecido';
    };

    const renderEvidenceByStage = (stage: EvidenceStage) => {
        const stageEvidences = evidences.filter(e => e.stage === stage);
        const stageLabels = {
            [EvidenceStage.BEFORE]: 'Antes',
            [EvidenceStage.DURING]: 'Durante',
            [EvidenceStage.AFTER]: 'Depois'
        };

        return (
            <div className="space-y-4">
                <h5 className="text-[10px] font-black uppercase tracking-widest text-slate-400 flex items-center gap-2">
                    <Camera size={14} className="text-primary" /> {stageLabels[stage]}
                </h5>
                {stageEvidences.length === 0 ? (
                    <div className="bg-slate-50 border border-dashed border-slate-200 rounded-2xl p-6 text-center">
                        <p className="text-xs font-bold text-slate-400">Nenhum registro</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {stageEvidences.map(ev => (
                            <div key={ev.id} className="group relative bg-white border border-slate-100 rounded-2xl overflow-hidden shadow-sm hover:shadow-md transition-all">
                                <img src={ev.photoUrl} alt={stage} className="w-full h-48 object-cover" />
                                <div className="p-3 bg-white">
                                    <div className="flex items-center justify-between text-[10px] font-bold text-slate-500">
                                        <span className="flex items-center gap-1"><Clock size={10} /> {new Date(ev.capturedAt).toLocaleTimeString('pt-BR')}</span>
                                        {ev.gpsLat && (
                                            <span className="flex items-center gap-1 text-primary"><MapPin size={10} /> Localizado</span>
                                        )}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        );
    };

    return (
        <SimpleModal
            isOpen={isOpen}
            onClose={() => {
                if (selectedTask) setSelectedTask(null);
                else onClose();
            }}
            title={selectedTask ? `Auditoria: OS #${selectedTask.assetId}` : "Auditoria de Evidências"}
        >
            {!selectedTask ? (
                <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-2 scrollbar-thin">
                    <p className="text-xs font-bold text-slate-500 bg-slate-50 p-4 rounded-xl border border-slate-100 mb-6">
                        Selecione uma Ordem de Serviço para revisar as fotos e dados de GPS capturados em campo.
                    </p>

                    {tasksWithEvidence.length === 0 ? (
                        <div className="py-12 text-center">
                            <Camera size={48} className="mx-auto text-slate-200 mb-4" />
                            <p className="font-bold text-slate-400">Nenhuma evidência disponível para auditoria.</p>
                        </div>
                    ) : (
                        tasksWithEvidence.map(task => (
                            <div
                                key={task.id}
                                onClick={() => setSelectedTask(task)}
                                className="flex items-center gap-4 p-4 bg-white border border-slate-100 rounded-2xl hover:border-primary/30 hover:shadow-md transition-all cursor-pointer group"
                            >
                                <div className={`p-3 rounded-xl shrink-0 ${task.status === 'CONCLUÍDO' ? 'bg-green-50 text-green-600' : 'bg-orange-50 text-orange-600'
                                    }`}>
                                    <Camera size={20} />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 mb-0.5">
                                        <span className="text-[10px] font-black uppercase tracking-widest text-primary">{task.assetId}</span>
                                        <span className="text-[10px] font-bold text-slate-400">•</span>
                                        <span className="text-[10px] font-black uppercase tracking-widest text-slate-500 truncate">{task.serviceType}</span>
                                    </div>
                                    <h4 className="font-black text-slate-800 truncate">{task.asset?.location?.address || 'Sem endereço'}</h4>
                                    <div className="flex items-center gap-3 mt-1">
                                        <span className="text-[10px] font-bold text-slate-400 flex items-center gap-1">
                                            <UserIcon size={10} /> {getTechnicianName(task.technicianId)}
                                        </span>
                                        <span className="text-[10px] font-bold text-slate-400 flex items-center gap-1">
                                            <Clock size={10} /> {task.scheduledDate}
                                        </span>
                                    </div>
                                </div>
                                <ChevronRight size={18} className="text-slate-300 group-hover:text-primary group-hover:translate-x-1 transition-all" />
                            </div>
                        ))
                    )}
                </div>
            ) : (
                <div className="space-y-8">
                    <div className="flex items-center gap-4 pb-6 border-b border-slate-100">
                        <button
                            onClick={() => setSelectedTask(null)}
                            className="p-2 hover:bg-slate-100 rounded-full transition-colors"
                        >
                            <ChevronRight size={20} className="rotate-180 text-slate-500" />
                        </button>
                        <div>
                            <h3 className="font-black text-slate-800 text-lg">{selectedTask.serviceType}</h3>
                            <p className="text-xs font-bold text-slate-500">{selectedTask.asset?.location?.address}</p>
                        </div>
                    </div>

                    {isLoading ? (
                        <div className="py-20 text-center">
                            <div className="w-8 h-8 border-4 border-primary border-t-transparent animate-spin rounded-full mx-auto mb-4" />
                            <p className="text-sm font-bold text-slate-500 uppercase tracking-widest">Carregando evidências...</p>
                        </div>
                    ) : (
                        <div className="space-y-10">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                <div className="space-y-4">
                                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Informações da OS</p>
                                    <div className="bg-slate-50 rounded-2xl p-4 border border-slate-100 space-y-3">
                                        <div>
                                            <p className="text-[9px] font-black text-slate-400 uppercase">Técnico Responsável</p>
                                            <p className="text-xs font-bold text-slate-700">{getTechnicianName(selectedTask.technicianId)}</p>
                                        </div>
                                        <div>
                                            <p className="text-[9px] font-black text-slate-400 uppercase">Período de Realização</p>
                                            <p className="text-xs font-bold text-slate-700">
                                                {selectedTask.startedAt ? new Date(selectedTask.startedAt).toLocaleString('pt-BR') : '---'} até {selectedTask.completedAt ? new Date(selectedTask.completedAt).toLocaleString('pt-BR') : '---'}
                                            </p>
                                        </div>
                                        {selectedTask.blockingReason && (
                                            <div>
                                                <p className="text-[9px] font-black text-red-400 uppercase">Motivo do Bloqueio</p>
                                                <p className="text-xs font-bold text-red-600">{selectedTask.blockingReason}</p>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                <div className="space-y-4">
                                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Ações de Auditoria</p>
                                    <div className="grid grid-cols-2 gap-3">
                                        <button className="flex items-center justify-center gap-2 py-3 bg-emerald-500 text-white rounded-xl font-black text-[10px] uppercase hover:bg-emerald-600 transition-all shadow-lg shadow-emerald-500/20">
                                            <CheckCircle size={14} /> Aprovar OS
                                        </button>
                                        <button className="flex items-center justify-center gap-2 py-3 bg-red-500 text-white rounded-xl font-black text-[10px] uppercase hover:bg-red-600 transition-all shadow-lg shadow-red-500/20">
                                            <XCircle size={14} /> Rejeitar OS
                                        </button>
                                    </div>
                                    <p className="text-[9px] font-bold text-slate-400 italic">* As ações de aprovação/rejeição salvam uma nota no histórico da OS.</p>
                                </div>
                            </div>

                            <div className="space-y-12">
                                {renderEvidenceByStage(EvidenceStage.BEFORE)}
                                {renderEvidenceByStage(EvidenceStage.DURING)}
                                {renderEvidenceByStage(EvidenceStage.AFTER)}
                            </div>
                        </div>
                    )}
                </div>
            )}
        </SimpleModal>
    );
};

export default EvidenceAuditModal;
