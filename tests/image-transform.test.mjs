import { test } from "node:test";
import assert from "node:assert/strict";
import { constrainImage } from "../lib/image-transform.ts";

test("phone image viewer stays fitted at 100% and cannot pan into blank space", () => {
  const image = { width: 300, height: 200 };
  const phone = { width: 393, height: 700 };
  assert.deepEqual(
    constrainImage({ scale: 0.5, x: 900, y: 900 }, image, phone),
    { scale: 1, x: 0, y: 0 },
  );
  assert.deepEqual(constrainImage({ scale: 2, x: 900, y: 900 }, image, phone), {
    scale: 2,
    x: 103.5,
    y: 0,
  });
  assert.deepEqual(
    constrainImage({ scale: 10, x: 10000, y: -10000 }, image, phone),
    { scale: 5, x: 553.5, y: -150 },
  );
  assert.deepEqual(constrainImage({ scale: 1, x: 20, y: -20 }, image, phone), {
    scale: 1,
    x: 0,
    y: 0,
  });
});
