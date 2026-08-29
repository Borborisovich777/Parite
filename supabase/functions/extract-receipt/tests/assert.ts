export function assert(condition: unknown, message = 'assertion failed'): asserts condition {
  if (!condition) throw new Error(message);
}

export function assertEquals<T>(actual: T, expected: T, message = 'values are not equal'): void {
  if (!deepEqual(actual, expected)) {
    throw new Error(`${message}: expected ${JSON.stringify(expected)}, received ${JSON.stringify(actual)}`);
  }
}

export async function assertRejects(
  action: () => Promise<unknown>,
  predicate: (error: unknown) => boolean,
): Promise<void> {
  try {
    await action();
  } catch (error) {
    if (!predicate(error)) throw new Error('promise rejected with the wrong error');
    return;
  }
  throw new Error('promise did not reject');
}

function deepEqual(left: unknown, right: unknown): boolean {
  if (Object.is(left, right)) return true;
  if (typeof left !== typeof right || left === null || right === null) return false;
  if (Array.isArray(left) && Array.isArray(right)) {
    return left.length === right.length && left.every((value, index) => deepEqual(value, right[index]));
  }
  if (
    typeof left === 'object' && typeof right === 'object' && !Array.isArray(left) && !Array.isArray(right)
  ) {
    const leftRecord = left as Record<string, unknown>;
    const rightRecord = right as Record<string, unknown>;
    const leftKeys = Object.keys(leftRecord);
    const rightKeys = Object.keys(rightRecord);
    return leftKeys.length === rightKeys.length &&
      leftKeys.every((key) =>
        Object.hasOwn(rightRecord, key) && deepEqual(leftRecord[key], rightRecord[key])
      );
  }
  return false;
}
