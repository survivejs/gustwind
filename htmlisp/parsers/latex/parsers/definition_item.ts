import type { CharacterGenerator } from "../../types.ts";

enum STATES {
  IDLE,
  PARSE_ITEM,
  PARSE_TITLE,
  PARSE_DESCRIPTION_WHITESPACE,
  PARSE_DESCRIPTION,
}

const LIMIT = 100000;

// Parses the content within \item[<key>] <value>
function parseDefinitionItem(
  getCharacter: CharacterGenerator,
): { title: string; description: string } {
  let state = STATES.IDLE;
  let stringBuffer = "";
  let title = "";
  let description = "";

  for (let i = 0; i < LIMIT; i++) {
    const c = getCharacter.next();

    if (c === null) {
      return { title, description };
    }

    if (state === STATES.IDLE) {
      if (c === "\\") {
        state = STATES.PARSE_ITEM;
      } else {
        stringBuffer += c;
      }
    } else if (state === STATES.PARSE_ITEM) {
      if (c === "[") {
        state = STATES.PARSE_TITLE;
      } else {
        stringBuffer += c;
      }
    } else if (state === STATES.PARSE_TITLE) {
      if (c === "]") {
        state = STATES.PARSE_DESCRIPTION_WHITESPACE;
      } else {
        title += c;
      }
    } else if (state === STATES.PARSE_DESCRIPTION_WHITESPACE) {
      if (c !== " ") {
        getCharacter.previous();

        state = STATES.PARSE_DESCRIPTION;
      }
    } else if (state === STATES.PARSE_DESCRIPTION) {
      if (c === "\n") {
        return { title, description };
      }

      description += c;
    }
  }

  throw new Error("No matching expression was found");
}

export { parseDefinitionItem };