import React from 'react';
import { ShieldCheck, Lock, Users, Key } from 'lucide-react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export interface BadgeProps {
  children?: React.ReactNode;
  variant?: 'encrypted' | 'shared' | 'locked' | 'success' | 'warning' | 'neutral' | 'outline' | 'tag';
  size?: 'sm' | 'md';
  icon?: React.ReactNode;
  className?: string;
}

export const Badge: React.FC<BadgeProps> = ({
  children,
  variant = 'neutral',
  size = 'md',
  icon,
  className,
}) => {
  const sizeClasses = {
    sm: 'text-[11px] px-2 py-0.5 font-medium gap-1',
    md: 'text-xs px-2.5 py-1 font-medium gap-1.5',
  };

  const variantMap = {
    encrypted: 'bg-emerald-50 text-emerald-700 border-emerald-200/80',
    shared: 'bg-blue-50 text-blue-700 border-blue-200/80',
    locked: 'bg-amber-50 text-amber-700 border-amber-200/80',
    success: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    warning: 'bg-amber-50 text-amber-700 border-amber-200',
    neutral: 'bg-slate-100 text-slate-700 border-slate-200',
    outline: 'bg-white text-slate-600 border-slate-200',
    tag: 'bg-blue-50/60 text-blue-600 border-blue-100 hover:bg-blue-100/70 cursor-pointer',
  };

  const defaultIcon = () => {
    switch (variant) {
      case 'encrypted':
        return <Lock className="w-3 h-3 text-emerald-600 shrink-0" />;
      case 'shared':
        return <Users className="w-3 h-3 text-blue-600 shrink-0" />;
      case 'locked':
        return <Key className="w-3 h-3 text-amber-600 shrink-0" />;
      default:
        return null;
    }
  };

  return (
    <span
      className={twMerge(
        clsx(
          'inline-flex items-center rounded-lg border font-medium transition-colors select-none',
          sizeClasses[size],
          variantMap[variant],
          className
        )
      )}
    >
      {icon ?? defaultIcon()}
      {children}
    </span>
  );
};
