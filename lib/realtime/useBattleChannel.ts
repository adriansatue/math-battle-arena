'use client'

import { useEffect, useRef, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { RealtimeChannel } from '@supabase/supabase-js'

export interface BattleEvent {
  type:    'question:new' | 'answer:result' | 'turn:change' | 'battle:end' | 'player:joined'
  payload: Record<string, unknown>
}

interface UseBattleChannelOptions {
  battleId:   string
  userId:     string
  username:   string
  onEvent:    (event: BattleEvent) => void
  onPresence?: (users: PresenceUser[]) => void
}

export interface PresenceUser {
  user_id:  string
  username: string
  online:   boolean
}

export function useBattleChannel({
  battleId,
  userId,
  username,
  onEvent,
  onPresence,
}: UseBattleChannelOptions) {
  const channelRef    = useRef<RealtimeChannel | null>(null)
  const onEventRef    = useRef(onEvent)
  const onPresenceRef = useRef(onPresence)
  const subscribeRef  = useRef<() => void>(() => {})

  // Keep refs up to date without triggering re-renders
  useEffect(() => { onEventRef.current    = onEvent    }, [onEvent])
  useEffect(() => { onPresenceRef.current = onPresence }, [onPresence])

  const subscribe = useCallback(() => {
    const supabase = createClient()

    const channel = supabase.channel(`battle:${battleId}`, {
      config: { presence: { key: userId } }
    })

    // ── BROADCAST: low-latency game events ────────
    channel.on('broadcast', { event: '*' }, ({ event, payload }) => {
      onEventRef.current({
        type:    event as BattleEvent['type'],
        payload: payload as Record<string, unknown>,
      })
    })

    // ── PRESENCE SYNC: full state update ──────────
    channel.on('presence', { event: 'sync' }, () => {
      const state = channel.presenceState<{ username: string }>()
      const users: PresenceUser[] = Object.entries(state).map(([uid, presences]) => ({
        user_id:  uid,
        username: presences[0]?.username ?? 'Unknown',
        online:   true,
      }))
      onPresenceRef.current?.(users)
    })

    // ── PRESENCE LEAVE: mark disconnected players ─
    channel.on('presence', { event: 'leave' }, ({ leftPresences }) => {
      const state = channel.presenceState<{ username: string }>()
      const users: PresenceUser[] = Object.entries(state).map(([uid, presences]) => ({
        user_id:  uid,
        username: presences[0]?.username ?? 'Unknown',
        online:   true,
      }))
      leftPresences.forEach((p: Record<string, unknown>) => {
        users.push({
          user_id:  p.presence_ref as string,
          username: 'Unknown',
          online:   false,
        })
      })
      onPresenceRef.current?.(users)
    })

    // ── SUBSCRIBE & TRACK PRESENCE ────────────────
    channel.subscribe(async (status) => {
      if (status === 'SUBSCRIBED') {
        await channel.track({ username, user_id: userId })
      }
      if (status === 'CLOSED' || status === 'CHANNEL_ERROR') {
        // Auto-reconnect using ref to avoid circular dependency
        setTimeout(() => subscribeRef.current(), 2000)
      }
    })

    channelRef.current = channel
    return channel
  }, [battleId, userId, username])

  // Keep subscribeRef in sync with latest subscribe
  useEffect(() => { subscribeRef.current = subscribe }, [subscribe])

  // Subscribe on mount, cleanup on unmount
  useEffect(() => {
    const channel = subscribe()
    return () => { channel.unsubscribe() }
  }, [subscribe])

  // Broadcast helper for sending events to opponent
  const broadcast = useCallback(async (
    event:   string,
    payload: Record<string, unknown>
  ) => {
    if (channelRef.current) {
      await channelRef.current.send({
        type:    'broadcast',
        event,
        payload,
      })
    }
  }, [])

  return { broadcast }
}