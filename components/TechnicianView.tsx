
import React, { useState } from 'react';
import { User, Task, TaskStatus, ServiceType, AssetType, EvidenceStage } from '../types';
import { Camera, MapPin, Clock, AlertTriangle, CheckCircle2, ChevronRight, X, Loader2 } from 'lucide-react';
import { uploadEvidence, completeTask, updateTaskStatus } from '../api/fieldManagerApi';
import { queueOfflineEvidence } from '../utils/offlineSync';

interface Props {
  technician: User;
  tasks: Task[];
  onUpdateTask: (task: Task) => void;
}

const TechnicianView: React.FC<Props> = ({ technician, tasks, onUpdateTask }) => {
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isOfflineMode, setIsOfflineMode] = useState(!navigator.onLine);
  // Removed evidenceDraft as we sync directly with task.evidence now
  const [filterStatus, setFilterStatus] = useState<TaskStatus>(TaskStatus.PENDING);

  React.useEffect(() => {
    const handleOnline = () => setIsOfflineMode(false);
    const handleOffline = () => setIsOfflineMode(true);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const displayedTasks = tasks.filter(t => t.status === filterStatus);

  const [observation, setObservation] = useState('');
  const [showNotPerformedModal, setShowNotPerformedModal] = useState(false);
  const [notPerformedReason, setNotPerformedReason] = useState('');
  const [customNotPerformedReason, setCustomNotPerformedReason] = useState('');

  const handleStartTask = (task: Task) => {
    const encodedAddress = encodeURIComponent(task.asset.location.address);
    window.open(`https://www.google.com/maps/search/?api=1&query=${encodedAddress}`, '_blank');
    onUpdateTask({ ...task, status: TaskStatus.IN_PROGRESS });
  };

  const handleBlockTask = (task: Task) => {
    const reason = prompt("Descreva o motivo do bloqueio:");
    if (reason) {
      onUpdateTask({ ...task, status: TaskStatus.BLOCKED, blockingReason: reason });
      setSelectedTask(null);
    }
  };

  const capturePhoto = (step: EvidenceStage) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.capture = 'environment';

    input.onchange = async (e: any) => {
      const file = e.target.files?.[0];
      if (!file || !selectedTask) return;

      setIsUploading(true);

      const handleOfflineCapture = async (lat: number, lng: number) => {
        try {
          await queueOfflineEvidence(selectedTask.id, step, file, { lat, lng });

          const localUrl = URL.createObjectURL(file);
          const tempEvidence = {
            id: `temp_${Date.now()}`,
            taskId: selectedTask.id,
            stage: step,
            photoUrl: localUrl,
            capturedAt: new Date(),
            gpsLat: lat,
            gpsLng: lng,
            gpsAccuracy: 10,
            syncPending: true // New property for UI
          };

          const updatedTask = {
            ...selectedTask,
            evidence: [...(selectedTask.evidence || []), tempEvidence as any]
          };

          setSelectedTask(updatedTask);
          onUpdateTask(updatedTask);
        } catch (error) {
          alert("Erro ao salvar para sincronização offline: " + error);
        } finally {
          setIsUploading(false);
        }
      };

      navigator.geolocation.getCurrentPosition(async (pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;

        if (!navigator.onLine) {
          await handleOfflineCapture(lat, lng);
          return;
        }

        try {
          const evidence = await uploadEvidence(
            selectedTask.id,
            step,
            file,
            { lat, lng }
          );

          const updatedTask = {
            ...selectedTask,
            evidence: [...(selectedTask.evidence || []), evidence]
          };

          setSelectedTask(updatedTask);
          onUpdateTask(updatedTask);
        } catch (error) {
          console.warn("Retrying upload as offline due to error:", error);
          await handleOfflineCapture(lat, lng);
        } finally {
          setIsUploading(false);
        }
      }, (geoError) => {
        alert("Erro de GPS: " + geoError.message);
        setIsUploading(false);
      }, { enableHighAccuracy: true });
    };

    input.click();
  };

  const handleComplete = async () => {
    if (!selectedTask) return;

    // Validate locally first for immediate feedback
    const evidences = selectedTask.evidence || [];
    const hasBefore = evidences.some(e => e.stage === EvidenceStage.BEFORE);
    const hasDuring = evidences.some(e => e.stage === EvidenceStage.DURING);
    const hasAfter = evidences.some(e => e.stage === EvidenceStage.AFTER);

    if (!hasBefore || !hasDuring || !hasAfter) {
      alert("Você deve enviar as 3 fotos obrigatórias (Antes, Durante, Depois) para concluir o serviço.");
      return;
    }

    setIsUploading(true);

    navigator.geolocation.getCurrentPosition(async (pos) => {
      try {
        const completedTask = await completeTask(selectedTask.id, { lat: pos.coords.latitude, lng: pos.coords.longitude });
        onUpdateTask(completedTask);
        setSelectedTask(null);
        setObservation('');
      } catch (error: any) {
        alert(error.message || "Erro ao finalizar tarefa.");
      } finally {
        setIsUploading(false);
      }
    }, () => {
      alert("Erro ao capturar GPS para finalização.");
      setIsUploading(false);
    });
  };

  const handleNotPerformed = () => {
    if (!notPerformedReason) {
      alert("Selecione um motivo.");
      return;
    }

    // If "Outro", require custom reason
    const finalReason = notPerformedReason === 'Outro' ? customNotPerformedReason : notPerformedReason;

    if (!finalReason) {
      alert("Descreva o motivo.");
      return;
    }

    onUpdateTask({
      ...selectedTask!,
      status: TaskStatus.NOT_PERFORMED,
      notPerformedReason: finalReason
    });
    setShowNotPerformedModal(false);
    setSelectedTask(null);
    setNotPerformedReason('');
    setCustomNotPerformedReason('');
  };

  if (selectedTask) {
    return (
      <div className="fixed inset-0 z-50 bg-white flex flex-col md:max-w-md md:mx-auto md:shadow-2xl md:relative md:rounded-2xl overflow-hidden max-h-screen md:max-h-[90vh]">
        <header className="bg-primary text-white p-4 flex items-center justify-between shrink-0">
          <button onClick={() => setSelectedTask(null)} className="p-2 hover:bg-white/20 rounded-lg"><X /></button>
          <h2 className="font-extrabold text-lg">Execução de OS</h2>
          <div className="w-8" />
        </header>

        <div className="flex-1 overflow-y-auto p-4 space-y-6 pb-24">
          <div className="bg-primary/5 p-5 rounded-2xl border border-primary/10">
            <div className="flex justify-between items-start mb-2">
              <span className="text-[10px] font-black uppercase text-primary bg-primary/10 px-2 py-1 rounded-md">{selectedTask.serviceType}</span>
              <span className="text-xs text-slate-500 font-mono font-bold">{selectedTask.assetId}</span>
            </div>
            <h3 className="text-xl font-black text-slate-900">{selectedTask.assetType}</h3>
            <p className="text-sm text-slate-600 flex items-center gap-1.5 mt-2 font-medium">
              <MapPin size={16} className="text-primary" /> {selectedTask.asset.location.address}
            </p>
          </div>

          <div className="space-y-4">
            <h4 className="font-bold text-slate-800 flex items-center justify-between">
              Evidências Necessárias
              <span className="text-[10px] bg-slate-100 text-slate-500 px-2 py-1 rounded-full uppercase">Obrigatório</span>
            </h4>

            <div className="grid grid-cols-1 gap-4">
              <PhotoStep
                label="1. Foto Antes"
                captured={selectedTask?.evidence?.some(e => e.stage === EvidenceStage.BEFORE) || false}
                image={selectedTask?.evidence?.find(e => e.stage === EvidenceStage.BEFORE)?.photoUrl}
                isSyncing={selectedTask?.evidence?.find(e => e.stage === EvidenceStage.BEFORE)?.syncPending}
                onClick={() => capturePhoto(EvidenceStage.BEFORE)}
                loading={isUploading}
              />
              <PhotoStep
                label="2. Foto Durante"
                captured={selectedTask?.evidence?.some(e => e.stage === EvidenceStage.DURING) || false}
                image={selectedTask?.evidence?.find(e => e.stage === EvidenceStage.DURING)?.photoUrl}
                isSyncing={selectedTask?.evidence?.find(e => e.stage === EvidenceStage.DURING)?.syncPending}
                onClick={() => capturePhoto(EvidenceStage.DURING)}
                loading={isUploading}
              />
              <PhotoStep
                label="3. Foto Depois"
                captured={selectedTask?.evidence?.some(e => e.stage === EvidenceStage.AFTER) || false}
                image={selectedTask?.evidence?.find(e => e.stage === EvidenceStage.AFTER)?.photoUrl}
                isSyncing={selectedTask?.evidence?.find(e => e.stage === EvidenceStage.AFTER)?.syncPending}
                onClick={() => capturePhoto(EvidenceStage.AFTER)}
                loading={isUploading}
              />
            </div>

            <div className="space-y-2">
              <label className="font-bold text-slate-800 text-sm">Observações Técnicas</label>
              <textarea
                value={observation}
                onChange={(e) => setObservation(e.target.value)}
                placeholder="Alguma observação sobre o serviço realizado?"
                className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary min-h-[100px] text-sm font-medium"
              />
            </div>
          </div>
        </div>

        {showNotPerformedModal && (
          <div className="fixed inset-0 z-[60] bg-black/50 flex items-center justify-center p-4">
            <div className="bg-white w-full max-w-sm rounded-3xl p-6 shadow-2xl animate-in fade-in zoom-in duration-200">
              <h3 className="text-lg font-black text-slate-900 mb-4">Serviço Não Realizado</h3>
              <p className="text-sm text-slate-600 mb-4">Por qual motivo o serviço não pôde ser realizado?</p>

              <div className="space-y-2 mb-4">
                {['Chuva / Condições Climáticas', 'Local Fechado / Sem Acesso', 'Veículo Obstruindo', 'Problema Técnico', 'Falta de Material', 'Outro'].map((reason) => (
                  <button
                    key={reason}
                    onClick={() => setNotPerformedReason(reason)}
                    className={`w-full p-3 rounded-xl text-left text-sm font-bold border transition-all ${notPerformedReason === reason
                      ? 'bg-primary/5 border-primary text-primary'
                      : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                      }`}
                  >
                    {reason}
                  </button>
                ))}
              </div>

              {notPerformedReason === 'Outro' && (
                <textarea
                  value={customNotPerformedReason}
                  onChange={(e) => setCustomNotPerformedReason(e.target.value)}
                  placeholder="Descreva o motivo..."
                  className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary min-h-[80px] text-sm font-medium mb-4"
                />
              )}

              <div className="flex gap-3">
                <button
                  onClick={() => {
                    setShowNotPerformedModal(false);
                    setNotPerformedReason('');
                  }}
                  className="flex-1 py-3 bg-slate-100 text-slate-600 font-bold rounded-xl"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleNotPerformed}
                  disabled={!notPerformedReason || (notPerformedReason === 'Outro' && !customNotPerformedReason)}
                  className="flex-1 py-3 bg-red-600 text-white font-bold rounded-xl disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Confirmar
                </button>
              </div>
            </div>
          </div>
        )}

        <footer className="fixed bottom-0 left-0 right-0 p-4 bg-white border-t border-slate-100 flex gap-2 md:relative shadow-[0_-10px_30px_-15px_rgba(0,0,0,0.1)]">
          <button onClick={() => handleBlockTask(selectedTask)} className="px-4 py-4 bg-slate-50 text-slate-600 font-bold rounded-xl border border-slate-200 hover:bg-slate-100 transition-colors text-xs flex flex-col items-center justify-center gap-1">
            <Clock size={16} />
            Bloquear
          </button>
          <button onClick={() => setShowNotPerformedModal(true)} className="px-4 py-4 bg-red-50 text-red-600 font-bold rounded-xl border border-red-100 hover:bg-red-100 transition-colors text-xs flex flex-col items-center justify-center gap-1">
            <AlertTriangle size={16} />
            Não Realizado
          </button>
          <button
            disabled={
              !(selectedTask?.evidence?.some(e => e.stage === EvidenceStage.BEFORE) &&
                selectedTask?.evidence?.some(e => e.stage === EvidenceStage.DURING) &&
                selectedTask?.evidence?.some(e => e.stage === EvidenceStage.AFTER))
            }
            onClick={handleComplete}
            className={`flex-[2] py-4 px-4 font-black rounded-xl transition-all shadow-lg ${(selectedTask?.evidence?.some(e => e.stage === EvidenceStage.BEFORE) &&
              selectedTask?.evidence?.some(e => e.stage === EvidenceStage.DURING) &&
              selectedTask?.evidence?.some(e => e.stage === EvidenceStage.AFTER))
              ? 'bg-primary text-white shadow-primary/20 active:scale-95'
              : 'bg-slate-200 text-slate-400 cursor-not-allowed'
              }`}
          >
            Finalizar OS
          </button>
        </footer>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-4 md:space-y-6">
      <div className="flex gap-2 overflow-x-auto pb-2 -mx-1 px-1 no-scrollbar">
        <StatusFilter
          label="Pendentes"
          count={tasks.filter(t => t.status === TaskStatus.PENDING).length}
          active={filterStatus === TaskStatus.PENDING}
          onClick={() => setFilterStatus(TaskStatus.PENDING)}
        />
        <StatusFilter
          label="Executando"
          count={tasks.filter(t => t.status === TaskStatus.IN_PROGRESS).length}
          active={filterStatus === TaskStatus.IN_PROGRESS}
          onClick={() => setFilterStatus(TaskStatus.IN_PROGRESS)}
        />
        <StatusFilter
          label="Concluídas"
          count={tasks.filter(t => t.status === TaskStatus.COMPLETED).length}
          active={filterStatus === TaskStatus.COMPLETED}
          onClick={() => setFilterStatus(TaskStatus.COMPLETED)}
        />
        <StatusFilter
          label="Não Realizadas"
          count={tasks.filter(t => t.status === TaskStatus.NOT_PERFORMED).length}
          active={filterStatus === TaskStatus.NOT_PERFORMED}
          onClick={() => setFilterStatus(TaskStatus.NOT_PERFORMED)}
        />
      </div>

      <div className="grid gap-4">
        {displayedTasks.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-3xl border border-dashed border-slate-200">
            <p className="text-slate-400 font-bold">Nenhuma tarefa nesta categoria.</p>
          </div>
        ) : (
          displayedTasks.map(task => (
            <div
              key={task.id}
              onClick={() => setSelectedTask(task)}
              className="bg-white border border-slate-200 rounded-3xl p-5 shadow-sm hover:shadow-xl hover:border-orange-200 transition-all cursor-pointer group"
            >
              <div className="flex justify-between items-start mb-3 md:mb-4">
                <div>
                  <p className="text-[8px] md:text-[10px] font-black text-primary uppercase tracking-widest mb-0.5 md:mb-1">{task.assetId} • {task.assetType}</p>
                  <h3 className="text-lg md:text-xl font-black text-slate-800 leading-tight group-hover:text-primary transition-colors">{task.serviceType}</h3>
                </div>
                <StatusBadge status={task.status} />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 md:gap-4 mb-4 md:mb-5 p-2.5 md:p-3 bg-slate-50 rounded-xl md:rounded-2xl">
                <div className="flex items-center gap-2 text-[10px] md:text-xs text-slate-600 font-bold">
                  <MapPin size={14} className="text-primary shrink-0 md:w-4 md:h-4" />
                  <span className="truncate">{task.asset.location.address}</span>
                </div>
                <div className="flex items-center gap-2 text-[10px] md:text-xs text-slate-600 font-bold">
                  <Clock size={14} className="text-primary shrink-0 md:w-4 md:h-4" />
                  <span>{task.scheduledDate}</span>
                </div>
              </div>

              <div className="flex items-center justify-between border-t border-slate-100 pt-3 md:pt-4">
                <div className="flex -space-x-1.5 md:-space-x-2">
                  {[EvidenceStage.BEFORE, EvidenceStage.DURING, EvidenceStage.AFTER].map((step, i) => (
                    <div key={i} className={`w-7 h-7 md:w-9 md:h-9 rounded-full border-2 md:border-4 border-white flex items-center justify-center text-[10px] md:text-xs font-black shadow-sm ${task.evidence?.some(e => e.stage === step) ? 'bg-primary text-white' : 'bg-slate-100 text-slate-400'}`}>
                      {task.evidence?.some(e => e.stage === step) ? <CheckCircle2 size={12} className="md:w-4 md:h-4" /> : i + 1}
                    </div>
                  ))}
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    if (task.status === TaskStatus.PENDING) handleStartTask(task);
                    else setSelectedTask(task);
                  }}
                  className={`flex items-center gap-1.5 md:gap-2 px-4 md:px-6 py-2 md:py-2.5 rounded-lg md:rounded-xl font-black text-xs md:text-sm transition-all ${task.status === TaskStatus.PENDING ? 'bg-primary text-white shadow-primary/20 shadow-lg active:scale-95' : 'bg-slate-100 text-slate-800 hover:bg-primary/10'
                    }`}
                >
                  {task.status === TaskStatus.PENDING ? 'Iniciar' : 'Abrir'}
                  <ChevronRight size={16} className="md:w-4 md:h-4" />
                </button>
              </div>
            </div>
          )))}

      </div>
    </div>
  );
};

