// Mechanics.js
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import MechanicMap from './MechanicMap';

export default function Mechanics({ token, vehicles, onRefreshHistory, onContactMechanic }) {
  const navigate = useNavigate();
  const [mechanics, setMechanics] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Mapbox specific states
  const [selectedMapMechanic, setSelectedMapMechanic] = useState(null);
  const [showMapOnMobile, setShowMapOnMobile] = useState(false);

  // Search/Filter state parameters
  const [search, setSearch] = useState('');
  const [specialty, setSpecialty] = useState('');
  const [sortBy, setSortBy] = useState('rating');
  const [maxRate, setMaxRate] = useState('150');

  // Interactive booking/contact modals
  const [activeMec, setActiveMec] = useState(null);
  const [actionType, setActionType] = useState(null);

  // Repair Request forms state
  const [requestVehicleId, setRequestVehicleId] = useState(vehicles[0]?.id || '');
  const [requestDamageType, setRequestDamageType] = useState('Dent Repair');
  const [requestDescription, setRequestDescription] = useState('');
  const [submittingRequest, setSubmittingRequest] = useState(false);

  // Booking form state
  const [bookVehicleId, setBookVehicleId] = useState(vehicles[0]?.id || '');
  const [bookType, setBookType] = useState('Maintenance');
  const [bookDate, setBookDate] = useState(new Date().toISOString().split('T')[0]);
  const [bookDescription, setBookDescription] = useState('');
  const [bookCost, setBookCost] = useState('120');

  // Dynamic Geolocation states
  const [userLocation, setUserLocation] = useState(null);
  const [geoLoading, setGeoLoading] = useState(false);

  // Static list of possible specialties for advanced selector
  const SPECIALTIES = ['Brakes', 'Hybrid/EV', 'Engine Diagnostic', 'Body Shop', 'Suspension', 'Transmission', 'Oil Changes'];

  const requestUserGeoLocation = () => {
    if (!navigator.geolocation) {
      alert('Geolocation is not supported by your browser.');
      return;
    }
    setGeoLoading(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        setUserLocation({ lat: latitude, lng: longitude });
        setGeoLoading(false);
        setSortBy('distance');
      },
      (geoError) => {
        console.warn('Geolocation failed or permission denied:', geoError);
        // Fallback placeholder location in SF center so they still see the beautiful path
        setUserLocation({ lat: 37.765, lng: -122.433 });
        setGeoLoading(false);
        setSortBy('distance');
      },
      { enableHighAccuracy: true, timeout: 8000 }
    );
  };

  // Try auto-obtaining coordinates on initial mount
  useEffect(() => {
    requestUserGeoLocation();
  }, []);

  const fetchMechanics = async () => {
    setLoading(true);
    try {
      const params = {
        search,
        specialty,
        sortBy,
        maxRate,
      };
      if (userLocation) {
        params.userLat = String(userLocation.lat);
        params.userLng = String(userLocation.lng);
      }
      const qs = new URLSearchParams(params).toString();
      const res = await fetch(`/api/mechanics?${qs}`);
      if (!res.ok) throw new Error('Failed to retrieve mechanics directory.');
      const data = await res.json();
      setMechanics(data);
    } catch (err) {
      setError(err.message || 'Error downloading records.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMechanics();
  }, [search, specialty, sortBy, maxRate, userLocation?.lat, userLocation?.lng]);

  // Keep selected vehicle states updated with fetched vehicle lists
  useEffect(() => {
    if (vehicles.length > 0) {
      setRequestVehicleId(vehicles[0].id);
      setBookVehicleId(vehicles[0].id);
    }
  }, [vehicles]);

  // Handle Select Mechanic and Create Repair Request + Direct Chat thread
  const handleRepairRequestSubmit = async (e) => {
    e.preventDefault();
    if (!activeMec) return;

    if (!requestVehicleId) {
      alert('You must select a vehicle to initiate a repair request.');
      return;
    }

    setSubmittingRequest(true);
    try {
      const res = await fetch('/api/repair-requests', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          mechanicId: activeMec.id,
          vehicleId: requestVehicleId,
          damageType: requestDamageType,
          description: requestDescription
        })
      });

      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error || 'Failed to submit repair request.');
      }

      const data = await res.json();
      
      // Cleanup states
      setActiveMec(null);
      setActionType(null);
      setRequestDescription('');
      
      // Redirect User to: /chat/:requestId
      navigate(`/chat/${data.repairRequest.id}`);
    } catch (err) {
      alert(err.message || 'Error occurred while establishing repair request.');
    } finally {
      setSubmittingRequest(false);
    }
  };

  // Handle direct appointment booking -> saves to /api/service-history
  const handleBookingSubmit = async (e) => {
    e.preventDefault();
    if (!activeMec) return;

    try {
      if (!bookVehicleId) {
        alert('Please select a vehicle to book an appointment.');
        return;
      }

      const vehicle = vehicles.find(v => v.id === bookVehicleId);
      if (!vehicle) return;

      const res = await fetch('/api/service-history', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          vehicleId: bookVehicleId,
          serviceType: bookType,
          description: `Booked appointment at ${activeMec.name}. ${bookDescription}`,
          cost: Number(bookCost),
          loggedBy: 'mechanic',
          mechanicName: activeMec.name,
          mileageAtService: vehicle.mileage,
          serviceDate: bookDate,
          status: 'in_progress' // Marks as in_progress pending complete
        })
      });

      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error || 'Failed to submit appointment.');
      }

      alert(`Appointment successfully requested with ${activeMec.name} on ${bookDate}! Details added to your historic Service Logs.`);
      setActiveMec(null);
      setActionType(null);
      setBookDescription('');
      onRefreshHistory();
    } catch (err) {
      alert(err.message || 'Error booking appointment.');
    }
  };

  return (
    <div className="space-y-6" id="mechanics-directory-module">
      <div className="border-b border-slate-800 pb-5">
        <h1 className="text-2xl font-black text-white tracking-tight">Mechanic Directory</h1>
        <p className="text-sm text-slate-400">Locate certified experts, compare hourly rates, and schedule direct maintenance bookings.</p>
      </div>

      {/* Geolocation Radar Action Banner with outstanding Polish */}
      <div className="bg-slate-900 border border-slate-800 p-4.5 rounded-2xl flex flex-col md:flex-row items-center justify-between gap-4 shadow-md">
        <div className="flex items-center gap-3.5 w-full md:w-auto">
          <div className="p-2.5 bg-red-950/30 rounded-xl border border-red-500/15 text-red-100 animate-pulse">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-5 h-5 text-red-500">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25s-7.5-4.108-7.5-11.25a7.5 7.5 0 1115 0z" />
            </svg>
          </div>
          <div>
            <h4 className="text-xs font-extrabold text-white uppercase tracking-wider">Dynamic Mechanic Radar Active</h4>
            <p className="text-[11px] text-slate-400 mt-0.5">
              {userLocation ? (
                <>📍 My Coordinates: <span className="font-mono text-emerald-400 font-bold">{userLocation.lat.toFixed(4)}, {userLocation.lng.toFixed(4)}</span></>
              ) : (
                'Syncing physical GPS coordinates to match and map closest workshop mechanics...'
              )}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2.5 w-full md:w-auto justify-end">
          {userLocation ? (
            <span className="text-[10px] bg-emerald-950/40 border border-emerald-500/20 text-emerald-450 font-bold px-3 py-1.5 rounded-xl font-sans flex items-center gap-1.5 shrink-0 select-none">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-450 animate-ping"></span> GPS Linked
            </span>
          ) : (
            <span className="text-[10px] bg-amber-950/40 border border-amber-500/20 text-amber-400 font-bold px-3 py-1.5 rounded-xl font-sans shrink-0 select-none">
              Default SF Center
            </span>
          )}
          <button
            type="button"
            onClick={requestUserGeoLocation}
            disabled={geoLoading}
            className="bg-red-650 hover:bg-red-600 disabled:opacity-50 active:scale-95 text-white font-extrabold text-[10.5px] uppercase tracking-wider py-2 px-4 rounded-xl shadow-md transition cursor-pointer select-none shrink-0"
          >
            {geoLoading ? 'Syncing...' : 'Use My Location 🎯'}
          </button>
        </div>
      </div>

      {/* Advanced Filter Layout (Row styled) */}
      <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4" id="filters-container">
        <div>
          <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">Search Query</label>
          <input
            type="text"
            placeholder="Search mechanics, keywords..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-slate-950 border border-slate-800 focus:border-red-500 text-slate-200 py-2 px-3 rounded-lg outline-none text-xs"
          />
        </div>

        <div>
          <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">Category Specialty</label>
          <select
            value={specialty}
            onChange={(e) => setSpecialty(e.target.value)}
            className="w-full bg-slate-950 border border-slate-800 text-slate-200 py-2 px-3 rounded-lg outline-none text-xs cursor-pointer"
          >
            <option value="">All Specialties</option>
            {SPECIALTIES.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>

        <div>
          <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">Sort Sequences</label>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            className="w-full bg-slate-950 border border-slate-800 text-slate-200 py-2 px-3 rounded-lg outline-none text-xs cursor-pointer"
          >
            <option value="rating">Highest Rated Stellar ⭐</option>
            <option value="rate_asc">Hourly Rate: Low to High</option>
            <option value="rate_desc">Hourly Rate: High to Low</option>
            <option value="reviews">Most Reviewed Shop</option>
            <option value="distance">Nearest Workshop Distance 📍</option>
          </select>
        </div>

        <div>
          <div className="flex justify-between text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">
            <span>Max Hourly Rate</span>
            <span className="text-red-500 font-mono">${maxRate}/hr</span>
          </div>
          <input
            type="range"
            min="80"
            max="200"
            step="10"
            value={maxRate}
            onChange={(e) => setMaxRate(e.target.value)}
            className="w-full accent-red-600 cursor-pointer bg-slate-950 h-2 rounded"
          />
        </div>
      </div>

      {error && (
        <div className="bg-red-950/20 border border-red-500/20 p-3 rounded-xl text-red-500 text-xs">
          {error}
        </div>
      )}      {/* Responsive mobile/tablet Map view toggle bar */}
      <div className="flex lg:hidden justify-between items-center bg-slate-900 border border-slate-800/80 px-4 py-3 rounded-2xl" id="mapbox-mobile-toggle-bar">
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-extrabold uppercase tracking-widest text-slate-400">Locational Filter Map</span>
          {showMapOnMobile && (
            <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse"></span>
          )}
        </div>
        <button
          type="button"
          onClick={() => setShowMapOnMobile(!showMapOnMobile)}
          className="bg-slate-950 hover:bg-slate-850 text-slate-300 hover:text-white border border-slate-800 font-extrabold text-[10px] uppercase tracking-wider px-3.5 py-1.5 rounded-xl transition cursor-pointer select-none"
        >
          {showMapOnMobile ? 'View Workshops' : 'View Interactive Map 🗺️'}
        </button>
      </div>

      {/* Directory Split Grid Layout: Listings (Left) + Interactive Map (Right) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start" id="mechanics-directory-grid">
        
        {/* Listings Container */}
        <div className={`col-span-1 lg:col-span-7 space-y-4 ${showMapOnMobile ? 'hidden lg:block' : 'block'}`}>
          {loading ? (
            <div className="flex justify-center items-center py-20" id="mechanic-loader">
              <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-red-600"></div>
            </div>
          ) : mechanics.length === 0 ? (
            <div className="text-center py-16 border border-dashed border-slate-800 rounded-2xl bg-slate-900/10">
              <p className="text-slate-500 text-sm">No mechanics matched your customized filters.</p>
              <button onClick={() => { setSearch(''); setSpecialty(''); setMaxRate('200'); }} className="text-xs text-red-400 font-bold hover:underline mt-2">Reset Filter Queries</button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2 gap-4" id="mechanics-listings-grid">
              {mechanics.map((m) => (
                <div 
                  key={m.id} 
                  onClick={() => setSelectedMapMechanic(m)}
                  className={`bg-slate-900 border rounded-2xl p-4.5 flex flex-col justify-between space-y-3.5 cursor-pointer transition duration-300 select-none hover:shadow-lg ${
                    selectedMapMechanic?.id === m.id 
                      ? 'border-red-500/80 bg-slate-900/90 shadow-xl ring-1 ring-red-500/30' 
                      : 'border-slate-850 bg-slate-900/40 hover:border-slate-700/80 hover:bg-slate-900'
                  }`}
                >
                  <div className="space-y-2">
                    {/* Shop Title */}
                    <div className="flex justify-between items-start gap-2">
                      <h3 className="font-extrabold text-sm text-white font-sans leading-snug">{m.name}</h3>
                      <div className="flex items-center gap-1 text-[11px] font-black font-sans text-amber-400 shrink-0">
                        <span>★</span>
                        <span>{m.rating.toFixed(1)}</span>
                        <span className="text-slate-500 text-[9px] font-medium">({m.reviewsCount})</span>
                      </div>
                    </div>

                    <div className="text-xs text-slate-400 leading-normal flex items-start gap-1">
                      <span className="text-slate-600 shrink-0 select-none">📍</span>
                      <span>{m.address}</span>
                    </div>

                    <div className="flex gap-2 items-center text-[11px]">
                      <span className="text-slate-500">Hourly Rate:</span>
                      <strong className="text-emerald-400 font-mono">${m.averageHourlyRate}/hr avg</strong>
                      <span className="text-slate-700">•</span>
                      <span className="text-slate-500 font-mono">{m.distance} away</span>
                    </div>

                    {/* Specialties tags */}
                    <div className="flex flex-wrap gap-1 pt-1">
                      {m.specialties.map((s, idx) => (
                        <span key={idx} className="bg-slate-950 border border-slate-800 text-[9px] font-mono tracking-wide px-2 py-0.5 rounded text-slate-300">
                          {s}
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* Utility CTA actions */}
                  <div className="border-t border-slate-950 pt-3.5 grid grid-cols-2 gap-3" id="mechanic-card-ctas">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        if (onContactMechanic) {
                          onContactMechanic(m.id);
                        } else {
                          setActiveMec(m);
                          setActionType('contact');
                        }
                      }}
                      className="bg-slate-950 hover:bg-slate-850 text-slate-300 hover:text-white border border-slate-800 font-extrabold text-[10px] uppercase tracking-wider py-2 rounded-xl transition cursor-pointer text-center"
                    >
                      Contact Shop
                    </button>
                    <button
                      type="button"
                      onClick={(e) => { 
                        e.stopPropagation(); 
                        setActiveMec(m); 
                        setActionType('repair-request'); 
                      }}
                      className="bg-red-650 hover:bg-red-600 text-white font-extrabold text-[10px] uppercase tracking-wider py-2 rounded-xl shadow-md transition cursor-pointer text-center border border-transparent"
                    >
                      Select Mechanic
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Map Container (Sticky on desktop, toggleable on mobile) */}
        <div className={`col-span-1 lg:col-span-5 lg:sticky lg:top-4 z-10 bg-slate-950 border border-slate-800/80 rounded-2xl overflow-hidden p-1 shadow-2xl h-[450px] lg:h-[calc(100vh-140px)] min-h-[400px] lg:max-h-[660px] ${
          showMapOnMobile ? 'block' : 'hidden lg:block'
        }`}>
          <MechanicMap 
            mechanics={mechanics}
            selectedMechanic={selectedMapMechanic}
            userLocation={userLocation}
            geoLoading={geoLoading}
            onLocateUser={requestUserGeoLocation}
            onSelectMechanic={(m) => {
              setSelectedMapMechanic(m);
              setActiveMec(m);
              setActionType('repair-request');
            }}
          />
        </div>

      </div>


      {/* Booking and Contact overlay Modal */}
      {activeMec && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fade-in" id="mechanic-modal-overlay">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 space-y-4 relative animate-scale-up">
            <button
              onClick={() => { setActiveMec(null); setActionType(null); }}
              className="absolute top-4 right-4 text-slate-500 hover:text-white transition text-lg font-black shrink-0 cursor-pointer select-none"
            >
              &times;
            </button>

            {actionType === 'contact' && (
              <div className="space-y-4">
                <div className="p-3 bg-red-950/20 rounded-full border border-red-500/10 text-red-400 w-fit">
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-6 h-6">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 002.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.387a12.035 12.035 0 01-7.108-7.108c-.115-.44.05-1.028.387-1.306l1.293-.97a1.5 1.5 0 00.417-1.173L6.963 3.102a1.125 1.125 0 00-1.11-1.004H3.72c-.622 0-1.129.504-1.09 1.124.08 1.25.32 2.457.69 3.611z" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-lg font-extrabold text-white">{activeMec.name}</h3>
                  <p className="text-xs text-slate-400 mt-1">Direct communication bridge</p>
                </div>
                <div className="bg-slate-950 border border-slate-800 p-4 rounded-xl space-y-3 font-mono text-xs text-slate-300">
                  <div className="flex justify-between">
                    <span className="text-slate-500">Telephone:</span>
                    <strong className="text-white select-all">{activeMec.phone}</strong>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Operation Hours:</span>
                    <span className="text-white text-right">{activeMec.schedule}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Hourly Rate:</span>
                    <span className="text-emerald-400 font-bold">${activeMec.averageHourlyRate}/hour</span>
                  </div>
                </div>
                <div className="bg-amber-950/20 border border-amber-500/10 p-3.5 rounded-xl text-amber-300 text-[11px] leading-relaxed font-sans">
                  📢 <strong>Note:</strong> Mention <strong>AUTOAID Diagnostics</strong> on your call to redeem 10% off your initial shop labor fee!
                </div>
                <button
                  onClick={() => { setActiveMec(null); setActionType(null); }}
                  className="w-full bg-slate-800 hover:bg-slate-700 font-extrabold text-xs text-slate-200 py-2.5 rounded-xl cursor-pointer"
                >
                  Close dialer screen
                </button>
              </div>
            )}

            {actionType === 'repair-request' && (
              <form onSubmit={handleRepairRequestSubmit} className="space-y-4">
                <div className="pb-2 border-b border-slate-800">
                  <h3 className="text-base font-extrabold text-white">Select Mechanic for Repairs</h3>
                  <p className="text-xs text-slate-400 mt-1">Initiates a Repair Request and starts a real-time messaging thread with {activeMec.name}.</p>
                </div>

                <div className="space-y-3">
                  {vehicles.length === 0 ? (
                    <div className="p-4 bg-red-950/25 border border-red-500/25 rounded-xl text-center space-y-2">
                      <p className="text-xs text-red-400 font-bold">⚠️ No vehicles registered in your garage yet.</p>
                      <button
                        type="button"
                        onClick={() => { setActiveMec(null); setActionType(null); navigate('/garage'); }}
                        className="bg-red-650 hover:bg-red-600 text-white font-black text-[10px] uppercase py-1.5 px-3 rounded-lg cursor-pointer"
                      >
                        Go to Garage & Register
                      </button>
                    </div>
                  ) : (
                    <>
                      <div>
                        <label className="block text-[10px] uppercase font-bold text-slate-500 mb-1">Select Garaged Vehicle</label>
                        <select
                          value={requestVehicleId}
                          onChange={(e) => setRequestVehicleId(e.target.value)}
                          className="w-full bg-slate-950 border border-slate-800 text-slate-200 py-2.5 px-3 rounded-lg outline-none text-xs cursor-pointer"
                        >
                          {vehicles.map(v => (
                            <option key={v.id} value={v.id}>{v.make} {v.model} ({v.year})</option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="block text-[10px] uppercase font-bold text-slate-500 mb-1">Damage Type / Service Required</label>
                        <select
                          value={requestDamageType}
                          onChange={(e) => setRequestDamageType(e.target.value)}
                          className="w-full bg-slate-950 border border-slate-800 text-slate-200 py-2.5 px-3 rounded-lg outline-none text-xs cursor-pointer"
                        >
                          <option value="Dent Repair">Dent Repair</option>
                          <option value="Scratch Repair">Scratch Repair</option>
                          <option value="Engine Diagnostic">Engine Diagnostic</option>
                          <option value="Brake Repair">Brake Repair</option>
                          <option value="Body Shop Repair">Body Shop Repair</option>
                          <option value="Suspension Alignment">Suspension Alignment</option>
                          <option value="Oil & General Mechanics">Oil & General Mechanics</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-[10px] uppercase font-bold text-slate-500 mb-1">Brief Issue Statement / Description</label>
                        <textarea
                          rows={3}
                          value={requestDescription}
                          onChange={(e) => setRequestDescription(e.target.value)}
                          placeholder="Please provide details about target repair elements..."
                          className="w-full bg-slate-950 border border-slate-800 focus:border-red-500 text-slate-200 py-2 px-3 rounded-lg outline-none text-xs resize-none"
                        ></textarea>
                      </div>
                    </>
                  )}
                </div>

                <div className="flex gap-2 justify-end pt-2">
                  <button
                    type="button"
                    onClick={() => { setActiveMec(null); setActionType(null); }}
                    className="bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs py-2 px-4 rounded-xl font-bold transition cursor-pointer"
                  >
                    Cancel
                  </button>
                  {vehicles.length > 0 && (
                    <button
                      type="submit"
                      disabled={submittingRequest}
                      className="bg-red-650 hover:bg-red-600 text-white text-xs py-2 px-4 rounded-xl font-bold shadow-md transition cursor-pointer"
                    >
                      {submittingRequest ? 'Creating Request...' : 'Confirm Request'}
                    </button>
                  )}
                </div>
              </form>
            )}

            {actionType === 'book' && (
              <form onSubmit={handleBookingSubmit} className="space-y-4">
                <div className="pb-2 border-b border-slate-800">
                  <h3 className="text-base font-extrabold text-white">Book Appointment</h3>
                  <p className="text-xs text-slate-400 mt-1">Submit date and service particulars to {activeMec.name}.</p>
                </div>

                <div className="space-y-3">
                  <div>
                    <label className="block text-[10px] uppercase font-bold text-slate-500 mb-1">Select Garaged Vehicle</label>
                    <select
                      value={bookVehicleId}
                      onChange={(e) => setBookVehicleId(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 text-slate-200 py-2 px-3 rounded-lg outline-none text-xs cursor-pointer"
                    >
                      {vehicles.map(v => (
                        <option key={v.id} value={v.id}>{v.make} {v.model} ({v.year})</option>
                      ))}
                    </select>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[10px] uppercase font-bold text-slate-500 mb-1">Service Type</label>
                      <select
                        value={bookType}
                        onChange={(e) => setBookType(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-800 text-slate-200 py-2 px-3 rounded-lg outline-none text-xs cursor-pointer"
                      >
                        <option value="Maintenance">Maintenance</option>
                        <option value="Repair">Repair Work</option>
                        <option value="Diagnostic">Diagnostics Check</option>
                        <option value="Body Shop">Structural Body</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-[10px] uppercase font-bold text-slate-500 mb-1">Appt. Date</label>
                      <input
                        type="date"
                        required
                        value={bookDate}
                        onChange={(e) => setBookDate(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-800 text-slate-200 py-2 px-3 rounded-lg outline-none text-xs font-mono cursor-pointer"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3 bg-slate-950 p-2.5 border border-slate-800 rounded-xl items-center">
                    <span className="text-[11px] font-bold text-slate-500">Simulate Booking Fee:</span>
                    <div className="flex items-center bg-slate-900 px-2 py-1 border border-slate-800 rounded">
                      <span className="text-slate-500 text-xs font-mono mr-1">$</span>
                      <input
                        type="number"
                        value={bookCost}
                        onChange={(e) => setBookCost(e.target.value)}
                        className="bg-transparent border-none text-xs font-mono outline-none text-white w-full"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[10px] uppercase font-bold text-slate-500 mb-1">Notes / Instructions</label>
                    <textarea
                      rows={3}
                      value={bookDescription}
                      onChange={(e) => setBookDescription(e.target.value)}
                      placeholder="e.g., Squeak from front left brake pads, alignment slightly pulls to the right..."
                      className="w-full bg-slate-950 border border-slate-800 focus:border-red-500 text-slate-200 py-2 px-3 rounded-lg outline-none text-xs resize-none"
                    ></textarea>
                  </div>
                </div>

                <div className="flex gap-2 justify-end pt-2">
                  <button
                    type="button"
                    onClick={() => { setActiveMec(null); setActionType(null); }}
                    className="bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs py-2 px-4 rounded-xl font-bold transition cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="bg-red-650 hover:bg-red-600 text-white text-xs py-2 px-4 rounded-xl font-bold shadow-md transition cursor-pointer"
                  >
                    Confirm Booking
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}