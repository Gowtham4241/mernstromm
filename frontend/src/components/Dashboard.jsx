// Dashboard.js
import { useState, useEffect } from 'react';
import { 
  Car, 
  Wrench, 
  Bike, 
  Sparkles, 
  Check, 
  Cpu, 
  ShieldCheck, 
  Layers, 
  Activity, 
  Flame, 
  CheckCircle2, 
  Lock,
  ChevronRight,
  Clock,
  Gauge
} from 'lucide-react';

export default function Dashboard({ token, currentUser, userRole, vehicles, reports, activePlan, onNavigate }) {
  const [username, setUsername] = useState('Driver');
  const [premiumCategory, setPremiumCategory] = useState('fourWheeler');
  const [hoveredPlan, setHoveredPlan] = useState(null);

  useEffect(() => {
    try {
      const uStr = sessionStorage.getItem('autoaid_user');
      if (uStr) {
        const u = JSON.parse(uStr);
        if (u && u.name) {
          setUsername(u.name);
        }
      }
    } catch (e) {
      console.error(e);
    }
  }, []);

  const features = [
    {
      title: "AI Damage Assessment",
      desc: "Instant multi-angle neural diagnostic damage valuations using advanced vision analytics models.",
      icon: <Cpu className="w-5 h-5 text-red-500" />
    },
    {
      title: "Trusted Mechanics",
      desc: "Instant dispatching to authorized regional automotive workshops equipped with digital tools.",
      icon: <Wrench className="w-5 h-5 text-orange-500" />
    },
    {
      title: "Transparent Pricing",
      desc: "Guaranteed part valuations & benchmark labor estimates printed straight into your ledger.",
      icon: <Layers className="w-5 h-5 text-red-500" />
    },
    {
      title: "Digital Service Records",
      desc: "Tamper-proof chronological vehicle log archives tracking every change made over time.",
      icon: <ShieldCheck className="w-5 h-5 text-rose-500" />
    }
  ];

  const plans = {
    twoWheeler: [
      {
        name: "Basic Plan",
        price: "₹99",
        features: [
          "Vehicle Health Tracking",
          "Service Reminders",
          "Damage Reports",
          "Mechanic Discovery"
        ],
        popular: false,
        accent: "from-slate-900 to-slate-950 border-slate-800"
      },
      {
        name: "Standard Plan",
        price: "₹149",
        features: [
          "Everything in Basic",
          "AI Damage Analysis",
          "Repair Cost Estimation",
          "Priority Support"
        ],
        popular: true,
        badge: "Most Popular",
        accent: "from-slate-950 via-red-950/20 to-slate-950 border-red-500/30 ring-1 ring-red-500/15"
      },
      {
        name: "Premium Plan",
        price: "₹199",
        features: [
          "Everything in Standard",
          "Advanced Analytics",
          "Full Maintenance History",
          "Premium Assistance"
        ],
        popular: false,
        accent: "from-slate-900 to-slate-950 border-slate-800"
      }
    ],
    fourWheeler: [
      {
        name: "Basic Plan",
        price: "₹299",
        features: [
          "Vehicle Health Tracking",
          "Service Reminders",
          "Damage Reports",
          "Mechanic Discovery"
        ],
        popular: false,
        accent: "from-slate-900 to-slate-950 border-slate-800"
      },
      {
        name: "Standard Plan",
        price: "₹499",
        features: [
          "Everything in Basic",
          "AI Damage Analysis",
          "Repair Cost Estimation",
          "Priority Support"
        ],
        popular: true,
        badge: "Most Popular",
        accent: "from-slate-950 via-red-950/20 to-slate-950 border-red-500/30 ring-1 ring-red-500/15"
      },
      {
        name: "Premium Plan",
        price: "₹999",
        features: [
          "Everything in Standard",
          "Advanced Analytics",
          "Full Maintenance History",
          "Premium Assistance"
        ],
        popular: false,
        accent: "from-slate-900 to-slate-950 border-slate-800"
      }
    ]
  };

  const activePlansList = plans[premiumCategory];

  return (
    <div className="space-y-12 py-4" id="dashboard-main-panel">
      
      {/* Top Welcome Title & Slogan */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between border-b border-slate-900 pb-7 gap-5">
        <div>
          <h1 className="text-3xl font-black text-white tracking-tight flex items-center gap-2">
            Hello, {username} <span className="animate-pulse">👋</span>
          </h1>
          <p className="text-sm font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-red-500 via-rose-450 to-orange-400 mt-2 tracking-wide uppercase">
            Detect. Repair. Maintain. Drive with Confidence.
          </p>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <span className="text-xs text-slate-500 mr-1 font-semibold">Active Plan:</span>
          <div className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-black tracking-wider uppercase ${activePlan ? 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-400' : 'bg-amber-500/10 border border-amber-500/20 text-amber-300'}`}>
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping"></span>
            <span>{activePlan ? `${activePlan.planName} Plan` : 'No Active Plan'}</span>
          </div>
          {!activePlan && (
            <button
              type="button"
              onClick={() => onNavigate('payment')}
              className="rounded-full border border-red-500/30 px-3.5 py-1.5 text-xs font-black uppercase tracking-wider text-red-300 transition hover:bg-red-500/10"
            >
              Buy Plan
            </button>
          )}
        </div>
      </div>

      {/* Large Featured Hero Card */}
      <div className="bg-gradient-to-br from-slate-900 via-slate-900 to-red-950/15 border border-slate-850 rounded-3xl p-8 sm:p-10 relative overflow-hidden group shadow-xl shadow-slate-950/50" id="register-hero-card">
        {/* Glow Effects */}
        <div className="absolute top-0 right-0 w-80 h-80 bg-red-600/5 rounded-full blur-[90px] group-hover:scale-110 transition duration-500 pointer-events-none" />
        <div className="absolute bottom-0 left-1/4 w-40 h-40 bg-orange-600/5 rounded-full blur-[70px] pointer-events-none" />
        
        <div className="relative z-10 w-full flex flex-col items-center justify-center text-center gap-6 max-w-2xl mx-auto">
          <div className="space-y-4 flex flex-col items-center">
            <div className="p-2.5 bg-red-500/10 border border-red-500/20 rounded-2xl w-fit text-red-500">
              <Car className="w-6 h-6" />
            </div>
            <h2 className="text-2xl sm:text-3.5xl font-black text-white tracking-tight">
              Register Your Vehicle
            </h2>
            <p className="text-slate-400 text-sm sm:text-base leading-relaxed">
              Add your bike or car to start tracking maintenance, service history, and AI-powered diagnostics. Connect with local certified workshops smoothly.
            </p>
          </div>

          <button
            onClick={() => onNavigate('garage')}
            className="w-full sm:w-auto bg-gradient-to-r from-red-650 to-rose-600 hover:from-red-600 hover:to-rose-600 text-white font-black text-sm px-8 py-3.5 rounded-xl transition duration-150 shadow-lg shadow-red-500/15 hover:shadow-red-500/25 active:scale-95 shrink-0 flex items-center justify-center gap-2 cursor-pointer select-none"
          >
            <span>Register Vehicle</span>
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Premium Bottom Features Grid Section */}
      <div className="pt-8 border-t border-slate-930 space-y-7" id="bottom-features">
        <div>
          <h3 className="text-xs font-black text-red-500 uppercase tracking-widest block mb-2">Our Capabilities</h3>
          <h2 className="text-2xl font-black text-white tracking-tight">Connected Automotive Intelligence</h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
          {features.map((f, index) => (
            <div 
              key={index} 
              className="bg-slate-900/30 border border-slate-900 hover:border-slate-800/80 p-5 rounded-2xl transition duration-300 flex flex-col justify-between space-y-4"
            >
              <div className="space-y-3">
                <div className="p-2.5 bg-slate-950 border border-slate-900 rounded-xl w-fit">
                  {f.icon}
                </div>
                <h4 className="font-bold text-sm text-slate-250 leading-tight">
                  {f.title}
                </h4>
                <p className="text-xs text-slate-450 leading-relaxed">
                  {f.desc}
                </p>
              </div>
              
              <div className="flex items-center gap-1 text-[11px] font-black text-rose-500 uppercase tracking-wider group cursor-pointer pt-2 w-fit">
                <span>View Details</span>
                <ChevronRight className="w-3 h-3 group-hover:translate-x-0.5 transition" />
              </div>
            </div>
          ))}
        </div>
      </div>

    </div>
  );
}
