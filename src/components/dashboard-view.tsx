"use client";

import React, { useState, useEffect, useMemo } from 'react';
import { Task, Category, QuickLink, Note, TeamMember, BusinessTrip } from '@/lib/types';
import {
    getTasks, getCategories, getQuickLinks, getNotes, getTeamMembers, getBusinessTrips
} from '@/lib/storage';
import {
    Users, Plane, Palmtree, GraduationCap, CheckCircle2, Circle,
    Clock, ExternalLink, FileText, Search, X, ChevronRight,
    CalendarDays, AlertCircle
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface DashboardViewProps {
    onTaskClick?: (task: Task) => void;
    onNoteClick?: (noteId: string) => void;
    onSearchClick?: () => void;
    teamScheduleCategoryId: string;
}

// Category colors for trips
const categoryMeta: Record<string, { label: string; icon: React.ReactNode; color: string; bgColor: string; borderColor: string }> = {
    trip: { label: '출장', icon: <Plane className="w-5 h-5" />, color: 'text-blue-600', bgColor: 'bg-blue-50 dark:bg-blue-900/30', borderColor: 'border-blue-200 dark:border-blue-800' },
    vacation: { label: '휴가', icon: <Palmtree className="w-5 h-5" />, color: 'text-emerald-600', bgColor: 'bg-emerald-50 dark:bg-emerald-900/30', borderColor: 'border-emerald-200 dark:border-emerald-800' },
    education: { label: '교육', icon: <GraduationCap className="w-5 h-5" />, color: 'text-purple-600', bgColor: 'bg-purple-50 dark:bg-purple-900/30', borderColor: 'border-purple-200 dark:border-purple-800' },
};

// Helper: get Monday of current week
function getWeekStart(date: Date): Date {
    const d = new Date(date);
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1);
    d.setDate(diff);
    d.setHours(0, 0, 0, 0);
    return d;
}

// Helper: format date for display
function formatDate(dateStr: string): string {
    const d = new Date(dateStr);
    return `${d.getMonth() + 1}/${d.getDate()}`;
}

function formatDateRange(start: string, end: string): string {
    return `${formatDate(start)} ~ ${formatDate(end)}`;
}

const DAY_NAMES = ['월', '화', '수', '목', '금', '토'];

