import { Logger } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import { sendHeartbeat } from '../common/heartbeat.js';
import type { EnvironmentVariables } from '../config/env.validation.js';
import { AlertsScheduler } from './alerts.scheduler.js';
import type { AlertsService } from './alerts.service.js';

vi.mock('../common/heartbeat.js', () => ({ sendHeartbeat: vi.fn() }));

const URL = 'https://hc-ping.com/daily-alerts';

describe('AlertsScheduler', () => {
  const generateDailyAlerts = vi.fn();
  const scheduler = new AlertsScheduler(
    { generateDailyAlerts } as unknown as AlertsService,
    { get: () => URL } as unknown as ConfigService<EnvironmentVariables, true>,
  );

  beforeEach(() => {
    vi.mocked(sendHeartbeat).mockReset();
    generateDailyAlerts.mockReset();
  });

  it('reports a success to the monitoring service', async () => {
    generateDailyAlerts.mockResolvedValue(3);
    await scheduler.generateDailyAlerts();
    expect(sendHeartbeat).toHaveBeenCalledWith(URL, 'success');
  });

  it('reports a failure without crashing the application', async () => {
    generateDailyAlerts.mockRejectedValue(new Error('database unreachable'));
    vi.spyOn(Logger.prototype, 'error').mockImplementation(() => {});

    await expect(scheduler.generateDailyAlerts()).resolves.toBeUndefined();
    expect(sendHeartbeat).toHaveBeenCalledWith(URL, 'fail');
  });
});
