# Contributing

[简体中文](./CONTRIBUTING.zh-CN.md)

Thank you for helping improve Oh My DSH.

Before proposing a change:

1. Make sure every referenced artifact is publicly readable and immutable.
2. Remove credentials, personal paths, private URLs, and confidential evidence.
3. Keep compatibility claims tied to public, versioned documentation.
4. Run `npm ci --ignore-scripts` and `npm run public:check`.
5. Explain the user-visible reason for the change.

Component-set definitions must pass the JSON Schema and semantic checks. A
successful validation means only that the submitted data follows this public
contract; it is not a security endorsement or an upstream compatibility claim.
