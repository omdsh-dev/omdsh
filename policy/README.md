# Public component policy

[简体中文](./README.zh-CN.md)

`public-components.json` is an exact-version allowlist for production
definitions. It starts empty. A component version may be added only when it
has a public GitHub source URL pinned to a full 40-character commit and that
URL can be inspected without credentials. Its exact npm package version must
be anonymously readable; the published package name, version, sha512
integrity, source repository, and `gitHead` must all match the approved entry.

After the maintainers approve a license, `approved-license.json` records its
SPDX identifier and the SHA-256 digest of the exact reviewed `LICENSE.md`.
Public-visibility readiness stays blocked if that approval record is missing
or if the license text changes.
