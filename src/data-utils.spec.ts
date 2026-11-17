import {
  DataTypeName,
  dateToString,
  fromTable,
  parseDatetimeOrNull,
  parseNumberOrNull,
  toTable,
} from "./sql-data.api";

describe("fromTable", () => {
  it("maps rows to objects by field names", () => {
    expect(fromTable({ fieldNames: ["a", "b"], rows: [[1, "x"], [2, null]] })).toEqual([
      { a: 1, b: "x" },
      { a: 2, b: null },
    ]);
  });

  it("parses Date and DateTime columns into Date objects", () => {
    const [item] = fromTable({
      fieldNames: ["d", "dt", "empty", "s"],
      fieldDataTypes: [DataTypeName.Date, DataTypeName.DateTime, DataTypeName.Date, DataTypeName.String],
      rows: [["2024-03-05", "2024-03-05T10:20:30.123", null, "2024-03-05"]],
    });

    expect(item.d).toEqual(new Date(2024, 2, 5));
    expect(item.dt).toEqual(new Date(2024, 2, 5, 10, 20, 30, 123));
    expect(item.empty).toBeNull();
    expect(item.s).toBe("2024-03-05");
  });

  it("accepts plain rows with explicit or generated field names", () => {
    expect(fromTable([[1, 2]], ["a", "b"])).toEqual([{ a: 1, b: 2 }]);
    expect(fromTable([[1, 2]])).toEqual([{ Field0: 1, Field1: 2 }]);
  });

  it("returns an empty array for an empty or missing table", () => {
    expect(fromTable({ fieldNames: ["a"], rows: [] })).toEqual([]);
    expect(fromTable(null as any)).toEqual([]);
  });
});

describe("toTable", () => {
  it("uses the union of keys in first-seen order and converts dates to strings", () => {
    const table = toTable([{ a: 1, d: new Date(2024, 2, 5) }, { b: "x", a: 2 }]);

    expect(table.fieldNames).toEqual(["a", "d", "b"]);
    expect(table.rows).toEqual([
      [1, "2024-03-05", undefined],
      [2, undefined, "x"],
    ]);
  });

  it("returns an empty table for no items", () => {
    expect(toTable([])).toEqual({ fieldNames: [], rows: [] });
  });

  it("round-trips through fromTable", () => {
    const items = [{ id: 1, name: "a" }, { id: 2, name: null }];
    expect(fromTable(toTable(items))).toEqual(items);
  });
});

describe("dateToString", () => {
  it("returns a date only string when there is no time part", () => {
    expect(dateToString(new Date(2024, 2, 5))).toBe("2024-03-05");
  });

  it("returns local date and time in ISO form", () => {
    expect(dateToString(new Date(2024, 2, 5, 10, 20, 30, 123))).toBe("2024-03-05T10:20:30.123Z");
  });

  it("supports the common formats", () => {
    const d = new Date(2024, 2, 5);
    expect(dateToString(d, "dd/MM/yyyy")).toBe("05/03/2024");
    expect(dateToString(d, "MM/dd/yyyy")).toBe("03/05/2024");
    expect(dateToString(d, "yyyyMMdd")).toBe("20240305");
    expect(dateToString(d, "dd-MM-yyyy")).toBe("05-03-2024");
    expect(dateToString(d, "MM-dd-yy")).toBe("03-05-24");
    expect(() => dateToString(d, "nope")).toThrow("Unsupported format");
  });

  it("rejects non dates", () => {
    expect(() => dateToString("2024-03-05" as any)).toThrow("must be Date");
  });
});

describe("parseDatetimeOrNull", () => {
  it("parses ISO and UK strings", () => {
    expect(parseDatetimeOrNull("2024-03-05")).toEqual(new Date(2024, 2, 5));
    expect(parseDatetimeOrNull("2024-03-05T10:20:30Z")).toEqual(new Date(2024, 2, 5, 10, 20, 30));
    expect(parseDatetimeOrNull("25/12/2023")).toEqual(new Date(2023, 11, 25));
    expect(parseDatetimeOrNull("05-Mar-24")).toEqual(new Date(2024, 2, 5));
  });

  it("uses the format hint", () => {
    expect(parseDatetimeOrNull("12/25/2023", "MM/dd/yyyy")).toEqual(new Date(2023, 11, 25));
    expect(parseDatetimeOrNull("202403", "yyyyMM")).toEqual(new Date(2024, 2, 1));
    expect(() => parseDatetimeOrNull("2024", "bad")).toThrow("Unrecognized format");
  });

  it("passes dates and numbers through and rejects the rest", () => {
    const d = new Date(2024, 2, 5);
    expect(parseDatetimeOrNull(d)).toBe(d);
    expect(parseDatetimeOrNull(d.getTime())).toEqual(d);
    expect(parseDatetimeOrNull("hello")).toBeNull();
    expect(parseDatetimeOrNull("")).toBeNull();
    expect(parseDatetimeOrNull(null)).toBeNull();
  });
});

describe("parseNumberOrNull", () => {
  it("parses numeric strings only", () => {
    expect(parseNumberOrNull("1,234.5")).toBe(1234.5);
    expect(parseNumberOrNull(" -7 ")).toBe(-7);
    expect(parseNumberOrNull(3)).toBe(3);
    expect(parseNumberOrNull("12abc")).toBeNull();
    expect(parseNumberOrNull("")).toBeNull();
    expect(parseNumberOrNull(null)).toBeNull();
  });
});
