import { readFileSync } from "node:fs";
import { describe, expect, test } from "vitest";
import { parseHtmlToMarkdown, parseHtmlToMetadata } from "../src/core/parser.js";

const fixture = readFileSync("tests/fixtures/zhihu-answer.html", "utf8");
const pinFixture = readFileSync("tests/fixtures/zhihu-pin.html", "utf8");
const zhuanlanFixture = readFileSync("tests/fixtures/zhihu-zhuanlan.html", "utf8");
const zhuanlanSampleLikeFixture = readFileSync("tests/fixtures/zhihu-zhuanlan-sample-like.html", "utf8");
const fixtureWithImage = `<!doctype html>
<html>
  <head>
    <title>Zhihu Fixture Title</title>
  </head>
  <body>
    <h1 class="QuestionHeader-title">Zhihu Fixture Title</h1>
    <div class="AnswerItem">
      <span class="RichText">
        <p>Image paragraph.</p>
        <img src="https://picx.zhimg.com/test-image.png" data-rawheight="100" data-rawwidth="200" />
      </span>
    </div>
  </body>
</html>`;
const fixtureWithInlineMath = `<!doctype html>
<html>
  <head>
    <title>Zhihu Fixture Title</title>
  </head>
  <body>
    <h1 class="QuestionHeader-title">Zhihu Fixture Title</h1>
    <div class="AnswerItem">
      <span class="RichText">
        <p>Formula: <span class="ztext-math" data-tex="x^2+y^2=z^2">x^2+y^2=z^2</span></p>
        <p>Trimmed: <span class="ztext-math" data-tex=" d^2 = x^2 + y^2 "> d^2 = x^2 + y^2 </span></p>
        <p>Empty: <span class="ztext-math" data-tex="   ">ignored</span></p>
      </span>
    </div>
  </body>
</html>`;
const fixtureWithBlockMath = `<!doctype html>
<html>
  <head>
    <title>Zhihu Fixture Title</title>
  </head>
  <body>
    <h1 class="QuestionHeader-title">Zhihu Fixture Title</h1>
    <div class="AnswerItem">
      <span class="RichText">
        <p>Before block.</p>
        <span class="ztext-math" data-tex="\\int_0^1 x dx\\\\">
          <span class="MJX_Assistive_MathML MJX_Assistive_MathML_Block" role="presentation"></span>
          <script type="math/tex;mode=display">\\int_0^1 x dx\\\\</script>
        </span>
        <p>After block.</p>
      </span>
    </div>
  </body>
</html>`;
const fixtureWithEmojiImage = `<!doctype html>
<html>
  <head>
    <title>Zhihu Fixture Title</title>
  </head>
  <body>
    <h1 class="QuestionHeader-title">Zhihu Fixture Title</h1>
    <div class="AnswerItem">
      <span class="RichText">
        <p>
          Emoji:
          <img
            src="https://picx.zhimg.com/emoji.png"
            class="sticker"
            alt="[捂脸]"
          />
        </p>
      </span>
    </div>
  </body>
</html>`;
const pinFixtureWithEmojiImage = `<!doctype html>
<html>
  <head>
    <title>Pin Fixture Title - 知乎</title>
    <meta property="og:title" content="Pin Fixture Title - 知乎" />
  </head>
  <body>
    <div class="PinItem">
      <div class="PinItem-authorInfo">
        <meta itemprop="name" content="Pin Emoji Author" />
        <meta itemprop="url" content="https://www.zhihu.com/people/pin-emoji-author" />
      </div>
      <span class="RichText ztext">
        <p>Pin emoji <img class="sticker" alt="[惊喜]" src="https://picx.zhimg.com/pin-emoji.png" /></p>
      </span>
      <div class="ContentItem-time">发布于 2026-02-16 09:48</div>
    </div>
  </body>
</html>`;
const zhuanlanFixtureWithEmojiImage = `<!doctype html>
<html>
  <head>
    <title>Zhuanlan Fixture Title - 知乎</title>
    <meta property="og:title" content="Zhuanlan Fixture Title - 知乎" />
  </head>
  <body>
    <h1 class="Post-Title">Zhuanlan Fixture Title</h1>
    <div class="Post-Author">
      <meta itemprop="name" content="Zhuanlan Emoji Author" />
      <meta itemprop="url" content="https://www.zhihu.com/people/zhuanlan-emoji-author" />
    </div>
    <div class="Post-Header">
      <div class="ContentItem-time">发布于 2026-02-03 20:37</div>
    </div>
    <div class="Post-content">
      <div class="Post-RichTextContainer">
        <style>.css-noise{position:absolute;}</style>
        <div class="RichText ztext">
          <p>Zhuanlan emoji <img class="sticker" alt="[捂脸]" src="https://picx.zhimg.com/zhuanlan-emoji.png" /></p>
        </div>
      </div>
    </div>
  </body>
</html>`;
const fixtureWithStickerButNotBracketAlt = `<!doctype html>
<html>
  <head>
    <title>Zhihu Fixture Title</title>
  </head>
  <body>
    <h1 class="QuestionHeader-title">Zhihu Fixture Title</h1>
    <div class="AnswerItem">
      <span class="RichText">
        <p>Not emoji <img class="sticker" alt="捂脸" src="https://picx.zhimg.com/not-emoji.png" /></p>
      </span>
    </div>
  </body>
</html>`;
const fixtureWithBracketAltButNoSticker = `<!doctype html>
<html>
  <head>
    <title>Zhihu Fixture Title</title>
  </head>
  <body>
    <h1 class="QuestionHeader-title">Zhihu Fixture Title</h1>
    <div class="AnswerItem">
      <span class="RichText">
        <p>Not emoji <img alt="[捂脸]" src="https://picx.zhimg.com/not-emoji-2.png" /></p>
      </span>
    </div>
  </body>
</html>`;
const substackFixture = `<!doctype html>
<html>
  <head>
    <title>Trading Post Friday May 8, 2026 - by Michael Burry</title>
    <meta name="author" content="Michael Burry" />
    <meta property="og:title" content="Trading Post Friday May 8, 2026" />
    <meta property="og:url" content="https://michaeljburry.substack.com/p/trading-post-friday-may-8-2026" />
    <link rel="canonical" href="https://michaeljburry.substack.com/p/trading-post-friday-may-8-2026" />
    <script type="application/ld+json">
      {
        "@context": "https://schema.org",
        "@type": "NewsArticle",
        "url": "https://michaeljburry.substack.com/p/trading-post-friday-may-8-2026",
        "mainEntityOfPage": "https://michaeljburry.substack.com/p/trading-post-friday-may-8-2026",
        "headline": "Trading Post Friday May 8, 2026",
        "description": "TGIF",
        "datePublished": "2026-05-08T16:21:07+00:00",
        "dateModified": "2026-05-08T16:21:53+00:00",
        "author": [
          {
            "@type": "Person",
            "name": "Michael Burry",
            "url": "https://substack.com/@michaeljburry"
          }
        ]
      }
    </script>
  </head>
  <body>
    <article>
      <h1 class="post-title">Trading Post Friday May 8, 2026</h1>
      <h3 class="subtitle">TGIF</h3>
      <div class="byline-wrapper">
        <a href="https://substack.com/@michaeljburry">Michael Burry</a>
        <div class="meta-EgzBVA">May 08, 2026</div>
        <div class="meta-EgzBVA">Paid</div>
      </div>
      <div class="available-content">
        <div class="body markup">
          <p>Huge rally in stocks today. Very much more of the same.</p>
          <p>Yellow is the Philadelphia Semiconductor Index, up ~224% since the 90 Day Pause.</p>
          <div class="captioned-image-container">
            <figure>
              <a href="https://cdn.example.com/full.png">
                <img
                  src="https://cdn.example.com/preview.png"
                  data-attrs="{&quot;src&quot;:&quot;https://cdn.example.com/original.png&quot;,&quot;height&quot;:1065,&quot;width&quot;:1326}"
                  width="1326"
                  height="1065"
                  alt=""
                />
              </a>
            </figure>
          </div>
        </div>
      </div>
      <div data-testid="paywall">This post is for paid subscribers</div>
    </article>
  </body>
</html>`;
const substackPreloadOnlyFixture = `<!doctype html>
<html>
  <head>
    <title>Fallback Substack Title - by Example Author</title>
    <script>
      window._preloads = JSON.parse("{\\"post\\":{\\"canonical_url\\":\\"https://examplepublication.substack.com/p/fallback-post\\",\\"post_date\\":\\"2026-06-01T10:00:00.000Z\\",\\"updated_at\\":\\"2026-06-01T10:05:00.000Z\\",\\"subtitle\\":\\"Fallback subtitle\\",\\"title\\":\\"Fallback Substack Title\\",\\"body_html\\":\\"<p>Fallback body paragraph.</p><p>Second paragraph.</p>\\"},\\"publishedBylines\\":[{\\"name\\":\\"Example Author\\",\\"handle\\":\\"exampleauthor\\"}],\\"canonicalUrl\\":\\"https://examplepublication.substack.com/p/fallback-post\\",\\"ogUrl\\":\\"https://examplepublication.substack.com/p/fallback-post\\"}");
    </script>
  </head>
  <body>
    <article>
      <h1 class="post-title">Fallback Substack Title</h1>
    </article>
  </body>
</html>`;

