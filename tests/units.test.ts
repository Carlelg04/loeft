import { describe, expect, it } from 'vitest';
import { displayToKg, formatClock, formatDuration, formatWeight, kgToDisplay, parseDecimal, parseRepRange } from '../src/lib/units';

describe('parseDecimal', () => {
  it('accepterer komma og punktum', () => {
    expect(parseDecimal('82,5')).toBe(82.5);
    expect(parseDecimal('82.5')).toBe(82.5);
    expect(parseDecimal(' 60 ')).toBe(60);
    expect(parseDecimal('12,')).toBe(12);
    expect(parseDecimal(',5')).toBe(0.5);
  });
  it('afviser tom og ugyldig tekst', () => {
    expect(parseDecimal('')).toBeUndefined();
    expect(parseDecimal('abc')).toBeUndefined();
    expect(parseDecimal('1,2,3')).toBeUndefined();
  });
});

describe('enheder', () => {
  it('kg og lb går frem og tilbage', () => {
    expect(kgToDisplay(100, 'lb')).toBeCloseTo(220.46, 2);
    expect(displayToKg(kgToDisplay(62.5, 'lb'), 'lb')).toBeCloseTo(62.5, 9);
    expect(kgToDisplay(62.5, 'kg')).toBe(62.5);
  });
  it('viser dansk decimaltegn', () => {
    expect(formatWeight(82.5, 'kg')).toBe('82,5');
    expect(formatWeight(1.25, 'kg')).toBe('1,25');
    expect(formatWeight(60, 'kg')).toBe('60');
  });
});

describe('rep-intervaller', () => {
  it('læser 8-10 og 8', () => {
    expect(parseRepRange('8-10')).toEqual({ min: 8, max: 10 });
    expect(parseRepRange('8')).toEqual({ min: 8 });
    expect(parseRepRange('')).toEqual({});
  });
});

describe('tid', () => {
  it('formaterer ur og varighed', () => {
    expect(formatClock(65)).toBe('1:05');
    expect(formatClock(3723)).toBe('1:02:03');
    expect(formatDuration(72 * 60000)).toBe('1 t 12 min');
    expect(formatDuration(45 * 60000)).toBe('45 min');
  });
});
