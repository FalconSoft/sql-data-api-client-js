import axios, { AxiosRequestConfig } from "axios";
import {
  PrimitivesObject,
  PrimitiveType,
  ScalarObject,
  ScalarType,
  Table,
  TableDto,
} from "datapipe-js";
import { dateToString, fromTable, toTable } from "datapipe-js/utils";
import { DbTypeConverter } from "./db-type-converter";
import { JoinType, TableJoinDto } from "./db-types";

export * from "./db-types";

const appHttpHeaders = {
  "Content-Type": "application/json",
};

/**
 * Interface that represents a SQL save result
 */
export interface SqlSaveStatus {
  /**
   * Number of inserted row
   */
  inserted: number;

  /**
   * Number of updated row
   */
  updated: number;

  /**
   * Number of deleted row
   */
  deleted: number;
}

/**
 * Sql Query configuration
 */
export interface SqlReadQueryInfo {
  /**
   * A list of comma separated fields to select.
   * Examples:
   *  - 'Field1, Field2'
   *  - 't.Field1, t.Field2' - where t is an alias
   *  - 'concat(FirstName, ' ', LastName) FullName, AnotherField' - you can use SQL functions
   *  - 'groupBy|Country, sum(profit) Profit' - aggregated query.
   */
  fields?: string;

  /**
   * A filter expression. Where you can use SQL functions, aliases and parameters
   * Examples:
   *  - "Country = 'UK'"
   *  - "Country = @country AND City = @city"
   *  - "concat(t.FirstName, ' ', t.LastName) = @fullName"
   */
  filter?: string;

  /**
   * A filter parameters used in an expresiion
   * e.g: {country: 'UK', fullName: 'Adam Smith'}
   */
  filterParams?: Record<string, ScalarType>;

  /**
   * Number of rows to skip
   */
  skip?: number;

  /**
   * top rows to take
   */
  top?: number;

  /**
   * Define a sortings fields
   */
  orderBy?: string;

  /**
   * Alias for main table. But default it is undefined
   */
  mainTableAlias?: string;

  /**
   * joins tables together
   * Examples:
   *  - ['InnerJoin', 'Customers c', 't.CustomerId = c.CustomerID'] - inner joins mainTable to Cutomers table
   */
  joins?: [JoinType, string, string, string?][];
}

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

export interface SqlQueryResponse {
  message?: string;
  table?: TableDto;
  outputParameters?: Record<string, any>;
  resultType: "Table" | "Items";
  items?: PrimitivesObject[];
}

/**
 * Set Base URL for SQL data api
 * @param baseUrl
 */
export function setBaseUrl(baseUrl: string): void {
  SqlDataApi.BaseUrl = baseUrl;
}

/**
 * set bearer token for authentication
 * @param bearerToken
 */
export function setBearerToken(bearerToken: string): void {
  SqlDataApi.BearerToken = bearerToken;
}

/**
 * Set api Access Token issued by Worksheet System's API
 * @param userAccessToken
 */
export function setUserAccessToken(userAccessToken: string): void {
  SqlDataApi.UserAccessToken = userAccessToken;
}

/**
 * Use Worksheet Systems' username and password to Authenticate for further api calls.
 * It logins you and set bearer token for further api calls
 */
export async function authenticate(
  username: string,
  password: string
): Promise<boolean> {
  const res = await httpRequest(
    "POST",
    `${SqlDataApi.BaseUrl}/api/security/authenticate`,
    { username, password },
    { headers: appHttpHeaders }
  );

  if (res.errorMessage) {
    throw new Error(res.errorMessage);
  }

  SqlDataApi.BearerToken = (res.data as { token: string }).token;
  return true;
}

/**
 * A factory function that creates SqlDataApi instance
 * @param connectionName connectionName
 * @param config define baseUrl, apiAccessToken or bearer token
 * @returns
 */
