import typescript from 'rollup-plugin-typescript2';
import { terser } from "rollup-plugin-terser";

import fs from 'fs';
import path from 'path';

const pkg = require('./package.json');
const input = 'src/sql-data.api.ts';

// rollup-plugin-typescript2 emits the .d.ts files under dist/src on Windows (rootDir is not honoured there).
// Move them next to the bundles so "typings": "dist/sql-data.api.d.ts" keeps resolving.
const flattenDeclarations = () => ({
  name: 'flatten-declarations',
  writeBundle() {
    const from = path.resolve('dist/src');
    const to = path.resolve('dist');
    if (!fs.existsSync(from)) return;
    for (const file of fs.readdirSync(from)) {
      const target = path.join(to, file);
      if (file.endsWith('.d.ts.map')) {
        const map = fs.readFileSync(path.join(from, file), 'utf8').replace(/\.\.\/\.\.\/src\//g, '../src/');
        fs.writeFileSync(target, map);
        fs.unlinkSync(path.join(from, file));
      } else {
        fs.renameSync(path.join(from, file), target);
      }
    }
    fs.rmdirSync(from);
  }
});

export default [{
  input,
  output: { file: pkg.main, name: 'sql-data-api', format: 'umd', sourcemap: true, compact: true, globals: {
    'axios': 'Axios',
    'datapipe-js': 'dataPipeJs',
    'datapipe-js/utils': 'dataPipeJsUtils'
  }},
  external: [
    'axios',
    'datapipe-js',
    'datapipe-js/utils'
  ],
  treeshake: true,
  plugins: [
    typescript({
      clean: true,
      include: ['src/**/*.ts']
    }),
    flattenDeclarations(),
    terser()
  ]
}, {
  input,
  output: { file: pkg.module, format: 'esm', sourcemap: true, compact: true },
  external: [],
  plugins: [
    typescript({
      clean: true,
      include: ['src/**/*.ts']
    }),
    flattenDeclarations()
  ]
}];
