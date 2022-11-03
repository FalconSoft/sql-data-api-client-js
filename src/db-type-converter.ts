import { DataTypeName } from "datapipe-js";
import {
  DataTypeToPostgreSqlTypesMap,
  DataTypeToSqlTypesMap,
  DataTypeToSybaseAseTypesMap,
  PostgreSqlTypesToDataTypesMap,
  SqlTypesToDataTypesMap,
  SybaseAseTypesToDataTypesMap,
} from "./db-type-converter-maps";
import {
  DbConnectionType,
  PostgreSqlDataTypes,
  SQLDataTypes,
  SybaseAseDataTypes,
} from "./db-types";

export class DbTypeConverter {
  toDbType(
    dbType: DataTypeName,
    connectionType: DbConnectionType
  ): SQLDataTypes | PostgreSqlDataTypes | SybaseAseDataTypes {
    if (
      connectionType === "SqlServer" ||
      connectionType === "SqlServerSchema"
    ) {
      return this.toSqlServerType(dbType);
    }

    if (connectionType === "PostgreSql") {
      return this.toPostgreSqlType(dbType);
    }

    if (connectionType === "SybaseAse") {
      return this.toSybaseAseSqlType(dbType);
    }

    throw new Error("Not Supported ConnectionType");
  }

  fromDbType(
    dbType: SQLDataTypes | PostgreSqlDataTypes | SybaseAseDataTypes,
    connectionType: DbConnectionType
  ): DataTypeName {
    if (
      connectionType === "SqlServer" ||
      connectionType === "SqlServerSchema"
    ) {
      return this.fromSqlServerType(dbType as SQLDataTypes);
    }

    if (connectionType === "PostgreSql") {
      return this.fromPostgreSqlType(dbType as PostgreSqlDataTypes);
    }

    if (connectionType === "SybaseAse") {
      return this.fromSybaseAseSqlType(dbType as SybaseAseDataTypes);
    }

    throw new Error("Not Supported ConnectionType");
  }

  toSqlServerType(dbType: DataTypeName): SQLDataTypes {
    return DataTypeToSqlTypesMap[dbType];
  }

  toSybaseAseSqlType(dbType: DataTypeName): SybaseAseDataTypes {
    return DataTypeToSybaseAseTypesMap[dbType];
  }

  toPostgreSqlType(dbType: DataTypeName): PostgreSqlDataTypes {
    return DataTypeToPostgreSqlTypesMap[dbType];
  }

  fromSqlServerType(dbType: SQLDataTypes): DataTypeName {
    return SqlTypesToDataTypesMap[dbType];
  }

  fromSybaseAseSqlType(dbType: SybaseAseDataTypes): DataTypeName {
    return SybaseAseTypesToDataTypesMap[dbType];
  }

  fromPostgreSqlType(dbType: PostgreSqlDataTypes): DataTypeName {
    return PostgreSqlTypesToDataTypesMap[dbType];
  }
}