const PhotoStep: React.FC<{ label: string, captured: boolean, isSyncing?: boolean, image?: string, onClick: () => void, loading: boolean }> = ({ label, captured, isSyncing, image, onClick, loading }) => (
  <div
    onClick={!loading ? onClick : undefined}
    className={`relative h-32 md:h-44 rounded-xl md:rounded-2xl border-2 border-dashed flex flex-col items-center justify-center transition-all overflow-hidden cursor-pointer ${captured ? 'border-primary bg-primary/5' : 'border-slate-300 bg-slate-50 hover:border-primary/40 hover:bg-primary/5'
      }`}
  >
    {loading ? (
      <div className="flex flex-col items-center gap-2">
        <Loader2 size={24} className="animate-spin text-primary md:w-8 md:h-8" />
        <span className="text-[10px] md:text-xs font-bold text-primary">Processando...</span>
      </div>
    ) : captured ? (
      <>
        <img src={image} alt={label} className="absolute inset-0 w-full h-full object-cover" />
        <div className="absolute top-2 right-2 md:top-3 md:right-3 p-1 md:p-1.5 bg-primary text-white rounded-full shadow-lg">
          {isSyncing ? <Clock size={12} className="md:w-4 md:h-4 animate-pulse" /> : <CheckCircle2 size={12} className="md:w-4 md:h-4" />}
        </div>
        <div className="absolute bottom-2 left-2 right-2 md:bottom-3 md:left-3 md:right-3 bg-white/90 backdrop-blur-sm py-1.5 md:py-2 rounded-lg text-slate-900 text-[8px] md:text-[10px] font-black text-center uppercase tracking-widest">{label}</div>
      </>
    ) : (
      <>
        <div className="p-2 md:p-3 bg-white rounded-full shadow-sm mb-1.5 md:mb-2 text-primary">
          <Camera size={20} className="md:w-7 md:h-7" />
        </div>
        <span className="font-black text-slate-800 text-xs md:text-sm tracking-tight">{label}</span>
        <span className="text-[8px] md:text-[10px] text-slate-400 font-bold uppercase mt-0.5 md:mt-1">Clique para capturar</span>
      </>
    )}
  </div>
);

