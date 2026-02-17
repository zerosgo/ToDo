'use client';

import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { BusinessTrip, TeamMember, TripCategory } from '@/lib/types';
import { getBusinessTrips, saveBusinessTrips, deleteBusinessTrip, getTeamMembers, addTripRecord, getTripRecords, deleteTripRecord, getNameResolutions } from '@/lib/storage';
import { TripRecord } from '@/lib/types';
import { parseTripText } from '@/lib/trip-parser';
import { TripRecordBoard } from './trip-record-board';
import { parseTripRecordText } from '@/lib/trip-record-parser';
import { TripNameResolverDialog } from './trip-name-resolver-dialog';
import { resolveDestination, buildDisplayLabel, getDestinationMappings, DestinationMatch } from '@/lib/trip-destination-resolver';
import { TripDestinationPickerDialog, DestinationConflict } from './trip-destination-picker-dialog';
import {
    Search,
    Plane,
    Calendar,
    Trash2,
    ArrowUpDown,
    ClipboardPaste,
    ClipboardCopy,
    AlertCircle,
    AlertTriangle,
    Settings,
} from 'lucide-react';

interface TripBoardProps {
    onDataChange?: () => void;
}

type SortField = 'name' | 'startDate' | 'endDate' | 'location' | 'purpose' | 'status';
type SortOrder = 'asc' | 'desc';

// Group/Part sort order (hardcoded per user spec)
const GROUP_ORDER = ['CP', 'OLB', 'LASER', '라미1', '라미2'];
const PART_ORDER: Record<string, string[]> = {
    'CP': ['공정', '설비', '천안'],
    'OLB': ['공정', '설비', '천안'],
    'LASER': ['MX/Global', 'A4', '투자'],
    '라미1': ['A-Phone', 'A-IT'],
    '라미2': ['Foldable', 'Y&R', 'IT/Auto', '천안'],
};
const POSITION_RANK: Record<string, number> = {
    'CL1': 1, 'CL2': 2, 'CL3': 3, 'CL4': 4,
    '사원': 1, '대리': 2, '과장': 3, '차장': 4, '부장': 5,
};

// Category color presets
// Default Category Colors
const DEFAULT_CATEGORY_COLORS: Record<TripCategory, { bg: string; text: string; label: string }> = {
    trip: { bg: '#3b82f6', text: '#ffffff', label: '출장' },
    vacation: { bg: '#22c55e', text: '#ffffff', label: '휴가' },
    education: { bg: '#a855f7', text: '#ffffff', label: '교육' },
    others: { bg: '#f97316', text: '#ffffff', label: '기타' },
};

// Destination-specific colors for trip category bars
const DESTINATION_COLORS: Record<string, string> = {
    'SDV': '#2563eb',   // blue
    'SDI': '#0891b2',   // cyan
    'SDS': '#059669',   // emerald
    'SMD': '#7c3aed',   // violet
    'SDSA': '#dc2626',  // red
    'SDVN': '#ea580c',  // orange
    'SDSZ': '#d97706',  // amber
    'SDMS': '#0d9488',  // teal
    'SDC': '#4f46e5',   // indigo
    'SIEL': '#be185d',  // pink
    'SDLA': '#65a30d',  // lime
    'SDME': '#9333ea',  // purple
};

/** Hash-based color for unknown destinations */
function getDestinationColor(dest: string): string {
    if (DESTINATION_COLORS[dest]) return DESTINATION_COLORS[dest];
    // Generate a deterministic color from the destination name
    let hash = 0;
    for (let i = 0; i < dest.length; i++) {
        hash = dest.charCodeAt(i) + ((hash << 5) - hash);
    }
    const hue = Math.abs(hash) % 360;
    return `hsl(${hue}, 65%, 45%)`;
}

