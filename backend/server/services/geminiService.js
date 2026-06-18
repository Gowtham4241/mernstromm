import { GoogleGenAI, Type } from '@google/genai';

const CONFIDENCE_THRESHOLD = 80;
const GEMINI_TIMEOUT_MS = 30000;
const RETRY_DELAYS_MS = [2000, 4000, 8000];
const RETRYABLE_STATUS_CODES = new Set([429, 500, 502, 503, 504]);
const PRIMARY_MODEL = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
const FALLBACK_MODEL = process.env.GEMINI_FALLBACK_MODEL || 'gemini-2.0-flash';

let aiClient = null;
let aiClientApiKey = null;

function getGeminiClient() {
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    const error = new Error('GEMINI_API_KEY is not configured.');
    error.statusCode = 503;
    error.code = 'GEMINI_API_KEY_MISSING';
    throw error;
  }

  if (!aiClient || aiClientApiKey !== apiKey) {
    aiClient = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });
    aiClientApiKey = apiKey;
  }

  return aiClient;
}

async function imageUrlToBase64(url) {
  if (!url) return null;

  if (url.startsWith('data:')) {
    const match = url.match(/^data:([^;]+);base64,(.+)$/);
    if (match) {
      return { mimeType: match[1], data: match[2] };
    }
  }

  const response = await fetch(url);
  if (!response.ok) {
    const error = new Error(`Failed to download image. HTTP ${response.status}`);
    error.statusCode = response.status;
    throw error;
  }

  const arrayBuffer = await response.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  const mimeType = response.headers.get('content-type') || 'image/jpeg';

  return {
    data: buffer.toString('base64'),
    mimeType,
  };
}

function normalizeText(value) {
  return String(value || '').trim();
}

function normalizeConfidence(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return 0;
  return numeric <= 1 ? Math.round(numeric * 100) : Math.round(numeric);
}

function normalizeSeverity(value) {
  const severity = normalizeText(value).toLowerCase();
  if (['low', 'medium', 'critical'].includes(severity)) return severity;
  if (severity === 'moderate') return 'medium';
  if (severity === 'high' || severity === 'severe') return 'critical';
  if (severity === 'unknown') return 'Unknown';
  return 'medium';
}

function normalizeApprovalStatus(value) {
  const status = normalizeText(value).toUpperCase();
  if (status === 'APPROVED') return 'APPROVED';
  if (status === 'PENDING_REVIEW') return 'PENDING_REVIEW';
  return 'REJECTED';
}

function normalizeClaimStatus(value) {
  return normalizeApprovalStatus(value);
}

function inferVehicleType(vehicle) {
  const explicitType = normalizeText(vehicle?.vehicleType || vehicle?.type || vehicle?.category || vehicle?.bodyType);
  if (explicitType) return explicitType;

  const combined = `${vehicle?.make || ''} ${vehicle?.model || ''}`.toLowerCase();
  if (/\b(bike|motorcycle|scooter|scooty|activa|dio|splendor|pulsar|apache|duke)\b/.test(combined)) {
    return 'Motorcycle';
  }
  if (/\b(truck|lorry|pickup)\b/.test(combined)) return 'Truck';
  if (/\b(van|minivan)\b/.test(combined)) return 'Van';
  return 'Car';
}

function buildVehiclePayload(vehicle) {
  return {
    vehicleType: inferVehicleType(vehicle),
    brand: normalizeText(vehicle?.make),
    model: normalizeText(vehicle?.model),
    year: vehicle?.year ? String(vehicle.year) : '',
    licensePlate: normalizeText(vehicle?.licensePlate),
  };
}

function getRejectionReason(analysis) {
  if (analysis.aiStatus === 'PENDING_REVIEW') return null;
  if (analysis.reason && analysis.confidence === 0) return analysis.reason;
  if (analysis.rejectionReason && analysis.confidence === 0) return analysis.rejectionReason;
  if (!analysis.vehicleDetected) return 'No vehicle detected';
  if (!analysis.damageDetected) return 'No clear vehicle damage detected';
  if (!analysis.vehicleMatch) return 'Vehicle mismatch';
  if (!analysis.damageMatch) return 'Damage description mismatch';
  if (analysis.confidence < CONFIDENCE_THRESHOLD) return 'Low confidence analysis';
  if (analysis.claimStatus !== 'APPROVED') return analysis.reason || analysis.rejectionReason || 'Claim validation rejected';
  return null;
}

