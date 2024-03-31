function getMemo<I, R>(
  cache: {
    get: (key: I) => R;
    set: (key: I, value: R) => void;
  },
) {
  // This supports only a single argument for now
  return function run(fn: (input: I) => R, input: I) {
    const cachedValue = cache.get(input);

    if (cachedValue) {
      return cachedValue;
    }

    const result = fn(input);

    cache.set(input, result);

    return result;
  };
}

export { getMemo };
