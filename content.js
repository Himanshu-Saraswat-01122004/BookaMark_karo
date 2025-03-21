// Notify that content script is loaded
console.log('Bookmark Karo content script loaded');

// Listen for messages from the extension
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    console.log('Received message:', request);
    
    if (request.action === 'seekTo') {
        const video = document.querySelector('video');
        if (video) {
            video.currentTime = request.timestamp;
            console.log('Seeked to timestamp:', request.timestamp);
            sendResponse({ success: true });
        } else {
            console.log('No video element found');
            sendResponse({ success: false, error: 'No video found' });
        }
        return true; // Will respond asynchronously
    }
});
  