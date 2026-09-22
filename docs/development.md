# Development

[Back to the README](../README.md) · [Using Memos](usage.md)

## Local setup

Memos is a static website with no build step or package manager dependency. From the repository root:

```sh
python3 -m http.server 8000
```

Open [localhost:8000](http://localhost:8000). Microphone capture requires HTTPS or localhost and browser permission.

## File map

```text
memos/
├── index.html
├── app/
│   ├── main.js
│   ├── storage.js
│   ├── effects.js
│   ├── audio-processing.js
│   └── styles.css
├── assets/
│   └── memos.svg
├── docs/
│   ├── usage.md
│   └── development.md
└── vendor/
    └── ffmpeg/
```

| File | Responsibility |
| --- | --- |
| `index.html` | Accessible controls, metadata, and app entry point |
| `app/main.js` | Recording, playback, editing controls, and export orchestration |
| `app/storage.js` | Saved recordings, chunk journaling, and interrupted-take recovery |
| `app/effects.js` | Pitch correction, pitch shifting, and echo processing |
| `app/audio-processing.js` | Worker-based trimming, waveform peaks, and WAV preparation |
| `app/styles.css` | Shared visual styles and responsive layouts |

## Audio and storage

The original recording blob remains unchanged. Trim boundaries and the selected effect are stored alongside it. Trim previews play the selected original segment; applying the trim prepares it with the selected effect.

Trim-only processing preserves channels at 48 kHz. Voice effects use mono audio at 24 kHz. The bundled encoder converts edited or non-MP4 audio to AAC in an MP4 container.

Saved recordings retain their existing IndexedDB database and IDs. Recovery uses a companion database for chunk journals, so an older open tab cannot block a schema upgrade. Web Locks prevent another tab from recovering an active take. Final saves precede journal cleanup, and recovery uses the same recording ID to avoid duplicates.

Browser storage is best effort. Delivery of recording chunks may be delayed in the background, and only committed chunks can be recovered. See [Storage and recovery](usage.md#storage-and-recovery) for the user-facing explanation.

## Bundled dependencies

[`vendor/ffmpeg/`](../vendor/ffmpeg/) contains the encoder loader, worker, core, and five WebAssembly parts. The parts are reassembled in order before loading; keep their names and bytes intact when updating dependencies.

The directory is marked as vendored in `.gitattributes`, keeping dependency code out of the repository's language breakdown. Versions, upstream source, and license files are documented in [`NOTICE.txt`](../vendor/ffmpeg/NOTICE.txt). No project-wide license is implied by those dependency licenses.

## Publishing

GitHub Pages publishes **`main` → repository root**. `.nojekyll` keeps the files as a static site. No custom build workflow is needed.

1. Review changes locally and complete the relevant checks below.
2. Commit and push the complete change to `main`.
3. Wait for **pages build and deployment** to succeed in [Actions](https://github.com/leolunelove/memos/actions).
4. Open [the live app](https://leolunelove.github.io/memos/) and confirm that scripts, styles, workers, and export assets load.

Keep paths relative to the app entry point or module, so the site works under `/memos/` as well as on localhost. Do not change the storage database names when reorganizing files.

## Verification checklist

Use synthetic or disposable test recordings, and keep them separate from real recordings.

- Record, pause, resume, stop, rename, and start a new take.
- Verify microphone selection and permission-error feedback.
- Close an unfinished test take and confirm recovery; an active take in another tab should remain untouched.
- Apply, cancel, reset, and reload a trim without altering the original audio.
- Preview each effect and confirm it is included in MP4 output.
- Cancel processing and export, then verify a retry succeeds.
- Confirm storage failures leave the take available for export.
- Check desktop and narrow phone layouts, keyboard controls, and console errors.

The recording and editing release was checked with isolated synthetic microphone audio, including WebM and native MP4 recovery, storage failures, cancellation/retry, and layouts at 390 px and 320 px. Decoded exports confirmed a four-second trim, the 0.39-second echo tail, and pitch correction of a 225 Hz tone to about 221 Hz. Physical iPhone recording and long-session stress tests have not been performed.

[Back to the README](../README.md)
