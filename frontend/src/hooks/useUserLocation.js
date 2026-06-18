import { useEffect, useState } from 'react';

const getGeoErrorMessage = (error) => {
  if (!error) return 'Unable to determine your current location.';

  if (error.code === error.PERMISSION_DENIED) {
    return 'Location permission was denied. Allow location access to sort mechanics by distance.';
  }

  if (error.code === error.POSITION_UNAVAILABLE) {
    return 'Your current location is unavailable. Please check GPS or browser location settings.';
  }

  if (error.code === error.TIMEOUT) {
    return 'Location request timed out. Try again from an area with a stronger signal.';
  }

  return error.message || 'Unable to determine your current location.';
};

export default function useUserLocation() {
  const [location, setLocation] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;

    if (!navigator.geolocation) {
      setError('Geolocation is not supported by this browser.');
      setLoading(false);
      return undefined;
    }

    setLoading(true);
    setError('');

    navigator.geolocation.getCurrentPosition(
      (position) => {
        if (cancelled) return;
        setLocation({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        });
        setLoading(false);
      },
      (geoError) => {
        if (cancelled) return;
        setLocation(null);
        setError(getGeoErrorMessage(geoError));
        setLoading(false);
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 60000,
      }
    );

    return () => {
      cancelled = true;
    };
  }, []);

  return { location, loading, error };
}
