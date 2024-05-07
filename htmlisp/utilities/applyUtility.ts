import { isObject } from "../../utilities/functional.ts";
import type { Context, Utilities, Utility } from "../../types.ts";

// TODO: Move to a module of its own
async function applyUtilities<
  U extends Utility,
  US extends Utilities,
  C extends Context,
>(
  props: Record<string, U> | null,
  utilities: US,
  context: C,
): Promise<Record<string, unknown>> {
  if (!props) {
    return {};
  }

  // TODO: Apply this recursively
  return Object.fromEntries(
    await Promise.all(
      Object.entries(props).map(async (
        [k, v],
      ) => [
        k,
        typeof v === "string" ? v : await applyUtility<U, US, C>(
          v,
          utilities,
          context,
        ),
      ]),
    ),
  );
}

async function applyUtility<
  U extends Utility,
  US extends Utilities,
  C extends Context,
>(
  value: U,
  utilities: US,
  context: C,
  // deno-lint-ignore no-explicit-any
): Promise<any> {
  if (!utilities) {
    throw new Error("applyUtility - No utilities were provided");
  }

  if (!value) {
    return;
  }

  if (typeof value.utility !== "string") {
    if (isObject(value)) {
      return Object.fromEntries(
        await Promise.all(
          Object.entries(value).map(async (
            [k, v],
          ) => [
            k,
            await applyUtility(
              // @ts-expect-error This is fine
              v,
              utilities,
              context,
            ),
          ]),
        ),
      );
    }

    return value;
  }

  const foundUtility = utilities[value.utility];

  if (!foundUtility) {
    console.error({ utilities, value });
    throw new Error("applyUtility - Matching utility was not found");
  }

  const parameters = await Promise.all(
    Array.isArray(value.parameters)
      ? value.parameters.map((p) => {
        if (typeof p === "string") {
          // Nothing to do
        } else if (p.utility && p.parameters) {
          return applyUtility(p, utilities, context);
        }

        return p;
      })
      : [],
  );

  try {
    // @ts-expect-error This is fine for now.
    // TODO: Figure out a nice way to resolve context mismatch
    return foundUtility.apply(context, parameters);
  } catch (_error) {
    console.error("Failed to apply", foundUtility, parameters);
  }
}

export { applyUtilities, applyUtility };
