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

  it("pause blocks both intake and sweep", async () => {
    const simnet = await initSimnet();
    const a = simnet.getAccounts();
    const deployer = a.get("deployer")!;
    const treasury = a.get("wallet_1")!;
    simnet.callPublicFn(VAULT, "set-treasury-principal", [Cl.principal(treasury)], deployer);
    simnet.callPublicFn(
      VAULT,
      "set-recipient-principals",
      [Cl.principal(a.get("wallet_2")!), Cl.principal(a.get("wallet_3")!), Cl.principal(a.get("wallet_4")!)],
      deployer,
    );
    simnet.transferSTX(10_000, `${deployer}.${VAULT}`, deployer);
    simnet.callPublicFn(VAULT, "pause", [], deployer);

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
});
