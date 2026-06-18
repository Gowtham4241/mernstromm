// ServiceLogs.js
import React, { useState } from 'react';

export default function ServiceLogs({ token, vehicles, serviceHistory, onRefresh }) {
  const [vehicleId, setVehicleId] = useState(vehicles[0]?.id || '');
  const [serviceType, setServiceType] = useState('Oil Change');
  const [cost, setCost] = useState('');
  const [mileageAtService, setMileageAtService] = useState('');
  const [serviceDate, setServiceDate] = useState(new Date().toISOString().split('T')[0]);
  const [description, setDescription] = useState('');
  const [mechanicName, setMechanicName] = useState('');
  const [loggedBy, setLoggedBy] = useState('user');

  // Filters state
  const [filterVehicleId, setFilterVehicleId] = useState('');
  const [search, setSearch] = useState('');
  const [sortOrder, setSortOrder] = useState('date_desc');

  const [formOpen, setFormOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleLogService = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    if (!vehicleId || !serviceType || !cost || !mileageAtService || !serviceDate) {
      setError('Please fill in all required highlighted inputs.');
      setLoading(false);
      return;
    }

    try {
      const res = await fetch('/api/service-history', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          vehicleId,
          serviceType,
          cost: Number(cost),
          mileageAtService: Number(mileageAtService),
          serviceDate,
          description,
          mechanicName: loggedBy === 'mechanic' ? mechanicName : undefined,
          loggedBy,
        })
      });

      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error || 'Failed logging service record.');
      }

      setCost('');
      setMileageAtService('');
      setDescription('');
      setMechanicName('');
      setFormOpen(false);
      onRefresh();
    } catch (err) {
      setError(err.message || 'Validation failed.');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteLog = async (id) => {
    if (!confirm('Permanently remove this service log entry from history bounds?')) return;
    try {
      const res = await fetch(`/api/service-history/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) throw new Error('Deletion failed.');
      onRefresh();
    } catch (e) {
      alert(e.message);
    }
  };

  // Helper mappings
  const getVehicleName = (id) => {
    const v = vehicles.find(item => item.id === id);
    return v ? `${v.make} ${v.model} (${v.year})` : 'Unknown Vehicle';
  };

  // Filter logs logic
  let filteredLogs = serviceHistory.filter(log => {
    const matchesVehicle = !filterVehicleId || log.vehicleId === filterVehicleId;
    const matchesSearch = !search || 
      log.serviceType.toLowerCase().includes(search.toLowerCase()) || 
      log.description.toLowerCase().includes(search.toLowerCase()) || 
      (log.mechanicName && log.mechanicName.toLowerCase().includes(search.toLowerCase()));
    
    return matchesVehicle && matchesSearch;
  });

  // Sort logs logic
  if (sortOrder === 'date_desc') {
    filteredLogs.sort((a, b) => new Date(b.serviceDate).getTime() - new Date(a.serviceDate).getTime());
  } else if (sortOrder === 'date_asc') {
    filteredLogs.sort((a, b) => new Date(a.serviceDate).getTime() - new Date(b.serviceDate).getTime());
  } else if (sortOrder === 'cost_desc') {
    filteredLogs.sort((a, b) => b.cost - a.cost);
  } else if (sortOrder === 'cost_asc') {
    filteredLogs.sort((a, b) => a.cost - b.cost);
  }

  return (
    <div className="space-y-6" id="service-logs-module">
      <div className="flex justify-between items-center border-b border-slate-800 pb-5">
        <div>
          <h1 className="text-2xl font-black text-white tracking-tight">Service History Logs</h1>
          <p className="text-sm text-slate-400">Keep complete timeline logs of maintenance items, repairs, and receipts.</p>
        </div>
        <button
          onClick={() => setFormOpen(!formOpen)}
          className="bg-red-600 hover:bg-red-500 text-white font-bold text-xs px-4 py-2.5 rounded-lg transition shadow-md shadow-red-500/10 cursor-pointer"
        >
          {formOpen ? 'Cancel Logging' : 'Log Service Event'}
        </button>
      </div>

      {vehicles.length === 0 ? (
        <div className="border border-dashed border-slate-800 bg-slate-900/30 p-12 text-center rounded-2xl flex flex-col items-center justify-center max-w-xl mx-auto space-y-4">
          <div className="p-3 bg-red-950/30 rounded-full border border-red-500/20 text-red-500">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-8 h-8">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <div>
            <h3 className="font-bold text-base text-slate-200 font-sans">No Vehicles Found</h3>
            <p className="text-xs text-slate-500 mt-1 leading-relaxed">
              Register a vehicle in the garage first before logging maintenance checklists.
            </p>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          
          {/* Left panel: CRUD form or Filter blocks (col 4) */}
          <div className="lg:col-span-4 space-y-6">
            
            {formOpen ? (
              <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl" id="log-manual-form-wrapper">
                <h3 className="text-sm font-black text-white uppercase tracking-wider mb-4 text-red-500">Log Maintenance Work</h3>

                {error && (
                  <div className="bg-red-950/20 border border-red-500/30 text-red-500 p-3 rounded-lg text-xs mb-3">
                    {error}
                  </div>
                )}

                <form onSubmit={handleLogService} className="space-y-4">
                  <div>
                    <label className="block text-[10px] uppercase font-bold text-slate-500 mb-1">Vehicle</label>
                    <select
                      value={vehicleId}
                      onChange={(e) => setVehicleId(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 text-slate-200 py-1.5 px-3 rounded-lg outline-none text-xs"
                    >
                      {vehicles.map(v => (
                        <option key={v.id} value={v.id}>{v.make} {v.model}</option>
                      ))}
                    </select>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[10px] uppercase font-bold text-slate-500 mb-1">Service Type</label>
                      <select
                        value={serviceType}
                        onChange={(e) => setServiceType(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-800 text-slate-200 py-1.5 px-3 rounded-lg outline-none text-xs"
                      >
                        <option value="Oil Change">Oil Change</option>
                        <option value="Tire Rotation">Tire Rotation</option>
                        <option value="Brake Pad Replace">Brake Pads</option>
                        <option value="Battery Replace">Battery Install</option>
                        <option value="Body Shop Repair">Body Scrape</option>
                        <option value="Transmission Fluid">Transmission</option>
                        <option value="System Diagnostics">AI Code Clear</option>
                        <option value="General Maintenance">Other Service</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-[10px] uppercase font-bold text-slate-500 mb-1">Odometer Logged</label>
                      <input
                        type="number"
                        required
                        placeholder="Current miles"
                        value={mileageAtService}
                        onChange={(e) => setMileageAtService(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-800 focus:border-red-500 text-slate-200 py-1.5 px-3 rounded-lg outline-none text-xs"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[10px] uppercase font-bold text-slate-500 mb-1">Total Cost ($ USD)</label>
                      <input
                        type="number"
                        required
                        placeholder="Invoiced cost"
                        value={cost}
                        onChange={(e) => setCost(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-800 focus:border-red-500 text-slate-200 py-1.5 px-3 rounded-lg outline-none text-xs"
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] uppercase font-bold text-slate-500 mb-1">Service Date</label>
                      <input
                        type="date"
                        required
                        value={serviceDate}
                        onChange={(e) => setServiceDate(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-800 text-slate-200 py-1.5 px-3 rounded-lg outline-none text-xs font-mono"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[10px] uppercase font-bold text-slate-500 mb-1">Log Recorder Authenticator</label>
                    <div className="flex gap-4">
                      <label className="flex items-center gap-1.5 text-xs text-slate-300 pointer-events-auto cursor-pointer">
                        <input type="radio" checked={loggedBy === 'user'} onChange={() => setLoggedBy('user')} className="text-red-500" />
                        <span>Self logged</span>
                      </label>
                      <label className="flex items-center gap-1.5 text-xs text-slate-300 pointer-events-auto cursor-pointer">
                        <input type="radio" checked={loggedBy === 'mechanic'} onChange={() => setLoggedBy('mechanic')} className="text-red-500" />
                        <span>Certified Mechanic</span>
                      </label>
                    </div>
                  </div>

                  {loggedBy === 'mechanic' && (
                    <div>
                      <label className="block text-[10px] uppercase font-bold text-slate-500 mb-1">Mechanic Shop Name</label>
                      <input
                        type="text"
                        required
                        placeholder="e.g. Mission Auto Care"
                        value={mechanicName}
                        onChange={(e) => setMechanicName(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-800 focus:border-red-500 text-slate-200 py-1.5 px-3 rounded-lg outline-none text-xs"
                      />
                    </div>
                  )}

                  <div>
                    <label className="block text-[10px] uppercase font-bold text-slate-500 mb-1">Description / Notes</label>
                    <textarea
                      rows={3}
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      placeholder="e.g. Synthetic oil replacement, topped wiper fluids, changed valve fittings..."
                      className="w-full bg-slate-950 border border-slate-800 focus:border-red-500 text-slate-200 py-1 px-3 rounded-lg outline-none text-xs resize-none"
                    ></textarea>
                  </div>

                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full bg-red-650 hover:bg-red-600 outline-none select-none text-white font-bold text-xs py-2 rounded-xl transition"
                  >
                    {loading ? 'Compiling data...' : 'Authorize & Log Service'}
                  </button>
                </form>
              </div>
            ) : (
              <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl space-y-4" id="service-logs-filters-bar">
                <h3 className="text-xs uppercase font-bold text-slate-400 tracking-wider">Search Filters</h3>
                
                <div>
                  <label className="block text-[10px] uppercase text-slate-500 mb-1 font-bold">Search Text</label>
                  <input
                    type="text"
                    placeholder="Search mechanic, details..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 focus:border-red-500 text-slate-200 py-1.5 px-3 rounded-lg outline-none text-xs"
                  />
                </div>

                <div>
                  <label className="block text-[10px] uppercase text-slate-500 mb-1 font-bold">Filter Vehicle</label>
                  <select
                    value={filterVehicleId}
                    onChange={(e) => setFilterVehicleId(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 text-slate-200 py-1.5 px-3 rounded-lg outline-none text-xs cursor-pointer"
                  >
                    <option value="">All Fleet</option>
                    {vehicles.map(v => <option key={v.id} value={v.id}>{v.make} {v.model}</option>)}
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] uppercase text-slate-500 mb-1 font-bold">Sort Listings</label>
                  <select
                    value={sortOrder}
                    onChange={(e) => setSortOrder(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 text-slate-200 py-1.5 px-3 rounded-lg outline-none text-xs cursor-pointer"
                  >
                    <option value="date_desc">Newest Invoices First</option>
                    <option value="date_asc">Oldest Invoices First</option>
                    <option value="cost_desc font-mono">Invoice Cost: High to Low</option>
                    <option value="cost_asc font-mono">Invoice Cost: Low to High</option>
                  </select>
                </div>
              </div>
            )}
          </div>

          {/* Right column: timeline logs (col 8) */}
          <div className="lg:col-span-8 space-y-4" id="logs-timeline-stack">
            <h2 className="text-base font-bold text-white uppercase tracking-wider text-slate-400">Service Log History ({filteredLogs.length})</h2>

            {filteredLogs.length === 0 ? (
              <div className="border border-dashed border-slate-800 bg-slate-900/10 p-12 text-center rounded-2xl">
                <p className="text-slate-500 text-sm">No maintenance log records match current settings.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {filteredLogs.map(log => {
                  const isPending = log.status === 'in_progress';
                  return (
                    <div key={log.id} className="bg-slate-900 border border-slate-800/80 p-5 rounded-2xl space-y-3 relative overflow-hidden shadow-sm hover:border-slate-805 transition duration-150">
                      
                      {/* Top banner */}
                      <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-2 border-b border-slate-850 pb-2.5">
                        <div>
                          <strong className="text-sm text-slate-100 font-sans">{log.serviceType}</strong>
                          <span className="text-[10px] text-slate-500 block font-bold uppercase tracking-wide mt-0.5">{getVehicleName(log.vehicleId)}</span>
                        </div>
                        <div className="flex items-center gap-2.5">
                          <span className="font-mono text-base font-bold text-rose-500">${log.cost.toLocaleString()}</span>
                          <span className="text-slate-700 font-mono">•</span>
                          {isPending ? (
                            <span className="bg-amber-950/40 border border-amber-500/20 text-amber-400 text-[9px] uppercase tracking-widest px-2 py-0.5 rounded-full font-black animate-pulse">In Progress</span>
                          ) : (
                            <span className="bg-emerald-950/40 border border-emerald-500/20 text-emerald-400 text-[9px] uppercase tracking-widest px-2 py-0.5 rounded-full font-black">Completed</span>
                          )}
                        </div>
                      </div>

                      {/* Notes / Details */}
                      <div className="text-xs text-slate-300 leading-relaxed font-sans">{log.description}</div>

                      {/* Footer row */}
                      <div className="flex justify-between items-center text-[10px] text-slate-400 pt-2 border-t border-slate-850/40">
                        <div className="flex items-center gap-3">
                          <span className="font-mono">Date: <strong className="text-slate-200">{log.serviceDate}</strong></span>
                          <span>Odometer: <strong className="text-slate-200 font-mono">{log.mileageAtService.toLocaleString()} mi</strong></span>
                          {log.mechanicName && (
                            <span className="text-red-400 font-bold bg-red-950/10 px-2 py-0.5 rounded border border-red-950/20">📍 {log.mechanicName}</span>
                          )}
                        </div>

                        <button
                          onClick={() => handleDeleteLog(log.id)}
                          className="hover:text-red-500 font-bold uppercase tracking-wider scale-95 transition"
                        >
                          Remove Log
                        </button>
                      </div>

                    </div>
                  );
                })}
              </div>
            )}
          </div>

        </div>
      )}
    </div>
  );
}