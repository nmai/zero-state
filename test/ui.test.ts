// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';

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

const { TreeView } = await import('../src/components/tree-view');
const { editMode, rawList } = await import('../src/state');
const { add } = await import('../src/van');

// VanJS batches DOM updates asynchronously
const flush = () => new Promise(resolve => setTimeout(resolve, 20));

describe('TreeView', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    editMode.val = false;
    rawList.val = [
      { name: 'Work' },
      { name: 'Docs', parent: 'Work', url: 'https://docs.example.com' },
      { name: 'Personal' },
    ];
    storageSet.mockClear();
  });

  function mount() {
    const container = document.createElement('div');
    add(container, () => TreeView());
    document.body.appendChild(container);
    return container;
  }

  it('renders one list group per top-level node with nested children', async () => {
    const container = mount();
    await flush();

    const groups = container.querySelectorAll('#lists-container > ul.tree-list.col');
    expect(groups).toHaveLength(2);
    expect(container.textContent).toContain('Work');
    expect(container.textContent).toContain('Docs');
    const link = container.querySelector('a[href="https://docs.example.com"]');
    expect(link).not.toBeNull();
  });

  it('re-renders when the list changes', async () => {
    const container = mount();
    await flush();

    rawList.val = [...rawList.val, { name: 'New item' }];
    await flush();

    expect(container.textContent).toContain('New item');
  });

  it('shows move/delete controls only in edit mode', async () => {
    const container = mount();
    await flush();
    expect(container.querySelector('.move-controls')).toBeNull();

    editMode.val = true;
    await flush();
    expect(container.querySelector('.move-controls')).not.toBeNull();
  });

  it('right-click toggles completion, persists, and strikes through', async () => {
    const container = mount();
    await flush();

    const workItem = [...container.querySelectorAll('li')]
      .find(el => el.textContent?.includes('Work'))!;
    workItem.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true }));
    await flush();

    expect(rawList.val.find(n => n.name === 'Work')?.taskComplete).toBe(true);
    expect(storageSet).toHaveBeenCalledOnce();
    expect(container.querySelector('.text-linethrough')?.textContent).toContain('Work');
  });
});
