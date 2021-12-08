# sql-data-api-client-js
SQL Data Api client for Javascript

## Install

> npm install sql-data-api

## Set base URL

```js
import { setBaseUrl } from 'sql-data-api';

// ...

setBaseUrl('https://api.worksheet.systems');

```

## Authentication

There are two types of authentication.

1. you can set user name and password (use your Worksheet Systems account)

```js
import { authenticate } from 'sql-data-api';

await authenticate("testUser", "1111111")

```

2. Use `Api Access Token` generated https://app.worksheet.systems/account/settings/info

```js
import { setUserAccessToken } from 'sql-data-api';

setUserAccessToken('$ACCESS_TOKEN')
```

## Query Data

```js

// returns table as array of items
query(tableOrViewName: string, fieldsOrQuery?: string | SqlReadQueryInfo, queryInfoSettings?: SqlReadQueryInfo): Promise<ScalarObject[]>;

// Query specification
export interface SqlReadQueryInfo {
    fields?: string;
    filter?: string;
    filterParams?: Record<string, ScalarType>;
    skip?: number;
    top?: number;
    orderBy?: string;
    mainTableAlias?: string;
    joins?: [JoinType, string, string][];
}

```
### Query Usage

#### A simple queries

```js
import { sqlDataApi } from 'sql-data-api';

// returns all rows from the table
const allRows = await sqlDataApi('connectionName')
    .query('someTableOrViewName');

// returns two fields for all rows
const allRowsAndJustTwoFieds = await sqlDataApi('connectionName')
    .query('someTableOrViewName', 'Field1, Field2');

// returns two fields for UK
const allRowsAndJustTwoFieds = await sqlDataApi('connectionName')
    .query('someTableOrViewName', {
        fields: "F1, f2", 
        filter: "Country = @country",
        filterParams: {country: 'UK'},
        top: 1000,
        orderBy: "F2 DESC",
    });

```

#### SQL Functions

SQL Functions can be used in `fields` and `filter` properties

```js

const itwms = await sqlDataApi('connectionName')
    .query('someTableOrViewName', {
        fields: 'cast(DateTimeField as Date) SomeDate, concat(FirstName, '-', LastName") FullName',
        filter: "concat(FirstName, '-', LastName) = @fullName",
        filterParams: {fullName: 'Adam Smith'}
    });

```
#### Aggregated query

Add `groupBy|` prefix to the field and use aggregation functions e.g: sum, avg, count ...

```js

const aggData = await sqlDataApi('connectionName')
    .query('someTableOrViewName', {
        fields: 'groupBy|country, sum(revenue) revenue'
    });

```


## Save a array of items 

```js
save(tableName: string, items: ScalarObject[], itemsToDeleteOrSaveOptions?: Record<string, unknown>[] | SqlSaveOptions, saveOptions?: SqlSaveOptions): Promise<SqlSaveStatus>;

export interface SqlSaveOptions {
    method: "Merge" | "Append" | "BulkInsert";
    batchSize?: number;
    primaryKeys?: string[];
    batchProgressFunc?: (processedCount: number, status: SqlSaveStatus) => void;
}

saveWithAutoId(tableName: string, item: ScalarObject): Promise<number>;

sqlExecute(sql: string, params?: ScalarObject): Promise<ScalarObject[] | unknown>;

```

## License

A permissive MIT License (c) FalconSoft Ltd.
