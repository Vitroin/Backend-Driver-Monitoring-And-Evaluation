import mongoose from 'mongoose';
import * as argon2 from 'argon2';

async function seedSuperAdmin() {
  const [username, email, password] = process.argv.slice(2);
  if (!username || !email || !password) {
    console.error('Usage: bun src/database/scripts/seed-super-admin.ts <username> <email> <password>');
    process.exit(1);
  }

  await mongoose.connect(process.env.DB_URL!);
  const users = mongoose.connection.collection('users');

  if (await users.findOne({ role: 'super_admin' })) {
    console.log('A super admin already exists, nothing to do');
  } else {
    await users.insertOne({
      username: username.trim().toLowerCase(),
      email: email.trim().toLowerCase(),
      passwordHash: await argon2.hash(password),
      securityStamp: new mongoose.Types.ObjectId(),
      age: 30,
      gender: 'male',
      status: 'active',
      role: 'super_admin',
      mustChangePassword: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    console.log(`Super admin "${username}" created`);
  }

  await mongoose.disconnect();
}

seedSuperAdmin().catch((error) => {
  console.error(error);
  process.exit(1);
});