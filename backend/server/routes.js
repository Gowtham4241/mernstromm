import { Router } from 'express';
import { db } from './db.js';
import { requireAuth, requireAdmin, generateToken, hashPassword, comparePassword } from './auth.js';
import {
  createMechanic,
  createUser,
  findAuthAccountByEmail,
  findAuthAccountById,
  findMechanicById,
  findUserById,
  updateAuthAccountById,
} from './services/userService.js';
import { validateVehicleDamageClaim } from './geminiService.js';
import { broadcastRestMessage, sendRealtimeNotification, getOnlineUsersList } from './socket/socketServer.js';
import paymentRouter from './paymentRoutes.js';
import claimRouter from './routes/claimRoutes.js';

const router = Router();

router.use('/payment', paymentRouter);
router.use('/claims', claimRouter);

async function getCurrentAccountIds(req) {
  const account = await findAuthAccountById(req.user.id);
  return [...new Set([
    req.user.id,
    account?.id,
    account?.legacyId,
  ].filter(Boolean))];
}

function getLatestVehicleForUser(userIds) {
  return db.vehicles.find(v => userIds.includes(v.userId))
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0] || null;
}

// ==========================================
// 1. AUTHENTICATION ENDPOINTS
// ==========================================

// Register
async function registerUser(req, res) {
  const { name, email, password, role } = req.body;

  if (!name || !email || !password) {
    return res.status(400).json({ error: 'Please enter name, email, and password.' });
  }

  try {
    const existing = await findAuthAccountByEmail(email);

    if (existing) {
      return res.status(400).json({ error: 'An account with this email already exists.' });
    }

    const userRole = role === 'mechanic' ? 'mechanic' : role === 'admin' ? 'admin' : 'user';
    const newUser = userRole === 'mechanic'
      ? await createMechanic({
          name,
          email,
          passwordHash: hashPassword(password),
        })
      : await createUser({
          name,
          email,
          role: userRole,
          passwordHash: hashPassword(password),
        });

    const token = generateToken({
      id: newUser.id,
      name: newUser.name,
      email: newUser.email,
      role: newUser.role,
      createdAt: newUser.createdAt,
    });

    return res.status(201).json({
      token,
      role: newUser.role,
      user: {
        id: newUser.id,
        name: newUser.name,
        email: newUser.email,
        role: newUser.role,
      }
    });
  } catch (err) {
    console.error('MongoDB registration failed:', err);
    return res.status(500).json({ error: 'Registration failed while writing to MongoDB.' });
  }
}

router.post('/auth/register', registerUser);
router.post('/register', registerUser);

// Login
async function loginUser(req, res) {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'Please enter email and password.' });
  }

  try {
    const user = await findAuthAccountByEmail(email);
    if (!user || !comparePassword(password, user.passwordHash)) {
      return res.status(400).json({ error: 'Invalid email or password credentials.' });
    }

    const token = generateToken({
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      createdAt: user.createdAt,
    });

    return res.json({
      token,
      role: user.role,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
      }
    });
  } catch (err) {
    console.error('MongoDB login failed:', err);
    return res.status(500).json({ error: 'Login failed while reading from MongoDB.' });
  }
}

router.post('/auth/login', loginUser);
router.post('/login', loginUser);

// Get profile
router.get('/auth/me', requireAuth, async (req, res) => {
  const account = req.user.role === 'mechanic'
    ? await findMechanicById(req.user.id)
    : await findUserById(req.user.id);

  if (!account) {
    return res.status(404).json({ error: 'User profiles not found.' });
  }

  return res.json({
    user: {
      id: account.id,
      name: account.name,
      email: account.email,
      role: account.role,
      createdAt: account.createdAt,
    },
  });
});


// ==========================================
// 2. VEHICLE ENDPOINTS (CRUD)
// ==========================================

// Get all user vehicles
router.get('/vehicles', requireAuth, (req, res) => {
  const userId = req.user.id;
  
  // If admin, they can see all vehicles, but let's default to user filter unless requested
  const list = db.vehicles.find(v => v.userId === userId || req.user.role === 'admin');
  return res.json(list);
});

// Register new vehicle
router.post('/vehicles', requireAuth, (req, res) => {
  const { vehicleType, make, model, year, licensePlate, mileage } = req.body;
  const userId = req.user.id;

  if (!vehicleType || !make || !model || !year || !licensePlate || !mileage) {
    return res.status(400).json({ error: 'Please provide vehicleType, make, model, year, licensePlate and mileage.' });
  }

  const newVehicle = db.vehicles.create({
    userId,
    vehicleType,
    make,
    model,
    year: Number(year),
    licensePlate,
    mileage: Number(mileage),
    lastOilChangeMileage: Number(mileage),
    lastTireRotationMileage: Number(mileage),
  });

  return res.status(201).json(newVehicle);
});

// Update vehicle
router.put('/vehicles/:id', requireAuth, (req, res) => {
  const { id } = req.params;
  const { vehicleType, make, model, year, licensePlate, mileage, lastOilChangeMileage, lastTireRotationMileage } = req.body;
  
  const vehicle = db.vehicles.findById(id);
  if (!vehicle) {
    return res.status(404).json({ error: 'Vehicle not found.' });
  }

  // Security: only own user or admin can update
  if (vehicle.userId !== req.user.id && req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Unauthorized actions.' });
  }

  const updated = db.vehicles.update(id, {
    vehicleType: vehicleType !== undefined ? vehicleType : vehicle.vehicleType,
    make: make !== undefined ? make : vehicle.make,
    model: model !== undefined ? model : vehicle.model,
    year: year !== undefined ? Number(year) : vehicle.year,
    licensePlate: licensePlate !== undefined ? licensePlate : vehicle.licensePlate,
    mileage: mileage !== undefined ? Number(mileage) : vehicle.mileage,
    lastOilChangeMileage: lastOilChangeMileage !== undefined ? Number(lastOilChangeMileage) : vehicle.lastOilChangeMileage,
    lastTireRotationMileage: lastTireRotationMileage !== undefined ? Number(lastTireRotationMileage) : vehicle.lastTireRotationMileage,
  });

  return res.json(updated);
});

