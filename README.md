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

## Available Scripts

- `yarn dev` - Start development server with hot reload
- `yarn build` - Compile TypeScript to JavaScript
- `yarn start` - Run production build
- `yarn lint` - Run ESLint
- `yarn format` - Format code with Prettier
- `yarn type-check` - Run TypeScript type checking without emitting files

## Environment Variables

- `PORT` - Server port (default: 3000)
- `NODE_ENV` - Environment mode (development/production)

## Project Structure

```
src/
├── index.ts      # Entry point
├── app.ts        # Express app configuration
└── routes/       # API routes
```

## Development

The development server runs on `http://localhost:3000` by default. The server includes:

- Health check endpoint at `/health`
- CORS middleware enabled
- JSON body parsing
- Error handling middleware

## Code Quality

This project uses:

- **ESLint** - Linting with TypeScript support
- **Prettier** - Code formatting
- **Husky** - Git hooks for pre-commit linting and formatting

Pre-commit hooks automatically run ESLint and Prettier on staged files.

## License

ISC

