/**
 * Referential integrity check — read-only, over the whole database (seeded and real data)
 *
 * Usage (through the Nest build, like the seeds):
 *   bun run seed:verify
 *
 * Checks every reference in the schema (see ../seed/integrity.ts) and lists each broken one with
 * up to 5 sample ids. Exits with code 1 when a reference is broken; warnings alone don't fail it.
 * It never changes anything.
 */

import { bootstrap } from '../seed/seed-kit';
import { printProblems, verifyIntegrity } from '../seed/integrity';

async function verify() {
  const { app, models } = await bootstrap({ allowProduction: true });
  try {
    const problems = await verifyIntegrity(models);
    printProblems(problems);
    return problems.some((problem) => problem.level === 'error') ? 1 : 0;
  } finally {
    await app.close();
  }
}

verify()
  .then((code) => process.exit(code))
  .catch((err) => {
    console.error('Integrity check failed to run:', err);
    process.exit(1);
  });