function getFraudRisk(analysis) {
  let score = 0;
  const fraudSignals = Array.isArray(analysis.fraudSignals) ? analysis.fraudSignals : [];

  if (analysis.vehicleDetected === false) score += 45;
  if (analysis.damageDetected === false) score += 30;
  if (analysis.vehicleMatch === false) score += 50;
  if (analysis.damageMatch === false) score += 50;
  if (analysis.confidence < CONFIDENCE_THRESHOLD) score += 20;
  if (analysis.imageQuality === 'BLURRY') score += 15;
  if (analysis.nonVehicleImage) score += 45;
  if (analysis.suspiciousImage) score += 50;
  if (fraudSignals.includes('non-vehicle image')) score += 45;
  if (fraudSignals.includes('blurry image')) score += 15;
  if (fraudSignals.includes('vehicle mismatch')) score += 30;
  if (fraudSignals.includes('damage mismatch')) score += 25;
  if (fraudSignals.includes('low confidence')) score += 20;
  if (analysis.aiStatus === 'PENDING_REVIEW') score = Math.max(score, 25);

  if (analysis.vehicleMatch === false || analysis.damageMatch === false || analysis.suspiciousImage) return 'HIGH';
  if (score >= 50) return 'HIGH';
  if (score >= 25) return 'MEDIUM';
  return 'LOW';
}

function getEstimatedCost(costEstimation) {
  if (!costEstimation || typeof costEstimation !== 'object') return null;
  return costEstimation.totalEstimatedRange || costEstimation.total || costEstimation.estimatedCost || null;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function parseErrorBody(error) {
  const candidates = [
    error?.message,
    error?.response?.data,
    error?.cause?.message,
  ];

  for (const candidate of candidates) {
    if (!candidate) continue;
    if (typeof candidate === 'object') return candidate;
    if (typeof candidate === 'string') {
      const match = candidate.match(/\{[\s\S]*\}/);
      if (!match) continue;
      try {
        return JSON.parse(match[0]);
      } catch {
        // Keep checking other candidates.
      }
    }
  }

  return null;
}

function getGeminiErrorDetails(error) {
  const body = parseErrorBody(error);
  const nestedError = body?.error || body;
  const statusCode = Number(
    error?.statusCode ||
    error?.status ||
    error?.code ||
    error?.response?.status ||
    nestedError?.code
  );

  return {
    statusCode: Number.isFinite(statusCode) ? statusCode : null,
    status: nestedError?.status || error?.status || error?.code || 'UNKNOWN',
    message: nestedError?.message || error?.message || 'Gemini request failed.',
    raw: body || null,
  };
}

function isRetryableGeminiError(error) {
  const details = getGeminiErrorDetails(error);
  return RETRYABLE_STATUS_CODES.has(details.statusCode);
}

function createTimeoutError(model, timeoutMs) {
  const error = new Error(`Gemini request timed out after ${timeoutMs}ms for model ${model}.`);
  error.statusCode = 504;
  error.code = 'GEMINI_TIMEOUT';
  return error;
}

async function runWithTimeout(operation, timeoutMs, model) {
  let timeoutId;

  const timeoutPromise = new Promise((_, reject) => {
    timeoutId = setTimeout(() => reject(createTimeoutError(model, timeoutMs)), timeoutMs);
  });

  try {
    return await Promise.race([operation(), timeoutPromise]);
  } finally {
    clearTimeout(timeoutId);
  }
}

function logGeminiError({ error, model, attempt, willRetry }) {
  const details = getGeminiErrorDetails(error);
  console.error('[Gemini Damage Analysis Error]', {
    model,
    attempt,
    willRetry,
    statusCode: details.statusCode,
    status: details.status,
    message: details.message,
    raw: details.raw,
  });
}

export async function callGeminiWithRetry({ client, request, models = [PRIMARY_MODEL, FALLBACK_MODEL] }) {
  let lastError = null;
  const uniqueModels = [...new Set(models.filter(Boolean))];

  for (const model of uniqueModels) {
    const maxAttempts = RETRY_DELAYS_MS.length + 1;

    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      try {
        return await runWithTimeout(
          () => client.models.generateContent({ ...request, model }),
          GEMINI_TIMEOUT_MS,
          model
        );
      } catch (error) {
        lastError = error;
        const retryable = isRetryableGeminiError(error);
        const hasMoreAttempts = attempt < maxAttempts;
        const willRetry = retryable && hasMoreAttempts;

        logGeminiError({ error, model, attempt, willRetry });

        if (!retryable) break;
        if (hasMoreAttempts) {
          await sleep(RETRY_DELAYS_MS[attempt - 1]);
        }
      }
    }
  }

  throw lastError || new Error('Gemini request failed before a response was returned.');
}

