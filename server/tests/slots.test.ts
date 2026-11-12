import { describe, expect, it } from 'vitest';
import { buildAppointmentIcs } from '../src/lib/ics';
import { computeAvailableSlots } from '../src/lib/slots';

describe('computeAvailableSlots', () => {
  const mondayRules = [
    { dayOfWeek: 1, startTime: '09:00', endTime: '12:00', isEnabled: true },
  ];

  it('generates expected 30-minute slots for an open morning window', () => {
    // 2026-11-16 is a Monday
    const slots = computeAvailableSlots({
      dateStr: '2026-11-16',
      clientTimezone: 'UTC',
      providerTimezone: 'UTC',
      availabilityRules: mondayRules,
      blockedSlots: [],
      existingAppointments: [],
      durationMinutes: 30,
      bufferMinutes: 0,
      nowUtc: new Date('2026-11-16T08:00:00Z'),
    });

    expect(slots.map((s) => s.startUtc)).toEqual([
      '2026-11-16T09:00:00.000Z',
      '2026-11-16T09:30:00.000Z',
      '2026-11-16T10:00:00.000Z',
      '2026-11-16T10:30:00.000Z',
      '2026-11-16T11:00:00.000Z',
      '2026-11-16T11:30:00.000Z',
    ]);
  });

  it('excludes blocked ranges, existing appointments, buffers, and past slots', () => {
    const slots = computeAvailableSlots({
      dateStr: '2026-11-16',
      clientTimezone: 'UTC',
      providerTimezone: 'UTC',
      availabilityRules: mondayRules,
      blockedSlots: [
        {
          startUtc: new Date('2026-11-16T11:00:00Z'),
          endUtc: new Date('2026-11-16T12:00:00Z'),
        },
      ],
      existingAppointments: [
        {
          startUtc: new Date('2026-11-16T09:30:00Z'),
          endUtc: new Date('2026-11-16T10:00:00Z'),
          bufferMinutes: 15,
        },
      ],
      durationMinutes: 30,
      bufferMinutes: 0,
      nowUtc: new Date('2026-11-16T09:05:00Z'), // 09:00 is in the past
    });

    // 09:00 past; 09:30 booked; 10:00 overlaps 15m post-buffer (until 10:15);
    // 10:30 free; 11:00-12:00 blocked.
    expect(slots.map((s) => s.startUtc)).toEqual(['2026-11-16T10:30:00.000Z']);
  });

  it('converts provider availability accurately across timezones', () => {
    // Provider in America/New_York (EST = UTC-5 in Nov) works 09:00-11:00 -> 14:00-16:00 UTC
    // Client in Asia/Kolkata (IST = UTC+5:30) sees 19:30-21:30 IST on 2026-11-16
    const slots = computeAvailableSlots({
      dateStr: '2026-11-16',
      clientTimezone: 'Asia/Kolkata',
      providerTimezone: 'America/New_York',
      availabilityRules: [
        { dayOfWeek: 1, startTime: '09:00', endTime: '11:00', isEnabled: true },
      ],
      blockedSlots: [],
      existingAppointments: [],
      durationMinutes: 60,
      stepMinutes: 60,
      nowUtc: new Date('2026-11-16T00:00:00Z'),
    });

    expect(slots).toHaveLength(2);
    expect(slots[0].startUtc).toBe('2026-11-16T14:00:00.000Z');
    expect(slots[0].label).toBe('7:30 PM');
    expect(slots[1].startUtc).toBe('2026-11-16T15:00:00.000Z');
    expect(slots[1].label).toBe('8:30 PM');
  });
});

describe('buildAppointmentIcs', () => {
  it('produces valid VCALENDAR content with escaped fields', () => {
    const ics = buildAppointmentIcs({
      referenceCode: 'APT-ABC123',
      serviceName: 'Initial Consultation',
      providerName: 'Dr. Maya Lin',
      clientName: 'Jordan Patel',
      startUtc: new Date('2026-11-16T14:00:00Z'),
      endUtc: new Date('2026-11-16T14:30:00Z'),
      notes: 'Bring notes, please',
    });

    expect(ics).toContain('BEGIN:VCALENDAR');
    expect(ics).toContain('UID:APT-ABC123@schedulr.local');
    expect(ics).toContain('DTSTART:20261116T140000Z');
    expect(ics).toContain('DTEND:20261116T143000Z');
    expect(ics).toContain('SUMMARY:Initial Consultation with Dr. Maya Lin');
    expect(ics).toContain('Bring notes\\, please');
    expect(ics).toContain('END:VCALENDAR');
  });
});

