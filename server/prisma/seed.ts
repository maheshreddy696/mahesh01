import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { DateTime } from 'luxon';

const prisma = new PrismaClient();

async function main() {
  const passwordHash = await bcrypt.hash('Password123!', 10);

  // Clean existing demo data in dependency order for idempotent re-seeding
  await prisma.notification.deleteMany();
  await prisma.appointmentEvent.deleteMany();
  await prisma.appointment.deleteMany();
  await prisma.blockedSlot.deleteMany();
  await prisma.availabilityRule.deleteMany();
  await prisma.providerService.deleteMany();
  await prisma.service.deleteMany();
  await prisma.providerProfile.deleteMany();
  await prisma.user.deleteMany();

  const admin = await prisma.user.create({
    data: {
      name: 'Taylor Morgan',
      email: 'admin@schedulr.local',
      passwordHash,
      role: 'ADMIN',
      timezone: 'UTC',
    },
  });

  const client = await prisma.user.create({
    data: {
      name: 'Jordan Patel',
      email: 'jordan@schedulr.local',
      passwordHash,
      phone: '+1-555-0148',
      role: 'CLIENT',
      timezone: 'America/New_York',
    },
  });

  const mayaUser = await prisma.user.create({
    data: {
      name: 'Dr. Maya Lin',
      email: 'maya@schedulr.local',
      passwordHash,
      phone: '+1-555-0192',
      role: 'PROVIDER',
      timezone: 'America/New_York',
      providerProfile: {
        create: {
          title: 'Principal Wellness & Care Advisor',
          specialty: 'Preventive Care & Diagnostics',
          bio: '12+ years guiding personalized wellness plans and comprehensive consultations.',
          availabilityRules: {
            create: [
              { dayOfWeek: 0, startTime: '09:00', endTime: '17:00', isEnabled: false },
              { dayOfWeek: 1, startTime: '09:00', endTime: '17:00', isEnabled: true },
              { dayOfWeek: 2, startTime: '09:00', endTime: '17:00', isEnabled: true },
              { dayOfWeek: 3, startTime: '09:00', endTime: '17:00', isEnabled: true },
              { dayOfWeek: 4, startTime: '09:00', endTime: '17:00', isEnabled: true },
              { dayOfWeek: 5, startTime: '09:00', endTime: '15:00', isEnabled: true },
              { dayOfWeek: 6, startTime: '09:00', endTime: '17:00', isEnabled: false },
            ],
          },
        },
      },
    },
    include: { providerProfile: true },
  });

  const alexUser = await prisma.user.create({
    data: {
      name: 'Alex Rivera',
      email: 'alex@schedulr.local',
      passwordHash,
      phone: '+1-555-0177',
      role: 'PROVIDER',
      timezone: 'America/New_York',
      providerProfile: {
        create: {
          title: 'Senior Technical & Strategy Coach',
          specialty: 'Architecture & Career Mentoring',
          bio: 'Helps professionals and teams unblock complex systems and plan clear roadmaps.',
          availabilityRules: {
            create: [
              { dayOfWeek: 0, startTime: '10:00', endTime: '14:00', isEnabled: false },
              { dayOfWeek: 1, startTime: '10:00', endTime: '18:00', isEnabled: true },
              { dayOfWeek: 2, startTime: '10:00', endTime: '18:00', isEnabled: true },
              { dayOfWeek: 3, startTime: '10:00', endTime: '18:00', isEnabled: true },
              { dayOfWeek: 4, startTime: '10:00', endTime: '18:00', isEnabled: true },
              { dayOfWeek: 5, startTime: '10:00', endTime: '16:00', isEnabled: false },
              { dayOfWeek: 6, startTime: '10:00', endTime: '14:00', isEnabled: true },
            ],
          },
        },
      },
    },
    include: { providerProfile: true },
  });

  const s1 = await prisma.service.create({
    data: {
      name: 'Initial Consultation',
      description: 'Focused 30-minute discovery session to assess needs and outline next steps.',
      durationMinutes: 30,
      bufferMinutes: 0,
      priceCents: 6000,
    },
  });

  const s2 = await prisma.service.create({
    data: {
      name: 'Comprehensive Review',
      description: 'In-depth 60-minute assessment with personalized recommendations and action plan.',
      durationMinutes: 60,
      bufferMinutes: 15,
      priceCents: 12500,
    },
  });

  const s3 = await prisma.service.create({
    data: {
      name: 'Quick Follow-Up',
      description: '15-minute check-in to review progress or clarify open questions.',
      durationMinutes: 15,
      bufferMinutes: 0,
      priceCents: 3500,
    },
  });

  const s4 = await prisma.service.create({
    data: {
      name: 'Executive Strategy Session',
      description: '45-minute deep-dive coaching session with 15-minute post-session prep buffer.',
      durationMinutes: 45,
      bufferMinutes: 15,
      priceCents: 11000,
    },
  });

  const mayaProfileId = mayaUser.providerProfile!.id;
  const alexProfileId = alexUser.providerProfile!.id;

  await prisma.providerService.createMany({
    data: [
      { providerId: mayaProfileId, serviceId: s1.id },
      { providerId: mayaProfileId, serviceId: s2.id },
      { providerId: mayaProfileId, serviceId: s3.id },
      { providerId: alexProfileId, serviceId: s1.id },
      { providerId: alexProfileId, serviceId: s2.id },
      { providerId: alexProfileId, serviceId: s4.id },
    ],
  });

  // Next weekday at 10:00 AM America/New_York
  let nextWorkday = DateTime.now().setZone('America/New_York').plus({ days: 2 }).startOf('day');
  while (nextWorkday.weekday > 5) {
    nextWorkday = nextWorkday.plus({ days: 1 });
  }

  const upcomingStart = nextWorkday.set({ hour: 10, minute: 0 }).toUTC().toJSDate();
  const upcomingEnd = nextWorkday.set({ hour: 10, minute: 30 }).toUTC().toJSDate();

  const pastStart = DateTime.now()
    .setZone('America/New_York')
    .minus({ days: 5 })
    .set({ hour: 14, minute: 0, second: 0, millisecond: 0 })
    .toUTC()
    .toJSDate();
  const pastEnd = new Date(pastStart.getTime() + 60 * 60_000);

  const upcomingAppt = await prisma.appointment.create({
    data: {
      referenceCode: 'APT-100201',
      clientId: client.id,
      providerId: mayaProfileId,
      serviceId: s1.id,
      startUtc: upcomingStart,
      endUtc: upcomingEnd,
      status: 'CONFIRMED',
      notes: 'Looking forward to discussing onboarding goals.',
      events: {
        create: {
          actorId: client.id,
          fromStatus: null,
          toStatus: 'CONFIRMED',
          note: 'Initial booking confirmed',
        },
      },
    },
  });

  await prisma.appointment.create({
    data: {
      referenceCode: 'APT-100184',
      clientId: client.id,
      providerId: alexProfileId,
      serviceId: s2.id,
      startUtc: pastStart,
      endUtc: pastEnd,
      status: 'COMPLETED',
      notes: 'Quarterly system review.',
      events: {
        create: [
          {
            actorId: client.id,
            fromStatus: null,
            toStatus: 'CONFIRMED',
            note: 'Booked online',
            createdAt: new Date(pastStart.getTime() - 48 * 3_600_000),
          },
          {
            actorId: alexUser.id,
            fromStatus: 'CONFIRMED',
            toStatus: 'COMPLETED',
            note: 'Session completed successfully',
            createdAt: pastEnd,
          },
        ],
      },
    },
  });

  await prisma.notification.createMany({
    data: [
      {
        userId: client.id,
        appointmentId: upcomingAppt.id,
        type: 'BOOKING_CONFIRMED',
        message: `Booking ${upcomingAppt.referenceCode} confirmed with Dr. Maya Lin.`,
      },
      {
        userId: mayaUser.id,
        appointmentId: upcomingAppt.id,
        type: 'BOOKING_CONFIRMED',
        message: `New appointment ${upcomingAppt.referenceCode} scheduled with Jordan Patel.`,
      },
    ],
  });

  console.log(`Seed complete: Admin=${admin.email}, Client=${client.email}`);
}

main()
  .catch((err) => {
    console.error('Seed error:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

