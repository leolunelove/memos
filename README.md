<p align="center">
  <img src="assets/memos.svg" width="64" height="64" alt="">
</p>

<h1 align="center">Memos</h1>

<p align="center">A simple voice recorder for your browser.</p>

<p align="center">
  <a href="https://leolunelove.github.io/memos/">Open Memos</a> ·
  <a href="docs/usage.md">Using Memos</a> ·
  <a href="docs/development.md">Development</a>
</p>

---

## Record, refine, export

- **Record** with your preferred microphone. Pause, resume, and name each take.
- **Refine** with reversible trimming and three optional voice effects: Light tune, Deep voice, and Soft echo.
- **Export** your finished recording as an audio-only MP4, including its trim and effect.
- **Keep the original.** Edits never replace the original audio. Saved chunks can help recover an interrupted take.

## Get started

1. [Open Memos](https://leolunelove.github.io/memos/) and allow microphone access.
2. Choose an input, press **Record**, then **Stop** when you are finished.
3. Listen, rename, or trim your take. Add a voice effect if you like.
4. Choose **Export MP4** to keep a copy outside the browser.

## Your recordings

Audio stays in this browser and is not uploaded. There is **no cloud backup**: clearing browser data or storage eviction can remove recordings. Export important takes.

Recovery restores audio chunks saved before an interruption; the final unsaved moments may be missing. Recordings do not transfer automatically between browsers, devices, or website addresses.

[Read the storage and recovery guide →](docs/usage.md#storage-and-recovery)

## Run locally

```sh
git clone https://github.com/leolunelove/memos.git
cd memos
python3 -m http.server 8000
```

Open [localhost:8000](http://localhost:8000). No package installation or build step is needed. Recording requires HTTPS or localhost.

## Repository guide

| Path | Purpose |
| --- | --- |
| [`index.html`](index.html) | App layout and entry point |
| [`app/`](app/) | Recorder, storage, audio processing, and styles |
| [`assets/`](assets/) | Memos app icon |
| [`docs/`](docs/) | User guide and development notes |
| [`vendor/ffmpeg/`](vendor/ffmpeg/) | Bundled MP4 encoder and dependency licenses |

GitHub Pages serves the repository root from `main`. See [Development](docs/development.md) for the file map, publishing steps, and verification checklist.

## Built with

Plain HTML, CSS, and JavaScript, using MediaRecorder, Web Audio, and IndexedDB. When MP4 conversion is needed, the bundled [ffmpeg.wasm](https://github.com/ffmpegwasm/ffmpeg.wasm) encoder runs locally in the browser.

Dependency versions, source links, and licenses are listed in [the third-party notice](vendor/ffmpeg/NOTICE.txt).
