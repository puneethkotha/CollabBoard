# CollabBoard

A production-grade real-time collaborative board application with drag-and-drop cards, live chat, and multi-user presence.

## Features

- 🎯 **Real-time Collaboration**: Multiple users can edit boards simultaneously
- 🚀 **Optimistic UI**: Instant feedback with delta-based updates
- 🔐 **Secure Authentication**: JWT-based auth with refresh tokens
- 👥 **User Presence**: See who's viewing each board in real-time
- 💬 **Board Chat**: Communicate with team members per board
- 🎨 **Drag & Drop**: Intuitive card management with column organization
- 📊 **Production Ready**: Rate limiting, observability, RBAC, CI/CD

## Tech Stack

- **Frontend**: Next.js 14 (App Router), React, Tailwind CSS, Socket.IO Client
- **Backend**: Node.js, Fastify, Socket.IO Server
- **Database**: PostgreSQL with optimistic concurrency control
- **Cache & Presence**: Redis
- **Auth**: JWT + Refresh Token rotation
- **Observability**: Structured logging (Pino), Prometheus metrics
- **Infrastructure**: Docker Compose for local development
- **CI/CD**: GitHub Actions

## Quick Start

```bash
# Install dependencies
npm install

# Start infrastructure (Postgres + Redis)
npm run docker:up

# Run migrations
npm run db:migrate

# Seed demo data
npm run db:seed

# Start development servers
npm run dev
```

Visit:
- Frontend: http://localhost:3000
- Backend API: http://localhost:4000
- Health: http://localhost:4000/health
- Metrics: http://localhost:4000/metrics

## Documentation

- [Local Development Guide](./docs/LOCAL_DEV.md)
- [Architecture Overview](./docs/ARCHITECTURE.md)
- [Operations Runbook](./docs/RUNBOOK.md)

## Project Structure

```
├── apps/
│   ├── web/           # Next.js frontend
│   └── server/        # Fastify + Socket.IO backend
├── packages/
│   └── shared/        # Shared types, schemas, contracts
├── docker/            # Docker Compose and init scripts
├── docs/              # Documentation
└── .github/workflows/ # CI/CD pipelines
```

## License

MIT
