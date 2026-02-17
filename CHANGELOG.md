# Changelog

All notable changes to Linejam.

# 1.0.0 (2026-01-25)

### Bug Fixes

- **accessibility:** address PR review feedback ([a342c85](https://github.com/misty-step/linejam/commit/a342c8599eb8c52214ad9e3d916f94a627f70501))
- add GITLEAKS_LICENSE env var to secret scanning job ([c2d8c95](https://github.com/misty-step/linejam/commit/c2d8c950eb87049c8cdafec4d3df0257df61d58d))
- add missing semantic color tokens to design system ([2afd7cf](https://github.com/misty-step/linejam/commit/2afd7cf6f45f94ce2be1033dc00cf772415aedf2))
- add pull-requests write permission to gitleaks job ([9315a0b](https://github.com/misty-step/linejam/commit/9315a0bd1daab185945d757d9263c6dabf25df79))
- address PR review comments for auth and observability ([bb9a264](https://github.com/misty-step/linejam/commit/bb9a2647812f797b843e471a27428ac41936773c))
- apply custom gitleaks config in CI and pre-commit hooks ([d4de3e7](https://github.com/misty-step/linejam/commit/d4de3e701d0dc577b01bacf8d3571deb763a602f))
- **build:** add convex deploy to build script ([1fda1da](https://github.com/misty-step/linejam/commit/1fda1daab91707252072ec47e2b9ad1e53dd8680))
- **ci:** add security audit to quality gates pipeline ([#108](https://github.com/misty-step/linejam/issues/108)) ([772ecb1](https://github.com/misty-step/linejam/commit/772ecb19d8b9732da668dfe6e216c2be3cda5a0c)), closes [#36](https://github.com/misty-step/linejam/issues/36) [#98](https://github.com/misty-step/linejam/issues/98)
- configure Convex deploy for Vercel builds ([60de0fe](https://github.com/misty-step/linejam/commit/60de0fe56973fce01b0e909624c456e3b1762007))
- configure coverage badges and repair CI build ([b252533](https://github.com/misty-step/linejam/commit/b2525334000827b3684da1f53bbd4c87c10342df))
- eliminate race condition in round submission validation ([#64](https://github.com/misty-step/linejam/issues/64)) ([152c68a](https://github.com/misty-step/linejam/commit/152c68a15cfbd8cc69189e4a8154c01548d72d94))
- **error:** consolidate duplicate captureError implementations ([#52](https://github.com/misty-step/linejam/issues/52)) ([#72](https://github.com/misty-step/linejam/issues/72)) ([326ab8d](https://github.com/misty-step/linejam/commit/326ab8d7cd4c5d78aec528dfcd6d73caa66abafa))
- escape apostrophe in quote ([371b919](https://github.com/misty-step/linejam/commit/371b91924b0b6dcbcbb50ac98203a9a4fbdd0bf3))
- externalize Pino packages to resolve build errors ([85613b2](https://github.com/misty-step/linejam/commit/85613b24487fe6b48412e12fdf79d9be66518286))
- **game:** unify reader assignment algorithm ([#114](https://github.com/misty-step/linejam/issues/114)) ([c767ac3](https://github.com/misty-step/linejam/commit/c767ac3e0fad9023643b80f118778393e09a75f4)), closes [#89](https://github.com/misty-step/linejam/issues/89) [#89](https://github.com/misty-step/linejam/issues/89) [#89](https://github.com/misty-step/linejam/issues/89)
- guest token cross-platform compatibility and deployment ([f0a4cfb](https://github.com/misty-step/linejam/commit/f0a4cfb7d9965631e15de35ce7d08d5d0de0090b))
- harden health endpoint for ci ([fde3631](https://github.com/misty-step/linejam/commit/fde36313aaf0e8dd58d9a699d58d9af234738ca5))
- **hooks:** remove convex deploy from pre-push hooks ([0de1ae1](https://github.com/misty-step/linejam/commit/0de1ae141b0a5a73302a8147e0c56a4492e5f2fd))
- **logging:** wire structured logger in all catch blocks ([6de2615](https://github.com/misty-step/linejam/commit/6de261500f82f79a2689764cb85a331e1eae9520))
- make WritingScreen textarea visible with focus states ([9fe4ec9](https://github.com/misty-step/linejam/commit/9fe4ec9d283fac2cdc605b92df0d1311d506d4ca)), closes [#1](https://github.com/misty-step/linejam/issues/1)
- prevent auto-advancing to new game before poems are read ([#70](https://github.com/misty-step/linejam/issues/70)) ([d98e84a](https://github.com/misty-step/linejam/commit/d98e84a436b30f2d70a4071f5981963f146fa838))
- replace browser alert with inline Alert in WritingScreen ([2e1f8c1](https://github.com/misty-step/linejam/commit/2e1f8c1b6528375ef849a24c993081d143498f09))
- replace Node.js crypto with Web Crypto API in Convex runtime ([20452ef](https://github.com/misty-step/linejam/commit/20452ef96433ec62cf9b7721008ec43948c83fc0))
- require auth for getRoom query ([#121](https://github.com/misty-step/linejam/issues/121)) ([acc8037](https://github.com/misty-step/linejam/commit/acc80370671df38b974163a57d9bc6faa290a60c))
- resolve CI failures (pnpm version conflict + badge 409) ([7802dff](https://github.com/misty-step/linejam/commit/7802dffc42c1533597ec6044d45317d68bfd8e69))
- resolve P1 and P2 code review feedback ([9e72e46](https://github.com/misty-step/linejam/commit/9e72e46d616f99d310ac514487af1373b163a2de))
- **security:** add auth check to getRoundProgress query ([#38](https://github.com/misty-step/linejam/issues/38)) ([#117](https://github.com/misty-step/linejam/issues/117)) ([80c03d8](https://github.com/misty-step/linejam/commit/80c03d828f535d7104d84ff82770bb6af9a27831))
- **security:** add length validation to displayName and line text ([#110](https://github.com/misty-step/linejam/issues/110)) ([2782660](https://github.com/misty-step/linejam/commit/27826609a4bd449945b76708280054869150c608)), closes [#83](https://github.com/misty-step/linejam/issues/83) [#83](https://github.com/misty-step/linejam/issues/83) [#83](https://github.com/misty-step/linejam/issues/83)
- **security:** enforce authorization on poem and favorite queries ([28a62e1](https://github.com/misty-step/linejam/commit/28a62e182e9dd2cb073bdcc6ef5b0b3789daef5e))
- **security:** remove legacy guestId fallback to prevent auth bypass ([#22](https://github.com/misty-step/linejam/issues/22)) ([#71](https://github.com/misty-step/linejam/issues/71)) ([cbe719b](https://github.com/misty-step/linejam/commit/cbe719b0e40897254214c49ed3f9c63f7e013323))
- **security:** upgrade @sentry/nextjs to fix CVE-2025-65944 (closes [#36](https://github.com/misty-step/linejam/issues/36)) ([#73](https://github.com/misty-step/linejam/issues/73)) ([934f4fe](https://github.com/misty-step/linejam/commit/934f4fe7e9b6b179a17754cf7b1fb276291c7655))
- **sentry:** add error capture to all catch blocks ([9049e64](https://github.com/misty-step/linejam/commit/9049e64e752cf28fcc5e83b931945c0e7530f69f))
- **test:** mock convex api in health check test to avoid server-only error ([33c051e](https://github.com/misty-step/linejam/commit/33c051ed4cd749d7586220de3fe8605422596e20))
- **test:** use node environment for health check test to resolve server-only error ([d4fb1cf](https://github.com/misty-step/linejam/commit/d4fb1cfb9182005f9e8944143259de3ad3560b44))
- use gh api PATCH for atomic gist badge updates ([9ed59b2](https://github.com/misty-step/linejam/commit/9ed59b2a1ab3eb67ea1dcb455c070357cf1226d6))
- use pnpm for Convex build command ([5ae5289](https://github.com/misty-step/linejam/commit/5ae5289bd2a3fb3361c23e31fcf1386918e7c60d))
- **ux:** host leave lobby button now closes room ([#92](https://github.com/misty-step/linejam/issues/92)) ([#109](https://github.com/misty-step/linejam/issues/109)) ([35abba2](https://github.com/misty-step/linejam/commit/35abba233ab00ea92e0d8b15f5662e87b575087b))

### Features

- add Alert component for inline error display ([e3a02d6](https://github.com/misty-step/linejam/commit/e3a02d670b153e7716706bc44190721db76947e1))
- add ARIA labels to WritingScreen textarea ([3f51907](https://github.com/misty-step/linejam/commit/3f519074898559418686ad650620f15522d53e66))
- add build-time env validation and enhanced health checks ([30397e8](https://github.com/misty-step/linejam/commit/30397e84698728757559e1a6a24bd2f03c47c193))
- add changelog infrastructure with semantic-release ([#127](https://github.com/misty-step/linejam/issues/127)) ([c0de3fa](https://github.com/misty-step/linejam/commit/c0de3fa748f8cb7fe8a5755e6deb1307752d2cce))
- add error feedback deep module ([787bc44](https://github.com/misty-step/linejam/commit/787bc44d02aa8948aeb84b8a15482deb3cb2ef34))
- add error state to Host page ([7244c02](https://github.com/misty-step/linejam/commit/7244c02c9b69909635d651cb2ac3129182d30169))
- add error state to Lobby component ([1b42e6c](https://github.com/misty-step/linejam/commit/1b42e6cf94b0d9bcae567b45b849418a83c464b4))
- add error state to RevealPhase component ([230588a](https://github.com/misty-step/linejam/commit/230588aab2866b42e93c7b4bb5b2a16c38b8d509))
- add hanko stamp to host badge in lobby ([6a6c3ed](https://github.com/misty-step/linejam/commit/6a6c3edcd79e2bc8ce040b6439e090d9b15b01cf))
- add ink seal stamps to WaitingScreen sealed state ([77276d2](https://github.com/misty-step/linejam/commit/77276d21affd827d0b119a20ac56148f2d0d2873))
- add ink stamp press animation to buttons ([dbcc5d5](https://github.com/misty-step/linejam/commit/dbcc5d5394bfe8cbde909b1a6fcc6221c0094714))
- add multi-cycle game architecture with schema updates ([f34b623](https://github.com/misty-step/linejam/commit/f34b6236c661e0089c9f05c81065dd162cc672d7))
- add observability infrastructure ([#126](https://github.com/misty-step/linejam/issues/126)) ([5492b0a](https://github.com/misty-step/linejam/commit/5492b0a32ea983d570b11fcbaeee85585a2eadd1))
- add persimmon tint to shadow design tokens ([14b4e9d](https://github.com/misty-step/linejam/commit/14b4e9dd1dd503c57fd670c7d6e260a36f9b9b16))
- add screen reader live region for validation announcements ([59fd5b5](https://github.com/misty-step/linejam/commit/59fd5b5d8794483ebb6d46d40a8cd5080520fb6e))
- add smooth shadow crushing animation to buttons ([ad028e7](https://github.com/misty-step/linejam/commit/ad028e7b6599d7617c5319931ad250bb6029c2c7))
- add stamp animation to submit button on success ([81fced4](https://github.com/misty-step/linejam/commit/81fced421b1100679d1e529b112ccd2a5c6b3057))
- add Stamp component for Japanese ink seal graphics ([b39d388](https://github.com/misty-step/linejam/commit/b39d3888ee3842bdbaa712bfcd0f0a88b7aa1f1e))
- add submission confirmation state machine ([693f17d](https://github.com/misty-step/linejam/commit/693f17ddbe47a21829b53d3633f81420d6d4db56))
- add word count guidance text to WritingScreen ([cadc70f](https://github.com/misty-step/linejam/commit/cadc70f80c87edf5c05c5bcc43fec862971d3e2e))
- **analytics:** add event tracking for key user actions ([#82](https://github.com/misty-step/linejam/issues/82)) ([24bad23](https://github.com/misty-step/linejam/commit/24bad23f41b214d5a991e5151b5fa57af165f2c6)), closes [#78](https://github.com/misty-step/linejam/issues/78) [#78](https://github.com/misty-step/linejam/issues/78)
- **archive:** redesign archive page with Manuscript Gallery layout ([#69](https://github.com/misty-step/linejam/issues/69)) ([afbf402](https://github.com/misty-step/linejam/commit/afbf4022265e67d00988b616d379db7eaea8d6d7))
- **auth:** dedicated auth pages with guest migration ([#119](https://github.com/misty-step/linejam/issues/119)) ([7cbe89a](https://github.com/misty-step/linejam/commit/7cbe89a6d6d214aa26b25c93fdd5fefa1ba7e924)), closes [#118](https://github.com/misty-step/linejam/issues/118) [#118](https://github.com/misty-step/linejam/issues/118) [#116](https://github.com/misty-step/linejam/issues/116)
- configure quality gates with Lefthook and CI ([6a9112d](https://github.com/misty-step/linejam/commit/6a9112dc5042dd8fb471844beceabfbc291c324c))
- configure Sentry error tracking with source maps ([f1850b3](https://github.com/misty-step/linejam/commit/f1850b37717264750f0509a42b2ad2fa1e283764))
- create Label component for editorial typography pattern ([68b061a](https://github.com/misty-step/linejam/commit/68b061a4eca8d417669988afc8f1f0e47f61ae57))
- create LoadingState deep module with preset messages ([18463e0](https://github.com/misty-step/linejam/commit/18463e06bffec918ffc95078dbdbf8c2a0882699))
- create ornament component for editorial typography ([8ff6da7](https://github.com/misty-step/linejam/commit/8ff6da760fcfa1e3c2748350e8b09eb40f48c399))
- enhance health route with error handling and caching ([d53aa73](https://github.com/misty-step/linejam/commit/d53aa7367b7b8c8016883d8bf6ecfcfb264f0a6c))
- implement asymmetric homepage layout with vertical label ([96a01d9](https://github.com/misty-step/linejam/commit/96a01d93fd2bc9c4edfe8e9915f1d95c8c1b682b))
- implement comprehensive design system with Tailwind 4 ([1f64c5e](https://github.com/misty-step/linejam/commit/1f64c5eb7ed325351d5099f434e1790d2394e950))
- Implement comprehensive test coverage automation ([#8](https://github.com/misty-step/linejam/issues/8)) ([f33770d](https://github.com/misty-step/linejam/commit/f33770d5ad1edf011cbf9a95f28c824a433fa7a2))
- implement core game logic and frontend UI ([8052011](https://github.com/misty-step/linejam/commit/80520119f7aacbcb4c671a016c6c716ae0574e69))
- implement crypto-secure 6-char room codes with backward compatibility ([8a016fa](https://github.com/misty-step/linejam/commit/8a016fae48b84eba1bd4372124af46c179969f0c))
- implement server-signed guest tokens with HttpOnly cookies ([cc72f34](https://github.com/misty-step/linejam/commit/cc72f34995a23e05d9d2d5cc63dd6d55fb4b3544))
- implement staggered asymmetric poem reveal ([06b159a](https://github.com/misty-step/linejam/commit/06b159afd16ba8c58d46fc82a8f87e6129677649))
- implement structured logging with Pino ([16658cf](https://github.com/misty-step/linejam/commit/16658cf85eba3b6ea4c4e6a62ea9664b637cee93))
- implement test helper for expired guest tokens ([#14](https://github.com/misty-step/linejam/issues/14)) ([10b0b17](https://github.com/misty-step/linejam/commit/10b0b179a205b57f89977fcc4caa036df4036ed7))
- implement Zen Garden design system and reveal ceremony ([4e5bc30](https://github.com/misty-step/linejam/commit/4e5bc30e132b01ed616ea8e90eba705c8232f1d2))
- improve poem display animation and layout ([46425c2](https://github.com/misty-step/linejam/commit/46425c2d0a1cc83a6cf027dd7e8390815f3f4b03))
- **infra:** add deep health check for uptimerobot monitoring ([3042c89](https://github.com/misty-step/linejam/commit/3042c893320997b56c5843c3132d72562b3a83a7))
- **infra:** add test-error and health check endpoints ([72f28b7](https://github.com/misty-step/linejam/commit/72f28b71ddbfa40bcaa70c9add0a52fac643e74b))
- **infra:** configure Dependabot for automated dependency updates ([#99](https://github.com/misty-step/linejam/issues/99)) ([#111](https://github.com/misty-step/linejam/issues/111)) ([70d7c36](https://github.com/misty-step/linejam/commit/70d7c36c29024936b24e58dcef393729ecbe89ec))
- **infrastructure:** implement structured logging, analytics, and sentry integration ([b19c92e](https://github.com/misty-step/linejam/commit/b19c92e3f892e8725624b8ee34ded65144052dfb))
- initialize Convex with schema for game data model ([ca00aa1](https://github.com/misty-step/linejam/commit/ca00aa1d60fcb3648250f0f0a05793caa63eb60f))
- initialize Next.js project with planning docs ([c4ba46f](https://github.com/misty-step/linejam/commit/c4ba46fb4b290c34006214f3592c5217a776ef8b))
- redesign archive poem with Literary Broadside aesthetic ([34b19b0](https://github.com/misty-step/linejam/commit/34b19b0ec7b638d0a9b11bc520b90ed676851cae))
- redesign home page with Literary Broadside aesthetic ([420b717](https://github.com/misty-step/linejam/commit/420b71797dae5918eb5e2f3a1ae8f2a2b12fe3ad))
- reduce room codes from 6 to 4 characters ([06c1e4a](https://github.com/misty-step/linejam/commit/06c1e4a234aa19d25256343ff31df3ca04a3d4b9))
- render submission confirmation UI ([2a6ce49](https://github.com/misty-step/linejam/commit/2a6ce492fad8287280051a22e86d276903dfc961))
- replace footer separators with dagger ornaments ([4469d4e](https://github.com/misty-step/linejam/commit/4469d4eb328ef8852c99c25b7839821c8e8f8feb))
- replace generic loading states with contextual messages ([18308f0](https://github.com/misty-step/linejam/commit/18308f086ec8d4833f2f59a6dc1614855081121c))
- **seo:** add robots.txt, sitemap.xml, and homepage OG image ([#80](https://github.com/misty-step/linejam/issues/80)) ([f9d34ab](https://github.com/misty-step/linejam/commit/f9d34ab4cf6fd82f8d1ddfd981aa14a84ffde6a0)), closes [#76](https://github.com/misty-step/linejam/issues/76) [#76](https://github.com/misty-step/linejam/issues/76)
- setup Changesets for version management ([d32cd8a](https://github.com/misty-step/linejam/commit/d32cd8af3be1f0d0bfc1fa15bcca1508b54a2f04))
- Share and Export Poems ([#10](https://github.com/misty-step/linejam/issues/10)) ([10a341b](https://github.com/misty-step/linejam/commit/10a341bd2be25dedaa52d928a3e2d89c6451b7ff))
- **ui:** implement ceremonial WritingScreen redesign with "Digital Ensō" concept ([198afcd](https://github.com/misty-step/linejam/commit/198afcd50cad374613efbb725f489b3c3eddec44))
- **ui:** implement combined stamp hover animation (pulse + wiggle) ([d555e70](https://github.com/misty-step/linejam/commit/d555e709a393d4092c51b786cf9d9c811a0339d6))
- **ui:** implement ink spread on hover animation for buttons ([1593fdb](https://github.com/misty-step/linejam/commit/1593fdb2f76b79481a5418a5da10938feff1f40d))
- **ui:** implement persimmon glow pulse animation for primary buttons ([e3d2aae](https://github.com/misty-step/linejam/commit/e3d2aaec6232571c80cff025dd9afe4762d5e13c))
- **ui:** implement typewriter character shift animation for buttons ([ac31c21](https://github.com/misty-step/linejam/commit/ac31c216e7ba51f697932ce76f4d88e1108333bb))
- **ui:** split-view lobby + dark mode QR + conditional header ([bc9122a](https://github.com/misty-step/linejam/commit/bc9122a92df52ee57a0c43b089ef2a5acb6cd125)), closes [#faf9f7](https://github.com/misty-step/linejam/issues/faf9f7) [#1c1917](https://github.com/misty-step/linejam/issues/1c1917)
- update placeholder to show required word count ([#63](https://github.com/misty-step/linejam/issues/63)) ([52562f4](https://github.com/misty-step/linejam/commit/52562f47434722b3042f4cdc50f5b2b8f6758ab3))

### Performance Improvements

- eliminate N+1 query patterns in game and poems modules ([#9](https://github.com/misty-step/linejam/issues/9)) ([d4bc813](https://github.com/misty-step/linejam/commit/d4bc81399b4ebe0c6b23bb02b6a78102566238ba))
- parallelize serial database writes in game mutations ([#116](https://github.com/misty-step/linejam/issues/116)) ([7db8d3b](https://github.com/misty-step/linejam/commit/7db8d3be4d3b0ec789656e27d9ae5e64592a187f)), closes [#86](https://github.com/misty-step/linejam/issues/86) [#86](https://github.com/misty-step/linejam/issues/86)

### BREAKING CHANGES

- Existing localStorage guest IDs will be replaced with
  new server-issued tokens on first load. Users will appear as new guests.

Task: Guest token issuance API (Next) and hook (TODO.md task 3)
PRD: TASK.md - Secure Rooms section

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude <noreply@anthropic.com>

# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.1.0] - 2025-01-24

### Added

- feat(game): Real-time collaborative poetry game with 9-round structure
- feat(ai): AI players powered by Gemini for solo or small group play
- feat(themes): Four premium visual themes (Kenya, Mono, Vintage Paper, Hyper)
- feat(auth): Hybrid authentication with Clerk and guest UUID fallback
- feat(share): Poem sharing with clipboard copy and analytics tracking
- feat(help): Floating help modal explaining gameplay rules
- feat(ui): WordSlots genkoyoushi-inspired word count indicator

### Changed

- refactor(releases): Static file-based releases infrastructure

### Fixed

- fix: Ensure proper word counting for multi-space inputs
