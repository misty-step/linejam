export async function readDeploymentId(page, baseUrl) {
  const response = await page.request.get(`${baseUrl}/api/deployment`, {
    failOnStatusCode: true,
    headers: { Accept: 'application/json' },
  });
  const payload = await response.json();
  const id = payload?.deployment?.id;
  if (Object.prototype.toString.call(id) !== '[object String]' || !id.trim()) {
    throw new Error('Production returned no deployment receipt');
  }
  return id;
}
