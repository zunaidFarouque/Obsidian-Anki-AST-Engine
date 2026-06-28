import { describe, expect, test } from "bun:test";
import { normalizeCodeBlockLineEndings } from "../../src/anki/htmlNormalize";

describe("normalizeCodeBlockLineEndings", () => {
  test("converts CRLF to LF inside pre/code blocks only", () => {
    const html =
      '<p>intro</p>\n<pre><code class="language-python">line one\r\nline two</code></pre>\n<p>outro</p>';

    expect(normalizeCodeBlockLineEndings(html)).toBe(
      '<p>intro</p>\n<pre><code class="language-python">line one\nline two</code></pre>\n<p>outro</p>',
    );
  });

  test("normalizes multiple code blocks independently", () => {
    const html =
      "<pre><code>a\r\nb</code></pre><pre><code class=\"language-js\">c\rd</code></pre>";

    expect(normalizeCodeBlockLineEndings(html)).toBe(
      "<pre><code>a\nb</code></pre><pre><code class=\"language-js\">c\nd</code></pre>",
    );
  });

  test("leaves HTML outside code blocks unchanged", () => {
    const html = "<p>Line one<br>\r\nLine two</p>";

    expect(normalizeCodeBlockLineEndings(html)).toBe(html);
  });
});
