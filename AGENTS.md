# CompanyEnrich documentation

This repository publishes CompanyEnrich's public documentation through Mintlify.
The documentation root is this directory; configuration lives in `docs.json`.
Read `README.md` for development commands and `MIGRATION.md` for migration context.

## Repository layout

- `docs/`: hand-written product guides, SDK documentation, and MCP setup.
- `quickstart.mdx`, `authentication.mdx`: first-request and authentication guides.
- `api-reference/v1/`, `api-reference/v2/`: generated endpoint pages and hand-written `overview.mdx` pages.
- `openapi/v1.json`, `openapi/v2.json`: snapshots of the public API specifications.
- `scripts/sync-openapi.mjs`: specification download, endpoint generation, navigation, and redirect maintenance.
- `changelog/`: historical release posts and their index.
- `logo/`, `favicon.ico`: CompanyEnrich brand assets.

## API reference and sources of truth

- Preserve the published OpenAPI files as downloaded. Do not hand-edit their schemas or descriptions to change API behavior or pricing.
- Refresh specifications and generated pages with `npm run sync:openapi`. It downloads both versions from `https://api.companyenrich.com/openapi/v1.json` and `https://api.companyenrich.com/openapi/v2.json`.
- Run a refresh when the task needs updated API documentation, not as a routine side effect of unrelated edits. Inspect the entire resulting diff.
- Endpoint pages contain a generated marker and an explicit specification path in their `openapi` frontmatter. Change the generator for formatting changes; fix API descriptions upstream for contract changes.
- The sync script rebuilds the `groups` inside the `API V1` and `API V2` navigation tabs. Keep those tab names unless updating the generator too. Make persistent changes to their generated navigation in the script.
- The two API overview pages and other hand-written guides are not generated.
- `npm run check:api` checks local snapshots, generated pages, navigation, and generated redirects without fetching the live specifications.
- If a guide conflicts with a current specification, verify the relevant version before correcting it. Do not infer behavior from similarly named V1 and V2 endpoints.

## Version and authentication details

- The API base URL is `https://api.companyenrich.com`. V1 paths have no `/v1` prefix; V2 paths start with `/v2`.
- Both specifications model authentication as an `Authorization` API-key header. The playground requires the full value `Bearer YOUR_API_TOKEN`, including the prefix.
- Credit costs, expansions, pagination, and asynchronous workflows can differ between versions. Check the relevant operation rather than copying another version's examples.
- The published JavaScript SDK and npm MCP server may target different API versions. Verify the package version and implementation before updating their documented capabilities or prices.
- Keep historical changelog claims and original publication dates intact. Put current behavior in guides and endpoint references.

## Writing and MDX

- Write for API users. Use direct language, active voice, sentence-case headings, and practical examples.
- Give hand-written pages `title` and `description` frontmatter. Do not repeat the title as a body H1.
- Use Mintlify components such as `Note`, `Warning`, `Steps`, `CardGroup`, and `CodeGroup` where they help readers.
- Use fenced code blocks with language identifiers. For code-group titles, use syntax like three backticks followed by `bash Sign in`; quoted titles rendered as blank tabs during this migration.
- Use MDX comments (`{/* comment */}`), not HTML comments, and self-close HTML void elements such as `<br />`.
- Use root-relative internal links, such as `/docs/credits`, without `.mdx` extensions. Verify fragment links after renaming headings.
- Preserve existing page URLs. When moving or removing a page, review inbound links and add or update redirects in `docs.json`.
- Navigation entries must resolve to real pages. Keep maintainer-only files out of site content with `.mintignore`.
- Use public examples and placeholder credentials. Never commit real tokens, private customer data, environment files, or local cache output.

## Development and validation

Use the Node.js version supported by `package.json` and the pinned local Mintlify CLI. Install dependencies with `npm ci` when needed; avoid unrelated dependency upgrades.

| Command | Purpose |
| --- | --- |
| `npm run dev` | Start the local Mintlify preview |
| `npm run check:api` | Verify generated reference consistency against local specs |
| `npm run validate` | Validate MDX/configuration and run Mintlify's strict build |
| `npm run check:links` | Check internal links |
| `npm run check` | Run all three checks |

- Run `npm run check` after changes to documentation, navigation, API snapshots, or generation logic. For maintainer-only instruction edits, review the diff and run `git diff --check`.
- For layout or interactive component changes, inspect affected pages in the local preview. A passing build did not catch the blank code-group tab labels during migration.
- Validation does not require API credentials. Playground submissions are real requests and may consume credits; use them only when the user requests or authorizes live API testing.
- Distinguish local build/browser validation from a successful hosted deployment in your report.

## Change scope and publishing

- Inspect Git status before editing and preserve unrelated user changes.
- Keep changes focused on the request. Commit, push, and publish only within the user's authorized scope.
- Mintlify deploys from the connected repository and branch. Repository edits do not authorize changing Mintlify account settings, DNS, or deleting repositories.
