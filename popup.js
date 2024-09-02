document.getElementById("saveBtn").addEventListener("click", () => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      chrome.scripting.executeScript(
        {
          target: { tabId: tabs[0].id },
          function: getTimestamp,
        },
        (results) => {
          if (results && results[0]) {
            const bookmark = {
              title: results[0].result.title,
              url: tabs[0].url,
              timestamp: results[0].result.timestamp
            };
            chrome.runtime.sendMessage(
              { type: "saveTimestamp", bookmark },
              (response) => {
                if (response.status === "success") {
                  displayBookmarks();
                }
              }
            );
          }
        }
      );
    });
  });
  
  function getTimestamp() {
    const video = document.querySelector("video");
    const currentTime = Math.floor(video.currentTime);
    const videoTitle = document.title;
    return { title: videoTitle, timestamp: currentTime };
  }
  
  function displayBookmarks() {
    chrome.runtime.sendMessage({ type: "getBookmarks" }, (bookmarks) => {
      const bookmarksList = document.getElementById("bookmarksList");
      bookmarksList.innerHTML = "";
      bookmarks.forEach((bookmark, index) => {
        const listItem = document.createElement("li");
  
        const link = document.createElement("a");
        link.href = "#";
        link.textContent = `${bookmark.title} - ${bookmark.timestamp}s`;
        link.addEventListener("click", () => {
          chrome.tabs.create({
            url: `${bookmark.url}&t=${bookmark.timestamp}`
          });
        });
  
        const removeButton = document.createElement("button");
        removeButton.textContent = "Remove";
        removeButton.addEventListener("click", () => {
          removeBookmark(index);
        });
  
        listItem.appendChild(link);
        listItem.appendChild(removeButton);
        bookmarksList.appendChild(listItem);
      });
    });
  }
  
  function removeBookmark(index) {
    chrome.runtime.sendMessage({ type: "getBookmarks" }, (bookmarks) => {
      bookmarks.splice(index, 1);
      chrome.storage.sync.set({ bookmarks }, () => {
        displayBookmarks();
      });
    });
  }
  
  document.addEventListener("DOMContentLoaded", displayBookmarks);
  