# Express TypeScript API

A modern Express API built with TypeScript, featuring ESLint, Prettier, and Husky for code quality.

## Features

- Express.js web framework
- TypeScript for type safety
- ESLint for code linting
- Prettier for code formatting
- Husky for Git hooks
- Nodemon for hot reloading
- CORS support
- Environment variable management with dotenv

## Prerequisites

- Node.js (v18 or higher)
- Yarn package manager
- Docker and Docker Compose

## Installation

1. Clone the repository
2. Install dependencies:

```bash
yarn install
```

3. Copy the example environment file:

```bash
cp .env.example .env
```

4. Update `.env` with your configuration

5. Start all services (PostgreSQL and Qdrant):

```bash
yarn docker:up
```

This will start:

- **PostgreSQL** on port `5432` (database will automatically initialize with `schema.sql` on first startup)
- **Qdrant** on ports `6333` (REST API/Web UI) and `6334` (gRPC API)

6. Start the development server:

```bash
yarn dev
```

The server will verify database connectivity before starting.

## Available Scripts

- `yarn dev` - Start development server with hot reload
- `yarn build` - Compile TypeScript to JavaScript
- `yarn start` - Run production build
- `yarn lint` - Run ESLint
- `yarn format` - Format code with Prettier
- `yarn type-check` - Run TypeScript type checking without emitting files

### Docker Scripts

- `yarn docker:up` - Start all services (PostgreSQL and Qdrant)
- `yarn docker:down` - Stop all services
- `yarn docker:restart` - Restart all services
- `yarn docker:logs` - View logs from all services
- `yarn docker:ps` - Show status of all services

## Environment Variables

- `PORT` - Server port (default: 3000)
- `NODE_ENV` - Environment mode (development/production)
- `DATABASE_URL` - PostgreSQL connection string (default: `postgresql://postgres:postgres@localhost:5432/ailab_hack`)
- `QDRANT_URL` - Qdrant vector database URL (default: `http://localhost:6333`)
- `QDRANT_API_KEY` - Qdrant API key (optional, leave empty for local development)

## Project Structure

```
src/
├── index.ts      # Entry point
├── app.ts        # Express app configuration
└── routes/       # API routes
```

## Development

### Quick Start

1. Start all services: `yarn docker:up`
2. Start the development server: `yarn dev`

The development server runs on `http://localhost:3000` by default. The server includes:

- Health check endpoint at `/health`
- CORS middleware enabled
- JSON body parsing
- Error handling middleware
- Database connection verification on startup

### Services

- **API Server**: `http://localhost:3000`
- **PostgreSQL**: `localhost:5432`
- **Qdrant Web UI**: `http://localhost:6333/dashboard`
- **Qdrant REST API**: `http://localhost:6333`

## Code Quality

This project uses:

- **ESLint** - Linting with TypeScript support
- **Prettier** - Code formatting
- **Husky** - Git hooks for pre-commit linting and formatting

Pre-commit hooks automatically run ESLint and Prettier on staged files.

## License

ISC