// Delete vehicle
router.delete('/vehicles/:id', requireAuth, (req, res) => {
  const { id } = req.params;
  const vehicle = db.vehicles.findById(id);
  if (!vehicle) {
    return res.status(404).json({ error: 'Vehicle not found.' });
  }

  if (vehicle.userId !== req.user.id && req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Unauthorized action.' });
  }

  // Cascade delete service history and reports associated
  const reports = db.damageReports.find(r => r.vehicleId === id);
  reports.forEach(r => db.damageReports.delete(r.id));

  const histories = db.serviceHistory.find(s => s.vehicleId === id);
  histories.forEach(s => db.serviceHistory.delete(s.id));

  db.vehicles.delete(id);
  return res.json({ success: true, message: 'Vehicle and associated records deleted.' });
});


// ==========================================
// 3. DAMAGE REPORTS & AI DIAGNOSTICS (CRUD)
// ==========================================

// Get damage reports
router.get('/damage-reports', requireAuth, (req, res) => {
  const userId = req.user.id;
  const reports = db.damageReports.find(r => req.user.role === 'admin' || r.userId === userId);
  return res.json(reports);
});

// Submit damage report + Trigger Gemini AI analysis
router.post('/damage-reports', requireAuth, async (req, res) => {
  const { vehicleId, description, imageUrl } = req.body;
  const userId = req.user.id;

  if (!vehicleId || !description) {
    return res.status(400).json({ error: 'Please provide vehicleId and description of the damage.' });
  }

  if (!imageUrl) {
    return res.status(400).json({ error: 'Please upload a clear vehicle damage image before submitting a claim.' });
  }

  const vehicle = db.vehicles.findById(vehicleId);
  if (!vehicle) {
    return res.status(404).json({ error: 'Selected vehicle not found.' });
  }
  if (vehicle.userId !== userId && req.user.role !== 'admin') {
    return res.status(403).json({ error: 'You are not allowed to submit claims for this vehicle.' });
  }

  try {
    const aiDiagnosis = await validateVehicleDamageClaim({ description, imageUrl, vehicle });
    const isPendingManualReview = aiDiagnosis.aiStatus === 'PENDING_REVIEW';

    if (!isPendingManualReview && aiDiagnosis.approvalStatus !== 'APPROVED') {
      return res.status(422).json({
        error: aiDiagnosis.rejectionReason || 'Claim validation rejected.',
        validation: aiDiagnosis,
      });
    }

    const report = db.damageReports.create({
      userId,
      vehicleId,
      description,
      imageUrl: imageUrl || undefined,
      damageType: aiDiagnosis.damageType || 'Pending Manual Review',
      damageLocation: aiDiagnosis.damageLocation || 'Pending Manual Review',
      severity: aiDiagnosis.severity || 'Unknown',
      estimatedCost: aiDiagnosis.estimatedCost ?? null,
      aiStatus: aiDiagnosis.aiStatus || 'COMPLETED',
      claimStatus: aiDiagnosis.claimStatus || aiDiagnosis.approvalStatus,
      aiReason: aiDiagnosis.reason || aiDiagnosis.rejectionReason || undefined,
      status: isPendingManualReview ? 'pending_manual_review' : 'diagnosed',
      approvalStatus: aiDiagnosis.approvalStatus,
      fraudRisk: aiDiagnosis.fraudRisk,
      validationConfidence: aiDiagnosis.confidence,
      aiDiagnosis,
    });

    return res.status(201).json({
      ...report,
      message: isPendingManualReview
        ? 'AI analysis is temporarily unavailable. Your claim has been submitted and will be reviewed manually.'
        : 'Claim submitted successfully.',
    });
  } catch (err) {
    console.error('Error in damage diagnosis api:', err);
    return res.status(500).json({ error: 'AI analysis failed: ' + (err.message || err) });
  }
});

// Admin updates report status
router.put('/damage-reports/:id', requireAuth, (req, res) => {
  const { id } = req.params;
  const { status, severity } = req.body;

  const report = db.damageReports.findById(id);
  if (!report) {
    return res.status(404).json({ error: 'Report not found.' });
  }

  // Only Admin or status progression can update status
  if (report.userId !== req.user.id && req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Unauthorized access.' });
  }

  const updated = db.damageReports.update(id, {
    status: status || report.status,
    severity: severity || report.severity,
  });

  return res.json(updated);
});

// Delete damage report
router.delete('/damage-reports/:id', requireAuth, (req, res) => {
  const { id } = req.params;
  const report = db.damageReports.findById(id);
  if (!report) {
    return res.status(404).json({ error: 'Damage report not found.' });
  }

  if (report.userId !== req.user.id && req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Unauthorized.' });
  }

  db.damageReports.delete(id);
  return res.json({ success: true, message: 'Report deleted.' });
});


// ==========================================
// 4. MECHANICS DIRECTORY (CRUD + FILTER / SEARCH)
// ==========================================

