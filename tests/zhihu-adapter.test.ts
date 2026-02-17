import { describe, expect, test } from "vitest";
import { detectZhihuContentType, getSelectorsForZhihuType } from "../src/adapters/zhihu.js";

describe("zhihu adapter detection", () => {
  test("detects answer type from question/answer path", () => {
    const type = detectZhihuContentType(
      new URL("https://www.zhihu.com/question/111111111/answer/1111111111111111111"),
    );
    expect(type).toBe("answer");
  });

  test("detects pin type from pin path", () => {
    const type = detectZhihuContentType(new URL("https://www.zhihu.com/pin/2222222222222222222"));
    expect(type).toBe("pin");
  });

  test("detects zhuanlan article from zhuanlan path", () => {
    const type = detectZhihuContentType(new URL("https://zhuanlan.zhihu.com/p/3333333333333333333"));
    expect(type).toBe("zhuanlan_article");
  });

  test("returns null for unsupported zhihu path", () => {
    const type = detectZhihuContentType(new URL("https://www.zhihu.com/question/111111111"));
    expect(type).toBeNull();
  });
});

describe("zhihu selectors by type", () => {
  test("returns typed selectors with required fields", () => {
    const answerSelectors = getSelectorsForZhihuType("answer");
    const pinSelectors = getSelectorsForZhihuType("pin");
    const zhuanlanSelectors = getSelectorsForZhihuType("zhuanlan_article");

    expect(answerSelectors.content.length).toBeGreaterThan(0);
    expect(pinSelectors.authorMetaContainer).toContain("PinItem-authorInfo");
    expect(zhuanlanSelectors.title).toContain("Post-Title");
  });
});
