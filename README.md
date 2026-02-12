# CollabBoard

A real-time collaborative whiteboard application built with WebSocket technology. Users can create boards, manage cards across columns, and see live updates from other collaborators.

## Features

- **Real-time Synchronization** - WebSocket-based updates with Socket.IO
- **Optimistic Updates** - Local changes apply immediately, then sync with server
- **User Authentication** - JWT tokens with refresh token rotation
- **Active User Tracking** - Display which users are currently viewing each board
- **Board-level Chat** - Text communication within individual boards
- **Card Management** - Drag-and-drop interface for organizing cards across columns
- **Access Control** - Role-based permissions for workspaces and boards

## Architecture

This is a monorepo using Turborepo with the following structure:

- **Frontend** - Next.js 14 with App Router, React, Tailwind CSS
- **Backend** - Express server with Socket.IO for WebSocket connections
- **Database** - PostgreSQL for persistent storage
- **Cache** - Redis for user presence and session management
- **Shared Package** - TypeScript types and validation schemas used by both frontend and backend

## Getting Started

### Prerequisites

- Node.js 18+
- Docker and Docker Compose

### Installation

```bash
# Install dependencies
npm install

# Start PostgreSQL and Redis containers
npm run docker:up

# Run database migrations
npm run db:migrate

# Optional: seed demo data
npm run db:seed

# Start both frontend and backend servers
npm run dev
```

The application will be available at:
- Frontend: http://localhost:3000
- Backend API: http://localhost:4000
- Health check: http://localhost:4000/health

## Project Structure

```
CollabBoard/
├── apps/
│   ├── web/              Next.js frontend application
│   └── server/           Express backend with Socket.IO
├── packages/
│   └── shared/           Shared TypeScript types and schemas
├── docker/
│   ├── docker-compose.yml
│   └── init.sql          Database initialization
└── turbo.json            Turborepo configuration
```

## Development

The monorepo is managed with Turborepo. Key commands:

```bash
npm run dev          # Start all apps in development mode
npm run build        # Build all apps
npm run lint         # Lint all packages
npm run docker:up    # Start Docker services
npm run docker:down  # Stop Docker services
```

## Environment Variables

Backend (`apps/server/.env`):

```
DATABASE_URL=postgresql://user:password@localhost:5432/collabboard
REDIS_URL=redis://localhost:6379
JWT_SECRET=your-secret-key
PORT=4000
```

Frontend environment variables can be configured in `apps/web/.env.local`.

## License

MIT
