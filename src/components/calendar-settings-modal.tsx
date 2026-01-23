"use client";

import React from 'react';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { X, RotateCcw } from 'lucide-react';

export interface CalendarSettings {
    itemHeightPercent: number;
    itemSpacing: number; // 1, 2, 3, 4
    fontSize: number;    // 11, 12, 13
    bgLightness: number; // 0 (Black) ~ 100 (White). Default ~95 (Gray-100)
    showBorder: boolean;
    borderDarkness: number; // 0 (Light) ~ 100 (Dark). Default ~45
    completedMode: 'dimmed' | 'strikethrough' | 'hidden';
    todayBgColor: 'blue' | 'yellow' | 'orange' | 'green' | 'none';
    todayBorderColor: 'default' | 'light' | 'medium' | 'dark';
}

export const DEFAULT_SETTINGS: CalendarSettings = {
    itemHeightPercent: 35,
    itemSpacing: 3,
    fontSize: 12,
    bgLightness: 96,
    showBorder: true,
    borderDarkness: 45,
    completedMode: 'strikethrough',
    todayBgColor: 'blue',
    todayBorderColor: 'default',
};

interface CalendarSettingsModalProps {
    isOpen: boolean;
    onClose: () => void;
    settings: CalendarSettings;
    onSettingsChange: (newSettings: CalendarSettings) => void;
    onReset: () => void;
}

