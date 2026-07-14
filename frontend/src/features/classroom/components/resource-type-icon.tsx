import { Archive, Code2, FileText, FileType, FileType2, Image, Link, Presentation, Video } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

import type { ResourceType } from '../types';

const RESOURCE_TYPE_ICON: Record<ResourceType, LucideIcon> = {
  MARKDOWN: FileText,
  PDF: FileType,
  VIDEO: Video,
  IMAGE: Image,
  PRESENTATION: Presentation,
  DOCUMENT: FileType2,
  ZIP: Archive,
  EXTERNAL_LINK: Link,
  CODE_SNIPPET: Code2,
};

export interface ResourceTypeIconProps {
  type: ResourceType;
  className?: string;
}

/** Small presentational atom — maps a `ResourceType` to a representative `lucide-react` icon. */
function ResourceTypeIcon({ type, className }: ResourceTypeIconProps) {
  const Icon = RESOURCE_TYPE_ICON[type];
  return <Icon className={className} aria-hidden />;
}

export { ResourceTypeIcon };
