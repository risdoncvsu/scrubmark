// ScrubMark Content Script for YouTube and Google Drive
// Directly captures video frame at active playhead timestamp

(function () {
  if (window.__scrubmark_injected) return;
  window.__scrubmark_injected = true;

  function findVideoElement() {
    return document.querySelector('video');
  }

  function formatTime(seconds) {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  }

  function showToast(msg) {
    const toast = document.createElement('div');
    toast.className = 'scrubmark-toast';
    toast.textContent = msg;
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 3200);
  }

  async function captureActiveFrame() {
    const video = findVideoElement();
    const currentTime = video ? Math.floor(video.currentTime) : 0;
    if (video) video.pause();

    // Ask extension background script to capture the tab (bypassing CORS completely)
    chrome.runtime.sendMessage({ action: 'CAPTURE_TAB' }, async (response) => {
      if (!response || !response.success || !response.dataUrl) {
        showToast('❌ Capture failed: ' + (response?.error || 'Unknown error'));
        return;
      }

      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = 1280;
        canvas.height = 720;
        const ctx = canvas.getContext('2d');

        if (video) {
          const rect = video.getBoundingClientRect();
          const scaleX = img.naturalWidth / window.innerWidth;
          const scaleY = img.naturalHeight / window.innerHeight;

          const cropX = Math.max(0, rect.left * scaleX);
          const cropY = Math.max(0, rect.top * scaleY);
          const cropW = Math.min(img.naturalWidth - cropX, rect.width * scaleX);
          const cropH = Math.min(img.naturalHeight - cropY, rect.height * scaleY);

          ctx.fillStyle = '#000';
          ctx.fillRect(0, 0, 1280, 720);
          ctx.drawImage(img, cropX, cropY, cropW, cropH, 0, 0, 1280, 720);
        } else {
          ctx.drawImage(img, 0, 0, 1280, 720);
        }

        const croppedDataUrl = canvas.toDataURL('image/png');

        // Copy to system clipboard for instant Ctrl+V pasting anywhere
        canvas.toBlob((blob) => {
          if (blob && navigator.clipboard && navigator.clipboard.write) {
            navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]).catch(() => {});
          }
        });

        showToast(`✅ Frame captured at ${formatTime(currentTime)}! Copied to clipboard.`);

        // Notify extension to open ScrubMark review dashboard
        chrome.runtime.sendMessage({
          action: 'OPEN_SCRUBMARK',
          videoUrl: window.location.href,
          timestamp: currentTime,
          dataUrl: croppedDataUrl,
          title: document.title.replace(' - YouTube', '').trim()
        });
      };
      img.src = response.dataUrl;
    });
  }

  // Inject floating button into page
  function injectFloatingButton() {
    if (document.getElementById('scrubmark-capture-btn')) return;

    const btn = document.createElement('button');
    btn.id = 'scrubmark-capture-btn';
    btn.className = 'scrubmark-overlay-btn';
    btn.innerHTML = `
      <svg viewBox="0 0 24 24"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"></path><circle cx="12" cy="13" r="4"></circle></svg>
      <span>Annotate Frame (Alt+S)</span>
    `;
    btn.title = 'Instant frame screenshot & send to ScrubMark (Alt+S)';
    btn.addEventListener('click', captureActiveFrame);
    document.body.appendChild(btn);
  }

  // Keyboard shortcut: Alt+S
  window.addEventListener('keydown', (e) => {
    if (e.altKey && (e.key === 's' || e.key === 'S')) {
      e.preventDefault();
      captureActiveFrame();
    }
  });

  // Inject once DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', injectFloatingButton);
  } else {
    injectFloatingButton();
  }
})();
