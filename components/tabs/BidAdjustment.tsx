'use client';

import { useEffect, useState, useCallback } from 'react';
import {
  fetchAllHistory,
  fetchCreativeHistory,
} from '@/lib/data';
import { useBrandFilter } from '@/components/BrandFilter';
import { Card, CardTitle } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import type { HistoryRecord, CreativeHistoryItem } from '@/lib/types';

const BRAND_MAP: Record<string, string> = {
  kucham: 'kucham', uvid: 'uvid', betterworld: 'uvid', meariset: 'meariset', foremong: 'foremong',
};
function normBrand(b: string) { return BRAND_MAP[b] ?? b; }

function calcVerdict(
  d7Roas: number | null | undefined,
  d3Roas: number | null | undefined,
  preRoas: number
): { label: string; variant: 'green' | 'red' | 'gray' } {
  const roas = d7Roas ?? d3Roas ?? null;
  if (roas === null) return { label: '⏳ 판정중', variant: 'gray' };
  if (preRoas === 0) return { label: '➖ 유지', variant: 'gray' };
  const diff = ((roas - preRoas) / preRoas) * 100;
  if (diff >= 10) return { label: '🔼 상승', variant: 'green' };
  if (diff <= -10) return { label: '🔽 하락', variant: 'red' };
  return { label: '➖ 유지', variant: 'gray' };
}

function fmtDate(iso: string) {
  return iso.replace('T', ' ').slice(0, 16);
}

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? '';

