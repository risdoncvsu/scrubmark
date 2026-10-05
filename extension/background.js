// ScrubMark Background Service Worker (Manifest V3)
// Handles elevated tab capture, bypassing all CORS / iframe canvas pixel extraction limits.

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'CAPTURE_TAB') {
    chrome.tabs.captureVisibleTab(sender.tab?.windowId || null, { format: 'png' }, (dataUrl) => {
      if (chrome.runtime.lastError || !dataUrl) {
        sendResponse({ success: false, error: chrome.runtime.lastError?.message || 'Capture failed' });
      } else {
        sendResponse({ success: true, dataUrl });
      }
    });
    return true; // Keep message channel open for async response
  }

  if (request.action === 'OPEN_SCRUBMARK') {
    const { videoUrl, timestamp, dataUrl, title } = request;
    // Store captured frame in extension storage
    chrome.storage.local.set({
      latestCapture: {
        videoUrl,
        timestamp,
        dataUrl,
        title,
        capturedAt: Date.now()
      }
    }, () => {
      // Open or focus ScrubMark tab
      chrome.tabs.create({ url: 'http://localhost:3000' });
      sendResponse({ success: true });
    });
    return true;
  }
});