// Get current mechanic profile
router.get('/mechanics/me', requireAuth, (req, res) => {
  if (req.user.role !== 'mechanic') {
    return res.status(403).json({ error: 'Only mechanics can query this profile.' });
  }
  let m = db.mechanics.findById(req.user.id);
  if (!m) {
    m = db.mechanics.create({
      id: req.user.id,
      name: req.user.name,
      rating: 5.0,
      reviewsCount: 1,
      address: '150 Valencia St, San Francisco, CA',
      lat: 37.7749,
      lng: -122.4194,
      phone: '(415) 555-8899',
      schedule: 'Mon - Sat: 8 AM - 6 PM',
      specialties: ['General Repair', 'Diagnostics', 'Brakes', 'Dents & Paints'],
      averageHourlyRate: 110,
      distance: '1.2'
    });
  }
  return res.json(m);
});

// Update current mechanic profile
router.put('/mechanics/me', requireAuth, async (req, res) => {
  if (req.user.role !== 'mechanic') {
    return res.status(403).json({ error: 'Only mechanics can update their profile.' });
  }
  const mId = req.user.id;
  const { name, address, phone, schedule, specialties, averageHourlyRate } = req.body;
  
  if (name) {
    await updateAuthAccountById(mId, { name });
  }

  const existing = db.mechanics.findById(mId);
  if (!existing) {
    const created = db.mechanics.create({
      id: mId,
      name: name || req.user.name,
      rating: 5.0,
      reviewsCount: 1,
      address: address || '150 Valencia St, San Francisco, CA',
      lat: 37.7749,
      lng: -122.4194,
      phone: phone || '(415) 555-8899',
      schedule: schedule || 'Mon - Sat: 8 AM - 6 PM',
      specialties: Array.isArray(specialties) ? specialties : ['General Repair', 'Diagnostics', 'Brakes', 'Dents & Paints'],
      averageHourlyRate: Number(averageHourlyRate) || 110,
      distance: '1.2'
    });
    return res.json(created);
  }

  const updated = db.mechanics.update(mId, {
    name: name || existing.name,
    address: address || existing.address,
    phone: phone || existing.phone,
    schedule: schedule || existing.schedule,
    specialties: Array.isArray(specialties) ? specialties : existing.specialties,
    averageHourlyRate: averageHourlyRate ? Number(averageHourlyRate) : existing.averageHourlyRate,
  });

  return res.json(updated);
});

// Get mechanics list (supports search, sort, filter specialties)
router.get('/mechanics', (req, res) => {
  const { search, specialty, sortBy, maxRate, userLat, userLng } = req.query;

  let list = db.mechanics.find();

  // Parse user coordinate elements if present
  let uLat = null;
  let uLng = null;
  if (userLat && userLng) {
    uLat = Number(userLat);
    uLng = Number(userLng);
  }

  // Calculate dynamic distances if coordinates exist
  if (uLat !== null && uLng !== null && !isNaN(uLat) && !isNaN(uLng)) {
    list = list.map(m => {
      if (m.lat && m.lng) {
        // Haversine dynamic calculation
        const R = 6371; // Radius in km
        const dLat = (m.lat - uLat) * Math.PI / 180;
        const dLon = (m.lng - uLng) * Math.PI / 180;
        const latS = Math.sin(dLat/2) * Math.sin(dLat/2) +
                     Math.cos(uLat * Math.PI / 180) * Math.cos(m.lat * Math.PI / 180) *
                     Math.sin(dLon/2) * Math.sin(dLon/2);
        const c = 2 * Math.atan2(Math.sqrt(latS), Math.sqrt(1-latS));
        const distKm = R * c;
        return {
          ...m,
          distance: `${distKm.toFixed(1)} km`,
          _distanceNumeric: distKm
        };
      }
      return m;
    });
  }

  // 1. Filter by specialty
  if (specialty) {
    const specStr = String(specialty).toLowerCase();
    list = list.filter(m => m.specialties.some(s => s.toLowerCase() === specStr));
  }

  // 2. Filter by search (name, address)
  if (search) {
    const query = String(search).toLowerCase();
    list = list.filter(m => 
      m.name.toLowerCase().includes(query) || 
      m.address.toLowerCase().includes(query) || 
      m.specialties.some(s => s.toLowerCase().includes(query))
    );
  }

  // 3. Filter by maximum hourly rate
  if (maxRate) {
    const rateNum = Number(maxRate);
    list = list.filter(m => m.averageHourlyRate <= rateNum);
  }

  // 4. Sort
  if (sortBy) {
    if (sortBy === 'rating') {
      list.sort((a, b) => b.rating - a.rating);
    } else if (sortBy === 'rate_asc') {
      list.sort((a, b) => a.averageHourlyRate - b.averageHourlyRate);
    } else if (sortBy === 'rate_desc') {
      list.sort((a, b) => b.averageHourlyRate - a.averageHourlyRate);
    } else if (sortBy === 'reviews') {
      list.sort((a, b) => b.reviewsCount - a.reviewsCount);
    } else if (sortBy === 'distance') {
      list.sort((a, b) => {
        const distA = a._distanceNumeric !== undefined ? a._distanceNumeric : 9999;
        const distB = b._distanceNumeric !== undefined ? b._distanceNumeric : 9999;
        return distA - distB;
      });
    }
  }

  return res.json(list);
});

