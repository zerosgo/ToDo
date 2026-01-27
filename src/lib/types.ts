export interface Category {
    id: string;
    name: string;
    color: string; // hex color code like #3b82f6
    order: number;
    createdAt: string;
}

// Subtask for checklist within a task
export interface Subtask {
    id: string;
    title: string;
    completed: boolean;
}

export interface Task {
    id: string;
    categoryId: string;
    title: string;
    assignee: string;
    organizer?: string; // 주관자 (이름 / 소속)
    resourceUrl: string;
    notes: string;
    dueDate: string | null;
    dueTime: string | null; // HH:mm format like "14:30"
    tags: string[]; // Array of tag names
    completed: boolean;
    completedAt: string | null; // ISO date when task was completed
    order: number;
    createdAt: string;
    isPinned?: boolean;
    isFavorite?: boolean; // For favorites view
    highlightLevel?: 0 | 1 | 2 | 3; // 0=none, 1=Blue, 2=Green, 3=Purple
    subtasks?: Subtask[]; // Checklist items
}

export interface AppData {
    categories: Category[];
    tasks: Task[];
    quickLinks?: QuickLink[];
}

// Predefined color palette for categories
export const CATEGORY_COLORS = [
    { name: '파랑', value: '#3b82f6' },
    { name: '초록', value: '#22c55e' },
    { name: '빨강', value: '#ef4444' },
    { name: '주황', value: '#f97316' },
    { name: '보라', value: '#a855f7' },
    { name: '분홍', value: '#ec4899' },
    { name: '청록', value: '#06b6d4' },
    { name: '노랑', value: '#eab308' },
];

// Quick Link for favorite files
export interface QuickLink {
    id: string;
    name: string;
    url: string;
    order: number;
    isPinned?: boolean;
    isFavorite?: boolean; // For favorites view
}

// Label (Tag) for notes
export interface Label {
    id: string;
    name: string;
}



// Note for Keep-style memos
export interface Note {
    id: string;
    title: string;
    content: string;
    color: string;
    isPinned: boolean;
    isArchived: boolean;
    order: number;
    createdAt: string;
    labels?: string[]; // Array of Label IDs
    isFavorite?: boolean; // For favorites view
}

// Predefined color palette for notes (Google Keep style)
export const NOTE_COLORS = [
    { name: '기본', value: '#ffffff' },
    { name: '노랑', value: '#fff475' },
    { name: '주황', value: '#fbbc04' },
    { name: '빨강', value: '#f28b82' },
    { name: '분홍', value: '#fdcfe8' },
    { name: '보라', value: '#d7aefb' },
    { name: '파랑', value: '#aecbfa' },
    { name: '청록', value: '#cbf0f8' },
    { name: '초록', value: '#ccff90' },
];
