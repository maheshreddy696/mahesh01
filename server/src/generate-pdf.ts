import fs from 'fs';
import path from 'path';
import PDFDocument from 'pdfkit';

const outputPath1 = path.resolve(__dirname, '../../Appointment_Scheduling_System_Code_Submission.pdf');
const publicDir = path.resolve(__dirname, '../../client/public');
if (!fs.existsSync(publicDir)) {
  fs.mkdirSync(publicDir, { recursive: true });
}
const outputPath2 = path.resolve(publicDir, 'Appointment_Scheduling_System_Code_Submission.pdf');

const doc = new PDFDocument({
  size: 'A4',
  margins: { top: 40, bottom: 40, left: 45, right: 45 },
  bufferPages: true,
});

const stream1 = fs.createWriteStream(outputPath1);
const stream2 = fs.createWriteStream(outputPath2);

doc.pipe(stream1);
doc.pipe(stream2);

// Helpers
function addTitle(text: string) {
  doc.font('Helvetica-Bold').fontSize(18).fillColor('#1e1b4b').text(text, { align: 'center' });
  doc.moveDown(0.2);
}

function addSubtitle(text: string) {
  doc.font('Helvetica').fontSize(10).fillColor('#475569').text(text, { align: 'center' });
  doc.moveDown(0.6);
  doc.strokeColor('#4f46e5').lineWidth(1.5).moveTo(45, doc.y).lineTo(550, doc.y).stroke();
  doc.moveDown(0.8);
}

function addHeading(text: string) {
  doc.moveDown(0.5);
  doc.font('Helvetica-Bold').fontSize(12).fillColor('#312e81').text(text);
  doc.strokeColor('#c7d2fe').lineWidth(0.8).moveTo(45, doc.y + 2).lineTo(300, doc.y + 2).stroke();
  doc.moveDown(0.5);
}

function addParagraph(text: string) {
  doc.font('Helvetica').fontSize(9).fillColor('#334155').text(text, { lineGap: 2 });
  doc.moveDown(0.3);
}

function addCodeBlock(code: string) {
  const startX = 45;
  const width = 505;
  doc.font('Courier').fontSize(7.5).fillColor('#0f172a');
  
  const lines = code.trim().split('\n');
  const height = lines.length * 9.5 + 10;

  if (doc.y + height > 780) {
    doc.addPage();
  }

  const boxY = doc.y;
  doc.rect(startX, boxY, width, height).fillAndStroke('#f8fafc', '#cbd5e1');
  
  doc.fillColor('#0f172a');
  let lineY = boxY + 6;
  for (const line of lines) {
    doc.text(line, startX + 8, lineY, { width: width - 16, lineBreak: false });
    lineY += 9.5;
  }
  doc.y = boxY + height + 8;
}

// ================= PAGE 1 =================
addTitle('Full Stack Appointment Scheduling System (Schedulr)');
addSubtitle('Technical Specification, Core Code Snippets & Viva/Lab Submission Document');

addHeading('1. Project Overview & System Architecture');
addParagraph(
  'Schedulr is an enterprise-grade full-stack Appointment Scheduling System built with React, TypeScript, Tailwind CSS, Node.js, Express, and Prisma ORM. It enables clients to view live timezone-aware availability, book appointments, reschedule within policy limits, and receive RFC 5545 calendar invites (.ics). Providers configure recurring weekly operating hours and ad-hoc time-off blockouts, while administrators oversee platform metrics.'
);

addHeading('2. Database Schema (Prisma Models - SQLite / PostgreSQL)');
addParagraph('Write these core models on paper to illustrate the relational schema and foreign-key constraints:');

