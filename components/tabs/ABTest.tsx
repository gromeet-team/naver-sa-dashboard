'use client';

import { useBrandFilter } from '@/components/BrandFilter';
import { Card, CardTitle } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';

export default function ABTest() {
  const { selectedBrand } = useBrandFilter();

  // selectedBrand is used for future filtering when data is available
  void selectedBrand;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <h2 className="text-base font-semibold text-white">소재 A/B 테스트</h2>
        <Badge variant="yellow">데이터 연동 준비 중</Badge>
      </div>

      <Card>
        <CardTitle>소재 A/B 테스트</CardTitle>
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <div className="text-4xl mb-3">🔗</div>
          <p className="text-gray-400 font-medium mb-1">데이터 연동 준비 중</p>
          <p className="text-gray-600 text-sm">
            /api/ab-test 엔드포인트 연동 후 실제 A/B 테스트 결과가 표시됩니다.
          </p>
        </div>
      </Card>

      <Card>
        <CardTitle>소재 변경 이력</CardTitle>
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <div className="text-4xl mb-3">📋</div>
          <p className="text-gray-400 font-medium mb-1">데이터 연동 준비 중</p>
          <p className="text-gray-600 text-sm">
            /api/creative-changes 엔드포인트 연동 후 소재 변경 이력이 표시됩니다.
          </p>
        </div>
      </Card>
    </div>
  );
}
