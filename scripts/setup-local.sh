#!/bin/bash

# Settleright.ai Local Development Setup Script
# This script sets up the local development environment

set -e

echo "Setting up Settleright.ai local development environment..."

# Check for required tools
command -v node >/dev/null 2>&1 || { echo "Node.js is required but not installed. Aborting." >&2; exit 1; }
command -v npm >/dev/null 2>&1 || { echo "npm is required but not installed. Aborting." >&2; exit 1; }
command -v docker >/dev/null 2>&1 || { echo "Docker is required but not installed. Aborting." >&2; exit 1; }

# Check Node.js version
NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 18 ]; then
  echo "Node.js 18 or higher is required. Current version: $(node -v)"
  exit 1
fi

echo "Prerequisites check passed!"

# Create .env.local if it doesn't exist
if [ ! -f .env.local ]; then
  echo "Creating .env.local from .env.example..."
  cp .env.example .env.local
  echo "Please update .env.local with your API keys and secrets."
else
  echo ".env.local already exists, skipping..."
fi

# Start Docker services
echo "Starting Docker services (PostgreSQL, Redis, MinIO)..."
docker compose up -d

# Wait for services to be healthy
echo "Waiting for services to be ready..."
sleep 5

# Check if PostgreSQL is ready
until docker compose exec -T postgres pg_isready -U postgres > /dev/null 2>&1; do
  echo "Waiting for PostgreSQL..."
  sleep 2
done
echo "PostgreSQL is ready!"

# Check if Redis is ready
until docker compose exec -T redis redis-cli ping > /dev/null 2>&1; do
  echo "Waiting for Redis..."
  sleep 2
done
echo "Redis is ready!"

# Install dependencies
echo "Installing npm dependencies..."
npm install

# Generate Prisma client
echo "Generating Prisma client..."
npx prisma generate

# Run database migrations
echo "Running database migrations..."
npx prisma db push

echo ""
echo "=============================================="
echo "Local development environment is ready!"
echo "=============================================="
echo ""
echo "Services running:"
echo "  - PostgreSQL: localhost:5432"
echo "  - Redis: localhost:6379"
echo "  - MinIO: localhost:9000 (Console: localhost:9001)"
echo ""
echo "Next steps:"
echo "  1. Update .env.local with your Clerk, Stripe, and other API keys"
echo "  2. Run 'npm run dev' to start the development server"
echo "  3. Open http://localhost:3000 in your browser"
echo ""
echo "Useful commands:"
echo "  - npm run dev          Start development server"
echo "  - npm run db:studio    Open Prisma Studio"
echo "  - npm run db:push      Push schema changes to database"
echo "  - docker compose logs  View service logs"
echo "  - docker compose down  Stop all services"
echo ""
