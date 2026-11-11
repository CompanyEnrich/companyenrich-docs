# Migration from the existing CompanyEnrich docs

Source snapshot: November 11, 2026.

## Sources and coverage

| Source | Migrated content |
| --- | --- |
| `https://docs.companyenrich.com/sitemap.xml` | Six guides, 25 current API reference pages, and 13 changelog posts |
| `https://docs.companyenrich.com/llms.txt` | Guide/reference discovery and Markdown exports; lists only ten of the 13 changelog posts |
| `https://docs.companyenrich.com/v1.0/llms.txt` | 48 V1 reference pages and five older shared guides |
| `https://api.companyenrich.com/openapi/v2.json` | All 35 V2 operations, including ten bulk, export, and batch operations absent from the old reference |
| `https://api.companyenrich.com/openapi/v1.json` | All 48 V1 operations |

Every old API reference page was read and compared to its embedded operation description. All 73 pages consisted of generated OpenAPI content; there was no additional hand-written endpoint prose to carry over. The live specifications supply the new reference's schemas and descriptions.

## Guides

The original `/docs/` slugs are retained for getting started, data sources, MCP setup, rate limits, credits, and the JavaScript/TypeScript SDK. All 24 fenced code snippets from the MCP and SDK guides are preserved. ReadMe code groups were converted to Mintlify `CodeGroup` components; unsupported `UserMotion` widgets were removed. Email and internal links were adapted to MDX.

The five older V1 guides are identical to or superseded by the current shared guides, so their `/v1.0/docs/` URLs redirect to the corresponding migrated guide. The old MCP guide used the obsolete SSE setup; the current guide preserves the published HTTP setup.

Corrections made where source documentation conflicted with current contracts:

- Rate limits now describe the global 500 requests/minute/IP limit and separate plan-based user/route limits, replacing the old universal 300 requests/minute/key claim.
- Credits no longer claim every endpoint is charged; each operation's price, expansion charges, and empty-result behavior remain in its reference.
- Getting started distinguishes V1's 10,000-domain job/webhook behavior from V2's batch workflows.
- The MCP guide keeps the published MCP package's V1 pricing and explicitly distinguishes it from V2. Its workforce price is 5 credits; the V2 workforce operation is 1 credit per page.
- SDK documentation identifies the checked version as 1.0.1 instead of promising it is always the latest release.

Quickstart and authentication pages were added with requests that match the V2 specification. No authenticated requests or billable operations were executed during initialization.

## Changelog

All 13 original posts are retained at `/changelog/<original-slug>`. The index lists them chronologically and preserves their contents. Original publication dates were extracted from each page's embedded `document.created_at`, not the later `updatedAt` timestamps. Dates range from August 24, 2024 through March 25, 2026.

Historical claims remain historical. These posts are not a source of current pricing or endpoint behavior.

## URLs and branding

`docs.json` redirects old reference URLs to the corresponding versioned endpoint pages, including the `/v1.0/reference/` paths. It also covers the old reference landing pages and `/docs/release-notes` alias. Guide and individual changelog paths are preserved directly.

The existing light/dark SVG wordmarks and favicon are stored locally. The primary blue, `#076CD9`, comes from the current documentation site's branding.

## Deployment boundary

The repository is prepared for a Mintlify project rooted at `/`. Connecting a Git remote, publishing to Mintlify, and switching the custom domain are separate deployment steps. No existing documentation or DNS settings were changed.
