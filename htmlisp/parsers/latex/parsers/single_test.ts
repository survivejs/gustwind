import { assertEquals } from "https://deno.land/std@0.142.0/testing/asserts.ts";
import { parseSingle } from "./single.ts";
import { characterGenerator } from "../../characterGenerator.ts";

Deno.test(`simple expression`, () => {
  const input = "foobar";

  assertEquals(
    parseSingle(
      characterGenerator(String.raw`\id{${input}}`),
      { id: (i) => ({ type: "div", attributes: {}, children: [i] }) },
    ),
    { type: "div", attributes: {}, children: [input] },
  );
});

// TODO: Test that the logic throws in case a matching expression was not found
// TODO: Test that the logic throws in case an expression is incomplete