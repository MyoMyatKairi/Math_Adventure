import { describe, expect, it } from 'vitest';
import { numberToWords, placeValue } from '../src';

describe('numberToWords', () => {
  it('names small numbers and teens', () => {
    expect(numberToWords(0)).toBe('zero');
    expect(numberToWords(7)).toBe('seven');
    expect(numberToWords(13)).toBe('thirteen');
    expect(numberToWords(19)).toBe('nineteen');
  });
  it('names tens with and without ones', () => {
    expect(numberToWords(20)).toBe('twenty');
    expect(numberToWords(45)).toBe('forty-five');
    expect(numberToWords(99)).toBe('ninety-nine');
  });
  it('names hundreds', () => {
    expect(numberToWords(100)).toBe('one hundred');
    expect(numberToWords(305)).toBe('three hundred and five');
    expect(numberToWords(1000)).toBe('one thousand');
  });
  it('rejects unsupported input', () => {
    expect(() => numberToWords(-1)).toThrow(RangeError);
    expect(() => numberToWords(1.5)).toThrow(RangeError);
    expect(() => numberToWords(1001)).toThrow(RangeError);
  });
});

describe('placeValue', () => {
  it('splits into hundreds, tens and ones', () => {
    expect(placeValue(7)).toEqual({ hundreds: 0, tens: 0, ones: 7 });
    expect(placeValue(34)).toEqual({ hundreds: 0, tens: 3, ones: 4 });
    expect(placeValue(100)).toEqual({ hundreds: 1, tens: 0, ones: 0 });
  });
});