export function sqlDataApi(
  connectionName: string,
  config?: { baseUrl?: string; userAccessToken?: string; bearerToken?: string },
  abortController?: AbortController
): SqlDataApi {
  const cfg = {
    userAccessToken: config?.userAccessToken || SqlDataApi.UserAccessToken,
    bearerToken: config?.bearerToken || SqlDataApi.BearerToken,
  };
  return new SqlDataApi(
    config?.baseUrl || SqlDataApi.BaseUrl,
    connectionName,
    cfg,
    abortController
  );
}

export function dbTypeConverter(): DbTypeConverter {
  return new DbTypeConverter();
}

export function httpRequest<TRequest, TResponse>(
  method: "GET" | "POST" | "PUT" | "DELETE",
  url: string,
  body?: TRequest,
  config?: Record<string, any>
): Promise<ServerResponse<TResponse>> {
  const requestConfig: AxiosRequestConfig = { method, url, ...(config || {}) };

  if (body) {
    requestConfig.data = typeof body === "object" ? JSON.stringify(body) : body;
    if (!requestConfig.headers) {
      requestConfig.headers = {};
    }
    if (!requestConfig.headers["Content-Type"]) {
      requestConfig.headers["Content-Type"] = "application/json";
    }
  }

  return axios.request(requestConfig).then(
    (r: ServerResponse<TResponse>): ServerResponse<TResponse> => ({
      data: r.data,
      isOk: true,
      status: r.status,
      statusText: r.statusText,
    }),
    (e) => {
      // making an error more informative.
      // this was a reason why we switched to axios, as it gives us a real exception details,
      // beyond a statusText
      const response = e.response || {};
      let errorMessage =
        (response.data || {}).message ||
        response.data ||
        response.statusText ||
        "Http Connection Error";
      if (typeof errorMessage === "object") {
        errorMessage = JSON.stringify(errorMessage);
      }

      return {
        isOk: false,
        status: response.status,
        statusText: response.statusText,
        data: null as any,
        errorMessage,
      };
    }
  );
}

export function httpGet<TResponse>(
  url: string,
  config?: Record<string, any>
): Promise<TResponse> {
  return httpRequest("GET", url, null, config).then((r) => {
    if (!r.errorMessage) {
      return r.data as TResponse;
    }
    throw new Error(r.errorMessage);
  });
}

export function httpGetText(
  url: string,
  config?: Record<string, any>
): Promise<string> {
  const headers = config?.headers || {};
  headers["Content-Type"] = "text/plain";

  if (!config) {
    config = {};
  }

  config.headers = headers;

  return httpRequest("GET", url, null, config).then((r) => {
    if (!r.errorMessage) {
      return r.data as string;
    }
    throw new Error(r.errorMessage);
  });
}

export function httpPost<TRequest, TResponse>(
  url: string,
  body: TRequest,
  config?: Record<string, any>
): Promise<TResponse> {
  return httpRequest("POST", url, body, config).then((r) => {
    if (!r.errorMessage) {
      return r.data as TResponse;
    }
    throw new Error(r.errorMessage);
  });
}

export function httpPut<TRequest, TResponse>(
  url: string,
  body: TRequest,
  config?: Record<string, any>
): Promise<TResponse> {
  return httpRequest("PUT", url, body, config).then((r) => {
    if (!r.errorMessage) {
      return r.data as TResponse;
    }
    throw new Error(r.errorMessage);
  });
}

export function httpDelete<TRequest, TResponse>(
  url: string,
  body: TRequest,
  config?: Record<string, any>
): Promise<TResponse> {
  return httpRequest("DELETE", url, body, config).then((r) => {
    if (!r.errorMessage) {
      return r.data as TResponse;
    }
    throw new Error(r.errorMessage);
  });
}

/**
 *
 */
export class SqlDataApi {
  private readonly userAccessToken?: string;
  private readonly bearerToken?: string;

  private queryInfo: SqlReadQueryInfo = {};
  private tableName = "";

  static BaseUrl: string;
  static UserAccessToken: string;
  static BearerToken: string;

  constructor(
    private baseUrl: string,
    private connectionName: string,
    config: { userAccessToken?: string; bearerToken?: string },
    private abortController?: AbortController
    ) {
    this.userAccessToken = config?.userAccessToken;
    this.bearerToken = config?.bearerToken;
  }

