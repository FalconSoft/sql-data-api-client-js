import axios from 'axios';
import { PrimitivesObject, PrimitiveType, ScalarObject, ScalarType, TableDto } from 'datapipe-js';
import { dateToString, fromTable, toTable } from 'datapipe-js/utils';

export interface SqlSaveStatus {
    inserted: number;
    updated: number;
    deleted: number;
}

export interface SqlReadQueryInfo {
    fields?: string;
    filter?: string;
    filterParams?: PrimitivesObject;
    skip?: number;
    top?: number;
    orderBy?: string;
    mainTableAlias?: string;
    joins?: [JoinType, string, string][];
}

export interface SqlSaveOptions {
    chunkSize?: number;
    primaryKeys: string[];
    method: 'Merge' | 'Append' | 'BulkInsert';
}

export function setBaseUrl(baseUrl: string): void {
    SqlDataApi.BaseUrl = baseUrl;
}

export function setBearerToken(bearerToken: string): void {
    SqlDataApi.BearerToken = bearerToken;
}

export function setUserAccessToken(userAccessToken: string): void {
    SqlDataApi.UserAccessToken = userAccessToken;
}

export async function authenticate(username: string, password: string): Promise<boolean> {
    SqlDataApi.BearerToken = (
        await httpRequest('POST', `${SqlDataApi.BaseUrl}/api/security/authenticate`, { username, password }) as { token: string }
    ).token
    return true;
}

export function sqlDataApi(connectionName: string, config?: { baseUrl?: string, userAccessToken?: string, bearerToken?: string }): SqlDataApi {
    const cfg = {
        userAccessToken: config?.userAccessToken || SqlDataApi.UserAccessToken,
        bearerToken: config?.bearerToken || SqlDataApi.BearerToken
    };
    return new SqlDataApi(
        config?.baseUrl || SqlDataApi.BaseUrl, connectionName, cfg)
}

export class SqlDataApi {
    private readonly userAccessToken?: string;
    private readonly bearerToken?: string;

    private queryInfo: SqlReadQueryInfo = {};
    private tableName = '';

    static BaseUrl: string;
    static UserAccessToken: string;
    static BearerToken: string;

    constructor(private baseUrl: string, private connectionName: string, config: { userAccessToken?: string, bearerToken?: string }) {
        this.userAccessToken = config?.userAccessToken;
        this.bearerToken = config?.bearerToken;
    }
    // fluent query methods
    filter(filter: string, filterParams?: Record<string, any>): SqlDataApi {
        this.queryInfo.filter = filter;
        this.queryInfo.filterParams = filterParams;
        return this;
    }

    select(fields: string): SqlDataApi {
        this.queryInfo.fields = fields;
        return this;
    }

    orderBy(orderBy: string): SqlDataApi {
        this.queryInfo.orderBy = orderBy;
        return this;
    }

