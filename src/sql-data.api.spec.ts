import { SqlDataApi, SqlQueryResponse } from "./sql-data.api";

describe("sqlExecuteMultiple", () => {
  const api = new SqlDataApi("http://localhost", "conn", { bearerToken: "t" });

  function mockRaw(response: SqlQueryResponse | null): void {
    jest.spyOn(api, "sqlExecuteRaw").mockResolvedValue(response as SqlQueryResponse);
  }

  it("maps the first and additional result sets to arrays of objects", async () => {
    mockRaw({
      resultType: "Table",
      table: { fieldNames: ["id"], fieldDataTypes: ["WholeNumber"], rows: [[1], [2]] },
      additionalResultSets: [
        { table: { fieldNames: ["name"], fieldDataTypes: ["String"], rows: [["a"]] } },
      ],
    } as SqlQueryResponse);

    const result = await api.sqlExecuteMultiple("SELECT 1; SELECT 2");

    expect(result.resultSets).toEqual([[{ id: 1 }, { id: 2 }], [{ name: "a" }]]);
  });

  it("drops the column-less placeholder of a statement without rows and keeps the message", async () => {
    mockRaw({
      resultType: "Table",
      message: "3 records affected.",
      table: { fieldNames: [], fieldDataTypes: [], rows: [] },
      additionalResultSets: [],
    } as SqlQueryResponse);

    const result = await api.sqlExecuteMultiple("UPDATE t SET x = 1");

    expect(result.resultSets).toEqual([]);
    expect(result.message).toBe("3 records affected.");
  });

  it("works against a server that does not send additionalResultSets", async () => {
    mockRaw({
      resultType: "Table",
      table: { fieldNames: ["id"], fieldDataTypes: ["WholeNumber"], rows: [[7]] },
    } as SqlQueryResponse);

    const result = await api.sqlExecuteMultiple("SELECT 7");

    expect(result.resultSets).toEqual([[{ id: 7 }]]);
  });

  it("returns items as-is when the server answered with $output=items", async () => {
    mockRaw({
      resultType: "Items",
      items: [{ id: 1 }],
      additionalResultSets: [{ items: [{ id: 2 }] }],
    } as SqlQueryResponse);

    const result = await api.sqlExecuteMultiple("SELECT 1; SELECT 2");

    expect(result.resultSets).toEqual([[{ id: 1 }], [{ id: 2 }]]);
  });
});