addCodeBlock(`// server/prisma/schema.prisma

model User {
  id           String   @id @default(cuid())
  name         String
  email        String   @unique
  passwordHash String
  phone        String?
  role         String   @default("CLIENT") // CLIENT | PROVIDER | ADMIN
  timezone     String   @default("UTC")
  createdAt    DateTime @default(now())

  providerProfile    ProviderProfile?
  clientAppointments Appointment[]      @relation("ClientAppointments")
  notifications      Notification[]
}

model ProviderProfile {
  id        String  @id @default(cuid())
  userId    String  @unique
  title     String
  specialty String
  bio       String  @default("")
  isActive  Boolean @default(true)

  user              User               @relation(fields: [userId], references: [id], onDelete: Cascade)
  services          ProviderService[]
  availabilityRules AvailabilityRule[]
  blockedSlots      BlockedSlot[]
  appointments      Appointment[]      @relation("ProviderAppointments")
}

model Service {
  id              String   @id @default(cuid())
  name            String
  durationMinutes Int
  bufferMinutes   Int      @default(0)
  priceCents      Int      @default(0)
  isActive        Boolean  @default(true)

  providers    ProviderService[]
  appointments Appointment[]
}

model AvailabilityRule {
  id         String  @id @default(cuid())
  providerId String
  dayOfWeek  Int     // 0 (Sun) to 6 (Sat)
  startTime  String  // HH:mm (e.g., "09:00")
  endTime    String  // HH:mm (e.g., "17:00")
  isEnabled  Boolean @default(true)

  provider ProviderProfile @relation(fields: [providerId], references: [id], onDelete: Cascade)
  @@unique([providerId, dayOfWeek])
}

model Appointment {
  id            String   @id @default(cuid())
  referenceCode String   @unique // e.g. APT-8F3K2
  clientId      String
  providerId    String
  serviceId     String
  startUtc      DateTime
  endUtc        DateTime
  status        String   @default("CONFIRMED") // PENDING, CONFIRMED, COMPLETED, CANCELLED, NO_SHOW
  notes         String   @default("")

  client   User            @relation("ClientAppointments", fields: [clientId], references: [id])
  provider ProviderProfile @relation("ProviderAppointments", fields: [providerId], references: [id])
  service  Service         @relation(fields: [serviceId], references: [id])
}`);

// ================= PAGE 2 =================
doc.addPage();
addHeading('3. Core Scheduling Algorithm: Dynamic Slot Calculation Engine');
addParagraph('Computes bookable slots across timezones, filtering out active bookings, buffers, and time-off:');

addCodeBlock(`// server/src/lib/slots.ts

export function computeAvailableSlots(params: ComputeSlotsParams): ComputedSlot[] {
  const { dateStr, clientTimezone, providerTimezone, availabilityRules,
          blockedSlots, existingAppointments, durationMinutes, bufferMinutes = 0, nowUtc = new Date() } = params;

  const clientZone = isValidTimezone(clientTimezone) ? clientTimezone : 'UTC';
  const providerZone = isValidTimezone(providerTimezone) ? providerTimezone : 'UTC';

  const clientDayStart = DateTime.fromISO(dateStr, { zone: clientZone }).startOf('day');
  const clientDayEnd = clientDayStart.endOf('day');
  const durationMs = durationMinutes * 60_000;
  const requestedBufferMs = Math.max(0, bufferMinutes) * 60_000;
  const stepMs = (durationMinutes >= 30 ? 30 : durationMinutes) * 60_000;

  // Build busy intervals
  const busyIntervals: Array<{ startMs: number; endMs: number }> = [];
  for (const block of blockedSlots) {
    busyIntervals.push({ startMs: block.startUtc.getTime(), endMs: block.endUtc.getTime() });
  }
  for (const appt of existingAppointments) {
    const existingBufMs = Math.max(0, appt.bufferMinutes ?? 0) * 60_000;
    busyIntervals.push({
      startMs: appt.startUtc.getTime() - requestedBufferMs,
      endMs: appt.endUtc.getTime() + Math.max(existingBufMs, requestedBufferMs)
    });
  }

  const slots: ComputedSlot[] = [];
  const rulesMap = new Map(availabilityRules.filter(r => r.isEnabled).map(r => [r.dayOfWeek, r]));
  let cursor = clientDayStart.setZone(providerZone).startOf('day');
  const endLimit = clientDayEnd.setZone(providerZone).startOf('day');

  while (cursor <= endLimit) {
    const rule = rulesMap.get(cursor.weekday % 7);
    if (rule) {
      const [sh, sm] = rule.startTime.split(':').map(Number);
      const [eh, em] = rule.endTime.split(':').map(Number);
      const winStart = cursor.set({ hour: sh, minute: sm, second: 0 }).toMillis();
      const winEnd = cursor.set({ hour: eh, minute: em, second: 0 }).toMillis();

      let slotStart = winStart;
      while (slotStart + durationMs <= winEnd) {
        const slotEnd = slotStart + durationMs;
        const withinDay = slotStart >= clientDayStart.toMillis() && slotStart <= clientDayEnd.toMillis();
        const inFuture = slotStart > nowUtc.getTime();

        if (withinDay && inFuture) {
          const conflict = busyIntervals.some(b => slotStart < b.endMs && slotEnd > b.startMs);
          if (!conflict) {
            const dt = DateTime.fromMillis(slotStart, { zone: clientZone });
            slots.push({
              startUtc: dt.toUTC().toISO()!,
              endUtc: DateTime.fromMillis(slotEnd, { zone: clientZone }).toUTC().toISO()!,
              label: dt.toFormat('h:mm a')
            });
          }
        }
        slotStart += stepMs;
      }
    }
    cursor = cursor.plus({ days: 1 });
  }
  return slots;
}`);

