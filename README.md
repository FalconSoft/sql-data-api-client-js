# sql-data-api-client-js
SQL Data Api client for Javascript

 - [Install](#install)
 - [Set Base Url](#set-base-url)
 - [Authenticate](#authenticate)
 - [Query Data From Sql Database](#query-tables-or-views)
 - [Save Data Into Sql Database](#saving-data)
    * [Save Array Of Object (Upsert(Merge) / Append / BulkInsert) ](#save-array-of-objects)
    * [Save With AutoId](#save-with-auto-id)
    * [Update](#update)
    * [Delete Array](#delete)
    * [Delete From](#delete-from)
 - [Sql Execute](#sql-execute)
 - [License](#license)

## Install

> npm install sql-data-api

## Set base URL

```js
import { setBaseUrl } from 'sql-data-api';

// ...

setBaseUrl('https://api.worksheet.systems');

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

## Query tables or views

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

SQL Data api allows you to safely and securely query data from SQL tables/views. And you can use SQL functions, rename SQL columns, aggregate (groupBy) and even join tables

There are several ways you can define a query to the SQL Database. But, eventually it comes down to the few properties you have to specify:

 - **tableName** - name of SQL table or view. Also, you can specify alias e.g. `myTable t`, then you have to list your fields as `t.Field1` etc
 - **fields** - a list of fields to select. If `fields` property is not provided, then all table fields will be returned. Kind of `select * from [tableName]`. Also, there are several other scenarios:
   * rename fields e.g. `Country CustomerCountry` or `cast(TransactionTime as Date) TransactionDate`
   * use SQL Functions e.g. `concat(FirstName, ' ', LastName) FullName`
   * aggregate (group by): `groupBy|Country, groupBy|City, sum(revenue) Revenue, count(*) Count`
- **filter** - defines a filter expression e.g. `country = 'uk' and city = 'London'` or you can use parameters and have filter as `country = @country AND city = @city` and provide parameters as an object`{country: 'UK', city: 'London'}`. And you can use SQL functions as well:  e.g.: `cast(TransactionTime as Date) = '2021-11-21'`
- **orderBy** - define a columns to sort e.g.: `OrderDate DESC, OrderId ASC
- **top**` - specify the number of records to return.
- **join** - combine rows from two or more tables, based on a related column between them. You can define array `[JoinType, TableToJoin, JoinCondition]` or:  `['InnerJoin', 'Customers c', 'c.CustomerId = t.CustomerId']`

### Query Examples

**A simple queries**

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
```

**a simple save (upsert) example**

```js
sqlDataApi('someConnection')
    .save('someTable', arrayOfItems)
```


### Save With Auto Id

Saves a single record into the database and returns autogenerated ID field value.
SQL Table should have Auto Indentity on one of the fields

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
   */
  async deleteFrom(
    tableName: string,
    filter?: string,
    filterParams?: Record<string, ScalarType>
  ): Promise<number> 
```

## SQL Execute

Executes `sql` script in the server and returns either raw table or array of objects 

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
   * @returns result as a list of arrays 
   */
  async sqlExecute(
    sql: string,
    params?: ScalarObject
  ): Promise<ScalarObject[] | unknown> 

```

## License

A permissive MIT License (c) FalconSoft Ltd.
