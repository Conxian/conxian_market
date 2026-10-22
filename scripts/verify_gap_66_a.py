#!/usr/bin/env python3
"""
Local conformance checks for the historical GAP-02 / CAN-66-A candidate.

Unit tests exercise local facade and SDK behavior. They do not establish
payment verification, hardware identity, locked funds or release acceptance.
"""

import sys
import subprocess

def main():
    print("=== Conxian Session 66: Verification Script (GAP-02 / CAN-66-A) ===")
    print("[1/3] Running Vitest suite for x402 facade and SDK bridge...")

    # Run npm test using Vitest
    res = subprocess.run(["npx", "vitest", "run", "tests/x402_facade.test.ts", "tests/sdk_bridge.test.ts"], capture_output=True, text=True)

    if res.returncode != 0:
        print(f"❌ Verification Failed: Unit tests failed.\n{res.stderr}\n{res.stdout}")
        sys.exit(1)

    print(res.stdout)
    print("✅ [2/3] Unit tests passed with 100% success.")
    print("✅ [3/3] Local facade and SDK conformance checked.")
    print("\nRESULT: LOCAL CONFORMANCE PASSED. Payment, provider, escrow and release acceptance remain separate evidence gates.")
    sys.exit(0)

if __name__ == "__main__":
    main()
