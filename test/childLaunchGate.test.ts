import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import test from "node:test";
import { CHILD_LAUNCH_CHANNEL, gateChildLaunch } from "../src/child-launch-gate.js";

const info = { agentType: "explore", backend: "herdr", compare: false };

function busWith(
  handler?: (payload: { gate(p: Promise<unknown>): void }) => void,
) {
  const emitter = new EventEmitter();
  if (handler) emitter.on(CHILD_LAUNCH_CHANNEL, handler);
  return { emit: (channel: string, data: unknown) => emitter.emit(channel, data) };
}

test("no listener leaves the launch unchanged", async () => {
  assert.deepEqual(await gateChildLaunch(busWith(), info), {
    ok: true,
    env: {},
    dropModelArgs: false,
  });
});

test("a listener adds environment and may drop model args", async () => {
  const bus = busWith((payload) =>
    payload.gate(Promise.resolve({ env: { PI_STUDIO_TICKET: "t" }, dropModelArgs: true })),
  );
  assert.deepEqual(await gateChildLaunch(bus, info), {
    ok: true,
    env: { PI_STUDIO_TICKET: "t" },
    dropModelArgs: true,
  });
});

test("a rejection refuses the launch with its message", async () => {
  const bus = busWith((payload) => payload.gate(Promise.reject(new Error("scout is at its limit"))));
  assert.deepEqual(await gateChildLaunch(bus, info), { ok: false, reason: "scout is at its limit" });
});