addHeading('4. Concurrency & Double-Booking Prevention (Prisma Transaction)');
addParagraph('Transactional booking mutation verifying slot availability before persistence:');

addCodeBlock(`// server/src/routes/appointments.ts

router.post('/', requireAuth, validateBody(createAppointmentSchema), asyncHandler(async (req, res) => {
  const { providerId, serviceId, startUtc: startUtcStr, notes } = req.body;
  const startUtc = new Date(startUtcStr);

  const created = await prisma.$transaction(async (tx) => {
    // Re-verify availability inside the database transaction
    const { provider, service, endUtc } = await assertSlotBookableInTx(tx, { providerId, serviceId, startUtc });
    const referenceCode = \`APT-\${crypto.randomBytes(3).toString('hex').toUpperCase()}\`;

    const appointment = await tx.appointment.create({
      data: {
        referenceCode, clientId: req.user!.userId, providerId, serviceId,
        startUtc, endUtc, status: 'CONFIRMED', notes: notes || '',
        events: { create: { actorId: req.user!.userId, toStatus: 'CONFIRMED', note: 'Booked online' } }
      },
      include: appointmentInclude
    });

    // Generate in-app notifications
    await tx.notification.createMany({
      data: [
        { userId: req.user!.userId, appointmentId: appointment.id, type: 'BOOKING_CONFIRMED', message: \`Booking \${referenceCode} confirmed.\` },
        { userId: provider.userId, appointmentId: appointment.id, type: 'BOOKING_CONFIRMED', message: \`New booking \${referenceCode} received.\` }
      ]
    });
    return appointment;
  });

  res.status(201).json({ appointment: formatAppointment(created) });
}));`);

// ================= PAGE 3 =================
doc.addPage();
addHeading('5. Authentication & Role-Based Access Control (RBAC)');
addParagraph('JWT token validation and authorization guards:');

addCodeBlock(`// server/src/middleware/auth.ts

export function requireAuth(req: Request, _res: Response, next: NextFunction): void {
  const token = req.cookies?.schedulr_token || req.headers.authorization?.replace('Bearer ', '');
  if (!token) return next(new AppError('Authentication required', 401));
  try {
    req.user = verifyToken(token); // Decodes { userId, role, email }
    next();
  } catch {
    next(new AppError('Invalid or expired session', 401));
  }
}

export function requireRole(...roles: Array<'CLIENT' | 'PROVIDER' | 'ADMIN'>) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user || !roles.includes(req.user.role)) {
      return next(new AppError('Forbidden: Insufficient privileges', 403));
    }
    next();
  };
}`);

