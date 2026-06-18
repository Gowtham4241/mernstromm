import { useEffect, useRef } from 'react';
import mapboxgl from 'mapbox-gl';

const createMarkerElement = ({ type, selected }) => {
  const element = document.createElement('button');
  element.type = 'button';
  element.className = [
    'group flex h-9 w-9 items-center justify-center rounded-full border-2 shadow-xl transition',
    type === 'user'
      ? 'border-white bg-blue-600 shadow-blue-950/40'
      : selected
        ? 'border-emerald-200 bg-emerald-500 shadow-emerald-950/40 scale-110'
        : 'border-white bg-red-600 hover:bg-red-500 hover:scale-110',
  ].join(' ');
  element.innerHTML = type === 'user'
    ? '<span class="block h-3 w-3 rounded-full bg-white"></span>'
    : '<span class="text-sm font-black text-white">M</span>';
  return element;
};

export default function MechanicMarker({
  map,
  latitude,
  longitude,
  type = 'mechanic',
  selected = false,
  popup,
  onClick,
}) {
  const markerRef = useRef(null);

  useEffect(() => {
    if (!map || latitude === undefined || longitude === undefined) return undefined;

    const element = createMarkerElement({ type, selected });
    const marker = new mapboxgl.Marker({ element, anchor: 'center' })
      .setLngLat([Number(longitude), Number(latitude)])
      .addTo(map);

    if (popup) {
      marker.setPopup(popup);
    }

    const handleClick = (event) => {
      event.preventDefault();
      event.stopPropagation();
      if (onClick) onClick();
      if (popup && !popup.isOpen()) marker.togglePopup();
    };

    element.addEventListener('click', handleClick);
    markerRef.current = marker;

    return () => {
      element.removeEventListener('click', handleClick);
      marker.remove();
      markerRef.current = null;
    };
  }, [map, latitude, longitude, type, selected, popup, onClick]);

  return null;
}