// Admin additions of mechanics
router.post('/mechanics', requireAdmin, (req, res) => {
  const { name, rating, reviewsCount, address, lat, lng, phone, schedule, specialties, averageHourlyRate, distance } = req.body;

  if (!name || !address || !phone || !specialties || !averageHourlyRate) {
    return res.status(400).json({ error: 'Please enter Name, Address, Phone, Specialties arrays, and AverageHourlyRate.' });
  }

  const newMechanic = db.mechanics.create({
    name,
    rating: rating ? Number(rating) : 5.0,
    reviewsCount: reviewsCount ? Number(reviewsCount) : 1,
    address,
    lat: lat ? Number(lat) : 37.7749,
    lng: lng ? Number(lng) : -122.4194,
    phone,
    schedule: schedule || 'Mon-Fri: 9:00 AM - 5:00 PM',
    specialties: Array.isArray(specialties) ? specialties : specialties.split(',').map((s) => s.trim()),
    averageHourlyRate: Number(averageHourlyRate),
    distance: distance || '2.0 miles',
  });

  return res.status(201).json(newMechanic);
});

// Admin update of mechanics
router.put('/mechanics/:id', requireAdmin, (req, res) => {
  const { id } = req.params;
  const updates = req.body;
  const updated = db.mechanics.update(id, updates);
  if (!updated) {
    return res.status(404).json({ error: 'Mechanic not found' });
  }
  return res.json(updated);
});

// Admin delete mechanic
router.delete('/mechanics/:id', requireAdmin, (req, res) => {
  const { id } = req.params;
  const success = db.mechanics.delete(id);
  if (!success) {
    return res.status(404).json({ error: 'Mechanic not found' });
  }
  return res.json({ success: true, message: 'Mechanic removed.' });
});


// ==========================================
// 5. SERVICE LOGS HISTORY (CRUD)
// ==========================================

// Get service logs
router.get('/service-history', requireAuth, (req, res) => {
  const userId = req.user.id;
  const logs = db.serviceHistory.find(s => req.user.role === 'admin' || s.userId === userId);
  return res.json(logs);
});

// Log new service event
router.post('/service-history', requireAuth, (req, res) => {
  const { vehicleId, serviceType, description, cost, loggedBy, mechanicName, mileageAtService, serviceDate, status, damageReportId } = req.body;
  const userId = req.user.id;

  if (!vehicleId || !serviceType || !cost || !mileageAtService || !serviceDate) {
    return res.status(400).json({ error: 'Please provide vehicleId, serviceType, cost, mileageAtService, and serviceDate.' });
  }

  // Retrieve vehicle to double check and also update its mileage if this service is newer
  const vehicle = db.vehicles.findById(vehicleId);
  if (!vehicle) {
    return res.status(404).json({ error: 'Vehicle not found.' });
  }

  const newLog = db.serviceHistory.create({
    userId,
    vehicleId,
    damageReportId: damageReportId || undefined,
    serviceType,
    description: description || '',
    cost: Number(cost),
    loggedBy: loggedBy || 'user',
    mechanicName,
    mileageAtService: Number(mileageAtService),
    serviceDate,
    status: status || 'completed',
  });

  // Automatically bumper mileage if log represents higher mileage
  if (Number(mileageAtService) > vehicle.mileage) {
    const vehicleUpdates = { mileage: Number(mileageAtService) };
    if (serviceType.toLowerCase().includes('oil')) {
      vehicleUpdates.lastOilChangeMileage = Number(mileageAtService);
    }
    if (serviceType.toLowerCase().includes('tire') || serviceType.toLowerCase().includes('rotate')) {
      vehicleUpdates.lastTireRotationMileage = Number(mileageAtService);
    }
    db.vehicles.update(vehicleId, vehicleUpdates);
  }

  // Update associated damage report status if logged from a diagnosis ticket
  if (damageReportId) {
    db.damageReports.update(damageReportId, { status: 'resolved' });
  }

  return res.status(201).json(newLog);
});

// Update service log
router.put('/service-history/:id', requireAuth, (req, res) => {
  const { id } = req.params;
  const updates = req.body;

  const log = db.serviceHistory.findById(id);
  if (!log) {
    return res.status(404).json({ error: 'Log not found.' });
  }

  if (log.userId !== req.user.id && req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Unauthorized.' });
  }

  const updated = db.serviceHistory.update(id, {
    serviceType: updates.serviceType || log.serviceType,
    description: updates.description || log.description,
    cost: updates.cost !== undefined ? Number(updates.cost) : log.cost,
    mechanicName: updates.mechanicName || log.mechanicName,
    mileageAtService: updates.mileageAtService !== undefined ? Number(updates.mileageAtService) : log.mileageAtService,
    serviceDate: updates.serviceDate || log.serviceDate,
    status: updates.status || log.status,
  });

  return res.json(updated);
});

// Delete service log
router.delete('/service-history/:id', requireAuth, (req, res) => {
  const { id } = req.params;
  const log = db.serviceHistory.findById(id);
  if (!log) {
    return res.status(404).json({ error: 'Log not found.' });
  }

  if (log.userId !== req.user.id && req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Unauthorized.' });
  }

  db.serviceHistory.delete(id);
  return res.json({ success: true, message: 'Log deleted.' });
});