addHeading('6. Frontend: Client Booking Flow (React + TypeScript)');
addParagraph('Multi-step booking wizard querying live available slots:');

addCodeBlock(`// client/src/pages/BookAppointmentPage.tsx (Core Snippet)

export function BookAppointmentPage() {
  const [selectedService, setSelectedService] = useState<Service | null>(null);
  const [selectedProvider, setSelectedProvider] = useState<Provider | null>(null);
  const [selectedDate, setSelectedDate] = useState<string>(getTodayIsoDate());
  const [slots, setSlots] = useState<TimeSlot[]>([]);
  const [selectedSlot, setSelectedSlot] = useState<TimeSlot | null>(null);

  // Fetch real-time slots whenever provider or date changes
  useEffect(() => {
    if (!selectedService || !selectedProvider) return;
    api.slots.list({
      providerId: selectedProvider.id,
      serviceId: selectedService.id,
      date: selectedDate,
      tz: Intl.DateTimeFormat().resolvedOptions().timeZone
    }).then(res => setSlots(res.slots));
  }, [selectedService, selectedProvider, selectedDate]);

  const handleConfirm = async () => {
    if (!selectedSlot) return;
    const res = await api.appointments.create({
      providerId: selectedProvider!.id,
      serviceId: selectedService!.id,
      startUtc: selectedSlot.startUtc
    });
    alert(\`Confirmed! Tracking Code: \${res.appointment.referenceCode}\`);
  };

  return (
    <div className="max-w-3xl mx-auto p-6 space-y-4">
      <h2 className="text-xl font-bold">Pick an Available Time Slot</h2>
      <input type="date" value={selectedDate} onChange={e => setSelectedDate(e.target.value)} />
      <div className="grid grid-cols-4 gap-2">
        {slots.map(s => (
          <button key={s.startUtc} onClick={() => setSelectedSlot(s)}
            className={selectedSlot?.startUtc === s.startUtc ? "bg-indigo-600 text-white p-2 rounded" : "border p-2 rounded"}>
            {s.label}
          </button>
        ))}
      </div>
      <button onClick={handleConfirm} disabled={!selectedSlot} className="bg-indigo-600 text-white px-6 py-2 rounded">
        Confirm Booking
      </button>
    </div>
  );
}`);

addHeading('7. Verification Test Suite (Vitest Execution)');
addParagraph('Automated tests asserting slot intervals and buffer rejection:');

addCodeBlock(`// server/tests/slots.test.ts

describe('computeAvailableSlots', () => {
  it('generates expected 30-minute slots for open morning window', () => {
    const slots = computeAvailableSlots({
      dateStr: '2026-11-16', clientTimezone: 'UTC', providerTimezone: 'UTC',
      availabilityRules: [{ dayOfWeek: 1, startTime: '09:00', endTime: '11:00', isEnabled: true }],
      blockedSlots: [], existingAppointments: [], durationMinutes: 30
    });
    expect(slots.map(s => s.startUtc)).toEqual([
      '2026-11-16T09:00:00.000Z', '2026-11-16T09:30:00.000Z',
      '2026-11-16T10:00:00.000Z', '2026-11-16T10:30:00.000Z'
    ]);
  });
});`);

// Page numbering
const range = doc.bufferedPageRange();
for (let i = range.start; i < range.start + range.count; i++) {
  doc.switchToPage(i);
  doc.font('Helvetica').fontSize(8).fillColor('#94a3b8');
  doc.text(
    `Full Stack Appointment Scheduling System • Submission Record • Page ${i + 1} of ${range.count}`,
    45,
    800,
    { align: 'center', width: 505 }
  );
}

doc.end();

stream1.on('finish', () => {
  console.log(`Generated PDF 1: ${outputPath1}`);
});
stream2.on('finish', () => {
  console.log(`Generated PDF 2: ${outputPath2}`);
});

