// Garage.js
import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';

export default function Garage({ token, vehicles, onRefresh }) {
  // New Vehicle form state
  const [vehicleType, setVehicleType] = useState('Car');
  const [make, setMake] = useState('');
  const [model, setModel] = useState('');
  const [year, setYear] = useState(new Date().getFullYear());
  const [licensePlate, setLicensePlate] = useState('');
  const [mileage, setMileage] = useState('');
  
  // Modifying mileage state
  const [editingMilId, setEditingMilId] = useState(null);
  const [tempMileage, setTempMileage] = useState('');

  const [loading, setLoading] = useState(false);
  const [formOpen, setFormOpen] = useState(vehicles.length === 0);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Delete confirmation state (no browser confirm dialog dependency)
  const [deletingVehicle, setDeletingVehicle] = useState(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  // Auto-open form if user has no vehicles registered
  useEffect(() => {
    if (vehicles.length === 0) {
      setFormOpen(true);
    }
  }, [vehicles.length]);

  const handleCreateVehicle = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);

    if (!vehicleType || !make || !model || !year || !licensePlate || !mileage) {
      setError('Please fill in check fields.');
      setLoading(false);
      return;
    }

    try {
      const res = await fetch('/api/vehicles', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          vehicleType,
          make,
          model,
          year: Number(year),
          licensePlate: licensePlate.toUpperCase(),
          mileage: Number(mileage),
        })
      });

      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error || 'Failed registering vehicle.');
      }

      setVehicleType('Car');
      setMake('');
      setModel('');
      setLicensePlate('');
      setMileage('');
      setFormOpen(false);
      setSuccess('Vehicle registered and parked in the garage.');
      onRefresh();
    } catch (err) {
      setError(err.message || 'Validation failed.');
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateMileageSubmit = async (vehicleId) => {
    try {
      const targetMil = Number(tempMileage);
      if (isNaN(targetMil) || targetMil <= 0) {
        alert('Please enter a valid mileage greater than zero.');
        return;
      }

      const res = await fetch(`/api/vehicles/${vehicleId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ mileage: targetMil })
      });

      if (!res.ok) throw new Error('Failed to update mileage.');

      setEditingMilId(null);
      setSuccess('Mileage logged successfully.');
      onRefresh();
    } catch (err) {
      alert(err.message);
    }
  };

  const executeDeleteVehicle = async () => {
    if (!deletingVehicle) return;
    setDeleteLoading(true);
    setError('');
    
    try {
      const res = await fetch(`/api/vehicles/${deletingVehicle.id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.ok) throw new Error('Failed to remove vehicle.');
      setSuccess(`Successfully deleted ${deletingVehicle.name} from your garage.`);
      setDeletingVehicle(null);
      onRefresh();
    } catch (err) {
      setError(err.message || 'Failed to remove vehicle.');
    } finally {
      setDeleteLoading(false);
    }
  };

  return (
    <>
    <div className="space-y-6" id="garage-main">
      {/* Absolute delete confirmation modal overlay */}
      {deletingVehicle && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm" id="delete-confirm-modal">
          <div className="bg-slate-900 border border-slate-805 rounded-2xl max-w-md w-full p-6 space-y-5 shadow-2xl relative">
            <div className="flex items-start gap-4">
              <div className="p-3 bg-red-500/10 border border-red-500/20 text-red-500 rounded-xl shrink-0">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-6 h-6">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <div className="space-y-1">
                <h3 className="text-base font-black text-white">Remove Vehicle?</h3>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Are you sure you want to remove <strong className="text-slate-200">{deletingVehicle.name}</strong> from your garage?
                </p>
                <p className="text-[11px] text-slate-500 leading-normal">
                  This will permanently delete the vehicle, all of its recorded mileage metrics, repair logs, and any pending AI diagnostics reports. This action cannot be undone.
                </p>
              </div>
            </div>

            <div className="flex gap-3 justify-end border-t border-slate-800/80 pt-4">
              <button
                onClick={() => setDeletingVehicle(null)}
                disabled={deleteLoading}
                className="bg-slate-850 hover:bg-slate-800 text-slate-300 font-bold text-xs py-2.5 px-4 rounded-xl transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={executeDeleteVehicle}
                disabled={deleteLoading}
                className="bg-red-600 hover:bg-red-500 text-white font-bold text-xs py-2.5 px-4 rounded-xl transition cursor-pointer shrink-0"
              >
                {deleteLoading ? 'Removing...' : 'Yes, Delete Vehicle'}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="flex justify-between items-center border-b border-slate-800 pb-5">
        <div>
          <h1 className="text-2xl font-black text-white tracking-tight">Vehicle Garage</h1>
          <p className="text-sm text-slate-400">Register, manage, and update odometers for your fleet.</p>
        </div>
        <button
          onClick={() => setFormOpen(!formOpen)}
          className="bg-red-600 hover:bg-red-500 text-white font-bold text-xs px-4 py-2.5 rounded-lg transition shadow-md shadow-red-500/10 cursor-pointer"
        >
          {formOpen ? 'View Registered Vehicles' : 'Register Vehicle'}
        </button>
      </div>

      {success && (
        <div className="bg-emerald-950/25 border border-emerald-500/20 text-emerald-400 p-4 rounded-xl text-sm" id="garage-success-noti">
          {success}
        </div>
      )}

      {error && (
        <div className="bg-red-950/25 border border-red-500/20 text-red-500 p-4 rounded-xl text-sm">
          {error}
        </div>
      )}

      {/* Trigger Add Vehicle Form */}
      {formOpen && (
        <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl max-w-xl mx-auto" id="add-vehicle-overlay">
          <h3 className="text-lg font-black text-white mb-4">Add a New Vehicle</h3>
          <form onSubmit={handleCreateVehicle} className="space-y-4">
            <div>
              <label className="block text-xs uppercase tracking-wider font-semibold text-slate-400 mb-1.5">Vehicle Type</label>
              <select
                required
                value={vehicleType}
                onChange={(e) => setVehicleType(e.target.value)}
                className="w-full bg-slate-950 hover:bg-slate-950/80 border border-slate-800 focus:border-red-500 text-slate-200 py-2 px-3 rounded-lg outline-none text-sm transition cursor-pointer"
              >
                <option value="Car">Car</option>
                <option value="Motorcycle">Motorcycle</option>
                <option value="Scooter">Scooter</option>
                <option value="Truck">Truck</option>
                <option value="Van">Van</option>
              </select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs uppercase tracking-wider font-semibold text-slate-400 mb-1.5">Manufacturer (Make)</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Honda"
                  value={make}
                  onChange={(e) => setMake(e.target.value)}
                  className="w-full bg-slate-950 hover:bg-slate-950/80 border border-slate-800 focus:border-red-500 text-slate-200 py-2 px-3 rounded-lg outline-none text-sm transition"
                />
              </div>

              <div>
                <label className="block text-xs uppercase tracking-wider font-semibold text-slate-400 mb-1.5">Model Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Civic"
                  value={model}
                  onChange={(e) => setModel(e.target.value)}
                  className="w-full bg-slate-950 hover:bg-slate-950/80 border border-slate-800 focus:border-red-500 text-slate-200 py-2 px-3 rounded-lg outline-none text-sm transition"
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="block text-xs uppercase tracking-wider font-semibold text-slate-400 mb-1.5">Model Year</label>
                <input
                  type="number"
                  required
                  value={year}
                  onChange={(e) => setYear(Number(e.target.value))}
                  className="w-full bg-slate-950 hover:bg-slate-950/80 border border-slate-800 focus:border-red-500 text-slate-200 py-2 px-3 rounded-lg outline-none text-sm transition"
                />
              </div>

              <div>
                <label className="block text-xs uppercase tracking-wider font-semibold text-slate-400 mb-1.5">License Plate</label>
                <input
                  type="text"
                  required
                  placeholder="7XYZ123"
                  value={licensePlate}
                  onChange={(e) => setLicensePlate(e.target.value)}
                  className="w-full bg-slate-950 hover:bg-slate-950/80 border border-slate-800 focus:border-red-500 text-slate-200 py-2 px-3 rounded-lg outline-none text-sm transition"
                />
              </div>

              <div>
                <label className="block text-xs uppercase tracking-wider font-semibold text-slate-400 mb-1.5">Current Mileage</label>
                <input
                  type="number"
                  required
                  placeholder="e.g. 52000"
                  value={mileage}
                  onChange={(e) => setMileage(e.target.value)}
                  className="w-full bg-slate-950 hover:bg-slate-950/80 border border-slate-800 focus:border-red-500 text-slate-200 py-2 px-3 rounded-lg outline-none text-sm transition"
                />
              </div>
            </div>

            <div className="flex gap-2 justify-end pt-2">
              {vehicles.length > 0 && (
                <button
                  type="button"
                  onClick={() => setFormOpen(false)}
                  className="bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs py-2 px-4 rounded-lg transition"
                >
                  Cancel
                </button>
              )}
              <button
                type="submit"
                disabled={loading}
                className="bg-red-600 hover:bg-red-500 text-white font-bold text-xs py-2 px-4 rounded-lg transition"
              >
                {loading ? 'Registering...' : 'Register Vehicle'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Grid of Vehicles Cards - Only shown when NOT registering a vehicle */}
      {!formOpen && (
        vehicles.length === 0 ? (
          <div className="border border-dashed border-slate-800 bg-slate-900/30 p-12 text-center rounded-2xl flex flex-col items-center justify-center max-w-xl mx-auto space-y-4">
            <div className="p-3 bg-red-950/30 rounded-full border border-red-500/20 text-red-500">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-8 h-8">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <div>
              <h3 className="font-bold text-base text-slate-200 font-sans">Garage is Empty</h3>
              <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                No vehicles have been linked to your account yet. Let's register your first car to log service intervals and test AI features!
              </p>
            </div>
            <button
              onClick={() => setFormOpen(true)}
              className="bg-red-600 hover:bg-red-500 text-white font-bold text-xs py-2 px-4 rounded-lg transition"
            >
              Register Car
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6" id="garage-vehicles-grid">
            {vehicles.map((v) => {
              // Stats helpers
              const lastOil = v.lastOilChangeMileage || 0;
              const sinceOil = v.mileage - lastOil;
              const oilPercentage = Math.min(100, Math.max(0, (sinceOil / 5000) * 100));

              const lastRot = v.lastTireRotationMileage || 0;
              const sinceRot = v.mileage - lastRot;
              const rotPercentage = Math.min(100, Math.max(0, (sinceRot / 7500) * 100));

              const isOilCritical = sinceOil >= 5000;
              const isRotCritical = sinceRot >= 7500;

              const name = `${v.year} ${v.make} ${v.model}`;

              return (
                <div 
                  key={v.id} 
                  className="bg-slate-900 border border-slate-800/80 rounded-2xl shadow-sm hover:border-slate-800 hover:shadow-md transition duration-200 p-5 flex flex-col justify-between space-y-4"
                >
                  {/* Header detail */}
                  <div className="flex justify-between items-start">
                    <div>
                      <Link to={`/vehicle/${v.id}`} className="group/title">
                        <h3 className="font-extrabold text-base text-white tracking-tight group-hover/title:text-red-500 transition-colors inline-flex items-center gap-1.5">
                          {name}
                          <span className="text-slate-500 group-hover/title:text-red-500 transition-colors text-xs font-normal opacity-0 group-hover/title:opacity-100">&rarr;</span>
                        </h3>
                      </Link>
                      <div className="flex gap-2.5 items-center mt-1">
                        <span className="bg-slate-950 border border-slate-800 text-slate-400 font-mono text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-lg">
                          Type: {v.vehicleType || 'Car'}
                        </span>
                        <span className="bg-slate-950 border border-slate-800 text-slate-400 font-mono text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-lg">
                          Plate: {v.licensePlate}
                        </span>
                        <span className="text-[10px] text-slate-500 font-bold">
                          Linked: {new Date(v.createdAt).toLocaleDateString()}
                        </span>
                      </div>
                    </div>

                    <button
                      onClick={() => setDeletingVehicle({ id: v.id, name })}
                      className="p-1.5 hover:bg-red-950/30 text-slate-600 hover:text-red-400 hover:border-red-950 border border-transparent rounded-lg transition cursor-pointer"
                      title="Remove vehicle"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                      </svg>
                    </button>
                  </div>

                  {/* Mileage indicators */}
                  <div className="bg-slate-950 border border-slate-800/80 p-3 rounded-xl flex items-center justify-between" id="odometer-sub">
                    <div>
                      <span className="text-[10px] font-bold tracking-wider uppercase text-slate-500 block">Odometer Reading</span>
                      {editingMilId === v.id ? (
                        <div className="flex gap-2 items-center mt-1">
                          <input
                            type="number"
                            autoFocus
                            value={tempMileage}
                            onChange={(e) => setTempMileage(e.target.value)}
                            className="bg-slate-900 border border-slate-700 rounded-md text-slate-200 outline-none text-xs p-1 w-24 font-mono font-bold"
                          />
                          <button
                            onClick={() => handleUpdateMileageSubmit(v.id)}
                            className="bg-emerald-600 hover:bg-emerald-500 transition text-[10px] font-bold text-white px-2 py-1 rounded"
                          >
                            Save
                          </button>
                          <button
                            onClick={() => setEditingMilId(null)}
                            className="bg-slate-800 hover:bg-slate-700 transition text-[10px] text-slate-300 px-2 py-1 rounded"
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-baseline gap-1.5 mt-0.5">
                          <span className="font-mono text-base font-black text-white">{v.mileage.toLocaleString()}</span>
                          <span className="text-[10px] text-slate-400 font-bold uppercase font-mono">Miles</span>
                        </div>
                      )}
                    </div>

                    {editingMilId !== v.id && (
                      <button
                        onClick={() => {
                          setEditingMilId(v.id);
                          setTempMileage(String(v.mileage));
                        }}
                        className="text-[10px] bg-slate-900 font-bold hover:bg-slate-800 border border-slate-800/60 hover:border-red-500/20 text-red-400 py-1.5 px-3 rounded-lg transition"
                      >
                        Update Miles
                      </button>
                    )}
                  </div>

                  {/* Interval Gauges */}
                  <div className="space-y-3 pt-2" id="gauges-sub">
                    {/* Oil Change Indicator */}
                    <div>
                      <div className="flex justify-between items-center text-xs">
                        <span className="text-slate-400 font-bold font-sans">Fluids / Oil Change Interval</span>
                        <span className={isOilCritical ? 'text-red-400 font-black' : 'text-emerald-400 font-semibold'}>
                          {isOilCritical ? 'Overdue!' : `${sinceOil.toLocaleString()} / 5,000 mi`}
                        </span>
                      </div>
                      <div className="w-full bg-slate-950 rounded-full h-2.5 border border-slate-800 mt-1">
                        <div 
                          className={`h-full rounded-full transition-all duration-300 ${
                            isOilCritical ? 'bg-red-500' : oilPercentage > 80 ? 'bg-amber-500' : 'bg-emerald-500'
                          }`}
                          style={{ width: `${oilPercentage}%` }}
                        ></div>
                      </div>
                    </div>

                    {/* Tire Rotation Indicator */}
                    <div>
                      <div className="flex justify-between items-center text-xs">
                        <span className="text-slate-400 font-bold font-sans">Tire Alignment & Rotation</span>
                        <span className={isRotCritical ? 'text-red-400 font-black' : 'text-emerald-405 font-semibold'}>
                          {isRotCritical ? 'Overdue!' : `${sinceRot.toLocaleString()} / 7,500 mi`}
                        </span>
                      </div>
                      <div className="w-full bg-slate-950 rounded-full h-2.5 border border-slate-800 mt-1">
                        <div 
                          className={`h-full rounded-full transition-all duration-300 ${
                            isRotCritical ? 'bg-red-500' : rotPercentage > 80 ? 'bg-amber-500' : 'bg-emerald-500'
                          }`}
                          style={{ width: `${rotPercentage}%` }}
                        ></div>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )
      )}
    </div>
    </>
  )
}
