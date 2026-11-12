import {
  CalendarPlus,
  Clock,
  Eye,
  Plus,
  RefreshCw,
  Search,
  XCircle,
} from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { AppointmentDetailModal } from '../components/AppointmentDetailModal';
import { RescheduleModal } from '../components/RescheduleModal';
import { StatusBadge } from '../components/StatusBadge';
import { useAuth } from '../context/AuthContext';
import { api } from '../lib/api';
import { formatCurrency, formatDateTime } from '../lib/date';
import type { Appointment } from '../types';

export function ClientDashboardPage() {
  const { user } = useAuth();
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [scope, setScope] = useState<'upcoming' | 'past' | 'all'>('upcoming');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [detailId, setDetailId] = useState<string | null>(null);
  const [rescheduleTarget, setRescheduleTarget] = useState<Appointment | null>(null);

  const loadAppointments = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await api.appointments.list({
        scope,
        status: statusFilter,
        search: search.trim() || undefined,
      });
      setAppointments(res.appointments);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load appointments');
    } finally {
      setLoading(false);
    }
  }, [scope, statusFilter, search]);

  useEffect(() => {
    void loadAppointments();
  }, [loadAppointments]);

  const handleCancel = async (appt: Appointment) => {
    const reason = window.prompt(
      `Cancel appointment ${appt.referenceCode}? Optionally enter a reason:`,
      'Schedule conflict'
    );
    if (reason === null) return;
    setError('');
    try {
      await api.appointments.updateStatus(appt.id, {
        status: 'CANCELLED',
        reason: reason.trim() || 'Cancelled by client',
      });
      await loadAppointments();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not cancel appointment');
    }
  };

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">My Appointments</h1>
          <p className="text-sm text-slate-600">
            Track booking status, reschedule, cancel, or export calendar invites.
          </p>
        </div>
        <Link
          to="/book"
          className="inline-flex items-center gap-1.5 rounded-xl bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-brand-700"
        >
          <Plus className="h-4 w-4" />
          New Appointment
        </Link>
      </div>

      {/* Filters */}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex rounded-xl bg-slate-100 p-1">
          {(['upcoming', 'past', 'all'] as const).map((tab) => (
            <button
              type="button"
              key={tab}
              onClick={() => setScope(tab)}
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold capitalize transition ${
                scope === tab ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>

        <div className="flex flex-1 flex-wrap items-center justify-end gap-2">
          <div className="relative min-w-[200px] flex-1 sm:max-w-xs">
            <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search reference, service, provider..."
              className="w-full rounded-xl border border-slate-200 py-2 pl-9 pr-3 text-sm focus:border-brand-500 focus:outline-none"
            />
          </div>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-700 focus:border-brand-500 focus:outline-none"
          >
            <option value="ALL">All Statuses</option>
            <option value="CONFIRMED">Confirmed</option>
            <option value="PENDING">Pending</option>
            <option value="COMPLETED">Completed</option>
            <option value="CANCELLED">Cancelled</option>
            <option value="NO_SHOW">No Show</option>
          </select>
        </div>
      </div>

      {error && (
        <div className="mb-4 rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div>
      )}

      {loading ? (
        <p className="py-12 text-center text-sm text-slate-500">Loading appointments...</p>
      ) : appointments.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-12 text-center">
          <p className="text-base font-medium text-slate-700">No appointments found</p>
          <p className="mt-1 text-sm text-slate-500">
            Book a new session or switch your filters to view past visits.
          </p>
          <Link
            to="/book"
            className="mt-4 inline-flex items-center gap-1.5 rounded-xl bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700"
          >
            <Plus className="h-4 w-4" />
            Book Now
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {appointments.map((appt) => {
            const isActionable = ['PENDING', 'CONFIRMED'].includes(appt.status);
            return (
              <div
                key={appt.id}
                className="flex flex-col justify-between gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:flex-row sm:items-center"
              >
                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono text-xs font-semibold text-slate-500">
                      {appt.referenceCode}
                    </span>
                    <StatusBadge status={appt.status} />
                  </div>
                  <h3 className="text-base font-semibold text-slate-900">
                    {appt.service.name} with {appt.provider.name}
                  </h3>
                  <p className="flex items-center gap-1.5 text-sm text-slate-600">
                    <Clock className="h-4 w-4 text-brand-600" />
                    {formatDateTime(appt.startUtc, user?.timezone)} ·{' '}
                    {appt.service.durationMinutes} min ·{' '}
                    {formatCurrency(appt.service.priceCents)}
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setDetailId(appt.id)}
                    className="inline-flex items-center gap-1 rounded-xl border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
                  >
                    <Eye className="h-3.5 w-3.5" />
                    Track
                  </button>

                  <a
                    href={api.appointments.icsUrl(appt.id)}
                    className="inline-flex items-center gap-1 rounded-xl border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
                  >
                    <CalendarPlus className="h-3.5 w-3.5" />
                    .ics
                  </a>

                  {isActionable && (
                    <>
                      <button
                        type="button"
                        onClick={() => setRescheduleTarget(appt)}
                        className="inline-flex items-center gap-1 rounded-xl border border-brand-200 bg-brand-50 px-3 py-1.5 text-xs font-medium text-brand-700 hover:bg-brand-100"
                      >
                        <RefreshCw className="h-3.5 w-3.5" />
                        Reschedule
                      </button>
                      <button
                        type="button"
                        onClick={() => handleCancel(appt)}
                        className="inline-flex items-center gap-1 rounded-xl border border-rose-200 bg-rose-50 px-3 py-1.5 text-xs font-medium text-rose-700 hover:bg-rose-100"
                      >
                        <XCircle className="h-3.5 w-3.5" />
                        Cancel
                      </button>
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {detailId && (
        <AppointmentDetailModal
          appointmentId={detailId}
          timezone={user?.timezone}
          onClose={() => setDetailId(null)}
        />
      )}

      {rescheduleTarget && (
        <RescheduleModal
          appointment={rescheduleTarget}
          timezone={user?.timezone}
          onClose={() => setRescheduleTarget(null)}
          onRescheduled={() => {
            setRescheduleTarget(null);
            void loadAppointments();
          }}
        />
      )}
    </div>
  );
}

