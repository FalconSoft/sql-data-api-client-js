# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

`sql-data-api` is a small TypeScript client library (published to npm) for the Worksheet Systems / FalconSoft "SQL Data API" HTTP service. It lets JavaScript callers query, save, update, delete and execute SQL against a named server-side connection without writing raw HTTP. There is no server code here; every method ultimately POSTs a JSON DTO to `{baseUrl}/sql-data-api/{connectionName}/<verb>/...` via axios.

## Commands

```bash
npm test                       # jest, runs src/**/*.spec.ts (ts-jest, diagnostics off)
npm run test:dev               # jest --watch
npx jest src/sql-data.api.spec.ts -t "maps the first"   # single file / single test by name
npm run build                  # rollup -c -> dist/ (UMD min + ESM + flattened .d.ts)
npm run dev                    # rollup dev config: unminified UMD to dist/, serves index.html with livereload
npm run lint                   # eslint . --ext .ts
npm run lint-fix
npm run build:publish          # build then npm publish (bump "version" in package.json first)
```

Tooling is pinned old on purpose: TypeScript 4.5, ESLint 7 with `@typescript-eslint` v4, Rollup 2. `tsconfig.json` sets `"types": []` because newer `@types/node` needs a newer TS. Don't upgrade these casually; `ts-jest` runs with `diagnostics: false` partly for the same reason.

## Layout

- `src/sql-data.api.ts` – the whole client: module-level config setters, `httpRequest`/`httpGet`/`httpPost`... helpers, the `SqlDataApi` class, and the `sqlDataApi()` factory. Re-exports `./db-types`.
- `src/db-types.ts` – `DbConnectionType`, per-vendor SQL type enums (SqlServer, PostgreSql, SybaseAse), `JoinType`, `TableJoinDto`.
- `src/db-type-converter.ts` + `db-type-converter-maps.ts` – `DbTypeConverter` maps between datapipe-js `DataTypeName` and vendor SQL types via lookup tables; exposed through `dbTypeConverter()`.
- `src/*.spec.ts` – jest tests; excluded from the TS build by `tsconfig.json`.
- `index.html` – a manual browser console (ace editor) that loads `dist/sql-data-api.min.js`; used with `npm run dev`.
- `dist/` – build output, git-ignored but the only thing published to npm (`files: ["dist"]`); `package.json` `main`/`module`/`typings` point here, so run `npm run build` before `npm publish`.

## Architecture notes

**Config is static + per-instance.** `setBaseUrl`, `setBearerToken`, `setUserAccessToken` and `authenticate()` write to static fields on `SqlDataApi`. The `sqlDataApi(connectionName, config?, abortSignal?)` factory copies those statics into instance fields, with explicit `config` values winning. The class constructor itself takes `(baseUrl, connectionName, {userAccessToken, bearerToken}, abortSignal)`; tests construct it directly.

**Auth is applied per request, in two ways.** A bearer token goes in an `Authorization` header; otherwise a user access token is appended as `?$accessToken=` on the URL. This block is duplicated in every request-building method (`_queryTable`, `saveData`, `saveWithAutoId`, `sqlExecuteRaw`); keep the pattern when adding endpoints.

**Fluent builder state lives on the instance and resets after `query()`.** `filter/andFilter/select/orderBy/top/join/table` mutate `this.queryInfo` / `this.tableName`; `query()` consumes and clears `queryInfo`. `query()` also accepts the same information as positional args (`tableName, fieldsOrQueryInfo, queryInfo`), and `_queryTable` reconciles the two forms. Joins are stored as tuples `[JoinType, "table alias", condition, condition2?]` and converted to `TableJoinDto[]` there; table aliases are parsed from `"Name alias"` strings.

**Wire format is tables, not objects.** The server returns `SqlQueryResponse` with a `table: TableDto` (`fieldNames`, `fieldDataTypes`, `rows`). Conversion to/from arrays of objects is done with datapipe-js `fromTable`/`toTable`. `sqlExecuteRaw` returns the response untouched (first result set in `table`, others in `additionalResultSets`, or `items` when the server was asked for `$output=items`); `sqlExecute` and `sqlExecuteMultiple` are thin mappers over it. `sqlExecuteRaw` decides `commandType` by whether the SQL contains a space (no space = stored procedure name).

**Dates are encoded, not serialized.** `toPrimitive()` turns `Date` values into `dt(<string>)` markers (via datapipe-js `dateToString`) before sending filter params, items and execute params.

**Saves are batched client-side.** `saveData` converts items to a table and POSTs chunks bounded by `batchSize` rows (default 10000) or ~1.5 MB of JSON, summing `inserted/updated/deleted` across chunks and invoking `batchProgressFunc` after each. `method` picks the endpoint: `save` (upsert), `append-data`, or `bulk-insert`. Passing an array as the third arg to `save()` means "items to delete" rather than options.

**Errors.** `httpRequest` never rejects; it returns `{isOk, errorMessage}` and the wrappers throw `Error(errorMessage)`. Axios cancellation becomes the message `"Request cancelled"`; `query()` additionally throws if the `AbortSignal` is already aborted after the call.

**Build.** `rollup.config.js` emits two bundles from one entry: UMD (`dist/sql-data-api.min.js`, terser, globals `Axios`/`dataPipeJs`/`dataPipeJsUtils`) and ESM (`dist/sql-data-api.esm.js`). `axios`, `datapipe-js` and `datapipe-js/utils` are externals. A custom `flattenDeclarations` plugin moves `.d.ts` files from `dist/src/` up to `dist/` because rollup-plugin-typescript2 ignores `rootDir` on Windows.

## Conventions

- The README doubles as the API reference; when adding or changing a public method, add/update its section there.
- Tests mock at the `sqlExecuteRaw` / HTTP boundary with `jest.spyOn` rather than hitting a server.
