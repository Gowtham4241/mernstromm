import { validateVehicleDamageClaim } from './geminiService.js';

export {
  analyzeDamageImage,
  applyClaimValidationRules,
  buildStrictValidationPrompt,
  callGeminiWithRetry,
  handleGeminiFailure,
  parseGeminiJsonResponse,
  validateVehicleDamageClaim,
} from './geminiService.js';

export async function classifyVehicleDamage(description, imageUrl, vehicle = {}) {
  return validateVehicleDamageClaim({ description, imageUrl, vehicle });
}
