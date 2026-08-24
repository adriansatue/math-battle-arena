import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createSupabaseMock } from '../helpers/supabase'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireAdmin } from '@/lib/supabase/admin-guard'
import { cleanupInactiveBattles } from '@/lib/game/battle-cleanup'
import { GET } from '@/app/api/admin/dashboard/route'

vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: vi.fn() }))
vi.mock('@/lib/supabase/admin-guard', () => ({ requireAdmin: vi.fn() }))
vi.mock('@/lib/game/battle-cleanup', () => ({ cleanupInactiveBattles: vi.fn() }))

const emptyFromResults = Array.from({ length: 13 }, () => ({ data: [], error: null }))

function dashboardRequest(query = '') {
  return new Request(`http://test.local/api/admin/dashboard${query}`)
}

describe('/api/admin/dashboard', () => {
  beforeEach(() => {
    vi.mocked(requireAdmin).mockReset()
    vi.mocked(createAdminClient).mockReset()
    vi.mocked(cleanupInactiveBattles).mockReset()
  })

  it('requires an administrator', async () => {
    vi.mocked(requireAdmin).mockResolvedValue(null)

    const response = await GET(dashboardRequest())

    expect(response.status).toBe(403)
    expect(createAdminClient).not.toHaveBeenCalled()
  })

  it('is read-only and returns exact RPC metrics with a refresh timestamp', async () => {
    vi.mocked(requireAdmin).mockResolvedValue({ id: 'admin-1' } as never)
    const metrics = {
      summary: { totalUsers: 42, flaggedAnswers: 3 },
      alerts: { staleActiveBattles: 2, staleWaitingBattles: 1 },
      trends: {
        current: { battles: 20, finishedBattles: 18, answers: 200 },
        previous: { battles: 10, finishedBattles: 8, answers: 100 },
      },
      funnel: [{ eventName: 'lobby_viewed', players: 15 }],
    }
    const playerPage = {
      total: 1,
      players: [{
        id: 'player-1', username: 'Ada', level: 4, rankTitle: 'Solver', totalPoints: 900,
        pointsBalance: 300, rating: 1016, profileWins: 2, profileLosses: 1,
        battlesPlayed: 3, pvpBattles: 3, botBattles: 0, practiceBattles: 0,
        answers: 30, accuracy: 80, avgResponseMs: 1200, flaggedAnswers: 3,
        cardsOwned: 2, lastPlayedAt: '2026-08-24T12:00:00.000Z',
      }],
    }
    const admin = createSupabaseMock({
      fromResults: emptyFromResults,
      rpcResults: [
        { data: metrics, error: null },
        { data: playerPage, error: null },
      ],
    })
    vi.mocked(createAdminClient).mockReturnValue(admin as never)

    const response = await GET(dashboardRequest('?search=Ada&attention=true&sort=flaggedAnswers&page=1'))
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(cleanupInactiveBattles).not.toHaveBeenCalled()
    expect(body.refreshedAt).toEqual(expect.any(String))
    expect(body.summary.totalUsers).toBe(42)
    expect(body.alerts.staleActiveBattles).toBe(2)
    expect(body.trends.current.battles).toBe(20)
    expect(body.players).toHaveLength(1)
    expect(body.playerPagination.total).toBe(1)
    expect(admin.rpc).toHaveBeenNthCalledWith(2, 'get_admin_dashboard_players', {
      p_search: 'Ada',
      p_attention_only: true,
      p_sort: 'flaggedAnswers',
      p_direction: 'desc',
      p_page: 1,
      p_page_size: 20,
    })
  })

  it('normalizes unsupported sort, direction, and page parameters', async () => {
    vi.mocked(requireAdmin).mockResolvedValue({ id: 'admin-1' } as never)
    const admin = createSupabaseMock({
      fromResults: emptyFromResults,
      rpcResults: [
        { data: null, error: { message: 'migration not applied' } },
        { data: null, error: { message: 'migration not applied' } },
      ],
    })
    vi.mocked(createAdminClient).mockReturnValue(admin as never)

    const response = await GET(dashboardRequest('?sort=unsafe&direction=sideways&page=-8'))
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.playerPagination).toMatchObject({
      page: 1,
      sort: 'lastPlayedAt',
      direction: 'desc',
    })
    expect(admin.rpc).toHaveBeenNthCalledWith(2, 'get_admin_dashboard_players', expect.objectContaining({
      p_sort: 'lastPlayedAt',
      p_direction: 'desc',
      p_page: 1,
    }))
  })
})
