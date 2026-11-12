import { DateTime } from 'luxon';

export interface IcsAppointmentInput {
  referenceCode: string;
  serviceName: string;
  providerName: string;
  clientName: string;
  startUtc: Date;
  endUtc: Date;
  notes?: string;
}

function escapeIcsText(value: string): string {
  return value
    .replace(/\\/g, '\\\\')
    .replace(/\r?\n/g, '\\n')
    .replace(/,/g, '\\,')
    .replace(/;/g, '\\;');
}

function formatIcsUtc(date: Date): string {
  return DateTime.fromJSDate(date, { zone: 'utc' }).toFormat("yyyyMMdd'T'HHmmss'Z'");
}

export function buildAppointmentIcs(input: IcsAppointmentInput): string {
  const nowStamp = formatIcsUtc(new Date());
  const startStamp = formatIcsUtc(input.startUtc);
  const endStamp = formatIcsUtc(input.endUtc);

  const summary = escapeIcsText(`${input.serviceName} with ${input.providerName}`);
  const description = escapeIcsText(
    `Reference: ${input.referenceCode}\nClient: ${input.clientName}\nProvider: ${input.providerName}${
      input.notes ? `\nNotes: ${input.notes}` : ''
    }`
  );

  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Schedulr//Appointment Scheduling System//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${input.referenceCode}@schedulr.local`,
    `DTSTAMP:${nowStamp}`,
    `DTSTART:${startStamp}`,
    `DTEND:${endStamp}`,
    `SUMMARY:${summary}`,
    `DESCRIPTION:${description}`,
    'STATUS:CONFIRMED',
    'END:VEVENT',
    'END:VCALENDAR',
    '',
  ].join('\r\n');
}

