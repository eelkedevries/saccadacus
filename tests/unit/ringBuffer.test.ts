import { describe, expect, it } from 'vitest';
import { RingBuffer } from '../../src/signals/ringBuffer';

describe('RingBuffer', () => {
  it('rejects non-positive capacity and channel count', () => {
    expect(() => new RingBuffer(0, 1)).toThrow();
    expect(() => new RingBuffer(4, 0)).toThrow();
    expect(() => new RingBuffer(2.5, 1)).toThrow();
  });

  it('reports capacity, channel count and length', () => {
    const rb = new RingBuffer(4, 2);
    expect(rb.capacity).toBe(4);
    expect(rb.channelCount).toBe(2);
    expect(rb.length).toBe(0);
    expect(rb.isFull).toBe(false);

    rb.push(10, [1, 2]);
    expect(rb.length).toBe(1);
    expect(rb.isFull).toBe(false);
  });

  it('rejects a push with the wrong number of channel values', () => {
    const rb = new RingBuffer(4, 2);
    expect(() => rb.push(0, [1])).toThrow();
    expect(() => rb.push(0, [1, 2, 3])).toThrow();
  });

  it('returns ordered reads before wraparound', () => {
    const rb = new RingBuffer(4, 1);
    rb.push(100, [1]);
    rb.push(101, [2]);
    rb.push(102, [3]);

    expect(Array.from(rb.timestampsOrdered())).toEqual([100, 101, 102]);
    expect(Array.from(rb.channelOrdered(0))).toEqual([1, 2, 3]);
  });

  it('overwrites the oldest sample on wraparound and keeps order', () => {
    const rb = new RingBuffer(3, 1);
    rb.push(1, [10]);
    rb.push(2, [20]);
    rb.push(3, [30]);
    rb.push(4, [40]); // overwrites ts=1
    rb.push(5, [50]); // overwrites ts=2

    expect(rb.isFull).toBe(true);
    expect(rb.length).toBe(3);
    expect(Array.from(rb.timestampsOrdered())).toEqual([3, 4, 5]);
    expect(Array.from(rb.channelOrdered(0))).toEqual([30, 40, 50]);
  });

  it('keeps timestamps aligned with each channel across wraparound', () => {
    const rb = new RingBuffer(3, 2);
    for (let i = 0; i < 5; i++) {
      rb.push(i, [i * 2, i * 3]);
    }
    const ts = Array.from(rb.timestampsOrdered());
    const ch0 = Array.from(rb.channelOrdered(0));
    const ch1 = Array.from(rb.channelOrdered(1));
    expect(ts).toEqual([2, 3, 4]);
    expect(ch0).toEqual([4, 6, 8]);
    expect(ch1).toEqual([6, 9, 12]);
  });

  it('rejects out-of-range channel reads', () => {
    const rb = new RingBuffer(3, 2);
    rb.push(0, [1, 2]);
    expect(() => rb.channelOrdered(2)).toThrow();
    expect(() => rb.channelOrdered(-1)).toThrow();
  });

  it('returns the latest sample and undefined when empty', () => {
    const rb = new RingBuffer(3, 2);
    expect(rb.latest()).toBeUndefined();
    rb.push(7, [11, 22]);
    rb.push(8, [33, 44]);
    const latest = rb.latest();
    expect(latest?.tsMs).toBe(8);
    expect(Array.from(latest?.values ?? [])).toEqual([33, 44]);
  });

  it('writes into a provided output array without allocating', () => {
    const rb = new RingBuffer(4, 1);
    rb.push(1, [5]);
    rb.push(2, [6]);
    const out = new Float32Array(4);
    const view = rb.channelOrdered(0, out);
    expect(view.length).toBe(2);
    expect(Array.from(view)).toEqual([5, 6]);
    expect(out[0]).toBe(5);
  });

  it('clears without reallocating', () => {
    const rb = new RingBuffer(3, 1);
    rb.push(1, [1]);
    rb.push(2, [2]);
    rb.clear();
    expect(rb.length).toBe(0);
    expect(rb.latest()).toBeUndefined();
    rb.push(9, [9]);
    expect(Array.from(rb.channelOrdered(0))).toEqual([9]);
  });
});
