# sql-data-api-client-js
SQL Data Api client for Javascript

 - [Install](#install)
 - [Set Base Url](#set-base-url)
 - [Authenticate](#authenticate)
 - [Query Data From Sql Database](#query-tables-or-views)
    * [Query Examples](#query-examples)
    * [Fluent Query API](#fluent-query-api)
    * [Query To Table](#query-to-table)
 - [Save Data Into Sql Database](#saving-data)
    * [Save Array Of Object (Upsert(Merge) / Append / BulkInsert) ](#save-array-of-objects)
    * [Save With AutoId](#save-with-auto-id)
    * [Update](#update)
    * [Delete Array](#delete)
    * [Delete From](#delete-from)
 - [Sql Execute](#sql-execute)
    * [Multiple result sets](#multiple-result-sets)
 - [Dates and parameters](#dates-and-parameters)
 - [Cancellation](#cancellation)
 - [Custom transport](#custom-transport)
 - [License](#license)

## Install

```
npm install sql-data-api
```

## Set base URL

```js
import { setBaseUrl } from 'sql-data-api';

// ...

setBaseUrl('https://api.worksheet.systems');

```

`setBaseUrl`, `setUserAccessToken` and `setBearerToken` set global defaults used by every `sqlDataApi(...)` instance.
You can also override them for a single instance:

```js
import { sqlDataApi } from 'sql-data-api';

const api = sqlDataApi('connectionName', {
    baseUrl: 'https://api.worksheet.systems',
    userAccessToken: '$ACCESS_TOKEN',   // or bearerToken: '...'
});
```

## Authenticate

All sql-api operations should be authenticated unless public access allowed. Check Worksheet Systems Access Control model

There are two types of authentication.

1. you can set user name and password (use your Worksheet Systems account) (least preferable as you have to hardcode password)

```js
import { authenticate } from 'sql-data-api';

await authenticate("testUser", "1111111")

```

2. Use `Api Access Token` generated https://app.worksheet.systems/account/settings/info

```js
import { setUserAccessToken } from 'sql-data-api';

setUserAccessToken('$ACCESS_TOKEN')
```

If you already have a JWT bearer token (e.g. obtained by `authenticate` in another place) you can set it directly:

```js
import { setBearerToken } from 'sql-data-api';

setBearerToken('$BEARER_TOKEN')
```

## Query tables or views

```js

// returns table as array of items
query(tableOrViewName?: string, fieldsOrQuery?: string | SqlReadQueryInfo, queryInfoSettings?: SqlReadQueryInfo): Promise<ScalarObject[]>;

// Query specification
export interface SqlReadQueryInfo {
    fields?: string;
    filter?: string;
    filterParams?: Record<string, ScalarType>;
    skip?: number;
    top?: number;
    orderBy?: string;
    mainTableAlias?: string;
    joins?: [JoinType, string, string, string?][];
}

```

SQL Data api allows you to safely and securely query data from SQL tables/views. And you can use SQL functions, rename SQL columns, aggregate (groupBy) and even join tables

There are several ways you can define a query to the SQL Database. But, eventually it comes down to the few properties you have to specify:

 - **tableName** - name of SQL table or view. Also, you can specify alias e.g. `myTable t`, then you have to list your fields as `t.Field1` etc
 - **fields** - a list of fields to select. If `fields` property is not provided, then all table fields will be returned. Kind of `select * from [tableName]`. Also, there are several other scenarios:
   * rename fields e.g. `Country CustomerCountry` or `cast(TransactionTime as Date) TransactionDate`
   * use SQL Functions e.g. `concat(FirstName, ' ', LastName) FullName`
   * aggregate (group by): `groupBy|Country, groupBy|City, sum(revenue) Revenue, count(*) Count`
 - **filter** - defines a filter expression e.g. `country = 'uk' and city = 'London'` or you can use parameters and have filter as `country = @country AND city = @city` and provide parameters as an object `{country: 'UK', city: 'London'}`. And you can use SQL functions as well:  e.g.: `cast(TransactionTime as Date) = '2021-11-21'`
 - **orderBy** - define a columns to sort e.g.: `OrderDate DESC, OrderId ASC`
 - **top** - specify the number of records to return.
 - **skip** - specify the number of records to skip (use together with `orderBy` and `top` for paging).
 - **join** - combine rows from two or more tables, based on a related column between them. You can define array `[JoinType, TableToJoin, JoinCondition, JoinCondition2?]` e.g.:  `['InnerJoin', 'Customers c', 'c.CustomerId = t.CustomerId']`. `JoinType` is one of `InnerJoin`, `LeftJoin`, `RightJoin`, `FullJoin`

### Query Examples

**A simple queries**

```js
import { sqlDataApi } from 'sql-data-api';

// returns all rows from the table
const allRows = await sqlDataApi('connectionName')
    .query('someTableOrViewName');

// returns two fields for all rows
const twoFields = await sqlDataApi('connectionName')
    .query('someTableOrViewName', 'Field1, Field2');

// returns two fields for UK
const twoFieldsForUk = await sqlDataApi('connectionName')
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

const items = await sqlDataApi('connectionName')
    .query('someTableOrViewName', {
        fields: "cast(DateTimeField as Date) SomeDate, concat(FirstName, ' ', LastName) FullName",
        filter: "concat(FirstName, ' ', LastName) = @fullName",
        filterParams: {fullName: 'Adam Smith'}
    });

```
#### Aggregated query

Add `groupBy|` prefix to the field you want to `group by` and use aggregation functions e.g: sum, avg, count ...

```js
const aggData = await sqlDataApi('connectionName')
    .query('someTableOrViewName', {
        fields: 'groupBy|country, sum(revenue) revenue'
    });

```

or with the same result

```js
const aggData = await sqlDataApi('connectionName')
    .query(
        'someTableOrViewName',
        'groupBy|country, sum(revenue) revenue'
    );
```

#### Joins

```js
const orders = await sqlDataApi('connectionName')
    .query('Orders o', {
        fields: 'o.OrderId, o.OrderDate, c.CustomerName',
        joins: [
            ['InnerJoin', 'Customers c', 'c.CustomerId = o.CustomerId']
        ]
    });
```

### Fluent Query API

The same query can be built step by step. Every builder method returns the same `SqlDataApi` instance,
and `query()` sends the request and resets the builder.

```js
const ukOrders = await sqlDataApi('connectionName')
    .table('Orders o')
    .select('o.OrderId, o.OrderDate, c.CustomerName')
    .innerJoin('Customers c', 'c.CustomerId = o.CustomerId')
    .filter('c.Country = @country', { country: 'UK' })
    .andFilter('o.OrderDate >= @from', { from: new Date(2024, 0, 1) })
    .orderBy('o.OrderDate DESC')
    .top(100)
    .query();
```

Builder methods:

 - `table(name)` - table or view (with optional alias)
 - `select(fields)`
 - `filter(filter, filterParams?)` - replaces the filter
 - `andFilter(filter, filterParams?)` - appends a condition with `AND` and merges parameters
 - `orderBy(orderBy)`
 - `top(top)`
 - `innerJoin(table, condition)`, `leftJoin(table, condition)`, `rightJoin(table, condition)`, `join(joinType, table, condition, condition2?)`

### Query To Table

`queryToTable` takes the same arguments as `query` but returns the raw table (`{ fieldNames, fieldDataTypes, rows }`)
instead of an array of objects. This is cheaper for large result sets.

```js
queryToTable(tableOrViewName: string, fieldsOrQuery?: string | SqlReadQueryInfo, queryInfoSettings?: SqlReadQueryInfo): Promise<Table<PrimitiveType>>;
```

## Saving Data

### Save array of objects

Upsert(Merge), Append or BulkInsert an array of items into the table based on save options
If third parameter is an array, it will delete records from the table. Only Key Fields must be provided

```js
save(
    tableName: string,
    items: ScalarObject[],
    itemsToDeleteOrSaveOptions?: Record<string, unknown>[] | SqlSaveOptions,
    saveOptions?: SqlSaveOptions
): Promise<SqlSaveStatus>;

/**
 * Sql Save operation config
 */
export interface SqlSaveOptions {
  /**
   * save types
   */
  method: "Merge" | "Append" | "BulkInsert";

  /**
   * a batch size for optimization point
   */
  batchSize?: number;
  /**
   * Define a primary key that should be used. Normally primary keys are taken from the table,
   * Use this property only if you want to upsert (merge) data on some other fields
   */
  primaryKeys?: string[];

  /**
   * Report progress on batch saving
   */
  batchProgressFunc?: (processedCount: number, status: SqlSaveStatus) => void;
}

/**
 * Sql Save result. When data is saved in several batches the numbers are summed up
 */
export interface SqlSaveStatus {
  inserted: number;
  updated: number;
  deleted: number;
}
```

Items are sent in batches of `batchSize` rows (default 10000) or ~1.5 MB of JSON, whichever comes first.
`batchProgressFunc` is called after every batch with the number of rows processed so far.

**a simple save (upsert) example**

```js
const status = await sqlDataApi('someConnection')
    .save('someTable', arrayOfItems)
```

**append with progress reporting**

```js
await sqlDataApi('someConnection')
    .save('someTable', arrayOfItems, {
        method: 'Append',
        batchSize: 5000,
        batchProgressFunc: (processed, status) => console.log(processed, status)
    })
```

**upsert and delete in one call**

```js
await sqlDataApi('someConnection')
    .save('someTable', itemsToUpsert, [{ id: 10 }, { id: 11 }])
```


### Save With Auto Id

Saves a single record into the database and returns autogenerated ID field value.
SQL Table should have Auto Identity on one of the fields

```js
const person = {
    name: 'Adam'
}

// table peopleTable should have Identity column
person.id = await sqlDataApi('someConnection')
    .saveWithAutoId('peopleTable', person);

console.log(person)
```

### Update

Updates data in the table based on filter parameter and returns number of rows affected

```js
  /**
   * Updates data in the table based on filter parameters
   * @returns Number of rows affected
   */
  async updateData(
    tableName: string,
    updateData: Record<string, ScalarType>,
    filter?: string,
    filterParams?: Record<string, ScalarType>
  ): Promise<number>

  const affected = await sqlDataApi('someConnection')
    .updateData('Customers', { Status: 'Active' }, 'Country = @country', { country: 'UK' });
```

### Delete

Deletes rows from the table based on a primary keys. Only key fields have to be provided

```js
  /**
   * Deletes rows from the table. Only key fields have to be provided
   * @returns success
   */
  async delete(
    tableName: string,
    items: Record<string, ScalarType>[]
  ): Promise<boolean>
```


### Delete From

Delete records from the table based on filter criteria

```js
  /**
   * Delete records from the table based on filter criteria
   * @returns Number of rows affected
   */
  async deleteFrom(
    tableName: string,
    filter?: string,
    filterParams?: Record<string, ScalarType>
  ): Promise<number>
```

## SQL Execute

Executes `sql` script or a stored procedure in the server and returns either raw response or an array of objects.
If `sql` contains no whitespace it is treated as a stored procedure name, otherwise as a SQL text.

```js
  /**
   * Executes a SQL Query or stored procedure with parameters
   * @returns Raw result (SqlQueryResponse) with a table in it
   */
  async sqlExecuteRaw(
    sql: string,
    params?: ScalarObject,
    paramDirections?: Record<string, string>
  ): Promise<SqlQueryResponse>

  /**
   * Executes a SQL Query or stored procedure with parameters
   * @returns the first result set as an array of objects
   */
  async sqlExecute(
    sql: string,
    params?: ScalarObject
  ): Promise<ScalarObject[] | unknown>

  const rows = await sqlDataApi('myConnection')
    .sqlExecute('SELECT * FROM Orders WHERE Country = @country', { country: 'UK' });
```

`sqlExecuteRaw` returns the untouched server response:

```js
export interface SqlQueryResponse {
  resultType: "Table" | "Items";
  table?: TableDto;               // first result set as a table ({ fieldNames, fieldDataTypes, rows })
  items?: PrimitivesObject[];     // first result set as objects, when the server answered with items
  fields?: SqlResultFieldInfo[];  // column metadata
  additionalResultSets?: SqlResultSet[];
  message?: string;               // e.g. "3 records affected."
  outputParameters?: Record<string, any>;
}
```

Stored procedure output parameters can be requested with `paramDirections` (e.g. `{ total: 'Output' }`) and are returned in `outputParameters`.

### Multiple result sets

A script with several `SELECT` statements (or a stored procedure that returns several result sets) can be executed with `sqlExecuteMultiple`. Every result set comes back as an array of objects, in the order the database returned them. Statements that do not return rows (`UPDATE`, `DELETE`) are not included; their row counts are reported in `message`.

```js
  async sqlExecuteMultiple(
    sql: string,
    params?: ScalarObject,
    paramDirections?: Record<string, string>
  ): Promise<SqlExecuteResult>

  export interface SqlExecuteResult {
    resultSets: ScalarObject[][];
    message?: string;
    outputParameters?: Record<string, any>;
  }

  const { resultSets, message } = await sqlDataApi('myConnection')
    .sqlExecuteMultiple('SELECT * FROM Orders; SELECT * FROM Customers');
  // resultSets[0] -> orders, resultSets[1] -> customers
```

`sqlExecuteRaw` exposes the same data untouched: the first result set in `table`, the rest in `additionalResultSets`.

## Dates and parameters

JavaScript `Date` values can be used anywhere parameters or items are sent (`filterParams`, `save` items, `updateData`, `sqlExecute` params).
They are encoded for the server automatically, so there is no need to format dates as strings.

## Cancellation

Any http request can be cancelled with a standard `AbortSignal`.

```js
setAbortSignal(signal?: AbortSignal): SqlDataApi
```

The signal can be passed to the factory function, to the constructor, or set with the chaining method:

```js
const controller = new AbortController();

const api = sqlDataApi('connectionName', undefined, controller.signal);
// or
const api = sqlDataApi('connectionName').setAbortSignal(controller.signal);

const request = api.query('someTable');
controller.abort();

await request; // rejects with Error("Request cancelled")
```

For batched saves, aborting stops before the next batch is sent.

## Custom transport

By default every request is sent with axios. When the library runs in an environment where plain HTTP
is not available or not wanted (for example inside a desktop host that talks to the server in-process),
the whole HTTP layer can be replaced with a single function:

```js
import { setRequestHandler } from 'sql-data-api';

setRequestHandler(async (request) => {
  // request: { method, url, body, headers, signal, config }
  //   method  - 'GET' | 'POST' | 'PUT' | 'DELETE'
  //   url     - absolute URL built from the base URL (may carry ?$accessToken=)
  //   body    - the raw request body (object), undefined when there is none
  //   headers - merged headers, including 'Authorization' and 'Content-Type'
  //   signal  - optional AbortSignal
  const reply = await myBridge.send(request);

  // must resolve (never reject) with:
  return {
    data: reply.body,          // parsed response body
    isOk: reply.status < 400,
    status: reply.status,      // 0 for transport-level failures
    statusText: reply.statusText,
    errorMessage: reply.status < 400 ? undefined : reply.message, // makes the wrappers throw
  };
});

setRequestHandler(null); // restore the default axios transport
```

`setRequestHandler` affects every `sqlDataApi(...)` instance as well as `httpGet`, `httpPost`, `httpPut`,
`httpDelete` and `authenticate`. Report cancellation with `errorMessage: "Request cancelled"`.


## License

A permissive MIT License (c) FalconSoft Ltd.
