# Memos

[Open Memos](https://leolunelove.github.io/memos/)

A simple voice recorder inspired by Voice Memos.

- Choose your microphone.
- Record, pause, resume, and play back.
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
