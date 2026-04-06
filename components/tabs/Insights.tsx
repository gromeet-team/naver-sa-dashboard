'use client';

import { useEffect, useState, useCallback } from 'react';
import { useBrandFilter } from '@/components/BrandFilter';
import { Card, CardTitle } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? '';
const TUNNEL_HEADERS = { 'bypass-tunnel-reminder': 'true' };

interface Pattern {
  id: string;
  brand: string;
  pattern: string;
  evidence: string;
  confidence: 'high' | 'medium' | 'low';
  created_at: string;
  source: string;
}

interface NextAction {
  id: string;
  priority: 'high' | 'medium' | 'low';
  brand: string;
  adgroup: string;
  current_creative: string;
  issue: string;
  suggestion: string;
  status: 'tracking' | 'pending' | 'done' | 'dismissed';
  due_date: string;
}

interface Learning {
  id: string;
  date: string;
  lesson: string;
  detail: string;
  action_taken: string;
}

interface InsightsData {
  updated_at?: string;
  patterns: Pattern[];
  next_actions: NextAction[];
  learnings: Learning[];
}

const BRAND_MAP: Record<string, string> = {
  kucham: '쿠참', uvid: '유비드', betterworld: '유비드', meariset: '메아리셋', foremong: '포레몽',
};
function normBrand(b: string) { return b === 'betterworld' ? 'uvid' : b; }

const priorityBadge = (p: string) => {
  if (p === 'high') return <Badge variant="red">🔴 긴급</Badge>;
  if (p === 'medium') return <Badge variant="gray">🟡 보통</Badge>;
  return <Badge variant="green">🟢 낮음</Badge>;
};

const confidenceBadge = (c: string) => {
  if (c === 'high') return <Badge variant="green">신뢰도 높음</Badge>;
  if (c === 'medium') return <Badge variant="gray">신뢰도 보통</Badge>;
  return <Badge variant="red">신뢰도 낮음</Badge>;
};

const statusBadge = (s: string) => {
  if (s === 'tracking') return <Badge variant="gray">⏳ 추적중</Badge>;
  if (s === 'done') return <Badge variant="green">✅ 완료</Badge>;
  if (s === 'dismissed') return <Badge variant="gray">❌ 기각</Badge>;
  return <Badge variant="gray">대기</Badge>;
};

