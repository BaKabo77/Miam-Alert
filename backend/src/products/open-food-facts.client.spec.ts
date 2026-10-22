import { OpenFoodFactsClient, OpenFoodFactsUnavailableError } from './open-food-facts.client.js';

const BARCODE = '3017620422003';

const jsonResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

describe('OpenFoodFactsClient', () => {
  const client = new OpenFoodFactsClient();
  const fetchMock = vi.fn<typeof fetch>();

  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('calls the fixed Open Food Facts URL, identified, with a timeout and no redirects', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ status: 1, product: { product_name: 'Nutella' } }));

    await client.fetchProduct(BARCODE);

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBeInstanceOf(URL);
    expect((url as URL).href).toMatch(
      /^https:\/\/world\.openfoodfacts\.org\/api\/v2\/product\/3017620422003\?fields=/,
    );
    expect(init?.headers).toMatchObject({ 'User-Agent': expect.stringContaining('MiamAlert') });
    expect(init?.signal).toBeInstanceOf(AbortSignal);
    expect(init?.redirect).toBe('error');
  });

  it('returns the cleaned product', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ status: 1, product: { product_name: ' Nutella ' } }));

    expect(await client.fetchProduct(BARCODE)).toMatchObject({ barcode: BARCODE, name: 'Nutella' });
  });

  it.each([
    ['status 0 in the body', jsonResponse({ status: 0 })],
    ['an HTTP 404', jsonResponse({ status: 0 }, 404)],
  ])('returns null for an unknown product (%s)', async (_label, response) => {
    fetchMock.mockResolvedValue(response);

    expect(await client.fetchProduct(BARCODE)).toBeNull();
  });

  it.each([
    ['a network error or timeout', () => fetchMock.mockRejectedValue(new DOMException('timeout', 'TimeoutError'))],
    ['a server error', () => fetchMock.mockResolvedValue(jsonResponse({}, 503))],
    ['a body that is not JSON', () => fetchMock.mockResolvedValue(new Response('<html>oops</html>'))],
  ])('reports the service as unavailable on %s', async (_label, setup) => {
    setup();

    await expect(client.fetchProduct(BARCODE)).rejects.toBeInstanceOf(OpenFoodFactsUnavailableError);
  });
});
