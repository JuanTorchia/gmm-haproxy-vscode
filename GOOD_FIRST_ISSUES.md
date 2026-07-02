# Good First Issues

These tasks are useful, low-risk, and do not require deep knowledge of the language server internals.

## Add a Missing Directive

Good for: first-time TypeScript contributors.

1. Find a directive in official HAProxy docs that is missing from `server/src/data/directives.ts` or `server/src/data/global.ts`.
2. Add `name`, `signature`, `description`, `sections`, `since`, and `docsUrl`.
3. Add a validator test in `test/validator/validator.test.ts`.
4. Run `npm run test:unit -- test/validator/validator.test.ts`.

## Add a Version-Specific Test

Good for: contributors who know HAProxy versions.

1. Pick a directive that changed between 2.4, 2.6, 2.8, 3.0, and 3.1.
2. Add or improve coverage in `test/validator/validator.test.ts`.
3. Make the expected diagnostic message actionable.
4. Run `npm run test:unit -- test/validator/validator.test.ts`.

## Add a Sanitized Fixture

Good for: DevOps/SRE users.

1. Create a sanitized config in `test/fixtures/`.
2. Remove real domains, internal IPs, certificates, tokens, and comments that reveal infrastructure.
3. Add or update a parser/validator test that uses the fixture.
4. Run the related test file.

## Improve a Snippet

Good for: users who want better editing ergonomics.

1. Update `snippets/haproxy.json`.
2. Use tabstops for every value the user should edit.
3. Keep snippets production-realistic and not overly opinionated.
4. Run `npm run compile`.

## Improve Documentation

Good for: contributors who want a no-code first PR.

Useful areas:

- Troubleshooting local extension launch.
- Explaining HAProxy version selection.
- Adding short examples for completion, validation, hover, and snippets.
- Clarifying how to add directive metadata.

Run `git diff --check` before opening the PR.
