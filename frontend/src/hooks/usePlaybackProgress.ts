import { useCallback, useEffect, useRef } from 'react'
import {
  getPlaybackProgress,
  savePlaybackProgress,
} from '@/services/mixedAudioService'
import type { PlayerContext } from '@/types/api'

const MOCK_RESUME_STORAGE_KEY = 'pf_mock_playback_progress'
const SAVE_INTERVAL_MS = 8000

function isMockMode(): boolean {
  return import.meta.env.VITE_USE_MOCK === 'true'
}

function readMockProgress(assetId: string, context: PlayerContext, duration: number): number {
  try {
    const raw = localStorage.getItem(MOCK_RESUME_STORAGE_KEY)
    if (raw) {
      const map = JSON.parse(raw) as Record<string, Record<string, number>>
      const saved = map[assetId]?.[context]
      if (typeof saved === 'number' && saved >= 0) {
        return Math.min(saved, Math.max(duration - 1, 0))
      }
    }
  } catch {
    /* ignore corrupt mock cache */
  }
  if (context === 'global' && duration > 0) {
    return Math.floor(duration * 0.12)
  }
  return 0
}

function persistMockProgress(assetId: string, context: PlayerContext, seconds: number) {
  try {
    const raw = localStorage.getItem(MOCK_RESUME_STORAGE_KEY)
    const map = raw ? (JSON.parse(raw) as Record<string, Record<string, number>>) : {}
    map[assetId] = { ...(map[assetId] ?? {}), [context]: seconds }
    localStorage.setItem(MOCK_RESUME_STORAGE_KEY, JSON.stringify(map))
  } catch {
    /* ignore quota errors in mock */
  }
}

export function usePlaybackProgress(
  mixedAudioId: string | null | undefined,
  context: PlayerContext,
  duration: number,
) {
  const lastSavedRef = useRef(0)
  const pendingRef = useRef<number | null>(null)
  const timerRef = useRef<number | null>(null)

  const flushSave = useCallback(
    async (positionSeconds: number, totalDuration?: number) => {
      if (!mixedAudioId || positionSeconds < 0) return
      if (isMockMode()) {
        persistMockProgress(mixedAudioId, context, positionSeconds)
        return
      }
      try {
        await savePlaybackProgress(mixedAudioId, {
          player_context: context,
          position_seconds: positionSeconds,
          duration_seconds: totalDuration ?? duration,
        })
        lastSavedRef.current = Date.now()
      } catch {
        /* non-blocking progress sync */
      }
    },
    [context, duration, mixedAudioId],
  )

  const scheduleSave = useCallback(
    (positionSeconds: number, totalDuration?: number, immediate = false) => {
      pendingRef.current = positionSeconds
      if (timerRef.current !== null) {
        window.clearTimeout(timerRef.current)
        timerRef.current = null
      }
      if (immediate) {
        void flushSave(positionSeconds, totalDuration)
        pendingRef.current = null
        return
      }
      const elapsed = Date.now() - lastSavedRef.current
      const delay = Math.max(0, SAVE_INTERVAL_MS - elapsed)
      timerRef.current = window.setTimeout(() => {
        const pending = pendingRef.current
        pendingRef.current = null
        timerRef.current = null
        if (pending !== null) {
          void flushSave(pending, totalDuration)
        }
      }, delay)
    },
    [flushSave],
  )

  const loadProgress = useCallback(async (): Promise<number> => {
    if (!mixedAudioId) return 0
    if (isMockMode()) {
      const primary = readMockProgress(mixedAudioId, context, duration)
      if (primary > 0 || context !== 'global') return primary
      return readMockProgress(mixedAudioId, 'inline', duration)
    }
    try {
      const data = await getPlaybackProgress(mixedAudioId, context)
      if (data) {
        const max = data.duration_seconds ?? duration
        return Math.min(Math.floor(data.position_seconds), Math.max(max - 1, 0))
      }
      if (context !== 'global') return 0
      const legacy = await getPlaybackProgress(mixedAudioId, 'inline')
      if (!legacy) return 0
      const max = legacy.duration_seconds ?? duration
      return Math.min(Math.floor(legacy.position_seconds), Math.max(max - 1, 0))
    } catch {
      return 0
    }
  }, [context, duration, mixedAudioId])

  useEffect(() => {
    return () => {
      if (timerRef.current !== null) {
        window.clearTimeout(timerRef.current)
      }
      const pending = pendingRef.current
      if (pending !== null && mixedAudioId) {
        void flushSave(pending)
      }
    }
  }, [flushSave, mixedAudioId])

  return {
    loadProgress,
    scheduleSave,
    flushSave,
  }
}
