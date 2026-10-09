# Indie AI Agent Quickstart

Zero-friction integration snippets for indie AI agent builders (ElizaOS, LangGraph,
AutoGen, CrewAI) on the Conxian Managed SaaS Gateway (`https://api.conxian-labs.com/v1/agent`).

## Quickstart (3 steps)

```bash
npm install                      # resolves @conxian/market-sdk (file:.. -> local build)
npm run build --prefix ..        # build the SDK dist/ if not already built
npm run quickstart               # runs indie-agent-quickstart.ts end-to-end
```

The snippet performs:

1. **Initialize** `ConxianMarketSDK` against the managed subscriber endpoint.
2. **Issue** an x402 (HTTP 402) payment demand via `createX402Demand`.
3. **Lock** an ERC-8183 job-card escrow and verify TEE/Nitro hardware proofs via
   `processX402PaymentAndLockEscrowWithAttestation`.

## Copy into your own project

```bash
npm install @conxian/market-sdk@^0.2.4
```

Then copy `indie-agent-quickstart.ts` and swap the `apiToken` for your managed
subscriber API key (issued during onboarding via `pnpm conxian-agent-init`).
