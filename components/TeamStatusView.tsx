
import React, { useEffect, useState } from 'react';
import { User, UserRole, Task, TaskStatus } from '../types';
import { getTechniciansByLeader, getAllTechnicians, getTasksByUserId } from '../api/fieldManagerApi';

interface TeamStatusViewProps {
    currentUser: User;
}

interface TechnicianSummary {
    user: User;
    tasks: Task[];
    completedCount: number;
    pendingCount: number;
    lastActive: string; // Mock, maybe use last updated task?
}

export const TeamStatusView: React.FC<TeamStatusViewProps> = ({ currentUser }) => {
    const [technicians, setTechnicians] = useState<TechnicianSummary[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        loadTeamData();
    }, [currentUser]);

    const loadTeamData = async () => {
        setLoading(true);
        try {
            let users: User[] = [];

            if (currentUser.role === UserRole.CHEFE || currentUser.role === UserRole.PARCEIRO_CHEFE) {
                users = await getAllTechnicians();
            } else if (currentUser.role === UserRole.LIDER || currentUser.role === UserRole.PARCEIRO_LIDER) {
                users = await getTechniciansByLeader(currentUser.id);
            }

            // Fetch tasks for each technician to generate summary
            const techSummaries = await Promise.all(users.map(async (user) => {
                const tasks = await getTasksByUserId(user.id);
                // Filter only tasks assigned to this technician
                const techTasks = tasks.filter(t => t.technicianId === user.id);

                const completed = techTasks.filter(t => t.status === TaskStatus.COMPLETED).length;
                const pending = techTasks.filter(t => t.status !== TaskStatus.COMPLETED && t.status !== TaskStatus.NOT_PERFORMED).length;

                return {
                    user,
                    tasks: techTasks,
                    completedCount: completed,
                    pendingCount: pending,
                    lastActive: 'Online agora' // Mock
                };
            }));

            setTechnicians(techSummaries);

        } catch (error) {
            console.error("Erro ao carregar equipe", error);
        } finally {
            setLoading(false);
        }
    };

    if (loading) {
        return <div className="p-4 text-center">Carregando status da equipe...</div>;
    }

    return (
        <div className="p-4 bg-gray-50 min-h-screen">
            <h1 className="text-2xl font-bold mb-6 text-gray-800">
                {currentUser.role === UserRole.CHEFE ? 'Visão Geral dos Técnicos (Chefe)' : 'Minha Equipe'}
            </h1>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {technicians.map((tech) => (
                    <div key={tech.user.id} className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
                        <div className="flex items-center space-x-4 mb-4">
                            <img
                                src={tech.user.avatar}
                                alt={tech.user.name}
                                className="w-12 h-12 rounded-full border-2 border-indigo-100"
                            />
                            <div>
                                <h3 className="font-semibold text-gray-900">{tech.user.name}</h3>
                                <div className="flex items-center space-x-2 text-sm text-gray-500">
                                    <span className="w-2 h-2 rounded-full bg-green-500"></span>
                                    <span>{tech.lastActive}</span>
                                </div>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4 mb-4">
                            <div className="bg-blue-50 p-3 rounded-lg text-center">
                                <span className="block text-2xl font-bold text-blue-600">{tech.pendingCount}</span>
                                <span className="text-xs text-blue-600 font-medium">PENDENTES</span>
                            </div>
                            <div className="bg-green-50 p-3 rounded-lg text-center">
                                <span className="block text-2xl font-bold text-green-600">{tech.completedCount}</span>
                                <span className="text-xs text-green-600 font-medium">CONCLUÍDAS</span>
                            </div>
                        </div>

                        <div className="border-t pt-4">
                            <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Atividade Recente</h4>
                            <div className="space-y-3">
                                {tech.tasks.slice(0, 2).map(task => (
                                    <div key={task.id} className="text-sm">
                                        <div className="flex justify-between items-start mb-1">
                                            <span className="font-medium text-gray-700 truncate w-3/4">{task.asset.code} - {task.serviceType}</span>
                                            <span className={`text-xs px-2 py-0.5 rounded-full ${task.status === TaskStatus.COMPLETED ? 'bg-green-100 text-green-700' :
                                                    task.status === TaskStatus.IN_PROGRESS ? 'bg-blue-100 text-blue-700' :
                                                        'bg-gray-100 text-gray-600'
                                                }`}>
                                                {task.status === TaskStatus.COMPLETED ? 'OK' : '...'}
                                            </span>
                                        </div>
                                        <p className="text-gray-500 text-xs truncate">{task.description}</p>
                                    </div>
                                ))}
                                {tech.tasks.length === 0 && <p className="text-gray-400 text-xs italic">Nenhuma tarefa atribuída.</p>}
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            {technicians.length === 0 && (
                <div className="text-center py-12 text-gray-500 bg-white rounded-xl border border-dashed border-gray-300">
                    <p>Nenhum técnico encontrado nesta equipe.</p>
                </div>
            )}
        </div>
    );
};
