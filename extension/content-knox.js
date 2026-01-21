// content-knox.js
console.log('ToDo Syncer: Knox Content Script Loaded (Smart Mode)');

// Helper to find button by text
function findButtonByText(texts) {
    const selector = 'button, a, input[type="button"], input[type="submit"], div[role="button"], span';
    const elements = document.querySelectorAll(selector);
    for (const el of elements) {
        // Skip hidden elements if possible, but simplest check is text
        const txt = (el.value || el.textContent || '').trim();
        for (const target of texts) {
            if (txt.includes(target)) {
                return el;
            }
        }
    }
    return null;
}

let hasClickedAgenda = false;

// Main Monitoring Loop
// We check every 1 second for the buttons.
const monitorInterval = setInterval(() => {
    // If we already finished clicking Agenda, stop monitoring buttons (wait for scrape)
    if (hasClickedAgenda) {
        clearInterval(monitorInterval);
        return;
    }

    // 1. Prioritize: Confirmation Button ("Yonghee", "이용희")
    // We check this first. If it appears, we click it.
    // NOTE: If Agenda is ALREADY visible, maybe we don't need to click confirmation? 
    // But usually confirmation blocks Agenda. So simple priority is fine.

    // Check if Agenda is already visible (Fast path)
    const agendaBtn = findButtonByText(['Agenda']);

    // Check for Confirmation
    const confirmBtn = findButtonByText(['Yonghee', '이용희']);

    if (confirmBtn) {
        console.log('ToDo Syncer: Found Confirmation button, Clicking...');
        confirmBtn.click();
        // We don't stop here, we just clicked. Next loop will check again.
        // It might take time for popup to close.
        return;
    }

    // 2. If no confirmation needing click, check Agenda
    if (agendaBtn) {
        console.log('ToDo Syncer: Found Agenda button, Clicking...');
        agendaBtn.click();
        hasClickedAgenda = true;

        // Wait for data to load, then scrape
        setTimeout(scrapeAndSend, 2500);
    }

    // If neither is found, we just wait for the next tick. 
    // This allows the user to manually navigate or login, and the bot will react when buttons appear.

}, 1000); // Check every 1 second


function scrapeAndSend() {
    try {
        console.log('ToDo Syncer: Scraping data...');
        const allText = document.body.innerText;

        // Parse Year/Month
        let year, month;
        const dateMatch = document.body.innerText.match(/(\d{4})[\.\- ]+(\d{1,2})/);
        if (dateMatch) {
            year = parseInt(dateMatch[1]);
            month = parseInt(dateMatch[2]) - 1;
        }

        console.log('ToDo Syncer: Sending ' + allText.length + ' chars to background.');

        chrome.runtime.sendMessage({
            action: 'DATA_SCRAPED',
            text: allText,
            year: year,
            month: month
        });

    } catch (e) {
        console.error('ToDo Syncer Error:', e);
    }
}
