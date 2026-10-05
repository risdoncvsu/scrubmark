// ScrubMark ExtendScript for Adobe Premiere Pro
// Handles sequence timecode, frame export, and timeline markers

function getSequencePlayheadSeconds() {
  if (app.project && app.project.activeSequence) {
    var seq = app.project.activeSequence;
    var ticks = seq.getPlayerPosition().ticks;
    // Premiere ticks per second = 254016000000
    var seconds = ticks / 254016000000;
    return seconds.toFixed(2);
  }
  return "-1";
}

function exportCurrentFrameToTemp() {
  if (app.project && app.project.activeSequence) {
    var seq = app.project.activeSequence;
    var tempFolder = Folder.temp.fsName;
    var outPath = tempFolder + "/scrubmark_frame_" + Math.floor(new Date().getTime() / 1000) + ".png";
    var timeTicks = seq.getPlayerPosition().ticks;
    seq.exportFramePNG(timeTicks, outPath);
    return outPath;
  }
  return "";
}

function addSequenceMarker(seconds, commentText, authorName) {
  if (app.project && app.project.activeSequence) {
    var seq = app.project.activeSequence;
    var markers = seq.markers;
    var ticks = seconds * 254016000000;
    
    var newMarker = markers.createMarker(ticks);
    newMarker.name = "ScrubMark: " + (authorName || "Reviewer");
    newMarker.comments = commentText;
    // Set marker type to comment
    newMarker.setTypeAsComment();
    newMarker.setColorByIndex(1); // Red / Orange highlight
    return "true";
  }
  return "false";
}