    top(top: number): SqlDataApi {
        this.queryInfo.top = top;
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

    join(joinType: JoinType, tableName: string, joinCondition: string): SqlDataApi {
        if (!this.queryInfo.joins) {
            this.queryInfo.joins = [];
        }
        this.queryInfo.joins.push([joinType, tableName, joinCondition])
        return this;
    }

    table(name: string): SqlDataApi {
        this.tableName = name;
        return this;
    }
    // end fluent query methods

    async runQuery(tableOrViewName?: string, fieldsOrQuery?: string | SqlReadQueryInfo, queryInfoSettings?: SqlReadQueryInfo): Promise<ScalarObject[]> {
        const result = await this._query(
            tableOrViewName || this.tableName,
            fieldsOrQuery || this.queryInfo?.fields,
            queryInfoSettings || this.queryInfo
        );
        // reset query that it is not used in another call
        this.queryInfo = {} as SqlReadQueryInfo;
        return result;
    }
    async query(tableOrViewName: string, fieldsOrQuery?: string | SqlReadQueryInfo, queryInfoSettings?: SqlReadQueryInfo): Promise<ScalarObject[]> {
        return await this.runQuery(tableOrViewName, fieldsOrQuery, queryInfoSettings);
    }

    private async _query(tableOrViewName: string, fieldsOrQuery?: string | SqlReadQueryInfo, queryInfoSettings?: SqlReadQueryInfo): Promise<ScalarObject[]> {
        let queryInfo = queryInfoSettings;

        if (!queryInfo && typeof fieldsOrQuery === 'object') {
            queryInfo = fieldsOrQuery;
        }

        queryInfo = queryInfo || {} as SqlReadQueryInfo;

        const fields = (typeof fieldsOrQuery === 'string' && fieldsOrQuery && fieldsOrQuery !== '*') ? fieldsOrQuery as string
            : queryInfo?.fields;

        function extractNameAndAlias(tableOrViewWithAlias: string): { name: string; alias?: string } {
            tableOrViewWithAlias = tableOrViewWithAlias.trim();
            return {
                alias: tableOrViewWithAlias.indexOf(' ') > 0 ?
                    tableOrViewWithAlias.substring(tableOrViewWithAlias.lastIndexOf(' ')).trim()
                    : undefined,

                name: tableOrViewWithAlias.indexOf(' ') > 0 ?
                    tableOrViewWithAlias.substring(0, tableOrViewWithAlias.indexOf(' ')).trim()
                    : tableOrViewWithAlias.trim()
            };
        }

        function join(joins: TableJoinDto[], joinType: JoinType, tableOrViewWithAlias: string, joinCondition: string): TableJoinDto[] {
            const nameAlias = extractNameAndAlias(tableOrViewWithAlias);
            joins.push({
                joinCondition,
                joinType,
                tableAlias: nameAlias.alias,
                tableName: nameAlias.name
            });
            return joins;
        }

        const mainTable = extractNameAndAlias(tableOrViewName);
        const tablesJoin: TableJoinDto[] = [];

        if (queryInfo.joins && queryInfo.joins.length) {
            for (const j of queryInfo.joins) {
                join(tablesJoin, j[0] as JoinType, j[1], j[2]);
            }
        }

        const filterParams = queryInfo.filterParams ? this.toPrimitive(queryInfo.filterParams) : undefined;

        const request = {
            select: fields,
            filterString: queryInfo.filter,
            filterParameters: filterParams,
            skip: queryInfo.skip,
            top: queryInfo.top,
            orderBy: queryInfo.orderBy,
            mainTableAlias: mainTable.alias,
            tablesJoin
        } as RequestSqlQueryInfo;

        let url = `${this.baseUrl}/sql-data-api/${this.connectionName}/query/${mainTable.name}`;

        // set authentication code
        const headers = {} as Record<string, string>;
        if (this.bearerToken) {
            headers["Authorization"] = `Bearer ${this.bearerToken}`;
        } else if (this.userAccessToken) {
            url += `?$accessToken=${this.userAccessToken}`;
        }

        const response = await httpRequest('POST', url, request, headers) as SqlQueryResponse
        return fromTable(response.table);
    }

    async updateData(tableName: string, updateData: Record<string, ScalarType>, filter?: string, filterParams?: Record<string, ScalarType>) {
        let url = `${this.baseUrl}/sql-data-api/${this.connectionName}/update-data/${tableName}`;

        filterParams = this.toPrimitive(filterParams || {});

        const dto = {
            updateProperties: this.toPrimitive(updateData || {}),
            filter: {
                filterString: filter,
                filterParameters: filterParams
            }
        };

        // set authentication code
        const headers = {} as Record<string, string>;
        if (this.bearerToken) {
            headers["Authorization"] = `Bearer ${this.bearerToken}`;
        } else if (this.userAccessToken) {
            url += `?$accessToken=${this.userAccessToken}`;
        }

        const result = await httpRequest('POST', url, dto, headers) as number
        return result;
    }

    async deleteFrom(tableName: string, filter?: string, filterParams?: Record<string, ScalarType>) {
        let url = `${this.baseUrl}/sql-data-api/${this.connectionName}/delete-from/${tableName}`;

        filterParams = this.toPrimitive(filterParams || {});

        const dto = {
            filterString: filter,
            filterParameters: filterParams
        };

        // set authentication code
        const headers = {} as Record<string, string>;
        if (this.bearerToken) {
            headers["Authorization"] = `Bearer ${this.bearerToken}`;
        } else if (this.userAccessToken) {
            url += `?$accessToken=${this.userAccessToken}`;
        }

        const result = await httpRequest('POST', url, dto, headers) as number
        return result;
    }

    async delete(tableName: string, items: [] | any): Promise<boolean> {
        const itemsToDelete = Array.isArray(items) ? items : [items];
        await this.saveData(tableName, undefined, itemsToDelete);
        return true
    }

    async save(tableName: string, items: ScalarObject[], itemsToDeleteOrSaveOptions?: any[] | SqlSaveOptions, saveOptions?: SqlSaveOptions): Promise<SqlSaveStatus> {
        let itemsToDelete: any[] | undefined = undefined;
        if (!saveOptions && itemsToDeleteOrSaveOptions && !Array.isArray(itemsToDeleteOrSaveOptions)) {
            saveOptions = itemsToDeleteOrSaveOptions as SqlSaveOptions;
        } else if (itemsToDeleteOrSaveOptions && Array.isArray(itemsToDeleteOrSaveOptions)) {
            itemsToDelete = itemsToDeleteOrSaveOptions as any[];
        }

        return await this.saveData(tableName, items, itemsToDelete, saveOptions);
    }

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

        const result = await httpRequest('POST', url, dto, headers) as number
        return result;
    }

