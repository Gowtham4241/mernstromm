import { useState, useEffect } from 'react';
import { HashRouter, Routes, Route, Navigate, Link, useNavigate, useLocation } from 'react-router-dom';
import Landing from './components/Landing.jsx';
import Auth from './components/Auth.jsx';
import Dashboard from './components/Dashboard.jsx';
import Garage from './components/Garage.jsx';
import VehicleDetails from './components/VehicleDetails.jsx';
import DamageReports from './components/DamageReports.jsx';
import Mechanics from './components/Mechanics.jsx';
import AdminPanel from './components/AdminPanel.jsx';
import Messaging from './components/Messaging.jsx';
import MechanicMap from './components/MechanicMap.jsx';
import UserChat from './components/UserChat.jsx';
import MechanicRequests from './components/MechanicRequests.jsx';
import Payment from './components/Payment.jsx';
import MechanicLocator from './pages/MechanicLocator.jsx';
import { getActivePlan } from './paymentService.js';
import { initSocket, disconnectSocket } from './socket.js';

const ROUTES = {
  publicHome: '/',
  login: '/login',
  userHome: '/dashboard',
  userGarage: '/garage',
  userDiagnostics: '/damage-upload',
  userMechanics: '/mechanics',
  userPayment: '/payment',
  userMessages: '/messages',
  userChat: (requestId) => `/chat/${requestId}`,
  mechanicHome: '/mechanic/requests',
  adminHome: '/admin',
};

function homeForRole(role) {
  if (role === 'mechanic') return ROUTES.mechanicHome;
  if (role === 'admin') return ROUTES.adminHome;
  return ROUTES.userHome;
}

