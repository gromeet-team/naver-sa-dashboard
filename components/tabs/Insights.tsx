'use client';

import { useEffect, useState, useCallback } from 'react';
import { useBrandFilter } from '@/components/BrandFilter';
import { Card, CardTitle } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? '';
const TUNNEL_HEADERS = { 'bypass-tunnel-reminder': 'true' };

type ActionStatus = 'pending' | 'in_progress' | 'done' | 'review' | 'dismissed';
type ActionPriority = 'high' | 'medium' | 'low';

interface NextAction {
  id: string;
  priority: ActionPriority;
  brand: string;
  adgroup: string;
  current_creative: string;
  issue: string;
  suggestion: string;
  status: ActionStatus;
  due_date: string;
  memo?: string;
  next_hook?: string;
  d7_roas?: number | null;
  trigger?: string; // 'manual' | 'auto_d7' | 'auto_roas0' | 'auto_bep'
  created_at?: string;
}

interface Pattern {
  id: string;
  brand: string;
  pattern: string;
  evidence: string;
  confidence: 'high' | 'medium' | 'low';
  created_at: string;
  source: string;
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

const STATUS_CONFIG: Record<ActionStatus, { label: string; color: string; next: ActionStatus | null }> = {
  pending:     { label: '📋 미처리',   color: 'text-gray-400',  next: 'in_progress' },
  in_progress: { label: '🔨 진행중',   color: 'text-yellow-400', next: 'done' },
  done:        { label: '✅ 완료',     color: 'text-green-400',  next: 'review' },
  review:      { label: '🔁 재검토',   color: 'text-blue-400',   next: 'in_progress' },
  dismissed:   { label: '❌ 기각',     color: 'text-gray-600',   next: null },
};

const PRIORITY_CONFIG: Record<ActionPriority, { label: string; bg: string }> = {
  high:   { label: '🔴 긴급', bg: 'bg-red-900/30 border-red-700' },
  medium: { label: '🟡 보통', bg: 'bg-yellow-900/20 border-yellow-800' },
  low:    { label: '🟢 낮음', bg: 'bg-green-900/20 border-green-900' },
};

const confidenceBadge = (c: string) => {
  if (c === 'high') return <Badge variant="green">신뢰 높음</Badge>;
  if (c === 'medium') return <Badge variant="gray">신뢰 보통</Badge>;
  return <Badge variant="red">신뢰 낮음</Badge>;
};

export default function Insights() {
  const { selectedBrand } = useBrandFilter();
  const [data, setData] = useState<InsightsData>({ patterns: [], next_actions: [], learnings: [] });
  const [loading, setLoading] = useState(true);
  const [activeSection, setActiveSection] = useState<'actions' | 'patterns' | 'learnings'>('actions');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [memoText, setMemoText] = useState('');
  const [hookText, setHookText] = useState('');
  const [showDismissed, setShowDismissed] = useState(false);

  const loadData = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/api/insights`, { headers: TUNNEL_HEADERS, cache: 'no-store' });
      if (res.ok) setData(await res.json());
    } catch { /* fallback */ }
    setLoading(false);
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const postAction = async (payload: object) => {
    await fetch(`${API_URL}/api/insights/action`, {
      method: 'POST',
      headers: { ...TUNNEL_HEADERS, 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    loadData();
  };

  const advanceStatus = (action: NextAction) => {
    const next = STATUS_CONFIG[action.status].next;
    if (next) postAction({ id: action.id, status: next });
  };

  const saveMemo = (action: NextAction) => {
    postAction({ id: action.id, memo: memoText, next_hook: hookText });
    setEditingId(null);
  };

  const startEdit = (action: NextAction) => {
    setEditingId(action.id);
    setMemoText(action.memo ?? '');
    setHookText(action.next_hook ?? '');
  };

  const filteredActions = data.next_actions.filter(a =>
    (selectedBrand === 'all' || normBrand(a.brand) === selectedBrand) &&
    (showDismissed || a.status !== 'dismissed')
  );

  const activeCount = data.next_actions.filter(a =>
    (selectedBrand === 'all' || normBrand(a.brand) === selectedBrand) &&
    a.status !== 'dismissed' && a.status !== 'done'
  ).length;

  const filteredPatterns = data.patterns.filter(p =>
    selectedBrand === 'all' || normBrand(p.brand) === selectedBrand
  );

  const sortedActions = [...filteredActions].sort((a, b) => {
    const sOrder: Record<ActionStatus, number> = { pending: 0, in_progress: 1, review: 2, done: 3, dismissed: 4 };
    const pOrder: Record<ActionPriority, number> = { high: 0, medium: 1, low: 2 };
    if (sOrder[a.status] !== sOrder[b.status]) return sOrder[a.status] - sOrder[b.status];
    return pOrder[a.priority] - pOrder[b.priority];
  });

  if (loading) return <div className="flex items-center justify-center h-64 text-gray-400">로딩 중...</div>;

  return (
    <div className="space-y-4">
      {/* 섹션 토글 */}
      <div className="flex gap-2 flex-wrap">
        {(['actions', 'patterns', 'learnings'] as const).map(s => (
          <button
            key={s}
            onClick={() => setActiveSection(s)}
            className={`px-4 py-2 rounded text-sm font-medium transition-colors ${
              activeSection === s ? 'bg-blue-600 text-white' : 'bg-[#1e2130] text-gray-400 hover:text-gray-200'
            }`}
          >
            {s === 'actions' ? `🎯 액션 큐 (${activeCount} 진행)` :
             s === 'patterns' ? `📊 성과 패턴 (${filteredPatterns.length})` :
             `📚 교훈 (${data.learnings.length})`}
          </button>
        ))}
      </div>

      {/* 액션 큐 */}
      {activeSection === 'actions' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-gray-500 text-xs">소재 교체 우선순위 — 상태 클릭으로 전환 / 카드 클릭으로 메모 편집</p>
            <button
              onClick={() => setShowDismissed(!showDismissed)}
              className="text-xs text-gray-600 hover:text-gray-400"
            >
              {showDismissed ? '기각 숨기기' : '기각 포함 보기'}
            </button>
          </div>
          {sortedActions.length === 0 ? (
            <Card><p className="text-gray-500 text-sm text-center py-8">액션 항목이 없습니다.</p></Card>
          ) : (
            sortedActions.map((action) => {
              const pc = PRIORITY_CONFIG[action.priority];
              const sc = STATUS_CONFIG[action.status];
              const isEditing = editingId === action.id;
              return (
                <div key={action.id} className={`border rounded-lg p-4 space-y-3 ${pc.bg}`}>
                  {/* 헤더 */}
                  <div className="flex items-start justify-between gap-2 flex-wrap">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-medium text-gray-400">{pc.label}</span>
                      <span className="text-white font-medium text-sm">{BRAND_MAP[action.brand] ?? action.brand}</span>
                      <span className="text-gray-400 text-sm">— {action.adgroup}</span>
                      {action.trigger && action.trigger !== 'manual' && (
                        <span className="text-xs text-purple-400 bg-purple-900/30 px-1 rounded">
                          {action.trigger === 'auto_d7' ? '⚡ D+7 자동' :
                           action.trigger === 'auto_roas0' ? '⚡ ROAS0 자동' :
                           action.trigger === 'auto_bep' ? '⚡ BEP 자동' : ''}
                        </span>
                      )}
                      {/* 상태 버튼 — 클릭으로 전환 */}
                      <button
                        onClick={() => advanceStatus(action)}
                        className={`text-xs px-2 py-0.5 rounded border border-current/30 hover:opacity-80 transition-opacity ${sc.color}`}
                        title={STATUS_CONFIG[action.status].next ? `→ ${STATUS_CONFIG[STATUS_CONFIG[action.status].next!].label}` : ''}
                      >
                        {sc.label} {sc.next ? '▶' : ''}
                      </button>
                    </div>
                    <div className="flex items-center gap-3">
                      {action.d7_roas !== null && action.d7_roas !== undefined && (
                        <span className={`text-xs font-mono ${action.d7_roas > 300 ? 'text-green-400' : 'text-red-400'}`}>
                          D+7 {action.d7_roas}%
                        </span>
                      )}
                      <span className="text-gray-500 text-xs">기한: {action.due_date}</span>
                    </div>
                  </div>

                  {/* 내용 */}
                  <div className="text-xs space-y-1.5">
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
                    {action.memo && (
                      <div className="flex gap-2">
                        <span className="text-gray-500 w-16 flex-shrink-0">메모</span>
                        <span className="text-yellow-200">{action.memo}</span>
                      </div>
                    )}
                    {action.next_hook && (
                      <div className="flex gap-2">
                        <span className="text-gray-500 w-16 flex-shrink-0">다음 훅</span>
                        <span className="text-purple-300">💡 {action.next_hook}</span>
                      </div>
                    )}
                  </div>

                  {/* 인라인 메모 편집 */}
                  {isEditing && (
                    <div className="space-y-2 pt-1 border-t border-[#2a2d3e]">
                      <div>
                        <label className="text-xs text-gray-400 block mb-1">📝 보완 메모</label>
                        <textarea
                          value={memoText}
                          onChange={e => setMemoText(e.target.value)}
                          className="w-full bg-[#0f1117] border border-[#2a2d3e] rounded px-2 py-1 text-xs text-white resize-none"
                          rows={2}
                          placeholder="결과 및 보완점..."
                        />
                      </div>
                      <div>
                        <label className="text-xs text-gray-400 block mb-1">💡 다음 소재 훅/아이디어</label>
                        <input
                          value={hookText}
                          onChange={e => setHookText(e.target.value)}
                          className="w-full bg-[#0f1117] border border-[#2a2d3e] rounded px-2 py-1 text-xs text-white"
                          placeholder="다음에 시도할 소재 방향..."
                        />
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => saveMemo(action)}
                          className="text-xs px-3 py-1 bg-blue-700 text-white rounded hover:bg-blue-600"
                        >
                          저장
                        </button>
                        <button
                          onClick={() => setEditingId(null)}
                          className="text-xs px-3 py-1 bg-[#2a2d3e] text-gray-400 rounded"
                        >
                          취소
                        </button>
                      </div>
                    </div>
                  )}

                  {/* 액션 버튼 */}
                  {!isEditing && (
                    <div className="flex gap-2 pt-1 flex-wrap">
                      <button
                        onClick={() => startEdit(action)}
                        className="text-xs px-3 py-1 bg-[#2a2d3e] text-gray-300 rounded hover:bg-[#3a3d4e]"
                      >
                        ✏️ 메모/훅 편집
                      </button>
                      {action.status !== 'dismissed' && (
                        <button
                          onClick={() => postAction({ id: action.id, status: 'dismissed' })}
                          className="text-xs px-2 py-1 text-gray-600 hover:text-gray-400"
                        >
                          기각
                        </button>
                      )}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
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
          <CardTitle>📚 운영 교훈</CardTitle>
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

      {data.updated_at && (
        <p className="text-gray-600 text-xs text-right">마지막 업데이트: {data.updated_at}</p>
      )}
    </div>
  );
}
