import { vi } from 'vitest'

type QueryResult<T = unknown> = {
  data?: T
  error?: { code?: string; message: string } | null
}

type QueryMock = QueryResult & {
  select: ReturnType<typeof vi.fn>
  eq: ReturnType<typeof vi.fn>
  neq: ReturnType<typeof vi.fn>
  gt: ReturnType<typeof vi.fn>
  gte: ReturnType<typeof vi.fn>
  is: ReturnType<typeof vi.fn>
  in: ReturnType<typeof vi.fn>
  not: ReturnType<typeof vi.fn>
  or: ReturnType<typeof vi.fn>
  order: ReturnType<typeof vi.fn>
  limit: ReturnType<typeof vi.fn>
  single: ReturnType<typeof vi.fn>
  insert: ReturnType<typeof vi.fn>
  update: ReturnType<typeof vi.fn>
  upsert: ReturnType<typeof vi.fn>
  delete: ReturnType<typeof vi.fn>
  then: Promise<QueryResult>['then']
}

export type SupabaseMock = {
  auth: {
    getUser: ReturnType<typeof vi.fn>
  }
  from: ReturnType<typeof vi.fn>
  rpc: ReturnType<typeof vi.fn>
}

export function jsonRequest(body: unknown): Request {
  return new Request('http://test.local', {
    method: 'POST',
    body:   JSON.stringify(body),
  })
}

export function createSupabaseMock(options: {
  user?: { id: string } | null
  authError?: unknown
  fromResults?: QueryResult[]
  rpcResults?: QueryResult[]
} = {}): SupabaseMock {
  const fromResults = [...(options.fromResults ?? [])]
  const rpcResults = [...(options.rpcResults ?? [])]

  return {
    auth: {
      getUser: vi.fn(async () => ({
        data:  { user: options.user ?? { id: 'user-1' } },
        error: options.authError ?? null,
      })),
    },
    from: vi.fn(() => createQueryMock(fromResults.shift() ?? { data: null, error: null })),
    rpc: vi.fn(async () => rpcResults.shift() ?? { data: null, error: null }),
  }
}

function createQueryMock(result: QueryResult): QueryMock {
  const query = {
    data:  result.data,
    error: result.error ?? null,
  } as QueryMock

  const chain = () => query
  query.select = vi.fn(chain)
  query.eq = vi.fn(chain)
  query.neq = vi.fn(chain)
  query.gt = vi.fn(chain)
  query.gte = vi.fn(chain)
  query.is = vi.fn(chain)
  query.in = vi.fn(chain)
  query.not = vi.fn(chain)
  query.or = vi.fn(chain)
  query.order = vi.fn(chain)
  query.limit = vi.fn(chain)
  query.insert = vi.fn(chain)
  query.update = vi.fn(chain)
  query.upsert = vi.fn(chain)
  query.delete = vi.fn(chain)
  query.single = vi.fn(async () => result)
  query.then = Promise.resolve(result).then.bind(Promise.resolve(result))

  return query
}
