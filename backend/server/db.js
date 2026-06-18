import fs from 'fs';
import path from 'path';
import mongoose from 'mongoose';
import { PaymentModel, PaymentSchema } from './Payment.js';

const DATA_DIR = path.join(process.cwd(), 'data');

// ==========================================
// MONGOOSE SCHEMAS & MODELS
// ==========================================

const UserSchema = new mongoose.Schema({
  email: { type: String, required: true, unique: true },
  name: { type: String, required: true },
  role: { type: String, required: true, enum: ['user', 'admin'] },
  passwordHash: { type: String, required: true },
  createdAt: { type: String, required: true }
}, { strict: false });

const VehicleSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  userId: { type: String, required: true },
  vehicleType: { type: String },
  make: { type: String, required: true },
  model: { type: String, required: true },
  year: { type: Number, required: true },
  licensePlate: { type: String, required: true },
  mileage: { type: Number, required: true },
  lastOilChangeMileage: { type: Number },
  lastTireRotationMileage: { type: Number },
  createdAt: { type: String, required: true }
}, { strict: false });

const DamageReportSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  userId: { type: String, required: true },
  vehicleId: { type: String, required: true },
  description: { type: String, required: true },
  imageUrl: { type: String },
  severity: { type: String, required: true, enum: ['low', 'medium', 'critical', 'Unknown'] },
  status: { type: String, required: true },
  assignedMechanic: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Mechanic'
  },
  aiDiagnosis: { type: mongoose.Schema.Types.Mixed },
  createdAt: { type: String, required: true }
}, { strict: false });

const MechanicSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  email: { type: String, unique: true, sparse: true },
  role: { type: String, enum: ['mechanic'], default: 'mechanic' },
  passwordHash: { type: String },
  name: { type: String, required: true },
  rating: { type: Number},
  reviewsCount: { type: Number},
  address: { type: String, required: true },
  lat: { type: Number},
  lng: { type: Number},
  phone: { type: String, required: true },
  schedule: { type: String},
  specialties: [{ type: String }],
  averageHourlyRate: { type: Number },
  distance: { type: String },
  createdAt: { type: String }
}, { strict: false });

const ServiceHistorySchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  userId: { type: String, required: true },
  vehicleId: { type: String, required: true },
  damageReportId: { type: String },
  serviceType: { type: String, required: true },
  description: { type: String, required: true },
  cost: { type: Number, required: true },
  loggedBy: { type: String, required: true },
  mechanicName: { type: String },
  mileageAtService: { type: Number, required: true },
  serviceDate: { type: String, required: true },
  status: { type: String, required: true },
  createdAt: { type: String, required: true }
}, { strict: false });

const ChatSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  participants: [{ type: String }],
  createdAt: { type: String, required: true },
  updatedAt: { type: String, required: true }
}, { strict: false });

const MessageSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  chatId: { type: String, required: true },
  senderId: { type: String, required: true },
  senderRole: { type: String, required: true },
  receiverId: { type: String, required: true },
  message: { type: String, required: true },
  timestamp: { type: String, required: true },
  isRead: { type: Boolean, default: false }
}, { strict: false });

const NotificationSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  userId: { type: String, required: true },
  message: { type: String, required: true },
  isRead: { type: Boolean, default: false },
  createdAt: { type: String, required: true }
}, { strict: false });

const RepairRequestSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  userId: { type: String, required: true },
  mechanicId: { type: String, required: true },
  vehicleId: { type: String, required: true },
  damageType: { type: String, required: true },
  description: { type: String },
  status: { type: String, required: true, enum: ['Pending', 'Accepted', 'In Progress', 'Completed', 'Rejected'], default: 'Pending' },
  assignedMechanic: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Mechanic'
  },
  chatId: { type: String },
  createdAt: { type: String, required: true }
}, { strict: false });

