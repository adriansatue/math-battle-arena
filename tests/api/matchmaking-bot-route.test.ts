import { describe, expect, it, vi } from 'vitest'
import { getOrCreateBot } from '@/app/api/matchmaking/bot/route'

function adminMock(
  listResults: unknown[],
  createResult: { data: { user: unknown }; error: { message: string } | null } = {
    data: { user: null },
    error: null,
  }
) {
  const upsert = vi.fn(async () => ({ data: null, error: null }))
  return {
    auth: {
      admin: {
        listUsers: vi.fn(async () => listResults.shift()),
        createUser: vi.fn(async () => createResult),
      },
    },
    from: vi.fn(() => ({ upsert })),
    upsert,
  }
}

describe('bot auth identity', () => {
  it('finds an existing bot beyond the first Auth page', async () => {
    const firstPage = Array.from({ length: 1000 }, (_, index) => ({
      id: `user-${index}`,
      email: `player-${index}@example.com`,
    }))
    const admin = adminMock([
      { data: { users: firstPage }, error: null },
      { data: { users: [{ id: 'bot-medium', email: 'bot-medium@mathbattle.internal' }] }, error: null },
    ])

    await expect(getOrCreateBot(admin as never, 'medium')).resolves.toBe('bot-medium')
    expect(admin.auth.admin.listUsers).toHaveBeenNthCalledWith(1, { page: 1, perPage: 1000 })
    expect(admin.auth.admin.listUsers).toHaveBeenNthCalledWith(2, { page: 2, perPage: 1000 })
    expect(admin.auth.admin.createUser).not.toHaveBeenCalled()
    expect(admin.upsert).toHaveBeenCalledWith(expect.objectContaining({
      id: 'bot-medium',
      rank_title: 'AI Challenger',
    }), { onConflict: 'id' })
  })

  it('reuses a bot created concurrently after a duplicate-email response', async () => {
    const admin = adminMock([
      { data: { users: [] }, error: null },
      { data: { users: [{ id: 'bot-hard', email: 'bot-hard@mathbattle.internal' }] }, error: null },
    ], {
      data: { user: null },
      error: { message: 'A user with this email address has already been registered' },
    })

    await expect(getOrCreateBot(admin as never, 'hard')).resolves.toBe('bot-hard')
    expect(admin.auth.admin.createUser).toHaveBeenCalledOnce()
    expect(admin.auth.admin.listUsers).toHaveBeenCalledTimes(2)
  })
})