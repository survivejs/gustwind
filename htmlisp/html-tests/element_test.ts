import { assertEquals } from "https://deno.land/std@0.142.0/testing/asserts.ts";
import { htmlispToHTML } from "../mod.ts";

Deno.test("basic element", async () => {
  assertEquals(
    await htmlispToHTML({ htmlInput: `<div>foo</div>` }),
    `<div>foo</div>`,
  );
});

Deno.test("basic element with a newline", async () => {
  assertEquals(
    await htmlispToHTML({
      htmlInput: `<div
    >foo</div>`,
    }),
    `<div>foo</div>`,
  );
});

Deno.test("basic element with a single child", async () => {
  assertEquals(
    await htmlispToHTML({
      htmlInput: `<div
    ><span>foo</span></div>`,
    }),
    `<div><span>foo</span></div>`,
  );
});

Deno.test("basic element with nested children", async () => {
  assertEquals(
    await htmlispToHTML({
      htmlInput: `<div
    ><div><span>foo</span></div></div>`,
    }),
    `<div><div><span>foo</span></div></div>`,
  );
});

Deno.test("basic element with siblings as children", async () => {
  assertEquals(
    await htmlispToHTML({
      htmlInput:
        `<div title="demo"><span>foobar</span><span>barfoo</span></div>`,
    }),
    `<div title="demo"><span>foobar</span><span>barfoo</span></div>`,
  );
});

Deno.test("basic element with siblings as children 2", async () => {
  assertEquals(
    await htmlispToHTML({
      htmlInput: `<div
      title="demo"
    >
      <span>foobar</span>
      <span>barfoo</span>
</div>`,
    }),
    `<div title="demo"><span>foobar</span><span>barfoo</span></div>`,
  );
});

Deno.test("basic element with siblings as children 3", async () => {
  assertEquals(
    await htmlispToHTML({
      htmlInput: `<div
      title="demo"
    >
      <span title="demo">foobar</span>
      <span>barfoo</span>
</div>`,
    }),
    `<div title="demo"><span title="demo">foobar</span><span>barfoo</span></div>`,
  );
});

Deno.test("basic element with a child with a title", async () => {
  assertEquals(
    await htmlispToHTML({
      htmlInput: `<div title="demo"><span title="demo">foobar</span></div>`,
    }),
    `<div title="demo"><span title="demo">foobar</span></div>`,
  );
});

Deno.test("basic element with newlines and nesting", async () => {
  assertEquals(
    await htmlispToHTML({
      htmlInput: `<div
      title="demo"
    >
      <span>foobar</span>
      <a
        href="#foo"
        >🔗</a
      >
</div>`,
    }),
    `<div title="demo"><span>foobar</span><a href="#foo">🔗</a></div>`,
  );
});

Deno.test("basic element with a newline and an attribute", async () => {
  assertEquals(
    await htmlispToHTML({
      htmlInput: `<div
    title="foobar">foo</div>`,
    }),
    `<div title="foobar">foo</div>`,
  );
});

Deno.test("nested element", async () => {
  assertEquals(
    await htmlispToHTML({ htmlInput: `<div><span>foo</span></div>` }),
    `<div><span>foo</span></div>`,
  );
});

Deno.test("element with an attribute", async () => {
  assertEquals(
    await htmlispToHTML({ htmlInput: `<div title="bar">foo</div>` }),
    `<div title="bar">foo</div>`,
  );
});

Deno.test("element with a self-closing attribute", async () => {
  assertEquals(
    await htmlispToHTML({ htmlInput: `<div demo title="bar">foo</div>` }),
    `<div demo title="bar">foo</div>`,
  );
});

Deno.test("element with a self-closing attribute at the end", async () => {
  assertEquals(
    await htmlispToHTML({ htmlInput: `<div title="bar" demo>foo</div>` }),
    `<div title="bar" demo>foo</div>`,
  );
});

Deno.test("self-closing element with an attribute", async () => {
  assertEquals(
    await htmlispToHTML({ htmlInput: `<div title="bar" />` }),
    `<div title="bar"/>`,
  );
});

Deno.test("self-closing element with a self-closing attribute", async () => {
  assertEquals(
    await htmlispToHTML({ htmlInput: `<div demo title="bar" />` }),
    `<div demo title="bar" />`,
  );
});

Deno.test("self-closing element with a self-closing attribute at the end", async () => {
  assertEquals(
    await htmlispToHTML({ htmlInput: `<div title="bar" demo />` }),
    `<div title="bar" demo/>`,
  );
});

Deno.test("element with multiple attributes", async () => {
  assertEquals(
    await htmlispToHTML({ htmlInput: `<div title="bar" alt="foo">foo</div>` }),
    `<div title="bar" alt="foo">foo</div>`,
  );
});

Deno.test("element with a class", async () => {
  assertEquals(
    await htmlispToHTML({ htmlInput: `<div class="bar">foo</div>` }),
    `<div class="bar">foo</div>`,
  );
});

// TODO: Test flag style attributes that don't have values, only keys
