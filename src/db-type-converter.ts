import { DataTypeName } from "datapipe-js";
import {
    DataTypeToPostgreSqlTypesMap, DataTypeToSqlTypesMap,
    PostgreSqlTypesToDataTypesMap, SqlTypesToDataTypesMap
} from "./db-type-converter-maps";
import { DbConnectionType, PostgreSqlDataTypes, SQLDataTypes } from "./db-types";

export class DbTypeConverter {
    toDbType(dbType: DataTypeName, connectionType: DbConnectionType): SQLDataTypes | PostgreSqlDataTypes {
        if (connectionType === 'SqlServer' || connectionType === 'SqlServerSchema'){
            return this.toSqlServerType(dbType);
        }

        if (connectionType === 'PostgreSql'){
            return this.toPostgreSqlType(dbType);
        }

        throw new Error('Not Supported ConnectionType');
    }

    fromDbType(dbType: SQLDataTypes | PostgreSqlDataTypes, connectionType: DbConnectionType): DataTypeName {
        if (connectionType === 'SqlServer' || connectionType === 'SqlServerSchema'){
            return this.fromSqlServerType(dbType as SQLDataTypes);
        }

        if (connectionType === 'PostgreSql'){
            return this.fromPostgreSqlType(dbType as PostgreSqlDataTypes);
        }

        throw new Error('Not Supported ConnectionType');
    }

    toSqlServerType(dbType: DataTypeName): SQLDataTypes {
        return DataTypeToSqlTypesMap[dbType];
    }

    toPostgreSqlType(dbType: DataTypeName): PostgreSqlDataTypes {
        return DataTypeToPostgreSqlTypesMap[dbType];
    }

    fromSqlServerType(dbType: SQLDataTypes): DataTypeName {
        return SqlTypesToDataTypesMap[dbType];
    }

    fromPostgreSqlType(dbType: PostgreSqlDataTypes): DataTypeName {
        return PostgreSqlTypesToDataTypesMap[dbType];
    }
}