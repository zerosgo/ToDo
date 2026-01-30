"use client";

import React, { useState, useEffect, useRef } from 'react';
import { Task, Category } from '@/lib/types';
import { addTask, reorderTasks, sortTasksByDate } from '@/lib/storage';
import { TaskDetailDialog } from './task-detail-dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Textarea } from '@/components/ui/textarea';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Plus, SortAsc, ArrowUpDown, CheckCircle2, GripVertical, Calendar, FileText, MoreVertical, Trash2, User, Paperclip, Tag, X, Search, Archive, Pin, CalendarDays, ChevronDown, ChevronUp } from 'lucide-react';
import { Reorder, useDragControls, motion, AnimatePresence } from 'framer-motion';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';
import { updateTask, deleteTask, toggleTaskComplete, restoreTask } from '@/lib/storage';

interface TaskListProps {
    category: Category | null;
    categories: Category[];
    tasks: Task[];
    onTasksChange: () => void;
    collectionGroups?: string[];
}

// Inline TaskItem component with Framer Motion drag
function AnimatedTaskItem({
    task,
    categoryColor,
    isSelected,
    onTaskChange,
    onOpenDetail,
    onOpenNotes,
    onTagClick,
    onTogglePin,
    onClick,
    isExpanded,
    onToggleExpand,
}: {
    task: Task;
    categoryColor: string;
    isSelected: boolean;
    onTaskChange: () => void;
    onOpenDetail: (task: Task) => void;
    onOpenNotes: (task: Task) => void;
    onTagClick: (tag: string) => void;
    onTogglePin: (task: Task) => void;
    onClick: () => void;
    isExpanded?: boolean;
    onToggleExpand?: () => void;
}) {
    const dragControls = useDragControls();
    const [isEditing, setIsEditing] = useState(false);
    const [editTitle, setEditTitle] = useState(task.title);

    const [showDeleteDialog, setShowDeleteDialog] = useState(false);
    const [showCopyToast, setShowCopyToast] = useState(false);

    // Subtask editing state
    const [editingSubtaskId, setEditingSubtaskId] = useState<string | null>(null);
    const [editingSubtaskTitle, setEditingSubtaskTitle] = useState('');
    const [editingSubtaskUrl, setEditingSubtaskUrl] = useState('');

    const handleCopyUrl = (url: string) => {
        navigator.clipboard.writeText(url);
        setShowCopyToast(true);
        setTimeout(() => setShowCopyToast(false), 2000);
    };

    // Helper function to darken a hex color
    const darkenColor = (hex: string, amount: number = 0.3): string => {
        // Remove # if present
        const color = hex.replace('#', '');
        const num = parseInt(color, 16);
        const r = Math.max(0, Math.floor((num >> 16) * (1 - amount)));
        const g = Math.max(0, Math.floor(((num >> 8) & 0x00FF) * (1 - amount)));
        const b = Math.max(0, Math.floor((num & 0x0000FF) * (1 - amount)));
        return `#${(r << 16 | g << 8 | b).toString(16).padStart(6, '0')}`;
    };

    // Helper function to lighten a hex color (blend with white)
    const lightenColor = (hex: string, amount: number = 0.4): string => {
        const color = hex.replace('#', '');
        const num = parseInt(color, 16);
        const r = Math.min(255, Math.floor((num >> 16) + (255 - (num >> 16)) * amount));
        const g = Math.min(255, Math.floor(((num >> 8) & 0x00FF) + (255 - ((num >> 8) & 0x00FF)) * amount));
        const b = Math.min(255, Math.floor((num & 0x0000FF) + (255 - (num & 0x0000FF)) * amount));
        return `#${(r << 16 | g << 8 | b).toString(16).padStart(6, '0')}`;
    };

    const selectionBorderColor = darkenColor(categoryColor, 0.25);
    const normalBorderColor = lightenColor(categoryColor, 0.4);

    const handleToggle = () => {
        toggleTaskComplete(task.id);
        onTaskChange();
    };

    const handleDelete = () => {
        setShowDeleteDialog(true);
    };

    const confirmDelete = () => {
        deleteTask(task.id);
        onTaskChange();
        setShowDeleteDialog(false);
    };

    const handleTitleSave = () => {
        if (editTitle.trim()) {
            updateTask(task.id, { title: editTitle.trim() });
            onTaskChange();
        } else {
            setEditTitle(task.title);
        }
        setIsEditing(false);
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') {
            handleTitleSave();
        } else if (e.key === 'Escape') {
            setEditTitle(task.title);
            setIsEditing(false);
        }
    };

    // Subtask edit handlers
    const handleStartEditSubtask = (subtask: any) => {
        setEditingSubtaskId(subtask.id);
        setEditingSubtaskTitle(subtask.title);
        setEditingSubtaskUrl(subtask.url || '');
    };

    const handleSaveEditSubtask = () => {
        if (editingSubtaskId && task.subtasks) {
            const newSubtasks = task.subtasks.map(s =>
                s.id === editingSubtaskId
                    ? { ...s, title: editingSubtaskTitle, url: editingSubtaskUrl || undefined }
                    : s
            );
            updateTask(task.id, { subtasks: newSubtasks });
            onTaskChange();
        }
        setEditingSubtaskId(null);
    };

    const handleCancelEditSubtask = () => {
        setEditingSubtaskId(null);
    };

    const handleSubtaskEditKeyDown = (e: React.KeyboardEvent) => {
        // Ctrl+Enter: Save and close
        if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
            e.preventDefault();
            handleSaveEditSubtask();
        } else if (e.key === 'Escape') {
            e.preventDefault();
            handleCancelEditSubtask();
        }
        // Tab works normally for field navigation
    };

    // Calculate D-Day
    const getDDay = () => {
        if (!task.dueDate || task.completed) return null;
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const due = new Date(task.dueDate);
        due.setHours(0, 0, 0, 0);
        const diff = Math.ceil((due.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
        return diff;
    };

    const getDDayStyle = (dDay: number | null) => {
        if (dDay === null) return '';
        if (dDay < 0) return 'text-red-600 dark:text-red-400'; // 지남
        return 'text-gray-800 dark:text-gray-200'; // 남음 (D-Day 포함)
    };

    const dDay = getDDay();

    return (
        <>
            <Reorder.Item
                value={task}
                dragListener={true}
                dragControls={dragControls}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20, transition: { duration: 0.2 } }}
                transition={{
                    type: "spring",
                    stiffness: 400,
                    damping: 25,
                    layout: { duration: 0.3 }
                }}
                whileDrag={{
                    zIndex: 1000,
                    cursor: "grabbing"
                }}
                layout
                className={`group flex items-start gap-3 p-3 rounded-lg border shadow-md hover:shadow-lg cursor-grab active:cursor-grabbing transition-colors duration-200 ${task.completed
                    ? 'opacity-60 bg-white dark:bg-gray-800'
                    : dDay !== null && dDay < 0
                        ? 'bg-red-50 dark:bg-red-900/30'
                        : task.isPinned
                            ? 'bg-yellow-50 dark:bg-yellow-900/30'
                            : 'bg-white dark:bg-gray-800'
                    } ${isSelected ? 'border-y-0' : 'border-y-0'}`}
                style={{
                    position: 'relative',
                    borderLeft: isSelected ? `4px solid ${selectionBorderColor}` : `4px solid ${normalBorderColor}`,
                    borderRight: isSelected ? `4px solid ${selectionBorderColor}` : `4px solid ${normalBorderColor}`,
                }}
                onDoubleClick={() => onOpenDetail(task)}
                onClick={onClick}
            >
                {/* Drag Handle + D-Day */}
                <div className="flex flex-col items-center justify-between self-stretch">
                    <motion.div
                        onPointerDown={(e) => dragControls.start(e)}
                        className="cursor-grab active:cursor-grabbing text-gray-400 hover:text-gray-600 touch-none"
                        whileHover={{ scale: 1.1 }}
                        whileTap={{ scale: 0.95, cursor: "grabbing" }}
                    >
                        <GripVertical className="w-4 h-4" />
                    </motion.div>
                    {dDay !== null && (
                        <span className={`text-xs ${getDDayStyle(dDay)}`}>
                            {dDay === 0 ? 'D-Day' : dDay > 0 ? `D-${dDay}` : `D+${Math.abs(dDay)}`}
                        </span>
                    )}
                </div>

                {/* Checkbox */}
                <Checkbox
                    checked={task.completed}
                    onCheckedChange={handleToggle}
                    className="mt-0.5 h-5 w-5 rounded-full border-2 data-[state=checked]:!bg-gray-400 data-[state=checked]:!border-gray-400"
                />

                {/* Content */}
                <div className="flex-1 min-w-0">
                    {isEditing ? (
                        <input
                            type="text"
                            value={editTitle}
                            onChange={(e) => setEditTitle(e.target.value)}
                            onBlur={handleTitleSave}
                            onKeyDown={handleKeyDown}
                            autoFocus
                            className="w-full text-sm border-b border-blue-500 outline-none pb-1 bg-transparent"
                        />
                    ) : (
                        <div
                            className={`text-sm ${task.completed ? 'line-through text-gray-500 dark:text-gray-400' : 'text-gray-800 dark:text-gray-100'}`}
                        >
                            {task.title}
                        </div>
                    )}

                    {/* Meta Info */}
                    <div className="flex items-center gap-3 mt-1">
                        {task.dueDate && (
                            <div className={`flex items-center gap-1 text-xs ${new Date(task.dueDate) < new Date() && !task.completed
                                ? 'text-red-500'
                                : 'text-gray-500 dark:text-gray-400'
                                }`}>
                                <Calendar className="w-3 h-3" />
                                {format(new Date(task.dueDate), 'M월 d일', { locale: ko })}
                            </div>
                        )}
                        {task.assignee && (
                            <div className="flex items-center gap-1 text-xs text-blue-500">
                                <User className="w-3 h-3" />
                                {task.assignee}
                            </div>
                        )}
                        {((task.resourceUrls && task.resourceUrls.length > 0) || task.resourceUrl) && (
                            <div className="flex items-center gap-1">
                                {(task.resourceUrls && task.resourceUrls.length > 0
                                    ? task.resourceUrls
                                    : [task.resourceUrl]
                                ).map((url, index) => (
                                    <div
                                        key={index}
                                        className="flex items-center justify-center text-purple-500 cursor-pointer hover:text-purple-700 p-1.5 -m-1.5 rounded hover:bg-purple-50 transition-all hover:scale-125"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            handleCopyUrl(url);
                                            if (!e.ctrlKey && !e.metaKey) {
                                                window.open(url, '_blank');
                                            }
                                        }}
                                        title={url}
                                    >
                                        <Paperclip className="w-4 h-3" />
                                    </div>
                                ))}
                            </div>
                        )}
                        {task.notes && (
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <div
                                        className="flex items-center justify-center text-gray-400 dark:text-gray-500 cursor-pointer hover:text-gray-600 dark:hover:text-gray-300 p-1.5 -m-1.5 rounded hover:bg-gray-100 dark:hover:bg-gray-700 transition-all hover:scale-125"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            onOpenNotes(task);
                                        }}
                                    >
                                        <FileText className="w-4 h-3" />
                                    </div>
                                </TooltipTrigger>
                                <TooltipContent side="top" className="max-w-[250px] bg-gray-800 text-white border-gray-700">
                                    <div className="text-xs text-gray-400 mb-1">메모 미리보기</div>
                                    <div
                                        className="whitespace-pre-wrap text-sm line-clamp-4"
                                        dangerouslySetInnerHTML={{
                                            __html: task.notes.length > 200 ? task.notes.slice(0, 200) + '...' : task.notes
                                        }}
                                    />
                                </TooltipContent>
                            </Tooltip>
                        )}
                        {/* Tags */}
                        {task.tags && task.tags.length > 0 && (
                            <div className="flex items-center gap-1 flex-wrap">
                                {task.tags.slice(0, 3).map((tag) => (
                                    <span
                                        key={tag}
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            onTagClick(tag);
                                        }}
                                        className="px-1.5 py-0.5 bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 text-[10px] rounded cursor-pointer hover:bg-blue-200 dark:hover:bg-blue-800"
                                    >
                                        {tag}
                                    </span>
                                ))}
                                {task.tags.length > 3 && (
                                    <span className="text-[10px] text-gray-500">
                                        +{task.tags.length - 3}
                                    </span>
                                )}
                            </div>
                        )}
                        {/* Subtasks Progress */}
                        {task.subtasks && task.subtasks.length > 0 && (
                            <div
                                className="flex items-center gap-1.5 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 rounded px-1 -ml-1 transition-colors"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    onClick();
                                    onToggleExpand?.();
                                }}
                            >
                                <div className="w-12 h-1.5 flex gap-[1px]">
                                    {Array.from({ length: task.subtasks.length }).map((_, i) => (
                                        <div
                                            key={i}
                                            className={`flex-1 h-full rounded-[1px] ${i < task.subtasks!.filter(s => s.completed).length
                                                ? 'bg-gray-400 dark:bg-gray-500' // Completed: Medium Gray
                                                : 'bg-gray-200 dark:bg-gray-700' // Empty: Light Gray
                                                }`}
                                        />
                                    ))}
                                </div>
                                <span className="text-[10px] text-gray-500 dark:text-gray-400">
                                    {task.subtasks.filter(s => s.completed).length}/{task.subtasks.length}
                                </span>
                            </div>
                        )}

                        {/* Expand Toggle Chevron */}
                        {task.subtasks && task.subtasks.length > 0 && (
                            <Button
                                variant="ghost"
                                size="sm"
                                className="h-6 w-6 p-0 text-gray-400 hover:text-blue-500 hover:bg-blue-50 ml-1 rounded-full"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    onClick();
                                    onToggleExpand?.();
                                }}
                            >
                                {isExpanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                            </Button>
                        )}

                    </div>

                    {/* Expandable Subtasks List */}
                    {isExpanded && task.subtasks && (
                        <Reorder.Group
                            axis="y"
                            values={task.subtasks}
                            onReorder={(newOrder) => {
                                updateTask(task.id, { subtasks: newOrder });
                                onTaskChange();
                            }}
                            className="w-full mt-2 pl-1 space-y-1"
                        >
                            {task.subtasks.map((subtask) => (
                                <Reorder.Item
                                    key={subtask.id}
                                    value={subtask}
                                    className="flex items-center gap-2 group/sub py-1.5 px-2 bg-white dark:bg-gray-800 rounded-md shadow-sm border border-gray-100 dark:border-gray-700"
                                >
                                    <div
                                        className="cursor-grab active:cursor-grabbing text-gray-300 hover:text-gray-500 dark:text-gray-600 dark:hover:text-gray-400"
                                        onClick={(e) => e.stopPropagation()}
                                    >
                                        <GripVertical className="w-3 h-3" />
                                    </div>
                                    <Checkbox
                                        checked={subtask.completed}
                                        onCheckedChange={() => {
                                            const newSubtasks = task.subtasks!.map(s =>
                                                s.id === subtask.id ? { ...s, completed: !s.completed } : s
                                            );
                                            updateTask(task.id, { subtasks: newSubtasks });
                                            onTaskChange();
                                        }}
                                        className="h-3.5 w-3.5 rounded-full border-2 data-[state=checked]:!bg-gray-400 data-[state=checked]:!border-gray-400"
                                        onClick={(e) => e.stopPropagation()}
                                    />
                                    <span
                                        className={`flex-1 text-xs cursor-pointer ${subtask.completed ? 'line-through text-gray-400' : 'text-gray-600 dark:text-gray-300'}`}
                                        onDoubleClick={(e) => {
                                            e.stopPropagation();
                                            handleStartEditSubtask(subtask);
                                        }}
                                        onClick={(e) => e.stopPropagation()}
                                    >
                                        {subtask.title}
                                    </span>
                                    {subtask.url && (
                                        <button
                                            type="button"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                navigator.clipboard.writeText(subtask.url!);
                                                if (!e.ctrlKey && !e.metaKey) {
                                                    window.open(subtask.url, '_blank');
                                                }
                                            }}
                                            className="p-0.5 hover:bg-blue-100 dark:hover:bg-blue-900 rounded transition-colors"
                                            title="클릭: URL 열기 + 복사 / Ctrl+클릭: 복사만"
                                        >
                                            <Paperclip className="w-3 h-3 text-blue-500" />
                                        </button>
                                    )}
                                </Reorder.Item>
                            ))}
                        </Reorder.Group>
                    )}
                </div>

                {/* Actions */}
                <div className="flex items-center gap-0">
                    <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 p-0 opacity-0 group-hover:opacity-100 text-gray-400 hover:text-red-600 hover:bg-red-50"
                        onClick={handleDelete}
                    >
                        <Trash2 className="h-4 w-4" />
                    </Button>
                    <Button
                        variant="ghost"
                        size="sm"
                        className={`h-8 w-8 p-0 opacity-0 group-hover:opacity-100 ${task.isPinned ? 'opacity-100 text-yellow-500' : 'text-gray-400 hover:text-yellow-500 hover:bg-yellow-50'}`}
                        onClick={() => onTogglePin(task)}
                    >
                        <Pin className={`h-4 w-4 ${task.isPinned ? 'fill-current' : ''}`} />
                    </Button>
                </div>
            </Reorder.Item>

            {/* Subtask Edit Dialog */}
            <Dialog open={editingSubtaskId !== null} onOpenChange={(open) => !open && handleCancelEditSubtask()}>
                <DialogContent
                    className="sm:max-w-[350px]"
                    onClick={(e) => e.stopPropagation()}
                    onKeyDown={(e) => e.stopPropagation()}
                >
                    <DialogHeader>
                        <DialogTitle>체크리스트 항목 편집</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-3 py-2">
                        <div>
                            <label className="text-xs text-gray-500 dark:text-gray-400">제목</label>
                            <Input
                                value={editingSubtaskTitle}
                                onChange={(e) => setEditingSubtaskTitle(e.target.value)}
                                onKeyDown={handleSubtaskEditKeyDown}
                                className="mt-1"
                                autoFocus
                                placeholder="항목 제목"
                            />
                        </div>
                        <div>
                            <label className="text-xs text-gray-500 dark:text-gray-400">URL (선택사항)</label>
                            <Input
                                value={editingSubtaskUrl}
                                onChange={(e) => setEditingSubtaskUrl(e.target.value)}
                                onKeyDown={handleSubtaskEditKeyDown}
                                className="mt-1"
                                placeholder="https://..."
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" size="sm" onClick={handleCancelEditSubtask}>
                            취소
                        </Button>
                        <Button size="sm" onClick={handleSaveEditSubtask}>
                            저장
                        </Button>
                    </DialogFooter>
                    <p className="text-xs text-gray-400 text-center">
                        Ctrl+Enter로 저장 / Esc로 취소
                    </p>
                </DialogContent>
            </Dialog>

            {/* Delete Confirmation Dialog */}
            <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
                <DialogContent
                    showCloseButton={false}
                    className="sm:max-w-[400px]"
                    onKeyDown={(e) => {
                        if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
                            e.preventDefault();
                            const buttons = e.currentTarget.querySelectorAll('button');
                            const currentIndex = Array.from(buttons).findIndex(b => b === document.activeElement);
                            if (e.key === 'ArrowRight' && currentIndex < buttons.length - 1) {
                                (buttons[currentIndex + 1] as HTMLButtonElement).focus();
                            } else if (e.key === 'ArrowLeft' && currentIndex > 0) {
                                (buttons[currentIndex - 1] as HTMLButtonElement).focus();
                            }
                        }
                    }}
                >
                    <DialogHeader>
                        <DialogTitle>할 일 삭제</DialogTitle>
                        <DialogDescription>
                            "{task.title}"을(를) 삭제하시겠습니까?<br />
                            이 작업은 되돌릴 수 없습니다.
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter className="gap-2 sm:gap-0">
                        <Button
                            variant="outline"
                            onClick={() => setShowDeleteDialog(false)}
                            autoFocus
                        >
                            취소
                        </Button>
                        <Button
                            variant="destructive"
                            onClick={confirmDelete}
                            className="bg-red-600 hover:bg-red-700"
                        >
                            삭제
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Copy Toast for TaskItem */}
            {showCopyToast && (
                <div className="fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 bg-gray-800 text-white px-4 py-2 rounded-lg shadow-lg z-50 animate-in fade-in zoom-in duration-200 pointer-events-none">
                    링크가 복사되었습니다
                </div>
            )}
        </>
    );
}

