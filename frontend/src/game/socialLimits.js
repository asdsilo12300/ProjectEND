export const COMMENT_CHARACTER_LIMIT = 280

export function commentCharacterCount(value) {
  return String(value ?? '').length
}

export function isCommentWithinLimit(value) {
  return commentCharacterCount(String(value ?? '').trim()) <= COMMENT_CHARACTER_LIMIT
}
