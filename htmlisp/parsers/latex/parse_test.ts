import { assertEquals } from "https://deno.land/std@0.142.0/testing/asserts.ts";
import { blocks, contents, doubles, singles } from "./defaultExpressions.ts";
import { parse } from "./parse.ts";

Deno.test(`id expression`, () => {
  const input = "foobar";

  assertEquals(
    parse(input, {}),
    [{ type: "p", attributes: {}, children: [input] }],
  );
});

Deno.test(`multiple paragraphs`, () => {
  const input = `foobar

\nbarfoo`;

  assertEquals(
    parse(input, {}),
    [
      { type: "p", attributes: {}, children: ["foobar"] },
      { type: "p", attributes: {}, children: ["\nbarfoo"] },
    ],
  );
});

Deno.test(`bold`, () => {
  const input = String.raw`\textbf{foobar}`;

  assertEquals(
    parse(input, { singles }),
    [{ type: "b", attributes: {}, children: ["foobar"] }],
  );
});

Deno.test(`url`, () => {
  const input = String.raw`\url{https://google.com}`;

  assertEquals(
    parse(input, { singles }),
    [{
      type: "a",
      attributes: { href: "https://google.com" },
      children: ["https://google.com"],
    }],
  );
});

Deno.test(`multiple urls`, () => {
  const input = String.raw`\url{https://google.com}
\url{https://bing.com}`;

  assertEquals(
    parse(input, { singles }),
    [{
      type: "a",
      attributes: { href: "https://google.com" },
      children: ["https://google.com"],
    }, {
      type: "a",
      attributes: { href: "https://bing.com" },
      children: ["https://bing.com"],
    }],
  );
});

Deno.test(`paragraph and url`, () => {
  const input = String.raw`foobar

\url{https://bing.com}`;

  assertEquals(
    parse(input, { singles }),
    [{
      type: "p",
      attributes: {},
      children: ["foobar"],
    }, {
      type: "a",
      attributes: { href: "https://bing.com" },
      children: ["https://bing.com"],
    }],
  );
});

Deno.test(`url and paragraph`, () => {
  const input = String.raw`\url{https://bing.com}

foobar`;

  assertEquals(
    parse(input, { singles }),
    [{
      type: "a",
      attributes: { href: "https://bing.com" },
      children: ["https://bing.com"],
    }, {
      type: "p",
      attributes: {},
      children: ["\nfoobar"],
    }],
  );
});

Deno.test(`url within paragraph`, () => {
  const input = String.raw`foobar \url{https://bing.com} foobar`;

  assertEquals(
    parse(input, { singles }),
    [{
      type: "p",
      attributes: {},
      children: ["foobar ", {
        type: "a",
        attributes: { href: "https://bing.com" },
        children: ["https://bing.com"],
      }, " foobar"],
    }],
  );
});

// TODO: Test other singles - these tests could be even generated from the definition

Deno.test(`href`, () => {
  const input = String.raw`\href{https://google.com}{Google}`;

  assertEquals(
    parse(input, { doubles }),
    [{
      type: "a",
      attributes: { href: "https://google.com" },
      children: ["Google"],
    }],
  );
});

Deno.test(`verbatim`, () => {
  const input = String.raw`\begin{verbatim}
test
\end{verbatim}`;

  assertEquals(
    parse(input, { blocks }),
    [{
      type: "pre",
      attributes: {},
      children: ["\ntest\n"],
    }],
  );
});

Deno.test(`enumerate`, () => {
  const input = String.raw`\begin{enumerate}
\item test
\end{enumerate}`;

  assertEquals(
    parse(input, { blocks }),
    [{
      type: "ol",
      attributes: {},
      children: [{ type: "li", attributes: {}, children: ["test"] }],
    }],
  );
});

Deno.test(`itemize`, () => {
  const input = String.raw`\begin{itemize}
\item test
\end{itemize}`;

  assertEquals(
    parse(input, { blocks }),
    [{
      type: "ul",
      attributes: {},
      children: [{ type: "li", attributes: {}, children: ["test"] }],
    }],
  );
});

Deno.test(`description`, () => {
  const input = String.raw`\begin{description}
\item[foo] bar
\end{description}`;

  assertEquals(
    parse(input, { blocks }),
    [{
      type: "dl",
      attributes: {},
      children: [
        { type: "dt", attributes: {}, children: ["foo"] },
        { type: "dd", attributes: {}, children: ["bar"] },
      ],
    }],
  );
});

// TODO: Define in a more accurate manner
Deno.test(`cite`, () => {
  const input = String.raw`Foobar \cite{test24}`;

  assertEquals(
    parse(input, { contents }),
    [{
      type: "a",
      attributes: { href: "https://google.com" },
      children: ["Google"],
    }],
  );
});

// TODO: Test ~ - it should be replaced with a whitespace