export const UserModel = mongoose.models.User || mongoose.model('User', UserSchema);
export const VehicleModel = mongoose.models.Vehicle || mongoose.model('Vehicle', VehicleSchema);
export const DamageReportModel = mongoose.models.DamageReport || mongoose.model('DamageReport', DamageReportSchema);
export const MechanicModel = mongoose.models.Mechanic || mongoose.model('Mechanic', MechanicSchema);
export const ServiceHistoryModel = mongoose.models.ServiceHistory || mongoose.model('ServiceHistory', ServiceHistorySchema);
export const ChatModel = mongoose.models.Chat || mongoose.model('Chat', ChatSchema);
export const MessageModel = mongoose.models.Message || mongoose.model('Message', MessageSchema);
export const NotificationModel = mongoose.models.Notification || mongoose.model('Notification', NotificationSchema);
export const RepairRequestModel = mongoose.models.RepairRequest || mongoose.model('RepairRequest', RepairRequestSchema);
export { PaymentModel, PaymentSchema };

const modelsMap = {
  'vehicles.json': VehicleModel,
  'damage-reports.json': DamageReportModel,
  'mechanics.json': MechanicModel,
  'service-history.json': ServiceHistoryModel,
  'chats.json': ChatModel,
  'messages.json': MessageModel,
  'notifications.json': NotificationModel,
  'repair-requests.json': RepairRequestModel,
  'payments.json': PaymentModel
};

let isConnectedToMongo = false;
let pollingInterval = null;

export async function connectToMongoDB() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    throw new Error('MONGODB_URI is required. User authentication now persists only in MongoDB Atlas.');
  }

  try {
    console.log('[AutoAid DB] Attempting connection to MongoDB...', uri.replace(/:([^@]+)@/, ':****@'));
    await mongoose.connect(uri, {
      serverSelectionTimeoutMS: 5000 // fail fast if not reachable/whitelisted
    });
    isConnectedToMongo = true;
    console.log('[AutoAid DB] Connected to MongoDB Atlas/Cluster successfully!');

    // Synchronize all collection cache segments from live MongoDB state
    await syncAllCollectionsFromMongo();

    // Start background polling to keep local high-performance cache in real-time sync with Atlas
    startBackgroundMongoPolling();
  } catch (error) {
    console.error('[AutoAid DB] Failed to establish MongoDB link:', error.message || error);
    if (error.name === 'MongooseServerSelectionError') {
      console.warn('\n=========================================');
      console.warn('⚠️  MONGODB IP WHITELISTING EXCEPTION ⚠️');
      console.warn('The Cloud Run sandboxed IP is not whitelisted in MongoDB Atlas.');
      console.warn('To resolve this, please go to MongoDB Atlas -> Network Access');
      console.warn('and add "0.0.0.0/0" to whitelist connections from anywhere.');
      console.warn('=========================================\n');
    }
    throw error;
  }
}

function startBackgroundMongoPolling() {
  if (pollingInterval) {
    clearInterval(pollingInterval);
  }
  pollingInterval = setInterval(async () => {
    if (!isConnectedToMongo) return;
    try {
      await syncAllCollectionsFromMongo();
    } catch (err) {
      console.error('[AutoAid DB] Background polling synchronization from MongoDB Atlas failed:', err);
    }
  }, 3000); // 3 seconds interval for near immediate live fetching
}

async function syncAllCollectionsFromMongo() {
  await Promise.all([
    db.vehicles.syncFromMongo(),
    db.damageReports.syncFromMongo(),
    db.mechanics.syncFromMongo(),
    db.serviceHistory.syncFromMongo(),
    db.chats.syncFromMongo(),
    db.messages.syncFromMongo(),
    db.notifications.syncFromMongo(),
    db.repairRequests.syncFromMongo(),
    db.payments.syncFromMongo()
  ]);
}

// ==========================================
// MEMORY-FIRST COOPERATIVE COLLECTION LAYER
// ==========================================

