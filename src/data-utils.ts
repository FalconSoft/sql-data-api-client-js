// Data types and table helpers, ported from datapipe-js so this library has no runtime dependencies.

export type PrimitiveType = string | number | bigint | boolean | null;

/**
 * ScalarType represent a single value types what includes Date and can be null
 */
export type ScalarType = PrimitiveType | Date;

/**
 * Scalar object is a simple object where key is always string and value could be a ScalarType only
 * Scalar type includes Date object
 */
export type ScalarObject = Record<string, ScalarType>;

/**
 * PrimitivesObject is a simple object where key is a string and value can be Primitive
 * This object can be transfered with REST call. Doesn't have a Date
 */
export type PrimitivesObject = Record<string, PrimitiveType>;

/**
 * Commonly used and recognized types
 */
export enum DataTypeName {
  String = "String",
  LargeString = "LargeString",
  WholeNumber = "WholeNumber",
  BigIntNumber = "BigIntNumber",
  FloatNumber = "FloatNumber",
  DateTime = "DateTime",
  Date = "Date",
  Boolean = "Boolean",
}

export interface Table<T> {
  fieldDataTypes?: DataTypeName[];
  fieldNames: string[];
  rows: T[][];
}

/**
 * A simple data table structure what provides a most efficient way
 * to send data across the wire
 */
export type TableDto = Table<PrimitiveType>;

export function parseNumberOrNull(value: unknown): number | null {
  if (typeof value === "number") {
    return value;
  }

  if (!value || typeof value !== "string") {
    return null;
  }

  value = value.trim();
  const str = value as string;

  // Just to make sure string contains digits only and '.', ','. Otherwise, parseFloat can incorrectly parse into number
  for (let i = str.length - 1; i >= 0; i--) {
    const d = str.charCodeAt(i);
    if (d < 48 || d > 57) {
      // '.' - 46 ',' - 44 '-' - 45(but only first char)
      if (d !== 46 && d !== 44 && (d !== 45 || i !== 0)) return null;
    }
  }

  const res = parseFloat(str.replace(/,/g, ""));
  return !isNaN(res) ? res : null;
}

const MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];

/**
 * A wider datetime parser. Without a format it tries ISO (yyyy-mm-dd...) first, then UK (dd/mm/yyyy).
 * Dates are created in the local time zone.
 * @param value string, number (epoch ms) or Date
 * @param format optional hint: mm/dd/yy, dd/mm/yy, yyyy-mm, yyyymm (and their mmm / dash variants)
 */
export function parseDatetimeOrNull(
  value: unknown,
  format: string | null = null
): Date | null {
  format = (format || "").toLowerCase();
  if (!value) {
    return null;
  }

  if (value instanceof Date && !isNaN(value.valueOf())) {
    return value;
  }

  // only string values can be converted to Date
  if (typeof value === "number" || typeof value === "bigint") {
    return new Date(Number(value));
  } else if (typeof value !== "string") {
    return null;
  }

  const strValue = value;

  const parseMonth = (mm: string): number => {
    if (!mm || !mm.length) {
      return NaN;
    }

    const m = parseInt(mm, 10);
    if (!isNaN(m)) {
      return m - 1;
    }

    // make sure english months are coming through
    for (let i = 0; i < MONTHS.length; i++) {
      if (mm.indexOf(MONTHS[i]) === 0) {
        return i;
      }
    }

    return NaN;
  };

  const correctYear = (yy: number): number => {
    if (yy < 100) {
      return yy < 68 ? yy + 2000 : yy + 1900;
    }
    return yy;
  };

  const validDateOrNull = (
    yyyy: number,
    month: number,
    day: number,
    hours: number,
    mins: number,
    ss: number,
    ms: number
  ): Date | null => {
    if (month > 11 || day > 31 || hours >= 60 || mins >= 60 || ss >= 60) {
      return null;
    }

    if (ms > 1000) {
      ms = parseInt(String(ms).substring(0, 3));
    }

    const dd = new Date(yyyy, month, day, hours, mins, ss, ms);
    return !isNaN(dd.valueOf()) ? dd : null;
  };

  const strTokens = strValue
    .replace("T", " ")
    .replace("Z", " ")
    .replace(".", " ")
    .toLowerCase()
    .split(/[: /-]/);

  const dt = strTokens.map((s) => parseNumberOrNull(s) ?? Number.NaN);
  const startsWith = (...prefixes: string[]): boolean =>
    prefixes.some((p) => (format as string).indexOf(p) === 0);

  if (startsWith("mm/dd/yy", "mmm/dd/yy", "mm-dd-yy", "mmm-dd-yy")) {
    // handle US format
    return validDateOrNull(
      correctYear(dt[2]),
      parseMonth(strTokens[0]),
      dt[1],
      dt[3] || 0,
      dt[4] || 0,
      dt[5] || 0,
      dt[6] || 0
    );
  } else if (startsWith("yyyymm")) {
    return validDateOrNull(
      parseInt(strValue.substring(0, 4)),
      parseInt(strValue.substring(4, 6)) - 1,
      strValue.length > 6 ? parseInt(strValue.substring(6, 8)) : 1,
      0,
      0,
      0,
      0
    );
  } else if (startsWith("dd/mm/yy", "dd/mmm/yy", "dd-mm-yy", "dd-mmm-yy")) {
    return validDateOrNull(
      correctYear(dt[2]),
      parseMonth(strTokens[1]),
      dt[0],
      dt[3] || 0,
      dt[4] || 0,
      dt[5] || 0,
      dt[6] || 0
    );
  } else if (startsWith("yyyy-mm")) {
    return validDateOrNull(
      dt[0],
      parseMonth(strTokens[1]),
      dt[2] || 1,
      dt[3] || 0,
      dt[4] || 0,
      dt[5] || 0,
      dt[6] || 0
    );
  } else if (format.length) {
    throw new Error(`Unrecognized format '${format}'`);
  }

  // try ISO first, then UK.
  // we can't accept both UK and US format as it is ambiguous; for US use format parameter e.g. MM/dd/yyyy
  return (
    validDateOrNull(
      dt[0],
      dt[1] - 1,
      dt[2],
      dt[3] || 0,
      dt[4] || 0,
      dt[5] || 0,
      dt[6] || 0
    ) ||
    validDateOrNull(
      correctYear(dt[2]),
      parseMonth(strTokens[1]),
      dt[0],
      dt[3] || 0,
      dt[4] || 0,
      dt[5] || 0,
      dt[6] || 0
    )
  );
}

