// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// The list as saved one item per node, which loadList() reads in each test
const storedItems = {
  'links-v2': true,
  'links-v2:work': { name: 'Work', order: 0 },
  'links-v2:docs': { name: 'Docs', parent: 'Work', url: 'https://example.com/', order: 1 },
  'links-v2:home': { name: 'Home', order: 2 },
};

// Minimal chrome stub — installed before importing app modules
const storageGet = vi.fn(async () => structuredClone(storedItems));
const storageSet = vi.fn().mockResolvedValue(undefined);
const storageRemove = vi.fn().mockResolvedValue(undefined);
(globalThis as { chrome?: unknown }).chrome = {
  storage: { sync: { get: storageGet, set: storageSet, remove: storageRemove } },
  permissions: {
    contains: vi.fn().mockResolvedValue(true),
    request: vi.fn().mockResolvedValue(false),
  },
  runtime: {
    getURL: (path: string) => `chrome-extension://test${path}`,
    getManifest: () => ({ version: '0.0.0-test' }),
  },
};

const { addNode, exportData, importData, removeNode, swapNodes, toggleTaskComplete, updateNode, updateSettings } =
  await import('../src/actions');
const { DEFAULT_SETTINGS } = await import('../src/constants');
const { loadList } = await import('../src/services/storage');
const { applyTheme } = await import('../src/services/theme');
const { rawList, settings } = await import('../src/state');

const quotaError = new Error('QUOTA_BYTES_PER_ITEM quota exceeded');
const alertSpy = vi.fn();

beforeEach(async () => {
  storageSet.mockReset().mockResolvedValue(undefined);
  storageRemove.mockReset().mockResolvedValue(undefined);
  rawList.val = await loadList();
});

describe('storage ids', () => {
  it('updateNode keeps the node\'s id, so a rename rewrites its item in place', async () => {
    expect(await updateNode('Work', { name: 'Office' })).toBe(true);
    expect(rawList.val.find(node => node.name === 'Office')?.id).toBe('work');
    expect(Object.keys(storageSet.mock.calls[0][0]).sort()).toEqual(['links-v2:docs', 'links-v2:work']);
    expect(storageRemove).not.toHaveBeenCalled();
  });

  it('exportData leaves them out of the backup', () => {
    expect(JSON.parse(exportData()).list).toEqual([
      { name: 'Work' },
      { name: 'Docs', parent: 'Work', url: 'https://example.com/' },
      { name: 'Home' },
    ]);
  });
});

describe('actions roll back when chrome.storage rejects the save', () => {
  beforeEach(() => {
    vi.stubGlobal('alert', alertSpy);
    vi.spyOn(console, 'error').mockImplementation(() => {});
    alertSpy.mockReset();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  // A delete only removes its node's item; everything else writes with set()
  it.each([
    ['addNode', () => addNode({ name: 'New' }), storageSet],
    ['updateNode (rename with a child)', () => updateNode('Work', { name: 'Office' }), storageSet],
    ['removeNode', () => removeNode('Docs'), storageRemove],
    ['swapNodes', () => swapNodes('Work', 'Home'), storageSet],
    ['toggleTaskComplete', () => toggleTaskComplete('Home'), storageSet],
  ])('%s restores the previous list and reports the failure', async (_label, action, write) => {
    const before = rawList.val;
    write.mockRejectedValueOnce(quotaError);

    expect(await action()).toBe(false);
    expect(write).toHaveBeenCalledOnce();
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
