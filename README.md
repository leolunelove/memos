# Memos. A little space for your voice.

#### Record a thought, refine a take, and keep it as an MP4. Right in your browser.

[**Open Memos →**](https://leolunelove.github.io/memos/)

No account. No installation. Your audio stays in your browser.

## Start recording

1. **Choose your microphone.** Allow access and select the input you want.
2. **Make your take.** Record, pause, resume, and stop whenever you’re ready.
3. **Keep a copy.** Trim the edges, listen back, and export an audio-only MP4.

## A few thoughtful extras

- **Simple edits.** Reversible trimming, even volume, and three optional voice effects tucked inside Audio adjustments. Your original stays intact.
- **An organized library.** Search by name, change playback speed, and recover recently deleted recordings for 30 days.
- **Your language, your colours.** English and 简体中文, with four gradient palettes: Peach and Sea Glass in light; Twilight and Aurora in dark.
- **Ready to take with you.** Back up and restore your library, share an MP4 where supported, or add Memos to your home screen. Download the offline exporter in Settings before going offline.

[Explore the user guide →](docs/usage.md)

## Private, with a practical reminder

Recordings are saved **in this browser**, with no cloud backup. Clearing browser data or storage eviction can remove them. Export important recordings or save a library backup in Settings.

Saved audio chunks can help recover an interrupted take, but the final unsaved moments may be missing. Recordings don’t move automatically between browsers, devices, or website addresses.

[Storage and recovery →](docs/usage.md#storage-and-recovery)

## Run it locally

```sh
git clone https://github.com/leolunelove/memos.git
cd memos
python3 -m http.server 8000
```

Open [localhost:8000](http://localhost:8000). There’s no build step or package installation. Microphone access requires HTTPS or localhost.

## Under the surface

Memos uses plain HTML, CSS, and JavaScript. Recording and editing run locally with MediaRecorder, Web Audio, and IndexedDB; the bundled MP4 encoder also runs in your browser.

[Development guide](docs/development.md) · [Phone testing](docs/mobile-testing.md) · [Third-party licenses](vendor/ffmpeg/NOTICE.txt)