export class Collection {
  constructor(fileName) {
    this.fileName = fileName;
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    this.filePath = path.join(DATA_DIR, fileName);
    if (!fs.existsSync(this.filePath)) {
      fs.writeFileSync(this.filePath, JSON.stringify([], null, 2));
    }
    this.cache = this.readFromFile();
  }

  readFromFile() {
    try {
      const data = fs.readFileSync(this.filePath, 'utf-8');
      return JSON.parse(data);
    } catch (e) {
      return [];
    }
  }

  writeToFile(data) {
    try {
      fs.writeFileSync(this.filePath, JSON.stringify(data, null, 2));
    } catch (e) {
      console.error(`[AutoAid DB] Failed writing cache to file backup ${this.filePath}:`, e);
    }
  }

  // Fetch from MongoDB and reload memory cache, or seeds MongoDB from file if empty
  async syncFromMongo() {
    if (!isConnectedToMongo) return;
    const model = modelsMap[this.fileName];
    if (!model) return;

    try {
      const docs = await model.find().lean();
      if (docs.length > 0) {
        let hasMissingId = false;
        // Clean up MongoDB specific metadata before cache insertion
        const mapped = docs.map((doc) => {
          const { _id, __v, ...rest } = doc;
          if (!rest.id) {
            rest.id = _id ? _id.toString() : Math.random().toString(36).substring(2, 11);
            hasMissingId = true;
          }
          return rest;
        });
        this.cache = mapped;
        this.writeToFile(this.cache);

        if (hasMissingId) {
          console.log(`[AutoAid DB] Schema repair in progress: detected manual MongoDB insert without 'id' key in '${this.fileName}'. Setting 'id' key explicitly...`);
          for (const doc of docs) {
            const { _id, id } = doc;
            if (!id && _id) {
              await model.updateOne({ _id }, { $set: { id: _id.toString() } });
            }
          }
        }
      } else if (this.cache.length > 0) {
        // Destination DB collections are empty, push current operational state
        console.log(`[AutoAid DB] Remote MongoDB collection for '${this.fileName}' is empty. Warm seeding ${this.cache.length} records...`);
        await model.insertMany(this.cache);
      }
    } catch (err) {
      console.error(`[AutoAid DB] Error synchronizing operational cache for '${this.fileName}':`, err);
    }
  }

  find(filter = () => true) {
    return this.cache.filter(filter);
  }

  findOne(filter) {
    return this.cache.find(filter) || null;
  }

  findById(id) {
    return this.findOne(item => item.id === id);
  }

  create(item) {
    const newItem = {
      ...item,
      id: item.id || Math.random().toString(36).substring(2, 11),
      createdAt: item.createdAt || new Date().toISOString(),
    };
    
    this.cache.push(newItem);
    this.writeToFile(this.cache);

    if (isConnectedToMongo) {
      const model = modelsMap[this.fileName];
      if (model) {
        model.create(newItem).catch((err) => {
          console.error(`[AutoAid DB] Error write-through saving creation in remote MongoDB database:`, err);
        });
      }
    }

    return newItem;
  }

  update(id, updates) {
    const index = this.cache.findIndex(item => item.id === id);
    if (index === -1) return null;
    
    this.cache[index] = { ...this.cache[index], ...updates };
    this.writeToFile(this.cache);

    if (isConnectedToMongo) {
      const model = modelsMap[this.fileName];
      if (model) {
        model.updateOne({ id }, { $set: updates }).catch((err) => {
          console.error(`[AutoAid DB] Error write-through writing updates to remote MongoDB database:`, err);
        });
      }
    }

    return this.cache[index];
  }

  delete(id) {
    const originalLength = this.cache.length;
    this.cache = this.cache.filter(item => item.id !== id);
    if (this.cache.length === originalLength) return false;
    
    this.writeToFile(this.cache);

    if (isConnectedToMongo) {
      const model = modelsMap[this.fileName];
      if (model) {
        model.deleteOne({ id }).catch((err) => {
          console.error(`[AutoAid DB] Error write-through executing deletion on remote MongoDB database:`, err);
        });
      }
    }

    return true;
  }
}

