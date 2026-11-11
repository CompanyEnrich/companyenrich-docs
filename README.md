# CompanyEnrich documentation

Mintlify documentation for CompanyEnrich, including migrated guides, the product changelog, and complete V2 and V1 API references.

## Local development

Use Node.js 22 LTS or later and npm.

```sh
npm ci
npm run dev
```

Open the local URL printed by Mintlify (normally `http://localhost:3000`). The CLI downloads its preview client on the first run.

```sh
npm run check
```

This checks generated endpoint coverage, runs Mintlify's strict validation/build, and checks internal links. No API credentials are required for these checks.

## Content

- `docs.json`: branding, navigation, playground settings, and migration redirects.
- `docs/`: guides migrated from the existing documentation; original URLs are retained.
- `quickstart.mdx` and `authentication.mdx`: first-request instructions.
- `api-reference/v2/` and `api-reference/v1/`: endpoint pages plus hand-written overview pages.
- `openapi/`: snapshots of the published API specifications.
- `changelog/`: all 13 original release posts and their original publication dates.
- `logo/` and `favicon.ico`: existing CompanyEnrich branding, stored locally.
- `MIGRATION.md`: source inventory and migration decisions.

## Refresh the API reference

```sh
npm run sync:openapi
npm run check
```

The sync command downloads both published specs:

- <https://api.companyenrich.com/openapi/v2.json>
- <https://api.companyenrich.com/openapi/v1.json>

It preserves the specifications as published, generates one MDX page per operation, and updates the API navigation. Checked-in snapshots make builds independent of the production API's availability. Review the resulting diff before committing; API contract and pricing changes appear directly in the reference.

Endpoint MDX files are generated and should not be edited by hand. Maintain API descriptions upstream. Guide content and the two API overview pages are hand-written and are not overwritten by sync.

Both specs model authentication as an `Authorization` API-key header. The playground therefore expects the complete value, **`Bearer YOUR_API_TOKEN`**. V1 API paths have no `/v1` prefix; V2 paths begin with `/v2`.

## Deploy to Mintlify

1. Push this repository to your Git provider.
2. In your Mintlify project, connect that repository and select the deployment branch. The documentation directory is the repository root (`/`), where `docs.json` lives.
3. Verify the preview deployment, including both API tabs and the migrated guide URLs.
4. Add `docs.companyenrich.com` as the custom domain in Mintlify and use the DNS records Mintlify provides when you are ready to switch from the current host.

Mintlify builds and hosts the documentation directly from these files; no separate application build output is needed. See the [Mintlify quickstart](https://www.mintlify.com/docs/quickstart) and [custom-domain instructions](https://www.mintlify.com/docs/customize/custom-domain).

This initialization does not publish the site or change DNS.
