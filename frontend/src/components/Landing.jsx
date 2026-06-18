// Landing.js
import { useState } from 'react';
import { 
  ShieldAlert, 
  Cpu, 
  ChevronRight, 
  Check, 
  Wrench, 
  Car, 
  Award, 
  Sparkles, 
  ShieldCheck, 
  Layers, 
  Activity, 
  Flame, 
  Clock, 
  Gauge,
  CheckCircle2,
  Lock
} from 'lucide-react';

export default function Landing({ onEnter, isAuthenticated }) {
  const [hoveredPlan, setHoveredPlan] = useState(null);

  const trustBadges = [
    "AI-Assisted Diagnostics",
    "Verified Mechanics",
    "Transparent Pricing",
    "Digital Service Records"
  ];

  const ownerBenefits = [
    { text: "Register vehicles", desc: "Keep a digital log of your entire family fleet instantly." },
    { text: "Upload damage reports", desc: "Easily upload photos or capture real-time webcam assets." },
    { text: "Get repair estimates", desc: "Stateless neural cost valuations powered by Gemini AI." },
    { text: "Track service history", desc: "Categorized charts on telemetry and oil/tire wear lifecycles." },
    { text: "Monitor vehicle health", desc: "Intelligent analytics dashboard visualizing monthly trends." }
  ];

  const mechanicBenefits = [
    { text: "Receive repair requests", desc: "Get instantly booked by local users who need professional fixes." },
    { text: "Manage customers", desc: "Stateful customer tracking with seamless repair record updates." },
    { text: "Submit quotations", desc: "Quote accurately and transparently with pre-compiled parts lists." },
    { text: "Build reputation", desc: "Grow trust in the local ecosystem under digital audit trails." },
    { text: "Track earnings", desc: "Comprehensive diagnostic summary statistics in your terminal." }
  ];

  const plans = [
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
      accent: "from-slate-800 to-slate-900 border-slate-800"
    },
    {
      name: "Standard Plan",
      price: "₹199",
      features: [
        "Everything in Basic",
        "AI Damage Analysis",
        "Repair Cost Estimation",
        "Priority Support"
      ],
      popular: true,
      badge: "Most Popular",
      accent: "from-slate-900 via-red-950/20 to-slate-900 border-red-500/30 ring-1 ring-red-500/10"
    },
    {
      name: "Premium Plan",
      price: "₹299",
      features: [
        "Everything in Standard",
        "Advanced Analytics",
        "Full Maintenance History",
        "Premium Assistance"
      ],
      popular: false,
      accent: "from-slate-800 to-slate-900 border-slate-800"
    }
  ];

  return (
    <div className="bg-slate-950 text-white min-h-screen relative overflow-hidden flex flex-col justify-between" id="landing-page">
      {/* Absolute Blurred Grid Backdrops and glowing cyber orbs */}
      <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(ellipse_80%_80%_at_50%_-20%,rgba(239,68,68,0.18),rgba(255,255,255,0))]" />
      <div className="absolute top-1/4 left-1/4 w-80 h-80 bg-red-600/5 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-1/3 right-1/4 w-96 h-96 bg-orange-600/5 rounded-full blur-[140px] pointer-events-none" />
      
      {/* Subtle tech grid background */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#0f172a_1px,transparent_1px),linear-gradient(to_bottom,#0f172a_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_100%)] opacity-25 pointer-events-none"></div>

      {/* Hero Header */}
      <header className="relative max-w-7xl mx-auto w-full px-6 py-6 flex items-center justify-between z-10 shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="p-2 bg-gradient-to-br from-red-600 to-rose-600 rounded-xl shadow-md shadow-red-600/10">
            <ShieldAlert className="w-5 h-5 text-white" />
          </div>
          <span className="font-sans text-xl font-black tracking-tight text-white uppercase">
            AUTOAID
          </span>
        </div>
        <div className="flex items-center gap-4">
          <button
            onClick={() => onEnter('user')}
            className="hidden sm:inline-flex bg-slate-950 border border-slate-850 hover:bg-slate-900 hover:border-slate-800 px-4 py-2 rounded-xl text-xs font-bold transition text-slate-300 items-center gap-1 cursor-pointer"
          >
            Owner Portal
          </button>
          <button
            onClick={() => onEnter('mechanic')}
            className="bg-slate-900 border border-slate-800 hover:border-slate-700 hover:bg-slate-800 px-4 sm:px-5 py-2 rounded-xl text-xs font-bold transition shadow-md flex items-center gap-2 cursor-pointer"
          >
            {isAuthenticated ? 'Enter Console' : 'Partner Portal'}
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </header>

      {/* Main Container */}
      <main className="relative max-w-7xl mx-auto w-full px-6 flex-1 flex flex-col justify-center items-center py-12 md:py-20 z-10">
        
        {/* Animated Badge */}
        <div className="inline-flex items-center gap-2 bg-red-500/10 border border-red-500/20 px-4.5 py-1.5 rounded-full text-red-400 text-xs font-black tracking-widest uppercase mb-7 shadow-inner">
          <Cpu className="w-3.5 h-3.5 text-red-500 animate-spin" style={{ animationDuration: '4s' }} />
          <span>Automotive Intelligence Platform</span>
        </div>

        {/* Hero Title */}
        <h1 className="text-4xl sm:text-6xl lg:text-7.5xl font-sans font-black text-white tracking-tight leading-[1.05] max-w-4xl text-center">
          Vehicle Maintenance Made Smart. <br />
          <span className="bg-gradient-to-r from-red-500 via-rose-500 to-orange-500 text-transparent bg-clip-text">
            Repairs Made Simple.
          </span>
        </h1>

        {/* Hero Description */}
        <p className="text-slate-400 text-sm sm:text-base md:text-lg max-w-3xl mt-6 leading-relaxed text-center">
          Upload vehicle damage, get instant repair estimates, connect with trusted mechanics, track maintenance history, and keep your vehicle healthy with AI-powered insights.
        </p>

        {/* Strong Motto/Tagline Section */}
        <div className="my-8 py-2 px-6 bg-slate-950/60 backdrop-blur-md rounded-full border border-slate-900 inline-block text-center relative overflow-hidden shadow-inner">
          <div className="absolute top-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-red-500/40 to-transparent"></div>
          <span className="text-xs sm:text-sm font-extrabold tracking-wider bg-gradient-to-r from-slate-200 via-slate-100 to-slate-400 text-transparent bg-clip-text uppercase">
            Detect. Repair. Maintain. Drive with Confidence.
          </span>
        </div>

        {/* CTA Button Block (Dual-role entrance channels) */}
        <div className="flex flex-col sm:flex-row gap-4 w-full sm:w-auto min-w-[340px] sm:min-w-0" id="cta-group">
          <button
            onClick={() => onEnter('user')}
            className="flex-1 sm:flex-initial bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500 text-white font-black text-sm px-8 py-3.5 rounded-xl transition duration-150 shadow-lg shadow-red-500/20 hover:shadow-red-500/35 active:scale-95 flex items-center justify-center gap-2 cursor-pointer select-none"
          >
            <Car className="w-4 h-4 text-white/95" />
            Login as User
          </button>
          
          <button
            onClick={() => onEnter('mechanic')}
            className="flex-1 sm:flex-initial bg-slate-900 hover:bg-slate-800 border border-slate-800 hover:border-slate-700 text-slate-200 font-extrabold text-sm px-8 py-3.5 rounded-xl transition flex items-center justify-center gap-2 cursor-pointer select-none"
          >
            <Wrench className="w-4 h-4 text-red-500" />
            Login as Mechanic
          </button>
        </div>

        {/* Trust Bulletins list (Under CTA) */}
        <div className="mt-10 flex flex-wrap justify-center items-center gap-x-5 gap-y-2.5 max-w-3xl">
          {trustBadges.map((t, idx) => (
            <div key={idx} className="flex items-center gap-1.5 text-xs text-slate-400 font-medium">
              <CheckCircle2 className="w-3.5 h-3.5 text-red-500 flex-shrink-0" />
              <span>{t}</span>
            </div>
          ))}
        </div>

        {/* Split Role Section */}
        <div className="mt-28 w-full border-t border-slate-900/60 pt-20" id="role-specifications">
          <div className="text-center mb-16">
            <span className="text-xs font-black uppercase text-red-500 tracking-widest block mb-2">Two Sides, One Seamless Platform</span>
            <h2 className="text-2xl sm:text-4xl font-extrabold tracking-tight text-white">Startup Role Selection</h2>
            <p className="text-xs sm:text-sm text-slate-400 mt-3 max-w-xl mx-auto">
              Connecting modern vehicle owners with certified, state-of-the-art diagnostic workshop technicians in real-time.
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 max-w-6xl mx-auto">
            {/* Owners Segment */}
            <div className="bg-slate-900/40 backdrop-blur-md border border-slate-900 rounded-3xl p-8 relative overflow-hidden group hover:border-rose-500/20 transition-all duration-300 shadow-xl">
              <div className="absolute top-0 right-0 w-32 h-32 bg-rose-500/5 rounded-full blur-3xl group-hover:bg-rose-500/10 transition"></div>
              
              <div className="flex items-center gap-3.5 mb-6">
                <div className="p-3 bg-rose-950/40 rounded-2xl text-rose-400 border border-rose-500/10">
                  <Car className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-slate-100 font-sans">For Vehicle Owners</h3>
                  <p className="text-xs text-slate-500 uppercase tracking-widest mt-0.5">Automotive Consumers</p>
                </div>
              </div>

              <div className="space-y-4">
                {ownerBenefits.map((b, i) => (
                  <div key={i} className="flex gap-3 items-start">
                    <div className="p-0.5 mt-0.5 bg-rose-950/50 rounded-full border border-rose-500/25 shrink-0 text-rose-400">
                      <Check className="w-3 h-3" />
                    </div>
                    <div>
                      <span className="text-xs font-extrabold text-slate-200 block">{b.text}</span>
                      <span className="text-[11px] text-slate-400 block mt-0.5">{b.desc}</span>
                    </div>
                  </div>
                ))}
              </div>

              <button 
                onClick={() => onEnter('user')}
                className="mt-8 w-full bg-slate-950 hover:bg-slate-900 text-rose-400 border border-slate-850 hover:border-rose-950/40 py-2.5 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer"
              >
                Sign up as Owner
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Mechanics Segment */}
            <div className="bg-slate-900/40 backdrop-blur-md border border-slate-900 rounded-3xl p-8 relative overflow-hidden group hover:border-red-500/20 transition-all duration-300 shadow-xl">
              <div className="absolute top-0 right-0 w-32 h-32 bg-red-500/5 rounded-full blur-3xl group-hover:bg-red-500/10 transition"></div>
              
              <div className="flex items-center gap-3.5 mb-6">
                <div className="p-3 bg-red-950/40 rounded-2xl text-red-400 border border-red-500/10">
                  <Wrench className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-slate-100 font-sans">For Mechanics</h3>
                  <p className="text-xs text-slate-500 uppercase tracking-widest mt-0.5">Workshop Partners</p>
                </div>
              </div>

              <div className="space-y-4">
                {mechanicBenefits.map((b, i) => (
                  <div key={i} className="flex gap-3 items-start">
                    <div className="p-0.5 mt-0.5 bg-red-950/50 rounded-full border border-red-500/25 shrink-0 text-red-400">
                      <Check className="w-3 h-3" />
                    </div>
                    <div>
                      <span className="text-xs font-extrabold text-slate-200 block">{b.text}</span>
                      <span className="text-[11px] text-slate-400 block mt-0.5">{b.desc}</span>
                    </div>
                  </div>
                ))}
              </div>

              <button 
                onClick={() => onEnter('mechanic')}
                className="mt-8 w-full bg-slate-950 hover:bg-slate-900 text-red-400 border border-slate-850 hover:border-red-950/40 py-2.5 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer"
              >
                Sign up as Mechanic
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>



      </main>

      {/* Footer */}
      <footer className="relative max-w-7xl mx-auto w-full px-6 py-8 border-t border-slate-900/60 flex flex-col sm:flex-row items-center justify-between text-[11px] text-slate-600 z-10 shrink-0 gap-3">
        <p>&copy; 2026 AUTOAID Platform. All rights reserved.</p>
        <div className="flex gap-4">
          <span className="font-mono hover:text-slate-400 transition cursor-pointer">Security Protocols</span>
          <span className="font-mono hover:text-slate-400 transition cursor-pointer">API Keys Sandbox</span>
          <span className="font-mono text-red-500 uppercase font-black">Startup Division V1.1</span>
        </div>
      </footer>
    </div>
  );
}