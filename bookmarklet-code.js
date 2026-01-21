javascript: (function () {
    /* ToDo Plan B Bookmarklet (Popup Version) */
    console.log("ToDo Bookmarklet: Starting...");

    const TARGET_ORIGIN = "http://localhost:3000";
    const wait = (ms) => new Promise(resolve => setTimeout(resolve, ms));

    async function run() {
        try {
            /* 1. Click Confirmation Button */
            let confirmBtn = null;
            const allElements = document.querySelectorAll('button, a, input[type="button"], input[type="submit"], div[role="button"], span');
            for (const el of allElements) {
                const txt = (el.value || el.textContent || '').trim();
                if (txt.includes('Yonghee') || txt.includes('이용희')) {
                    confirmBtn = el;
                    break;
                }
            }

            if (confirmBtn) {
                confirmBtn.click();
                await wait(3000);
            }

            /* 2. Click Agenda */
            let agendaBtn = null;
            const candidates = document.querySelectorAll('a, button, span, div[role="button"]');
            for (const el of candidates) {
                if (el.textContent.trim() === 'Agenda') {
                    agendaBtn = el;
                    break;
                }
            }

            if (agendaBtn) {
                agendaBtn.click();
                await wait(2000);
            }

            /* 3. Scrape */
            const allText = document.body.innerText;
            if (!allText || allText.length < 50) {
                alert("일정을 찾을 수 없습니다. (텍스트가 너무 짧음)");
                return;
            }

            let year, month;
            const dateMatch = allText.match(/(\d{4})[\.\- ]+(\d{1,2})/);
            if (dateMatch) {
                year = parseInt(dateMatch[1]);
                month = parseInt(dateMatch[2]) - 1;
            }

            /* 4. Open Popup and Send */
            /* Using a named window to reuse it if possible */
            const popup = window.open(TARGET_ORIGIN, 'todo_sync_popup', 'width=600,height=600');

            if (!popup) {
                alert("팝업 차단을 해제해주세요! ToDo 앱으로 데이터를 보내기 위해 팝업이 필요합니다.");
                return;
            }

            /* Wait a bit for the popup to potentially load/initialize */
            setTimeout(() => {
                popup.postMessage({
                    type: 'SCHEDULE_SYNC',
                    text: allText,
                    year: year,
                    month: month
                }, TARGET_ORIGIN);

                /* Optional: Check if successful? We can't verify easily back from popup */
                console.log("Data sent to popup");
            }, 2000); // 2 seconds wait for react app to load

        } catch (e) {
            alert("오류: " + e.message);
        }
    }

    run();
})();
