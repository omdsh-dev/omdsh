# Public-source policy

[简体中文](./public-source-policy.zh-CN.md)

This repository is built only from information and artifacts that a member of
the public can independently inspect.

## Allowed

- Public documentation with a stable URL and identifiable version.
- Public source repositories and immutable release identifiers.
- Clearly fictional examples under reserved example domains.
- Original community documentation that does not reproduce confidential work.

## Not allowed

- Credentials, session data, private URLs, personal machine paths, or private
  repository coordinates.
- Source, specifications, package names, screenshots, or compatibility evidence
  learned only through a private program.
- Mutable branch references presented as released versions.
- Claims of upstream endorsement, official status, security, or compatibility
  without public evidence.
- Install hooks or arbitrary commands inside a distribution definition.

## Evidence rule

When public evidence is incomplete, the repository must say that the fact is
unknown. A private result cannot be used to fill a public evidence gap.
