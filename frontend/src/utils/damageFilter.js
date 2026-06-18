export const DAMAGE_SERVICE_MAP = {
  Scratch: 'Scratch Repair',
  Dent: 'Dent Repair',
  'Mirror Damage': 'Mirror Replacement',
  'Bumper Damage': 'Bumper Repair',
  'Headlight Damage': 'Headlight Replacement',
  'Windshield Damage': 'Windshield Repair',
  'Paint Damage': 'Paint Restoration',
};

const SERVICE_ALIASES = {
  'Scratch Repair': ['scratch repair', 'scratch & dent', 'scratch and dent', 'paint restoration', 'body shop'],
  'Dent Repair': ['dent repair', 'scratch & dent', 'scratch and dent', 'dents & paints', 'body shop'],
  'Mirror Replacement': ['mirror replacement', 'electrical repair', 'body shop', 'general repair'],
  'Bumper Repair': ['bumper repair', 'body shop', 'frame straightening', 'paint restoration', 'general repair'],
  'Headlight Replacement': ['headlight replacement', 'electrical repair', 'general repair', 'diagnostics'],
  'Windshield Repair': ['windshield repair', 'glass repair', 'auto glass', 'body shop', 'general repair'],
  'Paint Restoration': ['paint restoration', 'scratch repair', 'scratch & dent', 'dents & paints', 'body shop'],
};

const normalize = (value = '') => String(value).trim().toLowerCase();

export function getRequiredService(damageType) {
  if (!damageType) return '';
  return DAMAGE_SERVICE_MAP[damageType] || damageType;
}

export function mechanicSupportsService(mechanic, requiredService) {
  if (!requiredService) return true;

  const supportedServices = mechanic?.services || mechanic?.specialties || [];
  const normalizedServices = supportedServices.map(normalize);
  const acceptableServices = [requiredService, ...(SERVICE_ALIASES[requiredService] || [])].map(normalize);

  return normalizedServices.some((service) => (
    acceptableServices.some((required) => service.includes(required) || required.includes(service))
  ));
}

export function filterMechanicsByDamageType(mechanics = [], damageType) {
  const requiredService = getRequiredService(damageType);
  return mechanics.filter((mechanic) => mechanicSupportsService(mechanic, requiredService));
}
