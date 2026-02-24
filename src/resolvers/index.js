// src/resolvers/index.js
// @forge/resolver v1.x exposes Resolver as the default export in CommonJS.
// Using a named import here returns undefined and causes "Resolver is not a constructor".
const Resolver = require('@forge/resolver').default;
const { storage } = require('@forge/api');

const resolver = new Resolver();

function issueKey(issueId) {
  return `accordions:issue:${issueId}`;
}

resolver.define('accordions.get', async ({ payload }) => {
  const { issueId } = payload || {};
  if (!issueId) throw new Error('Missing issueId');

  const doc = await storage.get(issueKey(issueId));
  return (
    doc ?? {
      version: 1,
      revision: 0,
      items: [],
      updatedAt: null,
      updatedBy: null,
    }
  );
});

resolver.define('accordions.save', async ({ payload, context }) => {
  console.log('accordions.save payload:', payload);

  const { issueId, doc } = payload || {};
  if (!issueId) throw new Error('Missing issueId');
  if (!doc || typeof doc !== 'object') throw new Error('Missing doc');

  const key = issueKey(issueId);

  const current = (await storage.get(key)) ?? { revision: 0, items: [] };
  const currentRev = Number(current.revision || 0);
  const incomingRev = Number(doc.revision || 0);

  if (incomingRev !== currentRev) {
    return {
      ok: false,
      conflict: true,
      message: 'Content changed since you loaded it. Please reload.',
      current,
    };
  }

  const next = {
    ...doc,
    revision: currentRev + 1,
    updatedAt: new Date().toISOString(),
    updatedBy: context?.accountId ?? null,
  };

  await storage.set(key, next);
  return { ok: true, conflict: false, doc: next };
});

exports.handler = resolver.getDefinitions();
