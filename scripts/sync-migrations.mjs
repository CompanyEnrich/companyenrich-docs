import { readFile, writeFile, readdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

// Migration guide tables are generated from migrations/<vendor>.json.
// Edit the JSON, then run `npm run sync:migrations`. `--check` validates every
// CompanyEnrich path, filter, and value against openapi/v2.json and fails when a
// generated block is out of date.
process.chdir(fileURLToPath(new URL('..', import.meta.url)));
const check = process.argv.includes('--check');
const spec = JSON.parse(await readFile('openapi/v2.json', 'utf8'));
const errors = [];
const fidelities = ['same', 'renamed', 'transformed', 'lossy', 'none'];

// --- OpenAPI helpers --------------------------------------------------------

function deref(schema) {
  let node = schema;
  while (node?.$ref) {
    node = node.$ref.slice(2).split('/').reduce((value, key) => value?.[key], spec);
  }
  return node ?? {};
}

// Every concrete variant of a schema, following $ref, allOf, oneOf, and anyOf.
function variants(schema) {
  const node = deref(schema);
  const nested = [...(node.allOf ?? []), ...(node.oneOf ?? []), ...(node.anyOf ?? [])];
  return [node, ...nested.flatMap(variants)];
}

function property(schema, name) {
  return variants(schema).map((node) => node.properties?.[name]).filter(Boolean);
}

function items(schema) {
  return variants(schema).map((node) => node.items).filter(Boolean);
}

function hasPath(root, path) {
  let current = [root];
  for (const segment of path.split('.')) {
    const isArray = segment.endsWith('[]');
    const name = isArray ? segment.slice(0, -2) : segment;
    current = current.flatMap((schema) => property(schema, name));
    if (isArray) current = current.flatMap(items);
    if (!current.length) return false;
  }
  return true;
}

function enumValues(schema) {
  const values = new Set();
  const visit = (node, seen = new Set()) => {
    for (const variant of variants(node)) {
      if (seen.has(variant)) continue;
      seen.add(variant);
      variant.enum?.forEach((value) => values.add(value));
      if (variant.items) visit(variant.items, seen);
      Object.values(variant.properties ?? {}).forEach((child) => visit(child, seen));
    }
  };
  visit(schema);
  return values;
}

function responseSchema(method, path) {
  const operation = spec.paths[path]?.[method];
  return operation?.responses?.['200']?.content?.['application/json']?.schema;
}

function requestSchema(method, path) {
  return spec.paths[path]?.[method]?.requestBody?.content?.['application/json']?.schema;
}

function operation(text) {
  const [method, path] = text.split(' ');
  return spec.paths[path]?.[method.toLowerCase()] ? { method: method.toLowerCase(), path } : null;
}

const roots = {
  company: responseSchema('get', '/v2/companies/enrich'),
  person: responseSchema('get', '/v2/people/{personId}'),
  workEmail: responseSchema('get', '/v2/people/{personId}/email'),
};
const searchRequests = {
  company: requestSchema('post', '/v2/companies/search'),
  person: requestSchema('post', '/v2/people/search'),
};
const expansions = {
  company: new Set(spec.paths['/v2/companies/enrich'].get.parameters
    .filter((parameter) => parameter.name === 'expand').flatMap((parameter) => [...enumValues(parameter.schema)])),
  person: enumValues(property(requestSchema('post', '/v2/people/enrich'), 'expand')[0]),
};

// Check every key of a request fragment against the schema, one level of objects at a time.
function checkKeys(value, schema, where) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return;
  for (const [key, child] of Object.entries(value)) {
    const matches = property(schema, key);
    if (!matches.length) {
      errors.push(`${where}: unknown key ${key}`);
      continue;
    }
    if (child && typeof child === 'object' && !Array.isArray(child)) {
      const nested = matches.filter((match) => variants(match).some((node) => node.properties));
      if (nested.length) checkKeys(child, { anyOf: nested }, `${where}.${key}`);
    }
  }
}

// --- Validation ---------------------------------------------------------------

const list = (value) => (value == null ? [] : Array.isArray(value) ? value : [value]);

