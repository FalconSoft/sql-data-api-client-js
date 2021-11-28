import typescript from 'rollup-plugin-typescript2';
import copy from 'rollup-plugin-copy'
import { terser } from "rollup-plugin-terser";

const pkg = require('./package.json');
const input = 'src/sql-data.api.ts';

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
      clean: true
    }),
    copy({
      targets: []
    }),
    terser()
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
