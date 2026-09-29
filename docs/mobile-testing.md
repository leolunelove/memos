# Phone verification

[Development](development.md) · [Using Memos](usage.md)

Use disposable recordings on an actual iPhone (Safari and home-screen app) and Android phone (Chrome and installed app). These checks have not yet been performed on physical devices.

1. Record at least ten minutes with the screen on. Pause/resume, stop, play, trim, enhance, and export. Compare the recording length and listen at the start, middle, and end.
2. Record another take, lock the phone, unlock it, and inspect the recording state. Check recovered audio after an interruption; do not assume capture continues while locked.
3. Repeat while switching apps and during an incoming call. Confirm the app saves or recovers captured audio and releases the microphone after stopping.
4. Disconnect an external microphone during a take. Confirm the available audio is saved and the input list refreshes.
5. Force-close the browser during a disposable take, reopen, and verify saved chunks recover without duplicate recordings.
6. Export, open Share MP4, and save to Files or another chosen destination. Cancel the share sheet and ensure Memos remains usable.
7. Download the offline exporter, enable airplane mode, reopen Memos, and record/play/export. Repeat from the home-screen app.
8. Test English and 简体中文, Chinese keyboard composition while renaming, both appearances, search, speed, delete/undo, and Recently deleted after reopening.
9. Back up and restore into a separate browser. Confirm audio and edits survive, and restoring again does not duplicate or overwrite existing recordings.

Record device, operating-system/browser versions, recording length, results, and any missing audio before signing off the release. Desktop synthetic tests do not replace these checks.
