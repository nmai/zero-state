import { FaviconProvider, LinkNodeFlat, Settings } from '../types';
import { isValidUrl } from './validation';

/** Identifies a zero-state export regardless of its version. */
export const EXPORT_FORMAT = 'zero-state';
/** Bump when the shape below changes; parseExport() must then learn the old shape too. */
export const EXPORT_VERSION = 1;

/** The versioned wrapper written by exportData() and read by importData(). */
export interface ExportV1 {
  format: typeof EXPORT_FORMAT;
  version: typeof EXPORT_VERSION;
  /** ISO timestamp of when the export was written. Informational. */
  exportedAt: string;
  /** Extension version that wrote the export. Informational. */
  appVersion: string;
  list: LinkNodeFlat[];
  settings: Settings;
}

/** What importData() applies: the validated list, plus whichever settings the payload carried. */
export interface ImportedData {
  list: LinkNodeFlat[];
  settings?: Partial<Settings>;
}

export function buildExport(list: LinkNodeFlat[], settings: Settings, appVersion: string): ExportV1 {
  return {
    format: EXPORT_FORMAT,
    version: EXPORT_VERSION,
    exportedAt: new Date().toISOString(),
    appVersion,
    list,
    settings,
  };
}

/**
 * Parses and validates an export, given as JSON text or an already-parsed value.
 * Throws an Error with a readable message on anything it can't accept. Unknown
 * properties are dropped, so the returned nodes are fresh, clean objects.
 */
export function parseExport(input: unknown): ImportedData {
  let data = input;
  if (typeof data === 'string') {
    try {
      data = JSON.parse(data);
    } catch {
      throw new Error('Not valid JSON');
    }
  }

  if (!isRecord(data) || data.format !== EXPORT_FORMAT) {
    throw new Error(`Not a ${EXPORT_FORMAT} export (expected "format": "${EXPORT_FORMAT}")`);
  }
  if (data.version !== EXPORT_VERSION) {
    throw new Error(`Unsupported export version ${String(data.version)}; this build reads version ${EXPORT_VERSION}`);
  }
  if (!Array.isArray(data.list)) {
    throw new Error('"list" must be an array');
  }

  const list = data.list.map(parseNode);
  const seen = new Set<string>();
  for (const node of list) {
    if (seen.has(node.name)) throw new Error(`Duplicate name "${node.name}" (names must be unique)`);
    seen.add(node.name);
  }
  assertNoParentLoops(list);

  const result: ImportedData = { list };
  if (data.settings !== undefined) result.settings = parseSettings(data.settings);
  return result;
}

const FAVICON_PROVIDERS = new Set<string>(Object.values(FaviconProvider));
const THEMES: Settings['theme'][] = ['light', 'dark', 'system'];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function parseNode(raw: unknown, index: number): LinkNodeFlat {
  const where = `list[${index}]`;
  if (!isRecord(raw)) throw new Error(`${where} is not an object`);
  if (typeof raw.name !== 'string' || raw.name.trim() === '') {
    throw new Error(`${where} needs a non-empty "name"`);
  }

  const node: LinkNodeFlat = { name: raw.name };
  for (const key of ['url', 'parent'] as const) {
    const value = raw[key];
    if (value === undefined || value === '') continue;
    if (typeof value !== 'string') throw new Error(`${where}.${key} must be a string`);
    node[key] = value;
  }
  if (node.url && !isValidUrl(node.url)) {
    throw new Error(`${where}.url must start with http:// or https://`);
  }
  if (raw.taskComplete !== undefined) {
    if (typeof raw.taskComplete !== 'boolean') throw new Error(`${where}.taskComplete must be a boolean`);
    if (raw.taskComplete) node.taskComplete = true;
  }
  if (raw.icon !== undefined) {
    if (typeof raw.icon !== 'string' || !FAVICON_PROVIDERS.has(raw.icon)) {
      throw new Error(`${where}.icon must be one of ${[...FAVICON_PROVIDERS].join(', ')}`);
    }
    node.icon = raw.icon as FaviconProvider;
  }
  if (raw.border !== undefined) {
    if (raw.border !== 0 && raw.border !== 1) throw new Error(`${where}.border must be 0 or 1`);
    node.border = raw.border;
  }
  return node;
}

/** Nodes inside a parent loop never reach the tree, so they'd be invisible and uneditable. */
function assertNoParentLoops(list: LinkNodeFlat[]): void {
  const parentOf = new Map(list.map(node => [node.name, node.parent] as const));
  for (const node of list) {
    const seen = new Set<string>();
    let ancestor = node.parent;
    while (ancestor !== undefined) {
      if (ancestor === node.name) throw new Error(`"${node.name}" is inside a parent loop`);
      if (seen.has(ancestor)) break; // a loop elsewhere; reported when its own member is checked
      seen.add(ancestor);
      ancestor = parentOf.get(ancestor);
    }
  }
}

function parseSettings(raw: unknown): Partial<Settings> {
  if (!isRecord(raw)) throw new Error('"settings" must be an object');
  const settings: Partial<Settings> = {};
  if (raw.theme !== undefined) {
    if (typeof raw.theme !== 'string' || !THEMES.includes(raw.theme as Settings['theme'])) {
      throw new Error(`settings.theme must be one of ${THEMES.join(', ')}`);
    }
    settings.theme = raw.theme as Settings['theme'];
  }
  if (raw.enableRightClickComplete !== undefined) {
    if (typeof raw.enableRightClickComplete !== 'boolean') {
      throw new Error('settings.enableRightClickComplete must be a boolean');
    }
    settings.enableRightClickComplete = raw.enableRightClickComplete;
  }
  if (raw.defaultFaviconProvider !== undefined) {
    if (typeof raw.defaultFaviconProvider !== 'string' || !FAVICON_PROVIDERS.has(raw.defaultFaviconProvider)) {
      throw new Error(`settings.defaultFaviconProvider must be one of ${[...FAVICON_PROVIDERS].join(', ')}`);
    }
    settings.defaultFaviconProvider = raw.defaultFaviconProvider as FaviconProvider;
  }
  return settings;
}
