import { DateTime } from 'luxon';

export interface AvailabilityRuleInput {
  dayOfWeek: number; // 0 (Sunday) .. 6 (Saturday)
  startTime: string; // HH:mm
  endTime: string;   // HH:mm
  isEnabled: boolean;
}

export interface TimeIntervalInput {
  startUtc: Date;
  endUtc: Date;
  bufferMinutes?: number;
}

export interface ComputedSlot {
  startUtc: string;
  endUtc: string;
  startLocal: string;
  endLocal: string;
  label: string;
}

export interface ComputeSlotsParams {
  dateStr: string; // YYYY-MM-DD in clientTimezone
  clientTimezone: string;
  providerTimezone: string;
  availabilityRules: AvailabilityRuleInput[];
  blockedSlots: TimeIntervalInput[];
  existingAppointments: TimeIntervalInput[];
  durationMinutes: number;
  bufferMinutes?: number;
  stepMinutes?: number;
  nowUtc?: Date;
}

export function intervalsOverlap(
  aStartMs: number,
  aEndMs: number,
  bStartMs: number,
  bEndMs: number
): boolean {
  return aStartMs < bEndMs && aEndMs > bStartMs;
}

function parseHhMm(value: string): { hour: number; minute: number } {
  const [hourStr, minuteStr] = value.split(':');
  return {
    hour: Number(hourStr),
    minute: Number(minuteStr),
  };
}

export function isValidTimezone(tz: string): boolean {
  return DateTime.now().setZone(tz).isValid;
}

/**
 * Computes available appointment slots for a given client calendar date (YYYY-MM-DD)
 * by mapping provider availability windows into UTC, intersecting with the client's day,
 * and subtracting blocked intervals, existing appointments, and buffer windows.
 */
export function computeAvailableSlots(params: ComputeSlotsParams): ComputedSlot[] {
  const {
    dateStr,
    clientTimezone,
    providerTimezone,
    availabilityRules,
    blockedSlots,
    existingAppointments,
    durationMinutes,
    bufferMinutes = 0,
    stepMinutes,
    nowUtc = new Date(),
  } = params;

  if (durationMinutes <= 0) {
    return [];
  }

  const clientZone = isValidTimezone(clientTimezone) ? clientTimezone : 'UTC';
  const providerZone = isValidTimezone(providerTimezone) ? providerTimezone : 'UTC';

  const clientDayStart = DateTime.fromISO(dateStr, { zone: clientZone }).startOf('day');
  if (!clientDayStart.isValid) {
    return [];
  }
  const clientDayEnd = clientDayStart.endOf('day');

  const dayStartMs = clientDayStart.toMillis();
  const dayEndMs = clientDayEnd.toMillis();
  const nowMs = nowUtc.getTime();
  const durationMs = durationMinutes * 60_000;
  const requestedBufferMs = Math.max(0, bufferMinutes) * 60_000;
  const effectiveStepMinutes =
    stepMinutes ?? (durationMinutes >= 30 && durationMinutes % 15 === 0 ? 30 : durationMinutes);
  const stepMs = Math.max(5, effectiveStepMinutes) * 60_000;

  // Determine all provider-timezone calendar dates that overlap the client's requested day
  const providerStartDate = clientDayStart.setZone(providerZone).startOf('day');
  const providerEndDate = clientDayEnd.setZone(providerZone).startOf('day');

  const rulesByDay = new Map<number, AvailabilityRuleInput>();
  for (const rule of availabilityRules) {
    if (rule.isEnabled) {
      rulesByDay.set(rule.dayOfWeek, rule);
    }
  }

  const busyIntervals: Array<{ startMs: number; endMs: number }> = [];
  for (const block of blockedSlots) {
    busyIntervals.push({
      startMs: block.startUtc.getTime(),
      endMs: block.endUtc.getTime(),
    });
  }
  for (const appt of existingAppointments) {
    const existingBufMs = Math.max(0, appt.bufferMinutes ?? 0) * 60_000;
    busyIntervals.push({
      startMs: appt.startUtc.getTime() - requestedBufferMs,
      endMs: appt.endUtc.getTime() + Math.max(existingBufMs, requestedBufferMs),
    });
  }

  const slots: ComputedSlot[] = [];
  let cursorDate = providerStartDate;

  while (cursorDate <= providerEndDate) {
    const schemaDayOfWeek = cursorDate.weekday % 7; // Sunday=0 .. Saturday=6
    const rule = rulesByDay.get(schemaDayOfWeek);

    if (rule) {
      const startParts = parseHhMm(rule.startTime);
      const endParts = parseHhMm(rule.endTime);

      const windowStart = cursorDate.set({
        hour: startParts.hour,
        minute: startParts.minute,
        second: 0,
        millisecond: 0,
      });
      const windowEnd = cursorDate.set({
        hour: endParts.hour,
        minute: endParts.minute,
        second: 0,
        millisecond: 0,
      });

      const winStartMs = windowStart.toMillis();
      const winEndMs = windowEnd.toMillis();

      if (winEndMs > winStartMs) {
        let slotStartMs = winStartMs;
        while (slotStartMs + durationMs <= winEndMs) {
          const slotEndMs = slotStartMs + durationMs;

          const withinClientDay = slotStartMs >= dayStartMs && slotStartMs <= dayEndMs;
          const inFuture = slotStartMs > nowMs;

          if (withinClientDay && inFuture) {
            const hasConflict = busyIntervals.some((busy) =>
              intervalsOverlap(slotStartMs, slotEndMs, busy.startMs, busy.endMs)
            );

            if (!hasConflict) {
              const startDt = DateTime.fromMillis(slotStartMs, { zone: clientZone });
              const endDt = DateTime.fromMillis(slotEndMs, { zone: clientZone });
              slots.push({
                startUtc: startDt.toUTC().toISO() ?? '',
                endUtc: endDt.toUTC().toISO() ?? '',
                startLocal: startDt.toISO() ?? '',
                endLocal: endDt.toISO() ?? '',
                label: startDt.toFormat('h:mm a'),
              });
            }
          }

          slotStartMs += stepMs;
        }
      }
    }

    cursorDate = cursorDate.plus({ days: 1 });
  }

  return slots.sort((a, b) => a.startUtc.localeCompare(b.startUtc));
}

