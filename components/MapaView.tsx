
import React from 'react';
import { Task, TaskStatus } from '../types';
import { MapPin, Info } from 'lucide-react';

interface Props {
  tasks: Task[];
}

const MapaView: React.FC<Props> = ({ tasks }) => {
  return (
    <div className="h-full flex flex-col space-y-6 animate-in zoom-in-95 duration-500">
      <div className="flex-1 bg-slate-100 rounded-3xl border border-slate-200 shadow-inner relative overflow-hidden flex items-center justify-center">
        {/* Map Placeholder Background */}
        <div className="absolute inset-0 opacity-10" style={{ backgroundImage: 'radial-gradient(#cbd5e1 1px, transparent 1px)', backgroundSize: '20px 20px' }}></div>
        <div className="absolute inset-0 opacity-20 pointer-events-none">
          <svg width="100%" height="100%">
            <path d="M0,100 Q150,50 300,100 T600,100" fill="none" stroke="#94a3b8" strokeWidth="2" />
            <path d="M100,0 Q150,200 100,400" fill="none" stroke="#94a3b8" strokeWidth="2" />
            <circle cx="50%" cy="50%" r="50" fill="none" stroke="#94a3b8" strokeWidth="1" />
          </svg>
        </div>
        {/* Mock Pins */}
        {tasks.map((task, i) => (
          <div
            key={task.id}
            className="absolute transition-transform hover:scale-110 cursor-pointer group"
            style={{
              top: `${30 + (i * 15)}%`,
              left: `${20 + (i * 20)}%`
            }}
          >
            <div className={`p-2 rounded-full shadow-lg ${task.status === TaskStatus.COMPLETED ? 'bg-green-500' : 'bg-primary'
              } text-white`}>
              <MapPin size={24} />
            </div>
            <div className="absolute top-full mt-2 left-1/2 -translate-x-1/2 bg-white px-3 py-1 rounded-lg border border-slate-200 shadow-xl whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity z-20">
              <p className="text-[10px] font-black text-slate-800">{task.assetId}</p>
              <p className="text-[8px] text-slate-400 font-bold uppercase">{task.status}</p>
            </div>
          </div>
        ))}

        <div className="absolute bottom-6 right-6 bg-white/90 backdrop-blur p-4 rounded-2xl border border-slate-200 shadow-2xl max-w-xs">
          <h4 className="text-sm font-black text-slate-900 flex items-center gap-2 mb-2">
            <Info size={16} className="text-primary" />
            Legenda Operativa
          </h4>
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-[10px] font-bold text-slate-600">
              <div className="w-3 h-3 rounded-full bg-primary" /> Ativos em Manutenção
            </div>
            <div className="flex items-center gap-2 text-[10px] font-bold text-slate-600">
              <div className="w-3 h-3 rounded-full bg-green-500" /> Ativos Conformitados
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MapaView;