  // fluent API methods
  /**
   * sets filter and returns same
   * - use this method for a fluent API
   * @param filter filter string e.g. "country='UK' or city=@city"
   * @param filterParams filter parameters e.g. {city: 'London'}
   * @returns same SqlDataApi instance
   */
  filter(
    filter: string,
    filterParams?: Record<string, ScalarType>
  ): SqlDataApi {
    this.queryInfo.filter = filter;
    this.queryInfo.filterParams = filterParams;
    return this;
  }

  // fluent API methods
  /**
   * Append filter (with AND) and returns same
   * - use this method for a fluent API
   * @param filter filter string e.g. "country='UK' or city=@city"
   * @param filterParams filter parameters e.g. {city: 'London'}
   * @returns same SqlDataApi instance
   */
  andFilter(
    filter: string,
    filterParams?: Record<string, ScalarType>
  ): SqlDataApi {
    const cf = this.queryInfo.filter || "";
    this.queryInfo.filter = `${cf} ${cf ? " AND " : ""} ${filter}`.trim();
    this.queryInfo.filterParams = {
      ...(this.queryInfo.filterParams || {}),
      ...filterParams,
    };
    return this;
  }

  /**
   * sets fields that you want to setup
   * - use this method for a fluent API
   * @param fields - a a list of fields separated by comma
   * @returns same SqlDataApi instance
   */
  select(fields: string): SqlDataApi {
    this.queryInfo.fields = fields;
    return this;
  }

  orderBy(orderBy: string): SqlDataApi {
    this.queryInfo.orderBy = orderBy;
    return this;
  }

  top(top: number | string): SqlDataApi {
    this.queryInfo.top = +top;
    return this;
  }

  innerJoin(tableName: string, joinCondition: string): SqlDataApi {
    return this.join(JoinType.InnerJoin, tableName, joinCondition);
  }

  leftJoin(tableName: string, joinCondition: string): SqlDataApi {
    return this.join(JoinType.LeftJoin, tableName, joinCondition);
  }

  rightJoin(tableName: string, joinCondition: string): SqlDataApi {
    return this.join(JoinType.RightJoin, tableName, joinCondition);
  }

  join(
    joinType: JoinType,
    tableName: string,
    joinCondition: string,
    joinCondition2?: string
  ): SqlDataApi {
    if (!this.queryInfo.joins) {
      this.queryInfo.joins = [];
    }
    this.queryInfo.joins.push([
      joinType,
      tableName,
      joinCondition,
      joinCondition2,
    ]);
    return this;
  }

  table(name: string): SqlDataApi {
    this.tableName = name;
    return this;
  }
  // end fluent query methods

  /**
   * queries data from SQL Server
   * @returns An array of items
   */
  async query(
    tableOrViewName?: string,
    fieldsOrQuery?: string | SqlReadQueryInfo,
    queryInfoSettings?: SqlReadQueryInfo
  ): Promise<ScalarObject[]> {
    const qInfo = Object.keys(this.queryInfo).length
      ? this.queryInfo
      : undefined;
    const result = await this._query(
      tableOrViewName || this.tableName,
      fieldsOrQuery || this.queryInfo?.fields,
      queryInfoSettings || qInfo
    );
    // reset query that it is not used in another call
    this.queryInfo = {};
    return result;
  }

  /**
   * queries data from SQL table/view and returns results as a TableDto
   */
  async queryToTable(
    tableOrViewName: string,
    fieldsOrQuery?: string | SqlReadQueryInfo,
    queryInfoSettings?: SqlReadQueryInfo
  ): Promise<Table<PrimitiveType>> {
    return await this._queryTable(
      tableOrViewName,
      fieldsOrQuery,
      queryInfoSettings
    );
  }

  setAbortController(abortController: AbortController): SqlDataApi {
    this.abortController = abortController;
    return this;
  }

