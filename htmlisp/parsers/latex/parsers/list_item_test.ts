import { assertEquals } from "https://deno.land/std@0.142.0/testing/asserts.ts";
import { parseListItem } from "./list_item.ts";
import { characterGenerator } from "../../characterGenerator.ts";

Deno.test(`simple expression`, () => {
  const input = String.raw`\item foobar`;

  assertEquals(
    parseListItem(
      characterGenerator(input),
    ),
    "foobar",
  );
});
