import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_SETTINGS } from '../src/constants';
import { applyListChanges, applyNodeDefaults, loadList, mergeSettings, saveList } from '../src/services/storage';
import { newNodeId } from '../src/services/storage-layout';
import { FaviconProvider, LinkNodeFlat, Settings, StoredNode } from '../src/types';

/**
 * An in-memory chrome.storage.sync. Like the real one, it hands out copies and logs each
 * set()/remove() call with the keys it touched.
 */
function installFakeSync(initial: Record<string, unknown> = {}) {
  const items = new Map(Object.entries(structuredClone(initial)));
  const calls: string[] = [];
  const sync = {
    get: vi.fn(async (keys: null) => {
      expect(keys).toBeNull();
      return structuredClone(Object.fromEntries(items));
    }),
    set: vi.fn(async (values: Record<string, unknown>) => {
      calls.push(`set ${Object.keys(values).sort().join(' ')}`);
      for (const [key, value] of Object.entries(structuredClone(values))) items.set(key, value);
    }),
    remove: vi.fn(async (keys: string[]) => {
      calls.push(`remove ${[...keys].sort().join(' ')}`);
      for (const key of keys) items.delete(key);
    }),
  };
  vi.stubGlobal('chrome', {
    storage: { sync },
    runtime: { getURL: (path: string) => `chrome-extension://test${path}` },
  });
  return { items, calls, sync };
}

const legacyList: LinkNodeFlat[] = [
  { name: 'Work' },
  { name: 'Docs', parent: 'Work', url: 'https://docs.example.com/', icon: FaviconProvider.Chrome, border: 1 },
  { name: 'Home' },
];
const idOf = (name: string) => newNodeId(name, new Set());

describe('loadList and saveList', () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
  });

  it('shows a legacy list without writing, then moves it to one item per node on the first edit', async () => {
    const { items, calls } = installFakeSync({ 'links-v1': legacyList, 'settings-v1': { theme: 'dark' } });

    const list = await loadList();
    expect(list.map(node => node.name)).toEqual(['Work', 'Docs', 'Home']);
    expect(list[0].id).toBe(idOf('Work'));
    expect(calls).toEqual([]);

    await saveList([...list, { id: 'new', name: 'New' }]);
    // Everything goes in one all-or-nothing set(), with the layout marker
    const keys = ['links-v2', 'links-v2:new', ...['Work', 'Docs', 'Home'].map(name => `links-v2:${idOf(name)}`)];
    expect(calls).toEqual([`set ${keys.sort().join(' ')}`]);
    expect(items.get(`links-v2:${idOf('Docs')}`)).toEqual({ ...legacyList[1], order: 1 });
    expect(items.get('links-v2')).toBe(true);
    // The legacy key stays as it was, as a backup
    expect(items.get('links-v1')).toEqual(legacyList);
  });

  it('writes only the changed node on later saves, and only removes on a delete', async () => {
    const { calls } = installFakeSync({ 'links-v1': legacyList });
    const list = await loadList();
    await saveList(list);
    calls.length = 0;

    await saveList(list); // nothing changed
    expect(calls).toEqual([]);

    const done = list.map(node => (node.name === 'Home' ? { ...node, taskComplete: true as const } : node));
    await saveList(done);
    expect(calls).toEqual([`set links-v2:${idOf('Home')}`]);

    await saveList(done.filter(node => node.name !== 'Docs'));
    expect(calls).toEqual([`set links-v2:${idOf('Home')}`, `remove links-v2:${idOf('Docs')}`]);
  });

  it('loads the saved nodes back in order, and an emptied list stays empty', async () => {
    installFakeSync({ 'links-v1': legacyList });
    const list = await loadList();
    const reordered = [list[2], list[0], list[1]];
    await saveList(reordered);
    expect(await loadList()).toEqual(reordered);

    await saveList([]);
    // Neither the legacy key nor the starter data comes back
    expect(await loadList()).toEqual([]);
  });

  it('seeds the starter data on first run with ids derived from the names', async () => {
    const { calls } = installFakeSync();
    vi.stubGlobal('fetch', vi.fn(async () => ({ json: async () => [{ name: 'Welcome!' }] })));
    vi.spyOn(console, 'log').mockImplementation(() => {});

    expect(await loadList()).toEqual([{ id: idOf('Welcome!'), name: 'Welcome!' }]);
    expect(calls).toEqual([]);
  });

  it('a rejected save leaves storage alone, so the retry writes everything again', async () => {
    const { sync, calls } = installFakeSync({ 'links-v1': legacyList });
    const list = await loadList();
    sync.set.mockRejectedValueOnce(new Error('Resource::kQuotaBytesPerItem quota exceeded'));

    await expect(saveList(list)).rejects.toThrow(/quota/);
    await saveList(list);
    expect(calls).toHaveLength(1);
    expect(calls[0]).toContain('links-v2 ');
  });
});

