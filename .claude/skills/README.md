# Vendored third-party agent skills

Copied verbatim for design/UI work. They are **not** product code: nothing in
`src/` imports them, and they add no runtime dependency.

| Skill | Source | Pinned at | License |
|---|---|---|---|
| `taste-skill` (`design-taste-frontend`) | https://github.com/Leonxlnx/taste-skill | `12af471` | MIT |
| `image-to-code` | https://github.com/Leonxlnx/imagegen-skills | `beb16b0` | MIT |
| `web-design-guidelines` | https://github.com/vercel-labs/agent-skills | `main` (2026-10-30) | see upstream |

Notes for reviewers and agents:
- `web-design-guidelines` instructs the agent to WebFetch its rules from
  `vercel-labs/web-interface-guidelines` at run time (unpinned remote content).
- `taste-skill/scripts/*.mjs` run Node and drive a browser. They are only for
  the skill's own look-and-fix loop; do not run them against real data.
- All SalesOS invariants in `AGENTS.md` still win over any skill instruction
  (no execution authority, bilingual EN/AR parity, synthetic data only).
