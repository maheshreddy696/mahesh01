import { Calendar, CalendarPlus, CheckCircle2, Clock, User } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { api } from '../lib/api';
import {
  formatCurrency,
  formatDateTime,
  getBrowserTimezone,
  getTodayIsoDate,
} from '../lib/date';
import type { Appointment, Provider, Service, TimeSlot } from '../types';

export function BookAppointmentPage() {
  const { user } = useAuth();
  const tz = user?.timezone || getBrowserTimezone();

  const [services, setServices] = useState<Service[]>([]);
  const [providers, setProviders] = useState<Provider[]>([]);
  const [slots, setSlots] = useState<TimeSlot[]>([]);

  const [selectedService, setSelectedService] = useState<Service | null>(null);
  const [selectedProvider, setSelectedProvider] = useState<Provider | null>(null);
  const [selectedDate, setSelectedDate] = useState(getTodayIsoDate());
  const [selectedSlot, setSelectedSlot] = useState<TimeSlot | null>(null);
  const [notes, setNotes] = useState('');

  const [loadingInit, setLoadingInit] = useState(true);
  const [loadingProviders, setLoadingProviders] = useState(false);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [confirmedAppt, setConfirmedAppt] = useState<Appointment | null>(null);

  useEffect(() => {
    const loadServices = async () => {
      try {
        const res = await api.services.list();
        setServices(res.services);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load services');
      } finally {
        setLoadingInit(false);
      }
    };
    void loadServices();
  }, []);

  useEffect(() => {
    if (!selectedService) {
      setProviders([]);
      return;
    }
    const loadProviders = async () => {
      setLoadingProviders(true);
      setSelectedProvider(null);
      setSelectedSlot(null);
      try {
        const res = await api.providers.list(selectedService.id);
        setProviders(res.providers);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load providers');
      } finally {
        setLoadingProviders(false);
      }
    };
    void loadProviders();
  }, [selectedService]);

  useEffect(() => {
    if (!selectedService || !selectedProvider) {
      setSlots([]);
      return;
    }
    const loadSlots = async () => {
      setLoadingSlots(true);
      setSelectedSlot(null);
      setError('');
      try {
        const res = await api.slots.list({
          providerId: selectedProvider.id,
          serviceId: selectedService.id,
          date: selectedDate,
          tz,
        });
        setSlots(res.slots);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to fetch available slots');
      } finally {
        setLoadingSlots(false);
      }
    };
    void loadSlots();
  }, [selectedService, selectedProvider, selectedDate, tz]);

  const handleConfirmBooking = async () => {
    if (!selectedService || !selectedProvider || !selectedSlot) return;
    setSubmitting(true);
    setError('');
    try {
      const res = await api.appointments.create({
        providerId: selectedProvider.id,
        serviceId: selectedService.id,
        startUtc: selectedSlot.startUtc,
        notes: notes.trim() || undefined,
      });
      setConfirmedAppt(res.appointment);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Booking failed');
    } finally {
      setSubmitting(false);
    }
  };

  if (confirmedAppt) {
    return (
      <div className="mx-auto max-w-xl px-4 py-12">
        <div className="rounded-2xl border border-emerald-200 bg-white p-8 text-center shadow-sm">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
            <CheckCircle2 className="h-8 w-8" />
          </div>
          <h2 className="text-2xl font-bold text-slate-900">Appointment Confirmed!</h2>
          <p className="mt-1 text-sm text-slate-500">
            Reference Code:{' '}
            <span className="font-mono font-semibold text-slate-900">
              {confirmedAppt.referenceCode}
            </span>
          </p>

          <div className="mt-6 space-y-2 rounded-xl bg-slate-50 p-4 text-left text-sm">
            <p>
              <span className="font-medium text-slate-600">Service:</span>{' '}
              {confirmedAppt.service.name}
            </p>
            <p>
              <span className="font-medium text-slate-600">Provider:</span>{' '}
              {confirmedAppt.provider.name}
            </p>
            <p>
              <span className="font-medium text-slate-600">Date & Time:</span>{' '}
              {formatDateTime(confirmedAppt.startUtc, tz)} ({tz})
            </p>
          </div>

          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <a
              href={api.appointments.icsUrl(confirmedAppt.id)}
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              <CalendarPlus className="h-4 w-4 text-brand-600" />
              Add to Calendar (.ics)
            </a>
            <Link
              to="/appointments"
              className="rounded-xl bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700"
            >
              Track My Appointments
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-900">Book an Appointment</h1>
        <p className="mt-1 text-sm text-slate-600">
          Select a service, choose your provider, and pick an available slot in your timezone (
          <span className="font-medium text-slate-800">{tz}</span>).
        </p>
      </div>

      {error && (
        <div className="mb-6 rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div>
      )}

      <div className="space-y-8">
        {/* Step 1: Service */}
        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="mb-4 text-base font-semibold text-slate-900">1. Choose a Service</h2>
          {loadingInit ? (
            <p className="text-sm text-slate-500">Loading services...</p>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {services.map((service) => {
                const active = selectedService?.id === service.id;
                return (
                  <button
                    type="button"
                    key={service.id}
                    onClick={() => setSelectedService(service)}
                    className={`rounded-xl border p-4 text-left transition ${
                      active
                        ? 'border-brand-600 bg-brand-50/50 ring-2 ring-brand-600/20'
                        : 'border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <span className="font-semibold text-slate-900">{service.name}</span>
                      <span className="rounded-lg bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-700">
                        {formatCurrency(service.priceCents)}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-slate-600">{service.description}</p>
                    <p className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-brand-700">
                      <Clock className="h-3.5 w-3.5" />
                      {service.durationMinutes} min
                    </p>
                  </button>
                );
              })}
            </div>
          )}
        </section>

        {/* Step 2: Provider */}
        {selectedService && (
          <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="mb-4 text-base font-semibold text-slate-900">2. Select a Provider</h2>
            {loadingProviders ? (
              <p className="text-sm text-slate-500">Loading providers...</p>
            ) : providers.length === 0 ? (
              <p className="text-sm text-slate-500">
                No providers are currently assigned to this service.
              </p>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2">
                {providers.map((provider) => {
                  const active = selectedProvider?.id === provider.id;
                  return (
                    <button
                      type="button"
                      key={provider.id}
                      onClick={() => setSelectedProvider(provider)}
                      className={`rounded-xl border p-4 text-left transition ${
                        active
                          ? 'border-brand-600 bg-brand-50/50 ring-2 ring-brand-600/20'
                          : 'border-slate-200 hover:border-slate-300'
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        <span className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-100 text-brand-700">
                          <User className="h-4 w-4" />
                        </span>
                        <div>
                          <p className="font-semibold text-slate-900">{provider.name}</p>
                          <p className="text-xs text-slate-500">{provider.title}</p>
                        </div>
                      </div>
                      <p className="mt-2 text-xs text-slate-600">{provider.bio}</p>
                    </button>
                  );
                })}
              </div>
            )}
          </section>
        )}

        {/* Step 3: Date & Slots */}
        {selectedService && selectedProvider && (
          <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="mb-4 text-base font-semibold text-slate-900">
              3. Pick a Date & Time Slot
            </h2>
            <div className="grid gap-6 md:grid-cols-[240px_1fr]">
              <div>
                <label className="mb-1.5 flex items-center gap-1.5 text-sm font-medium text-slate-700">
                  <Calendar className="h-4 w-4 text-brand-600" />
                  Date
                </label>
                <input
                  type="date"
                  min={getTodayIsoDate()}
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none"
                />
                <p className="mt-2 text-xs text-slate-500">
                  Provider schedule timezone: {selectedProvider.timezone}
                </p>
              </div>

              <div>
                <p className="mb-2 text-sm font-medium text-slate-700">
                  Available Times ({tz})
                </p>
                {loadingSlots ? (
                  <p className="py-6 text-sm text-slate-500">Loading available time slots...</p>
                ) : slots.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-slate-200 p-6 text-center text-sm text-slate-500">
                    No open slots on {selectedDate}. Please pick another date.
                  </div>
                ) : (
                  <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                    {slots.map((slot) => {
                      const active = selectedSlot?.startUtc === slot.startUtc;
                      return (
                        <button
                          type="button"
                          key={slot.startUtc}
                          onClick={() => setSelectedSlot(slot)}
                          className={`rounded-xl border px-3 py-2 text-sm font-medium transition ${
                            active
                              ? 'border-brand-600 bg-brand-600 text-white shadow-sm'
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
            </div>
          </section>
        )}

        {/* Step 4: Notes & Confirm */}
        {selectedService && selectedProvider && selectedSlot && (
          <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="mb-4 text-base font-semibold text-slate-900">4. Review & Confirm</h2>
            <div className="mb-4 rounded-xl bg-slate-50 p-4 text-sm text-slate-700">
              <p>
                <span className="font-semibold text-slate-900">{selectedService.name}</span> with{' '}
                <span className="font-semibold text-slate-900">{selectedProvider.name}</span>
              </p>
              <p className="mt-1 text-slate-600">
                {formatDateTime(selectedSlot.startUtc, tz)} ({selectedService.durationMinutes} min ·{' '}
                {formatCurrency(selectedService.priceCents)})
              </p>
            </div>

            <div className="mb-4">
              <label className="mb-1 block text-sm font-medium text-slate-700">
                Appointment Notes (optional)
              </label>
              <textarea
                rows={3}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Share context, goals, or preparation questions..."
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none"
              />
            </div>

            <div className="flex justify-end">
              <button
                type="button"
                disabled={submitting}
                onClick={handleConfirmBooking}
                className="rounded-xl bg-brand-600 px-6 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-brand-700 disabled:opacity-50"
              >
                {submitting ? 'Confirming...' : 'Confirm Appointment'}
              </button>
            </div>
          </section>
        )}
      </div>
    </div>
  );
}

