import { CalendarPlus, Clock, History, User, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import { formatCurrency, formatDateTime } from '../lib/date';
import type { Appointment } from '../types';
import { StatusBadge } from './StatusBadge';

interface AppointmentDetailModalProps {
  appointmentId: string;
  timezone?: string;
  onClose: () => void;
}

export function AppointmentDetailModal({
  appointmentId,
  timezone,
  onClose,
}: AppointmentDetailModalProps) {
  const [appointment, setAppointment] = useState<Appointment | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    const load = async () => {
      setLoading(true);
      try {
        const res = await api.appointments.get(appointmentId);
        if (active) setAppointment(res.appointment);
      } catch (err) {
        if (active) setError(err instanceof Error ? err.message : 'Failed to load details');
      } finally {
        if (active) setLoading(false);
      }
    };
    void load();
    return () => {
      active = false;
    };
  }, [appointmentId]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
      <div className="max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-2xl bg-white p-6 shadow-xl">
        <div className="flex items-start justify-between border-b border-slate-100 pb-4">
          <div>
            <h3 className="text-lg font-semibold text-slate-900">Appointment Tracking</h3>
            {appointment && (
              <p className="text-sm text-slate-500">Reference {appointment.referenceCode}</p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {loading && <p className="py-8 text-center text-sm text-slate-500">Loading details...</p>}
        {error && (
          <div className="mt-4 rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</div>
        )}

        {appointment && (
          <div className="mt-4 space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-slate-50 p-4">
              <div>
                <p className="text-base font-semibold text-slate-900">
                  {appointment.service.name}
                </p>
                <p className="text-sm text-slate-600">
                  {appointment.service.durationMinutes} min ·{' '}
                  {formatCurrency(appointment.service.priceCents)}
                </p>
              </div>
              <StatusBadge status={appointment.status} />
            </div>

            <div className="grid gap-3 text-sm sm:grid-cols-2">
              <div className="rounded-xl border border-slate-200 p-3">
                <p className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-slate-400">
                  <Clock className="h-3.5 w-3.5" /> Scheduled Time
                </p>
                <p className="mt-1 font-medium text-slate-900">
                  {formatDateTime(appointment.startUtc, timezone)}
                </p>
              </div>
              <div className="rounded-xl border border-slate-200 p-3">
                <p className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-slate-400">
                  <User className="h-3.5 w-3.5" /> Provider
                </p>
                <p className="mt-1 font-medium text-slate-900">{appointment.provider.name}</p>
                <p className="text-xs text-slate-500">{appointment.provider.title}</p>
              </div>
            </div>

            {appointment.notes && (
              <div className="rounded-xl border border-slate-200 p-3 text-sm">
                <p className="text-xs font-medium uppercase tracking-wide text-slate-400">Notes</p>
                <p className="mt-1 text-slate-700">{appointment.notes}</p>
              </div>
            )}

            {appointment.cancelReason && (
              <div className="rounded-xl bg-rose-50 p-3 text-sm text-rose-800">
                <span className="font-semibold">Cancellation Reason:</span>{' '}
                {appointment.cancelReason}
              </div>
            )}

            <div>
              <h4 className="mb-3 flex items-center gap-1.5 text-sm font-semibold text-slate-900">
                <History className="h-4 w-4 text-brand-600" />
                Status Timeline
              </h4>
              <ol className="space-y-3 border-l-2 border-slate-200 pl-4">
                {(appointment.events ?? []).map((ev) => (
                  <li key={ev.id} className="relative">
                    <span className="absolute -left-[21px] top-1.5 h-2.5 w-2.5 rounded-full bg-brand-600 ring-4 ring-white" />
                    <p className="text-sm font-medium text-slate-900">
                      {ev.fromStatus ? `${ev.fromStatus} -> ${ev.toStatus}` : ev.toStatus}
                    </p>
                    {ev.note && <p className="text-xs text-slate-600">{ev.note}</p>}
                    <p className="mt-0.5 text-[11px] text-slate-400">
                      {formatDateTime(ev.createdAt, timezone)}
                      {ev.actor ? ` · by ${ev.actor.name}` : ''}
                    </p>
                  </li>
                ))}
              </ol>
            </div>

            <div className="flex items-center justify-between border-t border-slate-100 pt-4">
              <a
                href={api.appointments.icsUrl(appointment.id)}
                className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                <CalendarPlus className="h-4 w-4 text-brand-600" />
                Download .ics Calendar Invite
              </a>
              <button
                type="button"
                onClick={onClose}
                className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
              >
                Close
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