export function DashboardView({ onTaskClick, onNoteClick, onSearchClick, teamScheduleCategoryId }: DashboardViewProps) {
    const [members, setMembers] = useState<TeamMember[]>([]);
    const [trips, setTrips] = useState<BusinessTrip[]>([]);
    const [tasks, setTasks] = useState<Task[]>([]);
    const [categories, setCategories] = useState<Category[]>([]);
    const [notes, setNotes] = useState<Note[]>([]);
    const [quickLinks, setQuickLinks] = useState<QuickLink[]>([]);
    const [detailModal, setDetailModal] = useState<'trip' | 'vacation' | 'education' | null>(null);

    // Load all data
    useEffect(() => {
        setMembers(getTeamMembers().filter(m => m.status !== '퇴직'));
        setTrips(getBusinessTrips());
        setTasks(getTasks());
        setCategories(getCategories());
        setNotes(getNotes().filter(n => !n.isArchived).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()));
        const links = getQuickLinks();
        links.sort((a, b) => (a.isFavorite === b.isFavorite ? 0 : a.isFavorite ? -1 : 1));
        setQuickLinks(links);
    }, []);

    // Today
    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];

    // ── Attendance Summary ──
    const activeTrips = useMemo(() => {
        return trips.filter(t => {
            const start = new Date(t.startDate);
            const end = new Date(t.endDate);
            start.setHours(0, 0, 0, 0);
            end.setHours(23, 59, 59, 999);
            return today >= start && today <= end;
        });
    }, [trips, todayStr]);

    const attendanceSummary = useMemo(() => {
        const onTrip = activeTrips.filter(t => t.category === 'trip');
        const onVacation = activeTrips.filter(t => t.category === 'vacation');
        const onEducation = activeTrips.filter(t => t.category === 'education');

        // Deduplicate by knoxId or name
        const absentIds = new Set<string>();
        activeTrips.forEach(t => absentIds.add(t.knoxId || t.name));

        const totalMembers = members.length;
        const absentCount = absentIds.size;
        const presentCount = Math.max(0, totalMembers - absentCount);

        return { presentCount, onTrip, onVacation, onEducation };
    }, [members, activeTrips]);

    // ── Weekly Tasks (today + 7 days) ──
    const weeklyTasks = useMemo(() => {
        const weekEnd = new Date(today);
        weekEnd.setDate(weekEnd.getDate() + 7);
        const weekEndStr = weekEnd.toISOString().split('T')[0];

        return tasks
            .filter(t => {
                // Skip team schedule tasks
                if (t.categoryId === teamScheduleCategoryId) return false;
                if (!t.dueDate) return false;
                return t.dueDate <= weekEndStr;
            })
            .sort((a, b) => {
                // Incomplete first, then by due date
                if (a.completed !== b.completed) return a.completed ? 1 : -1;
                return (a.dueDate || '').localeCompare(b.dueDate || '');
            });
    }, [tasks, teamScheduleCategoryId, todayStr]);

    // ── Weekly Team Schedule (Mon~Sat) ──
    const weekSchedule = useMemo(() => {
        const weekStart = getWeekStart(today);
        const days: { date: Date; dateStr: string; tasks: Task[] }[] = [];

        for (let i = 0; i < 6; i++) { // Mon~Sat
            const d = new Date(weekStart);
            d.setDate(d.getDate() + i);
            const dateStr = d.toISOString().split('T')[0];
            const dayTasks = tasks
                .filter(t => t.categoryId === teamScheduleCategoryId && t.dueDate === dateStr)
                .sort((a, b) => (a.dueTime || '').localeCompare(b.dueTime || ''));
            days.push({ date: d, dateStr, tasks: dayTasks });
        }
        return days;
    }, [tasks, teamScheduleCategoryId, todayStr]);

    // ── Category color lookup ──
    const getCategoryColor = (categoryId: string): string => {
        const cat = categories.find(c => c.id === categoryId);
        return cat?.color || '#3b82f6';
    };

    // ── Render ──
    return (
        <div className="h-full overflow-auto bg-gray-50/50 dark:bg-gray-950 p-4 space-y-4">
            {/* ━━━ Section 1: Attendance Summary Cards ━━━ */}
            <div className="grid grid-cols-4 gap-3">
                {/* Present */}
                <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 p-4 shadow-sm">
                    <div className="flex items-center gap-3">
                        <div className="p-2.5 rounded-lg bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400">
                            <Users className="w-5 h-5" />
                        </div>
                        <div>
                            <p className="text-2xl font-bold text-gray-900 dark:text-white">{attendanceSummary.presentCount}</p>
                            <p className="text-xs text-gray-500 dark:text-gray-400">재실</p>
                        </div>
                    </div>
                </div>

                {/* Trip / Vacation / Education */}
                {(['trip', 'vacation', 'education'] as const).map(cat => {
                    const meta = categoryMeta[cat];
                    const list = cat === 'trip' ? attendanceSummary.onTrip
                        : cat === 'vacation' ? attendanceSummary.onVacation
                            : attendanceSummary.onEducation;
                    // Deduplicate by knoxId/name for count
                    const uniqueNames = new Set(list.map(t => t.knoxId || t.name));

                    return (
                        <button
                            key={cat}
                            onClick={() => setDetailModal(list.length > 0 ? cat : null)}
                            className={`${meta.bgColor} rounded-xl border ${meta.borderColor} p-4 shadow-sm text-left transition-all hover:shadow-md hover:scale-[1.02] active:scale-[0.98] cursor-pointer`}
                        >
                            <div className="flex items-center gap-3">
                                <div className={`p-2.5 rounded-lg ${meta.color} bg-white/60 dark:bg-gray-800/60`}>
                                    {meta.icon}
                                </div>
                                <div>
                                    <p className={`text-2xl font-bold ${meta.color}`}>{uniqueNames.size}</p>
                                    <p className="text-xs text-gray-500 dark:text-gray-400">{meta.label}중</p>
                                </div>
                            </div>
                        </button>
                    );
                })}
            </div>

            {/* ━━━ Section 2: Tasks + Team Schedule ━━━ */}
            <div className="grid grid-cols-5 gap-4" style={{ minHeight: '320px' }}>
                {/* ── Left: Today & This Week Tasks ── */}
                <div className="col-span-2 bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm flex flex-col overflow-hidden">
                    <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-800 flex items-center gap-2">
                        <CheckCircle2 className="w-4 h-4 text-blue-500" />
                        <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-200">오늘 & 이번주 할 일</h3>
                        <span className="ml-auto text-xs text-gray-400">{weeklyTasks.filter(t => !t.completed).length}건 남음</span>
                    </div>
                    <div className="flex-1 overflow-auto p-2">
                        {weeklyTasks.length === 0 ? (
                            <div className="flex flex-col items-center justify-center h-full text-gray-400 dark:text-gray-600">
                                <CheckCircle2 className="w-10 h-10 mb-2 opacity-40" />
                                <p className="text-sm">이번 주 예정된 할 일이 없습니다</p>
                            </div>
                        ) : (
                            <div className="space-y-0.5">
                                {weeklyTasks.map(task => {
                                    const isOverdue = !task.completed && task.dueDate && task.dueDate < todayStr;
                                    const isToday = task.dueDate === todayStr;
                                    return (
                                        <div
                                            key={task.id}
                                            onClick={() => onTaskClick?.(task)}
                                            className={`flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer transition-colors group
                                                ${task.completed ? 'opacity-50' : ''}
                                                ${isOverdue ? 'bg-red-50/50 dark:bg-red-900/10' : 'hover:bg-gray-50 dark:hover:bg-gray-800'}
                                            `}
                                        >
                                            {task.completed ? (
                                                <CheckCircle2 className="w-4 h-4 text-green-500 flex-shrink-0" />
                                            ) : isOverdue ? (
                                                <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0" />
                                            ) : (
                                                <Circle className="w-4 h-4 text-gray-300 dark:text-gray-600 flex-shrink-0" />
                                            )}
                                            <div
                                                className="w-2 h-2 rounded-full flex-shrink-0"
                                                style={{ backgroundColor: getCategoryColor(task.categoryId) }}
                                            />
                                            <span className={`text-sm flex-1 truncate ${task.completed ? 'line-through text-gray-400' : 'text-gray-700 dark:text-gray-300'}`}>
                                                {task.title}
                                            </span>
                                            <span className={`text-[11px] flex-shrink-0 ${isToday ? 'text-blue-500 font-semibold' : isOverdue ? 'text-red-500 font-semibold' : 'text-gray-400'}`}>
                                                {isToday ? '오늘' : task.dueDate ? formatDate(task.dueDate) : ''}
                                                {task.dueTime ? ` ${task.dueTime}` : ''}
                                            </span>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                </div>

                {/* ── Right: Weekly Team Schedule (Mon~Sat) ── */}
                <div className="col-span-3 bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm flex flex-col overflow-hidden">
                    <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-800 flex items-center gap-2">
                        <CalendarDays className="w-4 h-4 text-indigo-500" />
                        <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-200">이번 주 팀 일정</h3>
                        <span className="ml-auto text-xs text-gray-400">
                            {formatDate(weekSchedule[0]?.dateStr || '')} ~ {formatDate(weekSchedule[5]?.dateStr || '')}
                        </span>
                    </div>
                    <div className="flex-1 grid grid-cols-6 divide-x divide-gray-100 dark:divide-gray-800 overflow-auto">
                        {weekSchedule.map((day, idx) => {
                            const isToday = day.dateStr === todayStr;
                            const d = day.date;
                            const isSat = idx === 5;
                            return (
                                <div key={idx} className={`flex flex-col min-w-0 ${isToday ? 'bg-blue-50/40 dark:bg-blue-900/10' : ''}`}>
                                    {/* Day header */}
                                    <div className={`text-center py-2 border-b border-gray-100 dark:border-gray-800 ${isToday ? 'bg-blue-100/60 dark:bg-blue-900/30' : ''}`}>
                                        <div className={`text-xs font-semibold ${isSat ? 'text-blue-500' : isToday ? 'text-blue-600 dark:text-blue-400' : 'text-gray-500 dark:text-gray-400'}`}>
                                            {DAY_NAMES[idx]}
                                        </div>
                                        <div className={`text-lg font-bold leading-tight ${isToday ? 'text-blue-600 dark:text-blue-400' : 'text-gray-800 dark:text-gray-200'}`}>
                                            {d.getDate()}
                                        </div>
                                    </div>
                                    {/* Events */}
                                    <div className="flex-1 p-1 space-y-1 overflow-auto">
                                        {day.tasks.length === 0 ? (
                                            <div className="text-center text-gray-300 dark:text-gray-700 text-xs py-4">-</div>
                                        ) : (
                                            day.tasks.map(task => (
                                                <div
                                                    key={task.id}
                                                    onClick={() => onTaskClick?.(task)}
                                                    className="rounded-md px-1.5 py-1 cursor-pointer transition-all hover:opacity-80 hover:shadow-sm border-l-[3px]"
                                                    style={{
                                                        borderLeftColor: getCategoryColor(task.categoryId),
                                                        backgroundColor: getCategoryColor(task.categoryId) + '15',
                                                    }}
                                                >
                                                    {task.dueTime && (
                                                        <div className="text-[10px] text-gray-500 dark:text-gray-400 font-medium">
                                                            {task.dueTime}
                                                        </div>
                                                    )}
                                                    <div className="text-[11px] text-gray-700 dark:text-gray-300 font-medium truncate leading-tight">
                                                        {task.title}
                                                    </div>
                                                </div>
                                            ))
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>

            {/* ━━━ Section 3: Quick Access Panel ━━━ */}
            <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm p-4">
                <div className="flex items-center gap-2 mb-3">
                    <ChevronRight className="w-4 h-4 text-gray-400" />
                    <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-200">빠른 접근</h3>
                </div>
                <div className="grid grid-cols-3 gap-4">
                    {/* Recent Memos */}
                    <div>
                        <h4 className="text-xs text-gray-500 dark:text-gray-400 font-medium mb-2 flex items-center gap-1">
                            <FileText className="w-3 h-3" /> 최근 메모
                        </h4>
                        <div className="space-y-1.5">
                            {notes.slice(0, 3).map(note => (
                                <div
                                    key={note.id}
                                    onClick={() => onNoteClick?.(note.id)}
                                    className="flex items-center gap-2 px-2.5 py-2 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer transition-colors group"
                                >
                                    <div
                                        className="w-3 h-3 rounded-full flex-shrink-0 border border-gray-200 dark:border-gray-600"
                                        style={{ backgroundColor: note.color }}
                                    />
                                    <span className="text-sm text-gray-700 dark:text-gray-300 truncate flex-1">
                                        {note.title || '제목 없음'}
                                    </span>
                                </div>
                            ))}
                            {notes.length === 0 && (
                                <p className="text-xs text-gray-400 py-2">메모가 없습니다</p>
                            )}
                        </div>
                    </div>

                    {/* Favorite Quick Links */}
                    <div>
                        <h4 className="text-xs text-gray-500 dark:text-gray-400 font-medium mb-2 flex items-center gap-1">
                            <ExternalLink className="w-3 h-3" /> 즐겨찾기 링크
                        </h4>
                        <div className="space-y-1.5">
                            {quickLinks.filter(l => l.isFavorite).slice(0, 4).map(link => (
                                <a
                                    key={link.id}
                                    href={link.url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="flex items-center gap-2 px-2.5 py-2 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors group"
                                >
                                    <ExternalLink className="w-3 h-3 text-blue-400 flex-shrink-0" />
                                    <span className="text-sm text-gray-700 dark:text-gray-300 truncate flex-1">
                                        {link.name}
                                    </span>
                                </a>
                            ))}
                            {quickLinks.filter(l => l.isFavorite).length === 0 && (
                                <p className="text-xs text-gray-400 py-2">즐겨찾기한 링크가 없습니다</p>
                            )}
                        </div>
                    </div>

                    {/* Search Shortcut */}
                    <div>
                        <h4 className="text-xs text-gray-500 dark:text-gray-400 font-medium mb-2 flex items-center gap-1">
                            <Search className="w-3 h-3" /> 빠른 검색
                        </h4>
                        <button
                            onClick={onSearchClick}
                            className="w-full flex items-center gap-2 px-3 py-2.5 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors text-left"
                        >
                            <Search className="w-4 h-4 text-gray-400" />
                            <span className="text-sm text-gray-400 flex-1">검색...</span>
                            <kbd className="text-[10px] text-gray-400 bg-gray-200 dark:bg-gray-600 px-1.5 py-0.5 rounded font-mono">Ctrl+K</kbd>
                        </button>
                    </div>
                </div>
            </div>

            {/* ━━━ Attendance Detail Modal ━━━ */}
            <AnimatePresence>
                {detailModal && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4"
                        onClick={() => setDetailModal(null)}
                    >
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95, y: 10 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.95, y: 10 }}
                            className="bg-white dark:bg-gray-900 rounded-xl shadow-2xl border border-gray-200 dark:border-gray-700 w-full max-w-lg max-h-[70vh] flex flex-col"
                            onClick={e => e.stopPropagation()}
                        >
                            {/* Modal Header */}
                            <div className={`flex items-center justify-between px-5 py-4 border-b ${categoryMeta[detailModal]?.borderColor || 'border-gray-200'} ${categoryMeta[detailModal]?.bgColor || ''} rounded-t-xl`}>
                                <div className="flex items-center gap-3">
                                    <div className={`${categoryMeta[detailModal]?.color}`}>
                                        {categoryMeta[detailModal]?.icon}
                                    </div>
                                    <div>
                                        <h2 className="text-base font-bold text-gray-900 dark:text-white">
                                            {categoryMeta[detailModal]?.label}중 현황
                                        </h2>
                                        <p className="text-xs text-gray-500 dark:text-gray-400">
                                            {today.getFullYear()}년 {today.getMonth() + 1}월 {today.getDate()}일 기준
                                        </p>
                                    </div>
                                </div>
                                <button
                                    onClick={() => setDetailModal(null)}
                                    className="p-1.5 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
                                >
                                    <X className="w-5 h-5 text-gray-500" />
                                </button>
                            </div>

                            {/* Modal Body */}
                            <div className="flex-1 overflow-auto p-4">
                                {(() => {
                                    const list = detailModal === 'trip' ? attendanceSummary.onTrip
                                        : detailModal === 'vacation' ? attendanceSummary.onVacation
                                            : attendanceSummary.onEducation;

                                    if (list.length === 0) {
                                        return (
                                            <div className="text-center text-gray-400 py-10">
                                                해당하는 인원이 없습니다
                                            </div>
                                        );
                                    }

                                    // Group by person (knoxId or name)
                                    const grouped = new Map<string, BusinessTrip[]>();
                                    list.forEach(t => {
                                        const key = t.knoxId || t.name;
                                        if (!grouped.has(key)) grouped.set(key, []);
                                        grouped.get(key)!.push(t);
                                    });

                                    return (
                                        <div className="space-y-2">
                                            {Array.from(grouped.entries()).map(([key, trips]) => {
                                                const person = trips[0];
                                                const member = members.find(m => m.knoxId === person.knoxId);
                                                return (
                                                    <div key={key} className="rounded-lg border border-gray-100 dark:border-gray-800 p-3 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
                                                        <div className="flex items-center justify-between mb-1">
                                                            <div className="flex items-center gap-2">
                                                                <span className="font-semibold text-sm text-gray-800 dark:text-gray-200">
                                                                    {person.name}
                                                                </span>
                                                                {member && (
                                                                    <span className="text-xs text-gray-400">
                                                                        {member.group} · {member.part}
                                                                    </span>
                                                                )}
                                                            </div>
                                                        </div>
                                                        {trips.map(t => (
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
                                    );
                                })()}
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