const StatusBadge: React.FC<{ status: TaskStatus }> = ({ status }) => {
  const configs = {
    [TaskStatus.PENDING]: 'bg-primary/5 text-primary border-primary/10',
    [TaskStatus.IN_PROGRESS]: 'bg-blue-50 text-blue-600 border-blue-100',
    [TaskStatus.COMPLETED]: 'bg-green-50 text-green-600 border-green-100',
    [TaskStatus.BLOCKED]: 'bg-slate-100 text-slate-500 border-slate-200',
    [TaskStatus.NOT_PERFORMED]: 'bg-red-50 text-red-600 border-red-200',
  };
  return <span className={`px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest border ${configs[status]}`}>{status}</span>;
};

const StatusFilter: React.FC<{ label: string, count: number, active?: boolean, onClick?: () => void }> = ({ label, count, active, onClick }) => (
  <button
    onClick={onClick}
    className={`flex items-center gap-3 px-5 py-2.5 rounded-2xl border shrink-0 transition-all font-black text-sm ${active ? 'bg-primary border-primary text-white shadow-primary/20 shadow-xl' : 'bg-white border-slate-200 text-slate-500'}`}>
    <span className="whitespace-nowrap">{label}</span>
    <span className={`text-[10px] px-2 py-0.5 rounded-full ${active ? 'bg-white/20' : 'bg-slate-100 text-slate-400'}`}>{count}</span>
  </button>
);

export default TechnicianView;
