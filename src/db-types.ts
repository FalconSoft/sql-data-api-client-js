export type DbConnectionType =
  | "SqlServer"
  | "SqlServerSchema"
  | "PostgreSql"
  | "Oracle"
  | "MySql"
  | "SybaseAse";

export enum SQLDataTypes {
  VARCHAR = "varchar",
  NVARCHAR = "nvarchar",
  FLOAT = "float",
  DATE = "date",
  DATETIME2 = "datetime2",
  DATETIME = "datetime",
  INT = "int",

  TEXT = "text",
  CHAR = "char",
  BINARY = "binary",
  VARBINARY = "varbinary",

  BIT = "bit",
  TINYINT = "tinyint",
  SMALLINT = "smallint",
  BIGINT = "bigint",
  DECIMAL = "decimal",
  REAL = "real",
  NUMERIC = "numeric",
}

export enum SybaseAseDataTypes {
    VARCHAR = "varchar",
    NVARCHAR = "nvarchar",
    FLOAT = "float",
    DATE = "date",
    DATETIME = "datetime",
    SMALLDATETIME = "smalldatetime",

    INT = "int",

    TEXT = "text",
    CHAR = "char",
    BINARY = "binary",
    VARBINARY = "varbinary",

    BIT = "bit",
    TINYINT = "tinyint",
    SMALLINT = "smallint",
    BIGINT = "bigint",
    DECIMAL = "decimal",
    REAL = "real",
    NUMERIC = "numeric",
    MONEY = "money",
}

export enum PostgreSqlDataTypes {
  VARCHAR = "varchar",
  INTEGER = "int",
  DOUBLE = "float8",
  DATE = "date",
  TIMESTAMP = "timestamp",
  BOOLEAN = "bool",
  SMALLINT = "int2",
  BIGINT = "int8",
  REAL = "float4",
  INTEGER4 = "int4",
  NUMERIC = "numeric",
  MONEY = "money",
  TEXT = "text",
  CHAR = "char",
  BPCHAR = "bpchar",
  JSONB = "jsonb",
  XML = "xml",
  JSON = "json",

  // , CITEXT = 'Citext',

  // POINT = 'Point',
  // LSEG = 'LSeg',
  // PATH = 'Path',
  // POLYGON = 'Polygon',
  // LINE = 'Line',
  // CIRCLE = 'Circle',
  // BOX = 'Box',
  // BIT = 'Bit',
  // VARBIT = 'Varbit',
  // HSTORE = 'Hstore',
  // UUID = 'Uuid',
  // CIDR = 'Cidr',
  // INET = 'Inet',
  // MACADDR = 'MacAddr',
  // TSQUERY = 'TsQuery',
  // TSVECTOR = 'TsVector',

  // TIMESTAMPTZ = 'TimestampTz',
  // TIME = 'Time',
  // TIMETZ = 'TimeTz',
  // BYTEA = 'Bytea',
  // OID = 'Oid',
  // XID = 'Xid',
  // CID = 'Cid',
  // OIDVECTOR = 'Oidvector',
  // NAME = 'Name',
  // INTERNALCHAR = 'InternalChar',
  // COMPOSITE = 'Composite',
  // RANGE = 'Range',
  // ENUM = 'Enum',
  // ARRAY = 'Array'
}

export enum JoinType {
  InnerJoin = "InnerJoin",
  LeftJoin = "LeftJoin",
  RightJoin = "RightJoin",
  FullJoin = "FullJoin",
}

export interface TableJoinDto {
  tableName: string;
  tableAlias?: string;
  joinType: JoinType;
  joinCondition: string;
  joinCondition2?: string;
}
