document.getElementById('captureBtn').addEventListener('click', async () => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (tab?.id) {
    chrome.tabs.sendMessage(tab.id, { action: 'TRIGGER_CAPTURE' }, (response) => {
      window.close();
    });
  }
});

document.getElementById('openAppBtn').addEventListener('click', () => {
  chrome.tabs.create({ url: 'http://localhost:3000' });
  window.close();
});
