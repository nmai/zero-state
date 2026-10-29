import { describe, expect, it } from 'vitest';
import { isValidUrl, validateNodeForm } from '../src/services/validation';
import { LinkNodeFlat } from '../src/types';

const nodes: LinkNodeFlat[] = [
  { name: 'a' },
  { name: 'b', parent: 'a' },
  { name: 'c', parent: 'b' },
];

const base = { name: 'new', url: '', parent: '', nodes };

describe('isValidUrl', () => {
  it('accepts http and https URLs', () => {
    expect(isValidUrl('https://example.com')).toBe(true);
    expect(isValidUrl('http://example.com')).toBe(true);
  });

  it('rejects other schemes and bare hostnames', () => {
    expect(isValidUrl('ftp://example.com')).toBe(false);
    expect(isValidUrl('example.com')).toBe(false);
    expect(isValidUrl('javascript:alert(1)')).toBe(false);
  });
});

describe('validateNodeForm', () => {
  it('accepts a valid new node', () => {
    expect(validateNodeForm({ ...base })).toBeNull();
    expect(validateNodeForm({ ...base, url: 'https://x.com', parent: 'a' })).toBeNull();
  });

  it('requires a name', () => {
    expect(validateNodeForm({ ...base, name: '' })).toMatch(/Name must be populated/);
  });

  it('rejects duplicate names when adding', () => {
    expect(validateNodeForm({ ...base, name: 'a' })).toMatch(/already taken/);
  });

  it('allows keeping your own name when editing', () => {
    expect(validateNodeForm({ ...base, name: 'a', originalName: 'a' })).toBeNull();
  });

  it('rejects renaming onto another existing name', () => {
    expect(validateNodeForm({ ...base, name: 'b', originalName: 'a' })).toMatch(/already taken/);
  });

  it('rejects malformed URLs', () => {
    expect(validateNodeForm({ ...base, url: 'not-a-url' })).toMatch(/URL format invalid/);
  });

  it('rejects a nonexistent parent', () => {
    expect(validateNodeForm({ ...base, parent: 'ghost' })).toMatch(/Parent does not exist/);
  });

  it('rejects making a node its own parent', () => {
    expect(validateNodeForm({ ...base, name: 'a', originalName: 'a', parent: 'a' }))
      .toMatch(/loops back/);
  });

  it('rejects a parent chain that loops back through descendants', () => {
    // a -> b -> c; making c the parent of a would orphan the whole chain
    expect(validateNodeForm({ ...base, name: 'a', originalName: 'a', parent: 'c' }))
      .toMatch(/loops back/);
  });

  it('catches loops through the original name when renaming', () => {
    // Renaming a -> a2 while parenting it under its own descendant c
    expect(validateNodeForm({ ...base, name: 'a2', originalName: 'a', parent: 'c' }))
      .toMatch(/loops back/);
  });

  it('does not flag a pre-existing unrelated cycle', () => {
    const cyclic: LinkNodeFlat[] = [
      { name: 'x', parent: 'y' },
      { name: 'y', parent: 'x' },
    ];
    expect(validateNodeForm({ name: 'new', url: '', parent: 'x', nodes: cyclic })).toBeNull();
  });
});
