# Phase 7 — backend spike benchmark

How to measure the MediaPipe Face Landmarker adapter on each target device, and
where to record the results that back Decision 0001.

## Running a benchmark

No local tooling is needed; everything runs in the browser on the deployed site.

1. Open the deployed app with the spike flag:
   `https://eelkedevries.github.io/saccadacus/?spike=mediapipe`
2. Tap **Grant camera** and allow the camera prompt (HTTPS is provided by
   GitHub Pages, so this works on a phone).
3. Choose a delegate (**CPU** or **GPU**).
4. Tap **Run benchmark**. The first run also downloads the model, so its
   initialisation latency includes the network fetch; run it a second time for a
   warm initialisation figure if needed.
5. Read the metrics row (init ms, mean frame ms, p95 frame ms, effective FPS).
6. Repeat for the other delegate, then move to the next device.

The benchmark processes 150 frames from the live camera. The default app is not
affected by the spike flag.

## Devices to cover (§27 Phase 7)

- Firefox desktop
- Chromium desktop
- Firefox on Android

## Results

Fill in as measurements are gathered. Leave a cell blank if not yet measured.

| Device              | Delegate | Init (ms) | Mean frame (ms) | p95 frame (ms) | Effective FPS | Notes |
|---------------------|----------|-----------|-----------------|----------------|---------------|-------|
| Firefox desktop     | CPU      |           |                 |                |               | pending |
| Firefox desktop     | GPU      |           |                 |                |               | pending |
| Chromium desktop    | CPU      |           |                 |                |               | pending |
| Chromium desktop    | GPU      |           |                 |                |               | pending |
| Firefox on Android  | CPU      | 1605      | 37.3            | 44.0           | 22.7          | usable; cold init incl. model fetch |
| Firefox on Android  | GPU      | 838       | 33.3            | 38.0           | 28.6          | faster than CPU on both init and per-frame |
| Chrome on Android   | CPU      | 1052      | 33.2            | 35.6           | 27.7          | best sustained FPS on Chrome |
| Chrome on Android   | GPU      | 415       | 34.1            | 31.7           | 23.2          | fastest init and lowest p95 on Chrome |

Mobile devices measured by the project owner. Desktop rows remain to be gathered
but are not blocking, since the mobile targets are the most constrained devices
and all four configurations above clear the usability bar.

Reading: on Firefox Android the GPU delegate is clearly better on every metric.
On Chrome Android the two are close — CPU gives marginally higher sustained FPS,
while GPU gives much faster initialisation and a lower p95 (steadier frames).
The optimal delegate is therefore browser-dependent.

## Interpretation guide

- A usable live demo wants effective FPS at or above roughly 15, and per-frame
  latency comfortably under the frame budget (about 33 ms at 30 Hz).
- Per §25, keep the Firefox default on the CPU delegate unless the GPU row is
  clearly faster on the same hardware.
- Watch p95, not just the mean: occasional long frames are what make the overlay
  feel unstable.
- Record any failures (model load errors, GPU delegate unsupported, overheating
  throttling on the phone) in the Notes column; those inform the fallbacks in
  Decision 0001.
