import { MechanicModel, UserModel } from '../db.js';

function sanitizeAuthDocument(account, fallbackRole) {
  if (!account) return null;

  const objectId = account._id?.toString();
  return {
    id: account.id || objectId,
    legacyId: objectId && account.id && account.id !== objectId ? objectId : undefined,
    name: account.name,
    email: account.email,
    role: account.role || fallbackRole,
    passwordHash: account.passwordHash,
    createdAt: account.createdAt,
  };
}

export async function findUserByEmail(email) {
  if (!email) return null;
  const user = await UserModel.findOne({ email: String(email).toLowerCase() }).lean();
  return sanitizeAuthDocument(user, 'user');
}

export async function findMechanicByEmail(email) {
  if (!email) return null;
  const mechanic = await MechanicModel.findOne({ email: String(email).toLowerCase() }).lean();
  return sanitizeAuthDocument(mechanic, 'mechanic');
}

export async function findAuthAccountByEmail(email) {
  return (await findMechanicByEmail(email)) || (await findUserByEmail(email));
}

export async function findUserById(id) {
  if (!id) return null;

  const query = String(id).match(/^[a-f\d]{24}$/i)
    ? { $or: [{ _id: id }, { id }] }
    : { id };

  const user = await UserModel.findOne(query).lean();
  return sanitizeAuthDocument(user, 'user');
}

export async function findMechanicById(id) {
  if (!id) return null;

  const query = String(id).match(/^[a-f\d]{24}$/i)
    ? { $or: [{ _id: id }, { id }] }
    : { id };

  const mechanic = await MechanicModel.findOne(query).lean();
  return sanitizeAuthDocument(mechanic, 'mechanic');
}

export async function findAuthAccountById(id) {
  return (await findMechanicById(id)) || (await findUserById(id));
}

export async function createUser({ name, email, passwordHash, role }) {
  if (role === 'mechanic') {
    throw new Error('Mechanic accounts must be created in the mechanics collection.');
  }

  const userRole = role === 'admin' ? 'admin' : 'user';
  const user = await UserModel.create({
    name,
    email: String(email).toLowerCase(),
    passwordHash,
    role: userRole,
    createdAt: new Date().toISOString(),
  });

  console.log('User inserted into MongoDB:', user._id);
  return sanitizeAuthDocument(user.toObject(), userRole);
}

export async function createMechanic({ name, email, passwordHash }) {
  const mechanic = await MechanicModel.create({
    id: 'mec_' + Math.random().toString(36).substring(2, 11),
    name,
    email: String(email).toLowerCase(),
    passwordHash,
    role: 'mechanic',
    rating: 5.0,
    reviewsCount: 1,
    address: '150 Valencia St, San Francisco, CA',
    lat: 37.7749,
    lng: -122.4194,
    phone: '(415) 555-8899',
    schedule: 'Mon - Sat: 8 AM - 6 PM',
    specialties: ['General Repair', 'Diagnostics', 'Brakes', 'Dents & Paints'],
    averageHourlyRate: 110,
    distance: '1.2',
    createdAt: new Date().toISOString(),
  });

  console.log('Mechanic inserted into MongoDB:', mechanic._id);
  return sanitizeAuthDocument(mechanic.toObject(), 'mechanic');
}

export async function updateUserById(id, updates) {
  if (!id) return null;

  const query = String(id).match(/^[a-f\d]{24}$/i)
    ? { $or: [{ _id: id }, { id }] }
    : { id };

  const user = await UserModel.findOneAndUpdate(
    query,
    { $set: updates },
    { new: true }
  ).lean();

  return sanitizeAuthDocument(user, 'user');
}

export async function updateAuthAccountById(id, updates) {
  return (await updateUserById(id, updates)) || (await updateMechanicById(id, updates));
}

export async function updateMechanicById(id, updates) {
  if (!id) return null;

  const query = String(id).match(/^[a-f\d]{24}$/i)
    ? { $or: [{ _id: id }, { id }] }
    : { id };

  const mechanic = await MechanicModel.findOneAndUpdate(
    query,
    { $set: updates },
    { new: true }
  ).lean();

  return sanitizeAuthDocument(mechanic, 'mechanic');
}

export async function seedMongoUsers(users) {
  for (const user of users) {
    const existing = await findUserByEmail(user.email);
    if (!existing) {
      await createUser(user);
    }
  }
}

export async function seedMongoMechanics(mechanics) {
  for (const mechanic of mechanics) {
    const existing = await findMechanicByEmail(mechanic.email);
    if (!existing) {
      await createMechanic(mechanic);
    }
  }
}

export async function migrateLegacyMechanicUsers() {
  const legacyMechanicUsers = await UserModel.find({ role: 'mechanic' }).lean();

  for (const legacyUser of legacyMechanicUsers) {
    const mechanicId = legacyUser.id || legacyUser._id.toString();
    const mechanicEmail = String(legacyUser.email).toLowerCase();
    const existingMechanic = await MechanicModel.findOne({
      $or: [
        { id: mechanicId },
        { email: mechanicEmail },
      ],
    }).lean();

    if (existingMechanic) {
      await MechanicModel.updateOne(
        { _id: existingMechanic._id },
        {
          $set: {
            email: existingMechanic.email || mechanicEmail,
            passwordHash: existingMechanic.passwordHash || legacyUser.passwordHash,
            role: 'mechanic',
          },
        }
      );
      continue;
    }

    await MechanicModel.create({
      id: mechanicId,
      name: legacyUser.name,
      email: mechanicEmail,
      passwordHash: legacyUser.passwordHash,
      role: 'mechanic',
      rating: 5.0,
      reviewsCount: 1,
      address: '150 Valencia St, San Francisco, CA',
      lat: 37.7749,
      lng: -122.4194,
      phone: '(415) 555-8899',
      schedule: 'Mon - Sat: 8 AM - 6 PM',
      specialties: ['General Repair', 'Diagnostics', 'Brakes', 'Dents & Paints'],
      averageHourlyRate: 110,
      distance: '1.2',
      createdAt: legacyUser.createdAt || new Date().toISOString(),
    });
  }

  if (legacyMechanicUsers.length > 0) {
    const result = await UserModel.deleteMany({ role: 'mechanic' });
    console.log(`Migrated ${legacyMechanicUsers.length} legacy mechanic account(s); removed ${result.deletedCount} from users.`);
  }
}
