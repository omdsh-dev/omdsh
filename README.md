# Oh My DSH

[简体中文](./README.zh-CN.md)

Oh My DSH is an independent, community-maintained experimental project for
organizing versioned component sets and defaults in a clear, reviewable, and
reproducible form.

This public repository candidate is an early preview. It currently contains
only a format designed publicly for this project, explicitly fictional test
fixtures, and local validation tools. It does not provide a production-ready
installer or make compatibility guarantees for third-party software.

## Current status

- The public component-set schema is a draft and may change before `v1`.
- No production component set is included yet.
- Installation and compatibility instructions will be added only from public,
  versioned documentation.
- Nothing in this repository is an official DeepSeek release.

## Public-source policy

Content accepted into this repository must be independently reviewable from
public sources. In particular:

- reference only public, immutable component versions;
- do not include credentials, personal machine paths, or private URLs;
- do not reproduce confidential source code, specifications, or test evidence;
- keep unverified compatibility claims explicitly unknown;
- keep package publishing disabled until a separate release review approves it.

See [the complete public-source policy](./docs/public-source-policy.md).
Command-line locale behavior is documented in the
[internationalization guide](./docs/i18n.md).

## Repository layout

- [`distributions/`](./distributions/) — production component sets, currently empty.
- [`schemas/distribution-v1.schema.json`](./schemas/distribution-v1.schema.json)
  — the public data contract.
- [`test/fixtures/`](./test/fixtures/) — fictional data used only by tests.
- [`scripts/`](./scripts) — deterministic validation and public-boundary checks.
- [`locales/`](./locales/) — complete English and Simplified Chinese CLI messages.

Security, contribution, and community rules are available in both languages:
[security](./SECURITY.md), [contributing](./CONTRIBUTING.md), and
[code of conduct](./CODE_OF_CONDUCT.md).

## Validate locally

```bash
npm ci --ignore-scripts
npm run public:check
```

`npm run visibility:check` verifies the approved MIT license and its recorded
exact-text digest before the repository is made public.
`npm run release:check` additionally requires a production definition made
only from component versions with anonymous, immutable public evidence.

## Trademark and affiliation

Third-party names and trademarks belong to their respective owners. Oh My DSH
is an independent community project. It is not an official DeepSeek product,
is not affiliated with DeepSeek, and is not endorsed by DeepSeek.
