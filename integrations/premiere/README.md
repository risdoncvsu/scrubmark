# ScrubMark Adobe Premiere Pro Extension (CEP Panel)

This panel allows video editors to sync timeline timecodes, export exact sequence frames, and import client review markers directly into the active Adobe Premiere Pro timeline.

## Installation in Adobe Premiere Pro:

### Step 1: Enable Unsigned Extensions (PlayerDebugMode)
Adobe Premiere requires setting a debug flag to run development panels:
- **macOS (Terminal)**:
  ```bash
  defaults write com.adobe.CSXS.9 PlayerDebugMode 1
  defaults write com.adobe.CSXS.10 PlayerDebugMode 1
  defaults write com.adobe.CSXS.11 PlayerDebugMode 1
  ```
- **Windows (Registry)**:
  Open `regedit`, navigate to `HKEY_CURRENT_USER\Software\Adobe\CSXS.9` (and `CSXS.10`, `CSXS.11`), and add a String value `PlayerDebugMode` with value `1`.

### Step 2: Copy Panel Folder to Adobe CEP Directory
Copy this `premiere` folder into Adobe's extensions directory:
- **macOS**:
  `~/Library/Application Support/Adobe/CEP/extensions/com.scrubmark.premiere`
- **Windows**:
  `C:\Program Files (x86)\Common Files\Adobe\CEP\extensions\com.scrubmark.premiere`

### Step 3: Open in Premiere Pro
1. Restart Premiere Pro.
2. In the top menu, go to **Window > Extensions > ScrubMark Review**.
3. The ScrubMark panel will dock anywhere in your workspace alongside your timeline and Program monitor!
