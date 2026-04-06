import { ReactNode } from 'react';

interface CardProps {
  children: ReactNode;
  className?: string;
}

export function Card({ children, className = '' }: CardProps) {
  return (
    <div
      className={`bg-[#161b27] border border-[#2a2d3e] rounded-lg p-4 ${className}`}
    >
      {children}
    </div>
  );
}

export function CardTitle({ children }: { children: ReactNode }) {
  return (
    <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wide mb-3">
      {children}
    </h3>
  );
}