// ==========================================
// 6. ANALYTICS PIPELINE ENDPOINT
// ==========================================
router.get('/analytics', requireAuth, (req, res) => {
  const userId = req.user.id;
  const isAdmin = req.user.role === 'admin';

  // Filters depending on role
  const vehicles = db.vehicles.find(v => isAdmin || v.userId === userId);
  const reports = db.damageReports.find(r => isAdmin || r.userId === userId);
  const coreHistory = db.serviceHistory.find(s => (isAdmin || s.userId === userId) && s.status === 'completed');

  // Multi-vehicle ID lookup map to label charts
  const vehicleMap = {};
  vehicles.forEach(v => {
    vehicleMap[v.id] = `${v.make} ${v.model}`;
  });

  // Calculate stats
  let totalSpent = 0;
  const costByVehicleMap = {};
  const costByMonthMap = {};
  const serviceTypeCount = {};

  // Months map helper
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  coreHistory.forEach(s => {
    totalSpent += s.cost;

    // By vehicle
    const vehicleName = vehicleMap[s.vehicleId] || 'Deleted Vehicle';
    costByVehicleMap[vehicleName] = (costByVehicleMap[vehicleName] || 0) + s.cost;

    // By month
    try {
      const date = new Date(s.serviceDate);
      const year = date.getFullYear(); // e.g. 2026
      const monthLabel = `${months[date.getMonth()]} ${year}`;
      costByMonthMap[monthLabel] = (costByMonthMap[monthLabel] || 0) + s.cost;
    } catch (e) {
      // Ignored if invalid date
    }

    // By Service Type
    serviceTypeCount[s.serviceType] = (serviceTypeCount[s.serviceType] || 0) + 1;
  });

  // Reports severity counts
  const severityCount = { low: 0, medium: 0, critical: 0 };
  reports.forEach(r => {
    severityCount[r.severity] = (severityCount[r.severity] || 0) + 1;
  });

  // Format groupings into Recharts format arrays
  const costByVehicle = Object.keys(costByVehicleMap).map(name => ({
    vehicleName: name,
    cost: costByVehicleMap[name],
  }));

  const costByMonth = Object.keys(costByMonthMap).map(month => ({
    month,
    cost: costByMonthMap[month],
  })).sort((a, b) => {
    const timeA = new Date(a.month).getTime();
    const timeB = new Date(b.month).getTime();
    if (isNaN(timeA) && isNaN(timeB)) return 0;
    if (isNaN(timeA)) return 1;
    if (isNaN(timeB)) return -1;
    return timeA - timeB;
  });

  const reportSeverityBreakdown = Object.keys(severityCount).map(key => ({
    name: key.toUpperCase(),
    value: severityCount[key],
  }));

  const serviceTypeBreakdown = Object.keys(serviceTypeCount).map(key => ({
    name: key,
    value: serviceTypeCount[key],
  }));

  const payload = {
    totalSpent,
    totalVehicles: vehicles.length,
    totalReports: reports.length,
    serviceHistoryCount: coreHistory.length,
    costByVehicle,
    costByMonth,
    reportSeverityBreakdown,
    serviceTypeBreakdown,
  };

  return res.json(payload);
});


// ==========================================
// CHAT & MESSAGING SYSTEM
// ==========================================

// Create/Fetch Chat & Send First Message
router.post('/chats', requireAuth, async (req, res) => {
  const { mechanicId, message } = req.body;
  const currentUserId = req.user.id;
  const currentRole = req.user.role === 'mechanic' ? 'mechanic' : 'user';

  if (!mechanicId || !message || message.trim() === '') {
    return res.status(400).json({ error: 'Please provide mechanicId and initial message.' });
  }

  // Find if a chat already exists between these two participants
  let chat = db.chats.findOne(c => c.participants.includes(currentUserId) && c.participants.includes(mechanicId));

  const nowIso = new Date().toISOString();

  if (!chat) {
    chat = db.chats.create({
      id: 'cht_' + Math.random().toString(36).substring(2, 11),
      participants: [currentUserId, mechanicId],
      createdAt: nowIso,
      updatedAt: nowIso,
    });
  } else {
    db.chats.update(chat.id, { updatedAt: nowIso });
  }

  let repairRequest = chat.requestId ? db.repairRequests.findById(chat.requestId) : null;
  if (!repairRequest && currentRole === 'user') {
    const currentUserIds = await getCurrentAccountIds(req);
    const vehicle = getLatestVehicleForUser(currentUserIds);
    const requestId = 'req_' + Math.random().toString(36).substring(2, 11);

    repairRequest = db.repairRequests.create({
      id: requestId,
      userId: currentUserId,
      mechanicId,
      vehicleId: vehicle?.id || 'direct_contact',
      damageType: 'General Inquiry',
      description: message.trim(),
      status: 'Pending',
      chatId: chat.id,
      createdAt: nowIso,
    });

    chat = db.chats.update(chat.id, {
      requestId,
      userId: currentUserId,
      mechanicId,
      updatedAt: nowIso,
    }) || chat;
  }

  // Create first message
  const newMsg = db.messages.create({
    id: 'msg_' + Math.random().toString(36).substring(2, 11),
    chatId: chat.id,
    senderId: currentUserId,
    senderRole: currentRole,
    receiverId: mechanicId,
    message: message.trim(),
    timestamp: nowIso,
    isRead: false,
  });

  // Create highly-visible Notification
  const senderName = req.user.name;
  const ntf = db.notifications.create({
    id: 'ntf_' + Math.random().toString(36).substring(2, 11),
    userId: mechanicId,
    message: `New repair inquiry received from ${senderName}`,
    isRead: false,
    createdAt: nowIso
  });

  // Real-time socket updates
  try {
    broadcastRestMessage(mechanicId, newMsg);
    sendRealtimeNotification(mechanicId, ntf);
  } catch (err) {
    console.warn('[Socket Broadcast] Failed broadcast of rest message:', err);
  }

  return res.status(201).json({ chat, message: newMsg, repairRequest });
});

