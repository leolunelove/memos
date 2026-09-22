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

## Add a voice effect

Effects apply after recording and are included in playback and export.

| Effect | Sound |
| --- | --- |
| Original | No voice effect; any applied trim remains |
| Light tune | Gently nudges voiced notes toward the nearest musical semitone |
| Deep voice | Lowers pitch while keeping the timing |
| Soft echo | Adds a short, soft delay tail |

Light tune works best on a single sung voice and provides gentle correction. Choose **Original** to remove an effect. Each recording remembers its selected effect.

Processing shows its current stage. Choose **Cancel** to stop a slow effect or export; the saved recording remains available.

## Export a recording

Select the take and choose **Export MP4**. The downloaded file contains audio only, with the applied trim and effect. Its filename follows the recording name and includes the effect name when one is selected.

Browsers that record MP4 can export the original directly. Other recordings and edited audio use a local converter, which loads on first use. Long recordings can take more time and memory to convert.

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
