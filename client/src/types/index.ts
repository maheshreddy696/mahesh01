export type UserRole = 'CLIENT' | 'PROVIDER' | 'ADMIN';

export type AppointmentStatus =
  | 'PENDING'
  | 'CONFIRMED'
  | 'COMPLETED'
  | 'CANCELLED'
  | 'NO_SHOW';

export interface User {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  role: UserRole;
  timezone: string;
  providerProfile?: {
    id: string;
    title: string;
    specialty: string;
  } | null;
}

export interface Service {
  id: string;
  name: string;
  description: string;
  durationMinutes: number;
  bufferMinutes: number;
  priceCents: number;
  isActive: boolean;
  providers?: Array<{
    id: string;
    name: string;
    title: string;
  }>;
}

export interface AvailabilityRule {
  id?: string;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  isEnabled: boolean;
}

export interface BlockedSlot {
  id: string;
  providerId: string;
  startUtc: string;
  endUtc: string;
  reason: string;
}

export interface Provider {
  id: string;
  userId: string;
  name: string;
  email: string;
  timezone: string;
  title: string;
  specialty: string;
  bio: string;
  isActive: boolean;
  services: Service[];
  availabilityRules: AvailabilityRule[];
  blockedSlots?: BlockedSlot[];
}

export interface TimeSlot {
  startUtc: string;
  endUtc: string;
  startLocal: string;
  endLocal: string;
  label: string;
}

export interface AppointmentEvent {
  id: string;
  fromStatus: string | null;
  toStatus: string;
  note: string;
  createdAt: string;
  actor: { id: string; name: string; role: UserRole } | null;
}

export interface Appointment {
  id: string;
  referenceCode: string;
  status: AppointmentStatus;
  startUtc: string;
  endUtc: string;
  notes: string;
  cancelReason: string | null;
  createdAt: string;
  updatedAt: string;
  client: {
    id: string;
    name: string;
    email: string;
    phone: string | null;
    timezone: string;
  };
  provider: {
    id: string;
    userId: string;
    name: string;
    title: string;
    specialty: string;
    timezone: string;
  };
  service: {
    id: string;
    name: string;
    durationMinutes: number;
    bufferMinutes: number;
    priceCents: number;
  };
  events?: AppointmentEvent[];
}

export interface NotificationItem {
  id: string;
  userId: string;
  appointmentId: string | null;
  type: string;
  message: string;
  isRead: boolean;
  createdAt: string;
}

export interface AdminMetrics {
  summary: {
    totalAppointments: number;
    totalClients: number;
    activeProviders: number;
    activeServices: number;
    estimatedRevenueCents: number;
    statusCounts: Record<string, number>;
  };
  topProviders: Array<{ name: string; count: number }>;
  topServices: Array<{ name: string; count: number; revenueCents: number }>;
}