function AppContent() {
  const [token, setToken] = useState(() => {
    const t = sessionStorage.getItem('autoaid_jwt_token');
    return t && t !== 'undefined' && t !== 'null' ? t : null;
  });
  const [currentUser, setCurrentUser] = useState(() => {
    const u = sessionStorage.getItem('autoaid_user');
    return u && u !== 'undefined' && u !== 'null' ? JSON.parse(u) : null;
  });
  const [authReady, setAuthReady] = useState(() => !token);

  useEffect(() => {
    if (token && currentUser) {
      initSocket(currentUser.id, currentUser.role);
      return () => {
        disconnectSocket();
      };
    } else {
      disconnectSocket();
    }
  }, [token, currentUser]);

  const [initialMechanicId, setInitialMechanicId] = useState(null);

  const navigate = useNavigate();
  const location = useLocation();
  const currentPath = location.pathname;

  const [vehicles, setVehicles] = useState([]);
  const [reports, setReports] = useState([]);
  const [serviceHistory, setServiceHistory] = useState([]);
  const [activePlan, setActivePlan] = useState(null);
  const [loadingStates, setLoadingStates] = useState(false);

  const handleLogout = () => {
    sessionStorage.removeItem('autoaid_jwt_token');
    sessionStorage.removeItem('autoaid_user');
    setToken(null);
    setCurrentUser(null);
    setActivePlan(null);
    navigate('/');
  };

  const handleLoginSuccess = (newToken, newUser) => {
    sessionStorage.setItem('autoaid_jwt_token', newToken);
    sessionStorage.setItem('autoaid_user', JSON.stringify(newUser));
    setToken(newToken);
    setCurrentUser(newUser);
    setAuthReady(true);
    navigate(homeForRole(newUser?.role));
  };

  useEffect(() => {
    if (!token) {
      setAuthReady(true);
      return;
    }

    let cancelled = false;

    async function refreshAuthenticatedUser() {
      setAuthReady(false);
      try {
        const res = await fetch('/api/auth/me', {
          headers: { Authorization: `Bearer ${token}` },
        });

        if (!res.ok) {
          throw new Error('Session refresh failed.');
        }

        const data = await res.json();
        if (cancelled) return;

        sessionStorage.setItem('autoaid_user', JSON.stringify(data.user));
        setCurrentUser(data.user);
      } catch (err) {
        if (!cancelled) {
          handleLogout();
        }
      } finally {
        if (!cancelled) {
          setAuthReady(true);
        }
      }
    }

    refreshAuthenticatedUser();

    return () => {
      cancelled = true;
    };
  }, [token]);

  const fetchUserData = async (retryCount = 0) => {
    if (!token) return;
    setLoadingStates(true);
    try {
      const [vehRes, repRes, srvRes] = await Promise.all([
        fetch('/api/vehicles', { headers: { Authorization: `Bearer ${token}` } }),
        fetch('/api/damage-reports', { headers: { Authorization: `Bearer ${token}` } }),
        fetch('/api/service-history', { headers: { Authorization: `Bearer ${token}` } })
      ]);

      if (vehRes.ok && repRes.ok && srvRes.ok) {
        const [vehiclesData, reportsData, historyData] = await Promise.all([
          vehRes.json(),
          repRes.json(),
          srvRes.json()
        ]);
        setVehicles(vehiclesData);
        setReports(reportsData);
        setServiceHistory(historyData);
      } else {
        if (vehRes.status === 401 || repRes.status === 401 || srvRes.status === 401) {
          handleLogout();
        }
      }
    } catch (err) {
      console.error('Failed downloading database segments:', err);
      if (retryCount < 3) {
        console.log(`Retrying fetchUserData in 1.5s (Attempt ${retryCount + 1}/3)...`);
        setTimeout(() => {
          fetchUserData(retryCount + 1);
        }, 1500);
      }
    } finally {
      setLoadingStates(false);
    }
  };

  const fetchActivePlan = async () => {
    if (!token) return;
    try {
      const plan = await getActivePlan(token);
      setActivePlan(plan);
    } catch (err) {
      console.error('Failed loading active payment plan:', err);
    }
  };

  useEffect(() => {
    fetchUserData();
    fetchActivePlan();
  }, [token]);

  const handleDashboardNavigate = (tab) => {
    if (tab === 'dashboard') navigate(ROUTES.userHome);
    else if (tab === 'garage') navigate(ROUTES.userGarage);
    else if (tab === 'diagnostics') navigate(ROUTES.userDiagnostics);
    else if (tab === 'history') {
      if (vehicles.length > 0) {
        navigate(`/vehicle/${vehicles[0].id}`);
      } else {
        navigate(ROUTES.userGarage);
      }
    }
    else if (tab === 'mechanics') navigate(ROUTES.userMechanics);
    else if (tab === 'payment') navigate(ROUTES.userPayment);
    else if (tab === 'admin') navigate(ROUTES.adminHome);
  };

  const showNav = token && currentUser && !['/', '/login', '/register'].includes(currentPath);

  if (!authReady) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-400 flex items-center justify-center text-xs font-mono">
        Restoring session...
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans" id="applet-viewport">
      {showNav && currentUser && (
        <header className="bg-slate-900 border-b border-slate-800 shrink-0 sticky top-0 z-40">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex items-center justify-between h-16">
              <Link to={homeForRole(currentUser?.role)} className="flex items-center gap-2">
                <div className="p-1.5 bg-gradient-to-br from-red-600 to-rose-600 rounded-lg">
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-5 h-5 text-white">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M11.42 15.17L17.25 21A1.79 1.79 0 1115.3 18l-3.88-3.88M11.42 15.17l4.62-4.62M11.42 15.17L6 10.25M16.5 10.5h.008v.008H16.5V10.5zm-6-6h.008v.008H10.5V4.5zm0-2.25h.008v.008H10.5v-.008z" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" />
                  </svg>
                </div>
                <span className="font-exblack text-lg tracking-tight font-sans text-white">AUTOAID</span>
              </Link>

              <nav className="hidden md:flex gap-1">
                {currentUser.role !== 'mechanic' && (
                  <>
                    <Link to={ROUTES.userHome} className={`text-xs font-bold uppercase tracking-wider px-3.5 py-2 rounded-lg transition select-none cursor-pointer ${currentPath === ROUTES.userHome ? 'bg-slate-800 text-white border-b-2 border-red-500' : 'text-slate-400 hover:text-white'}`}>Dashboard</Link>
                    <Link to={ROUTES.userGarage} className={`text-xs font-bold uppercase tracking-wider px-3.5 py-2 rounded-lg transition select-none cursor-pointer ${currentPath === ROUTES.userGarage || currentPath.startsWith('/vehicle/') ? 'bg-slate-800 text-white border-b-2 border-red-500' : 'text-slate-400 hover:text-white'}`}>Garage</Link>
                    <Link to={ROUTES.userDiagnostics} className={`text-xs font-bold uppercase tracking-wider px-3.5 py-2 rounded-lg transition select-none cursor-pointer ${currentPath === ROUTES.userDiagnostics ? 'bg-slate-800 text-white border-b-2 border-red-500' : 'text-slate-400 hover:text-white'}`}>AI Scan</Link>
                    <Link to={ROUTES.userMechanics} className={`text-xs font-bold uppercase tracking-wider px-3.5 py-2 rounded-lg transition select-none cursor-pointer ${currentPath === ROUTES.userMechanics ? 'bg-slate-800 text-white border-b-2 border-red-500' : 'text-slate-400 hover:text-white'}`}>Mechanics</Link>
                    <Link to={ROUTES.userPayment} className={`text-xs font-bold uppercase tracking-wider px-3.5 py-2 rounded-lg transition select-none cursor-pointer ${currentPath === ROUTES.userPayment ? 'bg-slate-800 text-white border-b-2 border-red-500' : 'text-slate-400 hover:text-white'}`}>Payment</Link>
                    <Link to={ROUTES.userMessages} className={`text-xs font-bold uppercase tracking-wider px-3.5 py-2 rounded-lg transition select-none cursor-pointer ${currentPath === ROUTES.userMessages ? 'bg-slate-800 text-white border-b-2 border-red-500' : 'text-slate-400 hover:text-white'}`}>Messages</Link>
                  </>
                )}
                {currentUser.role === 'mechanic' && (
                  <Link to={ROUTES.mechanicHome} className={`text-xs font-bold uppercase tracking-wider px-3.5 py-2 rounded-lg transition select-none cursor-pointer ${currentPath === ROUTES.mechanicHome ? 'bg-slate-800 text-white border-b-2 border-red-500' : 'text-slate-400 hover:text-white'}`}>Requests</Link>
                )}
                {currentUser.role === 'admin' && (
                  <Link to="/admin" className={`text-xs font-extrabold uppercase tracking-widest px-3.5 py-2 rounded-lg transition border border-red-500/20 shadow-md shadow-red-500/5 cursor-pointer select-none ${currentPath === '/admin' ? 'bg-red-650 text-white font-black' : 'text-red-400 hover:text-red-200'}`}>Admin Hub</Link>
                )}
              </nav>

              <div className="flex items-center gap-4">
                <div className="text-right hidden sm:block">
                  <div className="text-xs font-bold font-sans text-slate-100">{currentUser.name}</div>
                  <div className="text-[10px] text-slate-500 uppercase font-black tracking-normal mt-0.5">{currentUser.role} Account</div>
                </div>
                <button onClick={handleLogout} className="bg-slate-850 hover:bg-slate-800 border border-slate-800 text-xs font-semibold px-3.5 py-1.5 rounded-lg transition text-slate-400 hover:text-red-400 cursor-pointer">Logout</button>
              </div>
            </div>
          </div>
        </header>
      )}

      {showNav && (
        <div className="md:hidden bg-slate-900 border-t border-slate-800 fixed bottom-0 left-0 right-0 z-40 p-1 flex justify-around shadow-lg">
          {currentUser?.role !== 'mechanic' ? (
            <>
              <Link to={ROUTES.userHome} className={`flex flex-col items-center p-2 rounded-xl text-[10px] uppercase font-black cursor-pointer ${currentPath === ROUTES.userHome ? 'text-red-500' : 'text-slate-500'}`}><span>ðŸ“Š</span><span className="mt-1 shrink-0 scale-90">Home</span></Link>
              <Link to={ROUTES.userGarage} className={`flex flex-col items-center p-2 rounded-xl text-[10px] uppercase font-black cursor-pointer ${currentPath === ROUTES.userGarage || currentPath.startsWith('/vehicle/') ? 'text-red-500' : 'text-slate-500'}`}><span>ðŸš—</span><span className="mt-1 shrink-0 scale-90">Garage</span></Link>
              <Link to={ROUTES.userDiagnostics} className={`flex flex-col items-center p-2 rounded-xl text-[10px] uppercase font-black cursor-pointer ${currentPath === ROUTES.userDiagnostics ? 'text-red-500' : 'text-slate-500'}`}><span>âš¡</span><span className="mt-1 shrink-0 scale-90">AI Scan</span></Link>
              <Link to={ROUTES.userMechanics} className={`flex flex-col items-center p-2 rounded-xl text-[10px] uppercase font-black cursor-pointer ${currentPath === ROUTES.userMechanics ? 'text-red-500' : 'text-slate-500'}`}><span>ðŸ› ï¸</span><span className="mt-1 shrink-0 scale-90">Shops</span></Link>
              <Link to={ROUTES.userPayment} className={`flex flex-col items-center p-2 rounded-xl text-[10px] uppercase font-black cursor-pointer ${currentPath === ROUTES.userPayment ? 'text-red-500' : 'text-slate-500'}`}><span>₹</span><span className="mt-1 shrink-0 scale-90">Pay</span></Link>
              <Link to={ROUTES.userMessages} className={`flex flex-col items-center p-2 rounded-xl text-[10px] uppercase font-black cursor-pointer ${currentPath === ROUTES.userMessages ? 'text-red-500' : 'text-slate-500'}`}><span>ðŸ’¬</span><span className="mt-1 shrink-0 scale-90">Messages</span></Link>
            </>
          ) : (
            <Link to={ROUTES.mechanicHome} className={`flex flex-col items-center p-2 rounded-xl text-[10px] uppercase font-black cursor-pointer ${currentPath === ROUTES.mechanicHome ? 'text-red-500' : 'text-slate-500'}`}><span>ðŸ’¬</span><span className="mt-1 shrink-0 scale-90">Requests</span></Link>
          )}
        </div>
      )}

      <main className={`flex-1 w-full mx-auto relative z-10 ${showNav ? 'max-w-7xl px-4 sm:px-6 lg:px-8 py-8 overflow-y-auto mb-16 md:mb-0' : ''}`}>
        {loadingStates && showNav && (
          <div className="absolute top-2 right-4 text-[10px] font-mono select-none text-slate-500 flex items-center gap-1.5 animate-pulse">
            <span className="w-1.5 h-1.5 bg-red-500 rounded-full inline-block animate-ping"></span>
            SYNCING TELEMETRIES...
          </div>
        )}

        <Routes>
          <Route path="/" element={<Landing onEnter={(role) => navigate(token ? (currentUser?.role === 'mechanic' ? '/requests' : '/dashboard') : '/login', { state: { role } })} isAuthenticated={!!token} />} />

          <Route path="/login" element={token && currentUser ? (currentUser.role === 'mechanic' ? <Navigate to="/requests" replace /> : <Navigate to="/dashboard" replace />) : <Auth onLoginSuccess={handleLoginSuccess} isRegister={false} />} />
          <Route path="/register" element={token && currentUser ? (currentUser.role === 'mechanic' ? <Navigate to="/requests" replace /> : <Navigate to="/dashboard" replace />) : <Auth onLoginSuccess={handleLoginSuccess} isRegister={true} />} />

          <Route path="/dashboard" element={token && currentUser ? (currentUser.role === 'mechanic' ? <Navigate to="/requests" replace /> : <Dashboard token={token} userRole={currentUser.role} vehicles={vehicles} reports={reports} activePlan={activePlan} onNavigate={handleDashboardNavigate} />) : <Navigate to="/login" />} />

          <Route path="/mechanic/dashboard" element={token && currentUser ? (currentUser.role === 'mechanic' ? <Navigate to="/requests" replace /> : <Navigate to="/dashboard" replace />) : <Navigate to="/login" />} />

          <Route path="/garage" element={token && currentUser ? (currentUser.role === 'mechanic' ? <Navigate to="/requests" replace /> : <Garage token={token} vehicles={vehicles} onRefresh={fetchUserData} />) : <Navigate to="/login" />} />

          <Route path="/vehicle/:id" element={token && currentUser ? (currentUser.role === 'mechanic' ? <Navigate to="/requests" replace /> : <VehicleDetails token={token} vehicles={vehicles} reports={reports} serviceHistory={serviceHistory} onRefresh={fetchUserData} />) : <Navigate to="/login" />} />

          <Route path="/damage-upload" element={token && currentUser ? (currentUser.role === 'mechanic' ? <Navigate to="/requests" replace /> : <DamageReports token={token} vehicles={vehicles} reports={reports} onRefresh={fetchUserData} onNavigate={handleDashboardNavigate} />) : <Navigate to="/login" />} />

          <Route path="/mechanics" element={token && currentUser ? (currentUser.role === 'mechanic' ? <Navigate to="/requests" replace /> : <Mechanics token={token} vehicles={vehicles} onRefreshHistory={fetchUserData} onContactMechanic={(mecId) => { setInitialMechanicId(mecId); navigate('/messages'); }} />) : <Navigate to="/login" />} />

          <Route path="/mechanic-locator" element={token && currentUser ? (currentUser.role === 'mechanic' ? <Navigate to="/requests" replace /> : <MechanicLocator token={token} reports={reports} onRefresh={fetchUserData} />) : <Navigate to="/login" />} />

          <Route path="/mechanic-locator/:claimId" element={token && currentUser ? (currentUser.role === 'mechanic' ? <Navigate to="/requests" replace /> : <MechanicLocator token={token} reports={reports} onRefresh={fetchUserData} />) : <Navigate to="/login" />} />

          <Route path="/payment" element={token && currentUser ? (currentUser.role === 'mechanic' ? <Navigate to="/requests" replace /> : <Payment token={token} currentUser={currentUser} onPaymentSuccess={fetchActivePlan} />) : <Navigate to="/login" />} />

          <Route path="/messages" element={token && currentUser ? (currentUser.role === 'mechanic' ? <Navigate to="/requests" replace /> : <Messaging token={token} currentUser={currentUser} initialMechanicId={initialMechanicId} onClearInitialMechanic={() => setInitialMechanicId(null)} />) : <Navigate to="/login" />} />

          <Route path="/requests" element={token && currentUser ? (currentUser.role === 'user' ? <Navigate to="/messages" replace /> : <MechanicRequests token={token} currentUser={currentUser} />) : <Navigate to="/login" />} />

          <Route path="/mechanic/requests" element={token && currentUser ? (currentUser.role === 'user' ? <Navigate to="/messages" replace /> : <MechanicRequests token={token} currentUser={currentUser} />) : <Navigate to="/login" />} />

          <Route path="/chat/:requestId" element={token && currentUser ? (currentUser.role === 'mechanic' ? <Navigate to="/requests" replace /> : <UserChat token={token} currentUser={currentUser} />) : <Navigate to="/login" />} />

          <Route path="/admin" element={token && currentUser && currentUser.role === 'admin' ? <AdminPanel token={token} reports={reports} onRefreshReports={fetchUserData} /> : <Navigate to="/dashboard" />} />

          <Route path="*" element={<Navigate to="/" />} />
        </Routes>
      </main>

      {showNav && (
        <footer className="shrink-0 bg-slate-950 border-t border-slate-900 py-6 text-center text-[10px] text-slate-600 space-y-1 relative z-10">
          <p>&copy; 2026 AUTOAID Platform. Built for the 24-Hour MERN Stack Hackathon.</p>
          <p className="font-mono text-slate-700">Compiled server architectures â€¢ Google Gemini Neural Diagnostics Engine â€¢ React SPA</p>
        </footer>
      )}
    </div>
  );
}

export default function App() {
  return (
    <HashRouter>
      <AppContent />
    </HashRouter>
  );
}



