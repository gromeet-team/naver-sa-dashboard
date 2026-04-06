interface BadgeProps {
  variant: 'red' | 'yellow' | 'green' | 'gray' | 'blue';
  children: React.ReactNode;
}

const variantClasses: Record<BadgeProps['variant'], string> = {
  red: 'bg-red-900/40 text-red-400 border border-red-800',
  yellow: 'bg-yellow-900/40 text-yellow-400 border border-yellow-800',
  green: 'bg-green-900/40 text-green-400 border border-green-800',
  gray: 'bg-gray-800 text-gray-400 border border-gray-700',
  blue: 'bg-blue-900/40 text-blue-400 border border-blue-800',
};

export function Badge({ variant, children }: BadgeProps) {
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${variantClasses[variant]}`}
    >
      {children}
    </span>
  );
}