export function TaskList({ category, categories, tasks, onTasksChange, collectionGroups = [] }: TaskListProps) {
    const [newTaskTitle, setNewTaskTitle] = useState('');
    const [isAddingTask, setIsAddingTask] = useState(false);
    const [detailTask, setDetailTask] = useState<Task | null>(null);
    const [notesTask, setNotesTask] = useState<Task | null>(null);
    const [showNoDueDate, setShowNoDueDate] = useState(true);
    const [showCompleted, setShowCompleted] = useState(true);
    const [deleteTaskToConfirm, setDeleteTaskToConfirm] = useState<Task | null>(null);
    const [selectedTag, setSelectedTag] = useState<string | null>(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
    const [expandedTaskIds, setExpandedTaskIds] = useState<string[]>([]);

    const toggleTaskExpanded = (taskId: string, force?: boolean) => {
        setExpandedTaskIds(prev => {
            const isExpanded = prev.includes(taskId);
            if (force === true && isExpanded) return prev;
            if (force === false && !isExpanded) return prev;

            if (isExpanded && force !== true) {
                return prev.filter(id => id !== taskId);
            } else if (!isExpanded && force !== false) {
                return [...prev, taskId];
            }
            return prev;
        });
    };
    const [showTodayOnly, setShowTodayOnly] = useState(false);
    const searchInputRef = useRef<HTMLInputElement>(null);

    // Get all unique tags from tasks with counts
    const allTagsWithCounts = React.useMemo(() => {
        const tagCounts: Record<string, number> = {};
        tasks.forEach(task => {
            if (task.tags) {
                task.tags.forEach(tag => {
                    tagCounts[tag] = (tagCounts[tag] || 0) + 1;
                });
            }
        });
        return Object.entries(tagCounts).sort((a, b) => b[1] - a[1]);
    }, [tasks]);

    // Undo Delete State
    const [deletedTaskBackup, setDeletedTaskBackup] = useState<Task | null>(null);
    const [showUndoToast, setShowUndoToast] = useState(false);
    const undoTimeoutRef = useRef<NodeJS.Timeout | null>(null);

    // Custom paste handler - rely on default for now as we switched to uncontrolled
    const handlePasteHTML = (e: React.ClipboardEvent) => {
        // e.preventDefault();
        // Default browser paste often handles Excel tables better than insertHTML
    };

    // Editor Ref
    const notesEditorRef = useRef<HTMLDivElement>(null);

    // Initialize content when modal opens (component mounts due to AnimatePresence)
    useEffect(() => {
        if (notesTask && notesEditorRef.current) {
            notesEditorRef.current.innerHTML = notesTask.notes || '';
        }
    }, [notesTask?.id]); // Initialize on task ID change (or mount)



    // Filter tasks based on search, tag, and categorych query
    const filteredTasks = React.useMemo(() => {
        let result = tasks;

        // Filter by today only
        if (showTodayOnly) {
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            result = result.filter(task => {
                if (!task.dueDate) return false;
                const dueDate = new Date(task.dueDate);
                dueDate.setHours(0, 0, 0, 0);
                return dueDate.getTime() === today.getTime();
            });
        }

        // Filter by tag
        if (selectedTag) {
            result = result.filter(task => task.tags && task.tags.includes(selectedTag));
        }

        if (searchQuery.trim()) {
            const query = searchQuery.toLowerCase().trim();
            result = result.filter(task =>
                task.title.toLowerCase().includes(query) ||
                (task.assignee && task.assignee.toLowerCase().includes(query)) ||
                (task.notes && task.notes.toLowerCase().includes(query)) ||
                (task.tags && task.tags.some(tag => tag.toLowerCase().includes(query)))
            );
        }

        // Sort by Pinned status first
        return [...result].sort((a, b) => {
            if (a.isPinned === b.isPinned) return 0;
            return a.isPinned ? -1 : 1;
        });
    }, [tasks, selectedTag, searchQuery, showTodayOnly]);

    // Get category color for a task
    const getCategoryColor = (task: Task): string => {
        const cat = categories.find(c => c.id === task.categoryId);
        return cat?.color || '#3b82f6';
    };
    const [tasksWithDueDate, setTasksWithDueDate] = useState<Task[]>([]);
    const [tasksNoDueDate, setTasksNoDueDate] = useState<Task[]>([]);
    const [showArchive, setShowArchive] = useState(false);
    const [archiveSearch, setArchiveSearch] = useState('');
    const inputRef = useRef<HTMLInputElement>(null);

    // 7 days ago for archive threshold
    const sevenDaysAgo = React.useMemo(() => {
        const date = new Date();
        date.setDate(date.getDate() - 7);
        date.setHours(0, 0, 0, 0);
        return date;
    }, []);

    // Sync local state with props - split into with/without due date
    useEffect(() => {
        const activeTasks = filteredTasks.filter(t => !t.completed);
        setTasksWithDueDate(activeTasks.filter(t => t.dueDate));
        setTasksNoDueDate(activeTasks.filter(t => !t.dueDate));
    }, [filteredTasks]);

    // Split completed tasks into recent (7 days) and archived
    const recentCompletedTasks = React.useMemo(() => {
        return filteredTasks.filter(t => {
            if (!t.completed) return false;
            if (!t.completedAt) return true; // Old tasks without completedAt show in recent
            return new Date(t.completedAt) >= sevenDaysAgo;
        }).sort((a, b) => {
            const aDate = a.completedAt ? new Date(a.completedAt).getTime() : 0;
            const bDate = b.completedAt ? new Date(b.completedAt).getTime() : 0;
            return bDate - aDate; // Most recent first
        });
    }, [filteredTasks, sevenDaysAgo]);

    const archivedTasks = React.useMemo(() => {
        let archived = filteredTasks.filter(t => {
            if (!t.completed || !t.completedAt) return false;
            return new Date(t.completedAt) < sevenDaysAgo;
        }).sort((a, b) => {
            const aDate = new Date(a.completedAt!).getTime();
            const bDate = new Date(b.completedAt!).getTime();
            return bDate - aDate;
        });

        // Apply archive search filter
        if (archiveSearch.trim()) {
            const query = archiveSearch.toLowerCase().trim();
            archived = archived.filter(task =>
                task.title.toLowerCase().includes(query) ||
                (task.assignee && task.assignee.toLowerCase().includes(query)) ||
                (task.notes && task.notes.toLowerCase().includes(query)) ||
                (task.tags && task.tags.some(tag => tag.toLowerCase().includes(query)))
            );
        }

        return archived;
    }, [filteredTasks, sevenDaysAgo, archiveSearch]);

    const totalActiveTasks = tasksWithDueDate.length + tasksNoDueDate.length;

    // Get all visible tasks for keyboard navigation
    const allVisibleTasks = React.useMemo(() => {
        return [...tasksWithDueDate, ...tasksNoDueDate, ...recentCompletedTasks];
    }, [tasksWithDueDate, tasksNoDueDate, recentCompletedTasks]);

    // Keyboard shortcuts handler
    useEffect(() => {
        const handleGlobalKeyDown = (e: KeyboardEvent) => {
            // Skip if a dialog is open
            const dialogOpen = document.querySelector('[role="dialog"]');
            if (dialogOpen) return;

            const activeElement = document.activeElement;
            const isInputFocused = activeElement instanceof HTMLInputElement ||
                activeElement instanceof HTMLTextAreaElement ||
                activeElement?.getAttribute('contenteditable') === 'true';

            // Skip if in input field (except for specific shortcuts)
            if (isInputFocused) {
                // Escape to blur input
                if (e.key === 'Escape') {
                    (activeElement as HTMLElement).blur();
                }
                return;
            }

            // N: New task
            if (e.key === 'n' || e.key === 'N') {
                if (!isAddingTask && category) {
                    e.preventDefault();
                    setIsAddingTask(true);
                }
                return;
            }

            // /: Focus search
            if (e.key === '/') {
                e.preventDefault();
                searchInputRef.current?.focus();
                return;
            }

            // T: Toggle Today filter
            if (e.key === 't' || e.key === 'T') {
                e.preventDefault();
                setShowTodayOnly(prev => !prev);
                return;
            }

            // Arrow keys: Navigate tasks
            if ((e.key === 'ArrowDown' || e.key === 'ArrowUp') && !e.ctrlKey) {
                e.preventDefault();
                if (allVisibleTasks.length === 0) return;

                const currentIndex = selectedTaskId
                    ? allVisibleTasks.findIndex(t => t.id === selectedTaskId)
                    : -1;

                let newIndex: number;
                if (e.key === 'ArrowDown') {
                    newIndex = currentIndex < allVisibleTasks.length - 1 ? currentIndex + 1 : 0;
                } else {
                    newIndex = currentIndex > 0 ? currentIndex - 1 : allVisibleTasks.length - 1;
                }
                setSelectedTaskId(allVisibleTasks[newIndex].id);
                return;
            }

            // Ctrl + Arrow: Expand/Collapse selected task
            if (e.ctrlKey && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) {
                if (selectedTaskId) {
                    e.preventDefault();
                    toggleTaskExpanded(selectedTaskId, e.key === 'ArrowDown'); // Down=Expand(true), Up=Collapse(false)
                }
                return;
            }

            // Actions on selected task
            if (selectedTaskId) {
                const selectedTask = allVisibleTasks.find(t => t.id === selectedTaskId);
                if (!selectedTask) return;

                // Space: Toggle complete
                if (e.key === ' ') {
                    e.preventDefault();
                    toggleTaskComplete(selectedTaskId);
                    onTasksChange();
                    return;
                }

                // Enter or E: Open details
                if (e.key === 'Enter' || e.key === 'e' || e.key === 'E') {
                    e.preventDefault();
                    setDetailTask(selectedTask);
                    return;
                }

                // P: Toggle pin
                if (e.key === 'p' || e.key === 'P') {
                    e.preventDefault();
                    updateTask(selectedTaskId, { isPinned: !selectedTask.isPinned });
                    onTasksChange();
                    return;
                }

                // Delete or Backspace: Delete task
                if (e.key === 'Delete' || e.key === 'Backspace') {
                    e.preventDefault();
                    setDeleteTaskToConfirm(selectedTask);
                    return;
                }
            }

            // Escape: Clear selection
            if (e.key === 'Escape') {
                setSelectedTaskId(null);
                return;
            }
        };

        window.addEventListener('keydown', handleGlobalKeyDown);
        return () => window.removeEventListener('keydown', handleGlobalKeyDown);
    }, [isAddingTask, category, selectedTaskId, allVisibleTasks, onTasksChange]);

    // Auto-focus input when adding task
    useEffect(() => {
        if (isAddingTask && inputRef.current) {
            inputRef.current.focus();
        }
    }, [isAddingTask]);

    const handleAddTask = () => {
        if (category && newTaskTitle.trim()) {
            addTask(category.id, newTaskTitle.trim());
            setNewTaskTitle('');
            onTasksChange();
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') {
            handleAddTask();
        } else if (e.key === 'Escape') {
            setIsAddingTask(false);
            setNewTaskTitle('');
        }
    };

    const handleConfirmDelete = () => {
        if (deleteTaskToConfirm) {
            // Backup and show toast
            setDeletedTaskBackup(deleteTaskToConfirm);

            // Delete
            deleteTask(deleteTaskToConfirm.id);
            onTasksChange();
            setDeleteTaskToConfirm(null);

            // Toast logic
            setShowUndoToast(true);

            // Clear previous timeout if exists
            if (undoTimeoutRef.current) {
                clearTimeout(undoTimeoutRef.current);
            }

            // Hide toast and clear backup after 5 seconds
            undoTimeoutRef.current = setTimeout(() => {
                setShowUndoToast(false);
                setDeletedTaskBackup(null);
            }, 5000);
        }
    };

    const handleUndoDelete = () => {
        if (deletedTaskBackup) {
            // Restore task
            if (category) {
                // If it was in the current category, simple add is enough?
                // We need to restore with all properties. 
                // Since our storage 'add' might be simple, we might need a 'restore' or just use 'addTask' with original ID if possible?
                // The storage.ts addTask generates a new ID. 
                // Let's assume for now we re-create it.Ideally we should keep the ID.
                // Let's modify storage logic momentarily or just re-add it as new task with same content.
                // For a perfect undo, we should probably manually restore it in storage.
                // But simplified version: re-add with same details.
                addTask(deletedTaskBackup.categoryId, deletedTaskBackup.title);
                // We need to update the newly created task with old details (desc, dates, etc)
                // This is tricky without a 'restoreTask' function in storage.
                // Let's check storage.ts content first to see if we can restore properly.
                // For now, I will pause this replacement to check storage.ts capabilities.
            }
        }
    };
    const handleSortByDate = () => {
        if (category) {
            sortTasksByDate(category.id);
            onTasksChange();
        }
    };

    const handleReorderWithDueDate = (newOrder: Task[]) => {
        setTasksWithDueDate(newOrder);
        if (category) {
            const allTaskIds = [...newOrder.map(t => t.id), ...tasksNoDueDate.map(t => t.id)];
            reorderTasks(category.id, allTaskIds);
        }
    };

    const handleReorderNoDueDate = (newOrder: Task[]) => {
        setTasksNoDueDate(newOrder);
        if (category) {
            const allTaskIds = [...tasksWithDueDate.map(t => t.id), ...newOrder.map(t => t.id)];
            reorderTasks(category.id, allTaskIds);
        }
    };

    const handleTogglePin = (task: Task) => {
        updateTask(task.id, { isPinned: !task.isPinned });
        onTasksChange();
    };

    if (!category) {
        return (
            <div className="flex-1 flex items-center justify-center text-gray-400">
                리스트를 선택하세요
            </div>
        );
    }

    return (
        <div className="flex-1 flex flex-col bg-gray-50 dark:bg-gray-900 h-screen overflow-hidden transition-colors duration-300">
            {/* Header */}
            <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 p-6 flex-shrink-0 transition-colors duration-300">
                <div className="flex items-center justify-between flex-wrap gap-2">
                    <h1 className="text-2xl font-semibold text-gray-800 dark:text-gray-100 whitespace-nowrap">{category.name}</h1>
                    <div className="flex items-center gap-2">
                        {/* Today Filter Button */}
                        <Button
                            variant={showTodayOnly ? "default" : "outline"}
                            size="sm"
                            onClick={() => setShowTodayOnly(!showTodayOnly)}
                            className={showTodayOnly ? 'bg-blue-500 hover:bg-blue-600' : ''}
                        >
                            <CalendarDays className="w-4 h-4 mr-1" />
                            오늘
                        </Button>
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button variant="outline" size="sm">
                                    <ArrowUpDown className="w-4 h-4 mr-2" />
                                    정렬
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent>
                                <DropdownMenuItem onClick={handleSortByDate}>
                                    <SortAsc className="w-4 h-4 mr-2" />
                                    마감일순 정렬
                                </DropdownMenuItem>
                            </DropdownMenuContent>
                        </DropdownMenu>
                    </div>
                </div>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                    {showTodayOnly ? '오늘 ' : ''}{totalActiveTasks}개의 할 일 {recentCompletedTasks.length > 0 && `· ${recentCompletedTasks.length}개 완료 (최근 7일)`}
                    {archivedTasks.length > 0 && ` · 📦 ${archivedTasks.length}개 아카이브`}
                </p>

                {/* Tag Filter Bar */}
                {allTagsWithCounts.length > 0 && (
                    <div className="flex items-center gap-2 mt-3 flex-wrap">
                        <Tag className="w-3.5 h-3.5 text-gray-400" />
                        {selectedTag && (
                            <button
                                onClick={() => setSelectedTag(null)}
                                className="flex items-center gap-1 px-2 py-0.5 bg-gray-200 text-gray-600 text-xs rounded-full hover:bg-gray-300"
                            >
                                필터 해제
                                <X className="w-3 h-3" />
                            </button>
                        )}
                        {allTagsWithCounts.map(([tag, count]) => (
                            <button
                                key={tag}
                                onClick={() => setSelectedTag(selectedTag === tag ? null : tag)}
                                className={`px-2 py-0.5 text-xs rounded-full transition-colors ${selectedTag === tag
                                    ? 'bg-blue-500 text-white'
                                    : 'bg-blue-100 text-blue-700 hover:bg-blue-200'
                                    }`}
                            >
                                {tag} ({count})
                            </button>
                        ))}
                    </div>
                )}
            </div>

            {/* Task List - with proper scrolling */}
            <ScrollArea className="flex-1 min-h-0">
                <div className="p-6">
                    <div className="max-w-2xl mx-auto space-y-3">
                        {/* Add Task Button/Input */}
                        <AnimatePresence mode="wait">
                            {isAddingTask ? (
                                <motion.div
                                    key="add-input"
                                    initial={{ opacity: 0, height: 0 }}
                                    animate={{ opacity: 1, height: "auto" }}
                                    exit={{ opacity: 0, height: 0 }}
                                    className="flex items-center gap-2 p-3 bg-white rounded-lg border-2 border-blue-200"
                                >
                                    <Input
                                        ref={inputRef}
                                        value={newTaskTitle}
                                        onChange={(e) => setNewTaskTitle(e.target.value)}
                                        onKeyDown={handleKeyDown}
                                        onBlur={() => {
                                            if (!newTaskTitle.trim()) {
                                                setIsAddingTask(false);
                                            }
                                        }}
                                        placeholder="새 할 일 입력..."
                                        autoFocus
                                        className="border-0 focus-visible:ring-0 text-sm"
                                    />
                                    <Button size="sm" onClick={handleAddTask}>
                                        추가
                                    </Button>
                                </motion.div>
                            ) : (
                                <motion.div key="add-button">
                                    <Button
                                        variant="ghost"
                                        className="w-full justify-start text-blue-600 hover:bg-blue-50"
                                        onClick={() => setIsAddingTask(true)}
                                    >
                                        <Plus className="w-5 h-5 mr-2" />
                                        할 일 추가
                                    </Button>
                                </motion.div>
                            )}
                        </AnimatePresence>

                        {/* Tasks WITH Due Date */}
                        <Reorder.Group
                            axis="y"
                            values={tasksWithDueDate}
                            onReorder={handleReorderWithDueDate}
                            className="space-y-2"
                            layoutScroll
                        >
                            <AnimatePresence>
                                {tasksWithDueDate.map((task: Task) => (
                                    <AnimatedTaskItem
                                        key={task.id}
                                        task={task}
                                        categoryColor={getCategoryColor(task)}
                                        isSelected={selectedTaskId === task.id}
                                        onTaskChange={onTasksChange}
                                        onOpenDetail={setDetailTask}
                                        onOpenNotes={setNotesTask}
                                        onTagClick={setSelectedTag}
                                        onTogglePin={handleTogglePin}
                                        onClick={() => setSelectedTaskId(task.id)}
                                        isExpanded={expandedTaskIds.includes(task.id)}
                                        onToggleExpand={() => toggleTaskExpanded(task.id)}
                                    />
                                ))}
                            </AnimatePresence>
                        </Reorder.Group>

                        {/* Tasks WITHOUT Due Date Section */}
                        {tasksNoDueDate.length > 0 && (
                            <motion.div
                                className="pt-4"
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                            >
                                <button
                                    onClick={() => setShowNoDueDate(!showNoDueDate)}
                                    className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700 transition-colors"
                                >
                                    <Calendar className="w-4 h-4" />
                                    마감기한 없음 ({tasksNoDueDate.length})
                                    <motion.span
                                        animate={{ rotate: showNoDueDate ? 180 : 0 }}
                                        transition={{ duration: 0.2 }}
                                    >
                                        ▼
                                    </motion.span>
                                </button>

                                <AnimatePresence>
                                    {showNoDueDate && (
                                        <motion.div
                                            className="mt-3"
                                            initial={{ opacity: 0, height: 0 }}
                                            animate={{ opacity: 1, height: "auto" }}
                                            exit={{ opacity: 0, height: 0 }}
                                        >
                                            <Reorder.Group
                                                axis="y"
                                                values={tasksNoDueDate}
                                                onReorder={handleReorderNoDueDate}
                                                className="space-y-2"
                                                layoutScroll
                                            >
                                                <AnimatePresence>
                                                    {tasksNoDueDate.map((task: Task) => (
                                                        <AnimatedTaskItem
                                                            key={task.id}
                                                            task={task}
                                                            categoryColor={getCategoryColor(task)}
                                                            isSelected={selectedTaskId === task.id}
                                                            onTaskChange={onTasksChange}
                                                            onOpenDetail={setDetailTask}
                                                            onOpenNotes={setNotesTask}
                                                            onTagClick={setSelectedTag}
                                                            onTogglePin={handleTogglePin}
                                                            onClick={() => setSelectedTaskId(task.id)}
                                                        />
                                                    ))}
                                                </AnimatePresence>
                                            </Reorder.Group>
                                        </motion.div>
                                    )}
                                </AnimatePresence>
                            </motion.div>
                        )}

                        {/* Completed Tasks Section */}
                        {recentCompletedTasks.length > 0 && (
                            <motion.div
                                className="pt-4"
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                            >
                                <button
                                    onClick={() => setShowCompleted(!showCompleted)}
                                    className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700 transition-colors"
                                >
                                    <CheckCircle2 className="w-4 h-4" />
                                    완료됨 ({recentCompletedTasks.length})
                                    <motion.span
                                        animate={{ rotate: showCompleted ? 180 : 0 }}
                                        transition={{ duration: 0.2 }}
                                    >
                                        ▼
                                    </motion.span>
                                </button>

                                <AnimatePresence>
                                    {showCompleted && (
                                        <motion.div
                                            className="mt-3 space-y-2"
                                            initial={{ opacity: 0, height: 0 }}
                                            animate={{ opacity: 1, height: "auto" }}
                                            exit={{ opacity: 0, height: 0 }}
                                        >
                                            {recentCompletedTasks.map((task: Task) => (
                                                <motion.div
                                                    key={task.id}
                                                    initial={{ opacity: 0, x: -20 }}
                                                    animate={{ opacity: 1, x: 0 }}
                                                    exit={{ opacity: 0, x: 20 }}
                                                    className="group flex items-start gap-3 p-3 rounded-lg border border-gray-100 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-md"
                                                    onDoubleClick={() => setDetailTask(task)}
                                                >
                                                    <div className="text-gray-300 mt-0.5">
                                                        <GripVertical className="w-4 h-4" />
                                                    </div>
                                                    <Checkbox
                                                        checked={task.completed}
                                                        onCheckedChange={() => {
                                                            toggleTaskComplete(task.id);
                                                            onTasksChange();
                                                        }}
                                                        className="mt-0.5 h-5 w-5 rounded-full border-2 data-[state=checked]:!bg-gray-400 data-[state=checked]:!border-gray-400"
                                                    />
                                                    <div className="flex-1 min-w-0">
                                                        <div className="text-sm line-through text-gray-500">
                                                            {task.title}
                                                        </div>
                                                        {/* Meta Info for completed tasks */}
                                                        <div className="flex items-center gap-3 mt-1">
                                                            {task.dueDate && (
                                                                <div className="flex items-center gap-1 text-xs text-gray-400">
                                                                    <Calendar className="w-3 h-3" />
                                                                    {format(new Date(task.dueDate), 'M월 d일', { locale: ko })}
                                                                </div>
                                                            )}
                                                            {task.assignee && (
                                                                <div className="flex items-center gap-1 text-xs text-gray-400">
                                                                    <User className="w-3 h-3" />
                                                                    {task.assignee}
                                                                </div>
                                                            )}
                                                            {task.resourceUrl && (
                                                                <div
                                                                    className="flex items-center justify-center text-gray-400 cursor-pointer hover:text-purple-500 p-1.5 -m-1.5 rounded hover:bg-purple-50 transition-all"
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        window.open(task.resourceUrl, '_blank');
                                                                    }}
                                                                    title={task.resourceUrl}
                                                                >
                                                                    <Paperclip className="w-4 h-3" />
                                                                </div>
                                                            )}
                                                            {task.notes && (
                                                                <Tooltip>
                                                                    <TooltipTrigger asChild>
                                                                        <div className="flex items-center justify-center text-gray-400 cursor-pointer hover:text-gray-600 p-1.5 -m-1.5 rounded hover:bg-gray-100 transition-all">
                                                                            <FileText className="w-4 h-3" />
                                                                        </div>
                                                                    </TooltipTrigger>
                                                                    <TooltipContent side="top" className="max-w-[250px] bg-gray-800 text-white border-gray-700">
                                                                        <p className="whitespace-pre-wrap text-sm">{task.notes.length > 100 ? task.notes.slice(0, 100) + '...' : task.notes}</p>
                                                                    </TooltipContent>
                                                                </Tooltip>
                                                            )}
                                                        </div>
                                                    </div>
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        className="h-8 w-8 p-0 opacity-0 group-hover:opacity-100 text-red-500 hover:text-red-700 hover:bg-red-50"
                                                        onClick={() => setDeleteTaskToConfirm(task)}
                                                    >
                                                        <Trash2 className="h-4 w-4" />
                                                    </Button>
                                                </motion.div>
                                            ))}
                                        </motion.div>
                                    )}
                                </AnimatePresence>
                            </motion.div>
                        )}

                        {/* Archive Button */}
                        {archivedTasks.length > 0 && (
                            <motion.div
                                className="pt-4"
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                            >
                                <button
                                    onClick={() => setShowArchive(true)}
                                    className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700 transition-colors"
                                >
                                    <Archive className="w-4 h-4" />
                                    📦 아카이브 ({archivedTasks.length}개)
                                </button>
                            </motion.div>
                        )}

                        {/* Empty State */}
                        {tasks.length === 0 && (
                            <motion.div
                                className="text-center py-12 text-gray-400"
                                initial={{ opacity: 0, scale: 0.9 }}
                                animate={{ opacity: 1, scale: 1 }}
                            >
                                <div className="text-4xl mb-3">📝</div>
                                <p>할 일을 추가해보세요!</p>
                            </motion.div>
                        )}
                    </div>
                </div>
            </ScrollArea>

            {/* Task Detail Dialog */}
            <TaskDetailDialog
                task={detailTask}
                isOpen={!!detailTask}
                onClose={() => setDetailTask(null)}
                onTaskChange={onTasksChange}
                onSortByDate={handleSortByDate}
                collectionGroups={collectionGroups}
            />

            {/* Delete Confirmation Dialog for Completed Tasks */}
            <Dialog open={!!deleteTaskToConfirm} onOpenChange={(open) => !open && setDeleteTaskToConfirm(null)}>
                <DialogContent showCloseButton={false} className="sm:max-w-[400px]">
                    <DialogHeader>
                        <DialogTitle>할 일 삭제</DialogTitle>
                        <DialogDescription>
                            "{deleteTaskToConfirm?.title}"을(를) 삭제하시겠습니까?<br />
                            이 작업은 되돌릴 수 없습니다.
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter className="gap-2 sm:gap-0">
                        <Button
                            variant="outline"
                            onClick={() => setDeleteTaskToConfirm(null)}
                        >
                            취소
                        </Button>
                        <Button
                            variant="destructive"
                            onClick={() => {
                                if (deleteTaskToConfirm) {
                                    deleteTask(deleteTaskToConfirm.id);
                                    onTasksChange();
                                    setDeleteTaskToConfirm(null);
                                }
                            }}
                            className="bg-red-600 hover:bg-red-700"
                        >
                            삭제
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Archive Dialog */}
            <Dialog open={showArchive} onOpenChange={setShowArchive}>
                <DialogContent className="sm:max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <Archive className="w-5 h-5" />
                            📦 아카이브 ({archivedTasks.length}개)
                        </DialogTitle>
                        <DialogDescription>
                            7일 이상 경과한 완료된 할일들입니다.
                        </DialogDescription>
                    </DialogHeader>

                    {/* Archive Search */}
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                        <Input
                            value={archiveSearch}
                            onChange={(e) => setArchiveSearch(e.target.value)}
                            placeholder="아카이브 검색..."
                            className="pl-10 pr-10"
                        />
                        {archiveSearch && (
                            <button
                                onClick={() => setArchiveSearch('')}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                            >
                                <X className="w-4 h-4" />
                            </button>
                        )}
                    </div>

                    {/* Archived Tasks List */}
                    <ScrollArea className="flex-1 -mx-6 px-6">
                        <div className="space-y-2 py-2">
                            {archivedTasks.length === 0 ? (
                                <div className="text-center py-8 text-gray-400">
                                    {archiveSearch ? '검색 결과가 없습니다.' : '아카이브된 할일이 없습니다.'}
                                </div>
                            ) : (
                                archivedTasks.map((task) => (
                                    <div
                                        key={task.id}
                                        className="flex items-start gap-3 p-3 rounded-lg border border-gray-100 bg-white hover:bg-gray-50"
                                    >
                                        <CheckCircle2 className="w-5 h-5 text-green-500 mt-0.5" />
                                        <div className="flex-1 min-w-0">
                                            <div className="text-sm line-through text-gray-500">
                                                {task.title}
                                            </div>
                                            <div className="flex items-center gap-2 mt-1 text-xs text-gray-400">
                                                {task.completedAt && (
                                                    <span>
                                                        ✓ {format(new Date(task.completedAt), 'yyyy년 M월 d일', { locale: ko })} 완료
                                                    </span>
                                                )}
                                                {task.assignee && (
                                                    <span>· 👤 {task.assignee}</span>
                                                )}
                                            </div>
                                            {task.tags && task.tags.length > 0 && (
                                                <div className="flex gap-1 mt-1">
                                                    {task.tags.map(tag => (
                                                        <span key={tag} className="px-1.5 py-0.5 bg-gray-100 text-gray-500 text-[10px] rounded">
                                                            {tag}
                                                        </span>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            className="h-8 w-8 p-0 text-red-400 hover:text-red-600 hover:bg-red-50"
                                            onClick={() => {
                                                deleteTask(task.id);
                                                onTasksChange();
                                            }}
                                        >
                                            <Trash2 className="h-4 w-4" />
                                        </Button>
                                    </div>
                                ))
                            )}
                        </div>
                    </ScrollArea>

                    <DialogFooter>
                        <Button variant="outline" onClick={() => setShowArchive(false)}>
                            닫기
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
            {/* Undo Delete Toast */}
            <AnimatePresence>
                {showUndoToast && (
                    <motion.div
                        initial={{ opacity: 0, y: 50 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 50 }}
                        className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-gray-900 text-white px-4 py-3 rounded-lg shadow-lg flex items-center gap-4 dark:bg-gray-700 dark:border dark:border-gray-600"
                    >
                        <span>🗑️ 할일이 삭제되었습니다</span>
                        <button
                            onClick={handleUndoDelete}
                            className="text-blue-400 font-medium hover:text-blue-300 transition-colors"
                        >
                            되돌리기
                        </button>
                        <button
                            onClick={() => setShowUndoToast(false)}
                            className="ml-2 text-gray-500 hover:text-gray-300"
                        >
                            <X className="w-4 h-4" />
                        </button>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Standalone Notes Modal - Custom Draggable */}
            <AnimatePresence>
                {notesTask && (
                    <>
                        {/* Overlay */}
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="fixed inset-0 bg-black/50 z-50"
                            onClick={() => {
                                onTasksChange();
                                setNotesTask(null);
                            }}
                        />
                        {/* Modal */}
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                            drag
                            dragMomentum={false}
                            className="fixed top-1/2 left-1/2 z-50 bg-white dark:bg-gray-900 rounded-lg shadow-2xl border dark:border-gray-700 flex flex-col"
                            style={{
                                x: '-50%',
                                y: '-50%',
                                width: 'min(90vw, 1050px)',
                                height: 'min(80vh, 500px)',
                                minWidth: '400px',
                                minHeight: '300px',
                            }}
                        >
                            {/* Header - Drag Handle */}
                            <div className="flex items-center justify-between p-4 border-b dark:border-gray-700 cursor-grab active:cursor-grabbing">
                                <div className="flex items-center gap-2 font-semibold">
                                    <FileText className="w-5 h-5" />
                                    {notesTask?.title} - 메모
                                </div>
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        onTasksChange();
                                        setNotesTask(null);
                                    }}
                                    className="p-1 hover:bg-gray-100 dark:hover:bg-gray-800 rounded"
                                >
                                    <X className="w-5 h-5" />
                                </button>
                            </div>
                            {/* Content */}
                            <div className="flex-1 p-4 overflow-auto">
                                <style jsx global>{`
                                    .rich-text-editor table { border-collapse: collapse; width: 100%; margin: 0.5em 0; }
                                    .rich-text-editor td, .rich-text-editor th { border: 1px solid #d1d5db; padding: 4px 8px; vertical-align: top; text-align: left; }
                                    .dark .rich-text-editor td, .dark .rich-text-editor th { border-color: #4b5563; }
                                    /* Restore common styles usually reset by Tailwind */
                                    .rich-text-editor ul { list-style-type: disc; margin-left: 1.5em; }
                                    .rich-text-editor ol { list-style-type: decimal; margin-left: 1.5em; }
                                    .rich-text-editor b, .rich-text-editor strong { font-weight: bold; }
                                    .rich-text-editor i, .rich-text-editor em { font-style: italic; }
                                    .rich-text-editor u { text-decoration: underline; }
                                `}</style>
                                {/* Rich Text Editor */}
                                <div className="w-full h-full min-h-[200px] border border-gray-300 dark:border-gray-600 rounded-md p-4 bg-white dark:bg-gray-800 focus-within:ring-2 focus-within:ring-blue-500 focus-within:border-transparent overflow-hidden flex flex-col">
                                    <div
                                        ref={notesEditorRef}
                                        contentEditable
                                        suppressContentEditableWarning
                                        onInput={(e) => {
                                            if (notesTask) {
                                                const newNotes = e.currentTarget.innerHTML;
                                                setNotesTask({ ...notesTask, notes: newNotes });
                                                // Debounce update or update on blur recommended, but direct update for now to match behavior
                                                updateTask(notesTask.id, { notes: newNotes });
                                            }
                                        }}
                                        className="rich-text-editor outline-none w-full h-full text-base text-gray-900 dark:text-gray-100 overflow-auto"
                                        style={{ whiteSpace: 'pre-wrap' }}
                                    />
                                </div>
                            </div>
                            {/* Footer */}
                            <div className="flex justify-end gap-2 p-4 border-t dark:border-gray-700">
                                <Button
                                    onClick={() => {
                                        onTasksChange();
                                        setNotesTask(null);
                                    }}
                                >
                                    닫기
                                </Button>
                            </div>
                        </motion.div>
                    </>
                )}
            </AnimatePresence>
        </div>
    );
}

