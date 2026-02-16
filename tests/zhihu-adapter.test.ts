import { describe, expect, test } from "vitest";
import { detectZhihuContentType, getSelectorsForZhihuType } from "../src/adapters/zhihu.js";

describe("zhihu adapter detection", () => {
  test("detects answer type from question/answer path", () => {
    const type = detectZhihuContentType(
      new URL("https://www.zhihu.com/question/608863165/answer/1933151546000012584"),
    );
    expect(type).toBe("answer");
  });

  test("detects pin type from pin path", () => {
    const type = detectZhihuContentType(new URL("https://www.zhihu.com/pin/2006666135236535079"));
    expect(type).toBe("pin");
  });

  test("detects zhuanlan article from zhuanlan path", () => {
    const type = detectZhihuContentType(new URL("https://zhuanlan.zhihu.com/p/2002117978997663372"));
    expect(type).toBe("zhuanlan_article");
  });

  test("returns null for unsupported zhihu path", () => {
    const type = detectZhihuContentType(new URL("https://www.zhihu.com/question/608863165"));
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
