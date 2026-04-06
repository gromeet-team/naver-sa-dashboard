'use client';

import { useState } from 'react';
import { BrandFilterToggle } from '@/components/BrandFilter';
import TodayStatus from '@/components/tabs/TodayStatus';
import BidAdjustment from '@/components/tabs/BidAdjustment';
import ABTest from '@/components/tabs/ABTest';
import Keywords from '@/components/tabs/Keywords';
import CronStatus from '@/components/tabs/CronStatus';

const TABS = [
  { id: 'today', label: '오늘 현황' },
  { id: 'bid', label: '입찰가 조정' },
  { id: 'ab', label: '소재 A/B' },
  { id: 'keywords', label: '키워드' },
  { id: 'cron', label: '크론 상태' },
] as const;

type TabId = (typeof TABS)[number]['id'];

export default function Home() {
  const [activeTab, setActiveTab] = useState<TabId>('today');

  return (
    <div className="flex flex-col min-h-screen bg-[#0f1117]">
      {/* Header */}
      <header className="bg-[#161b27] border-b border-[#2a2d3e] px-4 md:px-6 py-4">
        <div className="max-w-screen-xl mx-auto flex flex-col md:flex-row md:items-center gap-3 md:justify-between">
          <h1 className="text-lg md:text-xl font-bold text-white tracking-tight">
            네이버 SA 대시보드
          </h1>
          <BrandFilterToggle />
        </div>
      </header>

      {/* Tab Nav */}
      <nav className="bg-[#161b27] border-b border-[#2a2d3e] px-4 md:px-6 overflow-x-auto">
        <div className="max-w-screen-xl mx-auto flex gap-0">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-3 text-sm font-medium border-b-2 whitespace-nowrap transition-colors ${
                activeTab === tab.id
                  ? 'border-blue-500 text-blue-400'
                  : 'border-transparent text-gray-400 hover:text-gray-200'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </nav>

      {/* Content */}
      <main className="flex-1 px-4 md:px-6 py-6">
        <div className="max-w-screen-xl mx-auto">
          {activeTab === 'today' && <TodayStatus />}
          {activeTab === 'bid' && <BidAdjustment />}
          {activeTab === 'ab' && <ABTest />}
          {activeTab === 'keywords' && <Keywords />}
          {activeTab === 'cron' && <CronStatus />}
        </div>
      </main>
    </div>
  );
}
