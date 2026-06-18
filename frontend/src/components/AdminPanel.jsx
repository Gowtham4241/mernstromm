// AdminPanel.js
import React, { useState, useEffect } from 'react';

export default function AdminPanel({ token, reports, onRefreshReports }) {
  const [activeSubTab, setActiveSubTab] = useState('reports');
  const [mechanics, setMechanics] = useState([]);
  const [loadingMecs, setLoadingMecs] = useState(true);
  const [mecName, setMecName] = useState('');
  const [mecAddress, setMecAddress] = useState('');
  const [mecPhone, setMecPhone] = useState('');
  const [mecRate, setMecRate] = useState('');
  const [mecSpecialties, setMecSpecialties] = useState('');
  const [mecHours, setMecHours] = useState('Mon-Fri: 8:00 AM - 5:00 PM');
  const [mecDistance, setMecDistance] = useState('1.5 miles');
  const [formOpen, setFormOpen] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const fetchAdminMechanics = async () => {
    setLoadingMecs(true);
    try {
      const res = await fetch('/api/mechanics');
      if (res.ok) {
        const d = await res.json();
        setMechanics(d);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingMecs(false);
    }
  };

  useEffect(() => {
    fetchAdminMechanics();
  }, []);

  const handleUpdateStatus = async (reportId, status) => {
    try {
      const res = await fetch(`/api/damage-reports/${reportId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ status })
      });

      if (!res.ok) throw new Error('Failed updating status.');
      
      setSuccess('Report status updated.');
      onRefreshReports();
    } catch (err) {
      alert(err.message);
    }
  };

  const handleCreateMechanic = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!mecName || !mecAddress || !mecPhone || !mecRate || !mecSpecialties) {
      setError('Please provide all required fields.');
      return;
    }

    try {
      const res = await fetch('/api/mechanics', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          name: mecName,
          address: mecAddress,
          phone: mecPhone,
          averageHourlyRate: Number(mecRate),
          specialties: mecSpecialties.split(',').map(s => s.trim()),
          schedule: mecHours,
          distance: mecDistance
        })
      });

      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error || 'Failed to register mechanic.');
      }

      setMecName('');
      setMecAddress('');
      setMecPhone('');
      setMecRate('');
      setMecSpecialties('');
      setFormOpen(false);
      setSuccess('New mechanic added to directory indexes.');
      fetchAdminMechanics();
    } catch (err) {
      setError(err.message);
    }
  };

  const handleDeleteMechanic = async (id, name) => {
    if (!confirm(`Remove ${name} from system index?`)) return;
    try {
      const res = await fetch(`/api/mechanics/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) throw new Error('Deletion failed.');
      setSuccess('Mechanic successfully de-listed.');
      fetchAdminMechanics();
    } catch (e) {
      alert(e.message);
    }
  };

  return (
    <div className="space-y-6" id="admin-panel-console">
      <div className="border-b border-slate-800 pb-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-white tracking-tight flex items-center gap-2">
            <span className="bg-red-650 text-white font-sans text-xs px-2.5 py-0.5 rounded-md uppercase font-black tracking-widest border border-red-500/25">ADMIN CONTROL</span>
            <span>Platform Hub</span>
          </h1>
          <p className="text-sm text-slate-400">Manage directory records and audit global ticket bounds.</p>
        </div>

        <div className="bg-slate-950 p-1 rounded-xl border border-slate-800 flex gap-1 shrink-0">
          <button
            onClick={() => { setActiveSubTab('reports'); setFormOpen(false); }}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer select-none ${
              activeSubTab === 'reports' ? 'bg-red-600 text-white shadow-md' : 'text-slate-400 hover:text-white'
            }`}
          >
            Damage Audit Logs
          </button>
          <button
            onClick={() => { setActiveSubTab('mechanics'); setError(''); }}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer select-none ${
              activeSubTab === 'mechanics' ? 'bg-red-600 text-white shadow-md' : 'text-slate-400 hover:text-white'
            }`}
          >
            Edit Directory
          </button>
        </div>
      </div>

      {success && (
        <div className="bg-emerald-950/25 border border-emerald-500/25 text-emerald-400 p-4 rounded-xl text-xs">
          {success}
        </div>
      )}

      {activeSubTab === 'reports' && (
        <div className="space-y-4" id="admin-reports-auditor">
          <h2 className="text-sm font-bold uppercase tracking-wider text-slate-400">System-wide Diagnostic Tickets ({reports.length})</h2>

          {reports.length === 0 ? (
            <div className="border border-dashed border-slate-800 bg-slate-900/10 p-12 rounded-2xl text-center text-slate-500 text-sm">
              No service damage tickets have been logged across system bounds yet.
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4">
              {reports.map((r) => (
                <div key={r.id} className="bg-slate-900 border border-slate-800 rounded-2xl p-5 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 relative overflow-hidden pl-7">
                  <div className={`absolute top-0 left-0 w-1.5 h-full ${
                    r.severity === 'low' ? 'bg-emerald-500' : r.severity === 'medium' ? 'bg-orange-500' : 'bg-red-500'
                  }`}></div>

                  <div className="space-y-2 flex-grow">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono text-xs text-red-400 font-extrabold tracking-wider bg-red-950/10 px-1.5 py-0.5 rounded border border-red-950/20">REP_{r.id}</span>
                      <span className="text-xs text-slate-400">Submitted by: <strong>USR_{r.userId}</strong></span>
                      <span className={`text-[9px] uppercase tracking-wider px-2 py-0.5 rounded font-black ${
                        r.status === 'resolved' ? 'bg-emerald-950/30 text-emerald-400 border border-emerald-500/10' : 'bg-amber-950/30 text-amber-400 border border-amber-500/10'
                      }`}>
                        {r.status.replace('_', ' ')}
                      </span>
                    </div>

                    <p className="text-xs text-slate-300 italic">"{r.description}"</p>
                    {r.aiDiagnosis && (
                      <div className="text-[10px] text-slate-500">
                        AI Verdict Severity: <strong className="text-slate-300 uppercase">{r.aiDiagnosis.severity}</strong> • Total Estimated Range: <strong className="text-rose-500 font-mono">{r.aiDiagnosis.costEstimation.totalEstimatedRange}</strong>
                      </div>
                    )}
                  </div>

                  <div className="shrink-0 flex items-center gap-2">
                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Resolve Status:</span>
                    <select
                      value={r.status}
                      onChange={(e) => handleUpdateStatus(r.id, e.target.value)}
                      className="bg-slate-950 border border-slate-800 text-slate-300 text-xs py-1 px-2.5 rounded outline-none cursor-pointer hover:border-red-500"
                    >
                      <option value="diagnosed">Diagnosed</option>
                      <option value="in_repair">In Repair</option>
                      <option value="resolved">Resolved / Fixed</option>
                    </select>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {activeSubTab === 'mechanics' && (
        <div className="space-y-6" id="admin-mechanics-manager">
          <div className="flex justify-between items-center">
            <h2 className="text-sm font-bold uppercase tracking-wider text-slate-400">Manage Registered Shop Directories ({mechanics.length})</h2>
            <button
              onClick={() => setFormOpen(!formOpen)}
              className="bg-red-650 hover:bg-red-600 border border-transparent hover:border-red-500 transition text-[11px] font-bold uppercase tracking-wider text-white py-1.5 px-3.5 rounded-lg cursor-pointer"
            >
              {formOpen ? 'Dismiss Form' : 'Register New Shop'}
            </button>
          </div>

          {formOpen && (
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 max-w-xl" id="admin-add-mechanic-form">
              <h3 className="text-xs uppercase font-black text-red-500 mb-4 tracking-wider">Register New Automotive Shop</h3>
              
              {error && (
                <div className="bg-red-950/20 border border-red-500/20 p-2.5 rounded text-xs text-red-500 mb-3">{error}</div>
              )}

              <form onSubmit={handleCreateMechanic} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[9px] uppercase font-bold text-slate-500 mb-1">Company Name</label>
                    <input
                      type="text" required placeholder="e.g. Brakes Elite Repair Services" value={mecName} onChange={(e) => setMecName(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 focus:border-red-500 text-slate-200 py-1.5 px-3.5 rounded-lg outline-none text-xs"
                    />
                  </div>

                  <div>
                    <label className="block text-[9px] uppercase font-bold text-slate-500 mb-1">Contact Phone</label>
                    <input
                      type="text" required placeholder="e.g. (415) 555-4819" value={mecPhone} onChange={(e) => setMecPhone(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 focus:border-red-500 text-slate-200 py-1.5 px-3.5 rounded-lg outline-none text-xs"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className="block text-[9px] uppercase font-bold text-slate-500 mb-1">Hourly Rate ($USD)</label>
                    <input
                      type="number" required placeholder="e.g. 105" value={mecRate} onChange={(e) => setMecRate(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 focus:border-red-500 text-slate-200 py-1.5 px-3.5 rounded-lg outline-none text-xs"
                    />
                  </div>

                  <div>
                    <label className="block text-[9px] uppercase font-bold text-slate-500 mb-1">Weekly hours</label>
                    <input
                      type="text" value={mecHours} onChange={(e) => setMecHours(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 focus:border-red-500 text-slate-200 py-1.5 px-3.5 rounded-lg outline-none text-xs"
                    />
                  </div>

                  <div>
                    <label className="block text-[9px] uppercase font-bold text-slate-500 mb-1">Odometer distance</label>
                    <input
                      type="text" value={mecDistance} onChange={(e) => setMecDistance(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 focus:border-red-500 text-slate-200 py-1.5 px-3.5 rounded-lg outline-none text-xs animate-pulse"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[9px] uppercase font-bold text-slate-500 mb-1">Physical Address</label>
                  <input
                    type="text" required placeholder="Full street, city, state, zip coordinate" value={mecAddress} onChange={(e) => setMecAddress(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 focus:border-red-500 text-slate-200 py-1.5 px-3.5 rounded-lg outline-none text-xs"
                  />
                </div>

                <div>
                  <label className="block text-[9px] uppercase font-bold text-slate-500 mb-1">Specialties list (Separated by comma)</label>
                  <input
                    type="text" required placeholder="Brakes, Engine Diagnostic, Oil Changes, Hybrid/EV" value={mecSpecialties} onChange={(e) => setMecSpecialties(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 focus:border-red-500 text-slate-200 py-1.5 px-3.5 rounded-lg outline-none text-xs"
                  />
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  <button type="button" onClick={() => setFormOpen(false)} className="bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs py-1.5 px-4 rounded-xl">Cancel</button>
                  <button type="submit" className="bg-red-650 hover:bg-red-600 text-white font-bold text-xs py-1.5 px-4 rounded-xl">Create Listing</button>
                </div>
              </form>
            </div>
          )}

          {loadingMecs ? (
            <div className="flex justify-center items-center py-10">
              <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-red-500"></div>
            </div>
          ) : (
            <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden" id="admin-mechanics-table-bounds">
              <table className="w-full text-xs text-left text-slate-300">
                <thead className="bg-slate-950 text-slate-500 uppercase text-[9px] font-bold tracking-wider border-b border-slate-850">
                  <tr>
                    <th className="py-3 px-4">Company Name</th>
                    <th className="py-3 px-4">Address</th>
                    <th className="py-3 px-4">Specialties</th>
                    <th className="py-3 px-4">Hourly Rate</th>
                    <th className="py-3 px-4 text-right">Operations</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-850">
                  {mechanics.map((m) => (
                    <tr key={m.id} className="hover:bg-slate-850/45 transition">
                      <td className="py-3 px-4 font-bold text-slate-100">{m.name}</td>
                      <td className="py-3 px-4 text-slate-400 max-w-xs truncate">{m.address}</td>
                      <td className="py-3 px-4">
                        <div className="flex flex-wrap gap-1 max-w-sm">
                          {m.specialties.slice(0, 3).map((s, i) => (
                            <span key={i} className="bg-slate-950 border border-slate-800 text-[9px] px-1.5 rounded">{s}</span>
                          ))}
                          {m.specialties.length > 3 && <span>+ {m.specialties.length - 3} more</span>}
                        </div>
                      </td>
                      <td className="py-3 px-4 font-mono text-emerald-400 font-bold">${m.averageHourlyRate}/hr</td>
                      <td className="py-3 px-4 text-right">
                        <button
                          onClick={() => handleDeleteMechanic(m.id, m.name)}
                          className="text-red-400 hover:text-red-300 font-bold tracking-wide cursor-pointer"
                        >
                          De-list
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}