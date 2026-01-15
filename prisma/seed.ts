/**
 * Database Seed Script
 *
 * Run with: npm run db:seed
 */

import { seedCaliforniaLawMappings } from './seeds/california-law-mappings';

async function main() {
  console.log('Starting database seed...\n');

  // Seed California law mappings
  await seedCaliforniaLawMappings();

  console.log('\nDatabase seed completed successfully!');
}

main().catch((error) => {
  console.error('Seed failed:', error);
  process.exit(1);
});
