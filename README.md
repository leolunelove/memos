# Memos

A simple voice recorder inspired by Voice Memos.

- Choose your microphone.
- Record, pause, resume, and play back.
- Export audio-only MP4 files.
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
