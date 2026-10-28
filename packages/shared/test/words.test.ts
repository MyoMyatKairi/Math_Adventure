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

describe('numberToWords in Burmese and Thai', () => {
  it('names Burmese numbers with the creaky tone when more follows', () => {
    expect(numberToWords(0, 'my')).toBe('သုည');
    expect(numberToWords(10, 'my')).toBe('တစ်ဆယ်');
    expect(numberToWords(15, 'my')).toBe('ဆယ့်ငါး');
    expect(numberToWords(20, 'my')).toBe('နှစ်ဆယ်');
    expect(numberToWords(25, 'my')).toBe('နှစ်ဆယ့်ငါး');
    expect(numberToWords(100, 'my')).toBe('တစ်ရာ');
    expect(numberToWords(105, 'my')).toBe('တစ်ရာ့ငါး');
    expect(numberToWords(110, 'my')).toBe('တစ်ရာ့တစ်ဆယ်');
    expect(numberToWords(1000, 'my')).toBe('တစ်ထောင်');
  });
  it('names Thai numbers with เอ็ด and ยี่สิบ', () => {
    expect(numberToWords(0, 'th')).toBe('ศูนย์');
    expect(numberToWords(10, 'th')).toBe('สิบ');
    expect(numberToWords(11, 'th')).toBe('สิบเอ็ด');
    expect(numberToWords(21, 'th')).toBe('ยี่สิบเอ็ด');
    expect(numberToWords(45, 'th')).toBe('สี่สิบห้า');
    expect(numberToWords(101, 'th')).toBe('หนึ่งร้อยหนึ่ง');
    expect(numberToWords(111, 'th')).toBe('หนึ่งร้อยสิบเอ็ด');
    expect(numberToWords(1000, 'th')).toBe('หนึ่งพัน');
  });
});
