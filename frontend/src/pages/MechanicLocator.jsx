import React, { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import MechanicMap from '../components/MechanicMap.jsx';
import MechanicSidebar from '../components/MechanicSidebar.jsx';
import useUserLocation from '../hooks/useUserLocation.js';
import { assignMechanicToClaim, getMechanics } from '../services/mechanicService.js';
import { calculateDistance } from '../utils/distance.js';
import { filterMechanicsByDamageType, getRequiredService } from '../utils/damageFilter.js';

export default function MechanicLocator({ token, reports = [], onRefresh }) {
  const { claimId } = useParams();
  const routeLocation = useLocation();
  const navigate = useNavigate();
  const { location: userLocation, loading: locationLoading, error: locationError } = useUserLocation();

  const [mechanics, setMechanics] = useState([]);
  const [loadingMechanics, setLoadingMechanics] = useState(true);
  const [mechanicsError, setMechanicsError] = useState('');
  const [selectedMechanic, setSelectedMechanic] = useState(null);
  const [assigning, setAssigning] = useState(false);
  const [toast, setToast] = useState('');

  const damageType = routeLocation.state?.damageType
    || reports.find((report) => report.id === claimId)?.damageType
    || reports.find((report) => report.id === claimId)?.aiDiagnosis?.classifications?.[0]
    || '';

  const requiredService = getRequiredService(damageType);

  useEffect(() => {
    let cancelled = false;

    async function loadMechanics() {
      setLoadingMechanics(true);
      setMechanicsError('');

      try {
        const params = userLocation
          ? {
              userLat: userLocation.latitude,
              userLng: userLocation.longitude,
              sortBy: 'distance',
            }
          : {};

        const data = await getMechanics(params);
        if (!cancelled) setMechanics(data);
      } catch (error) {
        if (!cancelled) setMechanicsError(error.response?.data?.error || error.message || 'Unable to load mechanics.');
      } finally {
        if (!cancelled) setLoadingMechanics(false);
      }
    }

    loadMechanics();

    return () => {
      cancelled = true;
    };
  }, [userLocation?.latitude, userLocation?.longitude]);

  const rankedMechanics = useMemo(() => {
    const withDistance = mechanics.map((mechanic) => {
      if (!userLocation) return mechanic;

      const distanceKm = calculateDistance(
        userLocation.latitude,
        userLocation.longitude,
        mechanic.lat,
        mechanic.lng
      );

      return {
        ...mechanic,
        distanceKm,
      };
    });

    return filterMechanicsByDamageType(withDistance, damageType)
      .sort((a, b) => (a.distanceKm ?? 999999) - (b.distanceKm ?? 999999));
  }, [mechanics, userLocation, damageType]);

  const handleSelectMechanic = async (mechanic) => {
    setSelectedMechanic(mechanic);
    setToast('');

    if (!claimId) {
      setToast(`${mechanic.name} selected. Open this page with a claim id to save the assignment.`);
      return;
    }

    setAssigning(true);
    try {
      await assignMechanicToClaim({ claimId, mechanicId: mechanic.id, token });
      setToast(`${mechanic.name} saved to this claim.`);
      if (onRefresh) onRefresh();
      window.setTimeout(() => navigate('/mechanics'), 1200);
    } catch (error) {
      setToast(error.response?.data?.error || error.message || 'Failed to assign mechanic to claim.');
    } finally {
      setAssigning(false);
    }
  };

  const combinedError = mechanicsError || locationError;

  return (
    <div className="space-y-5" id="mechanic-locator-page">
      {toast && (
        <div className="rounded-lg border border-emerald-500/30 bg-emerald-950/30 px-4 py-3 text-sm text-emerald-100 shadow-lg">
          {toast}
        </div>
      )}

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[390px_minmax(0,1fr)]">
        <MechanicSidebar
          mechanics={rankedMechanics}
          loading={loadingMechanics || locationLoading}
          error={combinedError}
          selectedMechanic={selectedMechanic}
          onFocusMechanic={setSelectedMechanic}
          onSelectMechanic={handleSelectMechanic}
          damageType={damageType}
          requiredService={requiredService}
          assigning={assigning}
        />

        <MechanicMap
          userLocation={userLocation}
          mechanics={rankedMechanics}
          selectedMechanic={selectedMechanic}
          loading={loadingMechanics || locationLoading}
          error={combinedError}
          onFocusMechanic={setSelectedMechanic}
          onSelectMechanic={handleSelectMechanic}
        />
      </div>
    </div>
  );
}