// Retrieve all enriched chats for the logged-in user or mechanic
router.get('/chats', requireAuth, async (req, res) => {
  const currentUserId = req.user.id;
  const currentRole = req.user.role;
  const currentAccountIds = await getCurrentAccountIds(req);

  // Find chats containing current user
  const list = db.chats.find(c => c.participants.some(p => currentAccountIds.includes(p)));

  const enriched = await Promise.all(list.map(async (chat) => {
    const otherId = chat.participants.find((p) => !currentAccountIds.includes(p));
    const lastMessageList = db.messages.find(m => m.chatId === chat.id)
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    const lastMessage = lastMessageList[0] || null;

    // Unread count (messages sent by the other participant inside this chat that are unread)
    const unreadCount = db.messages.find(m => m.chatId === chat.id && m.senderId === otherId && !m.isRead).length;

    let otherName = 'Anonymous';
    let mechanicDetails = null;
    let userDetails = null;
    let vehicleDetails = null;
    let repairRequestDetails = null;

    if (chat.requestId) {
      const rr = db.repairRequests.findById(chat.requestId);
      if (rr) {
        repairRequestDetails = rr;
        const v = db.vehicles.findById(rr.vehicleId);
        if (v) {
          vehicleDetails = v;
        }
      }
    }

    if (currentRole === 'mechanic') {
      // Other person is a user (vehicle owner)
      const u = await findAuthAccountById(otherId);
      if (u) {
        otherName = u.name;
        userDetails = {
          id: u.id,
          name: u.name,
          email: u.email,
        };
        // Retrieve users latest vehicle registered if not overridden by repairRequest
        if (!vehicleDetails) {
          const uVehicles = db.vehicles.find(v => v.userId === otherId);
          if (uVehicles.length > 0) {
            const sortedVehList = uVehicles.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
            vehicleDetails = sortedVehList[0];
          }
        }
      }
    } else {
      // Other person is a mechanic
      const m = (db.mechanics.findById(otherId) || await findAuthAccountById(otherId));
      if (m) {
        otherName = m.name;
        mechanicDetails = {
          id: m.id,
          name: m.name,
          rating: m.rating || 5.0,
          reviewsCount: m.reviewsCount || 0,
          phone: m.phone || '(415) 555-0100',
          averageHourlyRate: m.averageHourlyRate || 120,
          address: m.address || 'San Francisco, CA',
        };
      }
    }

    return {
      id: chat.id,
      requestId: chat.requestId || null,
      repairRequest: repairRequestDetails,
      participants: chat.participants,
      createdAt: chat.createdAt,
      updatedAt: chat.updatedAt,
      otherParticipant: {
        id: otherId,
        name: otherName,
      },
      mechanicDetails,
      userDetails,
      vehicleDetails,
      lastMessage,
      unreadCount,
    };
  }));

  // Sort by updatedAt descending
  enriched.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());

  return res.json(enriched);
});

// Retrieve all messages for a specific chat and mark incoming ones as read
router.get('/chats/:chatId/messages', requireAuth, async (req, res) => {
  const { chatId } = req.params;
  const currentUserId = req.user.id;
  const currentAccountIds = await getCurrentAccountIds(req);

  const chat = db.chats.findById(chatId);
  if (!chat || !chat.participants.some(p => currentAccountIds.includes(p))) {
    return res.status(403).json({ error: 'Access denied to this chat.' });
  }

  // Get and sort messages chronologically
  const list = db.messages.find(m => m.chatId === chatId)
    .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

  // Mark other person's messages as read
  const unreadMessages = db.messages.find(m => m.chatId === chatId && currentAccountIds.includes(m.receiverId) && !m.isRead);
  unreadMessages.forEach(m => {
    db.messages.update(m.id, { isRead: true });
  });

  return res.json(list);
});

// Send a replying message to a chat
router.post('/chats/:chatId/messages', requireAuth, async (req, res) => {
  const { chatId } = req.params;
  const { message } = req.body;
  const currentUserId = req.user.id;
  const currentRole = req.user.role === 'mechanic' ? 'mechanic' : 'user';
  const currentAccountIds = await getCurrentAccountIds(req);

  if (!message || message.trim() === '') {
    return res.status(400).json({ error: 'Message content cannot be blank' });
  }

  const chat = db.chats.findById(chatId);
  if (!chat || !chat.participants.some(p => currentAccountIds.includes(p))) {
    return res.status(403).json({ error: 'Access denied to this chat.' });
  }

  const receiverId = chat.participants.find((p) => !currentAccountIds.includes(p));
  const nowIso = new Date().toISOString();

  // Create message
  const newMsg = db.messages.create({
    id: 'msg_' + Math.random().toString(36).substring(2, 11),
    chatId,
    senderId: currentUserId,
    senderRole: currentRole,
    receiverId,
    message: message.trim(),
    timestamp: nowIso,
    isRead: false,
  });

  // Update chat updated timestamp
  db.chats.update(chatId, { updatedAt: nowIso });

  // Notification message choice
  let notificationMsg = '';
  if (currentRole === 'user') {
    notificationMsg = "New message received from customer.";
  } else {
    notificationMsg = "Mechanic replied to your repair request.";
  }

  const ntf = db.notifications.create({
    id: 'ntf_' + Math.random().toString(36).substring(2, 11),
    userId: receiverId,
    message: notificationMsg,
    isRead: false,
    createdAt: nowIso
  });

  // Real-time socket updates
  try {
    broadcastRestMessage(receiverId, newMsg);
    sendRealtimeNotification(receiverId, ntf);
  } catch (err) {
    console.warn('[Socket Broadcast] Failed broadcast of reply message:', err);
  }

  return res.status(201).json(newMsg);
});

