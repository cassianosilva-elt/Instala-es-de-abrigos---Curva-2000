
export enum UserRole {
  TECNICO = 'TECNICO',
  LIDER = 'LIDER',
  CHEFE = 'CHEFE',
  PARCEIRO_TECNICO = 'PARCEIRO_TECNICO',
  PARCEIRO_LIDER = 'PARCEIRO_LIDER',
  PARCEIRO_CHEFE = 'PARCEIRO_CHEFE'
}

export enum CompanyType {
  INTERNAL = 'INTERNAL',
  PARTNER = 'PARTNER'
}

export enum AssetType {
  BUS_SHELTER = 'Abrigo de Ônibus',
  TOTEM = 'Totem',
  DIGITAL_PANEL = 'Painel Digital',
  STATIC_PANEL = 'Painel Estático'
}

export enum ServiceType {
  FOUNDATION = 'Fundação',
  INSTALLATION = 'Implantação',
  ENERGIZATION = 'Energização',
  PREVENTIVE = 'Manutenção Preventiva',
  CORRECTIVE = 'Manutenção Corretiva',
  CAMPAIGN_CHANGE = 'Troca de Campanha'
}

export enum TaskStatus {
  PENDING = 'PENDENTE',
  IN_PROGRESS = 'EM ANDAMENTO',
  COMPLETED = 'CONCLUÍDO',
  BLOCKED = 'BLOQUEADO',
  NOT_PERFORMED = 'NÃO REALIZADO'
}

export enum EvidenceStage {
  BEFORE = 'BEFORE',
  DURING = 'DURING',
  AFTER = 'AFTER'
}

export interface Location {
  lat: number;
  lng: number;
  address: string;
}

export interface Company {
  id: string;
  name: string;
  type: CompanyType;
}

export interface User {
  id: string;
  name: string;
  role: UserRole;
  teamId?: string;
  companyId: string;
  companyName: string;
  avatar: string;
  email: string;
  status?: 'ACTIVE' | 'PENDING';
  shift?: string; // 'Turno'
  code?: string; // 'Cadastro'
  leaderName?: string; // 'Lider'
  originalStatus?: string; // 'Status' from import
}

export interface Employee extends User {
  status: 'ACTIVE' | 'PENDING';
  shift?: string;
  code?: string;
  leaderName?: string;
  originalStatus?: string;
}

export interface Team {
  id: string;
  leaderId: string;
  technicianIds: string[];
  name: string;
  companyId: string;
}

export interface Vehicle {
  id: string;
  tag?: string;
  model: string;
  plate: string;
  companyId: string;
  currentKm: number;
  lastMaintenanceKm: number;
  status: 'Disponível' | 'Em Manutenção' | 'Em Uso';
  maintenanceNotes?: string;
  createdAt?: Date;
}


export interface VehicleLog {
  id: string;
  userId: string;
  userName: string;
  shift: string;
  occurrenceTime: Date;
  plate: string;
  model: string;
  companyId: string;
  vehicleId?: string;
  startKm?: number;
  endKm?: number;
  isActive?: boolean;
  checkinTime?: Date;
  additionalCollaborators?: string[];
  createdAt?: Date;
}




export interface Asset {
  id: string;
  code: string;
  type: AssetType;
  location: Location;
  city: string;
  companyId?: string;
}

export interface TaskEvidence {
  id: string;
  taskId: string;
  stage: EvidenceStage;
  photoUrl: string;
  capturedAt: Date;
  gpsLat?: number;
  gpsLng?: number;
  gpsAccuracy?: number;
  syncPending?: boolean;
}

export interface Task {
  id: string;
  assetId: string;
  asset: Asset; // Hydrated asset for ease of UI
  serviceType: ServiceType;
  status: TaskStatus;
  technicianId: string;
  leaderId: string;
  companyId: string;
  scheduledDate: string;
  description: string;
  startedAt?: Date;
  completedAt?: Date;
  blockingReason?: string;
  notPerformedReason?: string;
  evidence?: TaskEvidence[]; // Array of evidences
}

export interface ActivityLog {
  id: string;
  taskId: string;
  userId: string;
  action: string;
  timestamp: Date;
}

export interface ChatMessage {
  id: string;
  senderId: string;
  receiverId: string; // Can be a groupId for broader broadcasts if we add that later
  content: string;
  timestamp: Date;
  read: boolean;
}

export interface ChatConversation {
  id: string;
  participants: string[]; // User IDs
  lastMessage?: ChatMessage;
}

export interface Absence {
  id: string;
  employeeId?: string | null;
  employeeName: string;
  date: string;
  endDate?: string;
  reason: 'Falta Injustificada' | 'Falta Justificada' | 'Day Off' | 'Atestado' | 'Banco de Horas' | 'Férias' | 'Afastamento' | 'Outros';
  description?: string;
  companyId: string;
  evidenceUrl?: string;
}

export interface OpecItem {
  id: string;
  opecName: string;
  employeeId: string;
  assignmentDate: string;
  companyId: string;
  createdAt: string;
  employee?: User; // Hydrated employee for UI
}
export interface AuditLog {
  id: string;
  tableName: string;
  recordId: string;
  action: 'INSERT' | 'UPDATE' | 'DELETE';
  oldData: any;
  newData: any;
  userId: string;
  createdAt: Date;
  userName?: string; // Hydrated for UI
}

export interface OpecDevice {
  id: string;
  assetCode: string;
  phoneNumber?: string;
  brand?: string;
  model?: string;
  serialNumber?: string;
  capacity?: string;
  imei1?: string;
  imei2?: string;
  observations?: string;
  companyId: string;
  createdAt: string;
}

export interface DailyActivity {
  id?: string;
  activityType: string;
  quantity: number;
  assetCodes?: string[];
  technicianIds?: string[]; // IDs of technicians who performed this specific activity
  liderResponsavel?: string;  // ID do líder que registrou (Regra 3)
  liderName?: string;         // Nome do líder (desnormalizado para performance)
  carPlate?: string;          // Veículo usado nesta atividade
  opecId?: string;            // OPEC usado nesta atividade
}


export interface DailyReport {
  id: string;
  date: string;
  userId: string;
  teamId?: string;
  technicianIds?: string[]; // IDs of the "main" team/group for the day (optional now)
  carPlate?: string;
  opecId?: string;
  route?: string;
  notes?: string;
  companyId: string;
  activities: DailyActivity[];
  absences?: Absence[];
}

export interface MeasurementItem {
  stage: string;
  itemCode?: string;
  description: string;
  price: number;
  unit: string;
  quantity: number;
}

export interface AssetMeasurement {
  id?: string;
  assetId: string;
  technicianId: string;
  companyId: string;
  assetType: string;
  stages: string[];
  totalValue: number;
  itemsSnapshot?: MeasurementItem[];
  editCount?: number;
  isPaid?: boolean;
  createdAt?: string;
  technicianName?: string; // Hydrated for UI
  assetCode?: string; // Hydrated for UI
  assetAddress?: string; // Hydrated for UI
}