  /**
   * Updates data in the table based on filter parameters
   * @returns Number of rows affected
   */
  async updateData(
    tableName: string,
    updateData: Record<string, ScalarType>,
    filter?: string,
    filterParams?: Record<string, ScalarType>
  ): Promise<number> {
    let url = `${this.baseUrl}/sql-data-api/${this.connectionName}/update-data/${tableName}`;

    filterParams = this.toPrimitive(filterParams || {});

    const dto = {
      updateProperties: this.toPrimitive(updateData || {}),
      filter: {
        filterString: filter,
        filterParameters: filterParams,
      },
    };

    // set authentication code
    const headers = {} as Record<string, string>;
    if (this.bearerToken) {
      headers["Authorization"] = `Bearer ${this.bearerToken}`;
    } else if (this.userAccessToken) {
      url += `?$accessToken=${this.userAccessToken}`;
    }

    const httpConfig: AxiosRequestConfig = {
      headers: Object.assign(appHttpHeaders, headers),
    };

    if (this.abortController) {
      httpConfig.signal = this.abortController.signal;
    }

    const res = await httpRequest("POST", url, dto, httpConfig);

    if (res.errorMessage) {
      throw new Error(res.errorMessage);
    }

    const result = res.data as number;
    return result;
  }

  /**
   * Delete records from the table based on filter criteria
   */
  async deleteFrom(
    tableName: string,
    filter?: string,
    filterParams?: Record<string, ScalarType>
  ): Promise<number> {
    let url = `${this.baseUrl}/sql-data-api/${this.connectionName}/delete-from/${tableName}`;

    filterParams = this.toPrimitive(filterParams || {});

    const dto = {
      filterString: filter,
      filterParameters: filterParams,
    };

    // set authentication code
    const headers = {} as Record<string, string>;
    if (this.bearerToken) {
      headers["Authorization"] = `Bearer ${this.bearerToken}`;
    } else if (this.userAccessToken) {
      url += `?$accessToken=${this.userAccessToken}`;
    }

    const httpConfig: AxiosRequestConfig = {
      headers: Object.assign(appHttpHeaders, headers),
    };

    if (this.abortController) {
      httpConfig.signal = this.abortController.signal;
    }

    const res = await httpRequest("POST", url, dto, httpConfig);

    if (res.errorMessage) {
      throw new Error(res.errorMessage);
    }

    const result = res.data as number;
    return result;
  }

  /**
   * Deletes rows from the table based on a primary keys. Only key fields have to be provided
   * @returns success
   */
  async delete(
    tableName: string,
    items: Record<string, ScalarType>[]
  ): Promise<boolean> {
    const itemsToDelete = Array.isArray(items) ? items : [items];
    await this.saveData(tableName, undefined, itemsToDelete);
    return true;
  }

  /**
   * Upsert(Merge), Append or BulkInsert an array of items into the table based on save options
   * If third parameter is an array, it will delete records from the table. Only Key Fields must be provided
   *  Example with a simple default options, that will merge array of items into the table:
   *   - sqlDataApi('someConnection').save('someTable', arrayOfItems)
   * @param tableName table Name
   * @param items an array of items to store. Only primary key fields are mandatory
   * @param itemsToDeleteOrSaveOptions items to delete or SaveOptions object
   * @param saveOptions  SaveOptions Object
   * @returns
   */
  async save(
    tableName: string,
    items: ScalarObject[],
    itemsToDeleteOrSaveOptions?: Record<string, unknown>[] | SqlSaveOptions,
    saveOptions?: SqlSaveOptions
  ): Promise<SqlSaveStatus> {
    let itemsToDelete: Record<string, ScalarType>[] | undefined = undefined;
    if (
      !saveOptions &&
      itemsToDeleteOrSaveOptions &&
      !Array.isArray(itemsToDeleteOrSaveOptions)
    ) {
      saveOptions = itemsToDeleteOrSaveOptions as SqlSaveOptions;
    } else if (
      itemsToDeleteOrSaveOptions &&
      Array.isArray(itemsToDeleteOrSaveOptions)
    ) {
      itemsToDelete = itemsToDeleteOrSaveOptions as Record<
        string,
        ScalarType
      >[];
    }

    return await this.saveData(tableName, items, itemsToDelete, saveOptions);
  }

