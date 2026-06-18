import React from 'react';

export default function MechanicPopup({ mechanic, onSelect, selected }) {
  if (!mechanic) return null;

  const services = mechanic.services || mechanic.specialties || [];

  return (
    <div className="w-64 space-y-3 bg-slate-950 text-slate-100">
      <div>
        <div className="flex items-start justify-between gap-3">
          <h3 className="text-sm font-extrabold leading-snug text-white">{mechanic.name}</h3>
          <span className="rounded-md bg-amber-500/10 px-2 py-1 text-[11px] font-black text-amber-300">
            {Number(mechanic.rating || 0).toFixed(1)}
          </span>
        </div>
        <p className="mt-1 text-[11px] leading-relaxed text-slate-400">{mechanic.address}</p>
      </div>

      <div className="grid grid-cols-2 gap-2 text-[11px]">
        <div className="rounded-md border border-slate-800 bg-slate-900 p-2">
          <span className="block text-slate-500">Phone</span>
          <span className="font-semibold text-slate-200">{mechanic.phone || 'Not listed'}</span>
        </div>
        <div className="rounded-md border border-slate-800 bg-slate-900 p-2">
          <span className="block text-slate-500">Distance</span>
          <span className="font-semibold text-emerald-300">
            {mechanic.distanceKm !== undefined ? `${mechanic.distanceKm} km` : mechanic.distance || 'Nearby'}
          </span>
        </div>
      </div>

      <div className="flex flex-wrap gap-1">
        {services.slice(0, 5).map((service) => (
          <span key={service} className="rounded border border-slate-800 bg-slate-900 px-2 py-1 text-[10px] text-slate-300">
            {service}
          </span>
        ))}
      </div>

      <button
        type="button"
        onClick={() => onSelect(mechanic)}
        className={`w-full rounded-md px-3 py-2 text-xs font-extrabold uppercase tracking-wider text-white transition ${
          selected ? 'bg-emerald-600 hover:bg-emerald-500' : 'bg-red-600 hover:bg-red-500'
        }`}
      >
        {selected ? 'Selected Mechanic' : 'Select Mechanic'}
      </button>
    </div>
  );
}
