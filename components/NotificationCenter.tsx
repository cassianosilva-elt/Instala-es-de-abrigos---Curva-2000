import React, { useState, useEffect } from 'react';
import { Bell, X, Info, CheckCircle, AlertTriangle } from 'lucide-react';
import { supabase } from '../api/supabaseClient';
import { User, Task } from '../types';

interface Notification {
    id: string;
    title: string;
    message: string;
    type: 'info' | 'success' | 'warning';
    read: boolean;
    timestamp: Date;
}

interface Props {
    currentUser: User;
}

export const NotificationCenter: React.FC<Props> = ({ currentUser }) => {
    const [notifications, setNotifications] = useState<Notification[]>([]);
    const [isOpen, setIsOpen] = useState(false);
    const [unreadCount, setUnreadCount] = useState(0);

    useEffect(() => {
        setUnreadCount(notifications.filter(n => !n.read).length);
    }, [notifications]);

    useEffect(() => {
        if (!currentUser) return;

        // Listen for new tasks assigned to this user
        const channel = supabase
            .channel('new-tasks-notification')
            .on(
                'postgres_changes',
                { event: 'INSERT', schema: 'public', table: 'tasks' },
                (payload) => {
                    const newTask = payload.new as any;
                    if (newTask.technician_id === currentUser.id) {
                        addNotification({
                            id: `notif_${Date.now()}`,
                            title: 'Nova OS Atribuída',
                            message: `Você recebeu uma nova tarefa: ${newTask.service_type} em ${newTask.asset_id}`,
                            type: 'info',
                            read: false,
                            timestamp: new Date()
                        });

                        // Browser Notification if permitted
                        if ("Notification" in window && Notification.permission === "granted") {
                            new Notification("Nova OS Atribuída", {
                                body: `Tarefa: ${newTask.service_type}`
                            });
                        }
                    }
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [currentUser]);

    const addNotification = (notif: Notification) => {
        setNotifications(prev => [notif, ...prev].slice(0, 20));
    };

    const markAllAsRead = () => {
        setNotifications(prev => prev.map(n => ({ ...n, read: true })));
    };

    const removeNotification = (id: string, e: React.MouseEvent) => {
        e.stopPropagation();
        setNotifications(prev => prev.filter(n => n.id !== id));
    };

    return (
        <div className="relative">
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="relative p-2 text-slate-400 hover:text-primary hover:bg-primary-50 rounded-xl transition-all"
            >
                <Bell size={24} />
                {unreadCount > 0 && (
                    <span className="absolute top-1.5 right-1.5 w-5 h-5 bg-red-500 text-white text-[10px] font-black flex items-center justify-center rounded-full border-2 border-white animate-bounce">
                        {unreadCount}
                    </span>
                )}
            </button>

            {isOpen && (
                <>
                    <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
                    <div className="absolute right-0 mt-2 w-80 bg-white rounded-3xl shadow-2xl border border-slate-100 z-50 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
                        <div className="p-4 bg-slate-50 border-b border-slate-100 flex justify-between items-center">
                            <h3 className="text-xs font-black text-slate-800 uppercase tracking-widest">Notificações</h3>
                            <button
                                onClick={markAllAsRead}
                                className="text-[10px] font-black text-primary hover:underline uppercase"
                            >
                                Limpar tudo
                            </button>
                        </div>

                        <div className="max-h-[400px] overflow-y-auto">
                            {notifications.length === 0 ? (
                                <div className="p-10 text-center">
                                    <div className="w-12 h-12 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-3 text-slate-300">
                                        <Bell size={20} />
                                    </div>
                                    <p className="text-xs font-bold text-slate-400">Nenhuma notificação por enquanto.</p>
                                </div>
                            ) : (
                                notifications.map(notif => (
                                    <div
                                        key={notif.id}
                                        className={`p-4 border-b border-slate-50 flex gap-3 hover:bg-slate-50 transition-colors relative group ${!notif.read ? 'bg-primary/5' : ''}`}
                                    >
                                        <div className={`shrink-0 w-8 h-8 rounded-lg flex items-center justify-center ${notif.type === 'success' ? 'bg-green-100 text-green-600' :
                                                notif.type === 'warning' ? 'bg-orange-100 text-orange-600' : 'bg-blue-100 text-blue-600'
                                            }`}>
                                            {notif.type === 'success' ? <CheckCircle size={16} /> :
                                                notif.type === 'warning' ? <AlertTriangle size={16} /> : <Info size={16} />}
                                        </div>
                                        <div className="flex-1 pr-4">
                                            <p className="text-xs font-black text-slate-800 mb-0.5">{notif.title}</p>
                                            <p className="text-[11px] text-slate-500 font-medium leading-relaxed">{notif.message}</p>
                                            <p className="text-[9px] text-slate-400 mt-1 font-bold">{notif.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
                                        </div>
                                        <button
                                            onClick={(e) => removeNotification(notif.id, e)}
                                            className="absolute top-4 right-4 text-slate-300 hover:text-slate-600 opacity-0 group-hover:opacity-100 transition-opacity"
                                        >
                                            <X size={14} />
                                        </button>
                                    </div>
                                ))
                            )}
                        </div>

                        <div className="p-3 bg-slate-50 text-center">
                            <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Fim das notificações</p>
                        </div>
                    </div>
                </>
            )}
        </div>
    );
};
