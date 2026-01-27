
import { Task, TaskStatus, EvidenceStage, UserRole, TaskEvidence, ChatMessage, User, Team, ServiceType, Asset, AssetType, Employee, Absence, VehicleLog, Vehicle, OpecItem, OpecDevice, AuditLog, DailyReport, DailyActivity, AssetMeasurement } from '../types';
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

export const deleteTask = async (taskId: string): Promise<void> => {
    const { error } = await supabase
        .from('tasks')
        .delete()
        .eq('id', taskId);

    if (error) throw error;
};

export const bulkDeleteTasks = async (taskIds: string[]): Promise<void> => {
    const { error } = await supabase
        .from('tasks')
        .delete()
        .in('id', taskIds);

    if (error) throw error;
};

export const bulkCreateTasks = async (tasks: any[]): Promise<void> => {
    const { error } = await supabase
        .from('tasks')
        .insert(tasks);
    if (error) throw error;
};

// --- GET TASKS BY COMPANY ---
export const getTasksByCompanyId = async (companyId: string): Promise<Task[]> => {
    // Map company select ID to actual company_id used in tasks
    const companyIdMap: Record<string, string> = {
        'gf1': 'gf1',
        'alvares': 'alvares',
        'bassi': 'bassi',
        'afn_nogueira': 'afn_nogueira'
    };

    const actualCompanyId = companyIdMap[companyId] || companyId;

    const { data: tasks, error } = await supabase
        .from('tasks')
        .select('*')
        .eq('company_id', actualCompanyId)
        .order('scheduled_date', { ascending: false });

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

export const getEvidenceByAssetId = async (assetId: string): Promise<TaskEvidence[]> => {
    const { data: tasks, error: tasksError } = await supabase
        .from('tasks')
        .select('id')
        .eq('asset_id', assetId);

    if (tasksError || !tasks || tasks.length === 0) return [];

    const taskIds = tasks.map(t => t.id);

    const { data, error } = await supabase
        .from('task_evidences')
        .select('*')
        .in('task_id', taskIds);

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
    // 1. Fetch active profiles
    let profileQuery = supabase.from('profiles').select('*');
    if (companyId !== 'internal') {
        profileQuery = profileQuery.eq('company_id', companyId);
    }
    const { data: profiles, error: pError } = await profileQuery;
    if (pError) return [];

    // 2. Fetch pending invites
    let inviteQuery = supabase.from('employee_invites').select('*');
    if (companyId !== 'internal') {
        inviteQuery = inviteQuery.eq('company_id', companyId);
    }
    const { data: invites, error: iError } = await inviteQuery;
    if (iError) return [];

    // 3. Convert to User type
    const activeUsers: User[] = (profiles || []).map(u => ({
        id: u.id,
        name: u.name,
        role: u.role as UserRole,
        companyId: u.company_id,
        companyName: u.company_name,
        avatar: u.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(u.name)}`,
        email: u.email,
        status: 'ACTIVE',
        shift: u.shift,
        code: u.code,
        leaderName: u.leader_name,
        originalStatus: u.original_status
    }));

    const pendingUsers: User[] = (invites || []).map(i => ({
        id: i.id, // This is the Invite ID (UUID)
        name: i.name,
        role: i.role as UserRole,
        companyId: i.company_id,
        companyName: i.company_name,
        avatar: `https://ui-avatars.com/api/?name=${encodeURIComponent(i.name)}&background=random`,
        email: i.email,
        status: 'PENDING',
        shift: i.shift,
        code: i.code,
        leaderName: i.leader_name,
        originalStatus: i.original_status
    }));

    // 4. Merge and Deduplicate by Email (prefer ACTIVE)
    const userMap = new Map<string, User>();
    activeUsers.forEach(u => userMap.set(u.email.toLowerCase(), u));
    pendingUsers.forEach(u => {
        if (!userMap.has(u.email.toLowerCase())) {
            userMap.set(u.email.toLowerCase(), u);
        }
    });

    return Array.from(userMap.values());
};

