import { useQuery } from '@tanstack/react-query';
import { useEffect, useMemo } from 'react';

import { resourcesApi } from '../services';

const RESOURCE_MEDIA_BLOB_QUERY_KEY = 'classroom-resource-media-blob';

/**
 * For INLINE preview of a lesson resource's bytes — an `<img>`, `<video>`, or a PDF
 * `<iframe>`/`<embed>` — as opposed to a click-triggered download (see `useDownloadResource`).
 *
 * GOTCHA (non-obvious, read before wiring up any resource preview): the download endpoint
 * (`GET /lessons/:id/resources/:resourceId/download`) requires an `Authorization` header. A
 * plain `<img src="...">`/`<video src="...">`/`<iframe src="...">` pointing straight at that
 * backend URL cannot attach that header — the browser makes the request with no auth — so it
 * 401s. This hook instead fetches the bytes through `apiClient` (whose interceptor DOES attach
 * the bearer token) as a `Blob`, then wraps that blob in a same-origin `blob:` object URL, which
 * IS safe to hand to a plain `src` attribute. Every component that renders a resource's bytes
 * inline must go through this hook rather than building a URL by hand.
 *
 * The created object URL is revoked whenever the underlying blob changes and when the component
 * unmounts, so rendering many of these across a page (e.g. a resource gallery) doesn't leak
 * memory.
 */
export function useAuthenticatedMediaUrl(
  lessonId: string | undefined,
  resourceId: string | undefined,
): { url: string | null; isLoading: boolean; error: unknown } {
  const {
    data: blob,
    isLoading,
    error,
  } = useQuery({
    queryKey: [RESOURCE_MEDIA_BLOB_QUERY_KEY, lessonId, resourceId],
    queryFn: () => resourcesApi.download(lessonId as string, resourceId as string),
    enabled: Boolean(lessonId) && Boolean(resourceId),
  });

  // Derived during render (memoized on `blob`'s identity) rather than via a `useEffect` +
  // `useState` pair — react-query only ever hands back a new `Blob` reference when the bytes
  // actually change, so this only (re)allocates an object URL when it needs to.
  const url = useMemo(() => (blob ? URL.createObjectURL(blob) : null), [blob]);

  useEffect(() => {
    // Cleanup-only effect: runs before the next `url` is committed (blob changed) and on
    // unmount — either way, `url` here is always the *previous* one, safe to revoke.
    return () => {
      if (url) URL.revokeObjectURL(url);
    };
  }, [url]);

  return { url, isLoading, error };
}
