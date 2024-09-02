chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.type === "saveTimestamp") {
      chrome.storage.sync.get(["bookmarks"], (result) => {
        const bookmarks = result.bookmarks || [];
        bookmarks.push(request.bookmark);
        chrome.storage.sync.set({ bookmarks }, () => {
          sendResponse({ status: "success" });
        });
      });
      return true;
    } else if (request.type === "getBookmarks") {
      chrome.storage.sync.get(["bookmarks"], (result) => {
        sendResponse(result.bookmarks || []);
      });
      return true;
    }
  });
  