// Database instance containing all live collection abstractions
export const db = {
  vehicles: new Collection('vehicles.json'),
  damageReports: new Collection('damage-reports.json'),
  mechanics: new Collection('mechanics.json'),
  serviceHistory: new Collection('service-history.json'),
  chats: new Collection('chats.json'),
  messages: new Collection('messages.json'),
  notifications: new Collection('notifications.json'),
  repairRequests: new Collection('repair-requests.json'),
  payments: new Collection('payments.json'),
};

// Seed helper to populate basic datasets
export function seedDatabase() {
  // 1. Seed Vehicles (Disabled so user's garage is clean)
  if (db.vehicles.find().length === 0) {
    console.log('[AutoAid Seed] Vehicles seed clean start.');
  }

  // 2. Seed Mechanics
  if (db.mechanics.find().length === 0) {
    db.mechanics.create({
      id: 'mec_1',
      name: 'Mission Auto Care & Tuning',
      rating: 4.8,
      reviewsCount: 124,
      address: '2288 Mission St, San Francisco, CA 94110',
      lat: 37.7601,
      lng: -122.4194,
      phone: '(415) 555-0142',
      schedule: 'Mon-Sat: 8:00 AM - 6:00 PM',
      specialties: ['Brakes', 'Suspension', 'Engine Diagnostic', 'Oil Changes'],
      averageHourlyRate: 95,
      distance: '0.8 miles',
    });

    db.mechanics.create({
      id: 'mec_2',
      name: 'Pacific Heights Imports Tech',
      rating: 4.9,
      reviewsCount: 86,
      address: '1840 California St, San Francisco, CA 94109',
      lat: 37.7905,
      lng: -122.4272,
      phone: '(415) 555-0178',
      schedule: 'Mon-Fri: 7:30 AM - 5:30 PM',
      specialties: ['Hybrid/EV', 'Electrical Repair', 'Battery Diagnostics', 'Foreign Imports'],
      averageHourlyRate: 120,
      distance: '2.4 miles',
    });

    db.mechanics.create({
      id: 'mec_3',
      name: 'Golden Gate Collision & Auto Body',
      rating: 4.6,
      reviewsCount: 202,
      address: '1240 Geary Blvd, San Francisco, CA 94109',
      lat: 37.7854,
      lng: -122.4261,
      phone: '(415) 555-0199',
      schedule: 'Mon-Fri: 8:00 AM - 5:00 PM',
      specialties: ['Body Shop', 'Scratch & Dent', 'Frame Straightening', 'Paint Restoration'],
      averageHourlyRate: 110,
      distance: '1.9 miles',
    });

    db.mechanics.create({
      id: 'mec_4',
      name: 'Arsh car care center',
      rating: 4.7,
      reviewsCount: 54,
      address: 'Auto Nagar, Kanuru, Andhra Pradesh 520007',
      lat:  16.4926,
      lng:  80.6715,
      phone: '+91 6301483398',
      schedule: 'Mon-Fri: 8:00 AM - 6:00 PM',
      specialties: ['Clutch & Transmission', 'Drivetrain', 'CV Joints', 'Axle Repair'],
      averageHourlyRate: 105,
      distance: '1.2 miles',
    });
    console.log('[AutoAid Seed] Seeded mechanics directory.');
  }

  // 3. Seed Service Log History (Clean for user-registered vehicles)
  if (db.serviceHistory.find().length === 0) {
    console.log('[AutoAid Seed] Service histories seed clean start.');
  }

  // 4. Seed Damage Reports with Diagnosis (Clean for user-registered vehicles)
  if (db.damageReports.find().length === 0) {
    console.log('[AutoAid Seed] Damage reports seed clean start.');
  }
}
