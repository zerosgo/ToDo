// content-todo.js
console.log('ToDo Syncer: Localhost Content Script Loaded');

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'SYNC_DATA') {
        console.log('ToDo Syncer: Received data from extension, relaying to page...');

        // Post message to window so React app can hear it
        window.postMessage({
            type: 'SCHEDULE_SYNC',
            text: request.text,
            year: request.year,
            month: request.month
        }, '*');

        sendResponse({ status: 'relayed' });
    }
});