export const getAllTechnicians = async (companyId?: string): Promise<User[]> => {
    let query = supabase
        .from('profiles')
        .select('*')
        .in('role', [UserRole.TECNICO, UserRole.PARCEIRO_TECNICO]);

    if (companyId && companyId !== 'internal') {
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

export const getAssets = async (companyId?: string): Promise<Asset[]> => {
    let query = supabase.from('assets').select('*');
    if (companyId && companyId !== 'internal') {
        query = query.eq('company_id', companyId);
    }
    const { data, error } = await query;
    if (error) return [];

    return data.map(a => ({
        id: a.id,
        code: a.code,
        type: a.type as AssetType,
        city: a.city,
        companyId: a.company_id,
        location: {
            lat: a.lat,
            lng: a.lng,
            address: a.address
        }
    }));
};

export const bulkCreateAssets = async (assets: any[]): Promise<void> => {
    const { error } = await supabase.from('assets').upsert(assets, { onConflict: 'code' });
    if (error) throw error;
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
    const filePath = `${fileName}`;

    const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(filePath, file, { upsert: true });

    if (uploadError) throw uploadError;

    const { data } = supabase.storage
        .from('avatars')
        .getPublicUrl(filePath);

    return data.publicUrl;
};

// --- MEASUREMENT PRICES ---

export const getMeasurementPrices = async (companyId: string): Promise<any[]> => {
    const { data, error } = await supabase
        .from('measurement_prices')
        .select('*')
        .eq('company_id', companyId);

    if (error) return [];

    const mappedPrices = data.map(p => ({
        id: p.id,
        category: p.category,
        itemCode: p.item_code,
        description: p.description,
        unit: p.unit,
        price: p.price
    }));

    // Fallback: Ensure critical items exist if missing from DB
    const missingTotemItem = {
        id: 'totem_instalacao_completa_fallback',
        category: 'TOTEM',
        itemCode: 'FALLBACK',
        description: 'Instalação Completa de Totem, incluindo a execução do piso podotátil',
        unit: 'UN',
        price: 480.69
    };

    const hasTotemItem = mappedPrices.some(p =>
        p.description && p.description.normalize('NFD').replace(/[\u0300-\u036f]/g, "").toLowerCase().includes('instalacao completa de totem')
    );

    if (!hasTotemItem) {
        mappedPrices.push(missingTotemItem);
    }

    return mappedPrices;
};

export const bulkUpdateMeasurementPrices = async (companyId: string, prices: any[], category?: string): Promise<void> => {
    // 1. Clear existing prices for this scope to avoid ghost items (like old headers)
    let deleteQuery = supabase.from('measurement_prices').delete().eq('company_id', companyId);

    if (category && category !== 'all') {
        const catMap: Record<string, string> = {
            'totem': 'TOTEM',
            'abrigo_caos': 'ABRIGO DE ÔNIBUS CAOS LEVE',
            'abrigo_minimalista': 'ABRIGO DE ÔNIBUS MINIMALISTA LEVE',
            'preventiva': 'MANUTENÇÃO PREVENTIVA',
            'digital': 'INSTALAÇÃO PAINEL DIGITAL'
        };
        deleteQuery = deleteQuery.eq('category', catMap[category as keyof typeof catMap] || category);
    }

    const { error: deleteError } = await deleteQuery;
    if (deleteError) throw deleteError;

    // 2. Map and insert new ones
    const dbPrices = prices.map(p => ({
        id: p.id,
        company_id: companyId,
        category: p.category,
        item_code: p.itemCode,
        description: p.description,
        unit: p.unit,
        price: p.price,
        updated_at: new Date().toISOString()
    }));

    if (dbPrices.length === 0) return;

    const { error: upsertError } = await supabase
        .from('measurement_prices')
        .upsert(dbPrices, { onConflict: 'id,company_id' });

    if (upsertError) throw upsertError;
};


// --- EMPLOYEES & INVITES ---

export const getEmployees = async (companyId: string): Promise<Employee[]> => {
    // 1. Fetch active profiles
    const { data: profiles, error: pError } = await getAllUsers(companyId) as any;
    const activeEmployees: Employee[] = (profiles || []).map((p: User) => ({ ...p, status: 'ACTIVE' }));

    // 2. Fetch pending invites
    let query = supabase.from('employee_invites').select('*');
    if (companyId !== 'internal') {
        query = query.eq('company_id', companyId);
    }
    const { data: invites, error: iError } = await query;

    const pendingEmployees: Employee[] = (invites || []).map(i => ({
        id: i.id,
        name: i.name,
        role: i.role as UserRole,
        companyId: i.company_id,
        companyName: i.company_name,
        avatar: `https://ui-avatars.com/api/?name=${encodeURIComponent(i.name)}&background=random`,
        email: i.email,
        status: 'PENDING',
        shift: i.shift,
        code: i.code,
        leaderName: i.leader_name,
        originalStatus: i.original_status
    }));

    // 3. Merge
    return [...activeEmployees, ...pendingEmployees];
};

export const bulkCreateEmployees = async (employees: Omit<Employee, 'id' | 'status' | 'avatar'>[]): Promise<void> => {
    // We insert into employee_invites
    const dbInvites = employees.map(e => ({
        name: e.name,
        email: e.email,
        role: e.role,
        company_id: e.companyId,
        company_name: e.companyName,
        shift: e.shift,
        code: e.code,
        leader_name: e.leaderName,
        original_status: e.originalStatus
    }));

    const { error } = await supabase.from('employee_invites').insert(dbInvites);

    if (error) throw error;
};

export const createAbsence = async (absence: Omit<Absence, 'id'>): Promise<void> => {
    const { error } = await supabase.from('daily_absences').insert({
        employee_id: absence.employeeId || null,
        employee_name: absence.employeeName,
        date: absence.date,
        end_date: absence.endDate || absence.date,
        reason: absence.reason,
        notes: absence.description,
        company_id: absence.companyId,
        evidence_url: absence.evidenceUrl
    });
    if (error) throw error;
};

export const getAbsences = async (companyId: string): Promise<Absence[]> => {
    let query = supabase.from('daily_absences').select('*');
    if (companyId !== 'internal') {
        query = query.eq('company_id', companyId);
    }
    const { data, error } = await query;
    if (error) throw error;

    return data.map((item: any) => ({
        id: item.id,
        employeeId: item.employee_id,
        employeeName: item.employee_name,
        date: item.date,
        endDate: item.end_date,
        reason: item.reason,
        description: item.notes,
        companyId: item.company_id,
        evidenceUrl: item.evidence_url
    }));
};

export const uploadAbsenceEvidence = async (file: File): Promise<string> => {
    const fileExt = file.name.split('.').pop();
    const fileName = `${Math.random()}.${fileExt}`;
    const filePath = `${fileName}`;

    const { error: uploadError } = await supabase.storage
        .from('absences')
        .upload(filePath, file, { upsert: true });

    if (uploadError) throw uploadError;

    const { data } = supabase.storage
        .from('absences')
        .getPublicUrl(filePath);

    return data.publicUrl;
};


export const deleteEmployeeInvite = async (inviteId: string): Promise<void> => {
    const { error } = await supabase.from('employee_invites').delete().eq('id', inviteId);
    if (error) throw error;
};

export const bulkDeleteInvites = async (inviteIds: string[]): Promise<void> => {
    const { error } = await supabase.from('employee_invites').delete().in('id', inviteIds);
    if (error) throw error;
};

export const getVehicleLogs = async (companyId: string): Promise<VehicleLog[]> => {
    let query = supabase.from('vehicle_control').select('*');
    if (companyId !== 'internal') {
        query = query.eq('company_id', companyId);
    }
    const { data, error } = await query.order('occurrence_time', { ascending: false });
    if (error) return [];
    return data.map(v => ({
        id: v.id,
        userId: v.user_id,
        userName: v.user_name,
        shift: v.shift,
        occurrenceTime: new Date(v.occurrence_time),
        plate: v.plate,
        model: v.model,
        companyId: v.company_id,
        vehicleId: v.vehicle_id,
        startKm: v.start_km,
        endKm: v.end_km,
        isActive: v.is_active,
        checkinTime: v.checkin_time ? new Date(v.checkin_time) : undefined,
        additionalCollaborators: v.additional_collaborators || [],
        createdAt: new Date(v.created_at)
    }));
};

export const createVehicleLog = async (log: Omit<VehicleLog, 'id'>): Promise<void> => {
    const { error } = await supabase.from('vehicle_control').insert({
        user_id: log.userId,
        user_name: log.userName,
        shift: log.shift,
        occurrence_time: log.occurrenceTime.toISOString(),
        plate: log.plate,
        model: log.model,
        company_id: log.companyId,
        vehicle_id: log.vehicleId,
        start_km: log.startKm,
        additional_collaborators: log.additionalCollaborators || [],
        is_active: true
    });

    if (error) throw error;

    // Update vehicle status to 'Em Uso'
    if (log.vehicleId) {
        await supabase.from('vehicles').update({ status: 'Em Uso' }).eq('id', log.vehicleId);
    }
};

export const closeVehicleLog = async (logId: string, vehicleId: string, endKm: number): Promise<void> => {
    const checkinTime = new Date().toISOString();

    // 1. Update the log
    const { error: logError } = await supabase
        .from('vehicle_control')
        .update({
            end_km: endKm,
            checkin_time: checkinTime,
            is_active: false
        })
        .eq('id', logId);

    if (logError) throw logError;

    // 2. Update the vehicle
    const { error: vehicleError } = await supabase
        .from('vehicles')
        .update({
            current_km: endKm,
            status: 'Disponível'
        })
        .eq('id', vehicleId);

    if (vehicleError) throw vehicleError;
};

// --- VEHICLES (FLEET) ---

export const getVehicles = async (companyId: string): Promise<Vehicle[]> => {
    let query = supabase.from('vehicles').select('*');
    if (companyId !== 'internal') {
        query = query.eq('company_id', companyId);
    }
    const { data, error } = await query.order('model', { ascending: true });
    if (error) return [];
    return data.map(v => ({
        id: v.id,
        tag: v.tag,
        model: v.model,
        plate: v.plate,
        companyId: v.company_id,
        currentKm: v.current_km,
        lastMaintenanceKm: v.last_maintenance_km,
        status: v.status as any,
        maintenanceNotes: v.maintenance_notes,
        createdAt: new Date(v.created_at)
    }));
};

export const createVehicle = async (vehicle: Omit<Vehicle, 'id' | 'createdAt'>): Promise<void> => {
    const { error } = await supabase.from('vehicles').insert({
        tag: vehicle.tag,
        model: vehicle.model,
        plate: vehicle.plate.toUpperCase(),
        company_id: vehicle.companyId,
        current_km: vehicle.currentKm,
        last_maintenance_km: vehicle.lastMaintenanceKm,
        status: vehicle.status,
        maintenance_notes: vehicle.maintenanceNotes
    });
    if (error) throw error;
};

export const updateVehicle = async (id: string, updates: Partial<Vehicle>): Promise<void> => {
    const dbUpdates: any = {};
    if (updates.tag !== undefined) dbUpdates.tag = updates.tag;
    if (updates.model) dbUpdates.model = updates.model;
    if (updates.plate) dbUpdates.plate = updates.plate.toUpperCase();
    if (updates.currentKm !== undefined) dbUpdates.current_km = updates.currentKm;
    if (updates.lastMaintenanceKm !== undefined) dbUpdates.last_maintenance_km = updates.lastMaintenanceKm;
    if (updates.status) dbUpdates.status = updates.status;
    if (updates.maintenanceNotes !== undefined) dbUpdates.maintenance_notes = updates.maintenanceNotes;

    const { error } = await supabase.from('vehicles').update(dbUpdates).eq('id', id);
    if (error) throw error;
};

export const deleteVehicle = async (id: string): Promise<void> => {
    const { error } = await supabase.from('vehicles').delete().eq('id', id);
    if (error) throw error;
};

export const bulkDeleteVehicles = async (ids: string[]): Promise<void> => {
    const { error } = await supabase.from('vehicles').delete().in('id', ids);
    if (error) throw error;
};

export const bulkUpsertVehicles = async (vehicles: any[]): Promise<void> => {
    const { error } = await supabase.from('vehicles').upsert(
        vehicles.map(v => ({
            tag: v.tag,
            model: v.model,
            plate: v.plate.toUpperCase(),
            company_id: v.companyId,
            current_km: v.currentKm,
            last_maintenance_km: v.lastMaintenanceKm,
            status: v.status,
            maintenance_notes: v.maintenanceNotes
        })),
        { onConflict: 'plate' }
    );
    if (error) throw error;
};



// --- OPEC MANAGEMENT ---

export const getOpecItems = async (companyId: string): Promise<OpecItem[]> => {
    let query = supabase.from('opec_management').select('*');
    if (companyId !== 'internal') {
        query = query.eq('company_id', companyId);
    }
    const { data, error } = await query.order('assignment_date', { ascending: false });
    if (error) return [];

    return data.map(item => ({
        id: item.id,
        opecName: item.opec_name,
        employeeId: item.employee_id,
        assignmentDate: item.assignment_date,
        companyId: item.company_id,
        createdAt: item.created_at
    }));
};

export const createOpecItem = async (item: Omit<OpecItem, 'id' | 'createdAt'>): Promise<void> => {
    const { error } = await supabase.from('opec_management').insert({
        opec_name: item.opecName,
        employee_id: item.employeeId,
        assignment_date: item.assignmentDate,
        company_id: item.companyId
    });
    if (error) throw error;
};

export const updateOpecItem = async (id: string, updates: Partial<OpecItem>): Promise<void> => {
    const dbUpdates: any = {};
    if (updates.opecName) dbUpdates.opec_name = updates.opecName;
    if (updates.employeeId) dbUpdates.employee_id = updates.employeeId;
    if (updates.assignmentDate) dbUpdates.assignment_date = updates.assignmentDate;

    const { error } = await supabase.from('opec_management').update(dbUpdates).eq('id', id);
    if (error) throw error;
};

export const deleteOpecItem = async (id: string): Promise<void> => {
    const { error } = await supabase.from('opec_management').delete().eq('id', id);
    if (error) throw error;
};

// --- OPEC DEVICES (INVENTORY) ---

export const getOpecDevices = async (companyId: string): Promise<OpecDevice[]> => {
    let query = supabase.from('opec_devices').select('*');
    if (companyId !== 'internal') {
        query = query.eq('company_id', companyId);
    }
    const { data, error } = await query.order('asset_code', { ascending: true });
    if (error) return [];

    return data.map(d => ({
        id: d.id,
        assetCode: d.asset_code,
        phoneNumber: d.phone_number,
        brand: d.brand,
        model: d.model,
        serialNumber: d.serial_number,
        capacity: d.capacity,
        imei1: d.imei_1,
        imei2: d.imei_2,
        observations: d.observations,
        companyId: d.company_id,
        createdAt: d.created_at
    }));
};

export const createOpecDevice = async (device: Omit<OpecDevice, 'id' | 'createdAt'>): Promise<void> => {
    const { error } = await supabase.from('opec_devices').insert({
        asset_code: device.assetCode,
        phone_number: device.phoneNumber,
        brand: device.brand,
        model: device.model,
        serial_number: device.serialNumber,
        capacity: device.capacity,
        imei_1: device.imei1,
        imei_2: device.imei2,
        observations: device.observations,
        company_id: device.companyId
    });
    if (error) throw error;
};

export const updateOpecDevice = async (id: string, updates: Partial<OpecDevice>): Promise<void> => {
    const dbUpdates: any = {};
    if (updates.assetCode !== undefined) dbUpdates.asset_code = updates.assetCode;
    if (updates.phoneNumber !== undefined) dbUpdates.phone_number = updates.phoneNumber;
    if (updates.brand !== undefined) dbUpdates.brand = updates.brand;
    if (updates.model !== undefined) dbUpdates.model = updates.model;
    if (updates.serialNumber !== undefined) dbUpdates.serial_number = updates.serialNumber;
    if (updates.capacity !== undefined) dbUpdates.capacity = updates.capacity;
    if (updates.imei1 !== undefined) dbUpdates.imei_1 = updates.imei1;
    if (updates.imei2 !== undefined) dbUpdates.imei_2 = updates.imei2;
    if (updates.observations !== undefined) dbUpdates.observations = updates.observations;

    const { error } = await supabase.from('opec_devices').update(dbUpdates).eq('id', id);
    if (error) throw error;
};

export const deleteOpecDevice = async (id: string): Promise<void> => {
    const { error } = await supabase.from('opec_devices').delete().eq('id', id);
    if (error) throw error;
};

export const bulkCreateOpecDevices = async (devices: Omit<OpecDevice, 'id' | 'createdAt'>[]): Promise<void> => {
    const { error } = await supabase.from('opec_devices').upsert(
        devices.map(device => ({
            asset_code: device.assetCode,
            phone_number: device.phoneNumber,
            brand: device.brand,
            model: device.model,
            serial_number: device.serialNumber,
            capacity: device.capacity,
            imei_1: device.imei1,
            imei_2: device.imei2,
            observations: device.observations,
            company_id: device.companyId
        })),
        { onConflict: 'asset_code' }
    );
    if (error) throw error;
};
// --- AUDIT LOGS ---

export const getAuditLogs = async (tableName: string, recordId: string): Promise<AuditLog[]> => {
    const { data: logs, error } = await supabase
        .from('audit_logs')
        .select('*')
        .eq('table_name', tableName)
        .eq('record_id', recordId)
        .order('created_at', { ascending: false });

    if (error || !logs) return [];

    // Hydrate user names
    const userIds = Array.from(new Set(logs.map(l => l.user_id).filter(Boolean)));
    if (userIds.length > 0) {
        const { data: profiles } = await supabase
            .from('profiles')
            .select('id, name')
            .in('id', userIds);

        const profileMap = new Map(profiles?.map(p => [p.id, p.name]));
        return logs.map(l => ({
            id: l.id,
            tableName: l.table_name,
            recordId: l.record_id,
            action: l.action,
            oldData: l.old_data,
            newData: l.new_data,
            userId: l.user_id,
            createdAt: new Date(l.created_at),
            userName: profileMap.get(l.user_id) || 'Sistema/Desconhecido'
        }));
    }

    return logs.map(l => ({
        id: l.id,
        tableName: l.table_name,
        recordId: l.record_id,
        action: l.action,
        oldData: l.old_data,
        newData: l.new_data,
        userId: l.user_id,
        createdAt: new Date(l.created_at),
        userName: 'Sistema/Desconhecido'
    }));
};

// --- DAILY REPORTS ---

export const getDailyReports = async (companyId: string, teamId?: string, date?: string): Promise<DailyReport[]> => {
    let query = supabase.from('daily_reports')
        .select('*, daily_activities(*)')
        .order('date', { ascending: false })
        .order('created_at', { ascending: true })
        .order('created_at', { foreignTable: 'daily_activities', ascending: true });

    if (companyId !== 'internal') {
        query = query.eq('company_id', companyId);
    }

    if (teamId) {
        query = query.eq('team_id', teamId);
    }

    if (date) {
        query = query.eq('date', date);
    }

    const { data, error } = await query;
    if (error) return [];

    return data.map(r => ({
        id: r.id,
        date: r.date,
        userId: r.user_id,
        teamId: r.team_id,
        technicianIds: r.technician_ids,
        carPlate: r.car_plate,
        opecId: r.opec_id,
        route: r.route,
        notes: r.notes,
        companyId: r.company_id,
        activities: r.daily_activities.map((a: any) => ({
            id: a.id,
            activityType: a.activity_type,
            quantity: a.quantity,
            assetCodes: a.asset_codes,
            technicianIds: a.technician_ids,
            liderResponsavel: a.lider_responsavel,
            liderName: a.lider_name,
            carPlate: a.car_plate,
            opecId: a.opec_id
        }))
    }));
};

export const getDailyReportsForMonth = async (companyId: string, year: number, month: number): Promise<DailyReport[]> => {
    // Calculate first and last day of the month
    const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
    const lastDay = new Date(year, month, 0).getDate(); // Gets last day of month
    const endDate = `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;

    let query = supabase
        .from('daily_reports')
        .select('*, daily_activities(*)')
        .gte('date', startDate)
        .lte('date', endDate)
        .order('date', { ascending: true })
        .order('created_at', { ascending: true })
        .order('created_at', { foreignTable: 'daily_activities', ascending: true });

    if (companyId !== 'internal') {
        query = query.eq('company_id', companyId);
    }

    const { data, error } = await query;
    if (error) {
        console.error('Error fetching monthly reports:', error);
        return [];
    }
    if (!data) return [];

    return data.map(r => ({
        id: r.id,
        date: r.date,
        userId: r.user_id,
        teamId: r.team_id,
        technicianIds: r.technician_ids,
        carPlate: r.car_plate,
        opecId: r.opec_id,
        route: r.route,
        notes: r.notes,
        companyId: r.company_id,
        activities: (r.daily_activities || []).map((a: any) => ({
            id: a.id,
            activityType: a.activity_type,
            quantity: a.quantity,
            assetCodes: a.asset_codes,
            technicianIds: a.technician_ids,
            liderResponsavel: a.lider_responsavel,
            liderName: a.lider_name,
            carPlate: a.car_plate,
            opecId: a.opec_id
        }))
    }));
};

export const getDailyReportByTeamAndDate = async (
    teamId: string | null,
    date: string,
    technicianIds?: string[],
    userId?: string,
    companyId?: string
): Promise<DailyReport | null> => {
    let query = supabase
        .from('daily_reports')
        .select('*, daily_activities(*)')
        .eq('date', date)
        .order('created_at', { foreignTable: 'daily_activities', ascending: true });

    if (teamId) {
        query = query.eq('team_id', teamId);
    } else {
        // If no team is selected, we are looking for the "ad-hoc" report for THIS user, 
        // specifically for the requested set of technicians.
        query = query.is('team_id', null);
        if (userId) {
            query = query.eq('user_id', userId);
        }
        if (companyId) {
            query = query.eq('company_id', companyId);
        }
        if (technicianIds && technicianIds.length > 0) {
            // Sort IDs to ensure consistent matching regardless of selection order
            query = query.eq('technician_ids', [...technicianIds].sort());
        }
    }

    const { data, error } = await query.maybeSingle();

    if (error || !data) return null;

    return {
        id: data.id,
        date: data.date,
        userId: data.user_id,
        teamId: data.team_id,
        technicianIds: data.technician_ids,
        carPlate: data.car_plate,
        opecId: data.opec_id,
        route: data.route,
        notes: data.notes,
        companyId: data.company_id,
        activities: data.daily_activities.map((a: any) => ({
            id: a.id,
            activityType: a.activity_type,
            quantity: a.quantity,
            assetCodes: a.asset_codes,
            technicianIds: a.technician_ids,
            liderResponsavel: a.lider_responsavel,
            liderName: a.lider_name,
            carPlate: a.car_plate,
            opecId: a.opec_id
        }))
    };
};

export const upsertDailyReport = async (report: Omit<DailyReport, 'id'>, id?: string): Promise<void> => {
    const reportData = {
        date: report.date,
        user_id: report.userId,
        team_id: report.teamId,
        // Sort IDs before saving to ensure consistent lookup later
        technician_ids: report.technicianIds ? [...report.technicianIds].sort() : null,
        car_plate: report.carPlate,
        opec_id: report.opecId,
        route: report.route,
        notes: report.notes,
        company_id: report.companyId
    };

    let reportId = id;

    if (id) {
        const { error } = await supabase.from('daily_reports').update(reportData).eq('id', id);
        if (error) throw error;
    } else {
        const { data, error } = await supabase.from('daily_reports').insert(reportData).select('id').single();
        if (error) {
            // Check for Unique Violation (duplicate key) - likely race condition or state mismatch
            if (error.code === '23505' || error.message.includes('duplicate key') || (error as any).status === 409) {
                // Try to find the existing report ID
                let query = supabase.from('daily_reports').select('id').eq('date', report.date);
                if (report.teamId) {
                    query = query.eq('team_id', report.teamId);
                } else {
                    query = query.is('team_id', null).eq('user_id', report.userId);
                    if (report.technicianIds && report.technicianIds.length > 0) {
                        query = query.eq('technician_ids', [...report.technicianIds].sort());
                    }
                }
                const { data: existingData, error: fetchError } = await query.maybeSingle();

                if (!fetchError && existingData) {
                    reportId = existingData.id;
                    // Retry as update
                    const { error: updateError } = await supabase.from('daily_reports').update(reportData).eq('id', reportId);
                    if (updateError) throw updateError;
                } else {
                    throw error; // If we can't find it, rethrow original error
                }
            } else {
                throw error;
            }
        } else {
            reportId = data.id;
        }
    }

    // REGRA 1: Append-only - NÃO deleta atividades existentes, apenas insere novas
    if (reportId) {
        // Filtra apenas atividades NOVAS (sem id) para inserir
        const newActivities = report.activities.filter(a => !a.id);

        if (newActivities.length > 0) {
            const activitiesData = newActivities.map(a => ({
                report_id: reportId,
                activity_type: a.activityType,
                quantity: a.quantity,
                asset_codes: a.assetCodes,
                technician_ids: a.technicianIds,
                lider_responsavel: report.userId,  // REGRA 3: Rastreabilidade
                lider_name: a.liderName || null,
                car_plate: a.carPlate || null,     // Veículo específico da atividade
                opec_id: a.opecId || null          // OPEC específico da atividade
            }));
            const { error: insertError } = await supabase.from('daily_activities').insert(activitiesData);
            if (insertError) throw insertError;
        }
    }
};


export const deleteAbsence = async (id: string): Promise<void> => {
    const { error } = await supabase.from('daily_absences').delete().eq('id', id);
    if (error) throw error;
};

export const saveAssetMeasurement = async (measurement: AssetMeasurement): Promise<void> => {
    const { error } = await supabase.from('asset_measurements').insert({
        asset_id: measurement.assetId,
        technician_id: measurement.technicianId,
        company_id: measurement.companyId,
        asset_type: measurement.assetType,
        stages: measurement.stages,
        total_value: measurement.totalValue,
        items_snapshot: measurement.itemsSnapshot || [],
        edit_count: measurement.editCount || 0,
        is_paid: measurement.isPaid || false
    });

    if (error) throw error;
};

export const updateAssetMeasurement = async (id: string, measurement: Partial<AssetMeasurement>): Promise<void> => {
    const updates: any = {};
    if (measurement.stages) updates.stages = measurement.stages;
    if (measurement.totalValue !== undefined) updates.total_value = measurement.totalValue;
    if (measurement.itemsSnapshot) updates.items_snapshot = measurement.itemsSnapshot;
    if (measurement.editCount !== undefined) updates.edit_count = measurement.editCount;
    if (measurement.isPaid !== undefined) updates.is_paid = measurement.isPaid;

    const { error } = await supabase
        .from('asset_measurements')
        .update(updates)
        .eq('id', id);

    if (error) throw error;
};

// --- ASSET MEASUREMENTS QUERIES ---

// For partners - get measurements from their own company
export const getAssetMeasurements = async (companyId: string): Promise<AssetMeasurement[]> => {
    const { data: measurements, error } = await supabase
        .from('asset_measurements')
        .select(`
            *,
            profiles!technician_id(name),
            assets!asset_id(code, address)
        `)
        .eq('company_id', companyId)
        .order('created_at', { ascending: false });

    if (error || !measurements) return [];

    // Fallback logic for legacy measurements where asset_id is just the code
    const { data: allAssets } = await supabase.from('assets').select('code, address');
    const assetsByCode = new Map(allAssets?.map(a => [String(a.code).toLowerCase(), a.address]) || []);

    return measurements.map(m => {
        let assetCode = m.assets?.code;
        let assetAddress = m.assets?.address;

        // If join failed, try matching by m.asset_id as code
        if (!assetAddress && m.asset_id) {
            assetAddress = assetsByCode.get(String(m.asset_id).toLowerCase());
        }

        return {
            id: m.id,
            assetId: m.asset_id,
            technicianId: m.technician_id,
            companyId: m.company_id,
            assetType: m.asset_type,
            stages: m.stages || [],
            totalValue: m.total_value,
            itemsSnapshot: m.items_snapshot || [],
            editCount: m.edit_count || 0,
            isPaid: m.is_paid || false,
            createdAt: m.created_at,
            technicianName: m.profiles?.name,
            assetCode: assetCode || m.asset_id, // Fallback to ID which might be the code
            assetAddress: assetAddress
        };
    });
};

// For admin (internal) - get all measurements with optional company filter
export const getAllAssetMeasurements = async (filterCompanyId?: string): Promise<AssetMeasurement[]> => {
    let query = supabase
        .from('asset_measurements')
        .select(`
            *,
            profiles!technician_id(name),
            assets!asset_id(code, address)
        `)
        .order('created_at', { ascending: false });

    if (filterCompanyId && filterCompanyId !== 'all') {
        query = query.eq('company_id', filterCompanyId);
    }

    const { data: measurements, error } = await query;

    if (error || !measurements) return [];

    // Fallback logic for legacy measurements where asset_id is just the code
    const { data: allAssets } = await supabase.from('assets').select('code, address');
    const assetsByCode = new Map(allAssets?.map(a => [String(a.code).toLowerCase(), a.address]) || []);

    return measurements.map(m => {
        let assetCode = m.assets?.code;
        let assetAddress = m.assets?.address;

        // If join failed, try matching by m.asset_id as code
        if (!assetAddress && m.asset_id) {
            assetAddress = assetsByCode.get(String(m.asset_id).toLowerCase());
        }

        return {
            id: m.id,
            assetId: m.asset_id,
            technicianId: m.technician_id,
            companyId: m.company_id,
            assetType: m.asset_type,
            stages: m.stages || [],
            totalValue: m.total_value,
            itemsSnapshot: m.items_snapshot || [],
            editCount: m.edit_count || 0,
            isPaid: m.is_paid || false,
            createdAt: m.created_at,
            technicianName: m.profiles?.name,
            assetCode: assetCode || m.asset_id, // Fallback to ID which might be the code
            assetAddress: assetAddress
        };
    });
};

// --- REGRA 4: Realtime Subscription para Live Feed ---
export const subscribeToDailyActivities = (
    companyId: string,
    date: string,
    onActivityChange: (payload: { eventType: string; activity: DailyActivity; reportId: string }) => void
) => {
    const channel = supabase
        .channel(`daily-activities-${companyId}-${date}`)
        .on('postgres_changes', {
            event: '*',
            schema: 'public',
            table: 'daily_activities'
        }, async (payload) => {
            // Fetch the full activity with report info
            const activity = payload.new as any;
            if (!activity) return;

            // Get the report to check company_id and date
            const { data: report } = await supabase
                .from('daily_reports')
                .select('company_id, date')
                .eq('id', activity.report_id)
                .single();

            if (report && report.company_id === companyId && report.date === date) {
                onActivityChange({
                    eventType: payload.eventType,
                    activity: {
                        id: activity.id,
                        activityType: activity.activity_type,
                        quantity: activity.quantity,
                        assetCodes: activity.asset_codes,
                        technicianIds: activity.technician_ids,
                        liderResponsavel: activity.lider_responsavel,
                        liderName: activity.lider_name
                    },
                    reportId: activity.report_id
                });
            }
        })
        .subscribe();

    return channel;
};

// --- Deletar atividade individual (apenas Chefes via RLS) ---
export const deleteDailyActivity = async (activityId: string): Promise<void> => {
    const { error } = await supabase.from('daily_activities').delete().eq('id', activityId);
    if (error) throw error;
};

// --- Atualizar quantidade de uma atividade existente ---
export const updateDailyActivityQuantity = async (activityId: string, quantity: number): Promise<void> => {
    const { error } = await supabase.from('daily_activities').update({ quantity }).eq('id', activityId);
    if (error) throw error;
};

export const deleteAssetMeasurement = async (measurementId: string): Promise<void> => {
    const { error } = await supabase
        .from('asset_measurements')
        .delete()
        .eq('id', measurementId);

    if (error) throw error;
};

export const bulkDeleteAssetMeasurements = async (measurementIds: string[]): Promise<void> => {
    const { error } = await supabase
        .from('asset_measurements')
        .delete()
        .in('id', measurementIds);

    if (error) throw error;
};

export const upsertAsset = async (asset: any): Promise<string> => {
    // Identify by ID if possible, otherwise by code
    const id = asset.id || `asset_${asset.code || Date.now()}`;

    const dbAsset = {
        id: id,
        code: asset.code || id,
        type: asset.type || 'Abrigo de Ônibus',
        city: asset.city && asset.city !== 'null' ? asset.city : 'São Paulo',
        address: asset.location?.address || asset.address || 'Endereço não informado',
        lat: asset.location?.lat ?? asset.lat ?? -23.5505,
        lng: asset.location?.lng ?? asset.lng ?? -46.6333,
        company_id: asset.company_id || asset.companyId || 'internal'
    };

    const { error } = await supabase.from('assets').upsert(dbAsset, { onConflict: 'id' });
    if (error) {
        console.error('Error in upsertAsset:', error);
        throw error;
    }
    return id;
};
