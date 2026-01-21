"use client";

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Category, Task } from '@/lib/types';
import { getCategories, getTasks, addTask, getTheme, setTheme, Theme, getLayoutState, saveLayoutState, getLayoutPreset, saveLayoutPreset, Layout, LayoutState, generateId, addCategory, deleteTask } from '@/lib/storage';
import { Sidebar } from '@/components/sidebar';
import { TaskList } from '@/components/task-list';
import { CalendarView } from '@/components/calendar-view';
import { KeepView } from '@/components/keep-view';
import { TaskDetailDialog } from '@/components/task-detail-dialog';
import { ImportExportDialog } from '@/components/import-export-dialog';
import { ScheduleImportDialog } from '@/components/schedule-import-dialog';
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
  const [viewMode, setViewMode] = useState<'calendar' | 'keep'>('calendar');
  const [selectedNoteId, setSelectedNoteId] = useState<string | null>(null);
  const [notesVersion, setNotesVersion] = useState(0);
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
      // Ctrl + Left/Right Arrow : Toggle between Calendar and Keep
      if ((e.ctrlKey || e.metaKey) && (e.key === 'ArrowLeft' || e.key === 'ArrowRight')) {
        e.preventDefault();
        setViewMode(prev => prev === 'calendar' ? 'keep' : 'calendar');
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
  };

  const handleDataChange = () => {
    const cats = loadCategories();
    if (cats.length > 0) {
      setSelectedCategoryIds([cats[0].id]);
    } else {
      setSelectedCategoryIds([]);
    }
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

    // 2. Clear existing tasks in the Team Schedule category (Overwrite Strategy)
    const existingTasks = getTasks(scheduleCategory.id);
    existingTasks.forEach(t => deleteTask(t.id));

    // 3. Add new tasks
    schedules.forEach(schedule => {
      if (!scheduleCategory) return;

      // Use addTask helper which handles ID generation
      addTask(
        scheduleCategory.id,
        schedule.title,
        schedule.date.toISOString(),
        { dueTime: schedule.time, highlightLevel: schedule.highlightLevel }
      );
    });

    // 4. Reload
    loadCategories();
    loadTasks();

    // 5. Ensure the schedule category is selected so user sees it immediately
    if (scheduleCategory && !selectedCategoryIds.includes(scheduleCategory.id)) {
      setSelectedCategoryIds(prev => [...prev, scheduleCategory!.id]);
    }
  }, [categories, selectedCategoryIds, loadCategories, loadTasks]);

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
            ) : (
              <KeepView
                selectedNoteId={selectedNoteId}
                onNoteSelected={() => setSelectedNoteId(null)}
                onNotesChange={() => setNotesVersion(v => v + 1)}
              />
            )}
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
    </div>
  );
}
