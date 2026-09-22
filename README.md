# Memos

[Open Memos](https://leolunelove.github.io/memos/)

A simple voice recorder inspired by Voice Memos.

- Choose your microphone.
- Record, pause, resume, and play back.
- Save incoming audio chunks during recording and recover interrupted takes on reopening.
- Give takes numbered names, rename with the pencil button, and start a new take beside the player.
- Trim the beginning and end with two handles. Reset and apply to restore the full original.
- See processing stages and cancel effects or MP4 conversion.
- Export audio-only MP4 files.
- Add Light tune, Deep voice, or Soft echo after recording. Preview the effect and include it in the export; switch back to Original at any time.
- Recordings stay in your browser on your device. No audio is uploaded.

## Hosting

This is a complete static website. GitHub Pages publishes from the root of the `main` branch. No build is required.

## Local preview

```sh
python3 -m http.server 8000
```

Open http://localhost:8000. Recording requires HTTPS or localhost. Clearing browser data removes local recordings. Recordings do not transfer automatically between website addresses.

## Audio export

Browsers that support MP4 recording export directly. Other browsers use the bundled ffmpeg.wasm encoder locally. The encoder loads only when conversion is needed. See NOTICE.txt for dependency licenses and source.

## Voice effects

Light tune gently moves voiced notes toward the nearest chromatic semitone. It works best on a single sung voice; it is a playful pitch effect, not studio vocal correction. Deep voice lowers pitch while keeping the timing. Soft echo adds a short delay tail. Effects run locally in a worker, are remembered per recording, and never overwrite the original audio. Effect previews use mono audio at 24 kHz.

## Recovery and storage

Incoming audio chunks are saved in IndexedDB, normally about once per second. Browser timing varies, especially when a phone locks or a page goes into the background. Only chunks already delivered and committed can be recovered; the final unsaved moments may be missing. Recovery requires IndexedDB and Web Locks; unsupported or full storage shows a warning. Open tabs coordinate so an active recording is not recovered in another tab.

Audio is stored only for this browser and site address. There is no cloud backup. Clearing site data, private browsing cleanup, or storage eviction can remove recordings. Export important takes. Existing recordings keep their original database and IDs.

Trims and effects save edit settings alongside the original blob. Trim previews play the selected original segment; applying the trim prepares it with the selected effect. Trim-only processing preserves channels at 48 kHz; voice effects use mono at 24 kHz. Export includes the applied trim and effect.

## Validation

Tested using synthetic microphone audio in an isolated browser database: closed-tab recovery of unfinished WebM and native MP4 takes; active-take lock protection; normal stop and journal cleanup; pause/resume; microphone selection; unique default naming; trim apply/cancel/reset and persistence; storage failure with export still available; processing and exporter cancellation followed by successful retry.

Decoded exports verified as AAC in MP4: a 4-second trim stays 4 seconds; Soft echo adds its 0.39-second tail; Light tune moves a 225 Hz test tone to about 221 Hz. DSP checks cover stereo trim boundaries, original preservation, and restoration. Layout reviewed at desktop, 390 px, and 320 px widths. Physical iPhone recording and long-session stress tests have not been performed.