function validate(slug, mapping) {
  const where = `migrations/${slug}.json`;
  for (const [index, endpoint] of mapping.endpoints.entries()) {
    const label = `${where} endpoints[${index}]`;
    if (!['company', 'people', 'supporting'].includes(endpoint.group)) errors.push(`${label}: bad group`);
    if (!['mapped', 'partial', 'none'].includes(endpoint.status)) errors.push(`${label}: bad status`);
    if ((endpoint.companyEnrich === null) !== (endpoint.status === 'none')) {
      errors.push(`${label}: status none and a null companyEnrich must go together`);
    }
    if (endpoint.companyEnrich && !operation(endpoint.companyEnrich)) {
      errors.push(`${label}: ${endpoint.companyEnrich} is not in openapi/v2.json`);
    }
  }

  for (const [object, rows] of Object.entries(mapping.fields)) {
    for (const [index, row] of rows.entries()) {
      const label = `${where} fields.${object}[${index}] (${list(row.pdl).join(', ')})`;
      const root = roots[row.in ?? object];
      if (!root) errors.push(`${label}: unknown object ${row.in ?? object}`);
      if (!fidelities.includes(row.fidelity)) errors.push(`${label}: bad fidelity ${row.fidelity}`);
      if ((row.ce === null) !== (row.fidelity === 'none')) {
        errors.push(`${label}: fidelity none and a null ce must go together`);
      }
      for (const path of list(row.ce)) {
        if (root && !hasPath(root, path)) errors.push(`${label}: ${path} is not in the ${row.in ?? object} schema`);
      }
      if (row.expand && !expansions[object]?.has(row.expand)) errors.push(`${label}: unknown expansion ${row.expand}`);
      if (row.values && !mapping.values[row.values]) errors.push(`${label}: unknown value table ${row.values}`);
    }
  }

  for (const [object, rows] of Object.entries(mapping.ceOnly)) {
    for (const row of rows) {
      for (const path of list(row.ce)) {
        if (!hasPath(roots[object], path)) errors.push(`${where} ceOnly.${object}: ${path} is not in the schema`);
      }
    }
  }

  for (const [name, table] of Object.entries(mapping.values)) {
    const [schemaName, prop] = table.enum.split('.');
    const allowed = enumValues(property({ $ref: `#/components/schemas/${schemaName}` }, prop)[0]);
    if (!allowed.size) errors.push(`${where} values.${name}: no enum at ${table.enum}`);
    for (const row of table.rows) {
      if (!fidelities.includes(row.fidelity)) errors.push(`${where} values.${name}: bad fidelity ${row.fidelity}`);
      if ((row.ce === null) !== (row.fidelity === 'none')) {
        errors.push(`${where} values.${name} (${list(row.pdl).join(', ')}): fidelity none and a null ce must go together`);
      }
      for (const value of list(row.ce)) {
        if (!allowed.has(value)) errors.push(`${where} values.${name}: ${value} is not a value of ${table.enum}`);
      }
    }
  }

  for (const [object, rows] of Object.entries(mapping.search)) {
    for (const [index, row] of rows.entries()) {
      const label = `${where} search.${object}[${index}]`;
      if (!fidelities.includes(row.fidelity)) errors.push(`${label}: bad fidelity ${row.fidelity}`);
      if ((row.ce === null) !== (row.fidelity === 'none')) errors.push(`${label}: fidelity none and a null ce must go together`);
      checkKeys(row.ce, searchRequests[object], label);
    }
  }
}

// --- Rendering ----------------------------------------------------------------

// Escape text for an MDX table cell. Code spans keep their content; everything
// else has JSX-significant characters escaped.
function text(value) {
  return String(value)
    .split(/(`[^`]*`)/)
    .map((part) => (part.startsWith('`') ? part : part.replace(/[{}<>]/g, (c) => `\\${c}`)))
    .join('')
    .replaceAll('|', '\\|');
}

const code = (value) => `\`${String(value).replaceAll('|', '\\|')}\``;
const codes = (values, separator = ', ') => list(values).map(code).join(separator);

function json(value) {
  if (Array.isArray(value)) return `[${value.map(json).join(', ')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.entries(value).map(([key, child]) => `${JSON.stringify(key)}: ${json(child)}`).join(', ')}}`;
  }
  return JSON.stringify(value);
}

function table(headers, rows) {
  return [
    `| ${headers.join(' | ')} |`,
    `| ${headers.map(() => '---').join(' | ')} |`,
    ...rows.map((cells) => `| ${cells.join(' | ')} |`),
  ].join('\n');
}

const anchor = (title) => title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

function reference(endpoint) {
  const { method, path } = operation(endpoint);
  const slug = `${method}-${path.replace(/^\/v2\//, '').replaceAll('/', '-').replace(/[{}]/g, '').toLowerCase()}`;
  return `[${code(endpoint)}](/api-reference/v2/${slug})`;
}

function note(row, mapping) {
  const parts = [];
  if (row.note) parts.push(text(row.note));
  if (row.values) parts.push(`See [${mapping.values[row.values].title}](#${anchor(mapping.values[row.values].title)}).`);
  return parts.join(' ') || ' ';
}

