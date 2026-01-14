
import { Task, TaskStatus, EvidenceStage, UserRole, TaskEvidence, ChatMessage, User, Team, ServiceType } from '../types';
import { supabase } from './supabaseClient';

// --- TASKS ---

export const getTasksByUserId = async (userId: string): Promise<Task[]> => {
    const { data: userProfile, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();

    if (profileError || !userProfile) return [];

    const isTechnician = userProfile.role === UserRole.TECNICO || userProfile.role === UserRole.PARCEIRO_TECNICO;
    const isChief = userProfile.role === UserRole.CHEFE || userProfile.role === UserRole.PARCEIRO_CHEFE;
    const isLeader = userProfile.role === UserRole.LIDER || userProfile.role === UserRole.PARCEIRO_LIDER;

    let query = supabase.from('tasks').select('*');

    if (isTechnician) {
        query = query.eq('technician_id', userId);
    } else if (isLeader) {
        query = query.eq('company_id', userProfile.company_id);
    } else if (isChief) {
        if (userProfile.company_id !== 'internal') {
            query = query.eq('company_id', userProfile.company_id);
        }
    } else {
        return [];
    }

    const { data: tasks, error } = await query.order('created_at', { ascending: false });
    if (error || !tasks) return [];

    return tasks.map(t => ({
        id: t.id,
        assetId: t.asset_id,
        asset: t.asset_json,
        serviceType: t.service_type as ServiceType,
        status: t.status as TaskStatus,
        technicianId: t.technician_id,
        leaderId: t.leader_id,
        companyId: t.company_id,
        scheduledDate: t.scheduled_date,
        description: t.description,
        startedAt: t.started_at ? new Date(t.started_at) : undefined,
        completedAt: t.completed_at ? new Date(t.completed_at) : undefined,
        blockingReason: t.blocking_reason,
        notPerformedReason: t.not_performed_reason,
        evidence: []
    }));
};

export const updateTaskStatus = async (taskId: string, newStatus: TaskStatus): Promise<Task> => {
    const updates: any = { status: newStatus };

    if (newStatus === TaskStatus.IN_PROGRESS) {
        updates.started_at = new Date().toISOString();
    }

    if (newStatus === TaskStatus.COMPLETED) {
        updates.completed_at = new Date().toISOString();
    }

    const { data, error } = await supabase
        .from('tasks')
        .update(updates)
        .eq('id', taskId)
        .select()
        .single();

    if (error) throw error;

    return {
        id: data.id,
        assetId: data.asset_id,
        asset: data.asset_json,
        serviceType: data.service_type as ServiceType,
        status: data.status as TaskStatus,
        technicianId: data.technician_id,
        leaderId: data.leader_id,
        companyId: data.company_id,
        scheduledDate: data.scheduled_date,
        description: data.description,
        startedAt: data.started_at ? new Date(data.started_at) : undefined,
        completedAt: data.completed_at ? new Date(data.completed_at) : undefined,
        blockingReason: data.blocking_reason,
        notPerformedReason: data.not_performed_reason,
        evidence: []
    };
};

export const createTask = async (task: Omit<Task, 'id'>): Promise<Task> => {
    const dbTask = {
        id: `task_${Date.now()}`,
        asset_id: task.assetId,
        asset_json: task.asset,
        service_type: task.serviceType,
        status: task.status,
        technician_id: task.technicianId,
        leader_id: task.leaderId,
        company_id: task.companyId,
        scheduled_date: task.scheduledDate,
        description: task.description
    };

    const { data, error } = await supabase
        .from('tasks')
        .insert(dbTask)
        .select()
        .single();

    if (error) throw error;

    return {
        id: data.id,
        assetId: data.asset_id,
        asset: data.asset_json,
        serviceType: data.service_type as ServiceType,
        status: data.status as TaskStatus,
        technicianId: data.technician_id,
        leaderId: data.leader_id,
        companyId: data.company_id,
        scheduledDate: data.scheduled_date,
        description: data.description,
        evidence: []
    };
};

// --- EVIDENCE ---

export const completeTask = async (taskId: string, location: { lat: number, lng: number }): Promise<Task> => {
    // In a real app, you might want to save the final completion location or check a geofence here
    return updateTaskStatus(taskId, TaskStatus.COMPLETED);
};

export const getEvidenceByTaskId = async (taskId: string): Promise<TaskEvidence[]> => {
    const { data, error } = await supabase
        .from('task_evidences')
        .select('*')
        .eq('task_id', taskId);

    if (error) return [];
    return data.map(ev => ({
        id: ev.id,
        taskId: ev.task_id,
        stage: ev.stage as EvidenceStage,
        photoUrl: ev.photo_url,
        capturedAt: new Date(ev.captured_at),
        gpsLat: ev.gps_lat,
        gpsLng: ev.gps_lng,
        gpsAccuracy: ev.gps_accuracy
    }));
};

export const uploadEvidence = async (taskId: string, stage: EvidenceStage, file: File, location: { lat: number, lng: number }): Promise<TaskEvidence> => {
    const fileExt = file.name.split('.').pop();
    const fileName = `${taskId}/${stage}_${Date.now()}.${fileExt}`;
    const filePath = `evidence/${fileName}`;

    const { error: uploadError } = await supabase.storage
        .from('assets') // Using 'assets' bucket for evidence too, or create 'evidence' bucket
        .upload(filePath, file);

    if (uploadError) throw uploadError;

    const { data: { publicUrl } } = supabase.storage
        .from('assets')
        .getPublicUrl(filePath);

    const { data, error } = await supabase
        .from('task_evidences')
        .insert({
            task_id: taskId,
            stage,
            photo_url: publicUrl,
            gps_lat: location.lat,
            gps_lng: location.lng,
            gps_accuracy: 10
        })
        .select()
        .single();

    if (error) throw error;

    return {
        id: data.id,
        taskId: data.task_id,
        stage: data.stage as EvidenceStage,
        photoUrl: data.photo_url,
        capturedAt: new Date(data.captured_at),
        gpsLat: data.gps_lat,
        gpsLng: data.gps_lng,
        gpsAccuracy: data.gps_accuracy
    };
};

// --- TEAM MANAGEMENT ---

export const getTeams = async (companyId: string): Promise<Team[]> => {
    let query = supabase.from('teams').select('*');
    if (companyId !== 'internal') {
        query = query.eq('company_id', companyId);
    }
    const { data, error } = await query;
    if (error) return [];
    return data.map(t => ({
        id: t.id,
        leaderId: t.leader_id,
        technicianIds: t.technician_ids,
        name: t.name,
        companyId: t.company_id
    }));
};

export const createTeam = async (team: Omit<Team, 'id'>): Promise<Team> => {
    const { data, error } = await supabase
        .from('teams')
        .insert({
            id: `team_${Date.now()}`,
            name: team.name,
            leader_id: team.leaderId,
            technician_ids: team.technicianIds,
            company_id: team.companyId
        })
        .select()
        .single();

    if (error) throw error;
    return {
        id: data.id,
        leaderId: data.leader_id,
        technicianIds: data.technician_ids,
        name: data.name,
        companyId: data.company_id
    };
};

export const updateTeam = async (teamId: string, teamData: Partial<Team>): Promise<void> => {
    const updates: any = {};
    if (teamData.name) updates.name = teamData.name;
    if (teamData.leaderId) updates.leader_id = teamData.leaderId;
    if (teamData.technicianIds) updates.technician_ids = teamData.technicianIds;

    const { error } = await supabase
        .from('teams')
        .update(updates)
        .eq('id', teamId);

    if (error) throw error;
};

export const deleteTeam = async (teamId: string): Promise<void> => {
    const { error } = await supabase
        .from('teams')
        .delete()
        .eq('id', teamId);

    if (error) throw error;
};

export const getAllUsers = async (companyId: string): Promise<User[]> => {
    let query = supabase.from('profiles').select('*');
    if (companyId !== 'internal') {
        query = query.eq('company_id', companyId);
    }
    const { data, error } = await query;
    if (error) return [];
    return data.map(u => ({
        id: u.id,
        name: u.name,
        role: u.role as UserRole,
        companyId: u.company_id,
        companyName: u.company_name,
        avatar: u.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(u.name)}`,
        email: u.email
    }));
};

export const getAllTechnicians = async (): Promise<User[]> => {
    const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .in('role', [UserRole.TECNICO, UserRole.PARCEIRO_TECNICO]);

    if (error) return [];
    return data.map(u => ({
        id: u.id,
        name: u.name,
        role: u.role as UserRole,
        companyId: u.company_id,
        companyName: u.company_name,
        avatar: u.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(u.name)}`,
        email: u.email
    }));
};