/**
 * Formats a date using its local time. Without a format it returns an ISO string
 * (`yyyy-mm-dd` when there is no time part, otherwise `yyyy-mm-ddThh:mm:ss.fffZ`).
 * @param format dd/mm/yyyy, mm/dd/yyyy, dd/mm/yy, yyyymmdd, mm-dd-yyyy, mm-dd-yy, dd-mm-yyyy or yyyy-mm-dd
 */
export function dateToString(d: Date, format?: string): string {
  if (!(d instanceof Date)) {
    throw new Error(`A first parameter to 'dateToString' must be Date`);
  }

  const date = new Date(d.valueOf());
  date.setMinutes(date.getMinutes() - date.getTimezoneOffset());
  const strDate = date.toISOString().replace("T00:00:00.000Z", "");

  if (!format) {
    return strDate;
  }

  // a quick and dirty way to achive a most used formats
  const t = strDate.split(/[.T:Z /-]/);
  const yyyy = t[0];
  const yy = t[0].slice(2);
  const mm = t[1];
  const dd = t[2];

  switch (format.toLowerCase()) {
    case "dd/mm/yyyy":
      return `${dd}/${mm}/${yyyy}`;
    case "mm/dd/yyyy":
      return `${mm}/${dd}/${yyyy}`;
    case "dd/mm/yy":
      return `${dd}/${mm}/${yy}`;
    case "yyyymmdd":
      return `${yyyy}${mm}${dd}`;
    case "mm-dd-yyyy":
      return `${mm}-${dd}-${yyyy}`;
    case "mm-dd-yy":
      return `${mm}-${dd}-${yy}`;
    case "dd-mm-yyyy":
      return `${dd}-${mm}-${yyyy}`;
    case "yyyy-mm-dd":
      return `${yyyy}-${mm}-${dd}`;
    default:
      throw new Error(`Unsupported format ${format}`);
  }
}

/**
 * Converts a table (or an array of rows) to an array of objects.
 * Date and DateTime columns are parsed into Date objects.
 * @param rowsOrTable Table data or array of rows.
 * @param fieldNames Column names. If not provided, they will be auto generated (Field0, Field1...)
 * @param fieldDataTypes Column data types
 * @typeParam T Shape of a row, when the caller knows it. It is not validated at runtime.
 */
export function fromTable<T extends object = ScalarObject>(
  rowsOrTable: PrimitiveType[][] | TableDto,
  fieldNames?: string[],
  fieldDataTypes?: DataTypeName[]
): T[] {
  const table = rowsOrTable as TableDto;
  const rows = table?.rows || (rowsOrTable as PrimitiveType[][]) || [];

  if (!rows.length) {
    return [];
  }

  const names =
    table?.fieldNames || fieldNames || rows[0].map((v, i) => `Field${i}`);
  const dataTypes = table?.fieldDataTypes || fieldDataTypes || [];

  const values: ScalarObject[] = [];
  for (const row of rows) {
    const value: ScalarObject = {};
    for (let i = 0, len = names.length; i < len; i++) {
      const dataType = dataTypes.length ? dataTypes[i] : null;
      value[names[i]] =
        (dataType === DataTypeName.DateTime || dataType === DataTypeName.Date) &&
        row[i]
          ? parseDatetimeOrNull(row[i])
          : row[i];
    }
    values.push(value);
  }

  return values as T[];
}

/**
 * Converts an array of objects to a table. Field names are a union of all object keys;
 * Date values are converted to strings (see `dateToString`).
 */
export function toTable(values: ScalarObject[]): TableDto {
  const tableDto: TableDto = {
    fieldNames: [],
    rows: [],
  };

  if (!values?.length) {
    return tableDto;
  }

  const seen: Record<string, boolean> = Object.create(null);
  values.forEach((v) => {
    Object.keys(v).forEach((k) => {
      if (!seen[k]) {
        seen[k] = true;
        tableDto.fieldNames.push(k);
      }
    });
  });

  tableDto.rows = values.map((rowValues) =>
    tableDto.fieldNames.map((field) => {
      const v = rowValues[field];
      return v instanceof Date ? dateToString(v) : v;
    })
  );

  return tableDto;
}