export function TripBoard({ onDataChange }: TripBoardProps) {
    // Load saved Gantt preferences from localStorage
    const savedPrefs = useMemo(() => {
        if (typeof window === 'undefined') return null;
        try {
            const raw = localStorage.getItem('ganttViewPrefs');
            return raw ? JSON.parse(raw) : null;
        } catch { return null; }
    }, []);

    const [trips, setTrips] = useState<BusinessTrip[]>([]);
    const [members, setMembers] = useState<TeamMember[]>([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [filterStatus, setFilterStatus] = useState<string>('all'); // all, active, planned, completed
    const [sortField, setSortField] = useState<SortField>('startDate');
    const [sortOrder, setSortOrder] = useState<SortOrder>('desc');
    const [importToast, setImportToast] = useState<string | null>(null);
    const [viewMode, setViewMode] = useState<'list' | 'gantt'>(() => {
        if (typeof window !== 'undefined') {
            return (localStorage.getItem('tripViewMode') as 'list' | 'gantt') || 'gantt';
        }
        return 'gantt';
    });
    const [ganttStartDate, setGanttStartDate] = useState(() => {
        if (savedPrefs?.ganttStartDate) return savedPrefs.ganttStartDate;
        const d = new Date();
        d.setDate(d.getDate() - 7);
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    });
    const [ganttEndDate, setGanttEndDate] = useState(() => {
        if (savedPrefs?.ganttEndDate) return savedPrefs.ganttEndDate;
        const d = new Date();
        d.setDate(d.getDate() + 35);
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    });
    const [categoryFilters, setCategoryFilters] = useState<Record<TripCategory, boolean>>(
        savedPrefs?.categoryFilters ?? { trip: true, vacation: true, education: true, others: true }
    );
    const [ganttGroupFilter, setGanttGroupFilter] = useState<string>(savedPrefs?.ganttGroupFilter ?? 'all');
    const [ganttPartFilter, setGanttPartFilter] = useState<string>(savedPrefs?.ganttPartFilter ?? 'all');
    const [ganttDeptFilter, setGanttDeptFilter] = useState<string>(savedPrefs?.ganttDeptFilter ?? 'all');
    const [activeTab, setActiveTab] = useState<'attendance' | 'manual'>(savedPrefs?.activeTab ?? 'attendance');
    const [manualDataVersion, setManualDataVersion] = useState(0);
    const [barOpacity, setBarOpacity] = useState(savedPrefs?.barOpacity ?? 0.8);
    const [showSettings, setShowSettings] = useState(false);
    const [destFilters, setDestFilters] = useState<Record<string, boolean>>(savedPrefs?.destFilters ?? {});

    // Custom Category Colors
    const [categoryColors, setCategoryColors] = useState(DEFAULT_CATEGORY_COLORS);

    // Load colors from local storage
    useEffect(() => {
        if (typeof window !== 'undefined') {
            const saved = localStorage.getItem('tripCategoryColors');
            if (saved) {
                try {
                    setCategoryColors({ ...DEFAULT_CATEGORY_COLORS, ...JSON.parse(saved) });
                } catch (e) { console.error('Failed to parse colors', e); }
            }
        }
    }, []);

    // Save colors to local storage
    useEffect(() => {
        if (typeof window !== 'undefined') {
            localStorage.setItem('tripCategoryColors', JSON.stringify(categoryColors));
        }
    }, [categoryColors]);

    const handleColorChange = (cat: TripCategory, color: string) => {
        setCategoryColors(prev => ({
            ...prev,
            [cat]: { ...prev[cat], bg: color }
        }));
    };

    // Phase 6-F: Data Matching
    const [tripRecords, setTripRecords] = useState<TripRecord[]>([]);
    const [nameResolutions, setNameResolutions] = useState<Record<string, string>>({});
    const [conflicts, setConflicts] = useState<{ name: string; candidates: TeamMember[] }[]>([]);
    const [showResolver, setShowResolver] = useState(false);

    // Destination Mapping (attendance trip → manual DB record)
    const [destinationMappings, setDestinationMappings] = useState<Record<string, string>>({});
    const [destinationConflicts, setDestinationConflicts] = useState<DestinationConflict[]>([]);
    const [showDestinationPicker, setShowDestinationPicker] = useState(false);

    useEffect(() => {
        setTrips(getBusinessTrips());
        setMembers(getTeamMembers());
        setTripRecords(getTripRecords());
        setNameResolutions(getNameResolutions());
        setDestinationMappings(getDestinationMappings());
    }, [manualDataVersion]); // Reload when manual data changes

    // Conflict Detection (for team member matching)
    useEffect(() => {
        if (tripRecords.length === 0 || members.length === 0) return;

        const newConflicts: { name: string; candidates: TeamMember[] }[] = [];
        const processedNames = new Set<string>();

        tripRecords.forEach(record => {
            if (record.knoxId) return;
            if (nameResolutions[record.name]) return;
            if (processedNames.has(record.name)) return;

            const candidates = members.filter(m => m.name === record.name);
            if (candidates.length > 1) {
                newConflicts.push({ name: record.name, candidates });
                processedNames.add(record.name);
            }
        });

        setConflicts(newConflicts);
    }, [tripRecords, members, nameResolutions]);

    // Destination Resolution: match attendance trips → manual DB destinations
    const { destinationMap, pendingDestConflicts } = useMemo(() => {
        const destMap = new Map<string, DestinationMatch>();
        const pendingConflicts: DestinationConflict[] = [];

        if (tripRecords.length === 0) return { destinationMap: destMap, pendingDestConflicts: pendingConflicts };

        trips.forEach(trip => {
            const result = resolveDestination(trip, tripRecords, destinationMappings);
            if (result.match) {
                destMap.set(trip.id, result.match);
            } else if (result.needsUserChoice && result.candidates.length > 0) {
                pendingConflicts.push({
                    tripId: trip.id,
                    tripName: trip.name,
                    tripPurpose: trip.purpose,
                    tripStartDate: trip.startDate,
                    tripEndDate: trip.endDate,
                    candidates: result.candidates,
                });
            }
        });

        return { destinationMap: destMap, pendingDestConflicts: pendingConflicts };
    }, [trips, tripRecords, destinationMappings]);

    // Detect new destination conflicts and prompt user
    useEffect(() => {
        if (pendingDestConflicts.length > 0) {
            setDestinationConflicts(pendingDestConflicts);
        } else {
            setDestinationConflicts([]);
        }
    }, [pendingDestConflicts]);

    const tripsToDisplay = trips; // Use original trips for rendering (destination overlay applied at display time)

    // Extract unique destinations from matched trips
    const uniqueDestinations = useMemo(() => {
        const dests = new Set<string>();
        destinationMap.forEach(m => { if (m.destination) dests.add(m.destination); });
        return [...dests].sort();
    }, [destinationMap]);

    // Initialize dest filters for new destinations (default: all visible)
    useEffect(() => {
        if (uniqueDestinations.length === 0) return;
        setDestFilters(prev => {
            const updated = { ...prev };
            let changed = false;
            uniqueDestinations.forEach(d => {
                if (!(d in updated)) {
                    updated[d] = true;
                    changed = true;
                }
            });
            return changed ? updated : prev;
        });
    }, [uniqueDestinations]);


    // Persist viewMode to localStorage
    useEffect(() => {
        localStorage.setItem('tripViewMode', viewMode);
    }, [viewMode]);

    const getStatus = (trip: BusinessTrip): 'active' | 'planned' | 'completed' => {
        const now = new Date();
        const start = new Date(trip.startDate);
        const end = new Date(trip.endDate);
        // Set end date to end of day
        end.setHours(23, 59, 59, 999);

        if (now > end) return 'completed';
        return 'active';
    };

    // Derived state for display
    const tripsWithStatus = tripsToDisplay.map(t => ({
        ...t,
        derivedStatus: getStatus(t)
    }));



    // Zoom (Day Width)
    const [dayWidth, setDayWidth] = useState<number>(savedPrefs?.dayWidth ?? 40);
    const MIN_DAY_WIDTH = 20;
    const MAX_DAY_WIDTH = 100;

    // Today Color Option
    type TodayColor = 'yellow' | 'green' | 'blue' | 'purple' | 'red';
    const [todayColor, setTodayColor] = useState<TodayColor>(savedPrefs?.todayColor ?? 'yellow');

    // Save Gantt preferences to localStorage whenever they change
    useEffect(() => {
        if (typeof window === 'undefined') return;
        const prefs = {
            dayWidth, ganttStartDate, ganttEndDate, categoryFilters,
            ganttGroupFilter, ganttPartFilter, ganttDeptFilter,
            activeTab, barOpacity, todayColor, destFilters
        };
        localStorage.setItem('ganttViewPrefs', JSON.stringify(prefs));
    }, [dayWidth, ganttStartDate, ganttEndDate, categoryFilters, ganttGroupFilter, ganttPartFilter, ganttDeptFilter, activeTab, barOpacity, todayColor, destFilters]);

    // UseRef for Gantt Container
    const containerRef = useRef<HTMLDivElement>(null);

    // Handle Shift+Wheel Zoom
    // Note: When Shift is held, browsers convert deltaY→deltaX for horizontal scrolling.
    // So we check deltaX when shiftKey is pressed.
    useEffect(() => {
        const el = containerRef.current;
        if (!el) return;

        const handleWheel = (e: WheelEvent) => {
            if (e.shiftKey) {
                e.preventDefault();
                e.stopPropagation();
                // Browser swaps deltaY↔deltaX when Shift is held, so use whichever is non-zero
                const delta = e.deltaX || e.deltaY;
                const zoomDelta = delta > 0 ? -5 : 5;
                setDayWidth(prev => Math.max(MIN_DAY_WIDTH, Math.min(MAX_DAY_WIDTH, prev + zoomDelta)));
            }
        };

        el.addEventListener('wheel', handleWheel, { passive: false });
        return () => el.removeEventListener('wheel', handleWheel);
    }, [viewMode]);

    const getTodayColorClass = (color: TodayColor, isHeader: boolean) => {
        // Opacity adjustment for header vs body
        const baseOpacity = isHeader ? '20' : '10'; // % opacity

        switch (color) {
            case 'yellow': return isHeader ? 'bg-yellow-100 dark:bg-yellow-900/30 font-bold' : 'bg-yellow-50/50 dark:bg-yellow-900/10';
            case 'green': return isHeader ? 'bg-green-100 dark:bg-green-900/30 font-bold' : 'bg-green-50/50 dark:bg-green-900/10';
            case 'blue': return isHeader ? 'bg-blue-100 dark:bg-blue-900/30 font-bold' : 'bg-blue-50/50 dark:bg-blue-900/10';
            case 'purple': return isHeader ? 'bg-purple-100 dark:bg-purple-900/30 font-bold' : 'bg-purple-50/50 dark:bg-purple-900/10';
            case 'red': return isHeader ? 'bg-red-100 dark:bg-red-900/30 font-bold' : 'bg-red-50/50 dark:bg-red-900/10';
            default: return '';
        }
    };

    // Helper for Gantt
    const getDatesInRange = (startStr: string, endStr: string) => {
        const start = new Date(startStr);
        const end = new Date(endStr);
        const dates: Date[] = [];
        let current = new Date(start);
        while (current <= end) {
            dates.push(new Date(current));
            current.setDate(current.getDate() + 1);
        }
        return dates;
    };

    const dates = getDatesInRange(ganttStartDate, ganttEndDate);

    // Sort members by Group → Part → Position → Name
    const sortedMembers = [...members].sort((a, b) => {
        // Group order
        const ga = GROUP_ORDER.indexOf(a.group);
        const gb = GROUP_ORDER.indexOf(b.group);
        const groupA = ga === -1 ? 999 : ga;
        const groupB = gb === -1 ? 999 : gb;
        if (groupA !== groupB) return groupA - groupB;

        // Part order (group-specific)
        const partList = PART_ORDER[a.group] || [];
        const pa = partList.indexOf(a.part);
        const pb = partList.indexOf(b.part);
        const partA = pa === -1 ? 999 : pa;
        const partB = pb === -1 ? 999 : pb;
        if (partA !== partB) return partA - partB;

        // Position rank
        const posA = POSITION_RANK[a.position] || 999;
        const posB = POSITION_RANK[b.position] || 999;
        if (posA !== posB) return posA - posB;

        // Name
        return a.name.localeCompare(b.name, 'ko');
    });

    // Active Member Filter Logic (Phase 6-I)
    // 1. Identify trips that overlap with current Gantt view range AND match category
    const visibleTripsInView = tripsToDisplay.filter(t => {
        // Category check
        if (!categoryFilters[t.category ?? 'trip']) return false;

        // Date overlap check
        const startA = new Date(t.startDate);
        const endA = new Date(t.endDate);
        const startB = new Date(ganttStartDate);
        const endB = new Date(ganttEndDate);

        return startA <= endB && endA >= startB;
    });

    // 2. Identify Members involved in these trips
    const activeMemberIds = new Set<string>();
    visibleTripsInView.forEach(t => {
        if (t.knoxId) {
            activeMemberIds.add(t.knoxId);
        } else {
            // Fallback for legacy data without knoxId
            const match = members.find(m => m.name === t.name);
            if (match) activeMemberIds.add(match.knoxId);
        }
    });

    // Filter trips by category (used for gantt member filtering and trip grouping)
    const categoryFilteredTrips = tripsToDisplay.filter(t => {
        // Category filter
        if (!categoryFilters[t.category ?? 'trip']) return false;

        // Destination filter (only for trip category)
        if (t.category === 'trip' || !t.category) {
            const destMatch = destinationMap.get(t.id);
            if (destMatch?.destination) {
                // Has destination → check if that destination is filtered in
                if (destFilters[destMatch.destination] === false) return false;
            }
            // No destination match → always show (not filterable)
        }

        return true;
    });

    // Build set of members who have ANY trip data (category-filtered, but not date-restricted)
    const membersWithTrips = new Set<string>();
    categoryFilteredTrips.forEach(t => {
        if (t.knoxId) {
            membersWithTrips.add(t.knoxId);
        } else {
            const match = members.find(m => m.name === t.name);
            if (match) membersWithTrips.add(match.knoxId);
        }
    });

    // Filter members by group/part/dept AND only show members with trip data
    const ganttMembers = sortedMembers.filter(m => {
        if (ganttDeptFilter !== 'all' && m.department !== ganttDeptFilter) return false;
        if (ganttGroupFilter !== 'all' && m.group !== ganttGroupFilter) return false;
        if (ganttPartFilter !== 'all' && m.part !== ganttPartFilter) return false;

        // Only show members who have trip data
        if (!membersWithTrips.has(m.knoxId)) return false;

        return true;
    });

    // Available departments
    const uniqueDepartments = [...new Set(members.map(m => m.department).filter(Boolean))].sort();

    // Available parts for selected group
    const availableParts = ganttGroupFilter === 'all'
        ? [...new Set(members.map(m => m.part).filter(Boolean))].sort()
        : PART_ORDER[ganttGroupFilter] || [...new Set(members.filter(m => m.group === ganttGroupFilter).map(m => m.part).filter(Boolean))].sort();

    // Group trips by member for Gantt
    const tripsByMember = new Map<string, BusinessTrip[]>();
    ganttMembers.forEach(m => tripsByMember.set(m.knoxId, []));

    // Add trips
    const unmatchedTrips: BusinessTrip[] = [];
    const hasActiveFilter = ganttDeptFilter !== 'all' || ganttGroupFilter !== 'all' || ganttPartFilter !== 'all';
    categoryFilteredTrips.forEach(t => {
        if (t.knoxId) {
            const memberTrips = tripsByMember.get(t.knoxId);
            if (memberTrips) {
                memberTrips.push(t);
            } else {
                // Member exists but filtered out by dept/group/part? → skip silently
                const memberExists = members.some(m => m.knoxId === t.knoxId);
                if (!memberExists && !hasActiveFilter) {
                    unmatchedTrips.push(t);
                }
            }
        } else {
            // Try to match by name if knoxId missing (legacy or import issue)
            const match = members.find(m => m.name === t.name);
            if (match) {
                const memberTrips = tripsByMember.get(match.knoxId);
                if (memberTrips) {
                    memberTrips.push(t);
                }
                // If member is filtered out, skip silently
            } else {
                // Truly unmatched — only show when no filters active
                if (!hasActiveFilter) {
                    unmatchedTrips.push(t);
                }
            }
        }
    });

    // Ctrl+Shift+V: Clipboard auto-import
    const handleClipboardImport = useCallback(async () => {
        try {
            const text = await navigator.clipboard.readText();
            if (!text.trim()) {
                setImportToast('❌ 클립보드가 비어있습니다.');
                setTimeout(() => setImportToast(null), 3000);
                return;
            }

            // 1. Try parsing as Trip Record (Excel / Manual DB)
            const recordResult = parseTripRecordText(text);

            // Determine if it looks like Manual DB data (has > 0 records and no critical errors)
            // Or if the user is explicitly in Manual Tab?
            // Let's assume if parse succeeds with decent results, it's Manual DB.
            // Actually, parseTripText (Attendance) is more specific (requires date range pattern).
            // parseTripRecordText is more generic (tab separated).
            // So try Attendance first?

            // Re-ordering: Try Attendance first (stricter), then Manual DB (looser).
            // BUT, the user might want to force one or the other.
            // Current logic tries Record first. Let's stick to it but refine "is it valid?".

            // If we have records and it looks like a valid import
            if (recordResult.records.length > 0 && recordResult.maxColumns >= 2) {
                // ** REPLACE ALL LOGIC **
                // 1. Clear existing records
                const allCurrent = getTripRecords();
                allCurrent.forEach(r => deleteTripRecord(r.id));

                // 2. Add new records
                let addedCount = 0;
                recordResult.records.forEach(r => {
                    addTripRecord(r);
                    addedCount++;
                });

                // 3. Save Column Count & Headers for Dynamic Display
                if (typeof window !== 'undefined') {
                    localStorage.setItem('tripRecordColumns', recordResult.maxColumns.toString());
                    if (recordResult.headers) {
                        localStorage.setItem('tripRecordHeaders', JSON.stringify(recordResult.headers));
                    } else {
                        localStorage.removeItem('tripRecordHeaders');
                    }
                }

                setManualDataVersion(v => v + 1);
                setActiveTab('manual');
                setImportToast(`✅ 총 ${addedCount}건의 출장현황 기록이 교체되었습니다.\n(헤더 매핑: ${recordResult.headers ? '성공' : '없음'})`);
                setTimeout(() => setImportToast(null), 3000);
                return;
            }

            // 2. Try parsing as Attendance (Knox / HR)
            const existingMembers = getTeamMembers();
            const { trips: parsedTrips, unknownNames } = parseTripText(text, existingMembers);

            if (parsedTrips.length === 0) {
                setImportToast('❌ 출장 정보를 파싱할 수 없습니다.');
                setTimeout(() => setImportToast(null), 3000);
                return;
            }

            // ** REPLACE ALL LOGIC FOR ATTENDANCE **
            // 1. Clear existing trips
            // We can't just delete ALL trips if we want to keep Manual Linked ones...
            // But the user said "Ctrl+Shift+V ... 기존 Data는 모두 삭제하고 새로운 값으로 모두 대체".
            // Checks: "Attendance" vs "Manual".
            // If I am pasting Attendance, I replace Attendance. 
            // Manual records are separate DB.
            // So: saveBusinessTrips(parsedTrips) directly.

            saveBusinessTrips(parsedTrips);
            setTrips(parsedTrips);

            // Update members if needed (usually treated as separate master, but here we just read)
            // We don't overwrite members here.

            setActiveTab('attendance');

            let msg = `✅ 총 ${parsedTrips.length}건의 출장 정보로 교체되었습니다.`;
            if (unknownNames.length > 0) {
                msg += `\n⚠️ 매칭되지 않은 이름: ${unknownNames.length}명 (${unknownNames.slice(0, 3).join(', ')}...)`;
            }
            setImportToast(msg);
            setTimeout(() => setImportToast(null), 5000);
            onDataChange?.();
        } catch (err) {
            console.error('클립보드 읽기 실패:', err);
            setImportToast('❌ 클립보드를 읽을 수 없습니다. 브라우저 권한을 확인해주세요.');
            setTimeout(() => setImportToast(null), 3000);
        }
    }, [onDataChange]);

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'V') {
                e.preventDefault();
                handleClipboardImport();
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [handleClipboardImport]);

    const handleExportToday = () => {
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const activeTrips = tripsToDisplay.filter(t => {
            const start = new Date(t.startDate);
            const end = new Date(t.endDate);
            return today >= start && today <= end;
        });

        if (activeTrips.length === 0) {
            setImportToast('❌ 오늘 출장자가 없습니다.');
            setTimeout(() => setImportToast(null), 3000);
            return;
        }

        // Format: Name  Group  Part  Location  Start  End  Purpose
        const header = '이름\t그룹\t파트\t출장지\t출발일\t복귀일\t목적';
        const rows = activeTrips.map(t => {
            // Find member info
            const member = members.find(m => m.knoxId === t.knoxId) || { group: '', part: '' };
            return `${t.name}\t${member.group}\t${member.part}\t${t.location}\t${t.startDate}\t${t.endDate}\t${t.purpose}`;
        });

        const text = [header, ...rows].join('\n');
        navigator.clipboard.writeText(text);
        setImportToast(`✅ 오늘 출장자 ${activeTrips.length}명 복사 완료`);
        setTimeout(() => setImportToast(null), 3000);
    };

    // Filter and search
    const filteredTrips = tripsWithStatus.filter(t => {
        const q = searchQuery.toLowerCase();
        const matchesSearch = !q ||
            t.name.toLowerCase().includes(q) ||
            t.location.toLowerCase().includes(q) ||
            t.purpose.toLowerCase().includes(q);

        const matchesStatus = filterStatus === 'all' || t.derivedStatus === filterStatus;

        return matchesSearch && matchesStatus;
    });

    // Sort
    const sortedTrips = [...filteredTrips].sort((a, b) => {
        let aVal: string | number = (a as any)[sortField] ?? '';
        let bVal: string | number = (b as any)[sortField] ?? '';

        if (typeof aVal === 'string') aVal = aVal.toLowerCase();
        if (typeof bVal === 'string') bVal = bVal.toLowerCase();

        if (aVal < bVal) return sortOrder === 'asc' ? -1 : 1;
        if (aVal > bVal) return sortOrder === 'asc' ? 1 : -1;
        return 0;
    });

    const handleSort = (field: SortField) => {
        if (sortField === field) {
            setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc');
        } else {
            setSortField(field);
            setSortOrder('asc'); // Default asc for text, might want desc for date? 
            // Actually usually date desc (latest first) is better, but let's stick to simple toggle
        }
    };

    const handleDeleteTrip = (e: React.MouseEvent, id: string) => {
        e.stopPropagation();
        if (window.confirm('이 출장 기록을 삭제하시겠습니까?')) {
            deleteBusinessTrip(id);
            setTrips(getBusinessTrips());
            onDataChange?.();
        }
    };

    const getStatusBadge = (status: string) => {
        switch (status) {
            case 'active': return 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300';
            case 'planned': return 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300';
            case 'completed': return 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400';
            default: return '';
        }
    };

    const getStatusLabel = (status: string) => {
        switch (status) {
            case 'active': return '출장중';
            case 'planned': return '예정';
            case 'completed': return '종료';
            default: return status;
        }
    };

    return (
        <div className="absolute inset-0 flex flex-col min-h-0 bg-white dark:bg-gray-900">
            {/* Header */}
            <div className="flex-shrink-0 border-b border-gray-200 dark:border-gray-700 p-4">
                <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                        <Plane className="w-5 h-5 text-blue-500" />
                        <h2 className="text-lg font-bold text-gray-800 dark:text-gray-200">출장 현황</h2>
                        <div className="flex bg-gray-100 dark:bg-gray-800 rounded-lg p-0.5 ml-2">
                            <button
                                onClick={() => setActiveTab('attendance')}
                                className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors ${activeTab === 'attendance'
                                    ? 'bg-white dark:bg-gray-700 shadow text-blue-600 dark:text-blue-300'
                                    : 'text-gray-500 dark:text-gray-400 hover:text-gray-700'}`}
                            >
                                근태 기반
                            </button>
                            <button
                                onClick={() => setActiveTab('manual')}
                                className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors ${activeTab === 'manual'
                                    ? 'bg-white dark:bg-gray-700 shadow text-purple-600 dark:text-purple-300'
                                    : 'text-gray-500 dark:text-gray-400 hover:text-gray-700'}`}
                            >
                                출장 현황 DB
                            </button>
                        </div>
                        {conflicts.length > 0 && activeTab === 'attendance' && (
                            <button
                                onClick={() => setShowResolver(true)}
                                className="ml-4 flex items-center gap-1.5 px-3 py-1 bg-orange-100 dark:bg-orange-900/40 text-orange-700 dark:text-orange-300 rounded-md text-xs font-bold animate-pulse hover:bg-orange-200 dark:hover:bg-orange-900/60"
                            >
                                <AlertTriangle className="w-3.5 h-3.5" />
                                확인 필요 ({conflicts.length})
                            </button>
                        )}
                    </div>

                    <div className="flex items-center gap-2">
                        {activeTab === 'attendance' && (
                            <div className="flex bg-gray-100 dark:bg-gray-800 rounded-lg p-0.5">
                                <button
                                    onClick={() => setViewMode('list')}
                                    className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${viewMode === 'list'
                                        ? 'bg-white dark:bg-gray-700 shadow text-gray-800 dark:text-gray-200'
                                        : 'text-gray-500 dark:text-gray-400 hover:text-gray-700'}`}
                                >
                                    목록
                                </button>
                                <button
                                    onClick={() => setViewMode('gantt')}
                                    className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${viewMode === 'gantt'
                                        ? 'bg-white dark:bg-gray-700 shadow text-gray-800 dark:text-gray-200'
                                        : 'text-gray-500 dark:text-gray-400 hover:text-gray-700'}`}
                                >
                                    간트 차트
                                </button>
                            </div>
                        )}
                        <div className="flex items-center gap-1.5 text-xs text-gray-400 ml-2">
                            <ClipboardPaste className="w-3.5 h-3.5" />
                            <span>Ctrl+Shift+V: 가져오기</span>
                        </div>
                        <button
                            onClick={handleExportToday}
                            className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-blue-600 dark:text-gray-400 dark:hover:text-blue-400 ml-4 px-2 py-1 hover:bg-gray-100 dark:hover:bg-gray-800 rounded transition-colors"
                            title="오늘 출장자 명단 복사 (Excel 붙여넣기용)"
                        >
                            <ClipboardCopy className="w-3.5 h-3.5" />
                            <span>오늘명단복사</span>
                        </button>
                    </div>
                </div>
            </div>

            {activeTab === 'attendance' ? (
                <div className="flex-1 flex flex-col overflow-hidden relative min-h-0">
                    {/* Attendance View Controls */}
                    <div className="flex items-center gap-2 flex-shrink-0 px-4 pb-2">
                        {viewMode === 'list' ? (
                            <>
                                <div className="relative flex-1">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                                    <input
                                        type="text"
                                        placeholder="이름, 장소, 목적 검색..."
                                        value={searchQuery}
                                        onChange={e => setSearchQuery(e.target.value)}
                                        className="w-full pl-9 pr-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-800 dark:border-gray-600 dark:text-gray-200"
                                    />
                                </div>
                                <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
                                    className="text-xs border border-gray-300 rounded-lg px-2 py-2 dark:bg-gray-800 dark:border-gray-600 dark:text-gray-200">
                                    <option value="all">전체 상태</option>
                                    <option value="active">출장중</option>
                                    <option value="planned">예정</option>
                                    <option value="completed">종료</option>
                                </select>
                            </>
                        ) : (
                            <>
                                <div className="flex items-center gap-2 w-full">
                                    <div className="flex items-center gap-1 text-sm bg-gray-50 dark:bg-gray-800 px-2 py-1 rounded border border-gray-200 dark:border-gray-700">
                                        <Calendar className="w-3.5 h-3.5 text-gray-500" />
                                        <input
                                            type="date"
                                            value={ganttStartDate}
                                            onChange={(e) => setGanttStartDate(e.target.value)}
                                            className="bg-transparent border-none text-gray-700 dark:text-gray-300 text-xs focus:ring-0 p-0"
                                        />
                                        <span className="text-gray-400">~</span>
                                        <input
                                            type="date"
                                            value={ganttEndDate}
                                            onChange={(e) => setGanttEndDate(e.target.value)}
                                            className="bg-transparent border-none text-gray-700 dark:text-gray-300 text-xs focus:ring-0 p-0"
                                        />
                                    </div>

                                    {/* Dept/Group/Part Filters */}
                                    <select
                                        value={ganttDeptFilter}
                                        onChange={(e) => setGanttDeptFilter(e.target.value)}
                                        className="text-xs border border-gray-300 rounded px-2 py-1 bg-white dark:bg-gray-800 dark:border-gray-600 dark:text-gray-200"
                                    >
                                        <option value="all">소속 전체</option>
                                        {uniqueDepartments.map(d => <option key={d} value={d}>{d}</option>)}
                                    </select>
                                    <select
                                        value={ganttGroupFilter}
                                        onChange={(e) => { setGanttGroupFilter(e.target.value); setGanttPartFilter('all'); }}
                                        className="text-xs border border-gray-300 rounded px-2 py-1 bg-white dark:bg-gray-800 dark:border-gray-600 dark:text-gray-200"
                                    >
                                        <option value="all">그룹 전체</option>
                                        {GROUP_ORDER.map(g => <option key={g} value={g}>{g}</option>)}
                                    </select>
                                    <select
                                        value={ganttPartFilter}
                                        onChange={(e) => setGanttPartFilter(e.target.value)}
                                        className="text-xs border border-gray-300 rounded px-2 py-1 bg-white dark:bg-gray-800 dark:border-gray-600 dark:text-gray-200"
                                    >
                                        <option value="all">파트 전체</option>
                                        {availableParts.map(p => <option key={p} value={p}>{p}</option>)}
                                    </select>

                                    {/* Category Toggle Buttons */}
                                    <div className="flex items-center gap-1">
                                        {(['trip', 'vacation', 'education', 'others'] as TripCategory[]).map(cat => (
                                            <button
                                                key={cat}
                                                onClick={() => setCategoryFilters(f => ({ ...f, [cat]: !f[cat] }))}
                                                className={`px-2.5 py-1 text-xs rounded-full font-medium transition-all flex items-center gap-1.5 ${categoryFilters[cat]
                                                    ? 'text-white shadow-sm'
                                                    : 'bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 hover:bg-gray-200'
                                                    }`}
                                                style={categoryFilters[cat] ? { backgroundColor: categoryColors[cat].bg } : {}}
                                            >
                                                <span className={`w-1.5 h-1.5 rounded-full bg-white`}></span>
                                                {categoryColors[cat].label}
                                            </button>
                                        ))}
                                    </div>

                                    {/* Destination Filter Chips (shown when 출장 filter is on and destinations exist) */}
                                    {categoryFilters.trip && uniqueDestinations.length > 0 && (
                                        <div className="flex items-center gap-1 flex-wrap">
                                            <span className="text-[10px] text-gray-400 mr-0.5">출장지:</span>
                                            {uniqueDestinations.map(dest => (
                                                <button
                                                    key={dest}
                                                    onClick={() => setDestFilters(f => ({ ...f, [dest]: !f[dest] }))}
                                                    className={`px-2 py-0.5 text-[10px] rounded-full font-medium transition-all flex items-center gap-1 ${destFilters[dest] !== false
                                                        ? 'text-white shadow-sm'
                                                        : 'bg-gray-100 dark:bg-gray-700 text-gray-400 dark:text-gray-500 hover:bg-gray-200'
                                                        }`}
                                                    style={destFilters[dest] !== false ? { backgroundColor: getDestinationColor(dest) } : {}}
                                                >
                                                    <span className="w-1.5 h-1.5 rounded-full bg-white/80"></span>
                                                    {dest}
                                                </button>
                                            ))}
                                        </div>
                                    )}

                                    <div className="flex items-center gap-1.5 text-xs text-gray-400 ml-auto">
                                        <div className="flex items-center gap-0.5">
                                            <span className="text-gray-400 mr-1">줌:</span>
                                            <button
                                                onClick={() => setDayWidth(prev => Math.max(MIN_DAY_WIDTH, prev - 5))}
                                                className="w-6 h-6 flex items-center justify-center rounded hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-500 dark:text-gray-400 font-bold text-sm transition-colors"
                                                title="축소"
                                            >−</button>
                                            <span className="text-[10px] text-gray-400 w-8 text-center">{dayWidth}px</span>
                                            <button
                                                onClick={() => setDayWidth(prev => Math.min(MAX_DAY_WIDTH, prev + 5))}
                                                className="w-6 h-6 flex items-center justify-center rounded hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-500 dark:text-gray-400 font-bold text-sm transition-colors"
                                                title="확대"
                                            >+</button>
                                        </div>
                                        {destinationConflicts.length > 0 && (
                                            <button
                                                onClick={() => setShowDestinationPicker(true)}
                                                className="px-2 py-1 text-xs bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400 rounded-md hover:bg-orange-200 dark:hover:bg-orange-900/50 transition-colors flex items-center gap-1"
                                                title="동명이인 출장지 매칭 필요"
                                            >
                                                <AlertTriangle className="w-3 h-3" />
                                                동명이인 {destinationConflicts.length}건
                                            </button>
                                        )}
                                        <button
                                            onClick={() => setShowSettings(s => !s)}
                                            className={`p-1 rounded transition-colors ${showSettings ? 'text-blue-500 bg-blue-50 dark:bg-blue-900/30' : 'text-gray-400 hover:text-gray-600'}`}
                                            title="설정"
                                        >
                                            <Settings className="w-3.5 h-3.5" />
                                        </button>
                                    </div>
                                </div>

                                {/* Settings Panel (collapsible) */}
                                {showSettings && (
                                    <div className="px-4 py-2 bg-gray-50/80 dark:bg-gray-800/80 border-t border-gray-200 dark:border-gray-700 flex items-center gap-4 text-xs">
                                        <div className="flex items-center gap-2">
                                            <span className="text-gray-500 dark:text-gray-400 font-medium">밝기</span>
                                            <input
                                                type="range"
                                                min="0.3"
                                                max="1"
                                                step="0.05"
                                                value={barOpacity}
                                                onChange={(e) => setBarOpacity(parseFloat(e.target.value))}
                                                className="w-20 h-1 accent-blue-500"
                                            />
                                            <span className="text-gray-400 w-8">{Math.round(barOpacity * 100)}%</span>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <span className="text-gray-500 dark:text-gray-400 font-medium">오늘 색상</span>
                                            <select
                                                value={todayColor}
                                                onChange={(e) => setTodayColor(e.target.value as TodayColor)}
                                                className="text-xs border border-gray-300 rounded px-1.5 py-0.5 bg-white dark:bg-gray-800 dark:border-gray-600 dark:text-gray-200"
                                            >
                                                <option value="yellow">노란색</option>
                                                <option value="green">초록색</option>
                                                <option value="blue">파란색</option>
                                                <option value="purple">보라색</option>
                                                <option value="red">빨간색</option>
                                            </select>
                                        </div>
                                        <div className="flex items-center gap-2 border-l border-gray-200 pl-4 ml-2">
                                            <span className="text-gray-500 dark:text-gray-400 font-medium">색상 설정</span>
                                            {(['trip', 'vacation', 'education', 'others'] as TripCategory[]).map(cat => (
                                                <div key={cat} className="flex items-center gap-1" title={categoryColors[cat].label}>
                                                    <input
                                                        type="color"
                                                        value={categoryColors[cat].bg}
                                                        onChange={(e) => handleColorChange(cat, e.target.value)}
                                                        className="w-5 h-5 rounded cursor-pointer border-none p-0"
                                                    />
                                                </div>
                                            ))}
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <span className="text-gray-500 dark:text-gray-400 font-medium">범례</span>
                                            {Object.entries(categoryColors).map(([key, val]) => (
                                                <span key={key} className="inline-flex items-center gap-0.5">
                                                    <span className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: val.bg }}></span>
                                                    <span className="text-gray-600 dark:text-gray-300">{val.label}</span>
                                                </span>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </>
                        )}
                    </div>

                    {/* Import Toast */}
                    {importToast && (
                        <div className="flex-shrink-0 px-4 py-2 bg-blue-50 dark:bg-blue-900/20 border-b border-blue-200 dark:border-blue-800">
                            <p className="text-sm text-blue-700 dark:text-blue-300 whitespace-pre-line">{importToast}</p>
                        </div>
                    )}

                    {/* Content */}
                    <div className={`flex-1 relative min-h-0 ${viewMode === 'list' ? 'overflow-auto' : 'overflow-hidden'}`}>
                        {viewMode === 'list' ? (
                            <table className="w-full text-sm">
                                {/* ... Existing Table Header & Body ... */}
                                <thead className="sticky top-0 bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 z-10">
                                    <tr>
                                        <th className="px-4 py-2 text-left text-xs font-semibold text-gray-600 dark:text-gray-400 w-12">#</th>
                                        <th className="px-4 py-2 text-left text-xs font-semibold text-gray-600 dark:text-gray-400 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700" onClick={() => handleSort('name')}>
                                            <div className="flex items-center gap-1">이름 {sortField === 'name' && <ArrowUpDown className="w-3 h-3" />}</div>
                                        </th>
                                        <th className="px-4 py-2 text-left text-xs font-semibold text-gray-600 dark:text-gray-400">기간</th>
                                        <th className="px-4 py-2 text-left text-xs font-semibold text-gray-600 dark:text-gray-400 text-center">일수</th>
                                        <th className="px-4 py-2 text-left text-xs font-semibold text-gray-600 dark:text-gray-400 cursor-pointer" onClick={() => handleSort('location')}>
                                            <div className="flex items-center gap-1">장소 {sortField === 'location' && <ArrowUpDown className="w-3 h-3" />}</div>
                                        </th>
                                        <th className="px-4 py-2 text-left text-xs font-semibold text-gray-600 dark:text-gray-400 cursor-pointer" onClick={() => handleSort('purpose')}>
                                            <div className="flex items-center gap-1">목적 {sortField === 'purpose' && <ArrowUpDown className="w-3 h-3" />}</div>
                                        </th>
                                        <th className="px-4 py-2 text-left text-xs font-semibold text-gray-600 dark:text-gray-400 text-center">상태</th>
                                        <th className="px-4 py-2 w-10"></th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {sortedTrips.map((trip, idx) => {
                                        const start = new Date(trip.startDate);
                                        const end = new Date(trip.endDate);
                                        const duration = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;

                                        return (
                                            <tr key={trip.id} className="border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
                                                <td className="px-4 py-3 text-xs text-gray-400">{idx + 1}</td>
                                                <td className="px-4 py-3 font-medium text-gray-800 dark:text-gray-200">
                                                    <div className="flex items-center gap-1">
                                                        {trip.name}
                                                        {!trip.knoxId && (
                                                            <span title="팀원 정보와 매칭되지 않음">
                                                                <AlertCircle className="w-3 h-3 text-orange-400" />
                                                            </span>
                                                        )}
                                                    </div>
                                                </td>
                                                <td className="px-4 py-3 text-gray-600 dark:text-gray-400 font-mono text-xs">
                                                    {trip.startDate} ~ {trip.endDate}
                                                </td>
                                                <td className="px-4 py-3 text-gray-600 dark:text-gray-400 text-center">
                                                    {duration}일
                                                </td>
                                                <td className="px-4 py-3 text-gray-600 dark:text-gray-400">{trip.location}</td>
                                                <td className="px-4 py-3 text-gray-600 dark:text-gray-400">{trip.purpose}</td>
                                                <td className="px-4 py-3 text-center">
                                                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${getStatusBadge(trip.derivedStatus)}`}>
                                                        {getStatusLabel(trip.derivedStatus)}
                                                    </span>
                                                </td>
                                                <td className="px-4 py-3">
                                                    <button
                                                        onClick={e => handleDeleteTrip(e, trip.id)}
                                                        className="p-1 text-gray-400 hover:text-red-500 transition-all"
                                                    >
                                                        <Trash2 className="w-3.5 h-3.5" />
                                                    </button>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        ) : (
                            // Gantt View — Single scroll container with sticky header
                            <div
                                ref={containerRef}
                                className="relative w-full h-full overflow-auto bg-white dark:bg-gray-900"

                            >
                                <div className="min-w-full w-fit">
                                    {/* Timeline Header — Sticky Top */}
                                    <div className="sticky top-0 z-30 flex border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
                                        {/* Header Name Column: Dept | Group | Part | Name */}
                                        <div className="sticky left-0 w-[280px] flex-shrink-0 bg-gray-50 dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 z-40 flex text-[10px] items-center text-center font-semibold text-gray-500 dark:text-gray-400">
                                            <div className="w-[60px] border-r border-gray-200 dark:border-gray-700 py-2">소속</div>
                                            <div className="w-[50px] border-r border-gray-200 dark:border-gray-700 py-2">그룹</div>
                                            <div className="w-[80px] border-r border-gray-200 dark:border-gray-700 py-2">파트</div>
                                            <div className="flex-1 py-2">이름</div>
                                        </div>
                                        {/* Header Date Cells */}
                                        {dates.map(date => {
                                            const day = date.getDay();
                                            const isWeekend = day === 0 || day === 6;
                                            const isToday = date.toDateString() === new Date().toDateString();
                                            return (
                                                <div
                                                    key={date.toISOString()}
                                                    className={`flex-shrink-0 border-r border-gray-100 dark:border-gray-700 text-center text-xs py-1 ${isWeekend ? 'bg-gray-100 dark:bg-gray-700/30' : ''} ${isToday ? getTodayColorClass(todayColor, true) : ''}`}
                                                    style={{ width: dayWidth }}
                                                >
                                                    <div className={`text-[10px] ${day === 0 ? 'text-red-500' : day === 6 ? 'text-blue-500' : 'text-gray-500 dark:text-gray-400'}`}>
                                                        {['일', '월', '화', '수', '목', '금', '토'][day]}
                                                    </div>
                                                    <div className={`text-gray-700 dark:text-gray-300 ${isToday ? 'font-bold' : 'font-medium'}`}>
                                                        {date.getDate()}
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>

                                    {/* Member Rows */}
                                    {ganttMembers.map((member) => {
                                        const memberTrips = tripsByMember.get(member.knoxId) || [];
                                        return (
                                            <div key={member.knoxId} className="flex border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800/50">
                                                {/* Static Name Column: Dept | Group | Part | Name */}
                                                <div className="sticky left-0 w-[280px] flex-shrink-0 bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-700 z-20 flex text-[10px] items-center text-center">
                                                    <div className="w-[60px] flex-shrink-0 border-r border-gray-100 dark:border-gray-800 py-1.5 truncate text-gray-500 overflow-hidden px-1" title={member.department}>{member.department}</div>
                                                    <div className="w-[50px] flex-shrink-0 border-r border-gray-100 dark:border-gray-800 py-1.5 truncate text-gray-500 overflow-hidden px-1" title={member.group}>{member.group}</div>
                                                    <div className="w-[80px] flex-shrink-0 border-r border-gray-100 dark:border-gray-800 py-1.5 truncate text-gray-500 overflow-hidden px-1" title={member.part}>{member.part}</div>
                                                    <div className="flex-1 py-1.5 font-bold text-gray-800 dark:text-gray-200 truncate px-2 text-left">
                                                        {member.name}
                                                    </div>
                                                </div>

                                                <div className="relative h-8 overflow-hidden" style={{ width: dates.length * dayWidth }}>
                                                    {/* Grid lines */}
                                                    <div className="absolute inset-0 flex pointer-events-none">
                                                        {dates.map((date, i) => {
                                                            const day = date.getDay();
                                                            const isWeekend = day === 0 || day === 6;
                                                            const isToday = date.toDateString() === new Date().toDateString();
                                                            return (
                                                                <div
                                                                    key={i}
                                                                    className={`flex-shrink-0 h-full border-r border-gray-100 dark:border-gray-800/50 ${isWeekend ? 'bg-gray-50/50 dark:bg-gray-800/20' : ''} ${isToday ? getTodayColorClass(todayColor, false) : ''}`}
                                                                    style={{ width: dayWidth }}
                                                                />
                                                            );
                                                        })}
                                                    </div>

                                                    {/* Trips */}
                                                    {memberTrips.map(trip => {
                                                        const start = new Date(trip.startDate);
                                                        const end = new Date(trip.endDate);
                                                        const viewStart = new Date(ganttStartDate);

                                                        const diffDays = Math.round((start.getTime() - viewStart.getTime()) / (1000 * 60 * 60 * 24));
                                                        const durationDays = Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;

                                                        if (diffDays + durationDays < 0) return null;

                                                        const rawLeft = diffDays * dayWidth;
                                                        const clampedLeft = Math.max(0, rawLeft);
                                                        const clampOffset = clampedLeft - rawLeft; // how much was clipped
                                                        const rawWidth = durationDays * dayWidth;
                                                        const adjustedWidth = Math.max(dayWidth, rawWidth - clampOffset);

                                                        // Color: destination-specific for trips, category for others
                                                        const destMatch = destinationMap.get(trip.id);
                                                        const barColor = (trip.category === 'trip' || !trip.category) && destMatch?.destination
                                                            ? getDestinationColor(destMatch.destination)
                                                            : (categoryColors[trip.category ?? 'trip']?.bg || '#cbd5e1');

                                                        return (
                                                            <div
                                                                key={trip.id}
                                                                className={`absolute top-1 h-6 rounded shadow-sm border border-white/20 px-1.5 flex items-center text-[10px] text-white overflow-hidden whitespace-nowrap z-0`}
                                                                style={{
                                                                    left: clampedLeft + 1,
                                                                    width: adjustedWidth - 2,
                                                                    opacity: barOpacity,
                                                                    backgroundColor: barColor
                                                                }}
                                                                title={`${buildDisplayLabel(trip.purpose, destinationMap.get(trip.id) || null, trip.startDate, trip.endDate)} (${trip.startDate}~${trip.endDate})`}
                                                                onClick={() => {
                                                                    const destMatch = destinationMap.get(trip.id);
                                                                    const label = buildDisplayLabel(trip.purpose, destMatch || null, trip.startDate, trip.endDate);
                                                                    alert(`${trip.name}\n${label}\n${trip.startDate} ~ ${trip.endDate}\n${destMatch?.destination || trip.location}`);
                                                                }}
                                                            >
                                                                {buildDisplayLabel(trip.purpose, destinationMap.get(trip.id) || null, trip.startDate, trip.endDate)}
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            </div>
                                        );
                                    })}

                                    {/* Unmatched Rows */}
                                    {unmatchedTrips.length > 0 && (
                                        <div className="bg-orange-50/30 dark:bg-orange-900/10 mt-2 border-t border-orange-200 dark:border-orange-800">
                                            <div className="px-3 py-1 text-xs font-semibold text-orange-600 dark:text-orange-400">
                                                ⚠️ 미확인 ({unmatchedTrips.length})
                                            </div>
                                            {unmatchedTrips.map(trip => (
                                                <div key={trip.id} className="flex border-b border-gray-100 dark:border-gray-800 hover:bg-orange-50 dark:hover:bg-orange-900/20">
                                                    <div className="sticky left-0 w-32 flex-shrink-0 bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-700 px-3 py-1.5 text-xs font-medium z-10 flex items-center justify-between">
                                                        <div className="text-orange-600 dark:text-orange-400 font-semibold">{trip.name}</div>
                                                        <div className="text-gray-400 truncate ml-1 text-[10px]">미매칭</div>
                                                    </div>
                                                    <div className="relative h-8" style={{ width: dates.length * dayWidth }}>
                                                        {/* Grid lines */}
                                                        <div className="absolute inset-0 flex pointer-events-none">
                                                            {dates.map((date, i) => {
                                                                const day = date.getDay();
                                                                const isWeekend = day === 0 || day === 6;
                                                                return <div key={i} className={`flex-shrink-0 h-full border-r border-gray-100 dark:border-gray-800/50 ${isWeekend ? 'bg-gray-50/50 dark:bg-gray-800/20' : ''}`} style={{ width: dayWidth }} />;
                                                            })}
                                                        </div>

                                                        <div className="absolute top-1 h-6 rounded shadow-sm border border-white/20 px-1.5 flex items-center text-[10px] text-white overflow-hidden whitespace-nowrap z-0"
                                                            style={{
                                                                left: (Math.round((new Date(trip.startDate).getTime() - new Date(ganttStartDate).getTime()) / (1000 * 60 * 60 * 24)) * dayWidth) + 1,
                                                                width: (Math.round((new Date(trip.endDate).getTime() - new Date(trip.startDate).getTime()) / (1000 * 60 * 60 * 24)) + 1) * dayWidth - 2,
                                                                backgroundColor: (() => {
                                                                    const dm = destinationMap.get(trip.id);
                                                                    return (trip.category === 'trip' || !trip.category) && dm?.destination
                                                                        ? getDestinationColor(dm.destination)
                                                                        : (categoryColors[trip.category ?? 'trip']?.bg || '#cbd5e1');
                                                                })()
                                                            }}
                                                            title={`${buildDisplayLabel(trip.purpose, destinationMap.get(trip.id) || null, trip.startDate, trip.endDate)} (${trip.startDate}~${trip.endDate})`}
                                                        >
                                                            {buildDisplayLabel(trip.purpose, destinationMap.get(trip.id) || null, trip.startDate, trip.endDate)}
                                                        </div>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>
                </div>) : (
                <div className="flex-1 overflow-auto relative min-h-0">
                    <TripRecordBoard lastUpdate={manualDataVersion} />
                </div>
            )}
            <TripNameResolverDialog
                isOpen={showResolver}
                onClose={() => setShowResolver(false)}
                conflicts={conflicts}
                onResolve={() => setManualDataVersion(v => v + 1)}
            />
            <TripDestinationPickerDialog
                isOpen={showDestinationPicker}
                onClose={() => setShowDestinationPicker(false)}
                conflicts={destinationConflicts}
                onResolve={() => {
                    setDestinationMappings(getDestinationMappings());
                    setShowDestinationPicker(false);
                }}
            />
        </div >
    );
}
