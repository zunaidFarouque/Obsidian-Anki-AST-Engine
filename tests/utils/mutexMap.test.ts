import { describe, expect, test } from "bun:test";
import { getMutex, runExclusive } from "../../src/utils/mutexMap";

describe("mutexMap", () => {
  test("serializes concurrent operations on the same path", async () => {
    const order: number[] = [];

    await Promise.all([
      runExclusive("/same/path", async () => {
        order.push(1);
        await Bun.sleep(20);
        order.push(2);
      }),
      runExclusive("/same/path", async () => {
        order.push(3);
        await Bun.sleep(5);
        order.push(4);
      }),
    ]);

    expect(order).toEqual([1, 2, 3, 4]);
  });

  test("allows parallel operations on different paths", async () => {
    const order: string[] = [];

    await Promise.all([
      runExclusive("/path/a", async () => {
        order.push("a-start");
        await Bun.sleep(30);
        order.push("a-end");
      }),
      runExclusive("/path/b", async () => {
        order.push("b-start");
        await Bun.sleep(5);
        order.push("b-end");
      }),
    ]);

    expect(order.indexOf("b-end")).toBeLessThan(order.indexOf("a-end"));
  });

  test("returns the same mutex instance for the same path", () => {
    expect(getMutex("/foo")).toBe(getMutex("/foo"));
    expect(getMutex("/foo")).not.toBe(getMutex("/bar"));
  });
});
