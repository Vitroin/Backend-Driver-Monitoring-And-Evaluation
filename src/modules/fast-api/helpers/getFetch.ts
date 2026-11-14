export async function getFetch(
  baseUrl: string,
  serviceToken: string,
  endpoint: string,
  method: 'GET' | 'POST' | 'PUT' | 'DELETE',
  body?: object,
) {
  const response = await fetch(`${baseUrl}${endpoint}`, {
    method: method,
    headers: {
      'Content-Type': 'application/json',
      'X-Service-Token': serviceToken,
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  return response;
}
