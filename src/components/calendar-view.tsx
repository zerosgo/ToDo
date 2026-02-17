"use client";

import React, { useState, useEffect } from 'react';
import {
    format,
    startOfMonth,
    endOfMonth,
    startOfWeek,
    endOfWeek,
    eachDayOfInterval,
    addMonths,
    subMonths,
    isSameMonth,
    isToday,
    isSameDay,
    addWeeks,
    addDays,
    getWeek,
    getMonth,
    getYear,
    parse,
    addHours,
    isWithinInterval
} from 'date-fns';
import { ko } from 'date-fns/locale';
import { Task, Category, BusinessTrip, TeamMember, TripRecord } from '@/lib/types';
import { getBusinessTrips, getTeamMembers, getTripRecords } from '@/lib/storage';
import { ChevronLeft, ChevronRight, GripVertical, Trash2, Paperclip, Plus, Search, Star, Plane, Palmtree, GraduationCap, Clock, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { TeamScheduleAddModal } from './team-schedule-add-modal';
import { TeamScheduleSearchModal } from './team-schedule-search-modal';
import { CalendarSettingsModal, CalendarSettings, DEFAULT_SETTINGS } from './calendar-settings-modal';
import { getHoliday } from '../lib/holidays';
import { Settings } from 'lucide-react';

interface CalendarViewProps {
    tasks: Task[];
    categories: Category[];
    currentMonth: Date;
    selectedDate?: Date;
    showWeekends: boolean;
    onShowWeekendsChange: (show: boolean) => void;
    onTaskClick: (task: Task) => void;
    onDateClick?: (date: Date) => void;
    onMonthChange: (date: Date) => void;
    onTaskDrop: (taskId: string, newDate: Date) => void;
    onTaskCopy: (taskId: string, newDate: Date) => void;
    onTaskDelete: () => void;
    onDataChange?: () => void;
}

export function CalendarView({
    tasks,
    categories,
    currentMonth,
    selectedDate,
    showWeekends,
    onShowWeekendsChange,
    onTaskClick,
    onDateClick,
    onMonthChange,
    onTaskDrop,
    onTaskCopy,
    onTaskDelete,
    onDataChange
}: CalendarViewProps) {
    const [draggedTaskId, setDraggedTaskId] = useState<string | null>(null);
    const [dropTargetDate, setDropTargetDate] = useState<Date | null>(null);
    const [deleteTaskToConfirm, setDeleteTaskToConfirm] = useState<Task | null>(null);
    const [currentTime, setCurrentTime] = useState(new Date());

    // Team schedule add modal state
    const [isTeamScheduleModalOpen, setIsTeamScheduleModalOpen] = useState(false);
    const [teamScheduleModalDate, setTeamScheduleModalDate] = useState<Date | undefined>(undefined);
    const [editingScheduleTask, setEditingScheduleTask] = useState<Task | null>(null);
    const [showOnlyTeamSchedule, setShowOnlyTeamSchedule] = useState(true);
    const [showOnlyExecutive, setShowOnlyExecutive] = useState(false);
    const [showCopyToast, setShowCopyToast] = useState(false);
    const [isSearchModalOpen, setIsSearchModalOpen] = useState(false);

    // Attendance badge state
    const [members, setMembers] = useState<TeamMember[]>([]);
    const [trips, setTrips] = useState<BusinessTrip[]>([]);
    const [tripRecords, setTripRecords] = useState<TripRecord[]>([]);
    const [attendanceModal, setAttendanceModal] = useState<'trip' | 'vacation' | 'education' | null>(null);

    // Load attendance data
    useEffect(() => {
        setMembers(getTeamMembers().filter(m => m.status !== '퇴직'));
        setTrips(getBusinessTrips());
        setTripRecords(getTripRecords());
    }, []);

    const handleCopyUrl = (url: string) => {
        navigator.clipboard.writeText(url);
        setShowCopyToast(true);
        setTimeout(() => setShowCopyToast(false), 2000);
    };

    // Ctrl+Click URL paste helper: returns true if URL was pasted
    const handleCtrlClickUrlPaste = async (task: Task): Promise<boolean> => {
        try {
            const clipboardText = await navigator.clipboard.readText();
            const trimmed = clipboardText.trim();

            // Check if clipboard contains a URL
            if (!trimmed.match(/^https?:\/\//i)) {
                return false; // Not a URL, proceed with normal click
            }

            const { updateTask } = await import('@/lib/storage');

            // Get existing URLs (support both legacy resourceUrl and resourceUrls array)
            const existingUrls = task.resourceUrls && task.resourceUrls.length > 0
                ? task.resourceUrls
                : (task.resourceUrl ? [task.resourceUrl] : []);

            if (existingUrls.length > 0 && existingUrls[0].trim()) {
                // Existing URL exists - ask user
                const choice = window.confirm(
                    `기존 자료 URL이 있습니다.\n\n기존: ${existingUrls.join(', ')}\n새로: ${trimmed}\n\n[확인] = 변경 (덮어쓰기)\n[취소] = 추가 (기존 URL 유지)`
                );

                if (choice) {
                    // Replace - set new URL as the only URL
                    updateTask(task.id, {
                        resourceUrl: trimmed,
                        resourceUrls: [trimmed]
                    });
                } else {
                    // Append - add new URL to array
                    const newUrls = [...existingUrls, trimmed];
                    updateTask(task.id, {
                        resourceUrl: existingUrls[0], // keep first URL as legacy
                        resourceUrls: newUrls
                    });
                }
            } else {
                // No existing URL - just save
                updateTask(task.id, {
                    resourceUrl: trimmed,
                    resourceUrls: [trimmed]
                });
            }

            onDataChange?.();
            setShowCopyToast(true);
            setTimeout(() => setShowCopyToast(false), 2000);
            return true;
        } catch (err) {
            console.error('클립보드 읽기 실패:', err);
            return false;
        }
    };

    // Get Team Schedule Category ID
    const teamScheduleCategoryId = categories.find(c => c.name === '팀 일정')?.id || '';

    // Calendar Settings
    const [settings, setSettings] = useState<CalendarSettings>(DEFAULT_SETTINGS);
    const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
    const [isSettingsLoaded, setIsSettingsLoaded] = useState(false);

    // Load settings from localStorage
    useEffect(() => {
        const saved = localStorage.getItem('calendar-settings');
        if (saved) {
            try {
                setSettings({ ...DEFAULT_SETTINGS, ...JSON.parse(saved) });
            } catch (e) {
                console.error('Failed to parse calendar settings', e);
            }
        }
        setIsSettingsLoaded(true);
    }, []);

    // Save settings to localStorage
    useEffect(() => {
        if (isSettingsLoaded) {
            localStorage.setItem('calendar-settings', JSON.stringify(settings));
        }
    }, [settings, isSettingsLoaded]);

    // Keyboard shortcut: Ctrl+Shift+Arrow to adjust item height (Update Settings)
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.ctrlKey && e.shiftKey) {
                if (e.key === 'ArrowUp') {
                    e.preventDefault();
                    setSettings(prev => ({ ...prev, itemHeightPercent: Math.min(60, prev.itemHeightPercent + 5) }));
                } else if (e.key === 'ArrowDown') {
                    e.preventDefault();
                    setSettings(prev => ({ ...prev, itemHeightPercent: Math.max(20, prev.itemHeightPercent - 5) }));
                }
            }

            // Search shortcut: Ctrl + /
            if ((e.ctrlKey || e.metaKey) && e.key === '/') {
                e.preventDefault();
                setIsSearchModalOpen(true);
            }

            // Month navigation shortcuts: Ctrl + ArrowLeft/ArrowRight
            if (e.ctrlKey || e.metaKey) {
                if (e.key === 'ArrowLeft') {
                    e.preventDefault();
                    onMonthChange(subMonths(currentMonth, 1));
                } else if (e.key === 'ArrowRight') {
                    e.preventDefault();
                    onMonthChange(addMonths(currentMonth, 1));
                }
            }

            // Ctrl+M: Toggle team schedule view (standalone check)
            if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'm') {
                e.preventDefault();
                setShowOnlyTeamSchedule(prev => !prev);
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [currentMonth, onMonthChange]); // Re-run effect if currentMonth or onMonthChange changes

    // Calculate actual height in pixels (base: 18px at 35%)
    const itemHeight = Math.round(18 * (settings.itemHeightPercent / 35));

    // Smart Update: Set timeout for the next significant event (Meeting Start or Meeting End)
    useEffect(() => {
        const updateTime = () => setCurrentTime(new Date());

        const now = new Date();

        // Find all "Team Schedule" tasks for today
        const scheduleCategory = categories.find(c => c.name === '팀 일정');
        const todaysSchedules = tasks.filter(t =>
            t.categoryId === scheduleCategory?.id &&
            t.dueDate &&
            isSameDay(new Date(t.dueDate), now) &&
            t.dueTime // Must have time
        );

        // Collect all significant time points (Start and End times)
        const timePoints: number[] = [];

        todaysSchedules.forEach(task => {
            if (!task.dueTime) return;
            try {
                // Try parse "HH:mm - HH:mm" first
                const rangeMatch = task.dueTime.match(/(\d{2}):(\d{2})\s*-\s*(\d{2}):(\d{2})/);
                let startTime = new Date(now);
                let endTime = new Date(now);

                if (rangeMatch) {
                    const [_, startH, startM, endH, endM] = rangeMatch;
                    startTime.setHours(parseInt(startH), parseInt(startM), 0, 0);
                    endTime.setHours(parseInt(endH), parseInt(endM), 0, 0);

                    // Handle case where end time is next day (e.g. 23:00 - 01:00)
                    if (endTime < startTime) {
                        endTime = addDays(endTime, 1);
                    }
                } else {
                    // Fallback to single time "HH:mm" + 1 hour
                    const timeMatch = task.dueTime.match(/(\d{2}):(\d{2})/);
                    if (!timeMatch) return;

                    const [_, hours, minutes] = timeMatch;
                    startTime.setHours(parseInt(hours), parseInt(minutes), 0, 0);
                    endTime = addHours(startTime, 1);
                }

                // Check points in the future
                if (startTime > now) timePoints.push(startTime.getTime());
                if (endTime > now) timePoints.push(endTime.getTime());
            } catch (e) {
                // Ignore parsing errors
            }
        });

        // Sort and pick the earliest future time
        timePoints.sort((a, b) => a - b);

        let nextUpdateDelay = 60 * 60 * 1000; // Default: re-check in 1 hour if nothing found

        if (timePoints.length > 0) {
            nextUpdateDelay = timePoints[0] - now.getTime();
        }

        // Cap minimum delay to avoid rapid loops (e.g. 1 second)
        const timeoutId = setTimeout(() => {
            updateTime();
        }, nextUpdateDelay);

        return () => clearTimeout(timeoutId);
    }, [tasks, categories, currentTime]); // Re-calc when tasks change or after time update

    const getTasksForDate = (date: Date) => {
        return tasks.filter(task => {
            if (!task.dueDate) return false;
            return isSameDay(new Date(task.dueDate), date);
        });
    };

    const getTaskColor = (task: Task): string => {
        const category = categories.find(c => c.id === task.categoryId);
        return category?.color || '#3b82f6';
    };

    // Check if a meeting is currently active (Start Time <= Now < End Time)
    const isMeetingActive = (task: Task) => {
        if (!task.dueTime || !task.dueDate) return false;

        try {
            const meetingDate = new Date(task.dueDate);
            // Verify it's the same day first (ignoring time for date comparison)
            if (!isSameDay(meetingDate, currentTime)) return false;

            let startTime = new Date(meetingDate);
            let endTime = new Date(meetingDate);

            // Try parse "HH:mm - HH:mm" first
            const rangeMatch = task.dueTime.match(/(\d{2}):(\d{2})\s*-\s*(\d{2}):(\d{2})/);

            if (rangeMatch) {
                const [_, startH, startM, endH, endM] = rangeMatch;
                startTime.setHours(parseInt(startH), parseInt(startM), 0, 0);
                endTime.setHours(parseInt(endH), parseInt(endM), 0, 0);

                // Handle cross-day (e.g. 23:00 - 00:30)
                // Note: The meetingDate is based on the task's due date.
                // If endTime < startTime, assume it ends the next day.
                if (endTime < startTime) {
                    endTime = addDays(endTime, 1);
                }
            } else {
                // Fallback to single time "HH:mm" + 1 hour
                const timeMatch = task.dueTime.match(/(\d{2}):(\d{2})/);
                if (!timeMatch) return false;

                const [_, hours, minutes] = timeMatch;
                startTime.setHours(parseInt(hours), parseInt(minutes), 0, 0);
                endTime = addHours(startTime, 1);
            }

            // Exclusive end check: start <= now < end
            // isWithinInterval is inclusive [start, end].
            // We want [start, end).
            // Manually check to be precise.
            return currentTime >= startTime && currentTime < endTime;
        } catch (e) {
            return false;
        }
    };

    const handleDragStart = (e: React.DragEvent, taskId: string) => {
        setDraggedTaskId(taskId);
        e.dataTransfer.setData('text/plain', taskId);
        e.dataTransfer.effectAllowed = e.ctrlKey ? 'copy' : 'move';
    };

    const handleDragOver = (e: React.DragEvent, date: Date) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = e.ctrlKey ? 'copy' : 'move';
        setDropTargetDate(date);
    };

    const handleDragLeave = () => {
        setDropTargetDate(null);
    };

    const handleDrop = (e: React.DragEvent, date: Date) => {
        e.preventDefault();
        const taskId = e.dataTransfer.getData('text/plain');
        if (taskId) {
            if (e.ctrlKey) {
                onTaskCopy(taskId, date);
            } else {
                onTaskDrop(taskId, date);
            }
        }
        setDropTargetDate(null);
        setDraggedTaskId(null);
    };

    const handleTaskDrop = async (e: React.DragEvent, targetTask: Task) => {
        e.preventDefault();
        e.stopPropagation();

        const noteId = e.dataTransfer.getData('note-id');
        if (!noteId) return;

        // Import storage dynamically
        const { getNotes, updateTask, deleteNote } = await import('@/lib/storage');
        const notes = getNotes();
        const note = notes.find(n => n.id === noteId);

        if (note) {
            // Confirm merge
            if (window.confirm(`'${note.title || '메모'}' 내용을 '${targetTask.title}' 일정에 병합하시겠습니까?\n\n(병합 후 원본 메모는 삭제됩니다)`)) {

                // Helper to strip HTML
                // Helper to strip HTML with newline preservation
                const stripHtml = (html: string) => {
                    const withNewlines = html.replace(/<\/?(div|p|br|li)[^>]*>/gi, '\n');
                    try {
                        const doc = new DOMParser().parseFromString(withNewlines, 'text/html');
                        return doc.body.textContent || "";
                    } catch (e) {
                        return withNewlines.replace(/<[^>]*>?/gm, ''); // Fallback
                    }
                };

                // Combine title and content for extraction (handles both old and new backup formats)
                // Old format: content was empty, everything was in title
                // New format: title is short, content has the data
                const rawText = (note.title || '') + '\n' + (note.content || '');
                const cleanContent = stripHtml(rawText);

                // Extract URL (prioritize backup format, then generic URL)
                let newUrl = targetTask.resourceUrl;
                if (!newUrl) {
                    // First try backup format: 🔗 자료: URL
                    const backupUrlMatch = cleanContent.match(/🔗\s*자료:\s*(https?:\/\/[^\s"'>]+)/);
                    if (backupUrlMatch) {
                        newUrl = backupUrlMatch[1];
                    } else {
                        // Fallback to generic URL extraction
                        const urlRegex = /(https?:\/\/[^\s"'>]+)/g;
                        const matches = cleanContent.match(urlRegex);
                        if (matches && matches.length > 0) {
                            newUrl = matches[0];
                        }
                    }
                }

                // Append content to notes (preserve original HTML formatting if possible, or just text)
                // For simplicity and safety, we append raw HTML from note, assuming Task notes support it or it's plain text.
                // If Task notes are plain text, we should use cleanContent.
                // Assuming Task.notes is string (often plain text or Markdown-like).
                // Let's use cleanContent to avoid messy HTML in task notes.
                const newNotes = (targetTask.notes ? targetTask.notes + '\n\n' : '') +
                    '--- [Imported Note] ---\n' +
                    cleanContent;

                // Extract Tags
                let newTags = targetTask.tags || [];
                const tagMatch = cleanContent.match(/🏷️ 태그: (.*)/);
                if (tagMatch) {
                    const extractedTags = tagMatch[1].split(',').map(t => t.trim()).filter(t => t);
                    newTags = Array.from(new Set([...newTags, ...extractedTags]));
                }

                // Update Task
                const result = updateTask(targetTask.id, {
                    notes: newNotes,
                    resourceUrl: newUrl,
                    tags: newTags
                });

                if (result) {
                    // Delete the dropped note (Move operation)
                    deleteNote(noteId);

                    // Small delay to ensure localStorage is synced, then trigger refresh
                    setTimeout(() => {
                        onDataChange?.();
                    }, 50);

                    // Brief success feedback (optional, can be removed if too intrusive)
                    // alert('병합 완료!');
                } else {
                    alert('일정 업데이트에 실패했습니다. 다시 시도해 주세요.');
                }
            }
        }
    };

    const handleDeleteConfirm = () => {
        if (deleteTaskToConfirm) {
            import('@/lib/storage').then(({ deleteTask }) => {
                deleteTask(deleteTaskToConfirm.id);
                onTaskDelete();
                setDeleteTaskToConfirm(null);
            });
        }
    };

    // Helper to get week number
    const getWeekNumber = (date: Date) => {
        // weekStartsOn: 0 (Sunday) for consistency
        return getWeek(date, { weekStartsOn: 0, firstWeekContainsDate: 1 });
    };

    // Check if a week is entirely in the past
    // Logic: Week Ends before Today starts.
    const isPastWeek = (weekStartDate: Date) => {
        const weekEndDate = endOfWeek(weekStartDate, { weekStartsOn: 0 }); // Sunday start
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        return weekEndDate < today;
    };

    const renderHeader = () => {
        return (
            <div className="flex items-center justify-between py-2 px-1 mb-2">
                <div className="flex items-center gap-2">
                    <button
                        onClick={() => onMonthChange(new Date())}
                        className="px-3 py-1 text-sm font-medium text-gray-700 bg-gray-100 dark:bg-gray-800 rounded hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
                    >
                        오늘
                    </button>
                    {/* Attendance Badges */}
                    {(() => {
                        const today = new Date();
                        const activeTrips = trips.filter(t => {
                            const start = new Date(t.startDate);
                            const end = new Date(t.endDate);
                            start.setHours(0, 0, 0, 0);
                            end.setHours(23, 59, 59, 999);
                            return today >= start && today <= end;
                        });
                        const onTrip = activeTrips.filter(t => t.category === 'trip');
                        const onVacation = activeTrips.filter(t => t.category === 'vacation');
                        const onEducation = activeTrips.filter(t => t.category === 'education');
                        const tripNames = new Set(onTrip.map(t => t.knoxId || t.name));
                        const vacNames = new Set(onVacation.map(t => t.knoxId || t.name));
                        const eduNames = new Set(onEducation.map(t => t.knoxId || t.name));

                        const badges: { cat: 'trip' | 'vacation' | 'education'; label: string; count: number; icon: React.ReactNode; color: string; bgColor: string; borderColor: string }[] = [
                            { cat: 'trip', label: '출장', count: tripNames.size, icon: <Plane className="w-3.5 h-3.5" />, color: 'text-blue-600', bgColor: 'bg-blue-50 dark:bg-blue-900/30', borderColor: 'border-blue-200 dark:border-blue-800' },
                            { cat: 'vacation', label: '휴가', count: vacNames.size, icon: <Palmtree className="w-3.5 h-3.5" />, color: 'text-emerald-600', bgColor: 'bg-emerald-50 dark:bg-emerald-900/30', borderColor: 'border-emerald-200 dark:border-emerald-800' },
                            { cat: 'education', label: '교육', count: eduNames.size, icon: <GraduationCap className="w-3.5 h-3.5" />, color: 'text-purple-600', bgColor: 'bg-purple-50 dark:bg-purple-900/30', borderColor: 'border-purple-200 dark:border-purple-800' },
                        ];

                        return badges.map(b => (
                            <button
                                key={b.cat}
                                onClick={() => b.count > 0 ? setAttendanceModal(b.cat) : undefined}
                                className={`flex items-center gap-1.5 px-2.5 py-1 text-sm font-medium rounded-lg border transition-all ${b.count > 0
                                    ? `${b.bgColor} ${b.borderColor} ${b.color} hover:shadow-sm hover:scale-[1.03] cursor-pointer`
                                    : 'bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-400 cursor-default'
                                    }`}
                            >
                                {b.icon}
                                <span>{b.label}</span>
                                <span className="font-bold">{b.count}</span>
                            </button>
                        ));
                    })()}
                </div>

                <div className="flex items-center gap-4">
                    <button
                        onClick={() => onMonthChange(subMonths(currentMonth, 1))}
                        className="p-1 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full transition-colors"
                    >
                        <ChevronLeft className="w-5 h-5 text-gray-500" />
                    </button>
                    <h2 className="text-lg font-bold text-gray-800 dark:text-gray-200 min-w-[120px] text-center">
                        {format(currentMonth, 'yyyy년 M월', { locale: ko })}
                    </h2>
                    <button
                        onClick={() => onMonthChange(addMonths(currentMonth, 1))}
                        className="p-1 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full transition-colors"
                    >
                        <ChevronRight className="w-5 h-5 text-gray-500" />
                    </button>
                </div>

                {/* Empty div for layout balance */}
                {/* Search Button (Right Aligned) */}
                {/* Search & Settings Buttons (Right Aligned) */}
                <div className="flex justify-end gap-2">
                    <button
                        onClick={() => setIsSettingsModalOpen(true)}
                        className="p-1.5 text-gray-500 hover:text-gray-900 bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-400 dark:hover:bg-gray-700 rounded transition-colors"
                        title="스타일 설정"
                    >
                        <Settings className="w-4 h-4" />
                    </button>
                </div>
            </div>
        );
    };

    const renderDays = () => {
        // Changed order to start with Sunday
        const days = ['일', '월', '화', '수', '목', '금', '토'];
        return (
            <div className={`grid ${showWeekends ? 'grid-cols-[32px_minmax(0,0.5fr)_repeat(6,minmax(0,1fr))]' : 'grid-cols-[32px_repeat(6,minmax(0,1fr))]'} border-b border-gray-200 dark:border-gray-700`}>
                <div className="w-8 border-r border-gray-200 dark:border-gray-700"></div> {/* Week number column header */}
                {days.map((day, i) => {
                    // i=0 (Sun), i=6 (Sat)
                    // If weekends hidden (now "Sunday Hidden"), hide Sun(0). Show Sat(6).
                    if (!showWeekends && i === 0) return null;
                    return (
                        <div
                            key={day}
                            className={`py-2 text-center text-sm font-medium ${i === 0 ? 'text-red-500' : i === 6 ? 'text-blue-500' : 'text-gray-500 dark:text-gray-400'
                                } border-r border-gray-200 dark:border-gray-700`}
                        >
                            {day}
                        </div>
                    );
                })}
            </div>
        );
    };

    // Collapsed weeks state with localStorage persistence
    const [collapsedWeeks, setCollapsedWeeks] = useState<Set<number>>(() => {
        if (typeof window !== 'undefined') {
            const saved = localStorage.getItem('calendar-collapsed-weeks');
            if (saved) {
                try {
                    return new Set(JSON.parse(saved));
                } catch {
                    return new Set();
                }
            }
        }
        return new Set();
    });

    // Save collapsedWeeks to localStorage when it changes
    useEffect(() => {
        localStorage.setItem('calendar-collapsed-weeks', JSON.stringify([...collapsedWeeks]));
    }, [collapsedWeeks]);

    const toggleWeekCollapse = (weekNum: number) => {
        const newCollapsed = new Set(collapsedWeeks);
        if (newCollapsed.has(weekNum)) {
            newCollapsed.delete(weekNum);
        } else {
            newCollapsed.add(weekNum);
        }
        setCollapsedWeeks(newCollapsed);
    };

    // ... (existing code)

    const renderCells = () => {
        const monthStart = startOfMonth(currentMonth);
        const monthEnd = endOfMonth(monthStart);
        // Change weekStartsOn to 0 (Sunday)
        const startDate = startOfWeek(monthStart, { weekStartsOn: 0 });
        let endDate = endOfWeek(monthEnd, { weekStartsOn: 0 });

        // If the month ends exactly on the last day of the week (Saturday),
        // the grid will cut off without showing any days of the next month.
        // In this case, add one more week to show the start of the next month.
        if (isSameDay(monthEnd, endDate)) {
            endDate = addWeeks(endDate, 1);
        }

        const days = eachDayOfInterval({ start: startDate, end: endDate });
        const weeks: Date[][] = [];
        let currentWeek: Date[] = [];

        days.forEach((day) => {
            currentWeek.push(day);
            if (currentWeek.length === 7) {
                weeks.push(currentWeek);
                currentWeek = [];
            }
        });

        return (
            <div className="flex-1 flex flex-col overflow-y-auto bg-white dark:bg-gray-900 select-none">
                {weeks.map((weekDays, weekIndex) => {
                    const firstDayOfWeek = weekDays[0];
                    const weekNum = getWeekNumber(firstDayOfWeek);
                    const isWeekPast = isPastWeek(firstDayOfWeek);
                    const isCollapsed = collapsedWeeks.has(weekNum);

                    return (
                        <div
                            key={`week-${weekIndex}`}
                            className={`grid shrink-0 ${showWeekends
                                ? 'grid-cols-[32px_minmax(0,0.5fr)_repeat(6,minmax(0,1fr))]'
                                : 'grid-cols-[32px_repeat(6,minmax(0,1fr))]'}`}
                        >
                            {/* Week Number Cell with Collapse Checkbox */}
                            {(() => {
                                const today = new Date();
                                const todayWeekNum = getWeekNumber(today);
                                const isCurrentWeek = weekNum === todayWeekNum && isSameMonth(firstDayOfWeek, today);

                                return (
                                    <div className={`border-b border-r border-gray-200 dark:border-gray-700 flex flex-col items-center justify-center bg-gray-50 dark:bg-gray-900/50 ${isCollapsed ? 'h-8' : 'pt-1 gap-0.5'}`}>
                                        <span className={`text-xs ${isCurrentWeek ? 'font-bold text-gray-700 dark:text-gray-200' : 'font-medium text-gray-400 dark:text-gray-600'}`}>
                                            W{weekNum.toString().padStart(2, '0')}
                                        </span>
                                        <input
                                            type="checkbox"
                                            checked={isCollapsed}
                                            onChange={() => toggleWeekCollapse(weekNum)}
                                            className="w-3 h-3 cursor-pointer accent-gray-500"
                                            title="주차 접기/펼치기"
                                        />
                                    </div>
                                );
                            })()}

                            {/* Day Cells */}
                            {weekDays.map((day) => {
                                const dayOfWeek = day.getDay(); // 0=Sun, 6=Sat
                                if (!showWeekends && dayOfWeek === 0) return null;

                                const isCurrentMonth = isSameMonth(day, currentMonth);
                                const isDropTarget = dropTargetDate && isSameDay(day, dropTargetDate);

                                // If week is collapsed, show minimal cell with date only
                                if (isCollapsed) {
                                    return (
                                        <div
                                            key={day.toISOString()}
                                            className={`h-8 border-b border-r border-gray-200 dark:border-gray-700 px-1 flex items-center bg-gray-100/50 dark:bg-gray-800/50 ${!isCurrentMonth ? 'opacity-50' : ''}`}
                                        >
                                            <span className={`text-xs ${!isCurrentMonth ? 'text-gray-300 dark:text-gray-600' :
                                                dayOfWeek === 0 ? 'text-red-400' :
                                                    dayOfWeek === 6 ? 'text-blue-400' : 'text-gray-500 dark:text-gray-400'
                                                }`}>
                                                {format(day, 'd')}
                                            </span>
                                        </div>
                                    );
                                }

                                const dayTasks = getTasksForDate(day);

                                // Split tasks into Schedule and Regular
                                const scheduleCategory = categories.find(c => c.name === '팀 일정');

                                // Show all tasks if week is not collapsed
                                // Apply executive filter if enabled
                                const scheduleTasks = !isCollapsed
                                    ? dayTasks
                                        .filter(t => t.categoryId === scheduleCategory?.id)
                                        .filter(t => showOnlyExecutive ? (t.highlightLevel && t.highlightLevel > 0) : true)
                                        .sort((a, b) => (a.dueTime || '99:99').localeCompare(b.dueTime || '99:99'))
                                    : [];

                                const regularTasks = (showOnlyTeamSchedule || showOnlyExecutive || isCollapsed)
                                    ? []
                                    : dayTasks.filter(t => t.categoryId !== scheduleCategory?.id);

                                // Regular tasks display logic


                                // Determine Today Style
                                const todayBgClass = (() => {
                                    if (!isToday(day)) return '';
                                    switch (settings.todayBgColor) {
                                        // Reverted to lighter shades but ensured visibility by removing default bg
                                        case 'yellow': return 'bg-yellow-50/50 dark:bg-yellow-900/20';
                                        case 'orange': return 'bg-orange-50/50 dark:bg-orange-900/20';
                                        case 'green': return 'bg-green-50/50 dark:bg-green-900/20';
                                        case 'none': return '';
                                        case 'blue':
                                        default: return 'bg-blue-50/50 dark:bg-blue-900/20';
                                    }
                                })();

                                const todayBorderClass = (() => {
                                    if (!isToday(day)) return '';
                                    // Use ring-inset to avoid layout shifts, reduced to ring-1 (1px) for default thickness behavior
                                    switch (settings.todayBorderColor) {
                                        case 'light': return 'ring-1 ring-inset ring-gray-300 dark:ring-gray-600';
                                        case 'medium': return 'ring-1 ring-inset ring-gray-400 dark:ring-gray-500';
                                        case 'dark': return 'ring-1 ring-inset ring-gray-600 dark:ring-gray-400';
                                        case 'default':
                                        default: return '';
                                    }
                                })();

                                const defaultBgClass = !isCurrentMonth ? 'bg-gray-50/50 dark:bg-gray-900' : 'bg-white dark:bg-gray-800';
                                // If today and has a custom color, strictly NO default background to prevent overlay issues.
                                // If tone is 'none', use default background.
                                const finalBgClass = isToday(day) && settings.todayBgColor !== 'none'
                                    ? todayBgClass
                                    : `${defaultBgClass} ${todayBgClass}`;

                                // Determine if it is a holiday
                                const holidayName = getHoliday(day);
                                const isHoliday = !!holidayName;

                                return (
                                    <motion.div
                                        key={day.toISOString()}
                                        className={`min-h-[60px] border-b border-r border-gray-200 dark:border-gray-700 p-1 transition-colors ${finalBgClass} ${todayBorderClass} ${isDropTarget ? 'bg-blue-100 dark:bg-blue-800/50 ring-2 ring-blue-400 ring-inset' : ''
                                            } hover:bg-gray-50 dark:hover:bg-gray-800/50`}
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            if (e.ctrlKey || e.metaKey) {
                                                setTeamScheduleModalDate(day);
                                                setIsTeamScheduleModalOpen(true);
                                            } else {
                                                onDateClick?.(day);
                                            }
                                        }}
                                        onDragOver={(e) => handleDragOver(e, day)}
                                        onDragLeave={handleDragLeave}
                                        onDrop={(e) => handleDrop(e, day)}
                                    >
                                        <div className="flex items-center justify-between mb-1">
                                            <div className="flex items-center gap-1.5 flex-wrap">
                                                <div className={`text-sm font-medium ${!isCurrentMonth ? 'text-gray-300 dark:text-gray-600' :
                                                    (isHoliday || dayOfWeek === 0) ? 'text-red-500' :
                                                        dayOfWeek === 6 ? 'text-blue-500' : 'text-gray-700 dark:text-gray-200'
                                                    } ${isToday(day) ? 'bg-blue-600 text-white rounded-full w-6 h-6 flex items-center justify-center border-2 border-gray-600 dark:border-gray-400' : ''}`}>
                                                    {format(day, 'd')}
                                                </div>
                                                {(isHoliday && isCurrentMonth) && (
                                                    <span className="text-[10px] text-red-500 truncate max-w-[80px] leading-tight font-medium">
                                                        {holidayName}
                                                    </span>
                                                )}
                                            </div>
                                        </div>

                                        <div
                                            className="flex flex-col"
                                            style={{ gap: `${settings.itemSpacing}px` }}
                                        >
                                            {/* 1. Schedule Tasks (Simple Text) */}
                                            {/* Past weeks: limit to 3, Current/Future weeks: show all */}

                                            {/* Helper to get Tailwind classes or raw colors - shared by Team Schedule and Regular Tasks */}
                                            {(() => {
                                                const getColorValue = (colorKey: string, type: 'border' | 'bg' | 'text', lightness?: number) => {
                                                    // Standard Tailwind map for 'border-KEY-500' equivalent approx colors
                                                    const colorMap: Record<string, string> = {
                                                        gray: '220, 13%', // HSL base
                                                        red: '0, 84%',
                                                        green: '142, 71%',
                                                        blue: '217, 91%',
                                                        purple: '262, 83%',
                                                        orange: '24, 95%',
                                                        yellow: '48, 96%',
                                                    };

                                                    const hslBase = colorMap[colorKey] || colorMap['gray'];
                                                    let l = lightness ?? 50;

                                                    if (type === 'border') {
                                                        // Border uses direct lightness (0=dark, 100=light)
                                                        // If lightness not provided, use a moderate value
                                                        l = lightness ?? 80;
                                                    } else if (type === 'bg') {
                                                        // Background: High lightness (wash)
                                                        l = lightness ?? 96;
                                                    }

                                                    return `hsl(${hslBase}, ${l}%)`;
                                                };

                                                return (
                                                    <>
                                                        {(isWeekPast ? scheduleTasks.slice(0, 3) : scheduleTasks).map((task) => {
                                                            // Border Logic:
                                                            // - All Schedules: 3px left border
                                                            // - Active: Yellow
                                                            // - Executive (Level 1-3): Custom settings
                                                            // - Others: Gray

                                                            const isActive = isMeetingActive(task);
                                                            const highlightLevel = task.highlightLevel || 0;
                                                            const isExecutive = highlightLevel > 0;

                                                            // Determine base color for executive
                                                            let execColorKey = 'gray';
                                                            if (isExecutive && settings.executiveColors) {
                                                                execColorKey = settings.executiveColors[highlightLevel as 1 | 2 | 3] || 'gray';
                                                            }

                                                            // Helper to get Tailwind classes or raw colors
                                                            const getColorValue = (colorKey: string, type: 'border' | 'bg' | 'text', lightness?: number) => {
                                                                // Standard Tailwind map for 'border-KEY-500' equivalent approx colors
                                                                const colorMap: Record<string, string> = {
                                                                    gray: '220, 13%', // HSL base
                                                                    red: '0, 84%',
                                                                    green: '142, 71%',
                                                                    blue: '217, 91%',
                                                                    purple: '262, 83%',
                                                                    orange: '24, 95%',
                                                                    yellow: '48, 96%',
                                                                };

                                                                const hslBase = colorMap[colorKey] || colorMap['gray'];

                                                                // If lightness is provided, use it. Otherwise default based on type
                                                                let l = 50;
                                                                if (lightness !== undefined) {
                                                                    l = lightness;
                                                                } else {
                                                                    if (type === 'bg') l = 96;
                                                                    if (type === 'border') l = 75;
                                                                    if (type === 'text') l = 30;
                                                                }

                                                                return `hsl(${hslBase}, ${l}%)`;
                                                            };

                                                            const leftBorderClass = 'border-l-[3px]';

                                                            let leftBorderColorStyle: React.CSSProperties = {};

                                                            if (isActive) {
                                                                // Active is always Yellow-ish
                                                                leftBorderColorStyle = { borderLeftColor: '#eab308' }; // yellow-500
                                                            } else if (isExecutive) {
                                                                // Executive Custom Border
                                                                // Use Executive Border Lightness setting (common for all levels)
                                                                // 0(dark) -> 100(light). We map direct value.
                                                                leftBorderColorStyle = {
                                                                    borderLeftColor: getColorValue(execColorKey, 'border', settings.executiveBorderLightness)
                                                                };
                                                            } else {
                                                                // Normal Team Schedule -> Gray
                                                                // Use standard Settings Border Darkness or fixed? 
                                                                // User request implied "Bright Gray(Default)" for non-selected.
                                                                // Let's use the 'executiveBorderLightness' for consistency if it's the requested "Common" slider,
                                                                // OR fallback to standard gray. Original code was 'gray-300' (light).
                                                                // User said "1) Border Color: Bright Gray(Default)... Brightness can be adjusted".
                                                                // This implies 'gray' choice also uses the slider.
                                                                leftBorderColorStyle = {
                                                                    borderLeftColor: getColorValue('gray', 'border', settings.executiveBorderLightness ?? 80)
                                                                };
                                                            }


                                                            // Completed Task Visibility
                                                            if (task.completed && settings.completedMode === 'hidden') return null;

                                                            // Background Logic
                                                            let bgColorStyle = {};

                                                            if (isActive) {
                                                                // Active uses class (yellow bg)
                                                                // We'll leave bgColorStyle empty and let 'styleClasses' handle it via tailwind classes,
                                                                // OR override here. Existing code used classes.
                                                            } else {
                                                                if (isExecutive && settings.executiveBgMode === 'color') {
                                                                    // Use Level Color for BG
                                                                    bgColorStyle = { backgroundColor: getColorValue(execColorKey, 'bg', settings.executiveBgLightness) };
                                                                } else {
                                                                    // Gray Mode (Unified)
                                                                    // Applies to both Executive (if gray mode) AND Regular Team Schedules
                                                                    // Use `executiveBgLightness` or standard `bgLightness`? 
                                                                    // User req: "3) Background Color... Bright Gray (Default) same as Team Leader (Regular)".
                                                                    // If 'color' selected, differentiate.
                                                                    // So: If 'gray' mode, use Unified Gray.
                                                                    // We'll use `executiveBgLightness` for executives/team schedules if that's what the slider controls.
                                                                    // Or maybe `bgLightness` (General)? The request asked for "Background color... brightness control separately".
                                                                    // Let's use `executiveBgLightness` for schedule items.
                                                                    bgColorStyle = { backgroundColor: getColorValue('gray', 'bg', settings.executiveBgLightness ?? 96) };
                                                                }
                                                            }

                                                            const styleClasses = isActive
                                                                ? 'bg-yellow-200 text-yellow-900 dark:bg-yellow-600 dark:text-yellow-50 font-bold'
                                                                : 'text-gray-900 dark:text-gray-100 hover:brightness-95 dark:hover:bg-gray-700';

                                                            // Box Border Color (Top/Right/Bottom)
                                                            // Linked to Left Border Color logic generally, but User said "Divider Border (9 o'clock) follows Border Color".
                                                            // So we use the same color logic.
                                                            const boxBorderColor = isActive
                                                                ? '#eab308'
                                                                : (isExecutive
                                                                    ? getColorValue(execColorKey, 'border', settings.executiveBorderLightness)
                                                                    : getColorValue('gray', 'border', settings.executiveBorderLightness ?? 80)
                                                                );

                                                            // Completed Style
                                                            const completedClass = task.completed && settings.completedMode === 'dimmed' ? 'opacity-50' :
                                                                task.completed && settings.completedMode === 'strikethrough' ? 'line-through opacity-70' : '';

                                                            return (
                                                                <div
                                                                    key={task.id}
                                                                    className={`flex items-center px-1 font-medium rounded cursor-pointer transition-colors w-full group/schedule border dark:border-gray-500 ${leftBorderClass} ${styleClasses} ${completedClass}`}
                                                                    style={{
                                                                        height: `${itemHeight}px`,
                                                                        fontSize: `${settings.fontSize}px`,
                                                                        ...bgColorStyle,
                                                                        ...leftBorderColorStyle,
                                                                        borderTopColor: settings.showBorder ? boxBorderColor : 'transparent',
                                                                        borderRightColor: settings.showBorder ? boxBorderColor : 'transparent',
                                                                        borderBottomColor: settings.showBorder ? boxBorderColor : 'transparent',
                                                                    }}
                                                                    onClick={async (e) => {
                                                                        e.stopPropagation();
                                                                        // Ctrl+Click: URL paste from clipboard
                                                                        if (e.ctrlKey || e.metaKey) {
                                                                            const handled = await handleCtrlClickUrlPaste(task);
                                                                            if (handled) return;
                                                                        }
                                                                        // Single click mode (default)
                                                                        if ((settings.taskClickMode || 'single') === 'single') {
                                                                            setEditingScheduleTask(task);
                                                                            setIsTeamScheduleModalOpen(true);
                                                                        }
                                                                    }}
                                                                    onDoubleClick={(e) => {
                                                                        e.stopPropagation();
                                                                        // Double click mode
                                                                        if ((settings.taskClickMode || 'single') === 'double') {
                                                                            setEditingScheduleTask(task);
                                                                            setIsTeamScheduleModalOpen(true);
                                                                        }
                                                                    }}
                                                                    onDragOver={(e) => {
                                                                        e.preventDefault();
                                                                        e.stopPropagation();
                                                                    }}
                                                                    onDrop={(e) => handleTaskDrop(e, task)}
                                                                    title={task.organizer || `${task.title}${task.dueTime ? ` (${task.dueTime})` : ''} ${isActive ? '[진행 중]' : ''}`}
                                                                >
                                                                    <div className="truncate w-full min-w-0 flex items-center gap-1">
                                                                        {task.dueTime ? <span className="mr-1 opacity-75 whitespace-nowrap">{task.dueTime.match(/(\d{2}:\d{2})/)?.[0] || task.dueTime}</span> : ''}
                                                                        <span className="truncate">{task.title}</span>
                                                                        <div className="ml-auto shrink-0 flex items-center gap-0.5">
                                                                            {/* Multiple clip icons for multiple URLs */}
                                                                            {(task.resourceUrls && task.resourceUrls.length > 0 ? task.resourceUrls : (task.resourceUrl ? [task.resourceUrl] : [])).map((url, idx) => (
                                                                                <button
                                                                                    key={idx}
                                                                                    className="p-0.5 rounded hover:bg-gray-200 dark:hover:bg-gray-700 flex-shrink-0"
                                                                                    onClick={(e) => {
                                                                                        e.stopPropagation();
                                                                                        handleCopyUrl(url);
                                                                                        if (!e.ctrlKey && !e.metaKey) {
                                                                                            window.open(url, '_blank');
                                                                                        }
                                                                                    }}
                                                                                    title={url}
                                                                                >
                                                                                    <Paperclip className="w-3 h-3 text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-200" />
                                                                                </button>
                                                                            ))}
                                                                            {(settings.showExecutiveIndicator ?? true) && highlightLevel === 1 && <div className="w-2 h-2 rounded-full" style={{ backgroundColor: getColorValue(settings.executiveColors?.[1] || 'gray', 'bg', 50) }} />}
                                                                            {(settings.showExecutiveIndicator ?? true) && highlightLevel === 2 && <div className="w-2 h-2 rounded-full" style={{ backgroundColor: getColorValue(settings.executiveColors?.[2] || 'gray', 'bg', 50) }} />}
                                                                            {(settings.showExecutiveIndicator ?? true) && highlightLevel === 3 && <div className="w-2 h-2 rounded-full" style={{ backgroundColor: getColorValue(settings.executiveColors?.[3] || 'gray', 'bg', 50) }} />}
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                            );
                                                        })}
                                                        {isWeekPast && scheduleTasks.length > 3 && (
                                                            <div className="text-[10px] text-gray-400 dark:text-gray-500 px-1 cursor-help" title={`${scheduleTasks.length - 3}개의 일정이 더 있습니다`}>
                                                                + 팀 일정 {scheduleTasks.length - 3}개 더
                                                            </div>
                                                        )}

                                                        {/* Divider if both exist */}
                                                        {scheduleTasks.length > 0 && regularTasks.length > 0 && (
                                                            <div className="border-t border-dashed border-gray-300 dark:border-gray-600 my-1 mx-1" />
                                                        )}

                                                        {/* 2. Regular Tasks (Box Style) */}
                                                        {/* Past weeks: limit to 3, Current/Future weeks: show all */}
                                                        {(isWeekPast ? regularTasks.slice(0, 3) : regularTasks).map((task) => {
                                                            // Completed Task Visibility
                                                            if (task.completed && settings.completedMode === 'hidden') return null;

                                                            const taskColor = getTaskColor(task);
                                                            const isOverdue = task.dueDate && !task.completed &&
                                                                new Date(task.dueDate).setHours(0, 0, 0, 0) < new Date().setHours(0, 0, 0, 0);

                                                            // Completed Style
                                                            const completedClass = task.completed && settings.completedMode === 'dimmed' ? 'opacity-50' :
                                                                task.completed && settings.completedMode === 'strikethrough' ? 'opacity-70 line-through' : '';

                                                            const TaskStyle = task.completed
                                                                ? {
                                                                    height: `${itemHeight}px`,
                                                                    fontSize: `${settings.fontSize}px`,
                                                                    borderLeft: '3px solid #d1d5db',
                                                                    // Apply border to all sides when showBorder is enabled
                                                                    borderTop: settings.showBorder ? `1px solid ${getColorValue('gray', 'border', settings.executiveBorderLightness ?? 80)}` : undefined,
                                                                    borderRight: settings.showBorder ? `1px solid ${getColorValue('gray', 'border', settings.executiveBorderLightness ?? 80)}` : undefined,
                                                                    borderBottom: settings.showBorder ? `1px solid ${getColorValue('gray', 'border', settings.executiveBorderLightness ?? 80)}` : undefined,
                                                                }
                                                                : isOverdue
                                                                    ? {
                                                                        height: `${itemHeight}px`,
                                                                        fontSize: `${settings.fontSize}px`,
                                                                        backgroundColor: '#fee2e2',
                                                                        color: '#b91c1c',
                                                                        borderLeft: '3px solid #ef4444',
                                                                        // Apply border to all sides when showBorder is enabled (overdue uses red tint)
                                                                        borderTop: settings.showBorder ? `1px solid ${getColorValue('red', 'border', settings.executiveBorderLightness ?? 80)}` : undefined,
                                                                        borderRight: settings.showBorder ? `1px solid ${getColorValue('red', 'border', settings.executiveBorderLightness ?? 80)}` : undefined,
                                                                        borderBottom: settings.showBorder ? `1px solid ${getColorValue('red', 'border', settings.executiveBorderLightness ?? 80)}` : undefined,
                                                                    }
                                                                    : {
                                                                        height: `${itemHeight}px`,
                                                                        fontSize: `${settings.fontSize}px`,
                                                                        backgroundColor: `${taskColor}${Math.floor(Math.max(5, Math.min(95, 100 - (settings.bgLightness ?? 96))) * 2.55).toString(16).padStart(2, '0')}`,
                                                                        // color: taskColor, // Removed to match Team Schedule color
                                                                        borderLeft: `3px solid ${taskColor}`,
                                                                        // Apply category-based border to all sides when showBorder is enabled
                                                                        // Use taskColor with 50% opacity (hex color + '80' suffix)
                                                                        borderTop: settings.showBorder ? `1px solid ${taskColor}80` : undefined,
                                                                        borderRight: settings.showBorder ? `1px solid ${taskColor}80` : undefined,
                                                                        borderBottom: settings.showBorder ? `1px solid ${taskColor}80` : undefined,
                                                                    };

                                                            const totalSubtasks = task.subtasks?.length || 0;
                                                            const completedSubtasks = task.subtasks?.filter(s => s.completed).length || 0;
                                                            const hasChecklist = totalSubtasks > 0;
                                                            const checklistMode = settings.checklistDisplayMode || 'none';
                                                            const showChecklistText = hasChecklist && (checklistMode === 'text' || checklistMode === 'both');
                                                            const showChecklistBar = hasChecklist && (checklistMode === 'bar' || checklistMode === 'both');
                                                            const checklistProgress = hasChecklist ? (completedSubtasks / totalSubtasks) * 100 : 0;

                                                            return (
                                                                <div
                                                                    key={task.id}
                                                                    draggable
                                                                    onDragStart={(e) => handleDragStart(e, task.id)}
                                                                    onDragEnd={() => setDraggedTaskId(null)}
                                                                    className={`group/task relative px-1.5 rounded cursor-grab active:cursor-grabbing transition-all w-full overflow-hidden flex items-center ${draggedTaskId === task.id ? 'opacity-50 scale-95' : ''
                                                                        } ${task.completed ? 'bg-gray-100 dark:bg-gray-800 text-gray-400 dark:text-gray-500' : 'text-gray-900 dark:text-gray-100 dark:!bg-gray-700'} ${completedClass}`}
                                                                    style={TaskStyle}
                                                                    onClick={async (e) => {
                                                                        e.stopPropagation();
                                                                        // Ctrl+Click: URL paste from clipboard
                                                                        if (e.ctrlKey || e.metaKey) {
                                                                            const handled = await handleCtrlClickUrlPaste(task);
                                                                            if (handled) return;
                                                                        }
                                                                        // Single click mode (default)
                                                                        if ((settings.taskClickMode || 'single') === 'single') {
                                                                            if (task.categoryId === teamScheduleCategoryId) {
                                                                                setEditingScheduleTask(task);
                                                                                setIsTeamScheduleModalOpen(true);
                                                                            } else {
                                                                                onTaskClick(task);
                                                                            }
                                                                        }
                                                                    }}
                                                                    onDoubleClick={(e) => {
                                                                        e.stopPropagation();
                                                                        // Double click mode
                                                                        if ((settings.taskClickMode || 'single') === 'double') {
                                                                            if (task.categoryId === teamScheduleCategoryId) {
                                                                                setEditingScheduleTask(task);
                                                                                setIsTeamScheduleModalOpen(true);
                                                                            } else {
                                                                                onTaskClick(task);
                                                                            }
                                                                        }
                                                                    }}
                                                                    title={`${task.title}${task.dueTime ? ` (${task.dueTime})` : ''}${hasChecklist ? ` (${completedSubtasks}/${totalSubtasks})` : ''}`}
                                                                >
                                                                    {/* Progress Bar (Segmented) */}
                                                                    {showChecklistBar && (
                                                                        <div className="absolute bottom-0 left-0 w-full h-[3px] flex gap-[1px] px-[1px]">
                                                                            {Array.from({ length: totalSubtasks }).map((_, i) => (
                                                                                <div
                                                                                    key={i}
                                                                                    className={`flex-1 h-full rounded-sm ${i < completedSubtasks
                                                                                        ? '' // Color is applied via style
                                                                                        : 'bg-gray-300/50 dark:bg-gray-600/50'
                                                                                        }`}
                                                                                    style={
                                                                                        i < completedSubtasks
                                                                                            ? { backgroundColor: taskColor }
                                                                                            : {}
                                                                                    }
                                                                                />
                                                                            ))}
                                                                        </div>
                                                                    )}

                                                                    <div className="flex items-center justify-between w-full min-w-0 mb-[1px]">
                                                                        <div className="truncate flex-1 min-w-0 flex items-center">
                                                                            {task.dueTime && <span className="opacity-60 mr-1 whitespace-nowrap">{task.dueTime}</span>}
                                                                            {showChecklistText && (
                                                                                <span className="text-[10px] opacity-80 mr-1 font-mono tracking-tight">
                                                                                    ({completedSubtasks}/{totalSubtasks})
                                                                                </span>
                                                                            )}
                                                                            <span className="truncate">{task.title}</span>
                                                                        </div>
                                                                        {/* Multiple clip icons for multiple URLs - wrapped with gap for consistent spacing */}
                                                                        <div className="flex items-center gap-0.5 shrink-0">
                                                                            {(task.resourceUrls && task.resourceUrls.length > 0 ? task.resourceUrls : (task.resourceUrl ? [task.resourceUrl] : [])).map((url, idx) => (
                                                                                <button
                                                                                    key={idx}
                                                                                    className="p-0.5 rounded hover:bg-purple-100 dark:hover:bg-purple-900/30 flex-shrink-0"
                                                                                    onClick={(e) => {
                                                                                        e.stopPropagation();
                                                                                        handleCopyUrl(url);
                                                                                        if (!e.ctrlKey && !e.metaKey) {
                                                                                            window.open(url, '_blank');
                                                                                        }
                                                                                    }}
                                                                                    title={url}
                                                                                >
                                                                                    <Paperclip className="w-3 h-3 text-gray-600 dark:text-gray-400" />
                                                                                </button>
                                                                            ))}
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                            );
                                                        })}

                                                        {isWeekPast && regularTasks.length > 3 && (
                                                            <div className="text-[10px] text-gray-400 dark:text-gray-500 px-1">
                                                                +{regularTasks.length - 3}개 더
                                                            </div>
                                                        )}
                                                    </>
                                                );
                                            })()}
                                        </div>
                                    </motion.div>
                                );
                            })}
                        </div>
                    );
                })}
            </div>
        );
    };

    return (
        <div className="flex flex-col h-full bg-white dark:bg-gray-900 border-l border-gray-200 dark:border-gray-700">
            {renderHeader()}
            {renderDays()}
            {renderCells()}

            <TeamScheduleAddModal
                isOpen={isTeamScheduleModalOpen}
                onClose={() => {
                    setIsTeamScheduleModalOpen(false);
                    setEditingScheduleTask(null);
                }}
                onScheduleAdded={() => {
                    if (onDataChange) onDataChange();
                    else if (onTaskDelete) onTaskDelete();
                    setEditingScheduleTask(null);
                }}
                initialDate={teamScheduleModalDate}
                teamScheduleCategoryId={teamScheduleCategoryId}
                existingTask={editingScheduleTask}
            />

            {/* Delete Confirmation Overlay */}
            <AnimatePresence>
                {deleteTaskToConfirm && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="absolute inset-0 z-50 flex items-center justify-center bg-black/20 backdrop-blur-sm"
                        onClick={() => setDeleteTaskToConfirm(null)}
                    >
                        <motion.div
                            initial={{ scale: 0.9, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.9, opacity: 0 }}
                            className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow-xl border border-gray-200 dark:border-gray-700 w-[300px]"
                            onClick={e => e.stopPropagation()}
                        >
                            <h3 className="text-lg font-semibold mb-2 dark:text-white">할 일 삭제</h3>
                            <p className="text-gray-500 dark:text-gray-400 text-sm mb-4">
                                "{deleteTaskToConfirm.title}"을(를) 삭제하시겠습니까?
                            </p>
                            <div className="flex justify-end gap-2">
                                <button
                                    className="px-3 py-1.5 text-sm text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
                                    onClick={() => setDeleteTaskToConfirm(null)}
                                >
                                    취소
                                </button>
                                <button
                                    className="px-3 py-1.5 text-sm text-white bg-red-600 hover:bg-red-700 rounded"
                                    onClick={handleDeleteConfirm}
                                >
                                    삭제
                                </button>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Team Schedule Search Modal */}
            <TeamScheduleSearchModal
                isOpen={isSearchModalOpen}
                onClose={() => setIsSearchModalOpen(false)}
                tasks={tasks}
                teamScheduleCategoryId={teamScheduleCategoryId}
                onNavigateToDate={(date) => {
                    onMonthChange(date);
                    setIsSearchModalOpen(false);
                }}
            />

            <CalendarSettingsModal
                isOpen={isSettingsModalOpen}
                onClose={() => setIsSettingsModalOpen(false)}
                settings={settings}
                onSettingsChange={setSettings}
                onReset={() => setSettings(DEFAULT_SETTINGS)}
            />

            {/* Attendance Detail Modal */}
            <AnimatePresence>
                {attendanceModal && (() => {
                    const categoryMeta: Record<string, { label: string; icon: React.ReactNode; color: string; bgColor: string; borderColor: string }> = {
                        trip: { label: '출장', icon: <Plane className="w-5 h-5" />, color: 'text-blue-600', bgColor: 'bg-blue-50 dark:bg-blue-900/30', borderColor: 'border-blue-200 dark:border-blue-800' },
                        vacation: { label: '휴가', icon: <Palmtree className="w-5 h-5" />, color: 'text-emerald-600', bgColor: 'bg-emerald-50 dark:bg-emerald-900/30', borderColor: 'border-emerald-200 dark:border-emerald-800' },
                        education: { label: '교육', icon: <GraduationCap className="w-5 h-5" />, color: 'text-purple-600', bgColor: 'bg-purple-50 dark:bg-purple-900/30', borderColor: 'border-purple-200 dark:border-purple-800' },
                    };
                    const meta = categoryMeta[attendanceModal];
                    const today = new Date();
                    const activeTrips = trips.filter(t => {
                        const start = new Date(t.startDate);
                        const end = new Date(t.endDate);
                        start.setHours(0, 0, 0, 0);
                        end.setHours(23, 59, 59, 999);
                        return today >= start && today <= end && t.category === attendanceModal;
                    });

                    const formatDateRange = (s: string, e: string) => {
                        const sd = new Date(s); const ed = new Date(e);
                        return `${sd.getMonth() + 1}/${sd.getDate()} ~ ${ed.getMonth() + 1}/${ed.getDate()}`;
                    };

                    // === Trip-specific enhanced view ===
                    const isTripModal = attendanceModal === 'trip';

                    // Resolve destination for each active trip using TripRecord
                    const resolveDestForTrip = (bt: BusinessTrip): string => {
                        // Find matching TripRecord by knoxId + date overlap
                        const match = tripRecords.find(r => {
                            if (!r.destination) return false;
                            const nameMatch = (r.knoxId && bt.knoxId && r.knoxId === bt.knoxId) ||
                                (r.name === bt.name);
                            if (!nameMatch) return false;
                            // Date overlap check
                            return r.startDate <= bt.endDate && r.endDate >= bt.startDate;
                        });
                        return match?.destination || bt.location || '미지정';
                    };

                    const ALLOWED_DEPTS = ['실장기술', '라미기술'];

                    // Build enriched trip data with destination AND filter by department if trip modal
                    type EnrichedTrip = BusinessTrip & { destination: string; member?: TeamMember };
                    const enrichedTrips: EnrichedTrip[] = activeTrips.map(t => ({
                        ...t,
                        destination: isTripModal ? resolveDestForTrip(t) : '',
                        member: members.find(m => m.knoxId === t.knoxId || m.name === t.name),
                    })).filter(t => {
                        if (!isTripModal) return true;
                        const dept = t.member?.department || '미지정';
                        return ALLOWED_DEPTS.includes(dept);
                    });

                    // Collect unique destinations in fixed order
                    const DEST_ORDER = ['SDV', 'SDD', 'SDT', 'SDN'];
                    const destinations = isTripModal
                        ? DEST_ORDER.filter(d => enrichedTrips.some(t => t.destination === d))
                            .concat(Array.from(new Set(enrichedTrips.map(t => t.destination))).filter(d => !DEST_ORDER.includes(d)).sort())
                        : [];

                    // === Build matrix: department > group > part × destination ===
                    type RowKey = { department: string; group: string; part: string };
                    const matrixRows: { key: RowKey; counts: Record<string, number>; total: number }[] = [];
                    const departmentOrder = ['실장기술', '라미기술'];

                    if (isTripModal) {
                        // Group enriched trips by unique (dept, group, part) — only allowed departments
                        const rowMap = new Map<string, { key: RowKey; counts: Record<string, number>; total: number }>();

                        enrichedTrips.forEach(t => {
                            const dept = t.member?.department || '미지정';
                            const grp = t.member?.group || '미지정';
                            const prt = t.member?.part || '미지정';
                            const mapKey = `${dept}|${grp}|${prt}`;

                            if (!rowMap.has(mapKey)) {
                                rowMap.set(mapKey, { key: { department: dept, group: grp, part: prt }, counts: {}, total: 0 });
                            }
                            const row = rowMap.get(mapKey)!;
                            // Deduplicate by person name per destination
                            const personKey = t.knoxId || t.name;
                            const destCountKey = `${t.destination}|${personKey}`;
                            if (!(row as any).__seen) (row as any).__seen = new Set();
                            if (!(row as any).__seen.has(destCountKey)) {
                                (row as any).__seen.add(destCountKey);
                                row.counts[t.destination] = (row.counts[t.destination] || 0) + 1;
                                row.total++;
                            }
                        });

                        // Sort rows by department order, then group, then part
                        const sorted = Array.from(rowMap.values()).sort((a, b) => {
                            const deptCmp = departmentOrder.indexOf(a.key.department) - departmentOrder.indexOf(b.key.department);
                            if (deptCmp !== 0) return deptCmp;
                            if (a.key.group !== b.key.group) return a.key.group.localeCompare(b.key.group);
                            return a.key.part.localeCompare(b.key.part);
                        });
                        matrixRows.push(...sorted);
                    }

                    // Subtotals by department
                    const deptSubtotals: Record<string, Record<string, number>> = {};
                    const grandTotal: Record<string, number> = {};
                    let grandTotalAll = 0;

                    matrixRows.forEach(row => {
                        const dept = row.key.department;
                        if (!deptSubtotals[dept]) deptSubtotals[dept] = {};
                        destinations.forEach(d => {
                            const c = row.counts[d] || 0;
                            deptSubtotals[dept][d] = (deptSubtotals[dept][d] || 0) + c;
                            grandTotal[d] = (grandTotal[d] || 0) + c;
                        });
                        grandTotalAll += row.total;
                    });

                    // Group by destination for detail section
                    const tripsByDest = new Map<string, EnrichedTrip[]>();
                    if (isTripModal) {
                        enrichedTrips.forEach(t => {
                            if (!tripsByDest.has(t.destination)) tripsByDest.set(t.destination, []);
                            tripsByDest.get(t.destination)!.push(t);
                        });
                    }

                    // Non-trip modal: simple person grouping (vacation/education)
                    const grouped = new Map<string, BusinessTrip[]>();
                    if (!isTripModal) {
                        activeTrips.forEach(t => {
                            const key = t.knoxId || t.name;
                            if (!grouped.has(key)) grouped.set(key, []);
                            grouped.get(key)!.push(t);
                        });
                    }

                    return (
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4"
                            onClick={() => setAttendanceModal(null)}
                        >
                            <motion.div
                                initial={{ opacity: 0, scale: 0.95, y: 10 }}
                                animate={{ opacity: 1, scale: 1, y: 0 }}
                                exit={{ opacity: 0, scale: 0.95, y: 10 }}
                                className={`bg-white dark:bg-gray-900 rounded-xl shadow-2xl border border-gray-200 dark:border-gray-700 w-full ${isTripModal ? 'max-w-4xl max-h-[85vh]' : 'max-w-lg max-h-[70vh]'} flex flex-col`}
                                onClick={e => e.stopPropagation()}
                            >
                                {/* Header */}
                                <div className={`flex items-center justify-between px-5 py-4 border-b ${meta.borderColor} ${meta.bgColor} rounded-t-xl flex-shrink-0`}>
                                    <div className="flex items-center gap-3">
                                        <div className={meta.color}>{meta.icon}</div>
                                        <div>
                                            <h2 className="text-base font-bold text-gray-900 dark:text-white">
                                                {meta.label}중 현황
                                            </h2>
                                            <p className="text-xs text-gray-500 dark:text-gray-400">
                                                {today.getFullYear()}년 {today.getMonth() + 1}월 {today.getDate()}일 기준
                                            </p>
                                        </div>
                                    </div>
                                    <button
                                        onClick={() => setAttendanceModal(null)}
                                        className="p-1.5 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
                                    >
                                        <X className="w-5 h-5 text-gray-500" />
                                    </button>
                                </div>

                                {/* Body */}
                                <div className="flex-1 overflow-auto p-4 space-y-6">
                                    {activeTrips.length === 0 ? (
                                        <div className="text-center text-gray-400 py-10">해당하는 인원이 없습니다</div>
                                    ) : isTripModal ? (
                                        <>
                                            {/* ━━━ Section 1: Matrix Summary Table ━━━ */}
                                            <div>
                                                <h3 className="text-sm font-bold text-gray-800 dark:text-gray-200 mb-2">□ 출장 전체 현황</h3>
                                                <div className="overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-700">
                                                    <table className="w-full text-xs">
                                                        <thead>
                                                            <tr className="bg-gray-50 dark:bg-gray-800">
                                                                <th className="px-2 py-2 text-left font-semibold text-gray-600 dark:text-gray-300 border-b border-r border-gray-200 dark:border-gray-700 min-w-[70px]">소속</th>
                                                                <th className="px-2 py-2 text-left font-semibold text-gray-600 dark:text-gray-300 border-b border-r border-gray-200 dark:border-gray-700 min-w-[60px]">그룹</th>
                                                                <th className="px-2 py-2 text-left font-semibold text-gray-600 dark:text-gray-300 border-b border-r border-gray-200 dark:border-gray-700 min-w-[60px]">파트</th>
                                                                {destinations.map(d => (
                                                                    <th key={d} className="px-2 py-2 text-center font-semibold text-blue-600 dark:text-blue-400 border-b border-r border-gray-200 dark:border-gray-700 min-w-[45px]">{d}</th>
                                                                ))}
                                                                <th className="px-2 py-2 text-center font-bold text-gray-700 dark:text-gray-200 border-b border-gray-200 dark:border-gray-700 min-w-[35px]">계</th>
                                                            </tr>
                                                        </thead>
                                                        <tbody>
                                                            {(() => {
                                                                const rows: React.ReactNode[] = [];
                                                                let prevDept = '';
                                                                let prevGroup = '';

                                                                matrixRows.forEach((row, idx) => {
                                                                    const showDept = row.key.department !== prevDept;
                                                                    const showGroup = row.key.group !== prevGroup || showDept;

                                                                    // Insert department subtotal before new department
                                                                    if (showDept && prevDept && deptSubtotals[prevDept]) {
                                                                        const sub = deptSubtotals[prevDept];
                                                                        const subTotal = Object.values(sub).reduce((a, b) => a + b, 0);
                                                                        rows.push(
                                                                            <tr key={`sub-${prevDept}`} className="bg-gray-100 dark:bg-gray-800/60 font-semibold">
                                                                                <td colSpan={3} className="px-2 py-1.5 text-right text-gray-600 dark:text-gray-300 border-b border-r border-gray-200 dark:border-gray-700">소계</td>
                                                                                {destinations.map(d => (
                                                                                    <td key={d} className="px-2 py-1.5 text-center text-gray-700 dark:text-gray-300 border-b border-r border-gray-200 dark:border-gray-700">{sub[d] || ''}</td>
                                                                                ))}
                                                                                <td className="px-2 py-1.5 text-center text-gray-800 dark:text-gray-200 border-b border-gray-200 dark:border-gray-700">{subTotal}</td>
                                                                            </tr>
                                                                        );
                                                                    }

                                                                    rows.push(
                                                                        <tr key={idx} className="hover:bg-gray-50 dark:hover:bg-gray-800/30">
                                                                            <td className={`px-2 py-1.5 text-gray-700 dark:text-gray-300 border-b border-r border-gray-200 dark:border-gray-700 ${showDept ? 'font-medium' : ''}`}>
                                                                                {showDept ? row.key.department : ''}
                                                                            </td>
                                                                            <td className={`px-2 py-1.5 text-gray-600 dark:text-gray-400 border-b border-r border-gray-200 dark:border-gray-700 ${showGroup ? '' : ''}`}>
                                                                                {showGroup ? row.key.group : ''}
                                                                            </td>
                                                                            <td className="px-2 py-1.5 text-gray-600 dark:text-gray-400 border-b border-r border-gray-200 dark:border-gray-700">
                                                                                {row.key.part}
                                                                            </td>
                                                                            {destinations.map(d => (
                                                                                <td key={d} className="px-2 py-1.5 text-center border-b border-r border-gray-200 dark:border-gray-700">
                                                                                    {row.counts[d] ? (
                                                                                        <span className="text-blue-600 dark:text-blue-400 font-medium">{row.counts[d]}</span>
                                                                                    ) : ''}
                                                                                </td>
                                                                            ))}
                                                                            <td className="px-2 py-1.5 text-center font-medium text-gray-700 dark:text-gray-300 border-b border-gray-200 dark:border-gray-700">{row.total}</td>
                                                                        </tr>
                                                                    );

                                                                    prevDept = row.key.department;
                                                                    prevGroup = row.key.group;
                                                                });

                                                                // Last department subtotal
                                                                if (prevDept && deptSubtotals[prevDept]) {
                                                                    const sub = deptSubtotals[prevDept];
                                                                    const subTotal = Object.values(sub).reduce((a, b) => a + b, 0);
                                                                    rows.push(
                                                                        <tr key={`sub-${prevDept}`} className="bg-gray-100 dark:bg-gray-800/60 font-semibold">
                                                                            <td colSpan={3} className="px-2 py-1.5 text-right text-gray-600 dark:text-gray-300 border-b border-r border-gray-200 dark:border-gray-700">소계</td>
                                                                            {destinations.map(d => (
                                                                                <td key={d} className="px-2 py-1.5 text-center text-gray-700 dark:text-gray-300 border-b border-r border-gray-200 dark:border-gray-700">{sub[d] || ''}</td>
                                                                            ))}
                                                                            <td className="px-2 py-1.5 text-center text-gray-800 dark:text-gray-200 border-b border-gray-200 dark:border-gray-700">{subTotal}</td>
                                                                        </tr>
                                                                    );
                                                                }

                                                                // Grand total
                                                                rows.push(
                                                                    <tr key="grand-total" className="bg-blue-50 dark:bg-blue-900/20 font-bold">
                                                                        <td colSpan={3} className="px-2 py-2 text-right text-gray-800 dark:text-gray-200 border-r border-gray-200 dark:border-gray-700">계</td>
                                                                        {destinations.map(d => (
                                                                            <td key={d} className="px-2 py-2 text-center text-blue-700 dark:text-blue-300 border-r border-gray-200 dark:border-gray-700">{grandTotal[d] || ''}</td>
                                                                        ))}
                                                                        <td className="px-2 py-2 text-center text-blue-800 dark:text-blue-200">{grandTotalAll}</td>
                                                                    </tr>
                                                                );

                                                                return rows;
                                                            })()}
                                                        </tbody>
                                                    </table>
                                                </div>
                                            </div>

                                            {/* ━━━ Section 2: Per-Destination Detail ━━━ */}
                                            <div>
                                                <h3 className="text-sm font-bold text-gray-800 dark:text-gray-200 mb-3">□ 출장지별 현황</h3>
                                                <div className="space-y-4">
                                                    {destinations.map((dest, di) => {
                                                        const destTrips = tripsByDest.get(dest) || [];
                                                        // Dedupe by person
                                                        const personMap = new Map<string, EnrichedTrip[]>();
                                                        destTrips.forEach(t => {
                                                            const pk = t.knoxId || t.name;
                                                            if (!personMap.has(pk)) personMap.set(pk, []);
                                                            personMap.get(pk)!.push(t);
                                                        });

                                                        return (
                                                            <div key={dest}>
                                                                <div className="flex items-center gap-2 mb-1.5">
                                                                    <span className="text-sm font-bold text-blue-600 dark:text-blue-400">{di + 1}. {dest}</span>
                                                                    <span className="text-xs text-gray-400">({personMap.size}명)</span>
                                                                </div>
                                                                <div className="grid grid-cols-2 gap-2 ml-2">
                                                                    {Array.from(personMap.entries()).map(([pk, pTrips]) => {
                                                                        const p = pTrips[0];
                                                                        return (
                                                                            <div key={pk} className="rounded-lg border border-gray-100 dark:border-gray-800 p-2.5 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
                                                                                <div className="flex items-center gap-2 mb-1">
                                                                                    <span className="font-semibold text-sm text-gray-800 dark:text-gray-200">{p.name}</span>
                                                                                    {p.member && (
                                                                                        <span className="text-[10px] text-gray-400">{p.member.group} · {p.member.part}</span>
                                                                                    )}
                                                                                </div>
                                                                                {pTrips.map(t => (
                                                                                    <div key={t.id} className="flex items-center gap-1.5 text-[11px] text-gray-500 dark:text-gray-400 mt-0.5">
                                                                                        <Clock className="w-3 h-3 flex-shrink-0" />
                                                                                        <span>{formatDateRange(t.startDate, t.endDate)}</span>
                                                                                        {t.purpose && <><span className="text-gray-300">·</span><span className="truncate">{t.purpose}</span></>}
                                                                                    </div>
                                                                                ))}
                                                                            </div>
                                                                        );
                                                                    })}
                                                                </div>
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            </div>
                                        </>
                                    ) : (
                                        /* Vacation / Education: simple person list */
                                        <div className="space-y-2">
                                            {Array.from(grouped.entries()).map(([key, personTrips]) => {
                                                const person = personTrips[0];
                                                const member = members.find(m => m.knoxId === person.knoxId);
                                                return (
                                                    <div key={key} className="rounded-lg border border-gray-100 dark:border-gray-800 p-3 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
                                                        <div className="flex items-center justify-between mb-1">
                                                            <div className="flex items-center gap-2">
                                                                <span className="font-semibold text-sm text-gray-800 dark:text-gray-200">{person.name}</span>
                                                                {member && (
                                                                    <span className="text-xs text-gray-400">{member.group} · {member.part}</span>
                                                                )}
                                                            </div>
                                                        </div>
                                                        {personTrips.map(t => (
                                                            <div key={t.id} className="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-400 ml-1 mt-1">
                                                                <Clock className="w-3 h-3 flex-shrink-0" />
                                                                <span>{formatDateRange(t.startDate, t.endDate)}</span>
                                                                <span className="text-gray-400">·</span>
                                                                <span className="truncate">{t.purpose || t.location || '-'}</span>
                                                            </div>
                                                        ))}
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    )}
                                </div>
                            </motion.div>
                        </motion.div>
                    );
                })()}
            </AnimatePresence>
        </div>
    );
}
