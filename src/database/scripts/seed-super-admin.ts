/**
 * Super admin seed — creates the super admin, if there isn't one yet
 *
 * Usage (through the Nest build, like the other seeds):
 *   bun run seed:super-admin <username> <email> <password> "<full name>"
 *
 * Goes through the User model, so the schema validates every field (enums included) and fills its
 * defaults, like any user the app creates. A super admin belongs to no organization, so it references nothing.
 * Allowed in production: it is how the first account of a new deployment is made.
 */

import * as argon2 from 'argon2';
import { UserGender, UserRole, UserStatus } from '@common/enums';
import { bootstrap } from '../seed/seed-kit';

async function seedSuperAdmin() {
  const [username, email, password, fullName] = process.argv.slice(2);
  if (!username || !email || !password || !fullName) {
    console.error('Usage: bun run seed:super-admin <username> <email> <password> "<full name>"');
    process.exit(1);
  }

  const passwordHash = await argon2.hash(password);
  const { app, models } = await bootstrap({ allowProduction: true });

  try {
    if (await models.user.exists({ role: UserRole.SUPER_ADMIN })) {
      console.log('A super admin already exists, nothing to do');
      return;
    }

    await models.user.create({
      username: username.trim(), // the schema lowercases it, and the email
      fullName: fullName.trim(),
      email: email.trim(),
      passwordHash,
      age: 30,
      gender: UserGender.MALE,
      status: UserStatus.ACTIVE,
      role: UserRole.SUPER_ADMIN,
      mustChangePassword: false,
    });
    console.log(`Super admin "${username.trim().toLowerCase()}" created`);
  } finally {
    await app.close();
  }
}

seedSuperAdmin()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Super admin seed failed:', error);
    process.exit(1);
  });
