import { getApiBaseUrl } from "../api";

describe("getApiBaseUrl", () => {
  it("URL を明示的に渡した場合はその値を返す", () => {
    expect(getApiBaseUrl("https://api.example.com")).toBe("https://api.example.com");
  });

  it("引数が未指定の場合は localhost のフォールバックを返す", () => {
    const url = getApiBaseUrl(undefined);
    expect(url).toBeTruthy();
    expect(typeof url).toBe("string");
    expect(url).toBe("http://localhost:3000");
  });

  it("末尾スラッシュを除去する", () => {
    expect(getApiBaseUrl("https://api.example.com/")).toBe("https://api.example.com");
    expect(getApiBaseUrl("https://api.example.com/v1/")).toBe("https://api.example.com/v1");
  });

  it("末尾スラッシュがない URL はそのまま返す", () => {
    expect(getApiBaseUrl("https://api.example.com")).toBe("https://api.example.com");
  });
});