export function parseGeminiJsonResponse(responseText) {
  if (!responseText || typeof responseText !== 'string') {
    throw new Error('Gemini returned an empty validation response.');
  }

  const trimmed = responseText.trim();
  const withoutCodeFence = trimmed
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim();

  try {
    return JSON.parse(withoutCodeFence);
  } catch {
    const match = withoutCodeFence.match(/\{[\s\S]*\}/);
    if (!match) {
      throw new Error('Gemini response did not contain valid JSON.');
    }
    return JSON.parse(match[0]);
  }
}

export function handleGeminiFailure(error) {
  const details = getGeminiErrorDetails(error);

  console.error('[Gemini Damage Analysis Fallback]', {
    statusCode: details.statusCode,
    status: details.status,
    message: details.message,
    raw: details.raw,
  });

  return {
    aiStatus: 'PENDING_REVIEW',
    approvalStatus: 'PENDING_REVIEW',
    claimStatus: 'PENDING_REVIEW',
    vehicleDetected: null,
    vehicleType: '',
    brandGuess: '',
    damageDetected: null,
    vehicleMatch: null,
    damageMatch: null,
    damageType: 'Pending Manual Review',
    damageLocation: 'Pending Manual Review',
    severity: 'Unknown',
    confidence: 0,
    estimatedCost: null,
    descriptionMatches: null,
    vehicleMatches: null,
    imageQuality: 'UNKNOWN',
    nonVehicleImage: false,
    suspiciousImage: false,
    rejectionReason: null,
    reason: 'Gemini AI analysis was unavailable after retry attempts. Claim requires manual review.',
    userMessage: 'AI analysis is temporarily unavailable. Your claim has been submitted and will be reviewed manually.',
    fraudSignals: ['low confidence'],
    classifications: ['Pending Manual Review'],
    partsNeeded: [],
    estimatedRepairTime: 'Pending manual review',
    urgencyReasoning: 'Gemini AI analysis was unavailable after retry attempts. Claim requires manual review.',
    costEstimation: {
      partsCostRange: 'Pending manual review',
      laborCostRange: 'Pending manual review',
      totalEstimatedRange: null,
      confidenceScore: 0,
    },
    geminiError: {
      statusCode: details.statusCode,
      status: details.status,
      message: details.message,
    },
  };
}

