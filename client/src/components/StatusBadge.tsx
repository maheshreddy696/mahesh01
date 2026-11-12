import type { AppointmentStatus } from '../types';

const STATUS_STYLES: Record<AppointmentStatus, string> = {
  PENDING: 'bg-amber-50 text-amber-700 ring-amber-600/20',
  CONFIRMED: 'bg-indigo-50 text-indigo-700 ring-indigo-600/20',
  COMPLETED: 'bg-emerald-50 text-emerald-700 ring-emerald-600/20',
  CANCELLED: 'bg-rose-50 text-rose-700 ring-rose-600/20',
  NO_SHOW: 'bg-slate-100 text-slate-700 ring-slate-500/20',
};

const STATUS_LABELS: Record<AppointmentStatus, string> = {
  PENDING: 'Pending',
  CONFIRMED: 'Confirmed',
  COMPLETED: 'Completed',
  CANCELLED: 'Cancelled',
  NO_SHOW: 'No Show',
};

export function StatusBadge({ status }: { status: AppointmentStatus }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset ${STATUS_STYLES[status]}`}
    >
      {STATUS_LABELS[status]}
    </span>
  );
}

