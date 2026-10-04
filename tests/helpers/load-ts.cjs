// Lets tests require the app's TypeScript modules, including "@/..." imports.
const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');
const ts = require('typescript');

const src = path.join(__dirname, '../../src');
const resolve = Module._resolveFilename;
Module._resolveFilename = function (request, ...rest) {
  if (request.startsWith('@/')) {
    const base = path.join(src, request.slice(2));
    return resolve.call(this, fs.existsSync(`${base}.ts`) ? `${base}.ts` : base, ...rest);
  }
  return resolve.call(this, request, ...rest);
};
require.extensions['.ts'] = (module, filename) => {
  const { outputText } = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  });
  module._compile(outputText, filename);
};

module.exports = (file) => require(path.join(src, file));
