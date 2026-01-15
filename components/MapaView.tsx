
import React, { useState, useCallback } from 'react';
import { Task, TaskStatus } from '../types';
import { MapPin, Info, Loader2, Navigation } from 'lucide-react';
import { GoogleMap, useJsApiLoader, Marker, InfoWindow } from '@react-google-maps/api';

interface Props {
  tasks: Task[];
}

const containerStyle = {
  width: '100%',
  height: '100%'
};

const center = {
  lat: -23.5505,
  lng: -46.6333
};

const libraries: ("drawing" | "geometry" | "places" | "visualization")[] = ["geometry", "places"];

const MapaView: React.FC<Props> = ({ tasks }) => {
  const { isLoaded } = useJsApiLoader({
    id: 'google-map-script',
    googleMapsApiKey: (import.meta.env.VITE_GOOGLE_MAPS_API_KEY as string) || "",
    libraries: libraries
  });

  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [map, setMap] = useState<google.maps.Map | null>(null);

  const onLoad = useCallback(function callback(map: google.maps.Map) {
    if (tasks.length > 0) {
      const bounds = new window.google.maps.LatLngBounds();
      tasks.forEach(task => {
        if (task.asset?.location?.lat && task.asset?.location?.lng) {
          bounds.extend({ lat: task.asset.location.lat, lng: task.asset.location.lng });
        }
      });
      map.fitBounds(bounds);
    }
    setMap(map);
  }, [tasks]);

  const onUnmount = useCallback(function callback(map: google.maps.Map) {
    setMap(null);
  }, []);

  const getMarkerIcon = (status: TaskStatus) => {
    switch (status) {
      case TaskStatus.COMPLETED: return "http://maps.google.com/mapfiles/ms/icons/green-dot.png";
      case TaskStatus.IN_PROGRESS: return "http://maps.google.com/mapfiles/ms/icons/blue-dot.png";
      case TaskStatus.BLOCKED: return "http://maps.google.com/mapfiles/ms/icons/yellow-dot.png";
      case TaskStatus.NOT_PERFORMED: return "http://maps.google.com/mapfiles/ms/icons/red-dot.png";
      default: return "http://maps.google.com/mapfiles/ms/icons/orange-dot.png";
    }
  };

  if (!isLoaded) {
    return (
      <div className="h-full flex items-center justify-center bg-slate-50 rounded-3xl border border-slate-200">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-12 h-12 text-primary animate-spin" />
          <p className="text-slate-400 font-black uppercase tracking-widest text-[10px]">Carregando Mapas</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col space-y-6 animate-in zoom-in-95 duration-500">
      <div className="flex-1 bg-slate-100 rounded-3xl border border-slate-200 shadow-inner relative overflow-hidden">

        <GoogleMap
          mapContainerStyle={containerStyle}
          center={center}
          zoom={12}
          onLoad={onLoad}
          onUnmount={onUnmount}
          options={{
            styles: mapStyles,
            disableDefaultUI: false,
            zoomControl: true,
          }}
        >
          {tasks.map((task) => (
            task.asset?.location?.lat && (
              <Marker
                key={task.id}
                position={{ lat: task.asset.location.lat, lng: task.asset.location.lng }}
                icon={getMarkerIcon(task.status)}
                onClick={() => setSelectedTask(task)}
              />
            )
          ))}

          {selectedTask && (
            <InfoWindow
              position={{ lat: selectedTask.asset.location.lat, lng: selectedTask.asset.location.lng }}
              onCloseClick={() => setSelectedTask(null)}
            >
              <div className="p-2 min-w-[200px]">
                <p className="text-[10px] font-black text-primary uppercase mb-1">{selectedTask.assetId}</p>
                <h4 className="font-black text-slate-800 text-sm mb-2">{selectedTask.serviceType}</h4>
                <p className="text-[10px] text-slate-500 font-medium mb-3 flex items-center gap-1">
                  <MapPin size={10} /> {selectedTask.asset.location.address}
                </p>
                <div className="flex justify-between items-center pt-2 border-t border-slate-100">
                  <span className={`text-[8px] font-black px-2 py-0.5 rounded-full uppercase border ${selectedTask.status === TaskStatus.COMPLETED ? 'bg-green-50 text-green-600 border-green-100' : 'bg-primary/5 text-primary border-primary/20'
                    }`}>
                    {selectedTask.status}
                  </span>
                  <button
                    onClick={() => window.open(`https://www.google.com/maps/dir/?api=1&destination=${selectedTask.asset.location.lat},${selectedTask.asset.location.lng}`, '_blank')}
                    className="p-1.5 bg-slate-900 text-white rounded-lg hover:bg-slate-800 transition-colors"
                  >
                    <Navigation size={14} />
                  </button>
                </div>
              </div>
            </InfoWindow>
          )}
        </GoogleMap>

        <div className="absolute bottom-4 left-4 right-4 md:left-auto md:bottom-6 md:right-6 bg-white/90 backdrop-blur p-4 rounded-2xl border border-slate-200 shadow-2xl md:max-w-xs pointer-events-none">
          <h4 className="text-sm font-black text-slate-900 flex items-center gap-2 mb-2">
            <Info size={16} className="text-primary" />
            Legenda Operativa
          </h4>
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-[10px] font-bold text-slate-600">
              <div className="w-3 h-3 rounded-full bg-orange-500" /> Pendentes
            </div>
            <div className="flex items-center gap-2 text-[10px] font-bold text-slate-600">
              <div className="w-3 h-3 rounded-full bg-blue-500" /> Em Andamento
            </div>
            <div className="flex items-center gap-2 text-[10px] font-bold text-slate-600">
              <div className="w-3 h-3 rounded-full bg-green-500" /> Concluídos
            </div>
            <div className="flex items-center gap-2 text-[10px] font-bold text-slate-600">
              <div className="w-3 h-3 rounded-full bg-red-500" /> Não Realizados
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

const mapStyles = [
  {
    "featureType": "administrative",
    "elementType": "labels.text.fill",
    "stylers": [{ "color": "#444444" }]
  },
  {
    "featureType": "landscape",
    "elementType": "all",
    "stylers": [{ "color": "#f2f2f2" }]
  },
  {
    "featureType": "poi",
    "elementType": "all",
    "stylers": [{ "visibility": "off" }]
  },
  {
    "featureType": "road",
    "elementType": "all",
    "stylers": [{ "saturation": -100 }, { "lightness": 45 }]
  },
  {
    "featureType": "road.highway",
    "elementType": "all",
    "stylers": [{ "visibility": "simplified" }]
  },
  {
    "featureType": "road.arterial",
    "elementType": "labels.icon",
    "stylers": [{ "visibility": "off" }]
  },
  {
    "featureType": "transit",
    "elementType": "all",
    "stylers": [{ "visibility": "off" }]
  },
  {
    "featureType": "water",
    "elementType": "all",
    "stylers": [{ "color": "#FA3A00" }, { "visibility": "on" }, { "opacity": 0.1 }]
  }
];

export default MapaView;