export function CalendarSettingsModal({
    isOpen,
    onClose,
    settings,
    onSettingsChange,
    onReset
}: CalendarSettingsModalProps) {

    const handleChange = (key: keyof CalendarSettings, value: any) => {
        onSettingsChange({
            ...settings,
            [key]: value
        });
    };

    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <DialogContent className="sm:max-w-md max-h-[80vh] overflow-y-auto">
                <DialogHeader className="flex flex-row items-center justify-between space-y-0 pb-2 border-b mb-4">
                    <DialogTitle>캘린더 스타일 설정</DialogTitle>
                    <div className="flex items-center gap-2 mr-10">
                        <button
                            onClick={onReset}
                            className="p-1.5 text-xs font-medium text-gray-500 hover:text-gray-900 bg-gray-100 hover:bg-gray-200 rounded flex items-center gap-1 transition-colors"
                            title="기본값으로 초기화"
                        >
                            <RotateCcw className="w-3 h-3" />
                            초기화
                        </button>
                    </div>
                </DialogHeader>

                <div className="space-y-6">
                    {/* 1. Layout & Size */}
                    <div className="space-y-3">
                        <h4 className="font-semibold text-sm text-gray-900 dark:text-gray-100 flex items-center gap-2">
                            <span className="w-1 h-4 bg-blue-500 rounded-full"></span>
                            레이아웃 & 크기
                        </h4>

                        {/* Item Height */}
                        <div className="grid grid-cols-[120px_1fr] items-center gap-4">
                            <label className="text-sm text-gray-600 dark:text-gray-400">일정 높이 (%)</label>
                            <div className="flex items-center gap-3">
                                <input
                                    type="range"
                                    min="20"
                                    max="60"
                                    step="1"
                                    value={settings.itemHeightPercent}
                                    onChange={(e) => handleChange('itemHeightPercent', parseInt(e.target.value))}
                                    className="flex-1 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
                                />
                                <span className="text-sm font-medium w-8 text-right">{settings.itemHeightPercent}</span>
                            </div>
                        </div>

                        {/* Item Spacing */}
                        <div className="grid grid-cols-[120px_1fr] items-center gap-4">
                            <label className="text-sm text-gray-600 dark:text-gray-400">아이템 간격 (px)</label>
                            <div className="flex bg-gray-100 dark:bg-gray-800 rounded p-1">
                                {[1, 2, 3, 4].map((px) => (
                                    <button
                                        key={px}
                                        onClick={() => handleChange('itemSpacing', px)}
                                        className={`flex-1 py-1 text-xs font-medium rounded transition-colors ${settings.itemSpacing === px
                                            ? 'bg-white dark:bg-gray-700 text-blue-600 shadow-sm'
                                            : 'text-gray-500 hover:text-gray-700'
                                            }`}
                                    >
                                        {px}px
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Font Size */}
                        <div className="grid grid-cols-[120px_1fr] items-center gap-4">
                            <label className="text-sm text-gray-600 dark:text-gray-400">폰트 크기</label>
                            <div className="flex bg-gray-100 dark:bg-gray-800 rounded p-1">
                                {[
                                    { val: 11, label: '작게 (11)' },
                                    { val: 12, label: '보통 (12)' },
                                    { val: 13, label: '크게 (13)' }
                                ].map((opt) => (
                                    <button
                                        key={opt.val}
                                        onClick={() => handleChange('fontSize', opt.val)}
                                        className={`flex-1 py-1 text-xs font-medium rounded transition-colors ${settings.fontSize === opt.val
                                            ? 'bg-white dark:bg-gray-700 text-blue-600 shadow-sm'
                                            : 'text-gray-500 hover:text-gray-700'
                                            }`}
                                    >
                                        {opt.label}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>

                    <hr className="border-gray-100 dark:border-gray-800" />

                    {/* 2. Colors & Style */}
                    <div className="space-y-3">
                        <h4 className="font-semibold text-sm text-gray-900 dark:text-gray-100 flex items-center gap-2">
                            <span className="w-1 h-4 bg-purple-500 rounded-full"></span>
                            색상 & 스타일
                        </h4>

                        {/* Bg Brightness */}
                        <div className="grid grid-cols-[120px_1fr] items-center gap-4">
                            <div>
                                <label className="text-sm text-gray-600 dark:text-gray-400 block">배경 밝기</label>
                                <span className="text-[10px] text-gray-400">0(어두움) ~ 100(밝음)</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <input
                                    type="number"
                                    min="0"
                                    max="100"
                                    value={settings.bgLightness}
                                    onChange={(e) => {
                                        let val = parseInt(e.target.value);
                                        if (isNaN(val)) val = 0;
                                        if (val < 0) val = 0;
                                        if (val > 100) val = 100;
                                        handleChange('bgLightness', val);
                                    }}
                                    className="w-full px-2 py-1.5 text-sm border rounded focus:ring-2 focus:ring-purple-500 dark:bg-gray-800 dark:border-gray-700"
                                />
                                <div
                                    className="w-8 h-8 rounded border"
                                    style={{ backgroundColor: `hsl(220, 13%, ${settings.bgLightness}%)` }}
                                    title="Preiview"
                                />
                            </div>
                        </div>

                        {/* Border Style */}
                        <div className="grid grid-cols-[120px_1fr] items-center gap-4">
                            <label className="text-sm text-gray-600 dark:text-gray-400">테두리 표시</label>
                            <div className="flex items-center">
                                <label className="inline-flex items-center cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={settings.showBorder}
                                        onChange={(e) => handleChange('showBorder', e.target.checked)}
                                        className="sr-only peer"
                                    />
                                    <div className="relative w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-purple-300 dark:peer-focus:ring-purple-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-purple-600"></div>
                                    <span className="ms-3 text-sm font-medium text-gray-700 dark:text-gray-300">
                                        {settings.showBorder ? '전체 테두리' : '테두리 없음'}
                                    </span>
                                </label>
                            </div>
                        </div>

                        {/* Border Darkness */}
                        {settings.showBorder && (
                            <div className="grid grid-cols-[120px_1fr] items-center gap-4">
                                <div>
                                    <label className="text-sm text-gray-600 dark:text-gray-400 block">테두리 농도</label>
                                    <span className="text-[10px] text-gray-400">0(연함) ~ 100(진함)</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <input
                                        type="number"
                                        min="0"
                                        max="100"
                                        value={settings.borderDarkness}
                                        onChange={(e) => {
                                            let val = parseInt(e.target.value);
                                            if (isNaN(val)) val = 0;
                                            if (val < 0) val = 0;
                                            if (val > 100) val = 100;
                                            handleChange('borderDarkness', val);
                                        }}
                                        className="w-full px-2 py-1.5 text-sm border rounded focus:ring-2 focus:ring-purple-500 dark:bg-gray-800 dark:border-gray-700"
                                    />
                                    <div
                                        className="w-8 h-8 rounded border-4"
                                        style={{
                                            borderColor: `hsl(220, 13%, ${100 - settings.borderDarkness}%)`,
                                            backgroundColor: 'transparent'
                                        }}
                                        title="Preview"
                                    />
                                </div>
                            </div>
                        )}

                        {/* Completed Tasks */}
                        <div className="grid grid-cols-[120px_1fr] items-center gap-4">
                            <label className="text-sm text-gray-600 dark:text-gray-400">완료된 일정</label>
                            <select
                                value={settings.completedMode}
                                onChange={(e) => handleChange('completedMode', e.target.value)}
                                className="w-full px-2 py-1.5 text-sm border rounded focus:ring-2 focus:ring-purple-500 dark:bg-gray-800 dark:border-gray-700"
                            >
                                <option value="dimmed">흐리게 표시 (Dimmed)</option>
                                <option value="strikethrough">취소선 (Strike-through)</option>
                                <option value="hidden">숨기기 (Hidden)</option>
                            </select>
                        </div>
                    </div>

                    <hr className="border-gray-100 dark:border-gray-800" />

                    {/* 3. Today Style */}
                    <div className="space-y-3">
                        <h4 className="font-semibold text-sm text-gray-900 dark:text-gray-100 flex items-center gap-2">
                            <span className="w-1 h-4 bg-orange-500 rounded-full"></span>
                            오늘 날짜 스타일
                        </h4>

                        {/* Today Background */}
                        <div className="grid grid-cols-[120px_1fr] items-center gap-4">
                            <label className="text-sm text-gray-600 dark:text-gray-400">배경 색상</label>
                            <div className="flex bg-gray-100 dark:bg-gray-800 rounded p-1">
                                {[
                                    { val: 'blue', label: '파랑 (기본)' },
                                    { val: 'yellow', label: '노랑' },
                                    { val: 'orange', label: '주황' },
                                    { val: 'green', label: '초록' },
                                    { val: 'none', label: '없음' }
                                ].map((opt) => (
                                    <button
                                        key={opt.val}
                                        onClick={() => handleChange('todayBgColor', opt.val)}
                                        className={`flex-1 py-1 text-[10px] font-medium rounded transition-colors ${settings.todayBgColor === opt.val
                                            ? 'bg-white dark:bg-gray-700 text-blue-600 shadow-sm'
                                            : 'text-gray-500 hover:text-gray-700'
                                            }`}
                                    >
                                        {opt.label}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Today Border */}
                        <div className="grid grid-cols-[120px_1fr] items-center gap-4">
                            <label className="text-sm text-gray-600 dark:text-gray-400">테두리 색상</label>
                            <div className="flex bg-gray-100 dark:bg-gray-800 rounded p-1">
                                {[
                                    { val: 'default', label: '기본' },
                                    { val: 'light', label: '밝음' },
                                    { val: 'medium', label: '중간' },
                                    { val: 'dark', label: '어두움' }
                                ].map((opt) => (
                                    <button
                                        key={opt.val}
                                        onClick={() => handleChange('todayBorderColor', opt.val)}
                                        className={`flex-1 py-1 text-xs font-medium rounded transition-colors ${settings.todayBorderColor === opt.val
                                            ? 'bg-white dark:bg-gray-700 text-blue-600 shadow-sm'
                                            : 'text-gray-500 hover:text-gray-700'
                                            }`}
                                    >
                                        {opt.label}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>


                    <hr className="border-gray-100 dark:border-gray-800" />

                    {/* 4. Manage Settings (Import/Export) */}
                    <div className="space-y-3 pt-2">
                        <h4 className="font-semibold text-sm text-gray-900 dark:text-gray-100 flex items-center gap-2">
                            <span className="w-1 h-4 bg-gray-500 rounded-full"></span>
                            설정 백업 및 공유
                        </h4>
                        <div className="flex gap-2">
                            <button
                                onClick={() => {
                                    try {
                                        navigator.clipboard.writeText(JSON.stringify(settings));
                                        alert('설정값이 클립보드에 복사되었습니다.\n다른 컴퓨터의 "설정 붙여넣기"를 통해 적용하세요.');
                                    } catch (e) {
                                        alert('복사에 실패했습니다.');
                                    }
                                }}
                                className="flex-1 py-2 px-3 text-sm bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 rounded flex items-center justify-center gap-2 transition-colors"
                            >
                                📋 설정 복사하기 (내보내기)
                            </button>
                            <button
                                onClick={() => {
                                    const input = prompt('복사한 설정값을 여기에 붙여넣으세요:');
                                    if (input) {
                                        try {
                                            const parsed = JSON.parse(input);
                                            // Validate mandatory fields roughly
                                            if (typeof parsed.itemHeightPercent === 'number' && typeof parsed.itemSpacing === 'number') {
                                                onSettingsChange({ ...settings, ...parsed });
                                                alert('설정이 성공적으로 적용되었습니다!');
                                            } else {
                                                alert('올바르지 않은 설정 포맷입니다.');
                                            }
                                        } catch (e) {
                                            alert('설정 적용 실패: 올바른 JSON 형식이 아닙니다.');
                                        }
                                    }
                                }}
                                className="flex-1 py-2 px-3 text-sm bg-blue-50 hover:bg-blue-100 dark:bg-blue-900/20 dark:hover:bg-blue-900/40 text-blue-700 dark:text-blue-300 rounded flex items-center justify-center gap-2 transition-colors"
                            >
                                📥 설정 붙여넣기 (가져오기)
                            </button>
                        </div>
                        <p className="text-[11px] text-gray-400">
                            * '설정 복사하기'를 누른 후, 다른 컴퓨터에서 '설정 붙여넣기'를 통해 설정을 그대로 가져올 수 있습니다.
                        </p>
                    </div>
                </div>
            </DialogContent>
        </Dialog >
    );
}
