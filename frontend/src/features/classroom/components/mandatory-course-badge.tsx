import { ShieldCheck } from 'lucide-react';

import { Badge } from '@/components/ui/badge';

function MandatoryCourseBadge({ className }: { className?: string }) {
  return (
    <Badge variant="warning" className={className}>
      <ShieldCheck className="size-3.5" aria-hidden /> Mandatory Training
    </Badge>
  );
}

export { MandatoryCourseBadge };
