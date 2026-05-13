import { describe, expect, test } from "vitest";
import { parseHtmlToMarkdown, parseHtmlToMetadata } from "../src/core/parser.js";
import {
  zhihuAnswerFixture,
  zhihuAnswerAlternateStructureFixture,
  zhihuFixtureWithBlockMath,
  zhihuFixtureWithBracketAltButNoSticker,
  zhihuFixtureWithEmojiImage,
  zhihuFixtureWithImage,
  zhihuFixtureWithInlineMath,
  zhihuFixtureWithStickerButNotBracketAlt,
  zhihuPinFixture,
  zhihuPinFixtureWithEmojiImage,
  zhihuZhuanlanFixture,
  zhihuZhuanlanFixtureWithEmojiImage,
  zhihuZhuanlanSampleLikeFixture,
} from "./helpers/parser-fixtures.js";

describe("zhihu markdown parsing", () => {
  test("extracts title and main content for answer", async () => {
    const result = await parseHtmlToMarkdown({
      html: zhihuAnswerFixture,
      sourceUrl: "https://www.zhihu.com/question/111111111/answer/1111111111111111111",
    });

    expect(result.ok).toBe(true);
    expect(result.title).toBe("Zhihu Fixture Title");
    expect(result.markdown).toContain("# Zhihu Fixture Title");
    expect(result.markdown).toContain("[Sanitized Author A](https://www.zhihu.com/people/sanitized-author-a)");
    expect(result.markdown).toContain("First paragraph.");
    expect(result.markdown).toContain("*   Point A");
    expect(result.markdown).toContain("https://zhuanlan.zhihu.com/p/333333333");
    expect(result.stats?.removedNodes).toBe(0);
  });

  test("parses answer markdown from alternate title and content containers", async () => {
    const result = await parseHtmlToMarkdown({
      html: zhihuAnswerAlternateStructureFixture,
      sourceUrl: "https://www.zhihu.com/question/9/answer/10",
    });

    expect(result.ok).toBe(true);
    expect(result.title).toBe("Zhihu Alternate Fixture Title");
    expect(result.markdown).toContain("# Zhihu Alternate Fixture Title");
    expect(result.markdown).toContain("[alternate-author](https://www.zhihu.com/people/alternate-author)");
    expect(result.markdown).toContain("Alternate answer paragraph.");
    expect(result.markdown).toContain("Second alternate paragraph.");
    expect(result.markdown).toContain("2026-03-02");
  });

  test("uses markdown image output by default", async () => {
    const result = await parseHtmlToMarkdown({
      html: zhihuFixtureWithImage,
      sourceUrl: "https://www.zhihu.com/question/1/answer/1",
    });

    expect(result.ok).toBe(true);
    expect(result.markdown).toContain("![](https://picx.zhimg.com/test-image.png)");
    expect(result.markdown).not.toContain("<img src=");
  });

  test("uses html image output when enabled", async () => {
    const result = await parseHtmlToMarkdown({
      html: zhihuFixtureWithImage,
      sourceUrl: "https://www.zhihu.com/question/1/answer/1",
      useHtmlStyleForImage: true,
    });

    expect(result.ok).toBe(true);
    expect(result.markdown).toContain(
      '<img src="https://picx.zhimg.com/test-image.png" style="height: 100;width: 200;">',
    );
  });

  test("converts zhihu inline math to markdown inline equation", async () => {
    const result = await parseHtmlToMarkdown({
      html: zhihuFixtureWithInlineMath,
      sourceUrl: "https://www.zhihu.com/question/1/answer/1",
    });

    expect(result.ok).toBe(true);
    expect(result.markdown).toContain("$x^2+y^2=z^2$");
    expect(result.markdown).toContain("$d^2 = x^2 + y^2$");
    expect(result.markdown).not.toContain("$ignored$");
    expect(result.markdown).toContain("Empty:");
  });

  test("escapes literal dollar signs while preserving zhihu math", async () => {
    const html = `<!doctype html>
<html>
  <body>
    <h1 class="QuestionHeader-title">Price $ Watch</h1>
    <div class="AnswerItem">
      <div class="AnswerItem-authorInfo">
        <meta itemprop="name" content="Author $ Name" />
        <meta itemprop="url" content="https://www.zhihu.com/people/author-$-url" />
      </div>
      <span class="RichText">
        <p>Price moved from $5 to $7.</p>
        <p>Formula: <span class="ztext-math" data-tex="x+y=z">x+y=z</span></p>
      </span>
    </div>
  </body>
</html>`;
    const result = await parseHtmlToMarkdown({
      html,
      sourceUrl: "https://www.zhihu.com/question/1/answer/1",
    });

    expect(result.ok).toBe(true);
    expect(result.title).toBe("Price $ Watch");
    expect(result.markdown).toContain("# Price \\$ Watch");
    expect(result.markdown).toContain("[Author \\$ Name](https://www.zhihu.com/people/author-$-url)");
    expect(result.markdown).toContain("Price moved from \\$5 to \\$7.");
    expect(result.markdown).toContain("$x+y=z$");
  });

  test("converts zhihu display math to markdown block equation", async () => {
    const result = await parseHtmlToMarkdown({
      html: zhihuFixtureWithBlockMath,
      sourceUrl: "https://www.zhihu.com/question/1/answer/1",
    });

    expect(result.ok).toBe(true);
    expect(result.markdown).toContain("$$\n\\int_0^1 x dx\\\\\n$$");
    expect(result.markdown).toContain("Before block.");
    expect(result.markdown).toContain("After block.");
  });

  test("converts zhihu emoji image to bracketed alt text", async () => {
    const result = await parseHtmlToMarkdown({
      html: zhihuFixtureWithEmojiImage,
      sourceUrl: "https://www.zhihu.com/question/1/answer/1",
    });

    expect(result.ok).toBe(true);
    expect(result.markdown).toContain("Emoji:");
    expect(result.markdown).toContain("\\[捂脸\\]");
    expect(result.markdown).not.toContain("![](https://picx.zhimg.com/emoji.png)");
  });

  test("emoji image handling is independent of html image output mode", async () => {
    const result = await parseHtmlToMarkdown({
      html: zhihuFixtureWithEmojiImage,
      sourceUrl: "https://www.zhihu.com/question/1/answer/1",
      useHtmlStyleForImage: true,
    });

    expect(result.ok).toBe(true);
    expect(result.markdown).toContain("\\[捂脸\\]");
    expect(result.markdown).not.toContain("<img src=");
  });

  test("converts pin sticker image with ascii-bracket alt to emoji text", async () => {
    const result = await parseHtmlToMarkdown({
      html: zhihuPinFixtureWithEmojiImage,
      sourceUrl: "https://www.zhihu.com/pin/2222222222222222222",
    });

    expect(result.ok).toBe(true);
    expect(result.markdown).toContain("Pin emoji \\[惊喜\\]");
    expect(result.markdown).not.toContain("![](https://picx.zhimg.com/pin-emoji.png)");
  });

  test("converts zhihu post sticker image with ascii-bracket alt to emoji text", async () => {
    const result = await parseHtmlToMarkdown({
      html: zhihuZhuanlanFixtureWithEmojiImage,
      sourceUrl: "https://zhuanlan.zhihu.com/p/3333333333333333333",
    });

    expect(result.ok).toBe(true);
    expect(result.markdown).toContain("Zhuanlan emoji \\[捂脸\\]");
    expect(result.markdown).not.toContain("![](https://picx.zhimg.com/zhuanlan-emoji.png)");
  });

  test("does not treat non-emoji images as emoji", async () => {
    const stickerResult = await parseHtmlToMarkdown({
      html: zhihuFixtureWithStickerButNotBracketAlt,
      sourceUrl: "https://www.zhihu.com/question/1/answer/1",
    });
    const bracketResult = await parseHtmlToMarkdown({
      html: zhihuFixtureWithBracketAltButNoSticker,
      sourceUrl: "https://www.zhihu.com/question/1/answer/1",
    });

    expect(stickerResult.ok).toBe(true);
    expect(stickerResult.markdown).toContain("![](https://picx.zhimg.com/not-emoji.png)");
    expect(stickerResult.markdown).not.toContain("\\[捂脸\\]");
    expect(bracketResult.ok).toBe(true);
    expect(bracketResult.markdown).toContain("![](https://picx.zhimg.com/not-emoji-2.png)");
    expect(bracketResult.markdown).not.toContain("\\[捂脸\\]");
  });

  test("parses pin markdown", async () => {
    const result = await parseHtmlToMarkdown({
      html: zhihuPinFixture,
      sourceUrl: "https://www.zhihu.com/pin/2222222222222222222",
    });

    expect(result.ok).toBe(true);
    expect(result.title).toContain("Sanitized Pin Title");
    expect(result.markdown).toContain("Pin first line.");
    expect(result.markdown).toContain("Pin second line");
    expect(result.markdown).toContain("$x+y=z$");
    expect(result.markdown).toContain("发布于 2026-01-15 10:00");
    expect(result.markdown).not.toContain("# Sanitized Pin Title");
  });

  test("parses zhihu post markdown", async () => {
    const result = await parseHtmlToMarkdown({
      html: zhihuZhuanlanFixture,
      sourceUrl: "https://zhuanlan.zhihu.com/p/3333333333333333333",
    });

    expect(result.ok).toBe(true);
    expect(result.title).toBe("Sanitized Zhuanlan Title");
    expect(result.markdown).toContain("Zhuanlan first paragraph.");
    expect(result.markdown).toContain("$a^2+b^2=c^2$");
    expect(result.markdown).not.toContain(".css-");
    expect(result.markdown).not.toContain("position:absolute");
    expect(result.markdown).not.toContain("<style>");
  });

  test("parses zhihu post sample-like html without css leakage", async () => {
    const result = await parseHtmlToMarkdown({
      html: zhihuZhuanlanSampleLikeFixture,
      sourceUrl: "https://zhuanlan.zhihu.com/p/3333333333333333333",
    });

    expect(result.ok).toBe(true);
    expect(result.title).toBe("Sanitized Sample Title");
    expect(result.markdown).toContain("Sanitized chapter one");
    expect(result.markdown).toContain("early summer");
    expect(result.markdown).not.toContain(".css-");
    expect(result.markdown).not.toContain("position:absolute");
    expect(result.markdown).not.toContain("<style>");
  });

  test("parses zhihu post markdown when time is under article.Post-Main", async () => {
    const html = `<!doctype html>
<html>
  <body>
    <h1 class="Post-Title">Zhuanlan Variant Title</h1>
    <article class="Post-Main Post-NormalMain">
      <div class="ContentItem-time">发布于 2026-02-03 20:37・广东</div>
    </article>
    <div class="Post-content">
      <div class="RichText ztext">
        <p>Zhuanlan variant paragraph.</p>
      </div>
    </div>
  </body>
</html>`;
    const result = await parseHtmlToMarkdown({
      html,
      sourceUrl: "https://zhuanlan.zhihu.com/p/3333333333333333333",
    });

    expect(result.ok).toBe(true);
    expect(result.title).toBe("Zhuanlan Variant Title");
    expect(result.markdown).toContain("Zhuanlan variant paragraph.");
    expect(result.markdown).toContain("发布于 2026-02-03 20:37");
  });

  test("fails fast on strict selector misses", async () => {
    const pinResult = await parseHtmlToMarkdown({
      html: "<html><head><meta property=\"og:title\" content=\"X\" /></head><body><div class=\"PinItem\">no pin content</div></body></html>",
      sourceUrl: "https://www.zhihu.com/pin/2222222222222222222",
    });
    const zhuanlanResult = await parseHtmlToMarkdown({
      html: "<html><head></head><body><h1 class=\"Post-Title\">X</h1><div>no zhuanlan content</div></body></html>",
      sourceUrl: "https://zhuanlan.zhihu.com/p/3333333333333333333",
    });
    const answerTitleResult = await parseHtmlToMarkdown({
      html: "<html><head><title>X</title></head><body><div class=\"AnswerItem\"><span class=\"RichText\"><p>Body</p></span></div></body></html>",
      sourceUrl: "https://www.zhihu.com/question/1/answer/1",
    });
    const pinTitleResult = await parseHtmlToMarkdown({
      html: "<html><head><title>X</title></head><body><div class=\"PinItem\"><span class=\"RichText ztext\"><p>Body</p></span></div></body></html>",
      sourceUrl: "https://www.zhihu.com/pin/2222222222222222222",
    });
    const zhuanlanTimeResult = await parseHtmlToMarkdown({
      html: "<html><body><h1 class=\"Post-Title\">X</h1><div class=\"Post-content\"><div class=\"RichText ztext\"><p>Body</p></div></div></body></html>",
      sourceUrl: "https://zhuanlan.zhihu.com/p/3333333333333333333",
    });

    expect(pinResult.ok).toBe(false);
    expect(pinResult.reason).toContain("pin");
    expect(pinResult.reason).toContain("content selector");
    expect(zhuanlanResult.ok).toBe(false);
    expect(zhuanlanResult.reason).toContain("post");
    expect(answerTitleResult.ok).toBe(false);
    expect(answerTitleResult.reason).toContain("title selector");
    expect(pinTitleResult.ok).toBe(false);
    expect(pinTitleResult.reason).toContain("title selector");
    expect(zhuanlanTimeResult.ok).toBe(false);
    expect(zhuanlanTimeResult.reason).toContain("time selector");
  });
});

