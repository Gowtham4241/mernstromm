// VehicleDetails.js
import React, { useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { 
  ChevronLeft, Gauge, Calendar, ClipboardList, PenTool, 
  Settings, Battery, Disc, HelpCircle, PlusCircle, Trash2, 
  CheckCircle2, AlertTriangle, FileText, Sparkles, DollarSign 
} from 'lucide-react';

export default function VehicleDetails({ token, vehicles, reports, serviceHistory, onRefresh }) {
  const { id } = useParams();
  const navigate = useNavigate();

  // Selected vehicle lookup
  const vehicle = vehicles.find((v) => v.id === id);

  // States
  const [odometer, setOdometer] = useState(vehicle ? String(vehicle.mileage) : '');
  const [updatingOdo, setUpdatingOdo] = useState(false);
  const [odoSuccess, setOdoSuccess] = useState(false);

  // Log Service form state
  const [showLogForm, setShowLogForm] = useState(false);
  const [serviceType, setServiceType] = useState('Maintenance');
  const [description, setDescription] = useState('');
  const [cost, setCost] = useState('');
  const [mileageAtService, setMileageAtService] = useState(vehicle ? String(vehicle.mileage) : '');
  const [serviceDate, setServiceDate] = useState(new Date().toISOString().split('T')[0]);
  const [loggedBy, setLoggedBy] = useState('user');
  const [mechanicName, setMechanicName] = useState('');
  
  const [submittingService, setSubmittingService] = useState(false);
  const [serviceError, setServiceError] = useState('');

  if (!vehicle) {
    return (
      <div className="bg-slate-900 border border-slate-800 p-8 rounded-2xl text-center font-sans space-y-4">
        <AlertTriangle className="text-red-500 w-12 h-12 mx-auto" />
        <h2 className="text-xl font-bold text-white">Vehicle telemetry not found</h2>
        <p className="text-slate-400 text-sm">The vehicle with configuration ID "{id}" is not registered in your active garage.</p>
        <Link to="/garage" className="inline-block bg-red-650 hover:bg-red-600 text-white px-5 py-2 rounded-xl text-xs font-bold transition">
          Return to Garage
        </Link>
      </div>
    );
  }

  // Filter associated records
  const vehicleReports = reports.filter((r) => r.vehicleId === vehicle.id);
  const vehicleHistory = serviceHistory.filter((s) => s.vehicleId === vehicle.id);

  // Quick safety score estimates
  const lastOilChange = vehicle.lastOilChangeMileage || 0;
  const milesSinceOil = vehicle.mileage - lastOilChange;
  const oilPercentLeft = Math.max(0, Math.min(100, Math.round(((5000 - milesSinceOil) / 5000) * 100)));

  const lastRotation = vehicle.lastTireRotationMileage || 0;
  const milesSinceRotation = vehicle.mileage - lastRotation;
  const rotationPercentLeft = Math.max(0, Math.min(100, Math.round(((7500 - milesSinceRotation) / 7500) * 100)));

  // Odometer sync handler
  const handleUpdateOdometer = async (e) => {
    e.preventDefault();
    setUpdatingOdo(true);
    setOdoSuccess(false);

    try {
      await axios.put(
        `/api/vehicles/${vehicle.id}`,
        { mileage: Number(odometer) },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setOdoSuccess(true);
      onRefresh();
    } catch (err) {
      console.error(err);
    } finally {
      setUpdatingOdo(false);
    }
  };

  // Log Service submit action
  const handleLogService = async (e) => {
    e.preventDefault();
    setSubmittingService(true);
    setServiceError('');

    if (!serviceType || !cost || !mileageAtService || !serviceDate) {
      setServiceError('Please fill out all required fields.');
      setSubmittingService(false);
      return;
    }

    try {
      await axios.post(
        '/api/service-history',
        {
          vehicleId: vehicle.id,
          serviceType,
          description,
          cost: Number(cost),
          loggedBy,
          mechanicName: loggedBy === 'mechanic' ? mechanicName : undefined,
          mileageAtService: Number(mileageAtService),
          serviceDate,
          status: 'completed',
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      onRefresh();
      setShowLogForm(false);
      // Reset form fields
      setDescription('');
      setCost('');
      setMechanicName('');
    } catch (err) {
      console.error(err);
      setServiceError(err.response?.data?.error || 'Failed to register service event.');
    } finally {
      setSubmittingService(false);
    }
  };

  // Delete vehicle
  const handleDeleteVehicle = async () => {
    if (!window.confirm(`Are you sure you want to permanently remove this ${vehicle.make} ${vehicle.model} and cascade delete all its service logs and AI scans?`)) return;
    try {
      await axios.delete(`/api/vehicles/${vehicle.id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      onRefresh();
      navigate('/garage');
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="space-y-6" id="vehicle-details-main">
      {/* Back link */}
      <div className="flex items-center justify-between">
        <Link to="/garage" className="inline-flex items-center gap-1.5 text-slate-400 hover:text-white text-xs font-bold transition">
          <ChevronLeft className="w-4 h-4" />
          Back to Garage
        </Link>
        <button
          onClick={handleDeleteVehicle}
          className="text-slate-500 hover:text-red-400 p-2 hover:bg-red-950/20 rounded-xl transition cursor-pointer"
          title="Scrap Vehicle and clear history logs"
        >
          <Trash2 className="w-4.5 h-4.5" />
        </button>
      </div>

      {/* Hero Title Grid Panel */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-1">
            <div className="inline-flex items-center gap-2 px-2.5 py-0.5 rounded-full bg-slate-950 border border-slate-800 text-xs font-bold text-slate-300 uppercase tracking-widest">
              {vehicle.vehicleType || 'Vehicle'} - {vehicle.year} Model
            </div>
            <h1 className="text-3xl font-black text-white tracking-tight">
              {vehicle.make} {vehicle.model}
            </h1>
            <p className="text-xs text-slate-400 flex items-center gap-4">
              <span className="font-mono bg-slate-950 px-2.5 py-1 rounded border border-slate-800">
                PLATE: {vehicle.licensePlate}
              </span>
              <span className="flex items-center gap-1 font-semibold text-slate-305">
                <Gauge className="w-4 h-4 text-red-500" />
                {vehicle.mileage.toLocaleString()} miles
              </span>
            </p>
          </div>

          {/* Quick Mileage Update form (styled like center slider console) */}
          <form onSubmit={handleUpdateOdometer} className="bg-slate-950 border border-slate-850 p-4 rounded-xl flex items-center gap-3 shrink-0">
            <div>
              <label className="block text-[10px] font-black uppercase text-slate-500 tracking-wider">Sync Active Odometer</label>
              <input
                type="number"
                required
                value={odometer}
                onChange={(e) => setOdometer(e.target.value)}
                className="bg-transparent border-b border-slate-800 focus:border-red-500 text-sm font-bold text-slate-200 outline-none w-28 py-0.5"
              />
            </div>
            <button
              type="submit"
              disabled={updatingOdo}
              className="bg-slate-900 border border-slate-800 hover:bg-slate-800 text-xs font-bold px-3 py-2 rounded-lg transition text-slate-300 shrink-0 cursor-pointer"
            >
              {updatingOdo ? 'Saving...' : odoSuccess ? 'Synced ✓' : 'Update'}
            </button>
          </form>
        </div>
      </div>

      {/* Grid of Telemetries (Tesla Panel layout) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left Column: Mechanical Fluid Gauges */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-sm space-y-6">
          <h3 className="text-xs font-black uppercase text-slate-100 tracking-wider flex items-center gap-1.5 border-b border-slate-800 pb-3">
            <PenTool className="text-red-500 w-4 h-4" />
            Interval Checklist
          </h3>

          {/* Oil Change Gauge */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="font-bold text-slate-300">Engine Oil Viscosity</span>
              <span className={`font-mono font-bold ${oilPercentLeft <= 10 ? 'text-red-400' : 'text-emerald-400'}`}>
                {oilPercentLeft}% Remaining
              </span>
            </div>
            <div className="w-full bg-slate-950 rounded-full h-2 overflow-hidden border border-slate-850">
              <div 
                className={`h-full rounded-full transition-all duration-500 ${
                  oilPercentLeft <= 15 ? 'bg-red-500 animate-pulse' : 'bg-gradient-to-r from-emerald-500 to-green-400'
                }`}
                style={{ width: `${oilPercentLeft}%` }}
              ></div>
            </div>
            <p className="text-[10px] text-slate-500 leading-normal">
              {milesSinceOil >= 5000 
                ? 'Interval critical! Replaced oil and filter immediately to avoid wear.' 
                : `${(5000 - milesSinceOil).toLocaleString()} miles remaining till 5,000 mi standard change.`
              }
            </p>
          </div>

          {/* Tire Rotation Gauge */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="font-bold text-slate-300">Tire Tread Rotation</span>
              <span className={`font-mono font-bold ${rotationPercentLeft <= 10 ? 'text-amber-400' : 'text-emerald-400'}`}>
                {rotationPercentLeft}% Tread Stability
              </span>
            </div>
            <div className="w-full bg-slate-950 rounded-full h-2 overflow-hidden border border-slate-850">
              <div 
                className={`h-full rounded-full transition-all duration-500 ${
                  rotationPercentLeft <= 15 ? 'bg-amber-500' : 'bg-gradient-to-r from-emerald-500 to-green-400'
                }`}
                style={{ width: `${rotationPercentLeft}%` }}
              ></div>
            </div>
            <p className="text-[10px] text-slate-500 leading-normal">
              {milesSinceRotation >= 7500 
                ? 'Rotate tires to equalize tire shoulder abrasion index.' 
                : `${(7500 - milesSinceRotation).toLocaleString()} miles remaining till 7,500 mi schedule.`
              }
            </p>
          </div>

          {/* Additional telemetry indicators */}
          <div className="pt-4 border-t border-slate-800/80 space-y-3.5">
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-400 flex items-center gap-1.5">
                <Battery className="w-4 h-4 text-emerald-500" />
                Auxiliary Battery Capacity
              </span>
              <span className="font-bold text-emerald-400 font-mono">12.6V • Excellent</span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-400 flex items-center gap-1.5">
                <Disc className="w-4 h-4 text-indigo-500" />
                Anti-lock Brakes Pad Wear
              </span>
              <span className="font-bold text-green-400 font-mono">11mm (85% safe)</span>
            </div>
          </div>
        </div>

        {/* Middle Column: Tesla Interactive Wheel pressure chart */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-sm flex flex-col justify-between">
          <h3 className="text-xs font-black uppercase text-slate-100 tracking-wider border-b border-slate-800 pb-3 block">
            Wheel Diagnostic Sensings
          </h3>

          {/* Visual Vehicle outlines showing tire pressures */}
          <div className="my-auto py-4 relative flex items-center justify-center">
            {/* Simple CSS vector structure for vehicle silhouette */}
            <div className="w-24 h-44 border-2 border-slate-800/80 rounded-3xl relative bg-slate-950/50 flex flex-col justify-between p-4">
              <div className="w-full text-[10px] text-center font-black text-slate-700 mt-2">FRONT</div>
              <div className="w-full text-[10px] text-center font-black text-slate-700 mb-2">REAR</div>
              
              {/* Wheel graphics */}
              {/* FL */}
              <div className="absolute -top-1 -left-3 w-3 h-10 bg-slate-800 border border-slate-700 rounded-md"></div>
              {/* FR */}
              <div className="absolute -top-1 -right-3 w-3 h-10 bg-slate-800 border border-slate-700 rounded-md"></div>
              {/* RL */}
              <div className="absolute -bottom-1 -left-3 w-3 h-10 bg-slate-800 border border-slate-700 rounded-md"></div>
              {/* RR */}
              <div className="absolute -bottom-1 -right-3 w-3 h-10 bg-slate-800 border border-slate-700 rounded-md"></div>
            </div>

            {/* Tire inflation pressure values */}
            {/* Front Left */}
            <div className="absolute top-8 left-6 text-center">
              <p className="text-emerald-400 text-xs font-black">34 psi</p>
              <p className="text-[8px] text-slate-500 font-bold uppercase">OK</p>
            </div>
            {/* Front Right */}
            <div className="absolute top-8 right-6 text-center">
              <p className="text-emerald-400 text-xs font-black">34 psi</p>
              <p className="text-[8px] text-slate-500 font-bold uppercase">OK</p>
            </div>
            {/* Rear Left */}
            <div className="absolute bottom-8 left-6 text-center">
              <p className="text-emerald-400 text-xs font-black">35 psi</p>
              <p className="text-[8px] text-slate-500 font-bold uppercase">OK</p>
            </div>
            {/* Rear Right */}
            <div className="absolute bottom-8 right-6 text-center">
              <p className="text-emerald-400 text-xs font-black">33 psi</p>
              <p className="text-[8px] text-slate-500 font-bold uppercase">OK</p>
            </div>
          </div>

          <p className="text-[10px] text-center text-slate-550 italic block border-t border-slate-850 pt-2.5">
            Pressure sensors updated live. Ambient temperature: 68°F.
          </p>
        </div>

        {/* Right Column: AI Scan Damage and active tickets */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-sm flex flex-col justify-between">
          <div>
            <h3 className="text-xs font-black uppercase text-slate-100 tracking-wider flex items-center gap-1.5 border-b border-slate-800 pb-3 mb-4">
              <Sparkles className="text-rose-500 w-4 h-4" />
              AI Appraisal Scan list
            </h3>

            {vehicleReports.length === 0 ? (
              <div className="text-center py-6 border border-dashed border-slate-800 rounded-xl bg-slate-950/20">
                <p className="text-xs text-slate-400 font-semibold">No damage reports filed.</p>
                <p className="text-[10px] text-slate-500 mt-1 max-w-[200px] mx-auto">Use the AI Scan tab to upload scraped surfaces for diagnostic pricing.</p>
              </div>
            ) : (
              <div className="space-y-3 max-h-56 overflow-y-auto pr-1" id="vehicle-reports-list">
                {vehicleReports.map((r) => (
                  <div key={r.id} className="p-3 bg-slate-950 rounded-xl border border-slate-850 flex gap-3.5 items-center justify-between">
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className={`w-1.5 h-1.5 rounded-full ${
                          r.severity === 'critical' ? 'bg-red-500' : r.severity === 'medium' ? 'bg-orange-500' : 'bg-green-500'
                        }`}></span>
                        <p className="text-xs font-bold text-slate-200 capitalize truncate max-w-[120px]">{r.description}</p>
                      </div>
                      <p className="text-[9px] text-slate-450 mt-1 uppercase font-mono">{r.status}</p>
                    </div>
                    <Link
                      to="/damage-upload"
                      className="bg-slate-900 border border-slate-800 hover:bg-slate-800 text-[10px] font-bold px-3 py-1.5 rounded-lg text-slate-300 transition"
                    >
                      View Appraisals &rarr;
                    </Link>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="mt-4 pt-4 border-t border-slate-800/80">
            <Link
              to="/damage-upload"
              className="w-full text-center bg-red-650 hover:bg-red-600 text-white font-bold text-xs py-2 px-3 rounded-xl transition flex items-center justify-center gap-1 leading-normal"
            >
              <PlusCircle className="w-4 h-4" />
              New AI Damage appraisal
            </Link>
          </div>
        </div>

      </div>

      {/* Service Events Timeline Block */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* History log timeline (Span 2) */}
        <div className="lg:col-span-2 bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <h3 className="text-xs font-black uppercase text-slate-100 tracking-wider flex items-center gap-1.5">
              <ClipboardList className="text-zinc-400 w-4.5 h-4.5" />
              Service & Invoice Logs
            </h3>
            <button
              onClick={() => setShowLogForm(!showLogForm)}
              className="bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs px-3 py-1.5 rounded-lg transition flex items-center gap-1 cursor-pointer"
            >
              <PlusCircle className="w-4 h-4" />
              {showLogForm ? 'Close panel' : 'Log Maintenance event'}
            </button>
          </div>

          {/* Collapsible log form */}
          {showLogForm && (
            <form onSubmit={handleLogService} className="bg-slate-950 p-4 border border-slate-800 rounded-xl space-y-4 font-sans animate-fadeIn">
              <h4 className="text-xs font-black text-white uppercase text-red-400">Register Service completion</h4>
              {serviceError && <div className="text-xs bg-red-950/20 border-red-500/20 text-red-400 p-2 rounded">{serviceError}</div>}
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Service category *</label>
                  <select
                    value={serviceType}
                    onChange={(e) => setServiceType(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-800 focus:border-red-500 rounded-lg p-2 text-xs text-white"
                  >
                    <option value="Maintenance">Scheduled Maintenance</option>
                    <option value="Repair">Mechanical Repair</option>
                    <option value="Diagnostic">Electronics Diagnostic</option>
                    <option value="Body Shop">Body / Cosmetics Work</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Odometer Mileage at Service *</label>
                  <input
                    type="number"
                    required
                    value={mileageAtService}
                    onChange={(e) => setMileageAtService(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-800 focus:border-red-500 rounded-lg p-2 text-xs text-white"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Total Bill Invoice Cost ($) *</label>
                  <input
                    type="number"
                    required
                    value={cost}
                    onChange={(e) => setCost(e.target.value)}
                    placeholder="185"
                    className="w-full bg-slate-900 border border-slate-800 focus:border-red-500 rounded-lg p-2 text-xs text-white"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Completed Date *</label>
                  <input
                    type="date"
                    required
                    value={serviceDate}
                    onChange={(e) => setServiceDate(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-800 focus:border-red-500 rounded-lg p-2 text-xs text-white"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Log registered by</label>
                <div className="flex gap-4">
                  <label className="flex items-center gap-1.5 text-xs text-slate-350 cursor-pointer">
                    <input
                      type="radio"
                      name="loggedBy"
                      checked={loggedBy === 'user'}
                      onChange={() => setLoggedBy('user')}
                      className="text-red-500 focus:ring-red-500 bg-slate-900"
                    />
                    <span>Self-logged (DIY / User)</span>
                  </label>
                  <label className="flex items-center gap-1.5 text-xs text-slate-350 cursor-pointer">
                    <input
                      type="radio"
                      name="loggedBy"
                      checked={loggedBy === 'mechanic'}
                      onChange={() => setLoggedBy('mechanic')}
                      className="text-red-500 focus:ring-red-500 bg-slate-900"
                    />
                    <span>Workshop Certified mechanic</span>
                  </label>
                </div>
              </div>

              {loggedBy === 'mechanic' && (
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Mechanic Shop Name</label>
                  <input
                    type="text"
                    value={mechanicName}
                    onChange={(e) => setMechanicName(e.target.value)}
                    placeholder="Mission Auto Care & Tuning"
                    className="w-full bg-slate-900 border border-slate-800 focus:border-red-500 rounded-lg p-2 text-xs text-white"
                  />
                </div>
              )}

              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Invoice detail / Description</label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Replaced engine oil and gasket, spark plug test completed..."
                  rows={2}
                  className="w-full bg-slate-900 border border-slate-800 focus:border-red-500 rounded-lg p-2 text-xs text-white resize-none"
                />
              </div>

              <button
                type="submit"
                disabled={submittingService}
                className="bg-red-600 hover:bg-red-500 text-white font-bold text-xs py-2 px-4 rounded-lg transition disabled:opacity-50 cursor-pointer"
              >
                {submittingService ? 'Logging invoice...' : 'Commit log to history'}
              </button>
            </form>
          )}

          {/* Historical timeline */}
          {vehicleHistory.length === 0 ? (
            <div className="text-center py-10 border border-dashed border-slate-800 rounded-xl bg-slate-950/20 text-slate-500 text-sm">
              No service logs recorded under this vehicle. Complete oil rotations or file work summaries to build your history log track.
            </div>
          ) : (
            <div className="space-y-4 max-h-96 overflow-y-auto pr-1" id="vehicle-history-timeline">
              {vehicleHistory
                .sort((a, b) => new Date(b.serviceDate).getTime() - new Date(a.serviceDate).getTime())
                .map((log) => (
                  <div key={log.id} className="p-3.5 bg-slate-950 border border-slate-850 rounded-xl flex items-start gap-3">
                    <div className="p-1.5 bg-slate-900 border border-slate-800 rounded-lg text-red-400 shrink-0 mt-0.5">
                      <FileText className="w-4.5 h-4.5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between items-start gap-4">
                        <div>
                          <h4 className="font-extrabold text-sm text-slate-205 flex items-center gap-1.5">
                            {log.serviceType}
                            <span className="text-[9px] uppercase tracking-wider text-slate-500 font-mono">
                              {log.serviceDate}
                            </span>
                          </h4>
                          <p className="text-xs text-slate-400 mt-1 leading-relaxed">{log.description}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-black text-slate-100 flex items-center gap-0.5 justify-end">
                            <DollarSign className="w-3.5 h-3.5 text-slate-500" />
                            {log.cost}
                          </p>
                          <p className="text-[10px] text-slate-500 mt-1 font-mono font-bold">
                            {log.mileageAtService.toLocaleString()} mi
                          </p>
                        </div>
                      </div>

                      {/* Diagnostic certified badge */}
                      {log.loggedBy === 'mechanic' && (
                        <div className="inline-flex items-center gap-1 bg-blue-950/30 border border-blue-500/15 px-2 py-0.5 rounded text-[9px] font-bold text-blue-400 mt-2">
                          <CheckCircle2 className="w-3 h-3 text-blue-400" />
                          Certified mechanic: {log.mechanicName || 'Registered Shop'}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
            </div>
          )}
        </div>

        {/* Diagnostic Guidelines Promo Column (Span 1) */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-sm space-y-4">
          <h3 className="text-xs font-black uppercase text-slate-100 tracking-wider">
            Vehicle details Info
          </h3>
          <p className="text-slate-400 text-xs leading-relaxed">
            AutoAid pairs live sensor data with MERN stack calculations to offer customized interval suggestions. 
          </p>

          <div className="bg-slate-950/50 p-3.5 border border-slate-850 rounded-xl space-y-3">
            <h4 className="text-xs font-bold text-slate-200">Recommended Checks</h4>
            <div className="text-xs text-slate-400 space-y-2">
              <p className="flex items-start gap-1.5">
                <span className="text-emerald-500 mt-0.5">✓</span>
                <span>Perform tire pressure checks once a month (cold tire pressure: 33-35psi).</span>
              </p>
              <p className="flex items-start gap-1.5">
                <span className="text-emerald-500 mt-0.5">✓</span>
                <span>Exchange cabin filtration screens after dirty / dusty pollen seasons.</span>
              </p>
              <p className="flex items-start gap-1.5">
                <span className="text-emerald-500 mt-0.5">✓</span>
                <span>Keep auxiliary battery posts free of battery acid chemical corrosion.</span>
              </p>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