    async sqlExecute(sql: string, params?: ScalarObject): Promise<ScalarObject[] | unknown> {
        sql = sql?.trim() || '';
        if (!sql.length) {
            throw new Error('sql text is not provided');
        }
        if (!this.connectionName?.length) {
            throw new Error('connection is not provided');
        }

        if (params) {
            params = this.toPrimitive(params);
        }

        const dto = {
            commandType: sql.indexOf(' ') > 0 ? 'Text' : 'StoredProcedure',
            sql, params
        } as ExecuteSqlDto;


        let url = `${this.baseUrl}/sql-data-api/${this.connectionName}/execute`;

        // set authentication code
        const headers = {} as Record<string, string>;
        if (this.bearerToken) {
            headers["Authorization"] = `Bearer ${this.bearerToken}`;
        } else if (this.userAccessToken) {
            url += `?$accessToken=${this.userAccessToken}`;
        }

        const result = await httpRequest('POST', url, dto, headers) as SqlQueryResponse;

        return result?.table ? fromTable(result.table) : result;
    }

    private async saveData(tableName: string, items?: Record<string, ScalarType>[], itemsToDelete?: any[],
        saveOptions?: SqlSaveOptions): Promise<SqlSaveStatus> {

        const maxTableSize = 1500000;
        const maxRowsCount = saveOptions?.chunkSize || 10000;
        const primaryKeys = saveOptions?.primaryKeys || undefined;
        const saveMethod = saveOptions?.method === 'Append' ? 'append-data' : 'save';

        let url = `${this.baseUrl}/sql-data-api/${this.connectionName}/${saveMethod}/${tableName}`;

        // set authentication code
        const headers = {} as Record<string, string>;
        if (this.bearerToken) {
            headers["Authorization"] = `Bearer ${this.bearerToken}`;
        } else if (this.userAccessToken) {
            url += `?$accessToken=${this.userAccessToken}`;
        }
        const status: SqlSaveStatus = {
            inserted: 0,
            updated: 0,
            deleted: 0
        };

        itemsToDelete = itemsToDelete?.map(r => this.toPrimitive(r));

        if (!items || !items.length) {
            if (itemsToDelete?.length) {
                return await httpRequest('POST', url, { itemsToDelete }, headers) as SqlSaveStatus;
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
                    rows: []
                } as TableDto,
                itemsToDelete,
                primaryKeys
            };

            let currentIndex = -1;
            let currentSize = 0;

            while (++currentIndex < allRows.length) {
                const row = allRows[currentIndex];
                body.tableData.rows.push(row);
                currentSize += JSON.stringify(allRows[currentIndex]).length;

                if ((currentIndex + 1) >= allRows.length || body.tableData.rows.length >= maxRowsCount || currentSize > maxTableSize) {
                    const singleStatus = (await httpRequest('POST', url, body, headers)) as SqlSaveStatus;

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
        const scalarToPrimitive = (val: ScalarType | ScalarType[]): PrimitiveType | PrimitiveType[] => {
            if (Array.isArray(val)) {
                return val.map(v => scalarToPrimitive(v)) as PrimitiveType[];
            }
            return val instanceof Date ? dateToString(val) : val;
        };

        const result: PrimitivesObject = {};
        Object.keys(obj)
            .forEach(k => result[k] = scalarToPrimitive(obj[k]) as PrimitiveType);

        return result;
    }
}

export function httpRequest<TRequest, TResponse>(method: 'GET' | 'POST' | 'PUT' | 'DELETE', url: string, body: TRequest, headers?: Record<string, string>): Promise<TResponse> {
    const requestConfig = {
        method, url,
        headers: { 'Content-Type': 'application/json', ...(headers || {}) },
        data: JSON.stringify(body || {})
    };

    return axios.request(requestConfig)
        .then(
            (r: ServerResponse<TResponse>): TResponse => r.data,
            (e) => {
                // making an error more informative.
                // this was a reason why we switched to axios, as it gives us a real exception details,
                // beyond a statusText
                const response = e.response || {};
                const err = Error((response.data || {}).message || response.data || response.statusText || 'Http Connection Error');
                (err as any).status = response.status;
                (err as any).statusText = response.statusText;
                throw err;
            }
        );
}

interface ExecuteSqlDto {
    commandType?: 'Text' | 'StoredProcedure';
    sql?: string;
    params?: ScalarObject;
}

interface ServerResponse<T> {
    data: T;
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

enum JoinType {
    InnerJoin = 'InnerJoin', LeftJoin = 'LeftJoin', RightJoin = 'RightJoin', FullJoin = 'FullJoin'
}

interface TableJoinDto {
    tableName: string;
    tableAlias?: string;
    joinType: JoinType;
    joinCondition: string;
}

interface SqlQueryResponse {
    table: TableDto
}
