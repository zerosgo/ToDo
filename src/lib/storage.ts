import { Category, Task, AppData, CATEGORY_COLORS } from './types';

const STORAGE_KEY = 'local-tasks-data';

// Generate unique ID
export function generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

// Get all data from LocalStorage
export function getData(): AppData {
    if (typeof window === 'undefined') {
        return { categories: [], tasks: [] };
    }

    const data = localStorage.getItem(STORAGE_KEY);
    if (!data) {
        // Initialize with default category
        const defaultData: AppData = {
            categories: [
                {
                    id: generateId(),
                    name: '내 할 일',
                    color: CATEGORY_COLORS[0].value,
                    order: 0,
                    createdAt: new Date().toISOString(),
                },
            ],
            tasks: [],
        };
        saveData(defaultData);
        return defaultData;
    }

    return JSON.parse(data);
}

// Save all data to LocalStorage
export function saveData(data: AppData): void {
    if (typeof window === 'undefined') return;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

// Category CRUD
export function getCategories(): Category[] {
    return getData().categories.sort((a, b) => a.order - b.order);
}

export function addCategory(name: string): Category {
    const data = getData();
    const maxOrder = Math.max(...data.categories.map(c => c.order), -1);
    const colorIndex = data.categories.length % CATEGORY_COLORS.length;
    const newCategory: Category = {
        id: generateId(),
        name,
        color: CATEGORY_COLORS[colorIndex].value,
        order: maxOrder + 1,
        createdAt: new Date().toISOString(),
    };
    data.categories.push(newCategory);
    saveData(data);
    return newCategory;
}

export function updateCategory(id: string, updates: Partial<Category>): Category | null {
    const data = getData();
    const index = data.categories.findIndex(c => c.id === id);
    if (index === -1) return null;

    data.categories[index] = { ...data.categories[index], ...updates };
    saveData(data);
    return data.categories[index];
}

export function deleteCategory(id: string): boolean {
    const data = getData();
    const index = data.categories.findIndex(c => c.id === id);
    if (index === -1) return false;

    // Delete all tasks in this category
    data.tasks = data.tasks.filter(t => t.categoryId !== id);
    data.categories.splice(index, 1);
    saveData(data);
    return true;
}

// Task CRUD
export function getTasks(categoryId?: string): Task[] {
    const data = getData();
    let tasks = data.tasks;
    if (categoryId) {
        tasks = tasks.filter(t => t.categoryId === categoryId);
    }
    return tasks.sort((a, b) => a.order - b.order);
}

// Get all unique tags from all tasks
export function getAllTags(): string[] {
    const data = getData();
    const tagSet = new Set<string>();
    data.tasks.forEach(task => {
        if (task.tags) {
            task.tags.forEach(tag => tagSet.add(tag));
        }
    });
    return Array.from(tagSet).sort();
}

export function addTask(categoryId: string, title: string, dueDate?: string | null, options: Partial<Task> = {}): Task {
    const data = getData();
    const categoryTasks = data.tasks.filter(t => t.categoryId === categoryId);
    const maxOrder = Math.max(...categoryTasks.map(t => t.order), -1);

    const newTask: Task = {
        id: generateId(),
        categoryId,
        title,
        assignee: '',
        resourceUrl: '',
        notes: '',
        dueDate: dueDate || null,
        dueTime: null,
        tags: [],
        completed: false,
        completedAt: null,
        isPinned: false,
        order: maxOrder + 1,
        createdAt: new Date().toISOString(),
        ...options // Spread additional options like dueTime
    };

    data.tasks.push(newTask);
    saveData(data);

    // Auto-sort by due date after adding
    sortTasksByDate(categoryId);

    return newTask;
}

export function updateTask(id: string, updates: Partial<Task>): Task | null {
    const data = getData();
    const index = data.tasks.findIndex(t => t.id === id);
    if (index === -1) return null;

    data.tasks[index] = { ...data.tasks[index], ...updates };
    saveData(data);
    return data.tasks[index];
}

export function deleteTask(id: string): boolean {
    const data = getData();
    const index = data.tasks.findIndex(t => t.id === id);
    if (index === -1) return false;

    data.tasks.splice(index, 1);
    saveData(data);
    return true;
}

export function restoreTask(task: Task): void {
    const data = getData();
    data.tasks.push(task);
    saveData(data);
}

export function toggleTaskComplete(id: string): Task | null {
    const data = getData();
    const index = data.tasks.findIndex(t => t.id === id);
    if (index === -1) return null;

    const newCompleted = !data.tasks[index].completed;
    data.tasks[index].completed = newCompleted;
    data.tasks[index].completedAt = newCompleted ? new Date().toISOString() : null;
    saveData(data);
    return data.tasks[index];
}

// Reorder tasks
export function reorderTasks(categoryId: string, taskIds: string[]): void {
    const data = getData();
    taskIds.forEach((id, index) => {
        const taskIndex = data.tasks.findIndex(t => t.id === id);
        if (taskIndex !== -1) {
            data.tasks[taskIndex].order = index;
        }
    });
    saveData(data);
}

// Sort tasks by date (only non-completed tasks)
export function sortTasksByDate(categoryId: string): void {
    const data = getData();

    // Only sort non-completed tasks
    const activeTasks = data.tasks
        .filter(t => t.categoryId === categoryId && !t.completed)
        .sort((a, b) => {
            // Tasks without due date go to the end
            if (!a.dueDate && !b.dueDate) return 0;
            if (!a.dueDate) return 1;
            if (!b.dueDate) return -1;
            return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
        });

    activeTasks.forEach((task, index) => {
        const taskIndex = data.tasks.findIndex(t => t.id === task.id);
        if (taskIndex !== -1) {
            data.tasks[taskIndex].order = index;
        }
    });

    saveData(data);
}

// Export data as JSON (includes all data including notes, settings, layout)
export function exportData(): string {
    const data = getData();
    const quickLinks = getQuickLinks();
    const notes = getNotes();
    const theme = getTheme();
    const layoutState = getLayoutState();
    const layoutPresets = getAllLayoutPresets();

    // Calendar settings (read directly from localStorage as it's not managed fully in storage.ts)
    const calendarSettings = typeof window !== 'undefined' ? localStorage.getItem('calendar-settings') : null;

    return JSON.stringify({
        version: 2,
        timestamp: new Date().toISOString(),
        data,
        quickLinks,
        notes,
        theme,
        layoutState,
        layoutPresets,
        calendarSettings: calendarSettings ? JSON.parse(calendarSettings) : null
    }, null, 2);
}

// Import data from JSON
export function importData(jsonString: string): boolean {
    try {
        const parsed = JSON.parse(jsonString);

        if (typeof window === 'undefined') return false;

        // 1. Core Data (Tasks & Categories)
        if (parsed.data && parsed.data.categories) {
            saveData(parsed.data);
        } else if (Array.isArray(parsed.categories) && Array.isArray(parsed.tasks)) {
            // Legacy format support
            saveData(parsed as AppData);
        }

        // 2. Quick Links
        if (parsed.quickLinks) {
            saveQuickLinks(parsed.quickLinks);
        }

        // 3. Notes (Keep)
        if (parsed.notes) {
            saveNotes(parsed.notes);
        }

        // 4. Theme
        if (parsed.theme) {
            setTheme(parsed.theme);
        }

        // 5. Layout State
        if (parsed.layoutState) {
            localStorage.setItem(LAYOUT_STATE_KEY, JSON.stringify(parsed.layoutState));
        }

        // 6. Layout Presets
        if (parsed.layoutPresets) {
            localStorage.setItem(LAYOUT_PRESETS_KEY, JSON.stringify(parsed.layoutPresets));
        }

        // 7. Calendar Settings
        if (parsed.calendarSettings) {
            localStorage.setItem('calendar-settings', JSON.stringify(parsed.calendarSettings));
        }

        return true;
    } catch (error) {
        console.error('Import failed:', error);
        return false;
    }
}

// Quick Links - stored separately
const QUICK_LINKS_KEY = 'local-tasks-quick-links';

import { QuickLink } from './types';

export function getQuickLinks(): QuickLink[] {
    if (typeof window === 'undefined') return [];
    const data = localStorage.getItem(QUICK_LINKS_KEY);
    if (!data) return [];
    return JSON.parse(data).sort((a: QuickLink, b: QuickLink) => a.order - b.order);
}

export function saveQuickLinks(links: QuickLink[]): void {
    if (typeof window === 'undefined') return;
    localStorage.setItem(QUICK_LINKS_KEY, JSON.stringify(links));
}

export function addQuickLink(name: string, url: string, options: Partial<QuickLink> = {}): QuickLink {
    const links = getQuickLinks();
    const maxOrder = Math.max(...links.map(l => l.order), -1);
    const newLink: QuickLink = {
        id: generateId(),
        name,
        url,
        order: maxOrder + 1,
        ...options
    };
    links.push(newLink);
    saveQuickLinks(links);
    return newLink;
}

export function updateQuickLink(id: string, updates: Partial<QuickLink>): QuickLink | null {
    const links = getQuickLinks();
    const index = links.findIndex(l => l.id === id);
    if (index === -1) return null;
    links[index] = { ...links[index], ...updates };
    saveQuickLinks(links);
    return links[index];
}

export function deleteQuickLink(id: string): boolean {
    const links = getQuickLinks();
    const index = links.findIndex(l => l.id === id);
    if (index === -1) return false;
    links.splice(index, 1);
    saveQuickLinks(links);
    return true;
}

export function reorderQuickLinks(linkIds: string[]): void {
    const links = getQuickLinks();
    linkIds.forEach((id, index) => {
        const linkIndex = links.findIndex(l => l.id === id);
        if (linkIndex !== -1) {
            links[linkIndex].order = index;
        }
    });
    saveQuickLinks(links);
}

// Theme settings
const THEME_KEY = 'local-tasks-theme';

export type Theme = 'light' | 'dark';

export function getTheme(): Theme {
    if (typeof window === 'undefined') return 'light';
    return (localStorage.getItem(THEME_KEY) as Theme) || 'light';
}

export function setTheme(theme: Theme): void {
    if (typeof window === 'undefined') return;
    localStorage.setItem(THEME_KEY, theme);
}

// Layout settings
const LAYOUT_KEY = 'local-tasks-layout';
const LAYOUT_STATE_KEY = 'local-tasks-layout-state';
const LAYOUT_PRESETS_KEY = 'local-tasks-layout-presets';

export type Layout = 1 | 2 | 3;

// Full layout state for persistence
export interface LayoutState {
    layout: Layout;
    taskListWidth: number;
    isSidebarVisible: boolean;
    showWeekends: boolean;
}

// Default layout state
const DEFAULT_LAYOUT_STATE: LayoutState = {
    layout: 1,
    taskListWidth: 400,
    isSidebarVisible: true,
    showWeekends: true,
};

// Get current layout state (auto-saved)
export function getLayoutState(): LayoutState {
    if (typeof window === 'undefined') return DEFAULT_LAYOUT_STATE;
    const data = localStorage.getItem(LAYOUT_STATE_KEY);
    if (!data) return DEFAULT_LAYOUT_STATE;
    try {
        return { ...DEFAULT_LAYOUT_STATE, ...JSON.parse(data) };
    } catch {
        return DEFAULT_LAYOUT_STATE;
    }
}

// Save current layout state (auto-save)
export function saveLayoutState(state: Partial<LayoutState>): void {
    if (typeof window === 'undefined') return;
    const current = getLayoutState();
    const updated = { ...current, ...state };
    localStorage.setItem(LAYOUT_STATE_KEY, JSON.stringify(updated));
}

// Layout presets (5 slots: index 0-4 for Ctrl+6~0)
export interface LayoutPreset extends LayoutState {
    name: string;
    savedAt: string;
}

export function getLayoutPreset(index: number): LayoutPreset | null {
    if (typeof window === 'undefined' || index < 0 || index > 4) return null;
    const data = localStorage.getItem(LAYOUT_PRESETS_KEY);
    if (!data) return null;
    try {
        const presets: (LayoutPreset | null)[] = JSON.parse(data);
        return presets[index] || null;
    } catch {
        return null;
    }
}

export function saveLayoutPreset(index: number, state: LayoutState, name?: string): LayoutPreset | null {
    if (typeof window === 'undefined' || index < 0 || index > 4) return null;

    const data = localStorage.getItem(LAYOUT_PRESETS_KEY);
    const presets: (LayoutPreset | null)[] = data ? JSON.parse(data) : [null, null, null, null, null];

    const preset: LayoutPreset = {
        ...state,
        name: name || `프리셋 ${index + 1}`,
        savedAt: new Date().toISOString(),
    };

    presets[index] = preset;
    localStorage.setItem(LAYOUT_PRESETS_KEY, JSON.stringify(presets));
    return preset;
}

export function getAllLayoutPresets(): (LayoutPreset | null)[] {
    if (typeof window === 'undefined') return [null, null, null, null, null];
    const data = localStorage.getItem(LAYOUT_PRESETS_KEY);
    if (!data) return [null, null, null, null, null];
    try {
        return JSON.parse(data);
    } catch {
        return [null, null, null, null, null];
    }
}

// Legacy functions for backward compatibility
export function getLayout(): Layout {
    return getLayoutState().layout;
}

export function setLayout(layout: Layout): void {
    saveLayoutState({ layout });
}

// Notes storage (Keep-style memos)
const NOTES_KEY = 'local-tasks-notes';

import { Note } from './types';

export function getNotes(): Note[] {
    if (typeof window === 'undefined') return [];
    const data = localStorage.getItem(NOTES_KEY);
    if (!data) return [];
    return JSON.parse(data).sort((a: Note, b: Note) => {
        // Pinned notes first, then by order
        if (a.isPinned !== b.isPinned) return a.isPinned ? -1 : 1;
        return a.order - b.order;
    });
}

function saveNotes(notes: Note[]): void {
    if (typeof window === 'undefined') return;
    localStorage.setItem(NOTES_KEY, JSON.stringify(notes));
}

export function addNote(title: string, content: string = '', color: string = '#ffffff'): Note {
    const notes = getNotes();
    const maxOrder = Math.max(...notes.map(n => n.order), -1);
    const newNote: Note = {
        id: generateId(),
        title,
        content,
        color,
        isPinned: false,
        isArchived: false,
        order: maxOrder + 1,
        createdAt: new Date().toISOString(),
    };
    notes.push(newNote);
    saveNotes(notes);
    return newNote;
}

export function updateNote(id: string, updates: Partial<Note>): Note | null {
    const notes = getNotes();
    const index = notes.findIndex(n => n.id === id);
    if (index === -1) return null;
    notes[index] = { ...notes[index], ...updates };
    saveNotes(notes);
    return notes[index];
}

export function deleteNote(id: string): boolean {
    const notes = getNotes();
    const index = notes.findIndex(n => n.id === id);
    if (index === -1) return false;
    notes.splice(index, 1);
    saveNotes(notes);
    return true;
}

export function reorderNotes(noteIds: string[]): void {
    const notes = getNotes();
    noteIds.forEach((id, index) => {
        const noteIndex = notes.findIndex(n => n.id === id);
        if (noteIndex !== -1) {
            notes[noteIndex].order = index;
        }
    });
    saveNotes(notes);
}
// Labels storage
const LABELS_KEY = 'local-tasks-labels';

import { Label } from './types';

export function getLabels(): Label[] {
    if (typeof window === 'undefined') return [];
    const data = localStorage.getItem(LABELS_KEY);
    if (!data) return [];
    return JSON.parse(data).sort((a: Label, b: Label) => a.name.localeCompare(b.name));
}

function saveLabels(labels: Label[]): void {
    if (typeof window === 'undefined') return;
    localStorage.setItem(LABELS_KEY, JSON.stringify(labels));
}

export function addLabel(name: string): Label {
    const labels = getLabels();
    const newLabel: Label = {
        id: generateId(),
        name,
    };
    labels.push(newLabel);
    saveLabels(labels);
    return newLabel;
}

export function updateLabel(id: string, name: string): Label | null {
    const labels = getLabels();
    const index = labels.findIndex(l => l.id === id);
    if (index === -1) return null;
    labels[index] = { ...labels[index], name };
    saveLabels(labels);
    return labels[index];
}

export function deleteLabel(id: string): boolean {
    const labels = getLabels();
    const index = labels.findIndex(l => l.id === id);
    if (index === -1) return false;

    // Also remove this label from getAllNotes
    const notes = getNotes();
    let notesChanged = false;
    notes.forEach(note => {
        if (note.labels?.includes(id)) {
            note.labels = note.labels.filter(labelId => labelId !== id);
            notesChanged = true;
        }
    });

    if (notesChanged) {
        saveNotes(notes);
    }

    labels.splice(index, 1);
    saveLabels(labels);
    return true;
}
