'use client';
const BRAND_MAP: Record<string, string> = { kucham: "kucham", uvid: "uvid", betterworld: "uvid", meariset: "meariset", foremong: "foremong" };
function normBrand(b: string) { return BRAND_MAP[b] ?? b; }

import { useEffect, useState } from 'react';
import { fetchKeywordLearning, fetchKeywordExpansion } from '@/lib/data';
import { useBrandFilter } from '@/components/BrandFilter';
import { Card, CardTitle } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import type { KeywordLearning, KeywordExpansion } from '@/lib/types';

const STATUS_VARIANT: Record<string, 'green' | 'red' | 'gray' | 'blue' | 'yellow'> = {
  신규: 'blue',
  keep: 'green',
  exclude: 'red',
  paused: 'gray',
  pending: 'yellow',
  승인: 'green',
  거부: 'red',
};

function StatusBadge({ status }: { status: string }) {
  const variant = STATUS_VARIANT[status] ?? 'gray';
  return <Badge variant={variant}>{status}</Badge>;
}

export default function Keywords() {
  const { selectedBrand } = useBrandFilter();
  const [subTab, setSubTab] = useState<'a' | 'b'>('a');
  const [learning, setLearning] = useState<KeywordLearning[]>([]);
  const [expansion, setExpansion] = useState<KeywordExpansion[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedRows, setSelectedRows] = useState<Set<number>>(new Set());

  useEffect(() => {
    Promise.all([fetchKeywordLearning(), fetchKeywordExpansion()]).then(
      ([l, e]) => {
        setLearning(l);
        setExpansion(e);
        setLoading(false);
      }
    );
  }, []);

  // 탭 전환 시 선택 초기화
  useEffect(() => {
    setSelectedRows(new Set());
  }, [subTab, selectedBrand]);

  const filteredLearning =
    selectedBrand === 'all'
      ? learning
      : learning.filter((k) => normBrand(k.brand) === selectedBrand);

  const filteredExpansion =
    selectedBrand === 'all'
      ? expansion
      : expansion.filter((k) => normBrand(k.brand) === selectedBrand);

  const pendingExpansion = filteredExpansion.filter((k) => k.status === 'pending');

  // 전체 선택 (현재 서브탭 기준)
  const currentRows = subTab === 'a' ? filteredLearning : filteredExpansion;
  const allSelected = currentRows.length > 0 && currentRows.every((_, i) => selectedRows.has(i));

  function toggleAll() {
    if (allSelected) {
      setSelectedRows(new Set());
    } else {
      setSelectedRows(new Set(currentRows.map((_, i) => i)));
    }
  }

  function toggleOne(i: number) {
    const next = new Set(selectedRows);
    if (next.has(i)) next.delete(i);
    else next.add(i);
    setSelectedRows(next);
  }

  function handleBulkApprove() {
    const selected = pendingExpansion.filter((_, i) => selectedRows.has(i));
    console.log('일괄 승인:', selected);
    // TODO: API 연결
    setSelectedRows(new Set());
  }

  return (
    <div className="space-y-4">
      {/* Sub-tab toggle */}
      <div className="flex gap-0 bg-[#161b27] border border-[#2a2d3e] rounded-lg overflow-hidden w-fit">
        <button
          onClick={() => setSubTab('a')}
          className={`px-4 py-2 text-sm font-medium transition-colors ${
            subTab === 'a'
              ? 'bg-blue-600 text-white'
              : 'text-gray-400 hover:text-gray-200'
          }`}
        >
          ④-A 현황
        </button>
        <button
          onClick={() => setSubTab('b')}
          className={`px-4 py-2 text-sm font-medium transition-colors ${
            subTab === 'b'
              ? 'bg-blue-600 text-white'
              : 'text-gray-400 hover:text-gray-200'
          }`}
        >
          ④-B 등록 관리
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-64 text-gray-400">
          데이터 로딩 중...
        </div>
      ) : subTab === 'a' ? (
        <Card>
          <div className="flex items-center justify-between mb-4">
            <CardTitle>키워드 학습 현황</CardTitle>
            {selectedRows.size > 0 && (
              <span className="text-sm text-gray-400">{selectedRows.size}개 선택됨</span>
            )}
          </div>
          {filteredLearning.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="text-3xl mb-3">⏳</div>
              <p className="text-gray-400 font-medium mb-1">수집 대기중</p>
              <p className="text-gray-600 text-sm">
                키워드 학습 데이터가 수집되면 여기에 표시됩니다.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[#2a2d3e] text-gray-400 text-left">
                    <th className="pb-2 pr-3">
                      <input
                        type="checkbox"
                        checked={allSelected}
                        onChange={toggleAll}
                        className="accent-blue-500 cursor-pointer"
                      />
                    </th>
                    <th className="pb-2 pr-4 font-medium">키워드</th>
                    <th className="pb-2 pr-4 font-medium">브랜드</th>
                    <th className="pb-2 pr-4 font-medium">상태</th>
                    <th className="pb-2 pr-4 font-medium text-right">7일 클릭</th>
                    <th className="pb-2 pr-4 font-medium text-right">7일 ROAS%</th>
                    <th className="pb-2 font-medium">판정일</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#2a2d3e]">
                  {filteredLearning.map((kw, i) => (
                    <tr
                      key={i}
                      className={`hover:bg-[#1e2130] transition-colors cursor-pointer ${
                        selectedRows.has(i) ? 'bg-blue-950/30' : ''
                      }`}
                      onClick={() => toggleOne(i)}
                    >
                      <td className="py-2 pr-3" onClick={(e) => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          checked={selectedRows.has(i)}
                          onChange={() => toggleOne(i)}
                          className="accent-blue-500 cursor-pointer"
                        />
                      </td>
                      <td className="py-2 pr-4 text-white font-medium">{kw.keyword}</td>
                      <td className="py-2 pr-4 text-gray-300">{kw.brand}</td>
                      <td className="py-2 pr-4">
                        <StatusBadge status={kw.status} />
                      </td>
                      <td className="py-2 pr-4 text-right text-gray-300">
                        {kw.clk_7d.toLocaleString()}
                      </td>
                      <td className="py-2 pr-4 text-right text-gray-300">{kw.roas_7d}%</td>
                      <td className="py-2 text-gray-400 text-xs">{kw.verdict_at}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      ) : (
        <Card>
          <div className="flex items-center justify-between mb-4">
            <CardTitle>키워드 등록 관리</CardTitle>
            <div className="flex items-center gap-2">
              {selectedRows.size > 0 && (
                <span className="text-sm text-gray-400">{selectedRows.size}개 선택됨</span>
              )}
              {pendingExpansion.some((_, i) => selectedRows.has(i)) && (
                <button
                  onClick={handleBulkApprove}
                  className="text-sm bg-blue-600 hover:bg-blue-500 text-white px-4 py-1.5 rounded transition-colors"
                >
                  선택 승인 ({selectedRows.size}건)
                </button>
              )}
              {pendingExpansion.length > 0 && selectedRows.size === 0 && (
                <button
                  onClick={() => {
                    const pendingIdxs = filteredExpansion
                      .map((k, i) => (k.status === 'pending' ? i : -1))
                      .filter((i) => i !== -1);
                    setSelectedRows(new Set(pendingIdxs));
                  }}
                  className="text-sm bg-blue-600 hover:bg-blue-500 text-white px-4 py-1.5 rounded transition-colors"
                >
                  일괄 승인
                </button>
              )}
            </div>
          </div>
          {filteredExpansion.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="text-3xl mb-3">🔍</div>
              <p className="text-gray-400 font-medium mb-1">후보 수집 대기중</p>
              <p className="text-gray-600 text-sm">
                키워드 확장 후보가 수집되면 여기에 표시됩니다.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[#2a2d3e] text-gray-400 text-left">
                    <th className="pb-2 pr-3">
                      <input
                        type="checkbox"
                        checked={allSelected}
                        onChange={toggleAll}
                        className="accent-blue-500 cursor-pointer"
                      />
                    </th>
                    <th className="pb-2 pr-4 font-medium">키워드</th>
                    <th className="pb-2 pr-4 font-medium">브랜드</th>
                    <th className="pb-2 pr-4 font-medium">소스</th>
                    <th className="pb-2 pr-4 font-medium">카테고리</th>
                    <th className="pb-2 font-medium">상태</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#2a2d3e]">
                  {filteredExpansion.map((kw, i) => (
                    <tr
                      key={i}
                      className={`hover:bg-[#1e2130] transition-colors cursor-pointer ${
                        selectedRows.has(i) ? 'bg-blue-950/30' : ''
                      }`}
                      onClick={() => toggleOne(i)}
                    >
                      <td className="py-2 pr-3" onClick={(e) => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          checked={selectedRows.has(i)}
                          onChange={() => toggleOne(i)}
                          className="accent-blue-500 cursor-pointer"
                        />
                      </td>
                      <td className="py-2 pr-4 text-white font-medium">{kw.keyword}</td>
                      <td className="py-2 pr-4 text-gray-300">{kw.brand}</td>
                      <td className="py-2 pr-4 text-gray-400">{kw.source}</td>
                      <td className="py-2 pr-4 text-gray-400">{kw.category}</td>
                      <td className="py-2">
                        <StatusBadge status={kw.status} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}
    </div>
  );
}