  /**
   * Saves a single record into the database and returns autogenerated ID field.
   * SQL Table should have Auto Indentity on one of the fields
   * @returns
   */
  async saveWithAutoId(tableName: string, item: ScalarObject): Promise<number> {
    let url = `${this.baseUrl}/sql-data-api/${this.connectionName}/save-with-autoid/${tableName}`;
    const dto = this.toPrimitive(item);

    // set authentication code
    const headers = {} as Record<string, string>;
    if (this.bearerToken) {
      headers["Authorization"] = `Bearer ${this.bearerToken}`;
    } else if (this.userAccessToken) {
      url += `?$accessToken=${this.userAccessToken}`;
    }

    const httpConfig: AxiosRequestConfig = {
      headers: Object.assign(appHttpHeaders, headers),
    };

    if (this.abortController) {
      httpConfig.signal = this.abortController.signal;
    }

    const res = await httpRequest("POST", url, dto, httpConfig);

    if (res.errorMessage) {
      throw new Error(res.errorMessage);
    }

    const result = res.data as number;
    return result;
  }

  /**
   * Executes a SQL Query or stored procedure with parameters
   * @returns Raw result (SqlQueryResponse) with a table in it
   */
  async sqlExecuteRaw(
    sql: string,
    params?: ScalarObject,
    paramDirections?: Record<string, string>
  ): Promise<SqlQueryResponse> {
    sql = sql?.trim() || "";
    if (!sql.length) {
      throw new Error("sql text is not provided");
    }
    if (!this.connectionName?.length) {
      throw new Error("connection is not provided");
    }

    if (params) {
      params = this.toPrimitive(params);
    }

    const dto = {
      commandType: sql.indexOf(" ") > 0 ? "Text" : "StoredProcedure",
      sql,
      params,
      paramDirections,
    } as ExecuteSqlDto;

    let url = `${this.baseUrl}/sql-data-api/${this.connectionName}/execute`;

    // set authentication code
    const headers = {} as Record<string, string>;
    if (this.bearerToken) {
      headers["Authorization"] = `Bearer ${this.bearerToken}`;
    } else if (this.userAccessToken) {
      url += `?$accessToken=${this.userAccessToken}`;
    }

    const httpConfig: AxiosRequestConfig = {
      headers: Object.assign(appHttpHeaders, headers),
    };

    if (this.abortController) {
      httpConfig.signal = this.abortController.signal;
    }

    const res = await httpRequest("POST", url, dto, httpConfig);

    if (res.errorMessage) {
      throw new Error(res.errorMessage);
    }

    const result = res.data as SqlQueryResponse;

    return result;
  }

  /**
   * Executes a SQL Query or stored procedure with parameters
   * @returns result as a list of arrays
   */
  async sqlExecute(
    sql: string,
    params?: ScalarObject
  ): Promise<ScalarObject[] | unknown> {
    const response = await this.sqlExecuteRaw(sql, params);
    return response ? fromTable(response.table as TableDto) : response;
  }

