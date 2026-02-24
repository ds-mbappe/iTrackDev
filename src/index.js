// src/index.js
// Forge function handlers are resolved relative to the src directory.
// This file acts as the function entrypoint referenced by `handler: index.handler`
// in manifest.yml, and delegates to the resolver definitions module.
const { handler } = require('./resolvers/index.js');

exports.handler = handler;
