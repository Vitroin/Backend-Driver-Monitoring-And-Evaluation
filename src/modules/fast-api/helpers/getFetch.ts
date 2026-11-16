export async function getFetch(
  baseUrl: string,
  serviceToken: string,
  endpoint: string,
  method: 'GET' | 'POST' | 'PUT' | 'DELETE',
  body?: object,
  timeoutMs = 5000,
) {
  try {
    return await fetch(`${baseUrl}${endpoint}`, {
      method: method,
      headers: {
        'Content-Type': 'application/json',
        'X-Service-Token': serviceToken,
      },
      body: body ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(timeoutMs ?? 5000),
    });
  } catch (error) {
    if (error instanceof Error && error.name === 'TimeoutError') {
      throw new Error(`Request to ${endpoint} timed out after ${timeoutMs ?? 5000} ms`);
    } 
    throw error;
  }
}