describe("parseHtmlToMarkdown", () => {
  test("extracts title and main content for zhihu", async () => {
    const result = await parseHtmlToMarkdown({
      html: fixture,
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

  test("fails on unsupported host", async () => {
    const result = await parseHtmlToMarkdown({
      html: fixture,
      sourceUrl: "https://example.com/article",
    });

    expect(result.ok).toBe(false);
    expect(result.errorCode).toBe("E_PARSE_UNSUPPORTED_SITE");
  });

  test("fails on unsupported zhihu path", async () => {
    const result = await parseHtmlToMarkdown({
      html: fixture,
      sourceUrl: "https://www.zhihu.com/question/111111111",
    });

    expect(result.ok).toBe(false);
    expect(result.errorCode).toBe("E_PARSE_UNSUPPORTED_SITE");
  });

  test("uses markdown image output by default", async () => {
    const result = await parseHtmlToMarkdown({
      html: fixtureWithImage,
      sourceUrl: "https://www.zhihu.com/question/1/answer/1",
    });

    expect(result.ok).toBe(true);
    expect(result.markdown).toContain("![](https://picx.zhimg.com/test-image.png)");
    expect(result.markdown).not.toContain("<img src=");
  });

  test("uses html image output when enabled", async () => {
    const result = await parseHtmlToMarkdown({
      html: fixtureWithImage,
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
      html: fixtureWithInlineMath,
      sourceUrl: "https://www.zhihu.com/question/1/answer/1",
    });

    expect(result.ok).toBe(true);
    expect(result.markdown).toContain("$x^2+y^2=z^2$");
  });

  test("trims whitespace in zhihu inline math tex payload", async () => {
    const result = await parseHtmlToMarkdown({
      html: fixtureWithInlineMath,
      sourceUrl: "https://www.zhihu.com/question/1/answer/1",
    });

    expect(result.ok).toBe(true);
    expect(result.markdown).toContain("$d^2 = x^2 + y^2$");
  });

  test("drops zhihu inline math nodes with empty tex payload", async () => {
    const result = await parseHtmlToMarkdown({
      html: fixtureWithInlineMath,
      sourceUrl: "https://www.zhihu.com/question/1/answer/1",
    });

    expect(result.ok).toBe(true);
    expect(result.markdown).not.toContain("$ignored$");
    expect(result.markdown).toContain("Empty:");
  });

  test("converts zhihu display math to markdown block equation", async () => {
    const result = await parseHtmlToMarkdown({
      html: fixtureWithBlockMath,
      sourceUrl: "https://www.zhihu.com/question/1/answer/1",
    });

    expect(result.ok).toBe(true);
    expect(result.markdown).toContain("$$\n\\int_0^1 x dx\\\\\n$$");
    expect(result.markdown).toContain("Before block.");
    expect(result.markdown).toContain("After block.");
  });

  test("converts zhihu emoji image to bracketed alt text", async () => {
    const result = await parseHtmlToMarkdown({
      html: fixtureWithEmojiImage,
      sourceUrl: "https://www.zhihu.com/question/1/answer/1",
    });

    expect(result.ok).toBe(true);
    expect(result.markdown).toContain("Emoji:");
    expect(result.markdown).toContain("\\[捂脸\\]");
    expect(result.markdown).not.toContain("![](https://picx.zhimg.com/emoji.png)");
  });

  test("emoji image handling is independent of html image output mode", async () => {
    const result = await parseHtmlToMarkdown({
      html: fixtureWithEmojiImage,
      sourceUrl: "https://www.zhihu.com/question/1/answer/1",
      useHtmlStyleForImage: true,
    });

    expect(result.ok).toBe(true);
    expect(result.markdown).toContain("\\[捂脸\\]");
    expect(result.markdown).not.toContain("<img src=");
  });

  test("converts pin sticker image with ascii-bracket alt to emoji text", async () => {
    const result = await parseHtmlToMarkdown({
      html: pinFixtureWithEmojiImage,
      sourceUrl: "https://www.zhihu.com/pin/2222222222222222222",
    });

    expect(result.ok).toBe(true);
    expect(result.markdown).toContain("Pin emoji \\[惊喜\\]");
    expect(result.markdown).not.toContain("![](https://picx.zhimg.com/pin-emoji.png)");
  });

  test("converts zhuanlan sticker image with ascii-bracket alt to emoji text", async () => {
    const result = await parseHtmlToMarkdown({
      html: zhuanlanFixtureWithEmojiImage,
      sourceUrl: "https://zhuanlan.zhihu.com/p/3333333333333333333",
    });

    expect(result.ok).toBe(true);
    expect(result.markdown).toContain("Zhuanlan emoji \\[捂脸\\]");
    expect(result.markdown).not.toContain("![](https://picx.zhimg.com/zhuanlan-emoji.png)");
  });

  test("does not treat sticker image without ascii-bracket alt as emoji", async () => {
    const result = await parseHtmlToMarkdown({
      html: fixtureWithStickerButNotBracketAlt,
      sourceUrl: "https://www.zhihu.com/question/1/answer/1",
    });

    expect(result.ok).toBe(true);
    expect(result.markdown).toContain("![](https://picx.zhimg.com/not-emoji.png)");
    expect(result.markdown).not.toContain("\\[捂脸\\]");
  });

  test("does not treat non-sticker image with bracket alt as emoji", async () => {
    const result = await parseHtmlToMarkdown({
      html: fixtureWithBracketAltButNoSticker,
      sourceUrl: "https://www.zhihu.com/question/1/answer/1",
    });

    expect(result.ok).toBe(true);
    expect(result.markdown).toContain("![](https://picx.zhimg.com/not-emoji-2.png)");
    expect(result.markdown).not.toContain("\\[捂脸\\]");
  });

  test("parses zhihu pin markdown", async () => {
    const result = await parseHtmlToMarkdown({
      html: pinFixture,
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

  test("parses zhihu zhuanlan markdown", async () => {
    const result = await parseHtmlToMarkdown({
      html: zhuanlanFixture,
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

  test("parses zhuanlan sample-like html without css leakage", async () => {
    const result = await parseHtmlToMarkdown({
      html: zhuanlanSampleLikeFixture,
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

  test("parses zhuanlan markdown when time is under article.Post-Main", async () => {
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

  test("parses substack markdown from publication url", async () => {
    const result = await parseHtmlToMarkdown({
      html: substackFixture,
      sourceUrl: "https://michaeljburry.substack.com/p/trading-post-friday-may-8-2026",
    });

    expect(result.ok).toBe(true);
    expect(result.title).toBe("Trading Post Friday May 8, 2026");
    expect(result.markdown).toContain("# Trading Post Friday May 8, 2026");
    expect(result.markdown).toContain("\n\nTGIF\n\n");
    expect(result.markdown).toContain("[Michael Burry](https://substack.com/@michaeljburry)");
    expect(result.markdown).toContain("May 08, 2026");
    expect(result.markdown).toContain("Huge rally in stocks today. Very much more of the same.");
    expect(result.markdown).toContain("![](https://cdn.example.com/original.png)");
    expect(result.markdown).not.toContain("](https://cdn.example.com/full.png)");
    expect(result.markdown).not.toContain("This post is for paid subscribers");
  });

  test("parses substack markdown from aggregator url", async () => {
    const result = await parseHtmlToMarkdown({
      html: substackFixture,
      sourceUrl: "https://substack.com/@michaeljburry/p-196918166",
    });

    expect(result.ok).toBe(true);
    expect(result.markdown).toContain("# Trading Post Friday May 8, 2026");
    expect(result.markdown).toContain("[Michael Burry](https://substack.com/@michaeljburry)");
  });

  test("parses substack markdown from preload fallback when visible body is missing", async () => {
    const result = await parseHtmlToMarkdown({
      html: substackPreloadOnlyFixture,
      sourceUrl: "https://substack.com/@exampleauthor/p-123456789",
    });

    expect(result.ok).toBe(true);
    expect(result.title).toBe("Fallback Substack Title");
    expect(result.markdown).toContain("# Fallback Substack Title");
    expect(result.markdown).toContain("\n\nFallback subtitle\n\n");
    expect(result.markdown).toContain("[Example Author](https://substack.com/@exampleauthor)");
    expect(result.markdown).toContain("Fallback body paragraph.");
    expect(result.markdown).toContain("Second paragraph.");
  });

  test("fails fast on selector miss for supported pin content selector", async () => {
    const result = await parseHtmlToMarkdown({
      html: "<html><head><meta property=\"og:title\" content=\"X\" /></head><body><div class=\"PinItem\">no pin content</div></body></html>",
      sourceUrl: "https://www.zhihu.com/pin/2222222222222222222",
    });

    expect(result.ok).toBe(false);
    expect(result.errorCode).toBe("E_PARSE_SELECTOR");
    expect(result.reason).toContain("pin");
    expect(result.reason).toContain("content selector");
  });

  test("fails fast on zhuanlan selector miss for supported content selector", async () => {
    const result = await parseHtmlToMarkdown({
      html: "<html><head></head><body><h1 class=\"Post-Title\">X</h1><div>no zhuanlan content</div></body></html>",
      sourceUrl: "https://zhuanlan.zhihu.com/p/3333333333333333333",
    });

    expect(result.ok).toBe(false);
    expect(result.errorCode).toBe("E_PARSE_SELECTOR");
    expect(result.reason).toContain("zhuanlan_article");
    expect(result.reason).toContain("content selector");
  });

  test("fails fast on strict answer title selector miss", async () => {
    const result = await parseHtmlToMarkdown({
      html: "<html><head><title>X</title></head><body><div class=\"AnswerItem\"><span class=\"RichText\"><p>Body</p></span></div></body></html>",
      sourceUrl: "https://www.zhihu.com/question/1/answer/1",
    });

    expect(result.ok).toBe(false);
    expect(result.errorCode).toBe("E_PARSE_SELECTOR");
    expect(result.reason).toContain("answer");
    expect(result.reason).toContain("title selector");
  });

  test("fails fast on strict pin title selector miss", async () => {
    const result = await parseHtmlToMarkdown({
      html: "<html><head><title>X</title></head><body><div class=\"PinItem\"><span class=\"RichText ztext\"><p>Body</p></span></div></body></html>",
      sourceUrl: "https://www.zhihu.com/pin/2222222222222222222",
    });

    expect(result.ok).toBe(false);
    expect(result.errorCode).toBe("E_PARSE_SELECTOR");
    expect(result.reason).toContain("pin");
    expect(result.reason).toContain("title selector");
  });

  test("fails fast on strict zhuanlan time selector miss", async () => {
    const result = await parseHtmlToMarkdown({
      html: "<html><body><h1 class=\"Post-Title\">X</h1><div class=\"Post-content\"><div class=\"RichText ztext\"><p>Body</p></div></div></body></html>",
      sourceUrl: "https://zhuanlan.zhihu.com/p/3333333333333333333",
    });

    expect(result.ok).toBe(false);
    expect(result.errorCode).toBe("E_PARSE_SELECTOR");
    expect(result.reason).toContain("zhuanlan_article");
    expect(result.reason).toContain("time selector");
  });
});

describe("parseHtmlToMetadata", () => {
  test("extracts only reserved article metadata fields", async () => {
    const result = await parseHtmlToMetadata({
      html: fixture,
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
      html: pinFixture,
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

  test("extracts metadata for zhuanlan article", async () => {
    const result = await parseHtmlToMetadata({
      html: zhuanlanFixture,
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

  test("extracts substack metadata from publication url", async () => {
    const result = await parseHtmlToMetadata({
      html: substackFixture,
      sourceUrl: "https://michaeljburry.substack.com/p/trading-post-friday-may-8-2026",
    });

    expect(result.ok).toBe(true);
    expect(result.metadata).toEqual({
      articleUrl: "https://michaeljburry.substack.com/p/trading-post-friday-may-8-2026",
      authorId: "Michael Burry",
      authorHomepage: "https://substack.com/@michaeljburry",
      publishTime: "2026-05-08T16:21:07+00:00",
      editTime: "2026-05-08T16:21:53+00:00",
    });
  });

  test("extracts substack metadata from aggregator url using canonical article url", async () => {
    const result = await parseHtmlToMetadata({
      html: substackFixture,
      sourceUrl: "https://substack.com/@michaeljburry/p-196918166",
    });

    expect(result.ok).toBe(true);
    expect(result.metadata).toEqual({
      articleUrl: "https://michaeljburry.substack.com/p/trading-post-friday-may-8-2026",
      authorId: "Michael Burry",
      authorHomepage: "https://substack.com/@michaeljburry",
      publishTime: "2026-05-08T16:21:07+00:00",
      editTime: "2026-05-08T16:21:53+00:00",
    });
  });

  test("extracts substack metadata from preload fallback", async () => {
    const result = await parseHtmlToMetadata({
      html: substackPreloadOnlyFixture,
      sourceUrl: "https://substack.com/@exampleauthor/p-123456789",
    });

    expect(result.ok).toBe(true);
    expect(result.metadata).toEqual({
      articleUrl: "https://examplepublication.substack.com/p/fallback-post",
      authorId: "Example Author",
      authorHomepage: "https://substack.com/@exampleauthor",
      publishTime: "2026-06-01T10:00:00.000Z",
      editTime: "2026-06-01T10:05:00.000Z",
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

  test("fails when pin publish time tooltip is missing", async () => {
    const html = `<!doctype html>
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
</html>`;

    const result = await parseHtmlToMetadata({
      html,
      sourceUrl: "https://www.zhihu.com/pin/1",
    });

    expect(result.ok).toBe(false);
    expect(result.errorCode).toBe("E_PARSE_SELECTOR");
    expect(result.reason).toContain("publish time");
  });

  test("fails when author homepage is not an absolute url", async () => {
    const html = `<!doctype html>
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
</html>`;

    const result = await parseHtmlToMetadata({
      html,
      sourceUrl: "https://www.zhihu.com/question/3/answer/4",
    });

    expect(result.ok).toBe(false);
    expect(result.errorCode).toBe("E_PARSE_SELECTOR");
    expect(result.reason).toContain("author homepage");
  });

  test("fails when author meta lacks name", async () => {
    const html = `<!doctype html>
<html>
  <body>
    <div class="AnswerItem-authorInfo">
      <meta itemprop="url" content="https://www.zhihu.com/people/author-only-url" />
    </div>
    <div class="ContentItem-time">
      <a href="//zhuanlan.zhihu.com/p/456" data-tooltip="2026-02-01">2026-02-01</a>
    </div>
  </body>
</html>`;

    const result = await parseHtmlToMetadata({
      html,
      sourceUrl: "https://www.zhihu.com/question/3/answer/4",
    });

    expect(result.ok).toBe(false);
    expect(result.errorCode).toBe("E_PARSE_SELECTOR");
    expect(result.reason).toContain("author name or homepage");
  });

  test("fails when author meta lacks homepage url", async () => {
    const html = `<!doctype html>
<html>
  <body>
    <div class="AnswerItem-authorInfo">
      <meta itemprop="name" content="author-only-name" />
    </div>
    <div class="ContentItem-time">
      <a href="//zhuanlan.zhihu.com/p/456" data-tooltip="2026-02-01">2026-02-01</a>
    </div>
  </body>
</html>`;

    const result = await parseHtmlToMetadata({
      html,
      sourceUrl: "https://www.zhihu.com/question/3/answer/4",
    });

    expect(result.ok).toBe(false);
    expect(result.errorCode).toBe("E_PARSE_SELECTOR");
    expect(result.reason).toContain("author name or homepage");
  });

  test("fails fast on metadata selector miss for supported type", async () => {
    const result = await parseHtmlToMetadata({
      html: "<html><body><div>no author/time</div></body></html>",
      sourceUrl: "https://www.zhihu.com/pin/2222222222222222222",
    });

    expect(result.ok).toBe(false);
    expect(result.errorCode).toBe("E_PARSE_SELECTOR");
    expect(result.reason).toContain("pin");
  });
});
