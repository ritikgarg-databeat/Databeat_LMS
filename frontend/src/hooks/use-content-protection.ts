import { useEffect } from 'react';

export type ProtectedAction = 'SCREENSHOT_ATTEMPT' | 'PRINT_ATTEMPT' | 'COPY_ATTEMPT';

export function useContentProtection(enabled: boolean, onBlocked?: (action: ProtectedAction) => void) {
  useEffect(() => {
    if (!enabled) return;

    const block = (event: Event, action: ProtectedAction) => {
      event.preventDefault();
      onBlocked?.(action);
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      const key = event.key.toLowerCase();
      if (event.key === 'PrintScreen') {
        block(event, 'SCREENSHOT_ATTEMPT');
        void navigator.clipboard?.writeText('').catch(() => undefined);
      } else if (
        (event.metaKey || event.ctrlKey) &&
        event.shiftKey &&
        (key === 's' || ['3', '4', '5'].includes(key))
      ) {
        block(event, 'SCREENSHOT_ATTEMPT');
      } else if ((event.ctrlKey || event.metaKey) && key === 'p') {
        block(event, 'PRINT_ATTEMPT');
      } else if ((event.ctrlKey || event.metaKey) && ['c', 'x', 's'].includes(key)) {
        block(event, 'COPY_ATTEMPT');
      }
    };
    const handleCopy = (event: ClipboardEvent) => block(event, 'COPY_ATTEMPT');
    const handleContextMenu = (event: MouseEvent) => block(event, 'COPY_ATTEMPT');
    const handleBeforePrint = (event: Event) => block(event, 'PRINT_ATTEMPT');

    document.addEventListener('keydown', handleKeyDown, true);
    document.addEventListener('copy', handleCopy, true);
    document.addEventListener('cut', handleCopy, true);
    document.addEventListener('contextmenu', handleContextMenu, true);
    window.addEventListener('beforeprint', handleBeforePrint);
    return () => {
      document.removeEventListener('keydown', handleKeyDown, true);
      document.removeEventListener('copy', handleCopy, true);
      document.removeEventListener('cut', handleCopy, true);
      document.removeEventListener('contextmenu', handleContextMenu, true);
      window.removeEventListener('beforeprint', handleBeforePrint);
    };
  }, [enabled, onBlocked]);
}
