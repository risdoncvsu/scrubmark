#!/usr/bin/env python3
"""
ScrubMark DaVinci Resolve Studio Timeline Sync Script
Automatically fetches client comments and timestamps from ScrubMark
and populates color-coded markers directly on the active timeline in DaVinci Resolve.
"""

import sys
import json
import urllib.request

def get_resolve():
    try:
        import DaVinciResolveScript as dvr
        return dvr.scriptapp("Resolve")
    except ImportError:
        print("[!] DaVinciResolveScript module not found. Run this from inside DaVinci Resolve or add to PYTHONPATH.")
        return None

def sync_scrubmark_notes_to_timeline(video_id, api_base="http://localhost:3000"):
    resolve = get_resolve()
    if not resolve:
        print("Could not connect to DaVinci Resolve.")
        return

    project_manager = resolve.GetProjectManager()
    project = project_manager.GetCurrentProject()
    if not project:
        print("No project is currently open in DaVinci Resolve.")
        return

    timeline = project.GetCurrentTimeline()
    if not timeline:
        print("No active timeline found in project.")
        return

    fps = float(timeline.GetSetting("timelineFrameRate") or 24.0)
    print(f"[+] Connected to timeline: '{timeline.GetName()}' at {fps} fps")

    # Fetch comments from ScrubMark API
    url = f"{api_base}/api/videos/{video_id}/comments"
    req = urllib.request.Request(url, headers={"x-user-id": "demo-user-1", "x-user-name": "Editor"})
    try:
        with urllib.request.urlopen(req) as res:
            comments = json.loads(res.read().decode())
    except Exception as e:
        print(f"[-] Failed to fetch comments from ScrubMark: {e}")
        return

    added = 0
    for comment in comments:
        sec = float(comment.get("timestamp_seconds", 0))
        frame = int(sec * fps)
        note = comment.get("content", "")
        author = comment.get("author_name", "Client")
        has_drawing = bool(comment.get("drawing_data"))

        color = "Cyan" if has_drawing else "Yellow"
        marker_name = f"ScrubMark: {author}" + (" [Annotated]" if has_drawing else "")
        
        # Add marker to timeline: frameId, color, name, note, duration
        success = timeline.AddMarker(frame, color, marker_name, note, 1)
        if success:
            added += 1
            print(f"  [✓] Added {color} marker at frame {frame} ({sec}s): {note[:40]}")

    print(f"\n[+] Successfully added {added} review markers to DaVinci Resolve timeline!")

if __name__ == "__main__":
    vid_id = sys.argv[1] if len(sys.argv) > 1 else ""
    if not vid_id:
        print("Usage: python3 scrubmark_resolve_sync.py <VIDEO_ID>")
    else:
        sync_scrubmark_notes_to_timeline(vid_id)