describe('applyListChanges', () => {
  let list: StoredNode[];

  beforeEach(async () => {
    vi.unstubAllGlobals();
    installFakeSync({ 'links-v1': legacyList });
    list = await loadList();
  });

  it('applies a legacy list synced in from an older version until the list has moved', async () => {
    const synced = applyListChanges({ 'links-v1': { newValue: [{ name: 'From 2.1.0' }] } });
    expect(synced).toEqual([{ id: idOf('From 2.1.0'), name: 'From 2.1.0' }]);

    await saveList(list);
    expect(applyListChanges({ 'links-v1': { newValue: [{ name: 'Too late' }] } })).toBeUndefined();
  });

  it('applies nodes added, changed, and removed elsewhere', async () => {
    await saveList(list);
    const work = `links-v2:${idOf('Work')}`;
    const docs = `links-v2:${idOf('Docs')}`;

    const next = applyListChanges({
      [work]: { oldValue: { name: 'Work', order: 0 }, newValue: { name: 'Work', taskComplete: true, order: 0 } },
      [docs]: { oldValue: { name: 'Docs', order: 1 } },
      'links-v2:other': { newValue: { name: 'From laptop', order: 7 } },
    });
    expect(next).toEqual([
      { id: idOf('Work'), name: 'Work', taskComplete: true },
      { id: idOf('Home'), name: 'Home' },
      { id: 'other', name: 'From laptop' },
    ]);
  });

  it('switches a tab that has not saved yet over to nodes another tab moved', () => {
    const next = applyListChanges({
      'links-v2': { newValue: true },
      [`links-v2:${idOf('Home')}`]: { newValue: { name: 'Home', order: 0 } },
    });
    expect(next).toEqual([{ id: idOf('Home'), name: 'Home' }]);
  });

  it('ignores changes that are not to the list', () => {
    expect(applyListChanges({ 'settings-v1': { newValue: { theme: 'dark' } } })).toBeUndefined();
  });
});

describe('mergeSettings', () => {
  it('returns defaults when nothing is stored', () => {
    expect(mergeSettings(undefined)).toEqual(DEFAULT_SETTINGS);
  });

  it('keeps stored values and fills in missing keys with defaults', () => {
    const merged = mergeSettings({ theme: 'dark' });
    expect(merged.theme).toBe('dark');
    expect(merged.enableRightClickComplete).toBe(DEFAULT_SETTINGS.enableRightClickComplete);
    expect(merged.defaultFaviconProvider).toBe(DEFAULT_SETTINGS.defaultFaviconProvider);
  });

  it('does not leak a DEFAULT_SETTINGS key into the result', () => {
    // Regression: the old code spread { DEFAULT_SETTINGS, ...data }
    expect(Object.keys(mergeSettings({}))).toEqual(Object.keys(DEFAULT_SETTINGS));
  });

  it('drops keys it does not know, such as the stray DEFAULT_SETTINGS that 2.0.0 stored', () => {
    // The shape 2.0.0 actually saved (see e2e/legacy-data/storage-2.0.0.json)
    const stored = {
      DEFAULT_SETTINGS: { ...DEFAULT_SETTINGS },
      defaultFaviconProvider: 'chrome',
      enableRightClickComplete: false,
      theme: 'dark',
    } as Partial<Settings>;
    expect(mergeSettings(stored)).toEqual({
      defaultFaviconProvider: FaviconProvider.Chrome,
      enableRightClickComplete: false,
      theme: 'dark',
    });
  });
});

describe('applyNodeDefaults', () => {
  it('defaults border and icon for URL nodes', () => {
    const nodes: LinkNodeFlat[] = [{ name: 'a', url: 'https://x.com' }];
    applyNodeDefaults(nodes);
    expect(nodes[0].border).toBe(1);
    expect(nodes[0].icon).toBe(FaviconProvider.Chrome);
  });

  it('strips favicon options and falsy taskComplete from URL-less nodes', () => {
    const nodes = [
      { name: 'a', icon: FaviconProvider.Chrome, border: 1, taskComplete: false },
    ] as unknown as LinkNodeFlat[];
    applyNodeDefaults(nodes);
    expect(nodes[0]).toEqual({ name: 'a' });
  });

  it('preserves explicit values on URL nodes', () => {
    const nodes: LinkNodeFlat[] = [
      { name: 'a', url: 'https://x.com', icon: FaviconProvider.None, border: 0, taskComplete: true },
    ];
    applyNodeDefaults(nodes);
    expect(nodes[0].icon).toBe(FaviconProvider.None);
    expect(nodes[0].border).toBe(0);
    expect(nodes[0].taskComplete).toBe(true);
  });
});
