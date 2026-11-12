import type {
  AdminMetrics,
  Appointment,
  AppointmentStatus,
  AvailabilityRule,
  BlockedSlot,
  NotificationItem,
  Provider,
  Service,
  TimeSlot,
  User,
} from '../types';

export class ApiError extends Error {
  status: number;
  code?: string;

  constructor(message: string, status: number, code?: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

const API_ROOT = (import.meta.env.VITE_API_URL || '/api').replace(/\/+$/, '');

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const url = `${API_ROOT}${path.startsWith('/') ? path : `/${path}`}`;
  const res = await fetch(url, {
    ...options,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers ?? {}),
    },
  });

  if (!res.ok) {
    let message = `Request failed (${res.status})`;
    let code: string | undefined;
    try {
      const data = await res.json();
      if (data?.error) message = data.error;
      if (data?.code) code = data.code;
    } catch {
      // Ignore JSON parse failure
    }
    throw new ApiError(message, res.status, code);
  }

  return res.json() as Promise<T>;
}

export const api = {
  auth: {
    me: () => request<{ user: User }>('/auth/me'),
    login: (email: string, password: string) =>
      request<{ user: User }>('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      }),
    register: (payload: {
      name: string;
      email: string;
      password: string;
      phone?: string;
      timezone?: string;
    }) =>
      request<{ user: User }>('/auth/register', {
        method: 'POST',
        body: JSON.stringify(payload),
      }),
    logout: () => request<{ ok: boolean }>('/auth/logout', { method: 'POST' }),
  },
  users: {
    updateMe: (payload: { name?: string; phone?: string | null; timezone?: string }) =>
      request<{ user: User }>('/users/me', {
        method: 'PATCH',
        body: JSON.stringify(payload),
      }),
  },
  services: {
    list: (includeInactive = false) =>
      request<{ services: Service[] }>(
        `/services${includeInactive ? '?includeInactive=true' : ''}`
      ),
    create: (payload: {
      name: string;
      description: string;
      durationMinutes: number;
      bufferMinutes: number;
      priceCents: number;
      providerIds?: string[];
    }) =>
      request<{ service: Service }>('/services', {
        method: 'POST',
        body: JSON.stringify(payload),
      }),
    update: (
      id: string,
      payload: Partial<{
        name: string;
        description: string;
        durationMinutes: number;
        bufferMinutes: number;
        priceCents: number;
        isActive: boolean;
        providerIds: string[];
      }>
    ) =>
      request<{ service: Service }>(`/services/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(payload),
      }),
  },
  providers: {
    list: (serviceId?: string) =>
      request<{ providers: Provider[] }>(
        `/providers${serviceId ? `?serviceId=${encodeURIComponent(serviceId)}` : ''}`
      ),
    get: (id: string) => request<{ provider: Provider }>(`/providers/${id}`),
    create: (payload: {
      name: string;
      email: string;
      password: string;
      timezone: string;
      title: string;
      specialty: string;
      bio: string;
      serviceIds: string[];
    }) =>
      request<{ provider: Provider }>('/providers', {
        method: 'POST',
        body: JSON.stringify(payload),
      }),
    updateAvailability: (id: string, rules: AvailabilityRule[]) =>
      request<{ availabilityRules: AvailabilityRule[] }>(`/providers/${id}/availability`, {
        method: 'PUT',
        body: JSON.stringify({ rules }),
      }),
    addBlockedSlot: (
      id: string,
      payload: { startUtc: string; endUtc: string; reason: string }
    ) =>
      request<{ blockedSlot: BlockedSlot }>(`/providers/${id}/blocked-slots`, {
        method: 'POST',
        body: JSON.stringify(payload),
      }),
    deleteBlockedSlot: (providerId: string, slotId: string) =>
      request<{ ok: boolean }>(`/providers/${providerId}/blocked-slots/${slotId}`, {
        method: 'DELETE',
      }),
  },
  slots: {
    list: (params: { providerId: string; serviceId: string; date: string; tz: string }) =>
      request<{
        date: string;
        timezone: string;
        durationMinutes: number;
        slots: TimeSlot[];
      }>(
        `/slots?providerId=${encodeURIComponent(params.providerId)}&serviceId=${encodeURIComponent(
          params.serviceId
        )}&date=${encodeURIComponent(params.date)}&tz=${encodeURIComponent(params.tz)}`
      ),
  },
  appointments: {
    list: (params?: { status?: string; scope?: string; search?: string }) => {
      const qs = new URLSearchParams();
      if (params?.status) qs.set('status', params.status);
      if (params?.scope) qs.set('scope', params.scope);
      if (params?.search) qs.set('search', params.search);
      const query = qs.toString();
      return request<{ appointments: Appointment[] }>(
        `/appointments${query ? `?${query}` : ''}`
      );
    },
    get: (id: string) => request<{ appointment: Appointment }>(`/appointments/${id}`),
    create: (payload: {
      providerId: string;
      serviceId: string;
      startUtc: string;
      notes?: string;
    }) =>
      request<{ appointment: Appointment }>('/appointments', {
        method: 'POST',
        body: JSON.stringify(payload),
      }),
    reschedule: (id: string, payload: { startUtc: string; note?: string }) =>
      request<{ appointment: Appointment }>(`/appointments/${id}/reschedule`, {
        method: 'PATCH',
        body: JSON.stringify(payload),
      }),
    updateStatus: (
      id: string,
      payload: {
        status: Exclude<AppointmentStatus, 'PENDING'>;
        reason?: string;
      }
    ) =>
      request<{ appointment: Appointment }>(`/appointments/${id}/status`, {
        method: 'PATCH',
        body: JSON.stringify(payload),
      }),
    icsUrl: (id: string) => `${API_ROOT}/appointments/${id}/ics`,
  },
  notifications: {
    list: () =>
      request<{ notifications: NotificationItem[]; unreadCount: number }>('/notifications'),
    markRead: (id: string) =>
      request<{ notification: NotificationItem }>(`/notifications/${id}/read`, {
        method: 'PATCH',
      }),
    markAllRead: () =>
      request<{ ok: boolean }>('/notifications/read-all', { method: 'POST' }),
  },
  admin: {
    metrics: () => request<AdminMetrics>('/admin/metrics'),
  },
};

