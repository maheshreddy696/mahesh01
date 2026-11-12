# Appointment Scheduling System

A full-stack **Appointment Scheduling System** built with **React, TypeScript, Tailwind CSS, Node.js, Express, and Prisma (SQLite / PostgreSQL-ready)**. It enables clients to discover services and book available time slots, providers to manage weekly availability and appointment lifecycles, and admins to oversee services, providers, and utilization metrics.

## Features

- **Role-Based Access Control (RBAC)**:
  - **Client**: Browse services & providers, real-time timezone-aware slot picker, 4-step booking wizard, track appointment lifecycle timeline, reschedule/cancel within policy window, and download `.ics` calendar invites.
  - **Provider**: Interactive day/agenda appointment queue, confirm/complete/no-show/cancel actions, weekly recurring availability editor, and ad-hoc time-off / blocked-slot management.
  - **Admin**: Utilization analytics dashboard, service catalog CRUD, provider management, and full appointment directory.
- **Real-Time Slot Engine**:
  - Computes bookable slots dynamically from provider weekly availability, subtracting blocked time-off, active appointments, and service buffer times, while filtering out past slots.
- **Double-Booking Prevention**:
  - Bookings and reschedules execute inside a Prisma database transaction that validates overlap conflicts before writing (`409 Conflict` on race conditions).
- **Audit Trail & In-App Notifications**:
  - Every status change records an immutable `AppointmentEvent` entry and generates in-app notifications for affected users.

## Project Structure

```text
├── server/          # Express + TypeScript REST API, Prisma schema & seed, Vitest suite
└── client/          # React + Vite + TypeScript + Tailwind CSS frontend
```

## Getting Started (Requires Node.js 18+)

1. **Install dependencies**:
   ```bash
   npm run install:all
   ```

2. **Configure environment variables**:
   ```bash
   copy server\.env.example server\.env
   ```

3. **Initialize database & seed demo data**:
   ```bash
   npm run db:migrate
   npm run db:seed
   ```

4. **Start both backend and frontend**:
   ```bash
   npm run dev
   ```
   - Frontend: `http://localhost:5173`
   - Backend API: `http://localhost:4000`

5. **Run automated tests**:
   ```bash
   npm test
   ```

## Demo Credentials (from seed)

| Role | Email | Password |
| :--- | :--- | :--- |
| **Admin** | `admin@schedulr.local` | `Password123!` |
| **Provider (Dr. Maya Lin)** | `maya@schedulr.local` | `Password123!` |
| **Provider (Alex Rivera)** | `alex@schedulr.local` | `Password123!` |
| **Client (Jordan Patel)** | `jordan@schedulr.local` | `Password123!` |

## Key API Endpoints

- `POST /api/auth/register`, `POST /api/auth/login`, `POST /api/auth/logout`, `GET /api/auth/me`
- `PATCH /api/users/me`
- `GET/POST/PATCH /api/services`
- `GET /api/providers`, `GET /api/providers/:id`, `PUT /api/providers/:id/availability`, `POST/DELETE /api/providers/:id/blocked-slots`
- `GET /api/slots?providerId=...&serviceId=...&date=YYYY-MM-DD&tz=...`
- `GET/POST /api/appointments`, `GET /api/appointments/:id`, `PATCH /api/appointments/:id/reschedule`, `PATCH /api/appointments/:id/status`, `GET /api/appointments/:id/ics`
- `GET /api/notifications`, `PATCH /api/notifications/:id/read`, `POST /api/notifications/read-all`
- `GET /api/admin/metrics`

---

## Deploying to Vercel

This repository is pre-configured for **Vercel** via `vercel.json`, `api/index.ts`, `scripts/vercel-build.mjs`, and `server/prisma/schema.postgres.prisma`:

1. **Create a PostgreSQL Database** (required for serverless persistence—SQLite does not persist on Vercel serverless functions):
   - Create a free Postgres database on **Vercel Postgres**, **Neon**, or **Supabase** and copy its connection string (`DATABASE_URL`).
2. **Push to GitHub** (see below).
3. **Import into Vercel**:
   - Import your `fsd-project` repository in the Vercel dashboard.
   - Vercel automatically uses `vercel.json` (`installCommand`, `buildCommand`, `outputDirectory: client/dist`, and `/api/*` routing to `api/index.ts`).
   - Add these **Environment Variables** in Vercel Project Settings:
     - `DATABASE_URL`: Your PostgreSQL connection string (`postgresql://...`)
     - `JWT_SECRET`: A strong random secret string
     - `CANCELLATION_MIN_HOURS`: `2`
4. **Push Prisma Schema & Seed Production Database** (one-time from your local machine):
   ```powershell
   $env:DATABASE_URL="postgresql://..."
   npx --prefix server prisma db push --schema=server/prisma/schema.postgres.prisma
   npx --prefix server tsx server/prisma/seed.ts
   ```

---

## Pushing to GitHub (`fsd-project`)

> Note: GitHub repository names cannot contain spaces, so `fsd project` becomes `fsd-project`.

1. Install **Git** from https://git-scm.com/downloads (or GitHub Desktop).
2. Create an empty repository named **`fsd-project`** on GitHub (do **not** initialize with README or `.gitignore`).
3. Run inside `c:\Users\DELL\OneDrive\Desktop\fsd project`:
   ```powershell
   git init
   git add .
   git commit -m "Initial commit: Appointment Scheduling System"
   git branch -M main
   git remote add origin https://github.com/<YOUR_USERNAME>/fsd-project.git
   git push -u origin main
   ```

