// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Minimal chrome stub — installed before importing app modules
const storageSet = vi.fn().mockResolvedValue(undefined);
(globalThis as { chrome?: unknown }).chrome = {
  storage: { sync: { set: storageSet } },
  permissions: {
    contains: vi.fn().mockResolvedValue(true),
    request: vi.fn().mockResolvedValue(false),
  },
  runtime: {
    getURL: (path: string) => `chrome-extension://test${path}`,
    getManifest: () => ({ version: '0.0.0-test' }),
  },
};

const { addNode, importData, removeNode, swapNodes, toggleTaskComplete, updateNode, updateSettings } =
  await import('../src/actions');
const { DEFAULT_SETTINGS } = await import('../src/constants');
const { applyTheme } = await import('../src/services/theme');
const { rawList, settings } = await import('../src/state');

const quotaError = new Error('QUOTA_BYTES_PER_ITEM quota exceeded');
const alertSpy = vi.fn();

describe('actions roll back when chrome.storage rejects the save', () => {
  beforeEach(() => {
    vi.stubGlobal('alert', alertSpy);
    vi.spyOn(console, 'error').mockImplementation(() => {});
    storageSet.mockReset().mockResolvedValue(undefined);
    alertSpy.mockReset();
    rawList.val = [
      { name: 'Work' },
      { name: 'Docs', parent: 'Work', url: 'https://example.com/' },
      { name: 'Home' },
    ];
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it.each([
    ['addNode', () => addNode({ name: 'New' })],
    ['updateNode (rename with a child)', () => updateNode('Work', { name: 'Office' })],
    ['removeNode', () => removeNode('Docs')],
    ['swapNodes', () => swapNodes('Work', 'Home')],
    ['toggleTaskComplete', () => toggleTaskComplete('Home')],
  ])('%s restores the previous list and reports the failure', async (_label, action) => {
    const before = rawList.val;
    storageSet.mockRejectedValueOnce(quotaError);

    expect(await action()).toBe(false);
    expect(storageSet).toHaveBeenCalledOnce();
    expect(rawList.val).toBe(before);
    expect(alertSpy).toHaveBeenCalledWith(expect.stringMatching(/Please try again\.$/));
  });

  it('retries a failed save instead of skipping it as unchanged', async () => {
    storageSet.mockRejectedValueOnce(quotaError);
    expect(await addNode({ name: 'Retry me' })).toBe(false);

    expect(await addNode({ name: 'Retry me' })).toBe(true);
    expect(storageSet).toHaveBeenCalledTimes(2);
    expect(rawList.val.map(node => node.name)).toContain('Retry me');
  });

  it('updateSettings restores the previous settings and theme', async () => {
    settings.val = { ...DEFAULT_SETTINGS, theme: 'light' };
    applyTheme('light');
    storageSet.mockRejectedValueOnce(quotaError);

    expect(await updateSettings({ theme: 'dark' })).toBe(false);
    expect(settings.val.theme).toBe('light');
    expect(document.documentElement.dataset.theme).toBe('light');
    expect(alertSpy).toHaveBeenCalledWith('Failed to save settings. Please try again.');
  });

  it('importData keeps the old list and settings when the list save fails', async () => {
    const before = rawList.val;
    settings.val = { ...DEFAULT_SETTINGS };
    storageSet.mockRejectedValueOnce(quotaError);

    const ok = await importData({
      format: 'zero-state',
      version: 1,
      list: [{ name: 'Imported' }],
      settings: { theme: 'dark' },
    });
    expect(ok).toBe(false);
    expect(rawList.val).toBe(before);
    expect(settings.val.theme).toBe(DEFAULT_SETTINGS.theme);
    expect(storageSet).toHaveBeenCalledOnce(); // settings weren't attempted after the list failed
  });
});
