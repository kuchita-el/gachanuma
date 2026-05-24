export const buildArtifacts = [
  '**/.next/**',
  '**/out/**',
  '**/coverage/**',
]

export const claudeWorktrees = [
  '**/.claude/worktrees/**',
]

export const all = [
  ...buildArtifacts,
  ...claudeWorktrees,
]
