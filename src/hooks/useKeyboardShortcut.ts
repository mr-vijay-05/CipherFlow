import { useEffect } from 'react';

export function useKeyboardShortcut(key: string, callback: () => void, ctrlOrCmd: boolean = true) {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const isCtrlOrCmdPressed = ctrlOrCmd ? (e.ctrlKey || e.metaKey) : true;
      if (isCtrlOrCmdPressed && e.key.toLowerCase() === key.toLowerCase()) {
        e.preventDefault();
        callback();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [key, callback, ctrlOrCmd]);
}