const renderers = {
  fidelity: (mapping) => table(
    ['Fidelity', 'Meaning'],
    Object.entries(mapping.fidelity).map(([name, meaning]) => [code(name), text(meaning)]),
  ),

  endpoints: (mapping, group) => table(
    ['People Data Labs', 'CompanyEnrich V2', 'Notes'],
    mapping.endpoints.filter((endpoint) => endpoint.group === group).map((endpoint) => {
      let pdl = endpoint.pdl.startsWith('/') ? code(endpoint.pdl) : text(endpoint.pdl);
      if (Array.isArray(endpoint.pdlInput)) pdl += ` with ${codes(endpoint.pdlInput)}`;
      else if (endpoint.pdlInput) pdl += `, ${text(endpoint.pdlInput)}`;
      const inputs = Object.entries(endpoint.inputs ?? {})
        .map(([from, to]) => `${code(from)} → ${codes(to, ' or ')}`);
      const notes = [inputs.length ? `${inputs.join('; ')}.` : '', text(endpoint.note ?? '')].filter(Boolean).join(' ');
      return [pdl, endpoint.companyEnrich ? reference(endpoint.companyEnrich) : 'None', notes || ' '];
    }),
  ),

  fields: (mapping, object) => {
    const groups = [...new Set(mapping.fields[object].map((row) => row.group))];
    return groups.map((group) => `### ${group}\n\n${table(
      ['People Data Labs', 'CompanyEnrich', 'Expand', 'Fidelity', 'Notes'],
      mapping.fields[object].filter((row) => row.group === group).map((row) => [
        codes(row.pdl),
        row.ce === null ? '—' : row.in === 'workEmail'
          ? `${codes(row.ce)} from ${reference('GET /v2/people/{personId}/email')}`
          : codes(row.ce, ' or '),
        row.expand ? code(row.expand) : ' ',
        row.fidelity,
        note(row, mapping),
      ]),
    )}`).join('\n\n');
  },

  ceOnly: (mapping, object) => table(
    ['Field', 'Expand', 'Notes'],
    mapping.ceOnly[object].map((row) => [codes(row.ce), row.expand ? code(row.expand) : ' ', text(row.note ?? ' ')]),
  ),

  values: (mapping) => Object.values(mapping.values).map((values) => [
    `### ${values.title}`,
    `People Data Labs ${codes(values.pdl.split(', '))} → CompanyEnrich ${codes(values.ce.split(', '))}. ${text(values.note)}`,
    table(
      ['People Data Labs', 'CompanyEnrich', 'Fidelity', 'Notes'],
      values.rows.map((row) => [codes(row.pdl), row.ce === null ? '—' : codes(row.ce), row.fidelity, text(row.note ?? ' ')]),
    ),
  ].join('\n\n')).join('\n\n'),

  search: (mapping, object) => table(
    ['People Data Labs query', 'CompanyEnrich request', 'Fidelity', 'Notes'],
    mapping.search[object].map((row) => [
      code(row.pdl),
      row.ce === null ? 'None' : code(json(row.ce)),
      row.fidelity,
      text(row.note ?? ' '),
    ]),
  ),
};

// --- Pages --------------------------------------------------------------------

const mappings = new Map();
for (const file of (await readdir('migrations')).filter((name) => name.endsWith('.json'))) {
  const slug = file.replace(/\.json$/, '');
  const mapping = JSON.parse(await readFile(`migrations/${file}`, 'utf8'));
  validate(slug, mapping);
  mappings.set(slug, mapping);
}

const block = /\{\/\* generated: ([a-z0-9-]+) ([a-zA-Z]+)(?::([a-zA-Z]+))? \*\/\}\n[\s\S]*?\{\/\* end generated \*\/\}/g;
let blocks = 0;
const stale = [];
for (const file of (await readdir('docs')).filter((name) => name.endsWith('.mdx'))) {
  const path = `docs/${file}`;
  const source = await readFile(path, 'utf8');
  const output = source.replace(block, (match, slug, kind, argument) => {
    const mapping = mappings.get(slug);
    if (!mapping) {
      errors.push(`${path}: no migrations/${slug}.json`);
      return match;
    }
    if (!renderers[kind]) {
      errors.push(`${path}: unknown generated block ${kind}`);
      return match;
    }
    blocks += 1;
    const head = `{/* generated: ${slug} ${kind}${argument ? `:${argument}` : ''} */}`;
    return `${head}\n\n${renderers[kind](mapping, argument)}\n\n{/* end generated */}`;
  });
  if (output === source) continue;
  if (check) stale.push(path);
  else await writeFile(path, output);
}

if (errors.length) {
  console.error(errors.join('\n'));
  process.exit(1);
}
if (stale.length) {
  console.error(`Out of date: ${stale.join(', ')}. Run npm run sync:migrations.`);
  process.exit(1);
}
console.log(`${check ? 'Checked' : 'Generated'} ${blocks} blocks from ${mappings.size} migration mapping${mappings.size === 1 ? '' : 's'}.`);
