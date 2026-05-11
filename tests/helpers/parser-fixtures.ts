import { readFileSync } from "node:fs";

export const zhihuAnswerFixture = readFileSync("tests/fixtures/zhihu-answer.html", "utf8");
export const zhihuPinFixture = readFileSync("tests/fixtures/zhihu-pin.html", "utf8");
export const zhihuZhuanlanFixture = readFileSync("tests/fixtures/zhihu-zhuanlan.html", "utf8");
export const zhihuZhuanlanSampleLikeFixture = readFileSync("tests/fixtures/zhihu-zhuanlan-sample-like.html", "utf8");

export const zhihuFixtureWithImage = `<!doctype html>
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

export const zhihuFixtureWithInlineMath = `<!doctype html>
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

export const zhihuFixtureWithBlockMath = `<!doctype html>
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

export const zhihuFixtureWithEmojiImage = `<!doctype html>
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

export const zhihuPinFixtureWithEmojiImage = `<!doctype html>
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

export const zhihuZhuanlanFixtureWithEmojiImage = `<!doctype html>
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

export const zhihuFixtureWithStickerButNotBracketAlt = `<!doctype html>
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

export const zhihuFixtureWithBracketAltButNoSticker = `<!doctype html>
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

export const zhihuAnswerAlternateStructureFixture = `<!doctype html>
<html>
  <head>
    <title>Zhihu Alternate Fixture Title</title>
  </head>
  <body>
    <h1 class="ContentItem-title">Zhihu Alternate Fixture Title</h1>
    <div class="AnswerItem">
      <div class="AnswerItem-authorInfo">
        <meta itemprop="name" content="alternate-author" />
        <meta itemprop="url" content="https://www.zhihu.com/people/alternate-author" />
      </div>
      <div class="ContentItem-time">
        <a href="//www.zhihu.com/question/9/answer/10" data-tooltip="2026-03-02">2026-03-02</a>
      </div>
      <div class="RichText">
        <p>Alternate answer paragraph.</p>
        <p>Second alternate paragraph.</p>
      </div>
    </div>
  </body>
</html>`;

export const substackFixture = `<!doctype html>
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

export const substackPreloadOnlyFixture = `<!doctype html>
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

export const substackMultiAuthorFixture = `<!doctype html>
<html>
  <head>
    <title>Roundtable Dispatch - by Example Author and Guest Writer</title>
    <meta name="author" content="Example Author" />
    <meta property="og:title" content="Roundtable Dispatch" />
    <meta property="og:url" content="https://examplepublication.substack.com/p/roundtable-dispatch" />
    <link rel="canonical" href="https://examplepublication.substack.com/p/roundtable-dispatch" />
    <script type="application/ld+json">
      {
        "@context": "https://schema.org",
        "@type": "NewsArticle",
        "url": "https://examplepublication.substack.com/p/roundtable-dispatch",
        "mainEntityOfPage": "https://examplepublication.substack.com/p/roundtable-dispatch",
        "headline": "Roundtable Dispatch",
        "datePublished": "2026-06-11T14:00:00.000Z",
        "dateModified": "2026-06-11T15:30:00.000Z",
        "author": [
          {
            "@type": "Person",
            "name": "Example Author",
            "url": "https://substack.com/@exampleauthor"
          },
          {
            "@type": "Person",
            "name": "Guest Writer",
            "url": "https://substack.com/@guestwriter"
          }
        ]
      }
    </script>
  </head>
  <body>
    <article>
      <h1 class="post-title">Roundtable Dispatch</h1>
      <h3 class="subtitle">Notes from two desks.</h3>
      <div class="byline-wrapper">
        <a href="https://substack.com/@exampleauthor">Example Author</a>
        <span>&amp;</span>
        <a href="https://substack.com/@guestwriter">Guest Writer</a>
        <div class="meta-EgzBVA">Jun 11, 2026</div>
      </div>
      <div class="available-content">
        <div class="body markup">
          <p>Shared opening paragraph.</p>
          <p>Second perspective paragraph.</p>
        </div>
      </div>
    </article>
  </body>
</html>`;

export const substackCaptionHeavyFixture = `<!doctype html>
<html>
  <head>
    <title>Charts And Embeds - by Example Author</title>
    <meta name="author" content="Example Author" />
    <meta property="og:title" content="Charts And Embeds" />
    <meta property="og:url" content="https://examplepublication.substack.com/p/charts-and-embeds" />
    <link rel="canonical" href="https://examplepublication.substack.com/p/charts-and-embeds" />
    <script type="application/ld+json">
      {
        "@context": "https://schema.org",
        "@type": "NewsArticle",
        "url": "https://examplepublication.substack.com/p/charts-and-embeds",
        "mainEntityOfPage": "https://examplepublication.substack.com/p/charts-and-embeds",
        "headline": "Charts And Embeds",
        "description": "A walkthrough of the visual stack.",
        "datePublished": "2026-06-12T10:00:00.000Z",
        "dateModified": "2026-06-12T10:30:00.000Z",
        "author": {
          "@type": "Person",
          "name": "Example Author",
          "url": "https://substack.com/@exampleauthor"
        }
      }
    </script>
  </head>
  <body>
    <article>
      <h1 class="post-title">Charts And Embeds</h1>
      <h3 class="subtitle">A walkthrough of the visual stack.</h3>
      <div class="byline-wrapper">
        <a href="https://substack.com/@exampleauthor">Example Author</a>
        <div class="meta-EgzBVA">Jun 12, 2026</div>
      </div>
      <div class="available-content">
        <div class="body markup">
          <p>Lead paragraph before visuals.</p>
          <div class="captioned-image-container">
            <figure>
              <a href="https://cdn.example.com/full-chart.png">
                <img
                  src="https://cdn.example.com/chart-preview.png"
                  data-attrs="{&quot;src&quot;:&quot;https://cdn.example.com/chart-original.png&quot;}"
                  alt=""
                />
                <button class="image-link-expand">Expand</button>
              </a>
              <figcaption>Chart caption with useful context.</figcaption>
            </figure>
          </div>
          <blockquote>
            <p>Embedded quote that should stay readable.</p>
          </blockquote>
          <div class="paywall-jump">Skip to paid section</div>
        </div>
      </div>
    </article>
  </body>
</html>`;