// Retrieve unread notifications
router.get('/notifications', requireAuth, (req, res) => {
  const currentUserId = req.user.id;
  const list = db.notifications.find(n => n.userId === currentUserId && !n.isRead)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  return res.json(list);
});

// Retrieve list of currently online user IDs
router.get('/chats/online', requireAuth, (req, res) => {
  return res.json(getOnlineUsersList());
});

// Mark all user notifications as read
router.put('/notifications/read', requireAuth, (req, res) => {
  const currentUserId = req.user.id;
  const list = db.notifications.find(n => n.userId === currentUserId && !n.isRead);
  list.forEach(n => {
    db.notifications.update(n.id, { isRead: true });
  });
  return res.json({ success: true, count: list.length });
});


// ==========================================
// 4. REPAIR REQUEST ENDPOINTS
// ==========================================

// Create Repair Request and Chat Conversation
router.post('/repair-requests', requireAuth, (req, res) => {
  const { mechanicId, vehicleId, damageType, description, damageReportId } = req.body;
  const userId = req.user.id;

  if (!mechanicId || !vehicleId || !damageType) {
    return res.status(400).json({ error: 'Please provide mechanicId, vehicleId, and damageType.' });
  }

  const vehicle = db.vehicles.findById(vehicleId);
  if (!vehicle) {
    return res.status(404).json({ error: 'Selected vehicle not found.' });
  }

  if (vehicle.userId !== userId && req.user.role !== 'admin') {
    return res.status(403).json({ error: 'You are not allowed to create repair requests for this vehicle.' });
  }

  const approvedReports = db.damageReports
    .find((report) =>
      report.userId === userId &&
      report.vehicleId === vehicleId &&
      report.approvalStatus === 'APPROVED' &&
      report.aiDiagnosis?.approvalStatus === 'APPROVED'
    )
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  const approvedReport = damageReportId
    ? approvedReports.find((report) => report.id === damageReportId)
    : approvedReports[0];

  if (!approvedReport) {
    return res.status(422).json({
      error: 'A strict AI-approved vehicle damage scan is required before creating a repair request.',
    });
  }

  const nowIso = new Date().toISOString();
  const requestId = 'req_' + Math.random().toString(36).substring(2, 11);
  const chatId = 'cht_' + Math.random().toString(36).substring(2, 11);
  const approvedDamageType = approvedReport.damageType || approvedReport.aiDiagnosis?.damageType || damageType;

  // 1. Create dedicated chat conversation
  const chat = db.chats.create({
    id: chatId,
    requestId: requestId,
    userId: userId,
    mechanicId: mechanicId,
    participants: [userId, mechanicId],
    createdAt: nowIso,
    updatedAt: nowIso,
  });

  // 2. Create automatic initial conversation message
  const initialMessageText = `Hello, I need help with a ${approvedDamageType}.`;
  const initialMsg = db.messages.create({
    id: 'msg_' + Math.random().toString(36).substring(2, 11),
    chatId: chatId,
    senderId: userId,
    senderRole: 'user',
    receiverId: mechanicId,
    message: initialMessageText,
    timestamp: nowIso,
    isRead: false,
  });

  // 3. Create the Repair Request itself
  const repairRequest = db.repairRequests.create({
    id: requestId,
    userId,
    mechanicId,
    vehicleId,
    damageReportId: approvedReport.id,
    damageType: approvedDamageType,
    description: description || approvedReport.description || '',
    fraudRisk: approvedReport.fraudRisk,
    validationConfidence: approvedReport.validationConfidence,
    status: 'Pending',
    chatId: chatId,
    createdAt: nowIso,
  });

  // 4. Create Notification for the mechanic
  const ntf = db.notifications.create({
    id: 'ntf_' + Math.random().toString(36).substring(2, 11),
    userId: mechanicId,
    message: 'New message received from customer.',
    isRead: false,
    createdAt: nowIso
  });

  // Real-time socket updates
  try {
    broadcastRestMessage(mechanicId, initialMsg);
    sendRealtimeNotification(mechanicId, ntf);
  } catch (err) {
    console.warn('[Socket Broadcast] Failed broadcast of initial message:', err);
  }

  return res.status(201).json({ repairRequest, chat });
});