export default function Insights() {
  const { selectedBrand } = useBrandFilter();
  const [data, setData] = useState<InsightsData>({ patterns: [], next_actions: [], learnings: [] });
  const [loading, setLoading] = useState(true);
  const [activeSection, setActiveSection] = useState<'actions' | 'patterns' | 'learnings'>('actions');

  const loadData = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/api/insights`, { headers: TUNNEL_HEADERS });
      if (res.ok) setData(await res.json());
    } catch { /* fallback */ }
    setLoading(false);
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const updateActionStatus = async (id: string, status: string) => {
    await fetch(`${API_URL}/api/insights/action`, {
      method: 'POST',
      headers: { ...TUNNEL_HEADERS, 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, status }),
    });
    loadData();
  };

  const filteredActions = data.next_actions.filter(a =>
    (selectedBrand === 'all' || normBrand(a.brand) === selectedBrand) &&
    a.status !== 'dismissed'
  );
  const filteredPatterns = data.patterns.filter(p =>
    selectedBrand === 'all' || normBrand(p.brand) === selectedBrand
  );

  if (loading) return <div className="flex items-center justify-center h-64 text-gray-400">로딩 중...</div>;

  return (
    <div className="space-y-4">
      {/* 섹션 토글 */}
      <div className="flex gap-2">
        {(['actions', 'patterns', 'learnings'] as const).map(s => (
          <button
            key={s}
            onClick={() => setActiveSection(s)}
            className={`px-4 py-2 rounded text-sm font-medium transition-colors ${
              activeSection === s
                ? 'bg-blue-600 text-white'
                : 'bg-[#1e2130] text-gray-400 hover:text-gray-200'
            }`}
          >
            {s === 'actions' ? `🎯 다음 액션 (${filteredActions.length})` :
             s === 'patterns' ? `📊 성과 패턴 (${filteredPatterns.length})` :
             `📚 교훈 (${data.learnings.length})`}
          </button>
        ))}
      </div>

      {/* 다음 액션 큐 */}
      {activeSection === 'actions' && (
        <Card>
          <CardTitle>🎯 소재 교체 액션 큐</CardTitle>
          <p className="text-gray-500 text-xs mt-1 mb-3">D+7 ROAS 결과 반영 / 다음 소재 방향 제안</p>
          {filteredActions.length === 0 ? (
            <p className="text-gray-500 text-sm text-center py-8">액션 항목이 없습니다.</p>
          ) : (
            <div className="space-y-4">
              {filteredActions
                .sort((a, b) => {
                  const pOrder = { high: 0, medium: 1, low: 2 };
                  return (pOrder[a.priority] ?? 9) - (pOrder[b.priority] ?? 9);
                })
                .map((action) => (
                <div key={action.id} className="border border-[#2a2d3e] rounded-lg p-4 space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      {priorityBadge(action.priority)}
                      <span className="text-white font-medium text-sm">{BRAND_MAP[action.brand] ?? action.brand}</span>
                      <span className="text-gray-400 text-sm">— {action.adgroup}</span>
                      {statusBadge(action.status)}
                    </div>
                    <span className="text-gray-500 text-xs whitespace-nowrap">기한: {action.due_date}</span>
                  </div>
                  <div className="text-xs space-y-1">
                    <div className="flex gap-2">
                      <span className="text-gray-500 w-16 flex-shrink-0">현재 소재</span>
                      <span className="text-blue-300">{action.current_creative}</span>
                    </div>
                    <div className="flex gap-2">
                      <span className="text-gray-500 w-16 flex-shrink-0">문제</span>
                      <span className="text-red-300">{action.issue}</span>
                    </div>
                    <div className="flex gap-2">
                      <span className="text-gray-500 w-16 flex-shrink-0">제안</span>
                      <span className="text-green-300">{action.suggestion}</span>
                    </div>
                  </div>
                  <div className="flex gap-2 pt-1">
                    <button
                      onClick={() => updateActionStatus(action.id, 'done')}
                      className="text-xs px-3 py-1 bg-green-900 text-green-300 rounded hover:bg-green-800 transition-colors"
                    >
                      ✅ 완료 처리
                    </button>
                    <button
                      onClick={() => updateActionStatus(action.id, 'dismissed')}
                      className="text-xs px-3 py-1 bg-[#2a2d3e] text-gray-400 rounded hover:bg-[#3a3d4e] transition-colors"
                    >
                      기각
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      )}

      {/* 성과 패턴 */}
      {activeSection === 'patterns' && (
        <Card>
          <CardTitle>📊 소재 성과 패턴</CardTitle>
          <p className="text-gray-500 text-xs mt-1 mb-3">누적 데이터 기반 학습된 패턴</p>
          {filteredPatterns.length === 0 ? (
            <p className="text-gray-500 text-sm text-center py-8">패턴 데이터가 없습니다.</p>
          ) : (
            <div className="space-y-3">
              {filteredPatterns.map((p) => (
                <div key={p.id} className="border border-[#2a2d3e] rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-white font-medium text-sm">{p.pattern}</span>
                    {confidenceBadge(p.confidence)}
                    <span className="text-gray-500 text-xs ml-auto">{BRAND_MAP[p.brand] ?? p.brand} · {p.created_at}</span>
                  </div>
                  <p className="text-gray-400 text-xs">{p.evidence}</p>
                  <p className="text-gray-600 text-xs mt-1">출처: {p.source}</p>
                </div>
              ))}
            </div>
          )}
        </Card>
      )}

      {/* 교훈 */}
      {activeSection === 'learnings' && (
        <Card>
          <CardTitle>📚 운영 교훈 (LEARNINGS)</CardTitle>
          <p className="text-gray-500 text-xs mt-1 mb-3">실수 및 개선사항 — 반복 방지용</p>
          {data.learnings.length === 0 ? (
            <p className="text-gray-500 text-sm text-center py-8">교훈 데이터가 없습니다.</p>
          ) : (
            <div className="space-y-3">
              {[...data.learnings].reverse().map((l) => (
                <div key={l.id} className="border border-[#2a2d3e] rounded-lg p-4">
                  <div className="flex items-start justify-between mb-2">
                    <span className="text-yellow-300 font-medium text-sm">⚠️ {l.lesson}</span>
                    <span className="text-gray-500 text-xs">{l.date}</span>
                  </div>
                  <p className="text-gray-400 text-xs mb-2">{l.detail}</p>
                  <p className="text-green-400 text-xs">✅ 조치: {l.action_taken}</p>
                </div>
              ))}
            </div>
          )}
        </Card>
      )}

      {/* 하단 업데이트 정보 */}
      {data.updated_at && (
        <p className="text-gray-600 text-xs text-right">마지막 업데이트: {data.updated_at}</p>
      )}
    </div>
  );
}
