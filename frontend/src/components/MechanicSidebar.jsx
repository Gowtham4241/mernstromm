import React from 'react';

const SkeletonCard = () => (
  <div className="animate-pulse rounded-lg border border-slate-800 bg-slate-900 p-4">
    <div className="h-4 w-2/3 rounded bg-slate-800" />
    <div className="mt-3 h-3 w-full rounded bg-slate-800" />
    <div className="mt-2 h-3 w-3/4 rounded bg-slate-800" />
    <div className="mt-4 h-8 w-full rounded bg-slate-800" />
  </div>
);

export default function MechanicSidebar({
  mechanics,
  loading,
  error,
  selectedMechanic,
  onSelectMechanic,
  onFocusMechanic,
  damageType,
  requiredService,
  assigning,
}) {
  return (
    <aside className="lg:sticky lg:top-24 lg:max-h-[calc(100vh-7rem)] lg:overflow-y-auto">
      <div className="mb-4 rounded-lg border border-slate-800 bg-slate-900 p-4">
        <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Nearby Mechanics</p>
        <h1 className="mt-1 text-2xl font-black text-white">Mechanic Locator</h1>
        <p className="mt-2 text-sm text-slate-400">
          Sorted nearest first{requiredService ? ` and filtered for ${requiredService}` : ''}.
        </p>
        {damageType && (
          <div className="mt-3 rounded-md border border-red-500/20 bg-red-950/20 px-3 py-2 text-xs text-red-200">
            AI damage type: <strong>{damageType}</strong>
          </div>
        )}
      </div>

      {error && (
        <div className="mb-4 rounded-lg border border-red-500/30 bg-red-950/30 p-3 text-sm text-red-200">
          {error}
        </div>
      )}

      {loading ? (
        <div className="space-y-3">
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
        </div>
      ) : mechanics.length === 0 ? (
        <div className="rounded-lg border border-dashed border-slate-800 bg-slate-900/40 p-8 text-center">
          <h3 className="font-bold text-slate-200">No matching mechanics</h3>
          <p className="mt-2 text-sm text-slate-500">Try a different damage type or check again after location access is enabled.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {mechanics.map((mechanic) => {
            const selected = selectedMechanic?.id === mechanic.id;
            const services = mechanic.services || mechanic.specialties || [];

            return (
              <article
                key={mechanic.id}
                onClick={() => onFocusMechanic(mechanic)}
                className={`rounded-lg border p-4 transition hover:-translate-y-0.5 hover:shadow-xl ${
                  selected
                    ? 'border-emerald-400/70 bg-emerald-950/20 shadow-emerald-950/30'
                    : 'border-slate-800 bg-slate-900 hover:border-slate-700'
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h2 className="text-sm font-extrabold leading-snug text-white">{mechanic.name}</h2>
                    <p className="mt-1 text-xs leading-relaxed text-slate-400">{mechanic.address}</p>
                  </div>
                  <span className="rounded-md bg-amber-500/10 px-2 py-1 text-xs font-black text-amber-300">
                    {Number(mechanic.rating || 0).toFixed(1)}
                  </span>
                </div>

                <div className="mt-3 flex items-center justify-between text-xs">
                  <span className="font-semibold text-emerald-300">
                    {mechanic.distanceKm !== undefined ? `${mechanic.distanceKm} km away` : mechanic.distance || 'Distance unavailable'}
                  </span>
                  <span className="text-slate-500">${mechanic.averageHourlyRate || 0}/hr</span>
                </div>

                <div className="mt-3 flex flex-wrap gap-1">
                  {services.slice(0, 4).map((service) => (
                    <span key={service} className="rounded border border-slate-800 bg-slate-950 px-2 py-1 text-[10px] text-slate-300">
                      {service}
                    </span>
                  ))}
                </div>

                <button
                  type="button"
                  disabled={assigning}
                  onClick={(event) => {
                    event.stopPropagation();
                    onSelectMechanic(mechanic);
                  }}
                  className={`mt-4 w-full rounded-md px-3 py-2 text-xs font-extrabold uppercase tracking-wider text-white transition disabled:cursor-not-allowed disabled:opacity-60 ${
                    selected ? 'bg-emerald-600 hover:bg-emerald-500' : 'bg-red-600 hover:bg-red-500'
                  }`}
                >
                  {assigning && selected ? 'Saving...' : selected ? 'Selected' : 'Select Mechanic'}
                </button>
              </article>
            );
          })}
        </div>
      )}
    </aside>
  );
}
