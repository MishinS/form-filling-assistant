## 1. Prune

- [x] 1.1 Per-file keep list per design D1/D2 applied by the pruning script;
  emptied files deleted. Proven by: script report — every keep entry matched at
  least one test.
- [x] 1.2 Leftover unused imports/helpers removed. Proven by:
  `npx tsc --noEmit --noUnusedLocals` reports nothing in `*.test.ts`.

## 2. Verify

- [x] 2.1 `npx vitest run` green; count and duration recorded. Proven by: Vitest
  summary — 74 files, 266 passed, 26.6 s (was 90 / 740 / 33 s; the wall time is
  mostly module import, tests themselves 3.3 s → 1.9 s).
- [x] 2.2 `npx tsc --noEmit` clean. Proven by: empty output.
- [x] 2.3 Coverage re-measured against the baseline (lines 85.6 %, branches
  81.1 %); per-file drops reviewed, critical gaps restored. Proven by: coverage
  summary before/after — lines 74.7 %, branches 63.5 %; six critical tests
  restored (see design D4).

## 3. Rule

- [x] 3.1 `TESTING.md` at the repo root: what earns a test, what does not. Proven
  by: manual read.
