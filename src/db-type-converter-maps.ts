import { DataTypeName } from "datapipe-js";
import { PostgreSqlDataTypes, SQLDataTypes } from "./db-types";


export const SqlTypesToDataTypesMap: Record<SQLDataTypes, DataTypeName> = {
    [SQLDataTypes.TEXT]: DataTypeName.LargeString,
    [SQLDataTypes.CHAR]: DataTypeName.String,
    [SQLDataTypes.VARCHAR]: DataTypeName.String,
    [SQLDataTypes.NVARCHAR]: DataTypeName.String,
    [SQLDataTypes.BINARY]: DataTypeName.LargeString,
    [SQLDataTypes.VARBINARY]: DataTypeName.LargeString,
    [SQLDataTypes.DATE]: DataTypeName.Date,
    [SQLDataTypes.DATETIME]: DataTypeName.DateTime,
    [SQLDataTypes.DATETIME2]: DataTypeName.DateTime,
    [SQLDataTypes.DECIMAL]: DataTypeName.FloatNumber,
    [SQLDataTypes.FLOAT]: DataTypeName.FloatNumber,
    [SQLDataTypes.NUMERIC]: DataTypeName.FloatNumber,
    [SQLDataTypes.REAL]: DataTypeName.FloatNumber,
    [SQLDataTypes.SMALLINT]: DataTypeName.WholeNumber,
    [SQLDataTypes.BIGINT]: DataTypeName.BigIntNumber,
    [SQLDataTypes.INT]: DataTypeName.WholeNumber,
    [SQLDataTypes.TINYINT]: DataTypeName.WholeNumber,
    [SQLDataTypes.BIT]: DataTypeName.Boolean
};

export const PostgreSqlTypesToDataTypesMap: Record<PostgreSqlDataTypes, DataTypeName> = {
    [PostgreSqlDataTypes.BOOLEAN]: DataTypeName.Boolean,
    [PostgreSqlDataTypes.SMALLINT]: DataTypeName.WholeNumber,
    [PostgreSqlDataTypes.INTEGER]: DataTypeName.WholeNumber,
    [PostgreSqlDataTypes.INTEGER4]: DataTypeName.WholeNumber,
    [PostgreSqlDataTypes.BIGINT]: DataTypeName.BigIntNumber,
    [PostgreSqlDataTypes.REAL]: DataTypeName.FloatNumber,
    [PostgreSqlDataTypes.DOUBLE]: DataTypeName.FloatNumber,
    [PostgreSqlDataTypes.NUMERIC]: DataTypeName.FloatNumber,
    [PostgreSqlDataTypes.MONEY]: DataTypeName.FloatNumber,
    [PostgreSqlDataTypes.TEXT]: DataTypeName.LargeString,
    [PostgreSqlDataTypes.XML]: DataTypeName.LargeString,
    [PostgreSqlDataTypes.VARCHAR]: DataTypeName.String,
    [PostgreSqlDataTypes.CHAR]: DataTypeName.String,
    [PostgreSqlDataTypes.JSON]: DataTypeName.String,
    [PostgreSqlDataTypes.JSONB]: DataTypeName.String,
    [PostgreSqlDataTypes.BPCHAR]: DataTypeName.String,
    [PostgreSqlDataTypes.DATE]: DataTypeName.Date,
    [PostgreSqlDataTypes.TIMESTAMP]: DataTypeName.DateTime
}


export const DataTypeToPostgreSqlTypesMap: Record<DataTypeName, PostgreSqlDataTypes> = {
    [DataTypeName.WholeNumber]: PostgreSqlDataTypes.INTEGER,
    [DataTypeName.Date]: PostgreSqlDataTypes.DATE,
    [DataTypeName.DateTime]: PostgreSqlDataTypes.TIMESTAMP,
    [DataTypeName.FloatNumber]: PostgreSqlDataTypes.DOUBLE,
    [DataTypeName.String]: PostgreSqlDataTypes.VARCHAR,
    [DataTypeName.Boolean]: PostgreSqlDataTypes.BOOLEAN,
    [DataTypeName.BigIntNumber]: PostgreSqlDataTypes.BIGINT,
    [DataTypeName.LargeString]: PostgreSqlDataTypes.TEXT
};

export const DataTypeToSqlTypesMap: Record<DataTypeName, SQLDataTypes> = {
    [DataTypeName.WholeNumber]: SQLDataTypes.INT,
    [DataTypeName.Date]: SQLDataTypes.DATE,
    [DataTypeName.DateTime]: SQLDataTypes.DATETIME2,
    [DataTypeName.FloatNumber]: SQLDataTypes.FLOAT,
    [DataTypeName.String]: SQLDataTypes.VARCHAR,
    [DataTypeName.Boolean]: SQLDataTypes.BIT,
    [DataTypeName.BigIntNumber]: SQLDataTypes.BIGINT,
    [DataTypeName.LargeString]: SQLDataTypes.TEXT
};