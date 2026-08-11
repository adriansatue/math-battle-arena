type SupabaseErrorLike = {
  code?: string
  message?: string
} | null | undefined

export function isUniqueViolation(error: SupabaseErrorLike): boolean {
  return error?.code === '23505' || error?.message?.toLowerCase().includes('duplicate key') === true
}
