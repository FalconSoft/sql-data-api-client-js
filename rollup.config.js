import typescript from 'rollup-plugin-typescript2';
import copy from 'rollup-plugin-copy'
import { uglify } from "rollup-plugin-uglify";

const pkg = require('./package.json');
const input = 'src/sql-data.api.ts';

export default [{
  input,
  output: { file: pkg.main, name: 'sql-data-api', format: 'umd', sourcemap: true, compact: true },
  external: [],
  treeshake: true,
  plugins: [
    typescript({
      clean: true
    }),
    copy({
      targets: []
    }),
    uglify()
  ]
}, {
  input,
  output: { file: pkg.module, format: 'esm', sourcemap: true, compact: true },
  external: [],
  plugins: [
    typescript({
      clean: true
    })
  ]
}];
