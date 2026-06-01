/**
 * Pre-allocated multi-channel ring buffer for continuous signals.
 *
 * Continuous signals (eye-local position, velocity, reliability, head pose) are
 * stored here and nowhere else: they must never be placed in Zustand or any
 * other reactive store (PROPOSAL.md §21). The rendering layer and the CSV
 * exporter read these buffers directly.
 *
 * Signal channels use `Float32Array`; the timestamp axis uses `Float64Array`
 * because `performance.now()` millisecond values need more than 24 bits of
 * mantissa to stay exact over a long session (PROPOSAL.md §21, §24).
 *
 * Storage is per-channel contiguous: channel `c` occupies the slice
 * `[c * capacity, (c + 1) * capacity)` of the backing array. When the buffer is
 * full, the oldest sample is overwritten.
 */
export class RingBuffer {
  readonly capacity: number;
  readonly channelCount: number;

  private readonly timestamps: Float64Array;
  private readonly channels: Float32Array;
  /** Index at which the next sample will be written. */
  private writeIndex = 0;
  /** Number of valid samples currently stored (<= capacity). */
  private count = 0;

  constructor(capacity: number, channelCount: number) {
    if (!Number.isInteger(capacity) || capacity <= 0) {
      throw new Error(`RingBuffer capacity must be a positive integer, received ${capacity}`);
    }
    if (!Number.isInteger(channelCount) || channelCount <= 0) {
      throw new Error(
        `RingBuffer channelCount must be a positive integer, received ${channelCount}`,
      );
    }
    this.capacity = capacity;
    this.channelCount = channelCount;
    this.timestamps = new Float64Array(capacity);
    this.channels = new Float32Array(capacity * channelCount);
  }

  /** Number of valid samples currently stored. */
  get length(): number {
    return this.count;
  }

  /** True once the buffer has wrapped and is overwriting the oldest samples. */
  get isFull(): boolean {
    return this.count === this.capacity;
  }

  /**
   * Append one sample. `values` must contain exactly `channelCount` entries,
   * one per channel, in channel order.
   */
  push(tsMs: number, values: ArrayLike<number>): void {
    if (values.length !== this.channelCount) {
      throw new Error(
        `RingBuffer.push expected ${this.channelCount} channel values, received ${values.length}`,
      );
    }
    const slot = this.writeIndex;
    this.timestamps[slot] = tsMs;
    for (let c = 0; c < this.channelCount; c++) {
      this.channels[c * this.capacity + slot] = values[c] as number;
    }
    this.writeIndex = (slot + 1) % this.capacity;
    if (this.count < this.capacity) {
      this.count += 1;
    }
  }

  /** Index of the oldest valid sample in the backing arrays. */
  private oldestIndex(): number {
    return this.isFull ? this.writeIndex : 0;
  }

  /**
   * Timestamps ordered oldest to newest. Pass `out` to avoid an allocation; it
   * must be at least `length` long. Returns a view of `out` or a fresh array.
   */
  timestampsOrdered(out?: Float64Array): Float64Array {
    const n = this.count;
    const target = out ?? new Float64Array(n);
    const oldest = this.oldestIndex();
    for (let i = 0; i < n; i++) {
      target[i] = this.timestamps[(oldest + i) % this.capacity] as number;
    }
    return out ? target.subarray(0, n) : target;
  }

  /**
   * One channel's samples ordered oldest to newest. Pass `out` to avoid an
   * allocation; it must be at least `length` long.
   */
  channelOrdered(channel: number, out?: Float32Array): Float32Array {
    if (!Number.isInteger(channel) || channel < 0 || channel >= this.channelCount) {
      throw new Error(`RingBuffer channel ${channel} out of range [0, ${this.channelCount})`);
    }
    const n = this.count;
    const target = out ?? new Float32Array(n);
    const oldest = this.oldestIndex();
    const base = channel * this.capacity;
    for (let i = 0; i < n; i++) {
      target[i] = this.channels[base + ((oldest + i) % this.capacity)] as number;
    }
    return out ? target.subarray(0, n) : target;
  }

  /** The most recent sample, or `undefined` when the buffer is empty. */
  latest(): { tsMs: number; values: Float32Array } | undefined {
    if (this.count === 0) {
      return undefined;
    }
    const slot = (this.writeIndex - 1 + this.capacity) % this.capacity;
    const values = new Float32Array(this.channelCount);
    for (let c = 0; c < this.channelCount; c++) {
      values[c] = this.channels[c * this.capacity + slot] as number;
    }
    return { tsMs: this.timestamps[slot] as number, values };
  }

  /** Discard all samples without reallocating the backing storage. */
  clear(): void {
    this.writeIndex = 0;
    this.count = 0;
  }
}
