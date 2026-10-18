import { useCallback, useEffect, useRef, useState } from 'react';

export const lanActivityScope = (projectId: string, sessionId?: string) => JSON.stringify([projectId, sessionId || '']);

/** A bounded, quiet activity feed; it never queues updates for another project. */
export function useLanActivity(scope: string | null) {
  const nextId = useRef(0);
  const [queue, setQueue] = useState<{ id: number; scope: string; text: string }[]>([]);
  useEffect(() => {
    // Session state and its first incoming update may arrive in one batch.
    // Keep entries already belonging to the new session instead of clearing all.
    setQueue(current => current.every(entry => entry.scope === scope)
      ? current : current.filter(entry => entry.scope === scope));
  }, [scope]);
  const activity = queue[0]?.scope === scope ? queue[0] : undefined;
  const showActivity = useCallback((text: string, currentScope: string) => {
    const item = { id: ++nextId.current, scope: currentScope, text };
    setQueue(previous => {
      const current = previous.filter(entry => entry.scope === currentScope);
      // Preserve the visible message and only the most recent pending updates.
      return current.length >= 5 ? [current[0], ...current.slice(-3), item] : [...current, item];
    });
  }, []);
  useEffect(() => {
    if (!activity) return;
    const timer = window.setTimeout(() => {
      setQueue(current => current.filter(entry => entry.id !== activity.id));
    }, 4000);
    return () => window.clearTimeout(timer);
  }, [activity]);
  return { activity, showActivity };
}
