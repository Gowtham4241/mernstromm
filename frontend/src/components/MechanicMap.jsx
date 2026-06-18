import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import MechanicMarker from './MechanicMarker.jsx';
import MechanicPopup from './MechanicPopup.jsx';

const MAPBOX_TOKEN = 'pk.eyJ1IjoicHJpYTA5ODciLCJhIjoiY21xaml0NXA1MGhyYzJycXhycGg2N2JzNyJ9.yO88NridFglGvo5gNT6Hnw';

export default function MechanicMap({
  userLocation,
  mechanics = [],
  selectedMechanic,
  loading,
  error,
  onFocusMechanic = () => {},
  onSelectMechanic,
}) {
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const [map, setMap] = useState(null);
  const [mapError, setMapError] = useState('');
  const normalizedUserLocation = userLocation
    ? {
        latitude: userLocation.latitude ?? userLocation.lat,
        longitude: userLocation.longitude ?? userLocation.lng,
      }
    : null;

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return undefined;

    if (!MAPBOX_TOKEN) {
      setMapError('Mapbox token is missing. Add VITE_MAPBOX_ACCESS_TOKEN to your environment.');
      return undefined;
    }

    mapboxgl.accessToken = MAPBOX_TOKEN;

    const center = normalizedUserLocation
      ? [normalizedUserLocation.longitude, normalizedUserLocation.latitude]
      : [-122.4194, 37.7749];

    const instance = new mapboxgl.Map({
      container: containerRef.current,
      style: 'mapbox://styles/mapbox/dark-v11',
      center,
      zoom: normalizedUserLocation ? 13 : 12,
    });

    instance.addControl(new mapboxgl.NavigationControl({ visualizePitch: true }), 'top-right');
    instance.addControl(new mapboxgl.GeolocateControl({
      positionOptions: { enableHighAccuracy: true },
      trackUserLocation: true,
      showUserHeading: true,
    }), 'top-right');

    instance.on('load', () => setMap(instance));
    instance.on('error', () => setMapError('Map failed to load. Please verify your Mapbox token and network connection.'));

    mapRef.current = instance;

    return () => {
      instance.remove();
      mapRef.current = null;
      setMap(null);
    };
  }, []);

  useEffect(() => {
    if (!map || !normalizedUserLocation) return;

    map.flyTo({
      center: [normalizedUserLocation.longitude, normalizedUserLocation.latitude],
      zoom: 13,
      duration: 900,
      essential: true,
    });
  }, [map, normalizedUserLocation?.latitude, normalizedUserLocation?.longitude]);

  useEffect(() => {
    if (!map || !selectedMechanic) return;

    map.flyTo({
      center: [selectedMechanic.lng, selectedMechanic.lat],
      zoom: 14,
      duration: 800,
      essential: true,
    });
  }, [map, selectedMechanic?.id]);

  const popups = useMemo(() => {
    if (!map) return {};

    return mechanics.reduce((acc, mechanic) => {
      const popupNode = document.createElement('div');
      const root = createRoot(popupNode);
      root.render(
        <MechanicPopup
          mechanic={mechanic}
          selected={selectedMechanic?.id === mechanic.id}
          onSelect={onSelectMechanic}
        />
      );

      acc[mechanic.id] = new mapboxgl.Popup({
        offset: 18,
        closeButton: true,
        className: 'microshield-mechanic-popup',
      }).setDOMContent(popupNode);

      return acc;
    }, {});
  }, [map, mechanics, selectedMechanic?.id, onSelectMechanic]);

  return (
    <section className="relative h-[440px] min-h-[360px] w-full overflow-hidden rounded-lg border border-slate-800 bg-slate-950 lg:h-[calc(100vh-8rem)]">
      <div ref={containerRef} className="h-full w-full" />

      {map && normalizedUserLocation && (
        <MechanicMarker
          map={map}
          type="user"
          latitude={normalizedUserLocation.latitude}
          longitude={normalizedUserLocation.longitude}
        />
      )}

      {map && mechanics.map((mechanic) => (
        <MechanicMarker
          key={mechanic.id}
          map={map}
          latitude={mechanic.lat}
          longitude={mechanic.lng}
          selected={selectedMechanic?.id === mechanic.id}
          popup={popups[mechanic.id]}
          onClick={() => onFocusMechanic(mechanic)}
        />
      ))}

      {(loading || error || mapError) && (
        <div className="absolute inset-x-4 top-4 z-10">
          {loading && (
            <div className="rounded-lg border border-slate-800 bg-slate-900/95 p-3 text-sm text-slate-300 shadow-xl">
              Loading nearby mechanics...
            </div>
          )}
          {(error || mapError) && (
            <div className="rounded-lg border border-red-500/30 bg-red-950/90 p-3 text-sm text-red-100 shadow-xl">
              {error || mapError}
            </div>
          )}
        </div>
      )}

      <style>{`
        .microshield-mechanic-popup .mapboxgl-popup-content {
          background: #020617;
          border: 1px solid #1e293b;
          border-radius: 8px;
          padding: 12px;
          box-shadow: 0 24px 48px rgba(0, 0, 0, 0.45);
        }
        .microshield-mechanic-popup .mapboxgl-popup-close-button {
          color: #94a3b8;
          font-size: 18px;
          padding: 4px 8px;
        }
        .microshield-mechanic-popup .mapboxgl-popup-tip {
          border-top-color: #1e293b;
          border-bottom-color: #1e293b;
        }
      `}</style>
    </section>
  );
}
