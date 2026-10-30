/**
 * Launch gate: before a Pi child starts, other extensions on the same event
 * bus may refuse the launch or add to the child's environment. With no
 * listener nothing changes.
 *
 * Contract (bus channel `pi-task:child-launch`): the payload carries
 * `gate(promise)`. A listener calls it synchronously (the bus does not wait
 * for handlers) with a promise of `{ env?, dropModelArgs? }`. A rejection
 * refuses the launch and its message becomes the task result.
 */
export const CHILD_LAUNCH_CHANNEL = "pi-task:child-launch";

export interface ChildLaunchInfo {
  agentType: string;
  backend: string;
  compare: boolean;
}

export interface ChildLaunchGrant {
  /** Added to the child's environment; pi-task's own variables win. */
  env?: Record<string, string>;
  /** Launch the child without the agent's frontmatter --model/--thinking. */
  dropModelArgs?: boolean;
}

export interface ChildLaunchBus {
  emit(channel: string, data: unknown): void;
}

export type ChildLaunchGateResult =
  | { ok: true; env: Record<string, string>; dropModelArgs: boolean }
  | { ok: false; reason: string };

export async function gateChildLaunch(
  bus: ChildLaunchBus,
  info: ChildLaunchInfo,
): Promise<ChildLaunchGateResult> {
  const pending: Promise<ChildLaunchGrant | void>[] = [];
  bus.emit(CHILD_LAUNCH_CHANNEL, {
    ...info,
    gate: (promise: Promise<ChildLaunchGrant | void>) => {
      pending.push(promise);
    },
  });
  if (pending.length === 0) return { ok: true, env: {}, dropModelArgs: false };
  const settled = await Promise.allSettled(pending);
  const env: Record<string, string> = {};
  let dropModelArgs = false;
  for (const outcome of settled) {
    if (outcome.status === "rejected") {
      const reason = outcome.reason instanceof Error
        ? outcome.reason.message
        : String(outcome.reason);
      return { ok: false, reason };
    }
    Object.assign(env, outcome.value?.env);
    dropModelArgs ||= outcome.value?.dropModelArgs === true;
  }
  return { ok: true, env, dropModelArgs };
}
