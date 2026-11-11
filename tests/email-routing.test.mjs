import assert from "node:assert/strict";
import test from "node:test";
import { summarizeEmailRoutingRows } from "../web/usage.js";

test("routing statuses distinguish forwarded, handled, dropped, and failed events", () => {
  assert.deepEqual(summarizeEmailRoutingRows([
    { count: 3, dimensions: { action: "forward", status: "delivered" } },
    { count: 2, dimensions: { action: "worker", status: "handled" } },
    { count: 1, dimensions: { action: "drop", status: "dropped" } },
    { count: 4, dimensions: { action: "forward", status: "deliveryFailed" } },
    { count: 2, dimensions: { action: "reject", status: "rejected" } },
    { count: 1, dimensions: { action: "forward", status: "pending" } }
  ]), { events: 13, forwarded: 3, handled: 2, dropped: 1, failures: 6 });
});

test("invalid counters cannot silently become zero", () => {
  assert.throws(() => summarizeEmailRoutingRows([{ count: "nan", dimensions: {} }]), /Invalid/);
});