export default function BidAdjustment() {
  const { selectedBrand } = useBrandFilter();
  const [history, setHistory] = useState<HistoryRecord[]>([]);
  const [creativeHistory, setCreativeHistory] = useState<CreativeHistoryItem[]>([]);
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(async () => {
    const [h, ch] = await Promise.all([fetchAllHistory(), fetchCreativeHistory()]);
    setHistory(h);
    setCreativeHistory(ch);
    setLoading(false);
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const filteredHistory =
    selectedBrand === 'all'
      ? history
      : history.filter((h) => normBrand(h.brand) === selectedBrand);

  async function handleRollback(rec: HistoryRecord) {
    try {
      await fetch(`${API_URL}/api/rollback`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'bypass-tunnel-reminder': 'true',
        },
        body: JSON.stringify({
          brand: rec.brand,
          adgroup_id: rec.adgroup_id,
          target_bid: rec.prev_bid,
        }),
      });
    } catch (e) {
      console.error('Rollback failed:', e);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-400">
        데이터 로딩 중...
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* 안내 배너 */}
      <div className="bg-blue-900/20 border border-blue-700/50 rounded-lg px-4 py-3 text-sm text-blue-300">
        💬 입찰가 조정은 슬랙으로 데이터를 전달해 주시면 직접 실행합니다.
      </div>

      {/* 변경 이력 */}
      <Card>
        <CardTitle>변경 이력 ({filteredHistory.length}건)</CardTitle>
        {filteredHistory.length === 0 ? (
          <p className="text-gray-500 text-sm text-center py-8">
            변경 이력이 없습니다.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[#2a2d3e] text-gray-400 text-left">
                  <th className="pb-2 pr-3 font-medium">실행일시</th>
                  <th className="pb-2 pr-3 font-medium">브랜드</th>
                  <th className="pb-2 pr-3 font-medium">광고그룹</th>
                  <th className="pb-2 pr-3 font-medium text-right">입찰가 변동</th>
                  <th className="pb-2 pr-3 font-medium text-right">ROAS%</th>
                  <th className="pb-2 pr-3 font-medium">사유</th>
                  <th className="pb-2 pr-3 font-medium text-right">D+1 ROAS</th>
                  <th className="pb-2 pr-3 font-medium text-right">D+3 ROAS</th>
                  <th className="pb-2 pr-3 font-medium text-right">D+7 ROAS</th>
                  <th className="pb-2 pr-3 font-medium">효율판정</th>
                  <th className="pb-2 font-medium"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#2a2d3e]">
                {filteredHistory.map((rec, i) => {
                  const verdict = calcVerdict(rec.d7_roas, rec.d3_roas, rec.pre_change_roas_7d);
                  return (
                    <tr key={i} className="hover:bg-[#1e2130] transition-colors">
                      <td className="py-2 pr-3 text-gray-400 whitespace-nowrap">
                        {fmtDate(rec.executed_at)}
                      </td>
                      <td className="py-2 pr-3 text-gray-300">{rec.brand_name}</td>
                      <td className="py-2 pr-3 text-white max-w-[140px] truncate">
                        {rec.adgroup_name}
                      </td>
                      <td className="py-2 pr-3 text-right whitespace-nowrap text-gray-300">
                        {rec.prev_bid.toLocaleString()}→{rec.new_bid.toLocaleString()}
                      </td>
                      <td className="py-2 pr-3 text-right text-gray-300">
                        {rec.roas_pct}%
                      </td>
                      <td className="py-2 pr-3 text-gray-400 text-xs max-w-[160px] truncate">
                        {rec.reason}
                      </td>
                      <td className="py-2 pr-3 text-right text-gray-300">
                        {rec.d1_roas != null ? `${rec.d1_roas}%` : '-'}
                      </td>
                      <td className="py-2 pr-3 text-right text-gray-300">
                        {rec.d3_roas != null ? `${rec.d3_roas}%` : '-'}
                      </td>
                      <td className="py-2 pr-3 text-right text-gray-300">
                        {rec.d7_roas != null ? `${rec.d7_roas}%` : '-'}
                      </td>
                      <td className="py-2 pr-3">
                        <Badge variant={verdict.variant}>{verdict.label}</Badge>
                      </td>
                      <td className="py-2">
                        <button
                          onClick={() => handleRollback(rec)}
                          className="text-xs text-gray-500 hover:text-gray-300 transition-colors"
                        >
                          복원
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* 소재 변경 이력 */}
      <Card>
        <CardTitle>
          🎨 소재 변경 이력 (
          {creativeHistory.filter(
            (c) => selectedBrand === 'all' || normBrand(c.brand) === selectedBrand
          ).length}
          건)
        </CardTitle>
        {(() => {
          const filtered = creativeHistory
            .filter(
              (c) => selectedBrand === 'all' || normBrand(c.brand) === selectedBrand
            )
            .sort((a, b) => b.changed_at.localeCompare(a.changed_at));
          if (filtered.length === 0) {
            return (
              <p className="text-gray-500 text-sm text-center py-8">
                소재 변경 이력이 없습니다.
              </p>
            );
          }
          return (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[#2a2d3e] text-gray-400 text-left">
                    <th className="pb-2 pr-3 font-medium">변경일</th>
                    <th className="pb-2 pr-3 font-medium">브랜드</th>
                    <th className="pb-2 pr-3 font-medium">광고그룹</th>
                    <th className="pb-2 pr-3 font-medium">변경 전</th>
                    <th className="pb-2 pr-3 font-medium">변경 후</th>
                    <th className="pb-2 pr-3 font-medium text-right">변경전 ROAS</th>
                    <th className="pb-2 pr-3 font-medium text-right">D+7 ROAS</th>
                    <th className="pb-2 font-medium">판정</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#2a2d3e]">
                  {filtered.map((item, i) => {
                    const d7 = item.d7_roas;
                    const preRoas = item.before_roas ?? 0;
                    let verdictLabel = '⏳ 추적중';
                    let verdictColor = 'text-gray-500';
                    if (d7 != null) {
                      if (preRoas === 0 || d7 > preRoas * 1.1) {
                        verdictLabel = '🔼 상승';
                        verdictColor = 'text-green-400';
                      } else if (d7 < preRoas * 0.9) {
                        verdictLabel = '🔽 하락';
                        verdictColor = 'text-red-400';
                      } else {
                        verdictLabel = '➡️ 유지';
                        verdictColor = 'text-gray-400';
                      }
                    }
                    return (
                      <tr key={i} className="hover:bg-[#1e2130] transition-colors">
                        <td className="py-2 pr-3 text-gray-400 whitespace-nowrap">
                          {item.changed_at}
                        </td>
                        <td className="py-2 pr-3 text-gray-300">{item.brand}</td>
                        <td className="py-2 pr-3 text-white max-w-[120px] truncate">
                          {item.adgroup}
                        </td>
                        <td className="py-2 pr-3 text-gray-400 text-xs max-w-[140px] truncate">
                          {item.before}
                        </td>
                        <td className="py-2 pr-3 text-blue-300 text-xs max-w-[140px] truncate">
                          {item.after}
                        </td>
                        <td className="py-2 pr-3 text-right text-gray-300">
                          {item.before_roas != null ? `${item.before_roas}%` : '-'}
                        </td>
                        <td className="py-2 pr-3 text-right text-gray-300">
                          {d7 != null ? `${d7}%` : '-'}
                        </td>
                        <td className={`py-2 text-sm ${verdictColor}`}>{verdictLabel}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          );
        })()}
      </Card>
    </div>
  );
}
