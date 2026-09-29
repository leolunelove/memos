# Using Memos

[Open Memos](https://leolunelove.github.io/memos/) · [Back to the README](../README.md)

## Make a recording

Allow microphone access, then choose your input in **Microphone**. Use the refresh button if you connect a new microphone. You can change inputs before starting a take.

Press **Record** to begin. Pause and resume as needed, then press **Stop** to save the take. Recordings receive numbered names. Use the pencil beside the name to rename a take, or choose **New recording** beside the player to start another.

## Trim a take

1. Select a recording and choose **Trim**.
2. Drag the start and end handles to keep the part you want.
3. Press **Play** to check the selected part in the original voice.
4. Choose **Apply trim** to use that selection for playback and export.

**Cancel** leaves the saved trim unchanged. To restore the complete take, choose **Edit trim → Reset → Apply trim**. The original audio is always kept.

## Adjust the audio

Open **Audio adjustments** beneath the player. Effects and volume enhancement are optional, apply after recording, and are included in playback and export. The panel starts collapsed and Original is the default.

| Effect | Sound |
| --- | --- |
| Original | No voice effect; any applied trim remains |
| Gentle pitch correction | Gently nudges voiced notes toward the nearest musical semitone |
| Deep voice | Lowers pitch while keeping the timing |
| Soft echo | Adds a short, soft delay tail |

Gentle pitch correction works best on a single sung voice and provides gentle correction. Choose **Original** to remove an effect. Each recording remembers its selected effect.

Processing shows its current stage. Choose **Cancel** to stop a slow effect or export; the saved recording remains available.

## Export a recording

Select the take and choose **Export MP4**. The downloaded file contains audio only, with the applied trim, effect, and volume enhancement. Playback speed only affects listening, not exports. Its filename follows the recording name and includes the effect name when one is selected.

Browsers that record MP4 can export the original directly. Other recordings and edited audio use a local converter, which loads on first use. Long recordings can take more time and memory to convert.

## Language, appearance, and listening

Use **English / 简体中文** in the header to change language. On your first visit, Memos follows your browser language when Chinese is selected. Controls, feedback, dates, and new numbered recording names follow your choice; existing recording names stay unchanged.

In **Settings → Appearance**, choose **System**, **Light**, or **Dark**. The system option follows your device. Language, appearance, and playback speed are remembered in this browser when local storage is available.

Search by recording name above the library. Playback speed offers **0.75×, 1×, 1.5×, and 2×**. Open **Audio adjustments** and enable **Even out volume** for gentle, reversible leveling; it applies to playback and export and can be combined with effects. It is not noise removal, and very quiet noisy recordings can still sound noisy.

## Share a recording

On browsers with sharing support, choose **Prepare to share** to prepare an MP4 without downloading it. Then choose **Share MP4** to open the device's share sheet. A separate tap is needed so your browser can open the share sheet. Exporting also prepares the same shareable file. Choose a destination yourself. If file sharing is unavailable, use the downloaded MP4 instead. Editing or renaming the recording requires a fresh export before sharing.

## Undo deletion

After deletion, choose **Undo** in the brief message, or open **Settings → Recently deleted → Restore**. Deleted takes are kept for 30 days in the same browser storage, including their edits. Expired takes are removed when Memos opens. Clearing browser storage also clears recently deleted recordings.

## Back up and restore the library

Choose **Settings → Back up all** to download a `.memos` file containing the current library's original audio, names, and edit settings. Recently deleted recordings are excluded. The file is not encrypted; keep it somewhere safe.

Use **Restore backup** in another browser or on another device to add missing recordings. Existing IDs are left untouched, including recordings in Recently deleted. Restore never replaces the current library. Invalid archives and files over 512 MB are rejected. If a library exceeds that limit, export recordings individually.

## Offline and home-screen use

Opening Memos online prepares the app for offline use. **Settings → Download offline exporter** also saves the converter (about 32 MB), so edited and non-MP4 recordings can be exported without a connection. The download can be cancelled and retried. Settings confirms when the app and exporter are ready. Browser storage eviction can still remove offline files or recordings.

Use **Install Memos** when offered, your browser's installation menu, or **Share → Add to Home Screen** on iPhone. Installation availability depends on the browser. Keep Memos open while recording: screen wake support is requested where available, but phone interruptions and background restrictions can still stop capture.

When a new app version is available, close all Memos tabs/windows and reopen to activate the update. Installation does not provide a cloud backup.

## Storage and recovery

Recordings belong to this browser and website address. Audio is not uploaded and there is no cloud backup. Export important recordings before clearing browser data or changing browsers or devices. Private browsing cleanup and storage eviction can also remove saved takes.

While recording, Memos saves incoming chunks as the browser delivers them, normally about once per second. Saved chunks can be recovered after an interrupted session. The final unsaved moments may be missing, especially if a phone locks or the browser delays recording events.

Recovery requires browser support for IndexedDB and Web Locks. Memos shows a warning if recovery or saving is unavailable. Keep the tab open and export the take if it could not be saved.

## If something goes wrong

| Situation | Try this |
| --- | --- |
| Microphone access is blocked | Allow access in the browser's site settings, then try again |
| An input is missing | Reconnect it, refresh the microphone list, and select it again |
| A recording could not be saved | Keep the tab open and export it before leaving |
| Processing takes too long | Cancel and retry; for a long recording, try a desktop browser |
| Recordings seem to be missing | Check that you are using the same browser and website address |

[Back to the README](../README.md)