export const getTechniciansByLeader = async (leaderId: string): Promise<User[]> => {
    const { data: teams, error: teamsError } = await supabase
        .from('teams')
        .select('technician_ids')
        .eq('leader_id', leaderId);

    if (teamsError || !teams) return [];

    const techIds = Array.from(new Set(teams.flatMap(t => (t.technician_ids || []))));
    if (techIds.length === 0) return [];

    const { data: users, error: usersError } = await supabase
        .from('profiles')
        .select('*')
        .in('id', techIds);

    if (usersError || !users) return [];

    return users.map(u => ({
        id: u.id,
        name: u.name,
        role: u.role as UserRole,
        companyId: u.company_id,
        companyName: u.company_name,
        avatar: u.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(u.name)}`,
        email: u.email
    }));
};

export const getOrCreateConversation = async (user1Id: string, user2Id: string): Promise<string> => {
    console.log(`[Chat] Configurando conversa entre ${user1Id} e ${user2Id}`);

    // Buscamos conversas que contenham os dois participantes
    const { data: convs, error } = await supabase
        .from('chat_conversations')
        .select('id, participants')
        .contains('participants', [user1Id, user2Id]);

    if (!error && convs && convs.length > 0) {
        // Garantimos que pegamos a conversa com EXATAMENTE 2 participantes (conversa privada)
        const exactConv = convs.find(c => c.participants.length === 2);
        if (exactConv) {
            console.log(`[Chat] Conversa encontrada: ${exactConv.id}`);
            return exactConv.id;
        }
    }

    // Se não existir, criamos uma nova com os IDs ordenados para consistência absoluta
    const sortedParticipants = [user1Id, user2Id].sort();
    console.log(`[Chat] Criando nova conversa com participantes:`, sortedParticipants);

    const { data, error: createError } = await supabase
        .from('chat_conversations')
        .insert({ participants: sortedParticipants })
        .select()
        .single();

    if (createError) {
        console.error(`[Chat] Erro ao criar conversa:`, createError);
        throw createError;
    }

    return data.id;
};

export const getConversations = async (userId: string): Promise<any[]> => {
    const { data, error } = await supabase
        .from('chat_conversations')
        .select('*, chat_messages(*)')
        .contains('participants', [userId]);

    if (error) return [];
    // Sort messages and format
    return data.map(conv => ({
        ...conv,
        lastMessage: conv.chat_messages?.sort((a: any, b: any) =>
            new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0]
    }));
};

export const sendMessage = async (conversationId: string, senderId: string, content: string): Promise<void> => {
    const { error } = await supabase
        .from('chat_messages')
        .insert({
            conversation_id: conversationId,
            sender_id: senderId,
            content
        });

    if (error) throw error;
};

export const getMessagesByConversation = async (conversationId: string): Promise<ChatMessage[]> => {
    const { data, error } = await supabase
        .from('chat_messages')
        .select('*')
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: true });

    if (error) return [];
    return data.map(m => ({
        id: m.id,
        senderId: m.sender_id,
        receiverId: '', // In group/conversation model, receiver is implied by conversation
        content: m.content,
        timestamp: new Date(m.created_at),
        read: m.is_read
    }));
};

// --- ASSETS ---

export const getAssets = async (): Promise<any[]> => {
    const { data, error } = await supabase.from('assets').select('*');
    if (error) return [];
    return data;
};

// --- PROFILE ---

export const updateUserProfile = async (userId: string, updates: Partial<User>): Promise<User> => {
    const { data, error } = await supabase
        .from('profiles')
        .update({
            name: updates.name,
            avatar: updates.avatar
        })
        .eq('id', userId)
        .select()
        .single();

    if (error) throw error;
    return {
        id: data.id,
        name: data.name,
        role: data.role as UserRole,
        companyId: data.company_id,
        companyName: data.company_name,
        avatar: data.avatar,
        email: data.email
    };
};

export const uploadAvatar = async (userId: string, file: File): Promise<string> => {
    const fileExt = file.name.split('.').pop();
    const fileName = `${userId}/${Date.now()}.${fileExt}`;
    const filePath = `avatars/${fileName}`;

    const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(filePath, file, { upsert: true });

    if (uploadError) throw uploadError;

    const { data } = supabase.storage
        .from('avatars')
        .getPublicUrl(filePath);

    return data.publicUrl;
};
