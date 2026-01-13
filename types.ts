
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
}

export interface Team {
  id: string;
  leaderId: string;
  technicianIds: string[];
  name: string;
  companyId: string;
}

export interface Asset {
  id: string;
  code: string;
  type: AssetType;
  location: Location;
  city: string;
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