export function applyClaimValidationRules(rawAnalysis) {
  if (rawAnalysis?.aiStatus === 'PENDING_REVIEW') {
    const pending = {
      ...rawAnalysis,
      fraudRisk: getFraudRisk({
        ...rawAnalysis,
        vehicleDetected: null,
        damageDetected: null,
        vehicleMatch: null,
        damageMatch: null,
        confidence: 0,
        imageQuality: rawAnalysis.imageQuality || 'UNKNOWN',
        fraudSignals: Array.isArray(rawAnalysis.fraudSignals) ? rawAnalysis.fraudSignals : ['low confidence'],
      }),
      validationRules: {
        confidenceThreshold: CONFIDENCE_THRESHOLD,
        vehicleDetected: null,
        damageDetected: null,
        vehicleMatch: null,
        damageMatch: null,
        vehicleMatches: null,
        descriptionMatches: null,
        confidencePassed: false,
        pendingManualReview: true,
      },
    };

    return pending;
  }

  const vehicleMatch = rawAnalysis?.vehicleMatch ?? rawAnalysis?.vehicleMatches;
  const damageMatch = rawAnalysis?.damageMatch ?? rawAnalysis?.descriptionMatches;
  const claimStatus = rawAnalysis?.claimStatus ?? rawAnalysis?.approvalStatus;
  const reason = rawAnalysis?.reason ?? rawAnalysis?.rejectionReason;

  const analysis = {
    aiStatus: 'COMPLETED',
    vehicleDetected: Boolean(rawAnalysis?.vehicleDetected),
    vehicleType: normalizeText(rawAnalysis?.vehicleType),
    brandGuess: normalizeText(rawAnalysis?.brandGuess),
    damageDetected: Boolean(rawAnalysis?.damageDetected),
    damageType: normalizeText(rawAnalysis?.damageType),
    damageLocation: normalizeText(rawAnalysis?.damageLocation),
    severity: normalizeSeverity(rawAnalysis?.severity),
    vehicleMatch: Boolean(vehicleMatch),
    damageMatch: Boolean(damageMatch),
    descriptionMatches: Boolean(damageMatch),
    vehicleMatches: Boolean(vehicleMatch),
    confidence: normalizeConfidence(rawAnalysis?.confidence),
    estimatedCost: getEstimatedCost(rawAnalysis?.costEstimation),
    claimStatus: normalizeClaimStatus(claimStatus),
    approvalStatus: normalizeApprovalStatus(claimStatus),
    reason: reason ? normalizeText(reason) : null,
    rejectionReason: reason ? normalizeText(reason) : null,
    imageQuality: normalizeText(rawAnalysis?.imageQuality || 'CLEAR').toUpperCase(),
    nonVehicleImage: Boolean(rawAnalysis?.nonVehicleImage),
    suspiciousImage: Boolean(rawAnalysis?.suspiciousImage),
    fraudSignals: Array.isArray(rawAnalysis?.fraudSignals)
      ? rawAnalysis.fraudSignals.map((signal) => normalizeText(signal).toLowerCase()).filter(Boolean)
      : [],
    classifications: Array.isArray(rawAnalysis?.classifications) ? rawAnalysis.classifications.map(normalizeText).filter(Boolean) : [],
    partsNeeded: Array.isArray(rawAnalysis?.partsNeeded) ? rawAnalysis.partsNeeded.map(normalizeText).filter(Boolean) : [],
    estimatedRepairTime: normalizeText(rawAnalysis?.estimatedRepairTime || 'Inspection required'),
    urgencyReasoning: normalizeText(rawAnalysis?.urgencyReasoning || 'Validation completed by strict claim checks.'),
    costEstimation: rawAnalysis?.costEstimation && typeof rawAnalysis.costEstimation === 'object'
      ? rawAnalysis.costEstimation
      : {},
  };

  const backendRejectionReason = getRejectionReason(analysis);
  analysis.claimStatus = backendRejectionReason ? 'REJECTED' : 'APPROVED';
  analysis.approvalStatus = analysis.claimStatus;
  analysis.reason = backendRejectionReason || 'Vehicle, damage description, and uploaded image are consistent.';
  analysis.rejectionReason = backendRejectionReason;
  analysis.fraudRisk = getFraudRisk(analysis);
  analysis.validationRules = {
    confidenceThreshold: CONFIDENCE_THRESHOLD,
    vehicleDetected: analysis.vehicleDetected,
    damageDetected: analysis.damageDetected,
    vehicleMatch: analysis.vehicleMatch,
    damageMatch: analysis.damageMatch,
    vehicleMatches: analysis.vehicleMatches,
    descriptionMatches: analysis.descriptionMatches,
    confidencePassed: analysis.confidence >= CONFIDENCE_THRESHOLD,
  };

  if (analysis.classifications.length === 0 && analysis.damageType) {
    analysis.classifications = [analysis.damageType];
  }

  analysis.costEstimation = {
    partsCostRange: normalizeText(analysis.costEstimation.partsCostRange || 'Pending mechanic inspection'),
    laborCostRange: normalizeText(analysis.costEstimation.laborCostRange || 'Pending mechanic inspection'),
    totalEstimatedRange: normalizeText(analysis.costEstimation.totalEstimatedRange || 'Pending mechanic inspection'),
    confidenceScore: analysis.confidence / 100,
  };
  analysis.estimatedCost = getEstimatedCost(analysis.costEstimation);

  return analysis;
}

