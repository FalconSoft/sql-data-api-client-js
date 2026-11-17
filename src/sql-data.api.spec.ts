import {
  HttpRequestInfo,
  ServerResponse,
  SqlDataApi,
  SqlQueryResponse,
  httpGet,
  httpPost,
  setRequestHandler,
} from "./sql-data.api";

describe("default fetch transport", () => {
  const originalFetch = (global as any).fetch;
  afterEach(() => {
    (global as any).fetch = originalFetch;
  });

  function reply(status: number, body: string, statusText = "") {
    return { ok: status >= 200 && status < 300, status, statusText, text: () => Promise.resolve(body) };
  }

  it("sends a serialized body with headers and parses a JSON response", async () => {
    const fetchMock = jest.fn((_url: string, _init: any) => Promise.resolve(reply(200, '{"a":1}', "OK")));
    (global as any).fetch = fetchMock;

    const result = await httpPost("http://h/x", { q: 1 }, { headers: { Authorization: "Bearer t" } });

    expect(result).toEqual({ a: 1 });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("http://h/x");
    expect(init.method).toBe("POST");
    expect(init.body).toBe('{"q":1}');
    expect(init.headers).toEqual({ Authorization: "Bearer t", "Content-Type": "application/json" });
  });

  it("returns non-JSON responses as text", async () => {
    (global as any).fetch = jest.fn(() => Promise.resolve(reply(200, "plain text")));

    await expect(httpGet("http://h/x")).resolves.toBe("plain text");
  });

  it("throws the message from an error response body", async () => {
    (global as any).fetch = jest.fn(() => Promise.resolve(reply(400, '{"message":"bad sql"}', "Bad Request")));

    await expect(httpGet("http://h/x")).rejects.toThrow("bad sql");
  });

  it("falls back to the status text when an error response has no body", async () => {
    (global as any).fetch = jest.fn(() => Promise.resolve(reply(500, "", "Internal Server Error")));

    await expect(httpGet("http://h/x")).rejects.toThrow("Internal Server Error");
  });

  it("reports a network failure as a connection error", async () => {
    (global as any).fetch = jest.fn(() => Promise.reject(new TypeError("fetch failed")));

    await expect(httpGet("http://h/x")).rejects.toThrow("Http Connection Error");
  });

  // rejects like the real fetch once the signal it was given aborts
  function hangingFetch(_url: string, init: any): Promise<never> {
    return new Promise((_, reject) => {
      const fail = () => reject(new Error("aborted"));
      if (init.signal.aborted) fail();
      else init.signal.addEventListener("abort", fail);
    });
  }

  it("reports an aborted request as cancelled", async () => {
    (global as any).fetch = jest.fn(hangingFetch);
    const controller = new AbortController();

    const request = httpGet("http://h/x", { signal: controller.signal });
    controller.abort();

    await expect(request).rejects.toThrow("Request cancelled");
  });

  it("aborts the request after config.timeout", async () => {
    (global as any).fetch = jest.fn(hangingFetch);

    await expect(httpGet("http://h/x", { timeout: 10 })).rejects.toThrow("timeout of 10ms exceeded");
  });
});

describe("setRequestHandler", () => {
  afterEach(() => setRequestHandler(null));

  function ok<T>(data: T): ServerResponse<T> {
    return { data, isOk: true, status: 200, statusText: "OK" };
  }

  it("routes every request of the library through the handler", async () => {
    const handler = jest.fn((_: HttpRequestInfo) =>
      Promise.resolve(ok({ resultType: "Table", table: { fieldNames: [], fieldDataTypes: [], rows: [] } }))
    );
    setRequestHandler(handler);

    const api = new SqlDataApi("http://h", "conn", { bearerToken: "t" });
    await api.sqlExecuteRaw("select 1");

    expect(handler).toHaveBeenCalledTimes(1);
    const request = handler.mock.calls[0][0];
    expect(request.method).toBe("POST");
    expect(request.url).toBe("http://h/sql-data-api/conn/execute");
    expect(request.headers.Authorization).toBe("Bearer t");
    expect(request.headers["Content-Type"]).toBe("application/json");
    expect(typeof request.body).toBe("object");
    expect((request.body as { sql: string }).sql).toBe("select 1");
  });

  it("throws the handler's errorMessage from the wrappers", async () => {
    setRequestHandler(() =>
      Promise.resolve({ data: null, isOk: false, status: 400, statusText: "Bad Request", errorMessage: "boom" })
    );

    await expect(httpGet("http://h/x")).rejects.toThrow("boom");
  });

  it("turns a rejecting handler into an errorMessage instead of an unhandled rejection", async () => {
    setRequestHandler(() => Promise.reject(new Error("bridge down")));

    await expect(httpGet("http://h/x")).rejects.toThrow("bridge down");
  });
});

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
