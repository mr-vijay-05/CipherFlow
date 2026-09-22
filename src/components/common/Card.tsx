import React from 'react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  variant?: 'default' | 'subtle' | 'elevated' | 'bordered';
  padding?: 'none' | 'sm' | 'md' | 'lg';
}

export const Card: React.FC<CardProps> = ({
  children,
  className,
  variant = 'default',
  padding = 'md',
  ...props
}) => {
  const variantClasses = {
    default: 'bg-white border border-[#e8edf3] shadow-card rounded-2xl',
    subtle: 'bg-slate-50/70 border border-slate-200/80 rounded-2xl',
    elevated: 'bg-white border border-[#e8edf3] shadow-card-hover rounded-2xl',
    bordered: 'bg-white border border-slate-200 rounded-2xl',
  };

  const paddingClasses = {
    none: 'p-0',
    sm: 'p-4',
    md: 'p-5 md:p-6',
    lg: 'p-6 md:p-8',
  };

  return (
    <div
      className={twMerge(clsx(variantClasses[variant], paddingClasses[padding], 'transition-all', className))}
      {...props}
    >
      {children}
    </div>
  );
};
