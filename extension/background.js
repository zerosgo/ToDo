// background.js

// Listen for messages from content scripts
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'DATA_SCRAPED') {
        console.log('Received scraped data from Knox, looking for ToDo app tab...');

        // Find Localhost ToDo App Tab
        chrome.tabs.query({ url: 'http://localhost:3000/*' }, (tabs) => {
            if (tabs && tabs.length > 0) {
                // Send data to the first found ToDo tab
                const todoTab = tabs[0];
                chrome.tabs.sendMessage(todoTab.id, {
                    action: 'SYNC_DATA',
                    text: request.text,
                    year: request.year,
                    month: request.month
                }, (response) => {
                    console.log('Data sent to ToDo app');
                });

                // Optional: Notify user
                // chrome.notifications.create({ ... })
            } else {
                console.log('ToDo app is not open.');
                // Maybe open it?
                // chrome.tabs.create({ url: 'http://localhost:3000' });
            }
        });
    }
});
