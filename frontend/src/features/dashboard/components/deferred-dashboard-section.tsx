import { useEffect, useRef, useState, type ReactNode } from 'react';

import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

interface DeferredDashboardSectionProps {
  children: ReactNode;
  placeholderClassName?: string;
}

/** Mounts query-heavy secondary widgets only shortly before they enter the viewport. */
function DeferredDashboardSection({ children, placeholderClassName }: DeferredDashboardSectionProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isVisible, setIsVisible] = useState(
    () => typeof window === 'undefined' || !('IntersectionObserver' in window),
  );

  useEffect(() => {
    if (isVisible) return undefined;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry?.isIntersecting) return;
        setIsVisible(true);
        observer.disconnect();
      },
      { rootMargin: '400px 0px' },
    );
    if (containerRef.current) observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, [isVisible]);

  return (
    <div ref={containerRef}>
      {isVisible ? children : <Skeleton aria-hidden className={cn('h-48 w-full', placeholderClassName)} />}
    </div>
  );
}

export { DeferredDashboardSection };
