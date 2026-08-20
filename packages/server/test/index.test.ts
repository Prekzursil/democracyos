import { describe, expect, it } from 'vitest';
import { packageName } from '../src/index.js';

describe('@dosrevival/server placeholder', () => {
  it('exposes the package name', () => {
    expect(packageName()).toBe('@dosrevival/server');
  });
});