  private async saveData(
    tableName: string,
    items?: Record<string, ScalarType>[],
    itemsToDelete?: Record<string, ScalarType>[],
    saveOptions?: SqlSaveOptions
  ): Promise<SqlSaveStatus> {
    const maxTableSize = 1500000;
    const maxRowsCount = saveOptions?.batchSize || 10000;
    const primaryKeys = saveOptions?.primaryKeys || undefined;
    const batchSavedFunc = saveOptions?.batchProgressFunc;
    const saveMethod =
      saveOptions?.method?.toLowerCase() === "append"
        ? "append-data"
        : saveOptions?.method?.toLowerCase() === "bulkinsert"
        ? "bulk-insert"
        : "save";

    let url = `${this.baseUrl}/sql-data-api/${this.connectionName}/${saveMethod}/${tableName}`;

    // set authentication code
    const headersValue = {} as Record<string, string>;
    if (this.bearerToken) {
      headersValue.Authorization = `Bearer ${this.bearerToken}`;
    } else if (this.userAccessToken) {
      url += `?$accessToken=${this.userAccessToken}`;
    }
    const status: SqlSaveStatus = {
      inserted: 0,
      updated: 0,
      deleted: 0,
    };

    itemsToDelete = itemsToDelete?.map((r) => this.toPrimitive(r));

    if (!items || !items.length) {
      if (itemsToDelete?.length) {
        const httpConfig: AxiosRequestConfig = {
          headers: Object.assign(appHttpHeaders, headersValue),
        };

        if (this.abortController) {
          httpConfig.signal = this.abortController.signal;
        }

        const res = await httpRequest(
          "POST",
          url,
          { itemsToDelete },
          httpConfig
        );

        if (res.errorMessage) {
          throw new Error(res.errorMessage);
        }

        return res.data as SqlSaveStatus;
      } else {
        return status;
      }
    } else {
      const table = toTable(items) as TableDto;

      ///////////////

      const allRows = table.rows;

      const body = {
        tableData: {
          fieldNames: table.fieldNames,
          rows: [],
        } as TableDto,
        itemsToDelete,
        primaryKeys,
      };

      let currentIndex = -1;
      let currentSize = 0;

      while (++currentIndex < allRows.length) {
        const row = allRows[currentIndex];
        body.tableData.rows.push(row);
        currentSize += JSON.stringify(allRows[currentIndex]).length;

        if (
          currentIndex + 1 >= allRows.length ||
          body.tableData.rows.length >= maxRowsCount ||
          currentSize > maxTableSize
        ) {
          // set authentication code
          const headersValue = {} as Record<string, string>;
          if (this.bearerToken) {
            headersValue.Authorization = `Bearer ${this.bearerToken}`;
          } else if (
            this.userAccessToken &&
            url.indexOf("?$accessToken=") < 0
          ) {
            url += `?$accessToken=${this.userAccessToken}`;
          }

          const httpConfig: AxiosRequestConfig = {
            headers: Object.assign(appHttpHeaders, headersValue),
          };

          if (this.abortController) {
            if (this.abortController.signal?.aborted) break;
            httpConfig.signal = this.abortController.signal;
          }

          const res = await httpRequest("POST", url, body, httpConfig);

          if (res.errorMessage) {
            throw new Error(res.errorMessage);
          }

          const singleStatus = res.data as SqlSaveStatus;

          if (typeof batchSavedFunc === "function") {
            batchSavedFunc(currentIndex + 1, singleStatus);
          }

          status.inserted += singleStatus.inserted;
          status.updated += singleStatus.updated;
          status.deleted += singleStatus.deleted;
          currentSize = 0;
          body.tableData.rows = [];
        }
      }

      return status;
    }
  }

  private toPrimitive(obj: ScalarObject): PrimitivesObject {
    const scalarToPrimitive = (
      val: ScalarType | ScalarType[]
    ): PrimitiveType | PrimitiveType[] => {
      if (Array.isArray(val)) {
        return val.map((v) => scalarToPrimitive(v)) as PrimitiveType[];
      }
      return val instanceof Date ? `dt(${dateToString(val)})` : val;
    };

    const result: PrimitivesObject = {};
    Object.keys(obj).forEach(
      (k) => (result[k] = scalarToPrimitive(obj[k]) as PrimitiveType)
    );

    return result;
  }

  private async _query(
    tableOrViewName: string,
    fieldsOrQuery?: string | SqlReadQueryInfo,
    queryInfoSettings?: SqlReadQueryInfo
  ): Promise<ScalarObject[]> {
    const table = await this._queryTable(
      tableOrViewName,
      fieldsOrQuery,
      queryInfoSettings
    );
    return fromTable(table);
  }

