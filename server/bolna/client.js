export class BolnaError extends Error {
  constructor(status, detail) { super(detail); this.status = status; this.name = 'BolnaError'; }
}

export function createBolnaClient({ apiKey = process.env.BOLNA_API_KEY, fetchImpl = fetch } = {}) {
  return async (path, options = {}) => {
    if (!apiKey?.trim()) throw new BolnaError(503, 'Add BOLNA_API_KEY to .env and restart the API.');
    let response;
    try {
      response = await fetchImpl(`https://api.bolna.ai${path}`, { ...options,
        headers: { Authorization: `Bearer ${apiKey.trim()}`, 'Content-Type': 'application/json' },
        signal: AbortSignal.timeout(20000),
      });
    } catch { throw new BolnaError(502, 'Bolna could not be reached. Check your connection and try again.'); }
    let data;
    try { data = await response.json(); } catch { throw new BolnaError(502, 'Bolna returned an unreadable response.'); }
    if (!response.ok) {
      const messages = { 401: 'Bolna rejected the API key.', 402: 'Bolna requires available account credits.', 403: 'This Bolna account is not enabled for this operation.', 404: 'The Bolna agent or session was not found.', 429: 'Bolna capacity or rate limit reached. Try again shortly.' };
      throw new BolnaError(response.status >= 500 ? 502 : response.status, messages[response.status] || 'Bolna rejected this configuration or request. Check the agent and browser-call access.');
    }
    return data;
  };
}
