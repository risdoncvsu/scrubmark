# ScrubMark Chrome / Edge Extension (Manifest V3)

This browser extension allows you to screenshot any active YouTube or Google Drive video at the exact millisecond timecode and send it directly to ScrubMark with **zero CORS or cross-origin iframe canvas restrictions**.

## Why this solves the screenshot problem completely:
Web pages cannot directly extract pixels from third-party cross-origin iframes (like YouTube or Google Drive) due to browser Same-Origin Policy (SOP).
A browser extension operates with elevated permissions (`activeTab` and `chrome.tabs.captureVisibleTab`), which allows capturing the exact rendered video pixels in 4K/1080p directly from the display buffer.

## How to Install in Chrome, Edge, or Brave:
1. Open your browser and navigate to:
   - **Chrome**: `chrome://extensions`
   - **Edge**: `edge://extensions`
   - **Brave**: `brave://extensions`
2. Enable **Developer mode** (toggle in the top-right corner).
3. Click the **Load unpacked** button in the top-left corner.
4. Select the `extension` folder located inside this project directory.
5. That's it! The ScrubMark icon will now appear in your browser toolbar.

## Features:
- **Floating Button**: Automatically injects a discreet "📸 Annotate Frame" pill at the bottom right of any YouTube or Google Drive video.
- **Keyboard Shortcut**: Press `Alt + S` at any moment while watching a video to freeze the frame, capture it at full display resolution, copy it to your system clipboard, and launch ScrubMark!
- **Auto-Cropping**: Automatically crops to the video bounds so you don't get the surrounding webpage chrome.
