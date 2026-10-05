# ScrubMark DaVinci Resolve Studio Integration

This integration connects ScrubMark client feedback directly to Blackmagic DaVinci Resolve Studio timelines. It automatically reads client review notes, timestamps, and annotated drawings from ScrubMark and places color-coded timeline markers directly on your sequence.

## How it Works:
- Automatically reads sequence frame rate (e.g. 23.976, 24, 25, 29.97, 60 fps).
- Converts review note seconds into exact timeline frames.
- Places **Cyan markers** for frames with visual annotations and **Yellow markers** for text notes.
- Marker notes include client author names and feedback descriptions.

## Installation & Usage:

### Method 1: Run inside DaVinci Resolve (Recommended)
1. In DaVinci Resolve Studio, open **Workspace > Console** (or open the Python console).
2. Copy `scrubmark_resolve_sync.py` into your DaVinci scripts folder:
   - **macOS**: `~/Library/Application Support/Blackmagic Design/DaVinci Resolve/Fusion/Scripts/Utility/`
   - **Windows**: `%APPDATA%\Blackmagic Design\DaVinci Resolve\Support\Fusion\Scripts\Utility\`
   - **Linux**: `/opt/resolve/Fusion/Scripts/Utility/`
3. In DaVinci Resolve, go to **Workspace > Scripts > scrubmark_resolve_sync**.
4. Markers will instantly populate on your active timeline!

### Method 2: Terminal / Command Line
```bash
python3 scrubmark_resolve_sync.py <YOUR_VIDEO_ID>
```