function buildStrictValidationPrompt({ description, vehicle }) {
  const userVehicle = buildVehiclePayload(vehicle);

  return `You are AutoAid's strict vehicle insurance claim validator.

Return JSON only. Do not return markdown, prose, comments, or explanations outside JSON.

Validate all three claim sources before approval:
1. Registered vehicle details supplied by the user.
2. User damage description.
3. Uploaded image.

Validation steps:
1. Detect whether a real vehicle is visible in the image.
2. Detect the visible vehicle type and, when visually possible, brand/model evidence.
3. Compare detected vehicle evidence with the registered make, model, and type. Set vehicleMatch true only when the image is consistent with the registered vehicle.
4. Detect visible vehicle damage from only these values: Scratch, Dent, Bumper Damage, Mirror Damage, Headlight Damage, Windshield Damage, Paint Damage.
5. Compare visible damage type/location with the user's damage description. Set damageMatch true only when the image damage is consistent with the description.
6. Detect suspicious images, including non-vehicle images, unrelated vehicles, screenshots, stock/catalog images, heavily edited images, blurry images, or images where the claimed damage is not visible.
7. Reject if confidence is below ${CONFIDENCE_THRESHOLD}.

User selected vehicle:
${JSON.stringify(userVehicle)}

User damage description:
"${description}"

Approval rules:
- Do not approve claims solely because damage is visible.
- claimStatus must be "APPROVED" only when vehicleMatch is true AND damageMatch is true AND vehicleDetected is true AND damageDetected is true AND confidence is at least ${CONFIDENCE_THRESHOLD}.
- If no vehicle is visible, claimStatus must be "REJECTED" and reason must be "No vehicle detected".
- If no clear damage is visible, claimStatus must be "REJECTED" and reason must be "No clear vehicle damage detected".
- If detected vehicle does not match registered make/model/type, claimStatus must be "REJECTED", reason must be "Vehicle mismatch", and fraudRisk must be "HIGH".
- If detected damage does not match the user description, claimStatus must be "REJECTED", reason must be "Damage description mismatch", and fraudRisk must be "HIGH".
- If image appears suspicious or unrelated, claimStatus must be "REJECTED", reason must describe the suspicious image, and fraudRisk must be "HIGH".
- If confidence is below ${CONFIDENCE_THRESHOLD}, claimStatus must be "REJECTED" and reason must be "Low confidence analysis".
- confidence must be a whole number from 0 to 100 representing the overall certainty across vehicle detection, damage detection, vehicle match, and description match.
- imageQuality must be "CLEAR", "BLURRY", or "UNKNOWN".
- fraudSignals must include any matching values from: "non-vehicle image", "blurry image", "vehicle mismatch", "damage mismatch", "low confidence".

Required JSON shape:
{
  "vehicleDetected": true,
  "vehicleType": "Car",
  "brandGuess": "Honda",
  "damageDetected": true,
  "damageType": "Dent",
  "damageLocation": "Front Bumper",
  "severity": "medium",
  "vehicleMatch": true,
  "damageMatch": true,
  "descriptionMatches": true,
  "vehicleMatches": true,
  "confidence": 92,
  "fraudRisk": "LOW",
  "imageQuality": "CLEAR",
  "nonVehicleImage": false,
  "suspiciousImage": false,
  "claimStatus": "APPROVED",
  "approvalStatus": "APPROVED",
  "reason": "Vehicle, damage description, and uploaded image are consistent.",
  "rejectionReason": null,
  "fraudSignals": [],
  "classifications": ["Dent"],
  "partsNeeded": ["Front bumper repair materials"],
  "estimatedRepairTime": "2 - 4 hours",
  "urgencyReasoning": "Short JSON string only.",
  "costEstimation": {
    "partsCostRange": "$100 - $250",
    "laborCostRange": "$150 - $300",
    "totalEstimatedRange": "$250 - $550"
  }
}`;
}

