import { describe, it, expect } from "vitest";
import { Cl } from "@stacks/transactions";
import { initSimnet } from "@stacks/clarinet-sdk";

// TREASURY-VAULT fee destination. Exercises the real Clarity contract on a
// simnet: fail-closed intake, replay rejection, gated sweep authority, the
// 50/30/20 split, split validation, and emergency pause.

const VAULT = "protocol-fee-vault";
const print = (cv: unknown) => Cl.prettyPrint(cv as Parameters<typeof Cl.prettyPrint>[0]);

describe("protocol-fee-vault (Clarity simnet)", () => {
  it("fails closed before any principal is configured", async () => {
    const simnet = await initSimnet();
    const deployer = simnet.getAccounts().get("deployer")!;
    const r = simnet.callPublicFn(VAULT, "sweep-treasury", [], deployer);
    expect(print(r.result)).toBe("(err u101)"); // ERR_NOT_CONFIGURED
  });

  it("records an intake and rejects a replayed settlement id", async () => {
    const simnet = await initSimnet();
    const deployer = simnet.getAccounts().get("deployer")!;
    const args = [
      Cl.stringAscii("s-1"),
      Cl.uint(2000),
      Cl.stringAscii("LIGHTNING"),
      Cl.stringAscii("EXPEDIENT"),
    ];
    expect(print(simnet.callPublicFn(VAULT, "collect-protocol-fee", args, deployer).result)).toBe("(ok true)");
    expect(print(simnet.callPublicFn(VAULT, "collect-protocol-fee", args, deployer).result)).toBe("(err u100)");

    const acct = simnet.callReadOnlyFn(VAULT, "get-accounting", [], deployer);
    expect(print(acct.result)).toContain("collected-total-ustx: u2000");
    expect(print(acct.result)).toContain("swept-total-ustx: u0");
  });

  it("only the configured treasury principal may sweep, and splits 50/30/20", async () => {
    const simnet = await initSimnet();
    const a = simnet.getAccounts();
    const deployer = a.get("deployer")!;
    const treasury = a.get("wallet_1")!;
    const operations = a.get("wallet_2")!;
    const founders = a.get("wallet_3")!;
    const ecosystem = a.get("wallet_4")!;

    simnet.callPublicFn(VAULT, "set-treasury-principal", [Cl.principal(treasury)], deployer);
    simnet.callPublicFn(
      VAULT,
      "set-recipient-principals",
      [Cl.principal(operations), Cl.principal(founders), Cl.principal(ecosystem)],
      deployer,
    );
    simnet.transferSTX(10_000, `${deployer}.${VAULT}`, deployer);

    // The deployer is not the treasury principal: sweep is refused.
    expect(print(simnet.callPublicFn(VAULT, "sweep-treasury", [], deployer).result)).toBe("(err u100)");

    const swept = simnet.callPublicFn(VAULT, "sweep-treasury", [], treasury);
    expect(print(swept.result)).toBe(
      "(ok { ecosystem-amount: u2000, founders-amount: u3000, operations-amount: u5000, total-swept: u10000 })",
    );
  });

  it("rejects a split that does not sum to 10000 bps", async () => {
    const simnet = await initSimnet();
    const deployer = simnet.getAccounts().get("deployer")!;
    const r = simnet.callPublicFn(VAULT, "set-split", [Cl.uint(5000), Cl.uint(3000), Cl.uint(1000)], deployer);
    expect(print(r.result)).toBe("(err u103)"); // ERR_INVALID_SPLIT
  });

  it("requires 2-of-3 emergency-pause members to pause (single member cannot)", async () => {
    const simnet = await initSimnet();
    const a = simnet.getAccounts();
    const deployer = a.get("deployer")!;
    const treasury = a.get("wallet_1")!;
    const m1 = a.get("wallet_1")!;
    const m2 = a.get("wallet_2")!;
    const m3 = a.get("wallet_3")!;
    simnet.callPublicFn(VAULT, "set-treasury-principal", [Cl.principal(treasury)], deployer);
    simnet.callPublicFn(
      VAULT,
      "set-recipient-principals",
      [Cl.principal(a.get("wallet_2")!), Cl.principal(a.get("wallet_3")!), Cl.principal(a.get("wallet_4")!)],
      deployer,
    );
    simnet.callPublicFn(
      VAULT,
      "set-emergency-pause-members",
      [Cl.principal(m1), Cl.principal(m2), Cl.principal(m3)],
      deployer,
    );
    simnet.transferSTX(10_000, `${deployer}.${VAULT}`, deployer);

    // A non-member cannot pause at all.
    expect(print(simnet.callPublicFn(VAULT, "pause", [], deployer).result)).toBe("(err u107)"); // ERR_NOT_MEMBER

    // One member is not enough: the call succeeds but does not pause yet.
    expect(print(simnet.callPublicFn(VAULT, "pause", [], m1).result)).toBe("(ok false)");
    expect(print(simnet.callReadOnlyFn(VAULT, "get-emergency-pause", [], deployer).result))
      .toContain("paused: false");

    // A repeat approval from the same member is rejected.
    expect(print(simnet.callPublicFn(VAULT, "pause", [], m1).result)).toBe("(err u108)"); // ERR_ALREADY_APPROVED

    // The second distinct member pauses.
    expect(print(simnet.callPublicFn(VAULT, "pause", [], m2).result)).toBe("(ok true)");

    // Paused: both intake and sweep are blocked.
    expect(print(simnet.callPublicFn(VAULT, "sweep-treasury", [], treasury).result)).toBe("(err u104)");
    expect(
      print(
        simnet.callPublicFn(
          VAULT,
          "collect-protocol-fee",
          [Cl.stringAscii("s-9"), Cl.uint(1), Cl.stringAscii("LIGHTNING"), Cl.stringAscii("EXPEDIENT")],
          deployer,
        ).result,
      ),
    ).toBe("(err u104)");
  });

  it("rejects duplicate emergency-pause members and fails closed before members are set", async () => {
    const simnet = await initSimnet();
    const a = simnet.getAccounts();
    const deployer = a.get("deployer")!;
    const m1 = a.get("wallet_1")!;
    const m2 = a.get("wallet_2")!;

    // No members configured: pause is unavailable (fail closed).
    expect(print(simnet.callPublicFn(VAULT, "pause", [], m1).result)).toBe("(err u110)"); // ERR_NO_PAUSE_MEMBERS

    // Duplicate members are rejected.
    expect(
      print(
        simnet.callPublicFn(
          VAULT,
          "set-emergency-pause-members",
          [Cl.principal(m1), Cl.principal(m1), Cl.principal(m2)],
          deployer,
        ).result,
      ),
    ).toBe("(err u109)"); // ERR_DUPLICATE_MEMBER
  });
});