// Retrieve enriched repair requests (filtered by logged-in role)
router.get('/repair-requests', requireAuth, async (req, res) => {
  const currentUserId = req.user.id;
  const currentRole = req.user.role;
  const currentAccountIds = await getCurrentAccountIds(req);

  let requests = [];
  if (currentRole === 'mechanic') {
    requests = db.repairRequests.find(r => currentAccountIds.includes(r.mechanicId));
  } else if (currentRole === 'admin') {
    requests = db.repairRequests.find();
  } else {
    requests = db.repairRequests.find(r => currentAccountIds.includes(r.userId));
  }

  const requestChatIds = new Set(requests.map(r => r.chatId).filter(Boolean));
  const directChats = db.chats.find(c =>
    !c.requestId &&
    !requestChatIds.has(c.id) &&
    c.participants.some(p => currentAccountIds.includes(p))
  );

  const syntheticDirectRequests = directChats.map((chat) => {
    const mechanicId = chat.mechanicId || (
      currentRole === 'mechanic'
        ? currentAccountIds.find(id => chat.participants.includes(id)) || currentUserId
        : chat.participants.find(id => !currentAccountIds.includes(id))
    );
    const userId = chat.userId || (
      currentRole === 'mechanic'
        ? chat.participants.find(id => !currentAccountIds.includes(id))
        : currentAccountIds.find(id => chat.participants.includes(id)) || currentUserId
    );
    const firstMessage = db.messages.find(m => m.chatId === chat.id)
      .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())[0];

    return {
      id: `direct_${chat.id}`,
      userId,
      mechanicId,
      vehicleId: 'direct_contact',
      damageType: 'General Inquiry',
      description: firstMessage?.message || 'Direct chat inquiry',
      status: 'Pending',
      chatId: chat.id,
      createdAt: chat.createdAt,
      isDirectChat: true,
    };
  });

  requests = [...requests, ...syntheticDirectRequests];

  const enriched = await Promise.all(requests.map(async (r) => {
    const vehicle = db.vehicles.findById(r.vehicleId);
    const user = await findAuthAccountById(r.userId);
    const mechanic = db.mechanics.findById(r.mechanicId) || await findAuthAccountById(r.mechanicId);
    
    return {
      ...r,
      vehicleDetails: vehicle,
      userDetails: user ? { id: user.id, name: user.name, email: user.email } : null,
      mechanicDetails: mechanic ? { id: mechanic.id, name: mechanic.name, phone: mechanic.phone, address: mechanic.address, distance: mechanic.distance || '1.5 km' } : null,
    };
  }));

  // Sort by createdAt desc
  enriched.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  return res.json(enriched);
});

// Retrieve details for a single repair request
router.get('/repair-requests/:requestId', requireAuth, async (req, res) => {
  const { requestId } = req.params;
  const currentUserId = req.user.id;
  const currentRole = req.user.role;

  const r = db.repairRequests.findById(requestId);
  if (!r) {
    return res.status(404).json({ error: 'Repair request not found' });
  }

  if (currentRole !== 'admin' && r.userId !== currentUserId && r.mechanicId !== currentUserId) {
    return res.status(403).json({ error: 'Access denied to this request' });
  }

  const vehicle = db.vehicles.findById(r.vehicleId);
  const user = await findAuthAccountById(r.userId);
  const mechanic = db.mechanics.findById(r.mechanicId) || await findAuthAccountById(r.mechanicId);

  return res.json({
    ...r,
    vehicleDetails: vehicle,
    userDetails: user ? { id: user.id, name: user.name, email: user.email } : null,
    mechanicDetails: mechanic ? { id: mechanic.id, name: mechanic.name, phone: mechanic.phone, address: mechanic.address, distance: mechanic.distance || '1.5 km' } : null,
  });
});

// Update repair request status indicator (Pending, Accepted, In Progress, Completed, Rejected)
router.put('/repair-requests/:requestId/status', requireAuth, async (req, res) => {
  let { requestId } = req.params;
  const { status } = req.body;
  const currentUserId = req.user.id;
  const currentRole = req.user.role;
  const currentAccountIds = await getCurrentAccountIds(req);

  const validStatuses = ['Pending', 'Accepted', 'In Progress', 'Completed', 'Rejected'];
  if (!status || !validStatuses.includes(status)) {
    return res.status(400).json({ error: 'Invalid or missing status indicator.' });
  }

  let r = db.repairRequests.findById(requestId);
  if (!r && requestId.startsWith('direct_')) {
    const chatId = requestId.replace(/^direct_/, '');
    const chat = db.chats.findById(chatId);
    if (chat && chat.participants.some(p => currentAccountIds.includes(p))) {
      const otherId = chat.participants.find(p => !currentAccountIds.includes(p));
      const firstMessage = db.messages.find(m => m.chatId === chat.id)
        .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())[0];
      const createdRequestId = 'req_' + Math.random().toString(36).substring(2, 11);

      r = db.repairRequests.create({
        id: createdRequestId,
        userId: currentRole === 'mechanic' ? otherId : currentUserId,
        mechanicId: currentRole === 'mechanic' ? (currentAccountIds.find(id => chat.participants.includes(id)) || currentUserId) : otherId,
        vehicleId: 'direct_contact',
        damageType: 'General Inquiry',
        description: firstMessage?.message || 'Direct chat inquiry',
        status: 'Pending',
        chatId: chat.id,
        createdAt: chat.createdAt,
      });
      db.chats.update(chat.id, {
        requestId: createdRequestId,
        userId: r.userId,
        mechanicId: r.mechanicId,
      });
      requestId = createdRequestId;
    }
  }
  if (!r) {
    return res.status(404).json({ error: 'Repair request not found' });
  }

  if (currentRole !== 'admin' && !currentAccountIds.includes(r.mechanicId)) {
    return res.status(403).json({ error: 'Access denied. Only the assigned mechanic can update status.' });
  }

  const updated = db.repairRequests.update(requestId, { status });

  // Notify user with custom message
  let message = '';
  if (status === 'Accepted') message = 'Mechanic accepted your repair request.';
  else if (status === 'In Progress') message = 'Mechanic marked your repair request as In Progress.';
  else if (status === 'Completed') message = 'Mechanic marked your repair request as Completed.';
  else if (status === 'Rejected') message = 'Mechanic declined your repair request.';
  else message = `Repair request status is now: ${status}`;

  db.notifications.create({
    id: 'ntf_' + Math.random().toString(36).substring(2, 11),
    userId: r.userId,
    message,
    isRead: false,
    createdAt: new Date().toISOString()
  });

  return res.json(updated);
});


export default router;