describe("zhihu metadata parsing", () => {
  test("extracts only reserved article metadata fields", async () => {
    const result = await parseHtmlToMetadata({
      html: zhihuAnswerFixture,
      sourceUrl: "https://www.zhihu.com/question/1/answer/2",
    });

    expect(result.ok).toBe(true);
    expect(result.metadata).toEqual({
      articleUrl: "https://www.zhihu.com/question/1/answer/2",
      authorId: "Sanitized Author A",
      authorHomepage: "https://www.zhihu.com/people/sanitized-author-a",
      publishTime: "2026-01-15",
      editTime: "编辑于 2026-01-16",
    });
  });

  test("extracts metadata for pin", async () => {
    const result = await parseHtmlToMetadata({
      html: zhihuPinFixture,
      sourceUrl: "https://www.zhihu.com/pin/2222222222222222222",
    });

    expect(result.ok).toBe(true);
    expect(result.metadata).toEqual({
      articleUrl: "https://www.zhihu.com/pin/2222222222222222222",
      authorId: "Sanitized Author B",
      authorHomepage: "https://www.zhihu.com/people/sanitized-author-b",
      publishTime: "发布于 2026-01-15 10:00",
      editTime: undefined,
    });
  });

  test("extracts metadata for zhihu post", async () => {
    const result = await parseHtmlToMetadata({
      html: zhihuZhuanlanFixture,
      sourceUrl: "https://zhuanlan.zhihu.com/p/3333333333333333333",
    });

    expect(result.ok).toBe(true);
    expect(result.metadata).toEqual({
      articleUrl: "https://zhuanlan.zhihu.com/p/3333333333333333333",
      authorId: "Sanitized Author C",
      authorHomepage: "https://www.zhihu.com/people/sanitized-author-c",
      publishTime: "发布于 2026-01-20 14:30",
      editTime: undefined,
    });
  });

  test("keeps edit time optional when unavailable", async () => {
    const html = `<!doctype html>
<html>
  <body>
    <div class="AnswerItem">
      <div class="AnswerItem-authorInfo">
        <meta itemprop="name" content="no-edit-author-id" />
        <meta itemprop="url" content="https://www.zhihu.com/people/no-edit-author-home" />
      </div>
      <div class="ContentItem-time">
        <a href="//zhuanlan.zhihu.com/p/456" data-tooltip="2026-02-01">2026-02-01</a>
      </div>
    </div>
  </body>
</html>`;

    const result = await parseHtmlToMetadata({
      html,
      sourceUrl: "https://www.zhihu.com/question/3/answer/4",
    });

    expect(result.ok).toBe(true);
    expect(result.metadata).toEqual({
      articleUrl: "https://www.zhihu.com/question/3/answer/4",
      authorId: "no-edit-author-id",
      authorHomepage: "https://www.zhihu.com/people/no-edit-author-home",
      publishTime: "2026-02-01",
      editTime: undefined,
    });
  });

  test("extracts metadata from alternate answer structure", async () => {
    const result = await parseHtmlToMetadata({
      html: zhihuAnswerAlternateStructureFixture,
      sourceUrl: "https://www.zhihu.com/question/9/answer/10",
    });

    expect(result.ok).toBe(true);
    expect(result.metadata).toEqual({
      articleUrl: "https://www.zhihu.com/question/9/answer/10",
      authorId: "alternate-author",
      authorHomepage: "https://www.zhihu.com/people/alternate-author",
      publishTime: "2026-03-02",
      editTime: undefined,
    });
  });

  test("fails on metadata selector issues", async () => {
    const missingTooltip = await parseHtmlToMetadata({
      html: `<!doctype html>
<html>
  <body>
    <div class="PinItem">
      <div class="PinItem-authorInfo">
        <meta itemprop="name" content="pin-author" />
        <meta itemprop="url" content="https://www.zhihu.com/people/pin-author" />
      </div>
      <div class="ContentItem-time">
        <a href="//www.zhihu.com/pin/1">发布于 2026-02-16 09:48</a>
      </div>
    </div>
  </body>
</html>`,
      sourceUrl: "https://www.zhihu.com/pin/1",
    });
    const relativeHomepage = await parseHtmlToMetadata({
      html: `<!doctype html>
<html>
  <body>
    <div class="AnswerItem-authorInfo">
      <meta itemprop="name" content="bad-home-author" />
      <meta itemprop="url" content="/people/bad-home-author" />
    </div>
    <div class="ContentItem-time">
      <a href="//zhuanlan.zhihu.com/p/456" data-tooltip="2026-02-01">2026-02-01</a>
    </div>
  </body>
</html>`,
      sourceUrl: "https://www.zhihu.com/question/3/answer/4",
    });
    const missingName = await parseHtmlToMetadata({
      html: `<!doctype html>
<html>
  <body>
    <div class="AnswerItem-authorInfo">
      <meta itemprop="url" content="https://www.zhihu.com/people/author-only-url" />
    </div>
    <div class="ContentItem-time">
      <a href="//zhuanlan.zhihu.com/p/456" data-tooltip="2026-02-01">2026-02-01</a>
    </div>
  </body>
</html>`,
      sourceUrl: "https://www.zhihu.com/question/3/answer/4",
    });
    const missingHomepage = await parseHtmlToMetadata({
      html: `<!doctype html>
<html>
  <body>
    <div class="AnswerItem-authorInfo">
      <meta itemprop="name" content="author-only-name" />
    </div>
    <div class="ContentItem-time">
      <a href="//zhuanlan.zhihu.com/p/456" data-tooltip="2026-02-01">2026-02-01</a>
    </div>
  </body>
</html>`,
      sourceUrl: "https://www.zhihu.com/question/3/answer/4",
    });
    const missingAuthorAndTime = await parseHtmlToMetadata({
      html: "<html><body><div>no author/time</div></body></html>",
      sourceUrl: "https://www.zhihu.com/pin/2222222222222222222",
    });

    expect(missingTooltip.ok).toBe(false);
    expect(missingTooltip.reason).toContain("publish time");
    expect(relativeHomepage.ok).toBe(false);
    expect(relativeHomepage.reason).toContain("author homepage");
    expect(missingName.ok).toBe(false);
    expect(missingName.reason).toContain("author name or homepage");
    expect(missingHomepage.ok).toBe(false);
    expect(missingHomepage.reason).toContain("author name or homepage");
    expect(missingAuthorAndTime.ok).toBe(false);
    expect(missingAuthorAndTime.reason).toContain("pin");
  });
});
