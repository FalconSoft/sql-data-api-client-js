import axios from 'axios';
import { PrimitivesObject, PrimitiveType, ScalarObject, ScalarType, TableDto } from 'datapipe-js';
import { dateToString, fromTable, toTable } from 'datapipe-js/utils';

export interface SqlSaveStatus {
    inserted: number;
    updated: number;
    deleted: number;
}

export interface SqlReadQueryInfo {
    filter?: string;
    filterParams?: PrimitivesObject;
    skip?: number;
    top?: number;
    orderBy?: string;
    mainTableAlias?: string;
    joins: string;
}

export interface SqlSaveOptions {
    chunkSize?: number;
    primaryKeys: string[];
    method: 'Merge' | 'Append' | 'BulkInsert';
}

export function setBaseUrl(baseUrl: string): void {
    SqlDataApi.BaseUrl = baseUrl;
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

    static BaseUrl: string;
    static UserAccessToken: string;
    static BearerToken: string;

    constructor(private baseUrl: string, private connectionName: string, config: { userAccessToken?: string, bearerToken?: string }) {
        this.userAccessToken = config?.userAccessToken;
        this.bearerToken = config?.bearerToken;
    }

    async query(tableOrViewName: string, fields?: string, queryInfo: SqlReadQueryInfo = {} as SqlReadQueryInfo): Promise<ScalarObject[]> {

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

        const request = {
            select: fields,
            filterString: queryInfo.filter,
            filterParameters: queryInfo.filterParams,
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

    async save(tableName: string, items: ScalarObject[], saveOptions?: SqlSaveOptions): Promise<SqlSaveStatus> {
        const maxTableSize = 1500000;
        const maxRowsCount = saveOptions?.chunkSize || 10000;
        const primaryKeys = saveOptions?.primaryKeys || undefined;

        let url = `${this.baseUrl}/sql-data-api/${this.connectionName}/save/${tableName}`;

        // set authentication code
        const headers = {} as Record<string, string>;
        if (this.bearerToken) {
            headers["Authorization"] = `Bearer ${this.bearerToken}`;
        } else if (this.userAccessToken) {
            url += `?$accessToken=${this.userAccessToken}`;
        }


        const table = toTable(items) as TableDto;

        ///////////////
        const status: SqlSaveStatus = {
            inserted: 0,
            updated: 0,
            deleted: 0
        };

        const allRows = table.rows;

        const body = {
            tableData: {
                fieldNames: table.fieldNames,
                rows: []
            } as TableDto,
            primaryKeys
        };

        let currentIndex = -1;
        let currentSize = 0;

        while (++currentIndex < allRows.length) {
            const row = allRows[currentIndex];
            body.tableData.rows.push(row);
            currentSize += JSON.stringify(allRows[currentIndex]).length;

            if ((currentIndex + 1) >= allRows.length || body.tableData.rows.length >= maxRowsCount || currentSize > maxTableSize) {
                const singleStatus = (await httpRequest('POST', url, body, headers)) as SqlSaveStatus

                status.inserted += singleStatus.inserted;
                status.updated += singleStatus.updated;
                status.deleted += singleStatus.deleted;
                currentSize = 0;
                body.tableData.rows = [];
            }
        }

        return status;
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

function httpRequest<TRequest, TResponse>(method: 'GET' | 'POST' | 'PUT' | 'DELETE', url: string, body: TRequest, headers?: Record<string, string>): Promise<TResponse> {
    process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

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
