document.addEventListener('DOMContentLoaded', () => {
    const saveBtn = document.getElementById('saveBtn');
    const noteInput = document.getElementById('noteInput');
    const bookmarksList = document.getElementById('bookmarksList');
    const emptyState = document.getElementById('emptyState');
    const sortByDateBtn = document.getElementById('sortByDate');
    const sortByTitleBtn = document.getElementById('sortByTitle');
    const toast = document.getElementById('toast');

    let currentSort = 'date'; // 'date' or 'title'

    // Load bookmarks when popup opens
    loadBookmarks();

    // Save button click handler
    saveBtn.addEventListener('click', async () => {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        
        chrome.scripting.executeScript(
            {
                target: { tabId: tab.id },
                function: getTimestamp,
            },
            (results) => {
                if (results && results[0]) {
                    const bookmark = {
                        title: results[0].result.title,
                        url: tab.url,
                        timestamp: results[0].result.timestamp,
                        note: noteInput.value.trim(),
                        date: new Date().toISOString()
                    };

                    chrome.storage.local.get(['bookmarks'], (result) => {
                        const bookmarks = result.bookmarks || [];
                        bookmarks.push(bookmark);
                        chrome.storage.local.set({ bookmarks }, () => {
                            loadBookmarks();
                            noteInput.value = '';
                            showToast('Bookmark saved successfully!');
                        });
                    });
                } else {
                    showToast('No video found on this page!', 'error');
                }
            }
        );
    });

    // Sort buttons click handlers
    sortByDateBtn.addEventListener('click', () => {
        currentSort = 'date';
        loadBookmarks();
    });

    sortByTitleBtn.addEventListener('click', () => {
        currentSort = 'title';
        loadBookmarks();
    });

    // Event delegation for bookmark actions
    bookmarksList.addEventListener('click', (e) => {
        const target = e.target;
        const bookmarkItem = target.closest('.bookmark-item');
        if (!bookmarkItem) return;

        const actionBtn = target.closest('.action-btn');
        if (!actionBtn) return;

        const bookmarkData = {
            url: bookmarkItem.dataset.url,
            timestamp: parseInt(bookmarkItem.dataset.timestamp),
            date: bookmarkItem.dataset.date
        };

        if (actionBtn.title === 'Jump to timestamp') {
            jumpToTimestamp(bookmarkData.url, bookmarkData.timestamp);
        } else if (actionBtn.title === 'Delete bookmark') {
            deleteBookmark(bookmarkData.date);
        }
    });

    function getTimestamp() {
        const video = document.querySelector('video');
        if (!video) return null;
        
        const currentTime = Math.floor(video.currentTime);
        const videoTitle = document.title;
        return { title: videoTitle, timestamp: currentTime };
    }

    function loadBookmarks() {
        chrome.storage.local.get(['bookmarks'], (result) => {
            const bookmarks = result.bookmarks || [];
            
            if (bookmarks.length === 0) {
                emptyState.style.display = 'block';
                bookmarksList.style.display = 'none';
                return;
            }

            emptyState.style.display = 'none';
            bookmarksList.style.display = 'block';

            // Sort bookmarks
            const sortedBookmarks = [...bookmarks].sort((a, b) => {
                if (currentSort === 'date') {
                    return new Date(b.date) - new Date(a.date);
                } else {
                    return a.title.localeCompare(b.title);
                }
            });
            
            bookmarksList.innerHTML = sortedBookmarks
                .map(bookmark => `
                    <div class="bookmark-item" 
                         data-url="${escapeHtml(bookmark.url)}"
                         data-timestamp="${bookmark.timestamp}"
                         data-date="${bookmark.date}">
                        <div class="bookmark-info">
                            <div class="bookmark-title">${escapeHtml(bookmark.title)}</div>
                            <div class="bookmark-time">${formatTime(bookmark.timestamp)}</div>
                            ${bookmark.note ? `<div class="bookmark-note">${escapeHtml(bookmark.note)}</div>` : ''}
                        </div>
                        <div class="bookmark-actions">
                            <button class="action-btn" title="Jump to timestamp">
                                <i class="fas fa-play"></i>
                            </button>
                            <button class="action-btn" title="Delete bookmark">
                                <i class="fas fa-trash"></i>
                            </button>
                        </div>
                    </div>
                `).join('');
        });
    }

    function escapeHtml(unsafe) {
        return unsafe
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }

    function formatTime(seconds) {
        const hours = Math.floor(seconds / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);
        const remainingSeconds = Math.floor(seconds % 60);
        
        if (hours > 0) {
            return `${hours}:${padZero(minutes)}:${padZero(remainingSeconds)}`;
        }
        return `${minutes}:${padZero(remainingSeconds)}`;
    }

    function padZero(num) {
        return num.toString().padStart(2, '0');
    }

    function showToast(message, type = 'success') {
        toast.textContent = message;
        toast.style.backgroundColor = type === 'success' ? '#2ecc71' : '#e74c3c';
        toast.classList.add('show');
        
        setTimeout(() => {
            toast.classList.remove('show');
        }, 3000);
    }

    async function jumpToTimestamp(url, timestamp) {
        try {
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
            
            if (tab.url === url) {
                // If we're on the same page, try to seek directly
                try {
                    // First, ensure content script is injected
                    await chrome.scripting.executeScript({
                        target: { tabId: tab.id },
                        files: ['content.js']
                    });

                    // Wait a bit for the content script to initialize
                    await new Promise(resolve => setTimeout(resolve, 100));

                    const response = await chrome.tabs.sendMessage(tab.id, { 
                        action: 'seekTo', 
                        timestamp: timestamp 
                    });
                    
                    if (!response || !response.success) {
                        console.log('Direct seeking failed, falling back to URL method');
                        openInNewTab(url, timestamp);
                    }
                } catch (error) {
                    console.error('Error with direct seeking:', error);
                    openInNewTab(url, timestamp);
                }
            } else {
                // If we're on a different page, open in new tab
                openInNewTab(url, timestamp);
            }
        } catch (error) {
            console.error('Error seeking to timestamp:', error);
            openInNewTab(url, timestamp);
        }
    }

    function openInNewTab(url, timestamp) {
        // Add timestamp to URL if it's not already there
        const urlWithTimestamp = url.includes('?') 
            ? `${url}&t=${timestamp}`
            : `${url}?t=${timestamp}`;

        chrome.tabs.create({ url: urlWithTimestamp }, (newTab) => {
            // Wait for the page to load and then inject the content script
            chrome.tabs.onUpdated.addListener(function listener(tabId, info) {
                if (tabId === newTab.id && info.status === 'complete') {
                    // Inject content script
                    chrome.scripting.executeScript({
                        target: { tabId: newTab.id },
                        files: ['content.js']
                    }).then(() => {
                        // Wait a bit for the content script to initialize
                        setTimeout(() => {
                            chrome.tabs.sendMessage(newTab.id, { 
                                action: 'seekTo', 
                                timestamp: timestamp 
                            });
                        }, 100);
                    }).catch(error => {
                        console.error('Error injecting content script:', error);
                    });
                    
                    chrome.tabs.onUpdated.removeListener(listener);
                }
            });
        });
    }

    function deleteBookmark(date) {
        try {
            chrome.storage.local.get(['bookmarks'], (result) => {
                const bookmarks = result.bookmarks || [];
                const bookmarkIndex = bookmarks.findIndex(b => b.date === date);
                
                if (bookmarkIndex === -1) {
                    showToast('Bookmark not found!', 'error');
                    return;
                }

                bookmarks.splice(bookmarkIndex, 1);
                chrome.storage.local.set({ bookmarks }, () => {
                    if (chrome.runtime.lastError) {
                        showToast('Error deleting bookmark!', 'error');
                        return;
                    }
                    loadBookmarks();
                    showToast('Bookmark deleted successfully!');
                });
            });
        } catch (error) {
            console.error('Error deleting bookmark:', error);
            showToast('Error deleting bookmark!', 'error');
        }
    }
});
  