function buildGeminiRequest({ description, imageData, vehicle }) {
  return {
    contents: {
      parts: [
        {
          inlineData: {
            mimeType: imageData.mimeType,
            data: imageData.data,
          },
        },
        {
          text: buildStrictValidationPrompt({ description, vehicle }),
        },
      ],
    },
    config: {
      systemInstruction: 'You are AutoAid claim validation. Output JSON only. Never output paragraphs.',
      responseMimeType: 'application/json',
      responseSchema: {
        type: Type.OBJECT,
        required: [
          'vehicleDetected',
          'vehicleType',
          'damageDetected',
          'vehicleMatch',
          'damageMatch',
          'confidence',
          'fraudRisk',
          'claimStatus',
          'reason',
          'approvalStatus',
          'rejectionReason',
        ],
        properties: {
          vehicleDetected: { type: Type.BOOLEAN },
          vehicleType: { type: Type.STRING },
          brandGuess: { type: Type.STRING },
          damageDetected: { type: Type.BOOLEAN },
          damageType: { type: Type.STRING },
          damageLocation: { type: Type.STRING },
          severity: { type: Type.STRING },
          vehicleMatch: { type: Type.BOOLEAN },
          damageMatch: { type: Type.BOOLEAN },
          descriptionMatches: { type: Type.BOOLEAN },
          vehicleMatches: { type: Type.BOOLEAN },
          confidence: { type: Type.NUMBER },
          fraudRisk: { type: Type.STRING },
          imageQuality: { type: Type.STRING },
          nonVehicleImage: { type: Type.BOOLEAN },
          suspiciousImage: { type: Type.BOOLEAN },
          claimStatus: { type: Type.STRING },
          approvalStatus: { type: Type.STRING },
          reason: { type: Type.STRING },
          rejectionReason: { type: Type.STRING, nullable: true },
          fraudSignals: { type: Type.ARRAY, items: { type: Type.STRING } },
          classifications: { type: Type.ARRAY, items: { type: Type.STRING } },
          partsNeeded: { type: Type.ARRAY, items: { type: Type.STRING } },
          estimatedRepairTime: { type: Type.STRING },
          urgencyReasoning: { type: Type.STRING },
          costEstimation: {
            type: Type.OBJECT,
            properties: {
              partsCostRange: { type: Type.STRING },
              laborCostRange: { type: Type.STRING },
              totalEstimatedRange: { type: Type.STRING },
            },
          },
        },
      },
    },
  };
}

export async function analyzeDamageImage({ description, imageUrl, vehicle }) {
  try {
    const client = getGeminiClient();

    if (!imageUrl) {
      const error = new Error('No image provided for Gemini analysis.');
      error.statusCode = 400;
      throw error;
    }

    const imageData = await imageUrlToBase64(imageUrl);
    if (!imageData) {
      const error = new Error('Unable to read uploaded image.');
      error.statusCode = 422;
      throw error;
    }

    const response = await callGeminiWithRetry({
      client,
      request: buildGeminiRequest({ description, imageData, vehicle }),
      models: [PRIMARY_MODEL, FALLBACK_MODEL],
    });

    const parsed = parseGeminiJsonResponse(response.text);
    return applyClaimValidationRules(parsed);
  } catch (error) {
    if (isRetryableGeminiError(error) || getGeminiErrorDetails(error).statusCode === 503 || error.code === 'GEMINI_TIMEOUT' || error.code === 'GEMINI_API_KEY_MISSING') {
      return applyClaimValidationRules(handleGeminiFailure(error));
    }

    throw error;
  }
}

export async function validateVehicleDamageClaim({ description, imageUrl, vehicle }) {
  return analyzeDamageImage({ description, imageUrl, vehicle });
}

export { buildStrictValidationPrompt };
