"use client";

import React, { useState, useEffect, useRef } from 'react';
import { Task, QuickLink, Note } from '@/lib/types';
import { getTasks, getQuickLinks, getNotes, getCategories } from '@/lib/storage';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import {
    Search,
    Calendar,
    FileText,
    Link as LinkIcon,
    CheckSquare,
    User,
    Users,
    Paperclip,
    Tag
} from 'lucide-react';
import { format, addDays, subDays, isWithinInterval, startOfDay, endOfDay } from 'date-fns';
import { ko } from 'date-fns/locale';
import { Checkbox } from '@/components/ui/checkbox';

interface SearchCommandDialogProps {
    isOpen: boolean;
    onClose: () => void;
    onSelectTask: (task: Task) => void;
    onSelectNote: (noteId: string) => void;
}

type SearchResultType = 'task' | 'team-schedule' | 'note' | 'link';
type MatchSource = 'title' | 'assignee' | 'tag' | 'note' | 'url';

interface SearchResult {
    id: string;
    type: SearchResultType;
    title: string;
    subtitle?: React.ReactNode;
    date?: string;
    data: any;
    hasResource?: boolean;
    resourceUrls?: string[];
    matchSource: MatchSource;
}

export function SearchCommandDialog({
    isOpen,
    onClose,
    onSelectTask,
    onSelectNote
}: SearchCommandDialogProps) {
    const [query, setQuery] = useState('');
    const [results, setResults] = useState<SearchResult[]>([]);
    const [selectedIndex, setSelectedIndex] = useState(0);
    const [showCopyToast, setShowCopyToast] = useState(false);
    const [isRecentMonthOnly, setIsRecentMonthOnly] = useState(true);
    const inputRef = useRef<HTMLInputElement>(null);
    const itemRefs = useRef<(HTMLDivElement | null)[]>([]);

    // Reset state when opened
    useEffect(() => {
        if (isOpen) {
            setQuery('');
            setResults([]);
            setSelectedIndex(0);
            setTimeout(() => inputRef.current?.focus(), 50);
        }
    }, [isOpen]);

    // Auto-scroll to selected item
    useEffect(() => {
        if (itemRefs.current[selectedIndex]) {
            itemRefs.current[selectedIndex]?.scrollIntoView({
                block: 'nearest',
                behavior: 'auto'
            });
        }
    }, [selectedIndex]);

    // Helper: Highlight Text
    const highlightText = (text: string, highlight: string) => {
        if (!highlight.trim() || !text) return text;
        const parts = text.split(new RegExp(`(${highlight.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi'));
        return (
            <span>
                {parts.map((part, i) =>
                    part.toLowerCase() === highlight.toLowerCase() ? (
                        <span key={i} className="bg-yellow-200 dark:bg-yellow-900/50 text-black dark:text-yellow-100 rounded-[2px] px-0.5 box-decoration-clone">
                            {part}
                        </span>
                    ) : (
                        part
                    )
                )}
            </span>
        );
    };

    // Helper: Get Preview Context
    const getPreviewContext = (content: string, query: string, maxLength: number = 40) => {
        const index = content.toLowerCase().indexOf(query.toLowerCase());
        if (index === -1) return content.slice(0, maxLength);

        const start = Math.max(0, index - 10);
        const end = Math.min(content.length, index + query.length + 30);

        let preview = content.slice(start, end);
        if (start > 0) preview = '...' + preview;
        if (end < content.length) preview = preview + '...';

        return preview;
    };

    // Search Logic
    useEffect(() => {
        if (!query.trim()) {
            setResults([]);
            return;
        }

        const q = query.toLowerCase();
        const allTasks = getTasks();
        const allQuickLinks = getQuickLinks();
        const allNotes = getNotes();
        const categories = getCategories();

        const teamScheduleCat = categories.find(c => c.name === '팀 일정');
        const teamScheduleId = teamScheduleCat ? teamScheduleCat.id : 'team-schedule-id';

        const searchResults: SearchResult[] = [];

        // Date Range for Recent Month Filter
        const today = new Date();
        const startDate = startOfDay(subDays(today, 20));
        const endDate = endOfDay(addDays(today, 10));

        // 1. Tasks & Team Schedule
        allTasks.forEach(task => {
            if (isRecentMonthOnly) {
                if (!task.dueDate) return;
                const taskDate = new Date(task.dueDate);
                if (!isWithinInterval(taskDate, { start: startDate, end: endDate })) return;
            }

            const isTeamSchedule = task.categoryId === teamScheduleId;
            const resourceUrls = task.resourceUrls && task.resourceUrls.length > 0
                ? task.resourceUrls
                : (task.resourceUrl ? [task.resourceUrl] : []);

            // Determine Match
            let matchSource: MatchSource | null = null;
            let matchPreview: string = '';

            if (task.title.toLowerCase().includes(q)) {
                matchSource = 'title';
            } else if (task.assignee?.toLowerCase().includes(q)) {
                matchSource = 'assignee';
                matchPreview = task.assignee;
            } else if (task.tags?.some(t => t.toLowerCase().includes(q))) {
                matchSource = 'tag';
                matchPreview = task.tags.find(t => t.toLowerCase().includes(q)) || '';
            } else if (task.notes?.toLowerCase().includes(q)) {
                matchSource = 'note';
                matchPreview = getPreviewContext(task.notes, q);
            }

            if (matchSource) {
                // Generate Subtitle based on match source
                let subtitleNode: React.ReactNode;

                if (matchSource === 'title') {
                    // Standard subtitle
                    subtitleNode = (
                        <div className="flex items-center gap-2">
                            {task.assignee && (
                                <span className="flex items-center gap-1">
                                    <User className="w-3 h-3" />
                                    {task.assignee}
                                </span>
                            )}
                        </div>
                    );
                } else if (matchSource === 'assignee') {
                    subtitleNode = (
                        <div className="flex items-center gap-1 text-gray-600 dark:text-gray-400">
                            <User className="w-3 h-3" />
                            <span>담당자: {highlightText(matchPreview, q)}</span>
                        </div>
                    );
                } else if (matchSource === 'tag') {
                    subtitleNode = (
                        <div className="flex items-center gap-1 text-gray-600 dark:text-gray-400">
                            <Tag className="w-3 h-3" />
                            <span>태그: {highlightText(matchPreview, q)}</span>
                        </div>
                    );
                } else if (matchSource === 'note') {
                    subtitleNode = (
                        <div className="flex items-center gap-1 text-gray-600 dark:text-gray-400">
                            <FileText className="w-3 h-3" />
                            <span>메모: {highlightText(matchPreview, q)}</span>
                        </div>
                    );
                }

                searchResults.push({
                    id: task.id,
                    type: isTeamSchedule ? 'team-schedule' : 'task',
                    title: task.title, // Will be highlighted in render
                    subtitle: subtitleNode,
                    date: task.dueDate ? format(new Date(task.dueDate), 'MM.dd', { locale: ko }) : undefined,
                    data: task,
                    hasResource: resourceUrls.length > 0,
                    resourceUrls,
                    matchSource: matchSource!
                });
            }
        });

        // 2. Notes
        allNotes.forEach(note => {
            let matchSource: MatchSource | null = null;
            let matchPreview = '';

            if (note.title.toLowerCase().includes(q)) {
                matchSource = 'title';
            } else if (note.content.toLowerCase().includes(q)) {
                matchSource = 'note';
                matchPreview = getPreviewContext(note.content, q);
            }

            if (matchSource) {
                searchResults.push({
                    id: note.id,
                    type: 'note',
                    title: note.title || '제목 없음',
                    subtitle: matchSource === 'note'
                        ? <span className="flex items-center gap-1"><FileText className="w-3 h-3" /> {highlightText(matchPreview, q)}</span>
                        : undefined,
                    data: note,
                    hasResource: false,
                    matchSource: matchSource!
                });
            }
        });

        // 3. Quick Links
        allQuickLinks.forEach(link => {
            let matchSource: MatchSource | null = null;

            if (link.name.toLowerCase().includes(q)) {
                matchSource = 'title';
            } else if (link.url.toLowerCase().includes(q)) {
                matchSource = 'url';
            }

            if (matchSource) {
                searchResults.push({
                    id: link.id,
                    type: 'link',
                    title: link.name,
                    subtitle: matchSource === 'url' ? highlightText(link.url, q) : link.url,
                    data: link,
                    hasResource: true,
                    resourceUrls: [link.url],
                    matchSource: matchSource!
                });
            }
        });

        setResults(searchResults);
        setSelectedIndex(0);
    }, [query, isOpen]);

    // Keyboard Navigation
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (!isOpen) return;

            if (e.key === 'ArrowDown') {
                e.preventDefault();
                setSelectedIndex(prev => Math.min(prev + 1, results.length - 1));
            } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                setSelectedIndex(prev => Math.max(prev - 1, 0));
            } else if (e.key === 'Enter') {
                e.preventDefault();
                if (results[selectedIndex]) {
                    handleSelect(results[selectedIndex], e.ctrlKey || e.metaKey);
                }
            } else if (e.key === 'Escape') {
                onClose();
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isOpen, results, selectedIndex]);

    const handleSelect = (result: SearchResult, shouldClose: boolean = false) => {
        if (result.type === 'task' || result.type === 'team-schedule') {
            onSelectTask(result.data as Task);
        } else if (result.type === 'note') {
            onSelectNote((result.data as Note).id);
        } else if (result.type === 'link') {
            window.open((result.data as QuickLink).url, '_blank');
        }

        if (shouldClose) {
            onClose();
        }
    };

    const handleResourceClick = (e: React.MouseEvent, result: SearchResult) => {
        e.stopPropagation();
        if (result.resourceUrls && result.resourceUrls.length > 0) {
            navigator.clipboard.writeText(result.resourceUrls[0]);

            setShowCopyToast(true);
            setTimeout(() => setShowCopyToast(false), 2000);

            if (!e.ctrlKey && !e.metaKey) {
                window.open(result.resourceUrls[0], '_blank');
            }
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="p-0 gap-0 max-w-2xl bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-800 overflow-hidden shadow-2xl">
                {/* Search Input */}
                <div className="flex items-center px-4 py-3 border-b border-gray-100 dark:border-gray-800">
                    <Search className="w-5 h-5 text-gray-400 mr-3" />
                    <Input
                        ref={inputRef}
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        placeholder="전체 검색... (할 일, 팀 일정, 메모, 파일)"
                        className="border-none shadow-none focus-visible:ring-0 text-lg bg-transparent px-0 placeholder:text-gray-400"
                    />
                    <div className="hidden sm:flex items-center text-xs text-gray-400 bg-gray-100 dark:bg-gray-800 px-1.5 py-0.5 rounded mr-8 whitespace-nowrap">
                        ESC
                    </div>
                </div>

                {/* Filters */}
                <div className="px-4 py-2 border-b border-gray-100 dark:border-gray-800 flex items-center gap-4">
                    <div className="flex items-center space-x-2">
                        <Checkbox
                            id="recent-filter"
                            checked={isRecentMonthOnly}
                            onCheckedChange={(checked) => setIsRecentMonthOnly(checked as boolean)}
                        />
                        <label
                            htmlFor="recent-filter"
                            className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer select-none text-gray-600 dark:text-gray-400"
                        >
                            최근 한달간 (+10일 ~ -20일)
                        </label>
                    </div>
                </div>

                {/* Results Area */}
                <div className="max-h-[60vh] overflow-y-auto">
                    {query.trim() === '' ? (
                        <div className="text-center py-12 text-gray-400 dark:text-gray-600">
                            <Search className="w-12 h-12 mx-auto mb-3 opacity-20" />
                            <p>검색어를 입력하세요</p>
                        </div>
                    ) : results.length === 0 ? (
                        <div className="text-center py-12 text-gray-400 dark:text-gray-600">
                            <p>검색 결과가 없습니다</p>
                        </div>
                    ) : (
                        <div className="py-2">
                            {results.map((result, index) => (
                                <div
                                    key={`${result.type}-${result.id}`}
                                    ref={(el) => { itemRefs.current[index] = el; }}
                                    className={`px-4 py-3 cursor-pointer flex items-center justify-between group ${index === selectedIndex
                                        ? 'bg-blue-50 dark:bg-blue-900/20 border-l-2 border-blue-500'
                                        : 'hover:bg-gray-50 dark:hover:bg-gray-800/50 border-l-2 border-transparent'
                                        }`}
                                    onClick={(e) => handleSelect(result, e.ctrlKey || e.metaKey)}
                                    onMouseEnter={() => setSelectedIndex(index)}
                                >
                                    <div className="flex items-center gap-3 overflow-hidden flex-1">
                                        {/* Icon */}
                                        <div className={`p-2 rounded-lg shrink-0 ${result.type === 'team-schedule' ? 'bg-orange-100 text-orange-600 dark:bg-orange-900/30 dark:text-orange-400' :
                                            result.type === 'task' ? 'bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400' :
                                                result.type === 'note' ? 'bg-yellow-100 text-yellow-600 dark:bg-yellow-900/30 dark:text-yellow-400' :
                                                    'bg-purple-100 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400'
                                            }`}>
                                            {result.type === 'team-schedule' && <Users className="w-4 h-4" />}
                                            {result.type === 'task' && <CheckSquare className="w-4 h-4" />}
                                            {result.type === 'note' && <FileText className="w-4 h-4" />}
                                            {result.type === 'link' && <LinkIcon className="w-4 h-4" />}
                                        </div>

                                        {/* Content */}
                                        <div className="min-w-0 flex-1">
                                            <div className="flex items-center gap-2">
                                                <span className={`font-medium truncate ${(result.type === 'task' || result.type === 'team-schedule') && (result.data as Task).completed
                                                    ? 'line-through opacity-70'
                                                    : ''
                                                    }`}>
                                                    {highlightText(result.title, query)}
                                                </span>
                                                {result.date && (
                                                    <span className="text-[10px] bg-gray-100 dark:bg-gray-800 text-gray-500 px-1.5 rounded flex items-center gap-1 shrink-0">
                                                        <Calendar className="w-3 h-3" />
                                                        {result.date}
                                                    </span>
                                                )}
                                                {result.type === 'team-schedule' && (
                                                    <span className="text-[10px] bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400 px-1.5 rounded">
                                                        팀 일정
                                                    </span>
                                                )}
                                            </div>
                                            {result.subtitle && (
                                                <div className="text-xs text-gray-500 dark:text-gray-400 truncate flex items-center gap-1 mt-0.5">
                                                    {result.subtitle}
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    {/* Right Actions */}
                                    <div className="flex items-center gap-2 ml-4">
                                        {/* Resource Paperclip */}
                                        {result.hasResource && (
                                            <div
                                                className="p-1.5 rounded hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-400 hover:text-blue-500 cursor-pointer transition-colors"
                                                onClick={(e) => handleResourceClick(e, result)}
                                                title={result.resourceUrls?.[0] || "자료 열기"}
                                            >
                                                <Paperclip className="w-4 h-4" />
                                            </div>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Toast Notification */}
                {showCopyToast && (
                    <div className="absolute bottom-12 left-1/2 transform -translate-x-1/2 bg-gray-800 text-white text-xs px-3 py-1.5 rounded-full shadow-lg z-50 animate-in fade-in zoom-in duration-200 pointer-events-none">
                        클립보드에 복사되었습니다
                    </div>
                )}

                {/* Footer */}
                {results.length > 0 && (
                    <div className="bg-gray-50 dark:bg-gray-900/50 border-t border-gray-100 dark:border-gray-800 px-4 py-2 text-[10px] text-gray-400 flex justify-between">
                        <div>
                            <span className="font-medium">{results.length}</span>개의 결과
                        </div>
                        <div className="flex gap-3">
                            <span><strong className="text-gray-500 dark:text-gray-300">↑↓</strong> 이동</span>
                            <span><strong className="text-gray-500 dark:text-gray-300">Enter</strong> 선택</span>
                        </div>
                    </div>
                )}
            </DialogContent>
        </Dialog>
    );
}
