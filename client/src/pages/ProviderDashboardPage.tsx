import { CalendarOff, Check, Clock, Eye, Save, Trash2, UserX, XCircle } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { AppointmentDetailModal } from '../components/AppointmentDetailModal';
import { StatusBadge } from '../components/StatusBadge';
import { useAuth } from '../context/AuthContext';
import { api } from '../lib/api';
import { DAY_NAMES, formatDateTime } from '../lib/date';
import type { Appointment, AvailabilityRule, BlockedSlot } from '../types';

const DEFAULT_RULES: AvailabilityRule[] = DAY_NAMES.map((_, dayOfWeek) => ({
  dayOfWeek,
  startTime: '09:00',
  endTime: '17:00',
  isEnabled: dayOfWeek >= 1 && dayOfWeek <= 5,
}));

export function ProviderDashboardPage() {
  const { user } = useAuth();
  const providerId = user?.providerProfile?.id;

  const [tab, setTab] = useState<'agenda' | 'availability' | 'blocked'>('agenda');
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [rules, setRules] = useState<AvailabilityRule[]>(DEFAULT_RULES);
  const [blockedSlots, setBlockedSlots] = useState<BlockedSlot[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [detailId, setDetailId] = useState<string | null>(null);

  const [blockStart, setBlockStart] = useState('');
  const [blockEnd, setBlockEnd] = useState('');
  const [blockReason, setBlockReason] = useState('Personal time off');

  const loadData = useCallback(async () => {
    if (!providerId) return;
    setLoading(true);
    setError('');
    try {
      const [apptsRes, providerRes] = await Promise.all([
        api.appointments.list({ scope: 'all' }),
        api.providers.get(providerId),
      ]);
      setAppointments(apptsRes.appointments);

      const loadedRules = providerRes.provider.availabilityRules;
      if (loadedRules.length > 0) {
        const merged = DEFAULT_RULES.map(
          (def) => loadedRules.find((r) => r.dayOfWeek === def.dayOfWeek) ?? def
        );
        setRules(merged);
      }
      setBlockedSlots(providerRes.provider.blockedSlots ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load provider data');
    } finally {
      setLoading(false);
    }
  }, [providerId]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const handleStatusChange = async (
    apptId: string,
    status: 'CONFIRMED' | 'COMPLETED' | 'NO_SHOW' | 'CANCELLED'
  ) => {
    setError('');
    setMessage('');
    try {
      await api.appointments.updateStatus(apptId, { status });
      setMessage(`Appointment marked as ${status}.`);
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update status');
    }
  };

  const handleSaveRules = async () => {
    if (!providerId) return;
    setError('');
    setMessage('');
    try {
      await api.providers.updateAvailability(providerId, rules);
      setMessage('Weekly availability schedule saved.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save availability');
    }
  };

  const handleAddBlockedSlot = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!providerId || !blockStart || !blockEnd) return;
    setError('');
    setMessage('');
    try {
      await api.providers.addBlockedSlot(providerId, {
        startUtc: new Date(blockStart).toISOString(),
        endUtc: new Date(blockEnd).toISOString(),
        reason: blockReason.trim() || 'Unavailable',
      });
      setBlockStart('');
      setBlockEnd('');
      setMessage('Blocked time-off added.');
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to block time slot');
    }
  };

  const handleDeleteBlocked = async (slotId: string) => {
    if (!providerId) return;
    setError('');
    try {
      await api.providers.deleteBlockedSlot(providerId, slotId);
      setBlockedSlots((prev) => prev.filter((s) => s.id !== slotId));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to remove blocked slot');
    }
  };

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Provider Portal</h1>
          <p className="text-sm text-slate-600">
            {user?.providerProfile?.title} · Schedule timezone:{' '}
            <span className="font-medium text-slate-800">{user?.timezone}</span>
          </p>
        </div>

        <div className="flex rounded-xl bg-slate-100 p-1">
          {[
            { id: 'agenda', label: 'Appointments' },
            { id: 'availability', label: 'Weekly Hours' },
            { id: 'blocked', label: 'Time Off' },
          ].map((item) => (
            <button
              type="button"
              key={item.id}
              onClick={() => setTab(item.id as typeof tab)}
              className={`rounded-lg px-3.5 py-1.5 text-sm font-medium transition ${
                tab === item.id ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600'
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      {message && (
        <div className="mb-4 rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          {message}
        </div>
      )}
      {error && (
        <div className="mb-4 rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div>
      )}

      {loading ? (
        <p className="py-12 text-center text-sm text-slate-500">Loading provider portal...</p>
      ) : tab === 'agenda' ? (
        <div className="space-y-3">
          {appointments.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-12 text-center text-sm text-slate-500">
              No appointments assigned yet.
            </div>
          ) : (
            appointments.map((appt) => {
              const active = ['PENDING', 'CONFIRMED'].includes(appt.status);
              return (
                <div
                  key={appt.id}
                  className="flex flex-col justify-between gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:flex-row sm:items-center"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs font-semibold text-slate-500">
                        {appt.referenceCode}
                      </span>
                      <StatusBadge status={appt.status} />
                    </div>
                    <h3 className="text-base font-semibold text-slate-900">
                      {appt.client.name} — {appt.service.name}
                    </h3>
                    <p className="flex items-center gap-1.5 text-sm text-slate-600">
                      <Clock className="h-4 w-4 text-brand-600" />
                      {formatDateTime(appt.startUtc, user?.timezone)} ({appt.service.durationMinutes}{' '}
                      min)
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setDetailId(appt.id)}
                      className="inline-flex items-center gap-1 rounded-xl border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
                    >
                      <Eye className="h-3.5 w-3.5" />
                      Details
                    </button>
                    {active && (
                      <>
                        <button
                          type="button"
                          onClick={() => handleStatusChange(appt.id, 'COMPLETED')}
                          className="inline-flex items-center gap-1 rounded-xl bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-700"
                        >
                          <Check className="h-3.5 w-3.5" />
                          Complete
                        </button>
                        <button
                          type="button"
                          onClick={() => handleStatusChange(appt.id, 'NO_SHOW')}
                          className="inline-flex items-center gap-1 rounded-xl border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
                        >
                          <UserX className="h-3.5 w-3.5" />
                          No-Show
                        </button>
                        <button
                          type="button"
                          onClick={() => handleStatusChange(appt.id, 'CANCELLED')}
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
            })
          )}
        </div>
      ) : tab === 'availability' ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h2 className="text-base font-semibold text-slate-900">Weekly Working Hours</h2>
              <p className="text-xs text-slate-500">
                Set recurring availability in your timezone ({user?.timezone}).
              </p>
            </div>
            <button
              type="button"
              onClick={handleSaveRules}
              className="inline-flex items-center gap-1.5 rounded-xl bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700"
            >
              <Save className="h-4 w-4" />
              Save Schedule
            </button>
          </div>

          <div className="divide-y divide-slate-100">
            {rules.map((rule, idx) => (
              <div
                key={rule.dayOfWeek}
                className="flex flex-wrap items-center justify-between gap-4 py-3"
              >
                <label className="flex w-36 items-center gap-2.5 text-sm font-medium text-slate-800">
                  <input
                    type="checkbox"
                    checked={rule.isEnabled}
                    onChange={(e) => {
                      const next = [...rules];
                      next[idx] = { ...rule, isEnabled: e.target.checked };
                      setRules(next);
                    }}
                    className="h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
                  />
                  {DAY_NAMES[rule.dayOfWeek]}
                </label>

                <div className="flex items-center gap-2">
                  <input
                    type="time"
                    disabled={!rule.isEnabled}
                    value={rule.startTime}
                    onChange={(e) => {
                      const next = [...rules];
                      next[idx] = { ...rule, startTime: e.target.value };
                      setRules(next);
                    }}
                    className="rounded-xl border border-slate-300 px-3 py-1.5 text-sm disabled:bg-slate-100 disabled:text-slate-400"
                  />
                  <span className="text-sm text-slate-400">to</span>
                  <input
                    type="time"
                    disabled={!rule.isEnabled}
                    value={rule.endTime}
                    onChange={(e) => {
                      const next = [...rules];
                      next[idx] = { ...rule, endTime: e.target.value };
                      setRules(next);
                    }}
                    className="rounded-xl border border-slate-300 px-3 py-1.5 text-sm disabled:bg-slate-100 disabled:text-slate-400"
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="grid gap-6 md:grid-cols-2">
          <form
            onSubmit={handleAddBlockedSlot}
            className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"
          >
            <h2 className="mb-4 flex items-center gap-2 text-base font-semibold text-slate-900">
              <CalendarOff className="h-4 w-4 text-brand-600" />
              Block Time Off
            </h2>
            <div className="space-y-4">
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Start</label>
                <input
                  type="datetime-local"
                  required
                  value={blockStart}
                  onChange={(e) => setBlockStart(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">End</label>
                <input
                  type="datetime-local"
                  required
                  value={blockEnd}
                  onChange={(e) => setBlockEnd(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Reason</label>
                <input
                  type="text"
                  value={blockReason}
                  onChange={(e) => setBlockReason(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
                />
              </div>
              <button
                type="submit"
                className="w-full rounded-xl bg-brand-600 py-2.5 text-sm font-semibold text-white hover:bg-brand-700"
              >
                Add Blocked Slot
              </button>
            </div>
          </form>

          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="mb-4 text-base font-semibold text-slate-900">Upcoming Time Off</h2>
            {blockedSlots.length === 0 ? (
              <p className="text-sm text-slate-500">No upcoming blocked intervals.</p>
            ) : (
              <div className="space-y-2.5">
                {blockedSlots.map((slot) => (
                  <div
                    key={slot.id}
                    className="flex items-center justify-between rounded-xl border border-slate-200 p-3"
                  >
                    <div>
                      <p className="text-sm font-medium text-slate-900">{slot.reason}</p>
                      <p className="text-xs text-slate-500">
                        {formatDateTime(slot.startUtc, user?.timezone)} —{' '}
                        {formatDateTime(slot.endUtc, user?.timezone)}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleDeleteBlocked(slot.id)}
                      className="rounded-lg p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600"
                      aria-label="Remove blocked slot"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {detailId && (
        <AppointmentDetailModal
          appointmentId={detailId}
          timezone={user?.timezone}
          onClose={() => setDetailId(null)}
        />
      )}
    </div>
  );
}

