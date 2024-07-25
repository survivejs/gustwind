import type { CharacterGenerator } from "../../types.ts";
import type { Expression } from "./../expressions.ts";
import type { Element } from "../../../types.ts";

const LIMIT = 100000;

// Parses content until \ or \n\n or until string to parse ends
function getParseContent(expression: Expression) {
  return function parseContent(
    getCharacter: CharacterGenerator,
  ): string | Element {
    let stringBuffer = "";

    for (let i = 0; i < LIMIT; i++) {
      const c = getCharacter.next();

      if (c === null) {
        break;
      }

      const hasDoubleNewline = c === "\n" && getCharacter.get() === "\n";

      if (c === "\\" || hasDoubleNewline) {
        !hasDoubleNewline && getCharacter.previous();

        return expression(stringBuffer);
      } else {
        stringBuffer += c;
      }
    }

    return expression(stringBuffer);
  };
}

export { getParseContent };
