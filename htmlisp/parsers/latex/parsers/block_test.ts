import { assertEquals } from "https://deno.land/std@0.142.0/testing/asserts.ts";
import { getParseBlock } from "./block.ts";
import { getParseContent } from "./content.ts";
import { parseDefinitionItem } from "./definition_item.ts";
import { parseListItem } from "./list_item.ts";
import { characterGenerator } from "../../characterGenerator.ts";
import type { Element } from "../../../types.ts";

Deno.test(`simple expression`, () => {
  const name = "verbatim";
  const input = "foobar";

  assertEquals(
    getParseBlock<Element, string>(
      {
        [name]: {
          container: (children) => ({
            type: "div",
            attributes: {},
            children,
          }),
          item: getParseContent((s) => s.join("")),
        },
      },
    )(
      characterGenerator(String.raw`\begin{${name}}${input}\end{${name}}`),
    ),
    { type: "div", attributes: {}, children: [input] },
  );
});

Deno.test(`simple list`, () => {
  const name = "itemize";

  assertEquals(
    getParseBlock<Element, string>(
      {
        [name]: {
          container: (children) => ({
            type: "div",
            attributes: {},
            children,
          }),
          item: parseListItem,
        },
      },
    )(
      characterGenerator(String.raw`\begin{${name}}
        \item Foo
        \item Bar
\end{${name}}`),
    ),
    { type: "div", attributes: {}, children: ["Foo", "Bar"] },
  );
});

Deno.test(`simple definition list`, () => {
  const name = "itemize";

  assertEquals(
    getParseBlock<Element, ReturnType<typeof parseDefinitionItem>>(
      {
        [name]: {
          container: (children) => ({
            type: "div",
            attributes: {},
            children: children
              .map(({ title, description }) => `${title}: ${description}`),
          }),
          item: parseDefinitionItem,
        },
      },
    )(
      characterGenerator(String.raw`\begin{${name}}
        \item[Foo] foo
        \item[Bar] bar
\end{${name}}`),
    ),
    { type: "div", attributes: {}, children: ["Foo: foo", "Bar: bar"] },
  );
});

Deno.test(`empty table`, () => {
  assertEquals(
    getParseBlock<Element, ReturnType<typeof parseDefinitionItem>>(
      {
        table: {
          container: () => ({
            type: "table",
            attributes: {},
            children: [],
          }),
        },
      },
    )(
      characterGenerator(String.raw`\begin{table}\end{table}`),
    ),
    {
      type: "table",
      attributes: {},
      children: [],
    },
  );
});

// TODO: Handle recursion here at definition level since it should find a block inside a block + handle metadata
Deno.test(`complete table`, () => {
  assertEquals(
    getParseBlock<Element, ReturnType<typeof parseDefinitionItem>>(
      {
        table: {
          container: (children) => ({
            type: "table",
            attributes: {},
            // TODO: Expand this definition
            children: children
              .map(({ title, description }) => `${title}: ${description}`),
          }),
        },
      },
    )(
      characterGenerator(String.raw`\begin{table}
  \begin{tabular}{l|p{4.0cm}|p{5.0cm}}
    Chapter & Purpose & Writing approach \\
    \hline
    Foo & Bar & Baz \\
  \end{tabular}
  \caption{Chapter types}
  \label{table:imrad}
\end{table}`),
    ),
    {
      type: "table",
      attributes: {
        id: "table:imrad",
      },
      children: [{
        type: "caption",
        attributes: {},
        children: ["Chapter types"],
      }, {
        type: "tr",
        attributes: {},
        children: [
          { type: "th", attributes: {}, children: ["Chapter"] },
          { type: "th", attributes: {}, children: ["Purpose"] },
          { type: "th", attributes: {}, children: ["Writing approach"] },
        ],
      }, {
        type: "tr",
        attributes: {},
        children: [
          { type: "td", attributes: {}, children: ["Foo"] },
          { type: "td", attributes: {}, children: ["Bar"] },
          { type: "td", attributes: {}, children: ["Baz"] },
        ],
      }],
    },
  );
});

// TODO: Assert that begin/end block names are the same - if not, throw
// TODO: Test that the logic throws in case a matching expression was not found
// TODO: Test that the logic throws in case an expression is incomplete
