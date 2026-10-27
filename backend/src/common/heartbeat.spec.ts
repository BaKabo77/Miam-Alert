import { sendHeartbeat } from './heartbeat.js';

describe('sendHeartbeat', () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    fetchMock.mockReset().mockResolvedValue(new Response(null, { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('does nothing when no monitoring URL is configured', async () => {
    await sendHeartbeat(undefined, 'success');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('pings the URL on success and URL/fail on failure', async () => {
    await sendHeartbeat('https://hc-ping.com/abc', 'success');
    await sendHeartbeat('https://hc-ping.com/abc', 'fail');

    expect(fetchMock.mock.calls.map(([url]) => url)).toEqual(['https://hc-ping.com/abc', 'https://hc-ping.com/abc/fail']);
    expect(fetchMock.mock.calls[0][1]).toMatchObject({ method: 'POST', redirect: 'error' });
  });

  it('never throws, even when the monitoring service is unreachable', async () => {
    fetchMock.mockRejectedValue(new TypeError('fetch failed'));
    await expect(sendHeartbeat('https://hc-ping.com/abc', 'success')).resolves.toBeUndefined();
  });
});
