import { useState } from 'react';
import type { ReactElement } from 'react';

/**
 * In-app help (PROPOSAL.md §17). Concise, plain, British spelling, no marketing
 * copy or emojis. Collapsed by default to keep the interface measurement-led.
 */
export function HelpPanel(): ReactElement {
  const [open, setOpen] = useState(false);

  return (
    <section className="border border-neutral-700 p-3" aria-label="Help">
      <button
        type="button"
        className="text-sm font-medium underline"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        {open ? 'Hide help' : 'Show help'}
      </button>

      {open ? (
        <div className="mt-2 space-y-2 text-sm text-neutral-300">
          <p>
            saccadacus tracks eye and head movement from your camera and shows the
            derived signals. All processing stays on your device.
          </p>
          <dl className="space-y-2">
            <div>
              <dt className="font-medium">Live view</dt>
              <dd>
                Start camera tracking to use your camera, or run the synthetic demo
                without one. The view keeps your head centred; markers show the eye
                corners, iris, and head pose. Traces plot eye-local horizontal and
                vertical position; saccades and blinks are marked on them.
              </dd>
            </div>
            <div>
              <dt className="font-medium">Tracking mode</dt>
              <dd>
                Choose iris-centre, pupil-centre, or automatic (the more reliable of
                the two). Iris-centre is the usual default.
              </dd>
            </div>
            <div>
              <dt className="font-medium">Eye selection</dt>
              <dd>
                View the left eye, the right eye, a binocular combination, or both
                eyes separately.
              </dd>
            </div>
            <div>
              <dt className="font-medium">Reliability</dt>
              <dd>
                Percentages in the status panel indicate signal quality. Treat low
                values with caution.
              </dd>
            </div>
            <div>
              <dt className="font-medium">Quality check</dt>
              <dd>
                A short functional check of signal direction and reliability. It is
                not a gaze calibration.
              </dd>
            </div>
            <div>
              <dt className="font-medium">Follow-the-dots</dt>
              <dd>
                Follow each dot with your eyes. This fits optional gaze mapping to
                screen position. The eye-local signal is still recorded.
              </dd>
            </div>
            <div>
              <dt className="font-medium">Export</dt>
              <dd>
                Download one combined CSV with time-series, event, and dot rows,
                distinguished by the row_type column. Data is saved to your device.
              </dd>
            </div>
          </dl>
        </div>
      ) : null}
    </section>
  );
}
