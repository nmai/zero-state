import { describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS } from '../src/constants';
import { buildExport, EXPORT_FORMAT, EXPORT_VERSION, parseExport } from '../src/services/export';
import { FaviconProvider, LinkNodeFlat } from '../src/types';

const list: LinkNodeFlat[] = [
  { name: 'Work' },
  {
    name: 'Docs',
    parent: 'Work',
    url: 'https://docs.example.com',
    icon: FaviconProvider.DuckDuckGo,
    border: 0,
    taskComplete: true,
  },
];

const wrap = (payload: object) => ({ format: EXPORT_FORMAT, version: EXPORT_VERSION, ...payload });

describe('buildExport', () => {
  it('wraps the list and settings with format, version, and provenance', () => {
    const exported = buildExport(list, DEFAULT_SETTINGS, '2.0.0');
    expect(exported).toMatchObject({
      format: EXPORT_FORMAT,
      version: EXPORT_VERSION,
      appVersion: '2.0.0',
      list,
      settings: DEFAULT_SETTINGS,
    });
    expect(new Date(exported.exportedAt).toISOString()).toBe(exported.exportedAt);
  });
});

describe('parseExport', () => {
  it('round-trips an export through JSON text', () => {
    const text = JSON.stringify(buildExport(list, DEFAULT_SETTINGS, '2.0.0'));
    expect(parseExport(text)).toEqual({ list, settings: DEFAULT_SETTINGS });
  });

  it('accepts an already-parsed object', () => {
    expect(parseExport(buildExport(list, DEFAULT_SETTINGS, '2.0.0'))).toEqual({ list, settings: DEFAULT_SETTINGS });
  });

  it('rejects text that is not JSON', () => {
    expect(() => parseExport('{nope')).toThrow('Not valid JSON');
  });

  it('rejects payloads without the format marker', () => {
    expect(() => parseExport({ version: EXPORT_VERSION, list })).toThrow(/Not a zero-state export/);
    expect(() => parseExport([])).toThrow(/Not a zero-state export/);
    expect(() => parseExport(null)).toThrow(/Not a zero-state export/);
  });

  it('rejects versions it does not know', () => {
    expect(() => parseExport(wrap({ version: 2, list }))).toThrow(/Unsupported export version 2/);
  });

  it('requires the list to be an array', () => {
    expect(() => parseExport(wrap({ list: {} }))).toThrow('"list" must be an array');
  });

  it('keeps only known node properties and drops empty optional values', () => {
    const parsed = parseExport(wrap({
      list: [{ name: 'a', url: '', parent: '', taskComplete: false, children: [], extra: 1 }],
    }));
    expect(parsed.list).toEqual([{ name: 'a' }]);
  });

  it.each([
    ['a node that is not an object', 'oops', /list\[0\] is not an object/],
    ['a missing name', {}, /needs a non-empty "name"/],
    ['a blank name', { name: '  ' }, /needs a non-empty "name"/],
    ['a non-string parent', { name: 'a', parent: 1 }, /parent must be a string/],
    ['a URL without a scheme', { name: 'a', url: 'example.com' }, /url must start with http/],
    ['a non-boolean taskComplete', { name: 'a', taskComplete: 'yes' }, /taskComplete must be a boolean/],
    ['an unknown favicon provider', { name: 'a', icon: 'bing' }, /icon must be one of/],
    ['a border outside 0 or 1', { name: 'a', border: 2 }, /border must be 0 or 1/],
  ])('rejects %s', (_label, node, message) => {
    expect(() => parseExport(wrap({ list: [node] }))).toThrow(message);
  });

  it('rejects duplicate names', () => {
    expect(() => parseExport(wrap({ list: [{ name: 'a' }, { name: 'a' }] }))).toThrow(/Duplicate name "a"/);
  });

  it('rejects parent loops, including self-parenting', () => {
    expect(() => parseExport(wrap({ list: [{ name: 'a', parent: 'b' }, { name: 'b', parent: 'a' }] })))
      .toThrow(/inside a parent loop/);
    expect(() => parseExport(wrap({ list: [{ name: 'a', parent: 'a' }] }))).toThrow(/inside a parent loop/);
  });

  it('tolerates a parent that does not exist (the tree attaches it to the root)', () => {
    expect(parseExport(wrap({ list: [{ name: 'a', parent: 'ghost' }] })).list).toEqual([{ name: 'a', parent: 'ghost' }]);
  });

  it('treats settings as optional and keeps only known keys', () => {
    expect(parseExport(wrap({ list: [] })).settings).toBeUndefined();
    expect(parseExport(wrap({ list: [], settings: { theme: 'dark', bogus: true } })).settings).toEqual({ theme: 'dark' });
  });

  it.each([
    ['settings that are not an object', 'dark', /"settings" must be an object/],
    ['an unknown theme', { theme: 'blue' }, /theme must be one of/],
    ['a non-boolean right-click flag', { enableRightClickComplete: 'yes' }, /enableRightClickComplete must be a boolean/],
    ['an unknown default provider', { defaultFaviconProvider: 'bing' }, /defaultFaviconProvider must be one of/],
  ])('rejects %s', (_label, settings, message) => {
    expect(() => parseExport(wrap({ list: [], settings }))).toThrow(message);
  });
});
