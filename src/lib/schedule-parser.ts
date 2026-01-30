export interface ParsedSchedule {
    date: Date;
    time: string;
    title: string;
    organizer?: string;
    highlightLevel: 0 | 1 | 2 | 3; // 0=none, 1=대표/이청(blue), 2=사업부/이주형(green), 3=센터/정성욱(purple)
}

// Keywords that trigger left border color highlight
// Level 1 (blue): 대표, 이청
// Level 2 (green): 사업부, 이주형
// Level 3 (purple): 센터, 정성욱
const HIGHLIGHT_LEVEL1 = { brackets: ['대표'], organizers: ['이청'] };
const HIGHLIGHT_LEVEL2 = { brackets: ['사업부'], organizers: ['이주형'] };
const HIGHLIGHT_LEVEL3 = { brackets: ['센터'], organizers: ['정성욱'] };

export const parseScheduleText = (text: string, currentYear: number, currentMonth: number): ParsedSchedule[] => {
    // Split lines and clean up, removing empty lines
    const lines = text.split('\n').map(line => line.trim()).filter(line => line.length > 0);
    const schedules: ParsedSchedule[] = [];

    // Track date parsing context
    let parsingYear = currentYear;
    let parsingMonth = currentMonth;
    let lastParsedDay = 0;

    let currentDate: Date | null = null;
    let currentTime: string | null = null;

    // Regex patterns
    // Date: "01 Thu", "26 Mon" (Start of line, 1 or 2 digits, space, 3 letter day)
    const dateRegex = /^(\d{1,2})\s+([A-Za-z]{3})/;
    // Time: "09:00 - 10:00" or "종일"
    const timeRegex = /^(\d{2}:\d{2})\s*-\s*\d{2}:\d{2}|^종일/;
    // Bracket pattern: [XXX] at the start of title
    const bracketRegex = /^\[([^\]]+)\]\s*/;

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];

        // 1. Check for Date
        const dateMatch = line.match(dateRegex);
        if (dateMatch) {
            const day = parseInt(dateMatch[1], 10);
            const dayStr = dateMatch[2]; // e.g., "Sun", "Mon"

            // Initial Month Auto-Detection Logic
            // If this is the first date being parsed, check if the day-of-week matches the current month.
            // If not, and it matches the next month, assume the user is importing next month's schedule.
            if (lastParsedDay === 0 && schedules.length === 0) {
                const weekDays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

                // Check current month
                const tempDateCurrent = new Date(currentYear, currentMonth, day);
                const currentMonthDayStr = weekDays[tempDateCurrent.getDay()];

                // Check next month
                let nextMonthYear = currentYear;
                let nextMonth = currentMonth + 1;
                if (nextMonth > 11) {
                    nextMonth = 0;
                    nextMonthYear++;
                }
                const tempDateNext = new Date(nextMonthYear, nextMonth, day);
                const nextMonthDayStr = weekDays[tempDateNext.getDay()];

                // If input day string matches next month but NOT current month, switch parsing context to next month
                if (dayStr.toLowerCase() === nextMonthDayStr.toLowerCase() &&
                    dayStr.toLowerCase() !== currentMonthDayStr.toLowerCase()) {
                    parsingMonth = nextMonth;
                    parsingYear = nextMonthYear;
                }
            }

            // Detect month transition: if logic flows from e.g. 30, 31 -> 01, 02
            // If the new day is significantly smaller than the last parsed day (e.g. 31 -> 1),
            // assume we've moved to the next month.
            if (lastParsedDay > 20 && day < 10) {
                parsingMonth++;
                if (parsingMonth > 11) {
                    parsingMonth = 0;
                    parsingYear++;
                }
            }
            lastParsedDay = day;

            // Create date object (Month is 0-indexed)
            currentDate = new Date(parsingYear, parsingMonth, day);
            continue;
        }

        // 2. Check for Time
        const timeMatch = line.match(timeRegex);
        if (timeMatch && currentDate) {
            currentTime = timeMatch[0]; // Extract full time string "09:00 - 10:00" or "종일"

            // The NEXT non-empty line should be the title
            if (i + 1 < lines.length) {
                const titleLine = lines[i + 1];

                // Ensure the next line isn't another date or time
                if (!titleLine.match(dateRegex) && !titleLine.match(timeRegex)) {
                    let displayTitle = titleLine;
                    let highlightLevel: 0 | 1 | 2 | 3 = 0;

                    // Check for [XXX] pattern and extract bracket content
                    const bracketMatch = titleLine.match(bracketRegex);
                    if (bracketMatch) {
                        const bracketContent = bracketMatch[1];
                        // Remove [XXX] from display title
                        displayTitle = titleLine.replace(bracketRegex, '').trim();

                        // Check if bracket content matches highlight keywords
                        if (HIGHLIGHT_LEVEL1.brackets.some((keyword: string) => bracketContent.includes(keyword))) {
                            highlightLevel = 1;
                        } else if (HIGHLIGHT_LEVEL2.brackets.some((keyword: string) => bracketContent.includes(keyword))) {
                            highlightLevel = 2;
                        } else if (HIGHLIGHT_LEVEL3.brackets.some((keyword: string) => bracketContent.includes(keyword))) {
                            highlightLevel = 3;
                        }
                    }

                    // Check organizer (line after title)
                    let organizerInfo = '';
                    if (i + 2 < lines.length) {
                        const organizerLine = lines[i + 2];
                        // Ensure it's not a date/time line
                        if (!organizerLine.match(dateRegex) && !organizerLine.match(timeRegex)) {
                            organizerInfo = organizerLine;

                            // Highlight Logic based on Organizer Name
                            if (highlightLevel === 0) {
                                const organizerName = organizerLine.split('/')[0].trim();
                                if (HIGHLIGHT_LEVEL1.organizers.includes(organizerName)) {
                                    highlightLevel = 1;
                                } else if (HIGHLIGHT_LEVEL2.organizers.includes(organizerName)) {
                                    highlightLevel = 2;
                                } else if (HIGHLIGHT_LEVEL3.organizers.includes(organizerName)) {
                                    highlightLevel = 3;
                                }
                            }
                        }
                    }

                    schedules.push({
                        date: currentDate,
                        time: currentTime,
                        title: displayTitle,
                        organizer: organizerInfo,
                        highlightLevel
                    });
                    // Skip the title line to avoid processing it again
                    i++;
                }
            }
            continue;
        }
    }

    return schedules;
};
