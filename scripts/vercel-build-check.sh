#!/bin/bash
set -e

echo "=== Vercel Build Emulation ==="

# Step 1: Clean generated Prisma client (simulate fresh environment)
echo "Cleaning Prisma generated client..."
rm -rf node_modules/.prisma

# Step 2: Clean .next build directory
echo "Cleaning .next directory..."
rm -rf .next

# Step 3: Generate Prisma client (mimics what should happen in Vercel)
echo "Generating Prisma client..."
pnpm db:generate

# Step 4: Run lint check
echo "Running lint..."
pnpm lint

# Step 5: Run TypeScript type check
echo "Running type-check..."
pnpm type-check

# Step 6: Run Prettier check
echo "Running format check..."
pnpm format:check

# Step 7: Run the build
echo "Running build..."
pnpm build

echo "=== All checks passed! Safe to deploy ==="
