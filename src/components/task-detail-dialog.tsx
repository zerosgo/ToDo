"use client";

import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Task, Subtask } from '@/lib/types';
import { updateTask, addTask, deleteTask, sortTasksByDate, getAllTags, generateId } from '@/lib/storage';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Calendar } from '@/components/ui/calendar';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from '@/components/ui/dialog';
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from '@/components/ui/popover';
import { CalendarIcon, X, Link, Tag, Maximize2, Plus, Check, Trash2, ListChecks, Star } from 'lucide-react';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';
import { motion, AnimatePresence } from 'framer-motion';

interface TaskDetailDialogProps {
    task: Task | null;
    isOpen: boolean;
    onClose: () => void;
    onTaskChange: () => void;
    onSortByDate?: () => void;
    isNewTask?: boolean;
}

export function TaskDetailDialog({
    task,
    isOpen,
    onClose,
    onTaskChange,
    onSortByDate,
    isNewTask = false,
}: TaskDetailDialogProps) {
    const [title, setTitle] = useState('');
    const [isFavorite, setIsFavorite] = useState(false);
    const [assignee, setAssignee] = useState('');
    const [resourceUrl, setResourceUrl] = useState('');
    const [notes, setNotes] = useState('');
    const [dueDate, setDueDate] = useState<Date | undefined>(undefined);
    const [dueTime, setDueTime] = useState('');
    const [tags, setTags] = useState<string[]>([]);
    const [tagInput, setTagInput] = useState('');
    const [showTagSuggestions, setShowTagSuggestions] = useState(false);
    const [isCalendarOpen, setIsCalendarOpen] = useState(false);
    const [dueDateChanged, setDueDateChanged] = useState(false);
    const [isNotesExpanded, setIsNotesExpanded] = useState(false);
    const [subtasks, setSubtasks] = useState<Subtask[]>([]);
    const [newSubtaskTitle, setNewSubtaskTitle] = useState('');

    // Get existing tags for autocomplete (excluding already added tags)
    const tagSuggestions = React.useMemo(() => {
        const allExistingTags = getAllTags();
        return allExistingTags
            .filter(tag => !tags.includes(tag))
            .filter(tag => tag.toLowerCase().includes(tagInput.toLowerCase()));
    }, [tags, tagInput]);

    useEffect(() => {
        if (task) {
            setTitle(task.title);
            setIsFavorite(task.isFavorite || false);
            setAssignee(task.assignee || '');
            setResourceUrl(task.resourceUrl || '');
            setNotes(task.notes);
            setDueDate(task.dueDate ? new Date(task.dueDate) : undefined);
            setDueTime(task.dueTime || '');
            setTags(task.tags || []);
            setTagInput('');
            setDueDateChanged(false);
            setIsNotesExpanded(false);  // Reset expanded notes when switching tasks
            setSubtasks(task.subtasks || []);
            setNewSubtaskTitle('');
        }
    }, [task]);

    const handleSave = (shouldSort: boolean = false) => {
        if (task && title.trim()) {
            if (isNewTask) {
                // Create new task
                addTask(task.categoryId, title.trim(), dueDate ? dueDate.toISOString() : null, {
                    assignee: assignee.trim(),
                    resourceUrl: resourceUrl.trim(),
                    notes,
                    dueTime: dueTime || null,
                    tags,
                    subtasks,
                    isFavorite,
                });
            } else {
                // Update existing task
                updateTask(task.id, {
                    title: title.trim(),
                    assignee: assignee.trim(),
                    resourceUrl: resourceUrl.trim(),
                    notes,
                    dueDate: dueDate ? dueDate.toISOString() : null,
                    dueTime: dueTime || null,
                    tags,
                    subtasks,
                    isFavorite,
                });
            }

            // If due date was changed and Enter was pressed, auto-sort
            if (shouldSort && dueDateChanged && onSortByDate) {
                sortTasksByDate(task.categoryId);
            }

            onTaskChange();
            onClose();
        }
    };

    const handlePasteHTML = (e: React.ClipboardEvent) => {
        // We rely on default browser paste but stop propagation if needed.
        // Or we can manually insert. Since we are switching to uncontrolled, 
        // let's try allowing default paste first, as it often handles Excel better than execCommand in modern browsers.
        // But if styles are stripped, we need to manual insert.
        // Let's stick to no-op here and let the div handle it, OR use a cleaner insert.
        // Actually, the user complained about cursor jumping and bad format. 
        // Uncontrolled component is key. Let's keep a simple handler to ensure cleaner HTML if possible.
        // For now, let's allow default behavior but in Uncontrolled div.
        // If we want to force styles, we might need to intercept.
        // Let's revert to default paste behavior first with uncontrolled component. 
        // Often execCommand 'insertHTML' is what causes "10 enters" if not handled right.
    };

    // Editor Refs
    const smallEditorRef = useRef<HTMLDivElement>(null);
    const expandedEditorRef = useRef<HTMLDivElement>(null);
    const initialNotesRef = useRef(notes || '');

    // Set initial content only once or when task changes
    useEffect(() => {
        if (smallEditorRef.current && smallEditorRef.current.innerHTML !== notes) {
            // Only update if significantly different (e.g. task switch), avoid overwriting while typing
            // For simplicity in this dialog, we assume notes prop updates only on save or load.
            // But since 'notes' state updates on input, this effect would fire on every keystroke if we depend on 'notes'.
            // So we should NOT depend on 'notes' for the content update.
            // We only set content on mount or if task ID changes.
        }
    }, []);

    // We need to populate the refs when they mount. 
    // Since we act as uncontrolled, we use a callback ref or useEffect with dependency.
    useEffect(() => {
        if (isOpen && smallEditorRef.current) {
            if (smallEditorRef.current.innerHTML !== notes) {
                smallEditorRef.current.innerHTML = notes || '';
            }
        }
    }, [isOpen, task?.id]); // Re-initialize on open or task change

    useEffect(() => {
        if (isNotesExpanded && expandedEditorRef.current) {
            expandedEditorRef.current.innerHTML = notes || '';
            // Focus
            setTimeout(() => expandedEditorRef.current?.focus(), 50);
        }
    }, [isNotesExpanded]);

    // Generate time options (00:00 to 23:30, 30min intervals)
    const handleDelete = () => {
        if (task && window.confirm(`"${task.title}"을(를) 삭제하시겠습니까?`)) {
            deleteTask(task.id);
            onTaskChange();
            onClose();
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        // IME composition check
        if (e.nativeEvent.isComposing) return;

        // Ctrl+Enter: Save from anywhere (including Textarea)
        if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
            e.preventDefault();
            e.stopPropagation();
            handleSave(true);
            return;
        }

        // Enter (without Shift): Save from non-Textarea fields
        // But NOT from subtask input (has data-subtask-input attribute)
        if (e.key === 'Enter' && !e.shiftKey) {
            const target = e.target as HTMLElement;
            if (target.tagName !== 'TEXTAREA' && !target.hasAttribute('data-subtask-input')) {
                e.preventDefault();
                e.stopPropagation();
                handleSave(true);
            }
        }
    };

    const handleDateSelect = (date: Date | undefined) => {
        setDueDate(date);
        setDueDateChanged(true);
        setIsCalendarOpen(false);
    };

    const handleClearDate = () => {
        setDueDate(undefined);
        setDueDateChanged(true);
    };

    const handleAddTag = () => {
        const trimmed = tagInput.trim();
        if (trimmed && !tags.includes(trimmed)) {
            setTags([...tags, trimmed]);
        }
        setTagInput('');
    };

    const handleRemoveTag = (tagToRemove: string) => {
        setTags(tags.filter(t => t !== tagToRemove));
    };

    const handleTagKeyDown = (e: React.KeyboardEvent) => {
        // Ctrl+Enter to save (also add current tag if not empty)
        if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
            e.preventDefault();
            e.stopPropagation();
            // Add current tag input if not empty before saving
            if (tagInput.trim()) {
                handleAddTag();
            }
            // Use setTimeout to ensure state is updated before save
            setTimeout(() => handleSave(true), 0);
            return;
        }
        // Regular Enter to add tag
        if (e.key === 'Enter') {
            e.preventDefault();
            e.stopPropagation();
            handleAddTag();
        }
    };

    // Subtask handlers
    const handleAddSubtask = () => {
        const trimmed = newSubtaskTitle.trim();
        if (trimmed) {
            const newSubtask: Subtask = {
                id: generateId(),
                title: trimmed,
                completed: false,
            };
            setSubtasks([...subtasks, newSubtask]);
            setNewSubtaskTitle('');
        }
    };

    const handleToggleSubtask = (id: string) => {
        setSubtasks(subtasks.map(s =>
            s.id === id ? { ...s, completed: !s.completed } : s
        ));
    };

    const handleDeleteSubtask = (id: string) => {
        setSubtasks(subtasks.filter(s => s.id !== id));
    };

    const handleSubtaskKeyDown = (e: React.KeyboardEvent) => {
        // Ctrl+Enter: Save the dialog
        if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
            e.preventDefault();
            e.stopPropagation();
            handleSave(true);
            return;
        }
        // Regular Enter: Add subtask and stay in input
        if (e.key === 'Enter') {
            e.preventDefault();
            e.stopPropagation();
            handleAddSubtask();
        }
    };

    if (!task) return null;

    return (
        <>
            <Dialog
                open={isOpen}
                onOpenChange={(open) => {
                    // Only allow closing if notes modal is not open
                    if (!open && !isNotesExpanded) {
                        onClose();
                    }
                }}
            >
                <DialogContent
                    className="sm:max-w-lg"
                    style={{ width: '512px', maxWidth: '90vw', overflow: 'hidden' }}
                    onKeyDown={handleKeyDown}
                >
                    <DialogHeader>
                        <div className="flex items-center justify-between">
                            <DialogTitle>할 일 상세</DialogTitle>
                            <button
                                type="button"
                                onClick={() => setIsFavorite(!isFavorite)}
                                className={`p-1 rounded-md transition-colors text-gray-400 hover:text-yellow-500 hover:bg-gray-100 dark:hover:bg-gray-800 mr-12 ${isFavorite ? 'text-yellow-500' : ''}`}
                            >
                                <Star className={`w-6 h-6 ${isFavorite ? 'fill-yellow-500' : ''}`} />
                            </button>
                        </div>
                    </DialogHeader>

                    <div className="space-y-4">
                        {/* Title */}
                        <div>
                            <label className="text-sm font-medium text-gray-700">제목</label>
                            <Input
                                value={title}
                                onChange={(e) => setTitle(e.target.value)}
                                placeholder="할 일 제목"
                                className="mt-1"
                                tabIndex={1}
                                onKeyDown={handleKeyDown}
                            />
                        </div>

                        {/* Assignee */}
                        <div>
                            <label className="text-sm font-medium text-gray-700">담당자</label>
                            <Input
                                value={assignee}
                                onChange={(e) => setAssignee(e.target.value)}
                                placeholder="담당자 이름 또는 부서"
                                className="mt-1"
                                tabIndex={2}
                                onKeyDown={handleKeyDown}
                            />
                        </div>

                        {/* Resource URL */}
                        <div>
                            <label className="text-sm font-medium text-gray-700">자료</label>
                            <div className="flex items-center gap-2 mt-1">
                                <Input
                                    value={resourceUrl}
                                    onChange={(e) => setResourceUrl(e.target.value)}
                                    placeholder="https://example.com"
                                    className="flex-1"
                                    tabIndex={3}
                                    onKeyDown={handleKeyDown}
                                />
                                {resourceUrl && (
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => window.open(resourceUrl, '_blank')}
                                        className="h-10 px-3"
                                        title="링크 열기"
                                    >
                                        <Link className="h-4 w-4" />
                                    </Button>
                                )}
                            </div>
                        </div>

                        {/* Due Date & Time */}
                        <div>
                            <label className="text-sm font-medium text-gray-700">마감 기한</label>
                            <div className="flex items-center gap-2 mt-1">
                                <Popover open={isCalendarOpen} onOpenChange={setIsCalendarOpen}>
                                    <PopoverTrigger asChild>
                                        <Button
                                            variant="outline"
                                            className={`justify-start text-left font-normal flex-1 ${!dueDate && 'text-muted-foreground'
                                                }`}
                                            tabIndex={4}
                                        >
                                            <CalendarIcon className="mr-2 h-4 w-4" />
                                            {dueDate ? format(dueDate, 'PPP', { locale: ko }) : '날짜 선택'}
                                        </Button>
                                    </PopoverTrigger>
                                    <PopoverContent className="w-auto p-0" align="start">
                                        <Calendar
                                            mode="single"
                                            selected={dueDate}
                                            onSelect={handleDateSelect}
                                            initialFocus
                                        />
                                    </PopoverContent>
                                </Popover>

                                {/* Time Selector - 24hour format, 00/30 minutes only */}
                                {/* Work hours (08:00-18:00) shown first for convenience */}
                                <select
                                    value={dueTime}
                                    onChange={(e) => {
                                        setDueTime(e.target.value);
                                        setDueDateChanged(true);
                                    }}
                                    className="h-10 px-3 py-2 text-sm border border-gray-200 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    tabIndex={5}
                                >
                                    <option value="">시간</option>
                                    <optgroup label="업무 시간">
                                        {Array.from({ length: 11 }, (_, i) => i + 8).map((hour) => (
                                            <React.Fragment key={hour}>
                                                <option value={`${hour.toString().padStart(2, '0')}:00`}>
                                                    {hour.toString().padStart(2, '0')}:00
                                                </option>
                                                <option value={`${hour.toString().padStart(2, '0')}:30`}>
                                                    {hour.toString().padStart(2, '0')}:30
                                                </option>
                                            </React.Fragment>
                                        ))}
                                    </optgroup>
                                    <optgroup label="기타 시간">
                                        {Array.from({ length: 8 }, (_, i) => i).map((hour) => (
                                            <React.Fragment key={hour}>
                                                <option value={`${hour.toString().padStart(2, '0')}:00`}>
                                                    {hour.toString().padStart(2, '0')}:00
                                                </option>
                                                <option value={`${hour.toString().padStart(2, '0')}:30`}>
                                                    {hour.toString().padStart(2, '0')}:30
                                                </option>
                                            </React.Fragment>
                                        ))}
                                        {Array.from({ length: 5 }, (_, i) => i + 19).map((hour) => (
                                            <React.Fragment key={hour}>
                                                <option value={`${hour.toString().padStart(2, '0')}:00`}>
                                                    {hour.toString().padStart(2, '0')}:00
                                                </option>
                                                <option value={`${hour.toString().padStart(2, '0')}:30`}>
                                                    {hour.toString().padStart(2, '0')}:30
                                                </option>
                                            </React.Fragment>
                                        ))}
                                    </optgroup>
                                </select>

                                {dueDate && (
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={handleClearDate}
                                        className="h-10 w-10 p-0"
                                    >
                                        <X className="h-4 w-4" />
                                    </Button>
                                )}
                            </div>
                            {dueDateChanged && (
                                <p className="text-xs text-blue-500 mt-1">
                                    Enter를 누르면 마감일순으로 자동 정렬됩니다
                                </p>
                            )}
                        </div>

                        {/* Tags */}
                        <div>
                            <label className="text-sm font-medium text-gray-700 flex items-center gap-1">
                                <Tag className="w-3.5 h-3.5" />
                                태그
                            </label>
                            <div className="flex flex-wrap gap-1.5 mt-1">
                                {tags.map((tag) => (
                                    <span
                                        key={tag}
                                        className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-100 text-blue-700 text-xs rounded-full"
                                    >
                                        {tag}
                                        <button
                                            type="button"
                                            onClick={() => handleRemoveTag(tag)}
                                            className="hover:bg-blue-200 rounded-full p-0.5"
                                        >
                                            <X className="w-3 h-3" />
                                        </button>
                                    </span>
                                ))}
                                <div className="relative">
                                    <Input
                                        value={tagInput}
                                        onChange={(e) => {
                                            setTagInput(e.target.value);
                                            setShowTagSuggestions(true);
                                        }}
                                        onKeyDown={handleTagKeyDown}
                                        onBlur={() => {
                                            setTimeout(() => setShowTagSuggestions(false), 150);
                                            handleAddTag();
                                        }}
                                        onFocus={() => setShowTagSuggestions(true)}
                                        placeholder="태그 입력 후 Enter"
                                        className="h-6 w-32 text-xs px-2"
                                        tabIndex={6}
                                    />
                                    {/* Tag Suggestions Dropdown */}
                                    {showTagSuggestions && tagSuggestions.length > 0 && (
                                        <div className="absolute top-7 left-0 z-50 w-40 max-h-32 overflow-y-auto bg-white border border-gray-200 rounded-md shadow-lg">
                                            {tagSuggestions.slice(0, 5).map((suggestion) => (
                                                <button
                                                    key={suggestion}
                                                    type="button"
                                                    className="w-full text-left px-2 py-1 text-xs hover:bg-blue-50 text-gray-700"
                                                    onMouseDown={(e) => {
                                                        e.preventDefault();
                                                        setTags([...tags, suggestion]);
                                                        setTagInput('');
                                                        setShowTagSuggestions(false);
                                                    }}
                                                >
                                                    {suggestion}
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Subtasks/Checklist */}
                        <div>
                            <label className="text-sm font-medium text-gray-700 dark:text-gray-300 flex items-center gap-1">
                                <ListChecks className="w-3.5 h-3.5" />
                                체크리스트
                                {subtasks.length > 0 && (
                                    <span className="ml-2 text-xs text-gray-500">
                                        ({subtasks.filter(s => s.completed).length}/{subtasks.length})
                                    </span>
                                )}
                            </label>

                            {/* Progress bar */}
                            {subtasks.length > 0 && (
                                <div className="mt-1.5 h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                                    <div
                                        className="h-full bg-green-500 transition-all duration-300"
                                        style={{
                                            width: `${(subtasks.filter(s => s.completed).length / subtasks.length) * 100}%`
                                        }}
                                    />
                                </div>
                            )}

                            {/* Subtask list */}
                            <div className="mt-2 space-y-1 max-h-[120px] overflow-y-auto">
                                {subtasks.map((subtask) => (
                                    <div
                                        key={subtask.id}
                                        className="flex items-center gap-2 group py-0.5"
                                    >
                                        <button
                                            type="button"
                                            onClick={() => handleToggleSubtask(subtask.id)}
                                            className={`w-4 h-4 rounded border flex items-center justify-center flex-shrink-0 transition-colors ${subtask.completed
                                                ? 'bg-green-500 border-green-500 text-white'
                                                : 'border-gray-300 hover:border-gray-400'
                                                }`}
                                        >
                                            {subtask.completed && <Check className="w-3 h-3" />}
                                        </button>
                                        <span className={`flex-1 text-sm ${subtask.completed
                                            ? 'text-gray-400 line-through'
                                            : 'text-gray-700 dark:text-gray-300'
                                            }`}>
                                            {subtask.title}
                                        </span>
                                        <button
                                            type="button"
                                            onClick={() => handleDeleteSubtask(subtask.id)}
                                            className="opacity-0 group-hover:opacity-100 p-0.5 hover:bg-red-100 rounded transition-opacity"
                                        >
                                            <Trash2 className="w-3 h-3 text-red-500" />
                                        </button>
                                    </div>
                                ))}
                            </div>

                            {/* Add new subtask */}
                            <div className="flex items-center gap-2 mt-2">
                                <Plus className="w-4 h-4 text-gray-400 flex-shrink-0" />
                                <Input
                                    value={newSubtaskTitle}
                                    onChange={(e) => setNewSubtaskTitle(e.target.value)}
                                    onKeyDown={handleSubtaskKeyDown}
                                    placeholder="새 항목 추가..."
                                    className="h-7 text-sm"
                                    data-subtask-input="true"
                                    tabIndex={7}
                                />
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={handleAddSubtask}
                                    disabled={!newSubtaskTitle.trim()}
                                    className="h-7 px-2"
                                >
                                    추가
                                </Button>
                            </div>
                        </div>

                        {/* Notes */}
                        <div>
                            <div className="flex items-center justify-between">
                                <label className="text-sm font-medium text-gray-700 dark:text-gray-300">메모</label>
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => setIsNotesExpanded(true)}
                                    className="h-6 px-2 text-xs text-gray-500 hover:text-gray-700"
                                    title="메모 확장"
                                >
                                    <Maximize2 className="w-3.5 h-3.5 mr-1" />
                                    확장
                                </Button>
                            </div>
                            {/* Rich Text Editor for Notes */}
                            {/* Rich Text Editor for Notes */}
                            <div className="relative mt-1 w-full min-h-[100px] max-h-[150px] overflow-y-auto border border-gray-300 dark:border-gray-600 rounded-md p-2 bg-white dark:bg-gray-800 focus-within:ring-2 focus-within:ring-blue-500 focus-within:border-transparent">
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
                                {/* Uncontrolled Editor Div */}
                                <div
                                    ref={smallEditorRef}
                                    contentEditable
                                    suppressContentEditableWarning
                                    onInput={(e) => setNotes(e.currentTarget.innerHTML)}
                                    className="rich-text-editor outline-none w-full h-full text-sm text-gray-900 dark:text-gray-100"
                                    style={{ whiteSpace: 'pre-wrap' }}
                                />
                                {(!notes || notes === '<br>') && (
                                    <div className="absolute top-2 left-2 text-gray-400 text-sm pointer-events-none">
                                        상세 메모를 입력하세요...
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    <DialogFooter className="flex justify-between sm:justify-between">
                        {!isNewTask ? (
                            <Button
                                variant="destructive"
                                onClick={handleDelete}
                                className="bg-red-600 hover:bg-red-700"
                            >
                                삭제
                            </Button>
                        ) : <div />}
                        <div className="flex gap-2">
                            <Button variant="outline" onClick={onClose}>
                                취소
                            </Button>
                            <Button onClick={() => handleSave(dueDateChanged)}>저장</Button>
                        </div>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Notes Expanded Modal - Overlay */}
            <AnimatePresence>
                {isNotesExpanded && (
                    <motion.div
                        key="notes-overlay"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 bg-black/50 z-[60]"
                        onClick={() => setIsNotesExpanded(false)}
                    />
                )}
            </AnimatePresence>

            {/* Notes Expanded Modal - Content */}
            <AnimatePresence>
                {isNotesExpanded && (
                    <div
                        className="fixed inset-0 z-[61] flex items-center justify-center pointer-events-none"
                    >
                        <motion.div
                            key="notes-modal"
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                            className="bg-white dark:bg-gray-900 rounded-lg shadow-2xl border dark:border-gray-700 flex flex-col pointer-events-auto"
                            style={{
                                width: 'min(90vw, 1050px)',
                                height: 'min(80vh, 500px)',
                                minWidth: '400px',
                                minHeight: '300px',
                            }}
                        >
                            {/* Header - Drag Handle */}
                            <div className="flex items-center justify-between p-4 border-b dark:border-gray-700 cursor-grab active:cursor-grabbing">
                                <div className="flex items-center gap-2 font-semibold">
                                    📝 메모
                                </div>
                                <button
                                    onClick={() => setIsNotesExpanded(false)}
                                    className="p-1 hover:bg-gray-100 dark:hover:bg-gray-800 rounded"
                                >
                                    <X className="w-5 h-5" />
                                </button>
                            </div>
                            {/* Content */}
                            <div className="flex-1 p-4 overflow-auto">
                                {/* Expanded Rich Text Editor */}
                                <div className="w-full h-full min-h-[200px] border border-gray-300 dark:border-gray-600 rounded-md p-4 bg-white dark:bg-gray-800 focus-within:ring-2 focus-within:ring-blue-500 focus-within:border-transparent overflow-hidden flex flex-col">
                                    <div
                                        ref={expandedEditorRef}
                                        contentEditable
                                        suppressContentEditableWarning
                                        onInput={(e) => setNotes(e.currentTarget.innerHTML)}
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                                                e.preventDefault();
                                                setIsNotesExpanded(false);
                                                handleSave(true);
                                            }
                                        }}
                                        className="rich-text-editor outline-none w-full h-full text-base text-gray-900 dark:text-gray-100 overflow-auto"
                                        style={{ whiteSpace: 'pre-wrap' }}
                                    />
                                </div>
                            </div>
                            {/* Footer */}
                            <div className="flex justify-end gap-2 p-4 border-t dark:border-gray-700">
                                <Button onClick={() => setIsNotesExpanded(false)}>
                                    닫기
                                </Button>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </>
    );
}