  private async _queryTable(
    tableOrViewName: string,
    fieldsOrQuery?: string | SqlReadQueryInfo,
    queryInfoSettings?: SqlReadQueryInfo
  ): Promise<Table<PrimitiveType>> {
    if (!tableOrViewName?.length) {
      return Promise.reject(new Error("Table Name is not specified"));
    }

    let queryInfo = queryInfoSettings;

    if (!queryInfo && typeof fieldsOrQuery === "object") {
      queryInfo = fieldsOrQuery;
    }

    queryInfo = queryInfo || ({} as SqlReadQueryInfo);

    const fields =
      typeof fieldsOrQuery === "string" &&
      fieldsOrQuery &&
      fieldsOrQuery !== "*"
        ? (fieldsOrQuery as string)
        : queryInfo?.fields;

    function extractNameAndAlias(tableOrViewWithAlias: string): {
      name: string;
      alias?: string;
    } {
      tableOrViewWithAlias = tableOrViewWithAlias.trim();
      return {
        alias:
          tableOrViewWithAlias.indexOf(" ") > 0
            ? tableOrViewWithAlias
                .substring(tableOrViewWithAlias.lastIndexOf(" "))
                .trim()
            : undefined,

        name:
          tableOrViewWithAlias.indexOf(" ") > 0
            ? tableOrViewWithAlias
                .substring(0, tableOrViewWithAlias.indexOf(" "))
                .trim()
            : tableOrViewWithAlias.trim(),
      };
    }

    function join(
      joins: TableJoinDto[],
      joinType: JoinType,
      tableOrViewWithAlias: string,
      joinCondition: string,
      joinCondition2?: string
    ): TableJoinDto[] {
      const nameAlias = extractNameAndAlias(tableOrViewWithAlias);
      joins.push({
        joinType,
        tableAlias: nameAlias.alias,
        tableName: nameAlias.name,
        joinCondition,
        joinCondition2,
      });
      return joins;
    }

    const mainTable = extractNameAndAlias(tableOrViewName);
    const tablesJoin: TableJoinDto[] = [];

    if (queryInfo.joins && queryInfo.joins.length) {
      for (const j of queryInfo.joins) {
        join(tablesJoin, j[0] as JoinType, j[1], j[2], j[3]);
      }
    }

    const filterParams = queryInfo.filterParams
      ? this.toPrimitive(queryInfo.filterParams)
      : undefined;

    const request = {
      select: fields?.length ? fields : undefined,
      filterString: queryInfo.filter || undefined,
      filterParameters: filterParams || undefined,
      skip: queryInfo.skip || undefined,
      top: queryInfo.top || undefined,
      orderBy: queryInfo.orderBy || undefined,
      mainTableAlias: mainTable.alias || queryInfo.mainTableAlias || undefined,
      tablesJoin: tablesJoin?.length ? tablesJoin : undefined,
    } as RequestSqlQueryInfo;

    if (!this.connectionName?.length) {
      return Promise.reject(new Error("Connection Name is not specified"));
    }
    if (!this.baseUrl?.length) {
      return Promise.reject(new Error("Base URL is not specified"));
    }

    let url = `${this.baseUrl}/sql-data-api/${this.connectionName}/query/${mainTable.name}`;

    const headers = {} as Record<string, string>;
    if (this.bearerToken) {
      headers["Authorization"] = `Bearer ${this.bearerToken}`;
    } else if (this.userAccessToken) {
      url += `?$accessToken=${this.userAccessToken}`;
    }

    const httpConfig = {
      headers: { ...appHttpHeaders, ...headers },
    } as AxiosRequestConfig;

    if (this.abortController) {
      httpConfig.signal = this.abortController.signal;
    }

    const res = await httpRequest("POST", url, request, httpConfig);

    if (res.errorMessage) {
      throw new Error(res.errorMessage);
    }

    const response = res.data as SqlQueryResponse;
    return response.table as TableDto;
  }
}

interface ExecuteSqlDto {
  commandType?: "Text" | "StoredProcedure";
  sql?: string;
  params?: ScalarObject;
  paramDirections?: Record<string, string>;
}

interface ServerResponse<T> {
  data: T;
  isOk?: boolean;
  status: number;
  statusText: string;
  errorMessage?: string;
}

interface RequestSqlQueryInfo {
  select?: string;
  filterString?: string;
  filterParameters?: PrimitivesObject;
  skip?: number;
  top?: number;
  orderBy?: string;
  mainTableAlias?: string;
  tablesJoin?: TableJoinDto[];
}
