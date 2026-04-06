'use client';

import { createContext, useContext, useState, ReactNode } from 'react';
import type { Brand } from '@/lib/types';

interface BrandFilterContextType {
  selectedBrand: Brand;
  setSelectedBrand: (brand: Brand) => void;
}

const BrandFilterContext = createContext<BrandFilterContextType>({
  selectedBrand: 'all',
  setSelectedBrand: () => {},
});

export function BrandFilterProvider({ children }: { children: ReactNode }) {
  const [selectedBrand, setSelectedBrand] = useState<Brand>('all');
  return (
    <BrandFilterContext.Provider value={{ selectedBrand, setSelectedBrand }}>
      {children}
    </BrandFilterContext.Provider>
  );
}

export function useBrandFilter() {
  return useContext(BrandFilterContext);
}

const BRANDS: { value: Brand; label: string }[] = [
  { value: 'all', label: '전체' },
  { value: 'kucham', label: '쿠참' },
  { value: 'uvid', label: '유비드' },
  { value: 'meariset', label: '메아리셋' },
  { value: 'foremong', label: '포레몽' },
];

export function BrandFilterToggle() {
  const { selectedBrand, setSelectedBrand } = useBrandFilter();
  return (
    <div className="flex flex-wrap gap-1">
      {BRANDS.map((b) => (
        <button
          key={b.value}
          onClick={() => setSelectedBrand(b.value)}
          className={`px-3 py-1 rounded text-sm font-medium transition-colors ${
            selectedBrand === b.value
              ? 'bg-blue-600 text-white'
              : 'bg-[#1e2130] text-gray-400 hover:text-white hover:bg-[#252840]'
          }`}
        >
          {b.label}
        </button>
      ))}
    </div>
  );
}
