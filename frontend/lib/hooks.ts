'use client';

import useSWR from 'swr';
import { useEffect } from 'react';
import { api, resolveUrl } from './api';
import type { LiveMatch } from './types';

export function useLiveMatches() {
  const { data, mutate, isLoading } = useSWR<LiveMatch[]>(`/matches/live`, () => api.fetchLiveMatches());

  useEffect(() => {
    const source = new EventSource(resolveUrl('/live/stream'));
    source.onmessage = (event) => {
      try {
        const parsed = JSON.parse(event.data) as LiveMatch[];
        mutate(parsed, { revalidate: false });
      } catch (error) {
        console.error('Failed to parse live payload', error);
      }
    };
    return () => {
      source.close();
    };
  }, [mutate]);

  return { matches: data ?? [], isLoading: isLoading && !data };
}
