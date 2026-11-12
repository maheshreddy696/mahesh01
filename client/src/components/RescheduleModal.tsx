import { Calendar, Clock, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import { getBrowserTimezone, getTodayIsoDate } from '../lib/date';
import type { Appointment, TimeSlot } from '../types';

interface RescheduleModalProps {
  appointment: Appointment;
  timezone?: string;
  onClose: () => void;
  onRescheduled: (updated: Appointment) => void;
}

export function RescheduleModal({
  appointment,
  timezone,
  onClose,
  onRescheduled,
}: RescheduleModalProps) {
  const tz = timezone || getBrowserTimezone();
  const [date, setDate] = useState(getTodayIsoDate());
  const [slots, setSlots] = useState<TimeSlot[]>([]);
  const [selectedSlot, setSelectedSlot] = useState<TimeSlot | null>(null);
  const [note, setNote] = useState('');
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    const load = async () => {
      setLoadingSlots(true);
      setError('');
      setSelectedSlot(null);
      try {
        const res = await api.slots.list({
          providerId: appointment.provider.id,
          serviceId: appointment.service.id,
          date,
          tz,
        });
        if (active) setSlots(res.slots);
      } catch (err) {
        if (active) setError(err instanceof Error ? err.message : 'Failed to load slots');
      } finally {
        if (active) setLoadingSlots(false);
      }
    };
    void load();
    return () => {
      active = false;
    };
  }, [appointment.provider.id, appointment.service.id, date, tz]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSlot) return;
    setSubmitting(true);
    setError('');
    try {
      const res = await api.appointments.reschedule(appointment.id, {
        startUtc: selectedSlot.startUtc,
        note: note.trim() || undefined,
      });
      onRescheduled(res.appointment);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not reschedule appointment');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
      <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl">
        <div className="flex items-start justify-between border-b border-slate-100 pb-4">
          <div>
            <h3 className="text-lg font-semibold text-slate-900">Reschedule Appointment</h3>
            <p className="text-sm text-slate-500">
              {appointment.referenceCode} · {appointment.service.name} with{' '}
              {appointment.provider.name}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          <div>
            <label className="mb-1.5 flex items-center gap-1.5 text-sm font-medium text-slate-700">
              <Calendar className="h-4 w-4 text-brand-600" />
              Select New Date ({tz})
            </label>
            <input
              type="date"
              min={getTodayIsoDate()}
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none"
            />
          </div>

          <div>
            <label className="mb-1.5 flex items-center gap-1.5 text-sm font-medium text-slate-700">
              <Clock className="h-4 w-4 text-brand-600" />
              Available Slots
            </label>
            {loadingSlots ? (
              <p className="py-4 text-center text-sm text-slate-500">Checking availability...</p>
            ) : slots.length === 0 ? (
              <p className="rounded-xl border border-dashed border-slate-200 py-4 text-center text-sm text-slate-500">
                No open slots on this date. Try another day.
              </p>
            ) : (
              <div className="grid max-h-48 grid-cols-3 gap-2 overflow-y-auto pr-1">
                {slots.map((slot) => {
                  const selected = selectedSlot?.startUtc === slot.startUtc;
                  return (
                    <button
                      type="button"
                      key={slot.startUtc}
                      onClick={() => setSelectedSlot(slot)}
                      className={`rounded-xl border px-3 py-2 text-sm font-medium transition ${
                        selected
                          ? 'border-brand-600 bg-brand-600 text-white'
                          : 'border-slate-200 bg-white text-slate-700 hover:border-brand-400'
                      }`}
                    >
                      {slot.label}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">
              Reason / Note (optional)
            </label>
            <input
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="e.g., Shifted due to travel conflict"
              className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none"
            />
          </div>

          {error && (
            <div className="rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</div>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!selectedSlot || submitting}
              className="rounded-xl bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50"
            >
              {submitting ? 'Saving...' : 'Confirm Reschedule'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

