import { describe, expect, it } from 'vitest';
import { RingBuffer } from '../../src/signals/ringBuffer';
import { readTraceData } from '../../src/visualisation/tracesCanvas';

describe('readTraceData', () => {
  it('assembles aligned uPlot data: [timestamps, ...channels]', () => {
    const rb = new RingBuffer(8, 3);
    rb.push(100, [1, 10, 100]);
    rb.push(101, [2, 20, 200]);
    rb.push(102, [3, 30, 300]);

    const data = readTraceData(rb, [0, 2]);
    expect(data).toHaveLength(3); // x + two channels
    expect(data[0]).toEqual([100, 101, 102]);
    expect(data[1]).toEqual([1, 2, 3]);
    expect(data[2]).toEqual([100, 200, 300]);
  });

  it('reflects ring-buffer wraparound order', () => {
    const rb = new RingBuffer(2, 1);
    rb.push(1, [1]);
    rb.push(2, [2]);
    rb.push(3, [3]); // overwrites ts=1
    const data = readTraceData(rb, [0]);
    expect(data[0]).toEqual([2, 3]);
    expect(data[1]).toEqual([2, 3]);
  });
});
