import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createDrawQueue } from "@/lib/drawQueue";

let frames: (() => void)[] = [];
let now = 0;

/** Run the frame that is requested at the moment. */
function nextFrame() {
  const callbacks = frames;
  frames = [];
  for (const callback of callbacks) callback();
}

beforeEach(() => {
  frames = [];
  now = 0;
  vi.stubGlobal("requestAnimationFrame", (callback: () => void) => frames.push(callback));
  vi.spyOn(performance, "now").mockImplementation(() => now);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("createDrawQueue", () => {
  const A = { id: "a" };
  const B = { id: "b" };
  const C = { id: "c" };

  /** A draw that takes `ms` and writes its name to the log. */
  function draw(log: string[], name: string, ms: number) {
    return () => {
      log.push(name);
      now += ms;
    };
  }

  it("draws nothing before the next frame", () => {
    const log: string[] = [];
    createDrawQueue().request(A, draw(log, "a", 20));
    expect(log).toEqual([]);
    nextFrame();
    expect(log).toEqual(["a"]);
  });

  it("spreads slow draws over frames, one in each", () => {
    const log: string[] = [];
    const queue = createDrawQueue();
    queue.request(A, draw(log, "a", 20));
    queue.request(B, draw(log, "b", 20));
    nextFrame();
    expect(log).toEqual(["a"]);
    nextFrame();
    expect(log).toEqual(["a", "b"]);
    expect(frames).toHaveLength(0); // empty queue: no more frames
  });

  it("does several fast draws in one frame", () => {
    const log: string[] = [];
    const queue = createDrawQueue();
    queue.request(A, draw(log, "a", 5));
    queue.request(B, draw(log, "b", 5));
    queue.request(C, draw(log, "c", 5));
    nextFrame();
    expect(log).toEqual(["a", "b"]);
  });

  it("draws only the newest request of an owner", () => {
    const log: string[] = [];
    const queue = createDrawQueue();
    queue.request(A, draw(log, "old", 20));
    queue.request(A, draw(log, "new", 20));
    nextFrame();
    nextFrame();
    expect(log).toEqual(["new"]);
  });

  it("gives every owner its turn when all request again in every frame", () => {
    const log: string[] = [];
    const queue = createDrawQueue();
    for (let i = 0; i < 6; i++) {
      queue.request(A, draw(log, "a", 20));
      queue.request(B, draw(log, "b", 20));
      queue.request(C, draw(log, "c", 20));
      nextFrame();
    }
    expect(log).toEqual(["a", "b", "c", "a", "b", "c"]);
  });

  it("does not draw what was cancelled", () => {
    const log: string[] = [];
    const queue = createDrawQueue();
    queue.request(A, draw(log, "a", 20));
    queue.cancel(A);
    nextFrame();
    expect(log).toEqual([]);
  });

  it("goes on after a draw that throws", () => {
    const log: string[] = [];
    const queue = createDrawQueue();
    queue.request(A, () => {
      throw new Error("broken plot");
    });
    queue.request(B, draw(log, "b", 20));
    expect(nextFrame).toThrow("broken plot");
    nextFrame();
    expect(log).toEqual(["b"]);
  });
});
