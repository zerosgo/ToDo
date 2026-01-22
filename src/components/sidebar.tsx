"use client";

import React, { useState, useEffect } from 'react';
import { Category, Task, CATEGORY_COLORS, QuickLink, Note } from '@/lib/types';
import { addCategory, updateCategory, deleteCategory, getQuickLinks, addQuickLink, updateQuickLink, deleteQuickLink, reorderQuickLinks, getNotes, deleteNote } from '@/lib/storage';
import { MiniCalendar } from './mini-calendar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
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
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from '@/components/ui/dialog';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import {
    CheckSquare,
    Plus,
    MoreVertical,
    Edit2,
    Trash2,
    ListTodo,
    ChevronDown,
    ChevronRight,
    FileText,
    ExternalLink,
    FolderOpen,
    GripVertical,
    Pin,
    Star,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface SidebarProps {
    categories: Category[];
    selectedCategoryIds: string[];
    tasks: Task[];
    currentMonth: Date;
    selectedDate?: Date;
    onSelectCategory: (id: string, ctrlKey: boolean) => void;
    onCategoriesChange: () => void;
    onExportClick: () => void;
    onImportClick: () => void;
    onImportSchedule: () => void;
    onMonthChange: (date: Date) => void;
    onDateSelect: (date: Date) => void;
    onPinnedMemoClick?: (noteId: string) => void;
    notesVersion?: number;
    viewMode: 'calendar' | 'keep' | 'favorites';
    onViewModeChange: (mode: 'calendar' | 'keep' | 'favorites') => void;
}

export function Sidebar({
    categories,
    selectedCategoryIds,
    tasks,
    currentMonth,
    selectedDate,
    onSelectCategory,
    onCategoriesChange,
    onExportClick,
    onImportClick,
    onImportSchedule,
    onMonthChange,
    onDateSelect,
    onPinnedMemoClick,
    notesVersion,
    viewMode,
    onViewModeChange,
}: SidebarProps) {
    const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
    const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
    const [newCategoryName, setNewCategoryName] = useState('');
    const [selectedColor, setSelectedColor] = useState(CATEGORY_COLORS[0].value);
    const [editingCategory, setEditingCategory] = useState<Category | null>(null);

    const [categoryToDelete, setCategoryToDelete] = useState<Category | null>(null);
    const [showCopyToast, setShowCopyToast] = useState(false);

    const handleCopyUrl = (url: string) => {
        navigator.clipboard.writeText(url);
        setShowCopyToast(true);
        setTimeout(() => setShowCopyToast(false), 2000);
    };

    // Collapsible sections
    const [isCalendarExpanded, setIsCalendarExpanded] = useState(() => {
        if (typeof window !== 'undefined') {
            const saved = localStorage.getItem('sidebar_calendar_expanded');
            return saved !== null ? JSON.parse(saved) : true;
        }
        return true;
    });
    const [isQuickLinksExpanded, setIsQuickLinksExpanded] = useState(() => {
        if (typeof window !== 'undefined') {
            const saved = localStorage.getItem('sidebar_quicklinks_expanded');
            return saved !== null ? JSON.parse(saved) : true;
        }
        return true;
    });
    const [isPinnedMemosExpanded, setIsPinnedMemosExpanded] = useState(() => {
        if (typeof window !== 'undefined') {
            const saved = localStorage.getItem('sidebar_pinnedmemos_expanded');
            return saved !== null ? JSON.parse(saved) : true;
        }
        return true;
    });

    // Save expansion states
    useEffect(() => {
        localStorage.setItem('sidebar_calendar_expanded', JSON.stringify(isCalendarExpanded));
    }, [isCalendarExpanded]);

    useEffect(() => {
        localStorage.setItem('sidebar_quicklinks_expanded', JSON.stringify(isQuickLinksExpanded));
    }, [isQuickLinksExpanded]);

    useEffect(() => {
        localStorage.setItem('sidebar_pinnedmemos_expanded', JSON.stringify(isPinnedMemosExpanded));
    }, [isPinnedMemosExpanded]);

    // Pinned Memos state
    const [pinnedNotes, setPinnedNotes] = useState<Note[]>([]);

    // Quick Links state
    const [quickLinks, setQuickLinks] = useState<QuickLink[]>([]);
    const [isQuickLinkDialogOpen, setIsQuickLinkDialogOpen] = useState(false);
    const [editingQuickLink, setEditingQuickLink] = useState<QuickLink | null>(null);
    const [quickLinkName, setQuickLinkName] = useState('');
    const [quickLinkUrl, setQuickLinkUrl] = useState('');
    const [quickLinkFavorite, setQuickLinkFavorite] = useState(false);
    const [quickLinkToDelete, setQuickLinkToDelete] = useState<QuickLink | null>(null);

    // Load quick links on mount and sort
    const loadQuickLinks = () => {
        const links = getQuickLinks();
        // Sort by Pinned status first
        links.sort((a, b) => {
            if (a.isPinned === b.isPinned) return 0;
            return a.isPinned ? -1 : 1;
        });
        setQuickLinks(links);
    };

    useEffect(() => {
        loadQuickLinks();
        loadPinnedNotes();
    }, []);

    // Reload pinned notes when notesVersion changes
    useEffect(() => {
        if (notesVersion !== undefined) {
            loadPinnedNotes();
        }
    }, [notesVersion]);

    // Load pinned notes
    const loadPinnedNotes = () => {
        const notes = getNotes().filter(n => n.isPinned && !n.isArchived);
        setPinnedNotes(notes);
    };

    const handleSaveQuickLink = () => {
        if (quickLinkName.trim() && quickLinkUrl.trim()) {
            if (editingQuickLink) {
                updateQuickLink(editingQuickLink.id, {
                    name: quickLinkName.trim(),
                    url: quickLinkUrl.trim(),
                    isFavorite: quickLinkFavorite
                });
            } else {
                addQuickLink(quickLinkName.trim(), quickLinkUrl.trim(), { isFavorite: quickLinkFavorite });
            }
            loadQuickLinks();
            setIsQuickLinkDialogOpen(false);
            setEditingQuickLink(null);
            setQuickLinkName('');
            setQuickLinkUrl('');
            setQuickLinkFavorite(false);
        }
    };

    const handleDeleteQuickLink = (link: QuickLink) => {
        setQuickLinkToDelete(link);
    };

    const confirmDeleteQuickLink = () => {
        if (quickLinkToDelete) {
            deleteQuickLink(quickLinkToDelete.id);
            loadQuickLinks();
            setQuickLinkToDelete(null);
        }
    };

    const openEditQuickLink = (link: QuickLink) => {
        setEditingQuickLink(link);
        setQuickLinkName(link.name);
        setQuickLinkUrl(link.url);
        setQuickLinkFavorite(link.isFavorite || false);
        setIsQuickLinkDialogOpen(true);
    };

    // Drag and Drop handlers for Quick Links
    const [draggedLink, setDraggedLink] = useState<QuickLink | null>(null);

    const handleDragStart = (e: React.DragEvent, link: QuickLink) => {
        setDraggedLink(link);
        e.dataTransfer.effectAllowed = 'move';
        // HTML5 drag and drop requires data to be set
        e.dataTransfer.setData('text/plain', link.id);
    };

    const handleDragOver = (e: React.DragEvent, targetLink: QuickLink) => {
        e.preventDefault();
        if (!draggedLink || draggedLink.id === targetLink.id) return;

        const newLinks = [...quickLinks];
        const draggedIndex = newLinks.findIndex(l => l.id === draggedLink.id);
        const targetIndex = newLinks.findIndex(l => l.id === targetLink.id);

        if (draggedIndex === -1 || targetIndex === -1) return;

        // Reorder locally for visual feedback
        newLinks.splice(draggedIndex, 1);
        newLinks.splice(targetIndex, 0, draggedLink);
        setQuickLinks(newLinks);
    };

    const handleDragEnd = () => {
        setDraggedLink(null);
        // Persist the new order
        reorderQuickLinks(quickLinks.map(l => l.id));
    };

    const handleToggleQuickLinkPin = (link: QuickLink) => {
        updateQuickLink(link.id, { isPinned: !link.isPinned });
        loadQuickLinks();
    };

    const handleToggleQuickLinkFavorite = (link: QuickLink) => {
        updateQuickLink(link.id, { isFavorite: !link.isFavorite });
        loadQuickLinks();
    };

    const handleAddCategory = () => {
        if (newCategoryName.trim()) {
            const newCategory = addCategory(newCategoryName.trim());
            onCategoriesChange();
            onSelectCategory(newCategory.id, false);
            setNewCategoryName('');
            setIsAddDialogOpen(false);
        }
    };

    const handleEditCategory = () => {
        if (editingCategory && newCategoryName.trim()) {
            updateCategory(editingCategory.id, {
                name: newCategoryName.trim(),
                color: selectedColor
            });
            onCategoriesChange();
            setNewCategoryName('');
            setEditingCategory(null);
            setIsEditDialogOpen(false);
        }
    };

    const handleDeleteCategory = (category: Category) => {
        if (categories.length <= 1) {
            alert('최소 하나의 리스트가 필요합니다.');
            return;
        }
        setCategoryToDelete(category);
    };

    const confirmDeleteCategory = () => {
        if (categoryToDelete) {
            deleteCategory(categoryToDelete.id);
            onCategoriesChange();
            if (selectedCategoryIds.includes(categoryToDelete.id)) {
                const remaining = categories.filter(c => c.id !== categoryToDelete.id);
                if (remaining.length > 0) {
                    onSelectCategory(remaining[0].id, false);
                }
            }
            setCategoryToDelete(null);
        }
    };

    const openEditDialog = (category: Category) => {
        setEditingCategory(category);
        setNewCategoryName(category.name);
        setSelectedColor(category.color || CATEGORY_COLORS[0].value);
        setIsEditDialogOpen(true);
    };

    return (
        <div className="w-72 h-screen bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-700 flex flex-col overflow-hidden transition-colors duration-300">
            {/* View Mode Tabs */}
            <div className="p-2 grid grid-cols-3 gap-1 border-b border-gray-100 dark:border-gray-800 shrink-0">
                <button
                    onClick={() => onViewModeChange('calendar')}
                    className={`flex items-center justify-center py-2 rounded-md text-sm font-medium transition-colors ${viewMode === 'calendar'
                        ? 'bg-blue-50 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400'
                        : 'text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800'
                        }`}
                >
                    <CheckSquare className="w-4 h-4 mr-1.5" />
                    할 일
                </button>
                <button
                    onClick={() => onViewModeChange('keep')}
                    className={`flex items-center justify-center py-2 rounded-md text-sm font-medium transition-colors ${viewMode === 'keep'
                        ? 'bg-yellow-50 text-yellow-600 dark:bg-yellow-900/20 dark:text-yellow-400'
                        : 'text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800'
                        }`}
                >
                    <FileText className="w-4 h-4 mr-1.5" />
                    메모
                </button>
                <button
                    onClick={() => onViewModeChange('favorites')}
                    className={`flex items-center justify-center py-2 rounded-md text-sm font-medium transition-colors ${viewMode === 'favorites'
                        ? 'bg-purple-50 text-purple-600 dark:bg-purple-900/20 dark:text-purple-400'
                        : 'text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800'
                        }`}
                >
                    <Star className="w-4 h-4 mr-1.5" />
                    즐겨찾기
                </button>
            </div>
            {/* Header */}
            <div className="p-3 border-b border-gray-200 dark:border-gray-700 flex-shrink-0">
                <div className="flex items-center gap-2 text-blue-600 dark:text-blue-400 mb-2">
                    <CheckSquare className="w-5 h-5" />
                    <span className="text-lg font-semibold">Local Tasks</span>
                </div>

                {/* Collapsible Mini Calendar - Only in Calendar Mode */}
                {viewMode === 'calendar' && (
                    <>
                        <button
                            onClick={() => setIsCalendarExpanded(!isCalendarExpanded)}
                            className="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 mb-2 w-full"
                        >
                            {isCalendarExpanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                            <span>📅 미니 캘린더</span>
                        </button>
                        <AnimatePresence>
                            {isCalendarExpanded && (
                                <motion.div
                                    initial={{ height: 0, opacity: 0 }}
                                    animate={{ height: "auto", opacity: 1 }}
                                    exit={{ height: 0, opacity: 0 }}
                                    transition={{ duration: 0.2 }}
                                    className="overflow-hidden"
                                >
                                    <MiniCalendar
                                        currentMonth={currentMonth}
                                        selectedDate={selectedDate}
                                        tasks={tasks}
                                        onMonthChange={onMonthChange}
                                        onDateSelect={onDateSelect}
                                    />
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </>
                )}
            </div>

            {/* Categories List */}
            <ScrollArea className="flex-1 p-2 min-h-0">
                <div className="space-y-1">
                    {categories.map((category) => (
                        <div
                            key={category.id}
                            className={`group flex items-center justify-between rounded-lg px-3 py-2 cursor-pointer transition-colors ${selectedCategoryIds.includes(category.id)
                                ? 'bg-blue-50 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300'
                                : 'hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-300'
                                }`}
                            onClick={(e) => onSelectCategory(category.id, e.ctrlKey || e.metaKey)}
                        >
                            <div className="flex items-center gap-2">
                                <div
                                    className="w-3 h-3 rounded-full flex-shrink-0"
                                    style={{ backgroundColor: category.color || '#3b82f6' }}
                                />
                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <span className="text-sm font-medium truncate max-w-[200px] cursor-default">
                                            {category.name}
                                        </span>
                                    </TooltipTrigger>
                                    <TooltipContent side="right" className="bg-gray-800 text-white border-gray-700">
                                        {category.name}
                                    </TooltipContent>
                                </Tooltip>
                            </div>
                            <DropdownMenu>
                                <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        className="h-8 w-8 p-0"
                                    >
                                        <MoreVertical className="h-4 w-4" />
                                    </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                    <DropdownMenuItem onClick={() => openEditDialog(category)}>
                                        <Edit2 className="w-4 h-4 mr-2" />
                                        이름 변경
                                    </DropdownMenuItem>
                                    <DropdownMenuItem
                                        onClick={() => handleDeleteCategory(category)}
                                        className="text-red-600"
                                    >
                                        <Trash2 className="w-4 h-4 mr-2" />
                                        삭제
                                    </DropdownMenuItem>
                                </DropdownMenuContent>
                            </DropdownMenu>
                        </div>
                    ))}
                </div>

                {/* Quick Links Section */}
                <div className="mt-4 pt-3 border-t border-gray-200">
                    <button
                        className="flex items-center justify-between w-full px-3 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
                        onClick={() => setIsQuickLinksExpanded(!isQuickLinksExpanded)}
                    >
                        <span className="flex items-center gap-2">
                            <FolderOpen className="w-4 h-4" />
                            자주 쓰는 파일 ({quickLinks.length})
                        </span>
                        {isQuickLinksExpanded ? (
                            <ChevronDown className="w-4 h-4" />
                        ) : (
                            <ChevronRight className="w-4 h-4" />
                        )}
                    </button>
                    <AnimatePresence>
                        {isQuickLinksExpanded && (
                            <motion.div
                                initial={{ height: 0, opacity: 0 }}
                                animate={{ height: "auto", opacity: 1 }}
                                exit={{ height: 0, opacity: 0 }}
                                transition={{ duration: 0.2 }}
                                className="overflow-hidden space-y-1"
                            >
                                {quickLinks.map((link) => (
                                    <motion.div
                                        layout
                                        key={link.id}
                                        draggable
                                        onDragStart={(e) => handleDragStart(e as any, link)}
                                        onDragOver={(e) => handleDragOver(e as any, link)}
                                        onDragEnd={handleDragEnd}
                                        onDoubleClick={() => openEditQuickLink(link)}
                                        className={`group flex items-center justify-between px-2 py-1.5 rounded-md hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors ${draggedLink?.id === link.id ? 'opacity-50 bg-gray-50 dark:bg-gray-800' : link.isPinned ? 'bg-yellow-50 dark:bg-yellow-900/30' : ''}`}
                                    >
                                        <div className="flex items-center gap-1 flex-1 min-w-0">
                                            <GripVertical className="w-3 h-3 text-gray-400 opacity-0 group-hover:opacity-100 cursor-grab active:cursor-grabbing flex-shrink-0" />
                                            <FileText className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                                            <Tooltip>
                                                <TooltipTrigger asChild>
                                                    <span className="text-sm text-gray-600 dark:text-gray-300 truncate max-w-[130px] cursor-pointer select-none">
                                                        {link.name}
                                                    </span>
                                                </TooltipTrigger>
                                                <TooltipContent side="bottom" align="start" className="bg-gray-800 text-white border-gray-700">
                                                    {link.name}
                                                    <span className="text-xs text-gray-400 ml-2">(더블 클릭하여 수정)</span>
                                                </TooltipContent>
                                            </Tooltip>
                                        </div>
                                        <div className="flex items-center gap-0.5">
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                className="h-7 w-7 p-0 text-blue-500 hover:text-blue-700 hover:bg-blue-100 hover:scale-110 transition-all duration-150 cursor-pointer"
                                                onClick={(e) => {
                                                    handleCopyUrl(link.url);
                                                    if (!e.ctrlKey && !e.metaKey) {
                                                        window.open(link.url, '_blank');
                                                    }
                                                }}
                                                title="열기"
                                            >
                                                <ExternalLink className="h-4 w-4" />
                                            </Button>
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                className={`h-6 w-6 p-0 opacity-0 group-hover:opacity-100 ${link.isPinned ? 'opacity-100 text-yellow-500' : 'text-gray-400 hover:text-yellow-500 hover:bg-yellow-50'}`}
                                                onClick={() => handleToggleQuickLinkPin(link)}
                                                title="고정"
                                            >
                                                <Pin className={`h-3.5 w-3.5 ${link.isPinned ? 'fill-current' : ''}`} />
                                            </Button>

                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                className="h-6 w-6 p-0 text-red-400 hover:text-red-600 hover:bg-red-50 opacity-0 group-hover:opacity-100"
                                                onClick={() => handleDeleteQuickLink(link)}
                                                title="삭제"
                                            >
                                                <Trash2 className="h-3.5 w-3.5" />
                                            </Button>
                                        </div>
                                    </motion.div>
                                ))}
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    className="w-full justify-start text-xs text-gray-500 hover:text-blue-600 hover:bg-blue-50 h-7"
                                    onClick={() => {
                                        setEditingQuickLink(null);
                                        setQuickLinkName('');
                                        setQuickLinkUrl('');
                                        setQuickLinkFavorite(false);
                                        setIsQuickLinkDialogOpen(true);
                                    }}
                                >
                                    <Plus className="w-3 h-3 mr-1" />
                                    파일 추가
                                </Button>
                                {quickLinks.length === 0 && (
                                    <p className="text-xs text-gray-400 text-center py-2">
                                        자주 쓰는 파일을 추가해보세요
                                    </p>
                                )}
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>

                {/* Pinned Memos Section */}
                {pinnedNotes.length > 0 && (
                    <div className="mb-2">
                        <button
                            className="flex items-center justify-between w-full px-3 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
                            onClick={() => setIsPinnedMemosExpanded(!isPinnedMemosExpanded)}
                        >
                            <span className="flex items-center gap-2">
                                <Pin className="w-4 h-4" />
                                고정 메모 ({pinnedNotes.length})
                            </span>
                            {isPinnedMemosExpanded ? (
                                <ChevronDown className="w-4 h-4" />
                            ) : (
                                <ChevronRight className="w-4 h-4" />
                            )}
                        </button>
                        <AnimatePresence>
                            {isPinnedMemosExpanded && (
                                <motion.div
                                    initial={{ opacity: 0, height: 0 }}
                                    animate={{ opacity: 1, height: 'auto' }}
                                    exit={{ opacity: 0, height: 0 }}
                                    transition={{ duration: 0.2 }}
                                    className="overflow-hidden px-2"
                                >
                                    {pinnedNotes.slice(0, 5).map((note) => (
                                        <div
                                            key={note.id}
                                            className="group flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-gray-100 dark:hover:bg-gray-800 cursor-pointer transition-colors"
                                            onClick={() => onPinnedMemoClick?.(note.id)}
                                        >
                                            <div
                                                className="w-3 h-3 rounded-full flex-shrink-0 border border-gray-300"
                                                style={{ backgroundColor: note.color }}
                                            />
                                            <span className="text-sm text-gray-700 dark:text-gray-300 truncate flex-1">
                                                {note.title || '제목 없음'}
                                            </span>
                                            <button
                                                className="opacity-0 group-hover:opacity-100 p-1 text-gray-400 hover:text-red-500 transition-all rounded z-10"
                                                onClick={(e) => {
                                                    e.preventDefault();
                                                    e.stopPropagation();
                                                    if (window.confirm('이 메모를 삭제하시겠습니까?')) {
                                                        deleteNote(note.id);
                                                        loadPinnedNotes();
                                                    }
                                                }}
                                            >
                                                <Trash2 className="w-3 h-3" />
                                            </button>
                                        </div>
                                    ))}
                                    {pinnedNotes.length > 5 && (
                                        <button
                                            className="w-full text-xs text-blue-500 hover:text-blue-600 py-1.5 text-center"
                                            onClick={() => onPinnedMemoClick?.('')}
                                        >
                                            +{pinnedNotes.length - 5} 더보기
                                        </button>
                                    )}
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>
                )}
            </ScrollArea >

            {/* Footer Actions */}
            <div className="p-3 border-t border-gray-200 dark:border-gray-700 space-y-2 flex-shrink-0">
                <Button
                    variant="ghost"
                    size="sm"
                    className="w-full justify-start text-blue-600 hover:bg-blue-50 text-sm"
                    onClick={() => setIsAddDialogOpen(true)}
                >
                    <Plus className="w-4 h-4 mr-2" />
                    새 리스트 만들기
                </Button>
                <div className="flex flex-col gap-1">
                    <Button
                        variant="outline"
                        size="sm"
                        className="text-xs w-full"
                        onClick={onExportClick}
                    >
                        내보내기
                    </Button>
                    <Button
                        variant="outline"
                        size="sm"
                        className="text-xs w-full"
                        onClick={onImportClick}
                    >
                        가져오기
                    </Button>
                    <Button
                        variant="outline"
                        size="sm"
                        className="text-xs w-full mt-2 border-blue-200 hover:bg-blue-50 text-blue-700"
                        onClick={onImportSchedule}
                    >
                        팀 일정 가져오기
                    </Button>
                </div>
            </div >

            {/* Add Category Dialog */}
            < Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen} >
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>새 리스트 만들기</DialogTitle>
                    </DialogHeader>
                    <Input
                        placeholder="리스트 이름"
                        value={newCategoryName}
                        onChange={(e) => setNewCategoryName(e.target.value)}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter') handleAddCategory();
                        }}
                        autoFocus
                    />
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>
                            취소
                        </Button>
                        <Button onClick={handleAddCategory}>만들기</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog >

            {/* Edit Category Dialog */}
            < Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen} >
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>리스트 편집</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4">
                        <Input
                            placeholder="리스트 이름"
                            value={newCategoryName}
                            onChange={(e) => setNewCategoryName(e.target.value)}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter') handleEditCategory();
                            }}
                            autoFocus
                        />
                        <div>
                            <label className="text-sm font-medium text-gray-700">색상</label>
                            <div className="flex gap-2 mt-2 flex-wrap">
                                {CATEGORY_COLORS.map((color) => (
                                    <button
                                        key={color.value}
                                        type="button"
                                        onClick={() => setSelectedColor(color.value)}
                                        className={`w-8 h-8 rounded-full transition-all ${selectedColor === color.value
                                            ? 'ring-2 ring-offset-2 ring-gray-400 scale-110'
                                            : 'hover:scale-105'
                                            }`}
                                        style={{ backgroundColor: color.value }}
                                        title={color.name}
                                    />
                                ))}
                            </div>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>
                            취소
                        </Button>
                        <Button onClick={handleEditCategory}>저장</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog >

            {/* Delete Category Confirmation Dialog */}
            < Dialog open={!!categoryToDelete
            } onOpenChange={(open) => !open && setCategoryToDelete(null)}>
                <DialogContent showCloseButton={false} className="sm:max-w-[400px]">
                    <DialogHeader>
                        <DialogTitle>리스트 삭제</DialogTitle>
                        <DialogDescription>
                            "{categoryToDelete?.name}" 리스트를 삭제하시겠습니까?<br />
                            포함된 모든 할 일도 함께 삭제됩니다.
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter className="gap-2 sm:gap-0">
                        <Button
                            variant="outline"
                            onClick={() => setCategoryToDelete(null)}
                        >
                            취소
                        </Button>
                        <Button
                            variant="destructive"
                            onClick={confirmDeleteCategory}
                            className="bg-red-600 hover:bg-red-700"
                        >
                            삭제
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog >

            {/* Quick Link Add/Edit Dialog */}
            < Dialog open={isQuickLinkDialogOpen} onOpenChange={setIsQuickLinkDialogOpen} >
                <DialogContent>
                    <DialogHeader>
                        <div className="flex items-center justify-between">
                            <DialogTitle>
                                {editingQuickLink ? '파일 수정' : '자주 쓰는 파일 추가'}
                            </DialogTitle>
                            <button
                                type="button"
                                onClick={() => setQuickLinkFavorite(!quickLinkFavorite)}
                                className={`p-1 rounded-md transition-colors text-gray-400 hover:text-yellow-500 hover:bg-gray-100 dark:hover:bg-gray-800 mr-12 ${quickLinkFavorite ? 'text-yellow-500' : ''}`}
                            >
                                <Star className={`w-6 h-6 ${quickLinkFavorite ? 'fill-yellow-500' : ''}`} />
                            </button>
                        </div>
                    </DialogHeader>
                    <div className="space-y-3">
                        <div>
                            <label className="text-sm font-medium text-gray-700">파일명</label>
                            <Input
                                placeholder="예: 예산표"
                                value={quickLinkName}
                                onChange={(e) => setQuickLinkName(e.target.value)}
                                className="mt-1"
                                autoFocus
                            />
                        </div>
                        <div>
                            <label className="text-sm font-medium text-gray-700">링크 주소</label>
                            <Input
                                placeholder="https://..."
                                value={quickLinkUrl}
                                onChange={(e) => setQuickLinkUrl(e.target.value)}
                                className="mt-1"
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter') handleSaveQuickLink();
                                }}
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsQuickLinkDialogOpen(false)}>
                            취소
                        </Button>
                        <Button onClick={handleSaveQuickLink}>
                            {editingQuickLink ? '수정' : '추가'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog >

            {/* Quick Link Delete Confirmation Dialog */}
            < Dialog open={!!quickLinkToDelete} onOpenChange={(open) => !open && setQuickLinkToDelete(null)}>
                <DialogContent showCloseButton={false} className="sm:max-w-[400px]">
                    <DialogHeader>
                        <DialogTitle>파일 삭제</DialogTitle>
                        <DialogDescription>
                            "{quickLinkToDelete?.name}" 링크를 삭제하시겠습니까?
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter className="gap-2 sm:gap-0">
                        <Button
                            variant="outline"
                            onClick={() => setQuickLinkToDelete(null)}
                        >
                            취소
                        </Button>
                        <Button
                            variant="destructive"
                            onClick={confirmDeleteQuickLink}
                            className="bg-red-600 hover:bg-red-700"
                        >
                            삭제
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog >

            {/* Copy Toast */}
            {showCopyToast && (
                <div className="fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 bg-gray-800 text-white px-4 py-2 rounded-lg shadow-lg z-50 animate-in fade-in zoom-in duration-200 pointer-events-none">
                    링크가 복사되었습니다
                </div>
            )}
        </div >
    );
}

