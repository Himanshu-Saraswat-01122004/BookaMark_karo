chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.type === "getTimestamp") {
      const video = document.querySelector("video");
      if (video) {
        const currentTime = Math.floor(video.currentTime);
        const videoTitle = document.title;
        sendResponse({
          title: videoTitle,
          timestamp: currentTime
        });
      }
    }
  });
  