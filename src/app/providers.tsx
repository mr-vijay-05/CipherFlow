import React from 'react';
import { ToastProvider } from '../hooks/useToast';

export const AppProviders: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  return (
    <ToastProvider>
      {children}
    </ToastProvider>
  );
};
