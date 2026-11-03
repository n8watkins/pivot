// Gemini request settings. Safe to import from client code: it holds no secrets.

/** Stable Gemini model id (https://ai.google.dev/gemini-api/docs/models). */
export const GEMINI_MODEL = "gemini-3.5-flash-lite";

/** API version: thinkingConfig.thinkingLevel is served on v1beta. */
export const GEMINI_API_VERSION = "v1beta";

/** Lowest thinking level the model supports, for the fastest answer. */
export const GEMINI_THINKING_LEVEL = "minimal";

/**
 * How long the server waits for Gemini before it answers with the built-in suggestion.
 * At 3.5 seconds most live free-tier requests timed out and fell back.
 */
export const GEMINI_TIMEOUT_MS = 7000;

/**
 * How long the app waits for /api/recommendation. It must outlast the Gemini timeout plus the
 * route's own work, or the app gives up before the server can send its built-in suggestion.
 */
export const RECOMMENDATION_REQUEST_TIMEOUT_MS = GEMINI_TIMEOUT_MS + 3000;

export const GEMINI_ENDPOINT = `https://generativelanguage.googleapis.com/${GEMINI_API_VERSION}/models/${GEMINI_MODEL}:generateContent`;

export function buildGeminiRequestBody(prompt: string) {
  return {
    contents: [{ parts: [{ text: prompt }] }],
    generationConfig: {
      responseMimeType: "application/json",
      thinkingConfig: { thinkingLevel: GEMINI_THINKING_LEVEL },
    },
  };
}

export function buildGeminiRequest(prompt: string, apiKey: string): RequestInit {
  return {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
    signal: AbortSignal.timeout(GEMINI_TIMEOUT_MS),
    body: JSON.stringify(buildGeminiRequestBody(prompt)),
  };
}
