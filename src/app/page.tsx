"use client";

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Category, Task } from '@/lib/types';
import { format } from 'date-fns';
import { getCategories, getTasks, addTask, getTheme, setTheme, Theme, getLayoutState, saveLayoutState, getLayoutPreset, saveLayoutPreset, Layout, LayoutState, generateId, addCategory, deleteTask, updateTask, addNote, updateNote } from '@/lib/storage';
import { Sidebar } from '@/components/sidebar';
import { TaskList } from '@/components/task-list';
import { CalendarView } from '@/components/calendar-view';
import { KeepView } from '@/components/keep-view';
import { FavoritesView } from '@/components/favorites-view';
import { TaskDetailDialog } from '@/components/task-detail-dialog';
import { ImportExportDialog } from '@/components/import-export-dialog';
import { ScheduleImportDialog } from '@/components/schedule-import-dialog';
import { TeamScheduleAddModal } from '@/components/team-schedule-add-modal';
import { SearchCommandDialog } from '@/components/search-command-dialog';

import { ParsedSchedule, parseScheduleText } from '@/lib/schedule-parser';
import { Button } from '@/components/ui/button';
import { PanelLeftClose, PanelLeft, Sun, Moon } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export default function Home() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedCategoryIds, setSelectedCategoryIds] = useState<string[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [dialogType, setDialogType] = useState<'export' | 'import' | null>(null);
  const [isScheduleImportOpen, setIsScheduleImportOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSidebarVisible, setIsSidebarVisible] = useState(true);
  const [detailTask, setDetailTask] = useState<Task | null>(null);
  const [taskListWidth, setTaskListWidth] = useState(400);
  const [isResizing, setIsResizing] = useState(false);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(undefined);
  const [theme, setThemeState] = useState<Theme>('light');
  const [layout, setLayoutState] = useState<Layout>(1);
  const [showWeekends, setShowWeekends] = useState(true);
  const [viewMode, setViewMode] = useState<'calendar' | 'keep' | 'favorites'>('calendar');
  const [selectedNoteId, setSelectedNoteId] = useState<string | null>(null);
  const [notesVersion, setNotesVersion] = useState(0);
  const [isTeamScheduleModalOpen, setIsTeamScheduleModalOpen] = useState(false);
  const [editingScheduleTask, setEditingScheduleTask] = useState<Task | null>(null);
  const [collectionGroups, setCollectionGroups] = useState<string[]>(['CP', 'OLB', 'LASER', '라미1', '라미2']);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Load categories from LocalStorage
  const loadCategories = useCallback(() => {
    const cats = getCategories();
    setCategories(cats);
    return cats;
  }, []);

  // Load tasks for selected categories (multiple)
  const loadTasks = useCallback(() => {
    const teamScheduleCat = categories.find(c => c.name === '팀 일정');
    let targetIds = [...selectedCategoryIds];

    // Always include 'Team Schedule' for Calendar view visibility
    if (teamScheduleCat && !targetIds.includes(teamScheduleCat.id)) {
      targetIds.push(teamScheduleCat.id);
    }

    if (targetIds.length > 0) {
      const allTasks = targetIds.flatMap(id => getTasks(id));
      setTasks(allTasks);
    } else {
      setTasks([]);
    }
  }, [selectedCategoryIds, categories]);

  // Initial load
  useEffect(() => {
    let cats = loadCategories();

    // Ensure 'Team Schedule' category exists
    if (!cats.find(c => c.name === '팀 일정')) {
      addCategory('팀 일정');
      cats = loadCategories();
    }

    if (cats.length > 0 && selectedCategoryIds.length === 0) {
      const defaultIds = [cats[0].id];
      const teamSchedule = cats.find(c => c.name === '팀 일정');
      if (teamSchedule && teamSchedule.id !== cats[0].id) {
        defaultIds.push(teamSchedule.id);
      }
      setSelectedCategoryIds(defaultIds);
    }
    setIsLoading(false);
  }, [loadCategories, selectedCategoryIds.length]);

  // Load tasks when category changes
  useEffect(() => {
    loadTasks();
  }, [loadTasks]);

  // Load collectionGroups from calendar settings in localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem('calendar-settings');
      if (saved) {
        const settings = JSON.parse(saved);
        if (settings.collectionGroups && Array.isArray(settings.collectionGroups)) {
          setCollectionGroups(settings.collectionGroups);
        }
      }
    } catch (e) {
      console.error('Failed to load collectionGroups:', e);
    }
  }, []);

  // Keyboard shortcuts: Ctrl+` (sidebar toggle), Ctrl+1/2/3 (layout switch), Ctrl+6~0 (presets), Ctrl+Arrow (view toggle)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl + ` : Toggle sidebar
      if ((e.ctrlKey || e.metaKey) && e.key === '`') {
        e.preventDefault();
        setIsSidebarVisible(prev => {
          const newValue = !prev;
          saveLayoutState({ isSidebarVisible: newValue });
          return newValue;
        });
      }
      // Ctrl + 1/2/3 : Switch layout
      if ((e.ctrlKey || e.metaKey) && !e.shiftKey && ['1', '2', '3'].includes(e.key)) {
        e.preventDefault();
        const newLayout = parseInt(e.key) as Layout;
        setLayoutState(newLayout);
        saveLayoutState({ layout: newLayout });
      }
      // Ctrl + Left/Right Arrow : Cycle through Calendar -> Keep -> Favorites
      if ((e.ctrlKey || e.metaKey) && (e.key === 'ArrowLeft' || e.key === 'ArrowRight')) {
        e.preventDefault();
        setViewMode(prev => {
          if (e.key === 'ArrowRight') {
            // Calendar -> Favorites -> Keep -> Calendar
            if (prev === 'calendar') return 'favorites';
            if (prev === 'favorites') return 'keep';
            return 'calendar';
          } else {
            // ArrowLeft (Reverse)
            // Calendar <- Favorites <- Keep <- Calendar
            if (prev === 'calendar') return 'keep';
            if (prev === 'keep') return 'favorites';
            return 'calendar';
          }
        });
      }

      // Layout Presets: Ctrl+6~0 (load), Ctrl+Shift+6~0 (save)
      // Use event.code instead of event.key because Shift changes the key value
      const presetCodes = ['Digit6', 'Digit7', 'Digit8', 'Digit9', 'Digit0'];
      if ((e.ctrlKey || e.metaKey) && presetCodes.includes(e.code)) {
        e.preventDefault();
        const presetIndex = presetCodes.indexOf(e.code);

        if (e.shiftKey) {
          // Save current state to preset
          const currentState: LayoutState = {
            layout,
            taskListWidth,
            isSidebarVisible,
            showWeekends,
          };
          saveLayoutPreset(presetIndex, currentState);
          // Show brief notification (optional)
          console.log(`프리셋 ${presetIndex + 1} 저장됨`);
        } else {
          // Load preset
          const preset = getLayoutPreset(presetIndex);
          if (preset) {
            setLayoutState(preset.layout);
            setTaskListWidth(preset.taskListWidth);
            setIsSidebarVisible(preset.isSidebarVisible);
            setShowWeekends(preset.showWeekends);
            saveLayoutState(preset); // Also update auto-save state
            console.log(`프리셋 ${presetIndex + 1} 불러옴`);
          } else {
            console.log(`프리셋 ${presetIndex + 1} 없음`);
          }
        }
      }
      // Search: Ctrl + K
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        setIsSearchOpen(prev => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [layout, taskListWidth, isSidebarVisible, showWeekends]);

  // Load layout state from localStorage on mount
  useEffect(() => {
    const savedState = getLayoutState();
    setLayoutState(savedState.layout);
    setTaskListWidth(savedState.taskListWidth);
    setIsSidebarVisible(savedState.isSidebarVisible);
    setShowWeekends(savedState.showWeekends);
  }, []);

  // Theme initialization and application
  useEffect(() => {
    const savedTheme = getTheme();
    setThemeState(savedTheme);
    document.documentElement.classList.toggle('dark', savedTheme === 'dark');
  }, []);

  const toggleTheme = () => {
    const newTheme = theme === 'light' ? 'dark' : 'light';
    setThemeState(newTheme);
    setTheme(newTheme);
    document.documentElement.classList.toggle('dark', newTheme === 'dark');
  };

  // Handle resize - layout-aware
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing || !containerRef.current) return;

      const containerRect = containerRef.current.getBoundingClientRect();
      const sidebarWidth = isSidebarVisible ? 300 : 0;

      let newWidth: number;

      // Calculate based on layout
      if (layout === 3) {
        // Layout 3: Calendar | ResizeHandle | TaskList | Sidebar
        // TaskList width = distance from mouse to left edge of Sidebar
        newWidth = containerRect.right - sidebarWidth - e.clientX;
      } else if (layout === 2) {
        // Layout 2: Sidebar | Calendar | TaskList
        // TaskList is on right, width = container right - mouse position
        newWidth = containerRect.right - e.clientX;
      } else {
        // Layout 1: Sidebar | TaskList | Calendar
        // TaskList is after sidebar
        newWidth = e.clientX - containerRect.left - sidebarWidth;
      }

      // Clamp between 250 and 600
      const clampedWidth = Math.max(250, Math.min(600, newWidth));
      setTaskListWidth(clampedWidth);
    };

    const handleMouseUp = () => {
      setIsResizing(false);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      // Save taskListWidth when resize ends
      saveLayoutState({ taskListWidth });
    };

    if (isResizing) {
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    }

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isResizing, isSidebarVisible, layout, taskListWidth]);

  const handleCategoriesChange = () => {
    const cats = loadCategories();
    // Keep only valid category IDs
    setSelectedCategoryIds(prev => {
      const validIds = prev.filter(id => cats.some(c => c.id === id));
      return validIds.length > 0 ? validIds : (cats.length > 0 ? [cats[0].id] : []);
    });
  };

  const handleTasksChange = () => {
    loadTasks();
    setNotesVersion(prev => prev + 1);
  };

  const handleTaskUpdate = (taskId: string, updates: Partial<Task>) => {
    import('@/lib/storage').then(({ updateTask }) => {
      updateTask(taskId, updates);
      handleTasksChange();
    });
  };

  const handleDataChange = () => {
    // Force reload to apply all imported settings (Theme, Layout, Notes, etc.)
    window.location.reload();
  };

  const handleDateClick = (date: Date) => {
    // Priority: 
    // 1. Currently selected category (if it's NOT 'Team Schedule')
    // 2. First category that is NOT 'Team Schedule'

    let targetCategoryId = selectedCategoryIds[0];
    const scheduleCategory = categories.find(c => c.name === '팀 일정');

    // If current selection is Team Schedule (or empty), try to find a better one
    if (scheduleCategory && targetCategoryId === scheduleCategory.id) {
      const defaultCategory = categories.find(c => c.name !== '팀 일정');
      if (defaultCategory) {
        targetCategoryId = defaultCategory.id;
      }
    }

    if (targetCategoryId) {
      // Ensure the target category is visible
      if (!selectedCategoryIds.includes(targetCategoryId)) {
        setSelectedCategoryIds(prev => [...prev, targetCategoryId]);
      }

      // Ensure the target category is visible
      if (!selectedCategoryIds.includes(targetCategoryId)) {
        setSelectedCategoryIds(prev => [...prev, targetCategoryId]);
      }

      // Create a temporary task object (not saved to storage yet)
      const tempTask: Task = {
        id: generateId(), // Temporary ID
        categoryId: targetCategoryId,
        title: '',
        assignee: '',
        resourceUrl: '',
        notes: '',
        dueDate: date.toISOString(),
        dueTime: null,
        tags: [],
        completed: false,
        completedAt: null,
        isPinned: false,
        order: -1,
        createdAt: new Date().toISOString()
      };

      setDetailTask(tempTask);
    }
  };

  const handleTaskDrop = (taskId: string, newDate: Date) => {
    // Find the task to get its categoryId
    const task = tasks.find(t => t.id === taskId);
    if (!task) return;

    import('@/lib/storage').then(({ updateTask, sortTasksByDate }) => {
      updateTask(taskId, { dueDate: newDate.toISOString() });
      // Sort tasks by date after updating
      sortTasksByDate(task.categoryId);
      loadTasks();
    });
  };

  const handleTaskCopy = (taskId: string, newDate: Date) => {
    const task = tasks.find(t => t.id === taskId);
    if (!task) return;

    import('@/lib/storage').then(({ addTask, updateTask, sortTasksByDate }) => {
      // Create a new task via addTask to handle ID generation and defaults
      const newTask = addTask(task.categoryId, task.title, newDate.toISOString());

      // Update other properties to match the original task
      updateTask(newTask.id, {
        assignee: task.assignee,
        resourceUrl: task.resourceUrl,
        notes: task.notes,
        dueTime: task.dueTime,
        tags: task.tags,
        // We explicitly default to not completed for a new copy
        completed: false,
        completedAt: null
      });

      loadTasks();
    });
  };

  // Handle category selection with Ctrl support
  const handleSelectCategory = (categoryId: string, ctrlKey: boolean) => {
    if (ctrlKey) {
      // Toggle in multi-select
      setSelectedCategoryIds(prev =>
        prev.includes(categoryId)
          ? prev.filter(id => id !== categoryId)
          : [...prev, categoryId]
      );
    } else {
      // Single select
      setSelectedCategoryIds([categoryId]);
    }
  };

  const handleScheduleImport = useCallback((schedules: ParsedSchedule[]) => {
    // 1. Find or create "Team Schedule" category
    let scheduleCategory = categories.find(c => c.name === '팀 일정');
    if (!scheduleCategory) {
      scheduleCategory = addCategory('팀 일정');
    }

    // 2. Clear existing tasks in the Team Schedule category (Smart Overwrite Strategy)
    // Identify which months are included in the new schedules
    const targetMonths = new Set<string>();
    schedules.forEach(s => {
      // Format: "YYYY-MM"
      const yearMonth = `${s.date.getFullYear()}-${s.date.getMonth()}`;
      targetMonths.add(yearMonth);
    });

    // Backup map to preserve user data: Key = "YYYY-MM-DD|Title"
    // We strive to keep: resourceUrl, notes, tags, isPinned
    const backupMap = new Map<string, Partial<Task>>();

    const existingTasks = getTasks(scheduleCategory.id);
    existingTasks.forEach(t => {
      // Only protect tasks explicitly marked as 'manual'
      // Tasks with source: 'team' or undefined (legacy) will be deleted and re-created
      if (t.source === 'manual') {
        return; // Preserve only explicitly manual tasks
      }

      if (t.dueDate) {
        const taskDate = new Date(t.dueDate);
        const taskYearMonth = `${taskDate.getFullYear()}-${taskDate.getMonth()}`;

        // Only delete tasks that belong to the months we are about to update
        if (targetMonths.has(taskYearMonth)) {
          // Create backup key
          const dateStr = format(taskDate, 'yyyy-MM-dd');
          // We use Title matching. Note: Schedule parser trims titles.
          // Ideally we match by Title + Date. Time might change slightly or formatting differences.
          // But strict matching (Date + Title) is a good baseline.
          const key = `${dateStr}|${t.title.trim()}`;

          backupMap.set(key, {
            resourceUrl: t.resourceUrl,
            notes: t.notes,
            tags: t.tags,
            isPinned: t.isPinned,
            completed: t.completed // Keep completion status too if desired? User didn't ask but good to have.
          });

          deleteTask(t.id);
        }
      }
    });

    // 3. Add new tasks
    schedules.forEach(schedule => {
      if (!scheduleCategory) return;

      // Check if we have backup data for this item
      const dateStr = format(schedule.date, 'yyyy-MM-dd');
      const key = `${dateStr}|${schedule.title.trim()}`;
      const backup = backupMap.get(key);

      // Use addTask helper which handles ID generation
      const newTask = addTask(
        scheduleCategory.id,
        schedule.title,
        schedule.date.toISOString(),
        {
          dueTime: schedule.time,
          highlightLevel: schedule.highlightLevel,
          organizer: schedule.organizer,
          source: 'team' // Mark as team schedule import
        }
      );

      // Restore user data if backup exists
      if (backup) {
        updateTask(newTask.id, {
          resourceUrl: backup.resourceUrl,
          notes: backup.notes,
          tags: backup.tags,
          isPinned: backup.isPinned,
          completed: backup.completed
        });
        // Remove from backup map to mark as handled
        backupMap.delete(key);
      }
    });

    // 4. Handle Orphaned Data (Save to Keep)
    // Any items remaining in backupMap were deleted but not matched to a new schedule.
    // Save their valuable data (notes, URL) to Keep.
    let orphanedCount = 0;
    if (backupMap.size > 0) {
      backupMap.forEach((data, key) => {
        // Only save if there is actually data to preserve (URL, Notes, or Tags)
        if (data.resourceUrl || data.notes || (data.tags && data.tags.length > 0)) {
          const [dateStr, title] = key.split('|');
          // Build content (without title - title goes to note.title)
          let noteContent = '';
          if (data.resourceUrl) noteContent += `🔗 자료: ${data.resourceUrl}\n`;
          if (data.tags && data.tags.length > 0) noteContent += `🏷️ 태그: ${data.tags.join(', ')}\n`;
          if (data.notes) noteContent += `📝 메모:\n${data.notes}`;

          // Save to Keep and Pin it for easy access (Sidebar)
          // addNote(title, content, color) - use proper parameter order
          const noteTitle = `[자동백업] ${dateStr} ${title}`;
          const newNote = addNote(noteTitle, noteContent, 'yellow');
          // We need to pin it so it shows up in the sidebar for easy Drag & Drop
          // Use synchronous update to ensure state is ready before setNotesVersion triggers re-render
          updateNote(newNote.id, { isPinned: true });

          orphanedCount++;
        }
      });
    }

    // 5. Reload
    loadCategories();
    loadTasks();
    setNotesVersion(prev => prev + 1);

    // 6. Ensure the schedule category is selected so user sees it immediately
    if (scheduleCategory && !selectedCategoryIds.includes(scheduleCategory.id)) {
      setSelectedCategoryIds(prev => [...prev, scheduleCategory!.id]);
    }

    // 7. Notification (Stay on calendar view)
    // Use setTimeout to allow UI updates to flush first
    setTimeout(() => {
      if (orphanedCount > 0) {
        // Just notify user, don't switch view - pinned memos are visible in sidebar
        window.alert(`총 ${schedules.length}개의 일정이 업데이트되었습니다.\n\n⚠️ ${orphanedCount}개의 변경된 일정 데이터가 사이드바 [고정 메모]에 안전하게 백업되었습니다.\n\n사이드바에서 메모를 캘린더 일정 위로 드래그하여 병합할 수 있습니다.`);
      } else {
        window.alert(`총 ${schedules.length}개의 일정이 성공적으로 업데이트되었습니다.`);
      }
    }, 100);
  }, [categories, selectedCategoryIds, loadCategories, loadTasks, setViewMode]);

  // Listen for 'SCHEDULE_SYNC' messages from Chrome Extension
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      // Expect event.data to have { type: 'SCHEDULE_SYNC', text: string, year?: number, month?: number }
      if (event.data?.type === 'SCHEDULE_SYNC' && event.data?.text) {
        try {
          // Use provided year/month or fallback to current state
          const year = event.data.year || currentMonth.getFullYear();
          const month = event.data.month !== undefined ? event.data.month : currentMonth.getMonth();

          console.log(`Auto-syncing schedule for ${year}-${month + 1}`);

          const result = parseScheduleText(event.data.text, year, month);

          if (result.length > 0) {
            handleScheduleImport(result);
            // Show a simple browser notification or alert (optional, keeping it silent or subtle is better for automation)
            console.log('Schedule synced successfully via extension');
          } else {
            console.warn('Sync received but no schedules parsed');
          }
        } catch (e) {
          console.error('Auto sync failed:', e);
        }
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [currentMonth, handleScheduleImport]);

  const selectedCategory = categories.find(c => selectedCategoryIds.includes(c.id)) || null;

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="text-gray-500">로딩 중...</div>
      </div>
    );
  }

  return (
    <div ref={containerRef} className={`flex h-screen relative transition-colors duration-300 ${theme === 'dark' ? 'bg-gray-900' : 'bg-gray-50'}`}>
      {/* Theme Toggle Button Removed as per request */}

      {/* Sidebar Toggle Button - position based on layout */}
      <Button
        variant="ghost"
        size="sm"
        onClick={() => setIsSidebarVisible(!isSidebarVisible)}
        className={`absolute top-4 z-50 bg-white shadow-md hover:shadow-lg transition-all duration-200 ${layout === 3
          ? (isSidebarVisible ? 'right-[252px]' : 'right-4')
          : (isSidebarVisible ? 'left-[252px]' : 'left-4')
          }`}
        title={isSidebarVisible ? "사이드바 숨기기 (Ctrl+`)" : "사이드바 보이기 (Ctrl+`)"}
      >
        {isSidebarVisible ? (
          <PanelLeftClose className="w-5 h-5" />
        ) : (
          <PanelLeft className="w-5 h-5" />
        )}
      </Button>

      {/* Define reusable panel elements */}
      {(() => {
        const sidebarPanel = (
          <AnimatePresence key="sidebar">
            {isSidebarVisible && (
              <motion.div
                initial={{ width: 0, opacity: 0 }}
                animate={{ width: 300, opacity: 1 }}
                exit={{ width: 0, opacity: 0 }}
                transition={{ duration: 0.2, ease: "easeInOut" }}
                className="overflow-hidden flex-shrink-0"
              >
                <Sidebar
                  categories={categories}
                  selectedCategoryIds={selectedCategoryIds}
                  tasks={tasks}
                  currentMonth={currentMonth}
                  selectedDate={selectedDate}
                  onSelectCategory={handleSelectCategory}
                  onCategoriesChange={handleCategoriesChange}
                  onExportClick={() => setDialogType('export')}
                  onImportClick={() => setDialogType('import')}
                  onMonthChange={setCurrentMonth}
                  onDateSelect={(date) => {
                    setSelectedDate(date);
                    setCurrentMonth(date);
                  }}
                  onImportSchedule={() => setIsScheduleImportOpen(true)}
                  onPinnedMemoClick={(noteId) => {
                    setViewMode('keep');
                    if (noteId) {
                      setSelectedNoteId(noteId);
                    }
                  }}
                  notesVersion={notesVersion}
                />

              </motion.div>
            )}
          </AnimatePresence>
        );

        const taskListPanel = (
          <div
            key="tasklist"
            className="flex-shrink-0 bg-white overflow-hidden"
            style={{
              width: taskListWidth,
              transition: isResizing ? 'none' : 'width 0.15s ease-out'
            }}
          >
            <TaskList
              category={selectedCategory}
              categories={categories}
              tasks={tasks.filter(t => {
                const category = categories.find(c => c.id === t.categoryId);
                return category?.name !== '팀 일정';
              })}
              onTasksChange={handleTasksChange}
              collectionGroups={collectionGroups}
            />
          </div>
        );

        const resizeHandle = (
          <div
            key="resize-handle"
            className={`w-2 flex-shrink-0 cursor-col-resize group ${isResizing ? 'bg-blue-500' : 'bg-gray-100 hover:bg-blue-400'}`}
            onMouseDown={(e) => {
              e.preventDefault();
              setIsResizing(true);
            }}
          >
            <div className={`w-full h-full flex items-center justify-center ${isResizing ? '' : 'opacity-0 group-hover:opacity-100'} transition-opacity`}>
              <div className="w-0.5 h-8 bg-gray-400 rounded-full" />
            </div>
          </div>
        );

        const mainPanel = (
          <div key="main-view" className="flex-1 overflow-hidden">
            {viewMode === 'calendar' ? (
              <CalendarView
                tasks={tasks}
                categories={categories}
                currentMonth={currentMonth}
                selectedDate={selectedDate}
                showWeekends={showWeekends}
                onShowWeekendsChange={(show) => {
                  setShowWeekends(show);
                  saveLayoutState({ showWeekends: show });
                }}
                onTaskClick={(task) => setDetailTask(task)}
                onDateClick={handleDateClick}
                onMonthChange={setCurrentMonth}
                onTaskDrop={handleTaskDrop}
                onTaskCopy={handleTaskCopy}
                onTaskDelete={handleTasksChange}
                onDataChange={handleTasksChange}
              />
            ) : viewMode === 'keep' ? (
              <KeepView
                selectedNoteId={selectedNoteId}
                onNoteSelected={() => setSelectedNoteId(null)}
                onNotesChange={() => setNotesVersion(v => v + 1)}
              />
            ) : viewMode === 'favorites' ? (
              <FavoritesView
                categories={categories}
                onTaskClick={(task) => setDetailTask(task)}
                onNoteClick={(noteId) => {
                  setViewMode('keep');
                  setSelectedNoteId(noteId);
                }}
                onDataChange={handleTasksChange}
                onScheduleClick={(task) => {
                  setEditingScheduleTask(task);
                  setIsTeamScheduleModalOpen(true);
                }}
              />
            ) : null}
          </div>
        );

        // Render based on layout
        // Layout 1: Sidebar | TaskList | ResizeHandle | Calendar (Default)
        // Layout 2: Sidebar | Calendar | ResizeHandle | TaskList
        // Layout 3: Calendar | ResizeHandle | TaskList | Sidebar
        if (layout === 2) {
          return <>{sidebarPanel}{mainPanel}{resizeHandle}{taskListPanel}</>;
        } else if (layout === 3) {
          return <>{mainPanel}{resizeHandle}{taskListPanel}{sidebarPanel}</>;
        } else {
          // Layout 1 (default)
          return <>{sidebarPanel}{taskListPanel}{resizeHandle}{mainPanel}</>;
        }
      })()}

      {/* Task Detail Dialog */}
      <TaskDetailDialog
        task={detailTask}
        isOpen={!!detailTask}
        onClose={() => setDetailTask(null)}
        onTaskChange={handleTasksChange}
        isNewTask={detailTask ? !tasks.find(t => t.id === detailTask.id) : false}
        collectionGroups={collectionGroups}
      />

      <ImportExportDialog
        type={dialogType}
        onClose={() => setDialogType(null)}
        onDataChange={handleDataChange}
      />

      <ScheduleImportDialog
        isOpen={isScheduleImportOpen}
        onClose={() => setIsScheduleImportOpen(false)}
        onImport={handleScheduleImport}
        currentYear={currentMonth.getFullYear()}
        currentMonth={currentMonth.getMonth()} // 0-indexed
      />

      <TeamScheduleAddModal
        isOpen={isTeamScheduleModalOpen}
        onClose={() => {
          setIsTeamScheduleModalOpen(false);
          setEditingScheduleTask(null);
        }}
        onScheduleAdded={handleTasksChange}
        initialDate={new Date()} // Not used for edit
        teamScheduleCategoryId={categories.find(c => c.name === '팀 일정')?.id || ''}
        existingTask={editingScheduleTask}
      />
      <SearchCommandDialog
        isOpen={isSearchOpen}
        onClose={() => setIsSearchOpen(false)}
        onSelectTask={(task) => {
          setDetailTask(task);
        }}
        onSelectNote={(noteId) => {
          setViewMode('keep');
          // Wait for view switch then select?
          // We might need a way to pass 'initialSelectedNoteId' or similar.
          // For now, let's just switch view.
          // Actually, sidebar has onPinnedMemoClick which does setSelectedNoteId if we expose it?
          // Page doesn't have direct access to keepView state unless lifted.
          // But we have setSelectedNoteId in page!
          setSelectedNoteId(noteId);
        }}
      />
    </div>
  );
}
