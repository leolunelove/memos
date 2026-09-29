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
│   ├── i18n.js
│   ├── library.js
│   ├── offline.js
│   ├── storage.js
│   ├── effects.js
│   ├── audio-processing.js
│   └── styles.css
├── sw.js
├── manifest.webmanifest
├── tests/
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
| `app/i18n.js` | English/Simplified Chinese strings, static labels, and preferences |
| `app/library.js` | Validated binary library backups without base64 expansion |
| `app/offline.js`, `sw.js` | Install controls and app/encoder caching, scoped to the deployment path |
| `app/styles.css` | Shared visual styles and responsive layouts |

## Audio and storage

The original recording blob remains unchanged. Trim boundaries, volume enhancement, and the selected effect are stored alongside it. Trim previews play the selected original segment; applying the trim prepares it with the selected effect.

Trim-only processing preserves channels at 48 kHz. Voice effects use mono audio at 24 kHz. The bundled encoder converts edited or non-MP4 audio to AAC in an MP4 container.

Saved recordings retain their existing IndexedDB database and IDs. Recovery uses a companion database for chunk journals, so an older open tab cannot block a schema upgrade. Web Locks prevent another tab from recovering an active take. Final saves precede journal cleanup, and recovery uses the same recording ID to avoid duplicates.

Browser storage is best effort. Delivery of recording chunks may be delayed in the background, and only committed chunks can be recovered. See [Storage and recovery](usage.md#storage-and-recovery) for the user-facing explanation.

## Bundled dependencies

[`vendor/ffmpeg/`](../vendor/ffmpeg/) contains the encoder loader, worker, core, and five WebAssembly parts. The parts are reassembled in order before loading; keep their names and bytes intact when updating dependencies.

The directory is marked as vendored in `.gitattributes`, keeping dependency code out of the repository's language breakdown. Versions, upstream source, and license files are documented in [`NOTICE.txt`](../vendor/ffmpeg/NOTICE.txt). No project-wide license is implied by those dependency licenses.

## Publishing

GitHub Pages publishes **`main` → repository root**. `.nojekyll` keeps the files as a static site. No custom build workflow is needed.

1. Review changes locally and complete the relevant checks below.
2. Obtain approval of the local preview, then commit and push the complete change to `main`.
3. Wait for **pages build and deployment** to succeed in [Actions](https://github.com/leolunelove/memos/actions).
4. Open [the live app](https://leolunelove.github.io/memos/) and confirm that scripts, styles, workers, and export assets load.

Keep paths relative to the app entry point or module, so the site works under `/memos/` as well as on localhost. Do not change the storage database names when reorganizing files.

## Library and offline formats

Deletion adds a `deletedAt` timestamp to the existing record; it does not immediately remove the blob. Active lists exclude tombstones. Restore removes the timestamp; startup purges tombstones older than 30 days.

A `.memos` backup contains an eight-byte `MEMOS001` marker, a big-endian four-byte JSON-header length, UTF-8 versioned metadata, then consecutive audio blobs. Imports validate bounds, metadata, types, duplicate IDs, and edit ranges before a single atomic IndexedDB transaction adds missing IDs. A quota error or conflicting ID aborts the whole transaction.

Offline shell and encoder caches are scoped by deployment path. Bump the shell version and HTML asset query versions whenever application files change. A new worker waits for existing tabs to close; do not force-activate it during a recording. Encoder files are cached when used or via the explicit offline download. No audio is stored in the service-worker cache or sent over the network.

## Automated checks

Run `node tests/refinements.mjs` for volume processing, original preservation, binary backup round trips, and malformed archives. Serve the repository and open `tests/storage.html` for isolated IndexedDB transaction and recovery checks. Test databases use random suffixes and are removed after completion.

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
- Switch languages in idle and playback states; preserve existing names and Chinese IME composition.
- Delete/undo, reload Recently deleted, restore, and retain edit settings.
- Search Chinese and English names; verify speed does not affect export duration.
- Back up and restore without overwrites; reject malformed or oversized files and abort failed transactions.
- Download offline assets, stop the server, reload, and export a saved take.
- Follow the [physical-device test checklist](mobile-testing.md) before claiming phone interruption support.

The recording and editing release was checked with isolated synthetic microphone audio, including WebM and native MP4 recovery, storage failures, cancellation/retry, and layouts at 390 px and 320 px. Decoded exports confirmed a four-second trim, the 0.39-second echo tail, and pitch correction of a 225 Hz tone to about 221 Hz. Physical iPhone recording and long-session stress tests have not been performed.

[Back to the README](../README.md)

## September 29 local preview validation

The new local preview passed a 50-second synthetic WebM capture with pause/resume and chunk saving, combined light tuning/trim/volume enhancement, MP4 export, delete/undo, bilingual search, backup export and file-picker restore, cancellation/retry, and offline reload plus MP4 export with the server stopped. Storage checks covered atomic rollback, tombstones, active-take locks, and Chinese recovery names. A ten-minute synthetic PCM input passed volume processing and trim checks; this is not a ten-minute physical microphone test. A 320 px iframe checked Chinese playback layout without horizontal overflow.

Physical phone calls, locking/background behavior, native share destinations, and home-screen installation remain device checks. Publication of this version was authorized on September 29, following the local preview. Physical-device checks remain explicitly unverified.
