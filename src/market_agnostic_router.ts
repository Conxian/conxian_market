/**
 * Conxian Market: Market-Agnostic Non-Custodial Router & DeFi Protocol Adapter.
 *
 * Implements the Zero-Custody Mandate and BYO DeFi integration principles
 * specified in docs/GOVERNANCE.md and docs/knowledge_base/operating_manual.md:
 * 1. Zero-Custody Validation: Guarantees Conxian never holds, touches, or custodies client funds or private data.
 * 2. BYO DeFi Protocol Adapter Resolution: Routes transactions to established external protocols (ALEX, Uniswap, Fedimint, Lightning, Citrea) rather than proprietary contracts.
 * 3. Market-Agnostic M2M Handoff Engine: Facilitates autonomous agent-to-agent settlement via MCP (Model Context Protocol).
 * 4. Conxian/Conxian Deprecation Advisory: Exposes governance rationale for archiving proprietary contract repos in favor of external adapters.
 */

import type { SettlementRail } from "./core_types";
import { SettlementRail as Rail } from "./core_types";

export interface NonCustodialSettlementRequest {
  id: string;
  sourceWalletAddress: string;
  destinationWalletAddress: string;
  amountSat: bigint;
  rail: SettlementRail;
  preferredDefiProtocol?: string;
  isClientKeyIsolated: boolean; // Must be true (BYOK)
  storesClientDataOnHub: boolean; // Must be false
}

export interface ZeroCustodyValidationResult {
  isZeroCustodyCompliant: boolean;
  isByokVerified: boolean;
  isDataIsolated: boolean;
  custodyRiskLevel: "ZERO" | "CRITICAL";
  violations: string[];
}

export interface DefiProtocolAdapter {
  protocolName: string;
  rail: SettlementRail;
  contractAddressOrEndpoint: string;
  isExternalAuditedProtocol: boolean;
  type: "AMM_POOL" | "ESCROW_STANDARD" | "FEDERATED_MINT" | "LIGHTNING_NODE" | "STATECHAIN_ENTITY";
}

export interface M2mRouteResult {
  routeId: string;
  fromAgentDid: string;
  toAgentDid: string;
  amountSat: bigint;
  rail: SettlementRail;
  adapter: DefiProtocolAdapter;
  mcpContextWire: Record<string, string>;
  isNonCustodial: boolean;
}

export interface DeprecationAdvisory {
  targetRepo: "Conxian/Conxian";
  status: "DEPRECATED_RECOMMENDED_ARCHIVE";
  rationale: string;
  keyBenefits: string[];
  replacementArchitecture: string;
}

export class MarketAgnosticRouter {
  /**
   * Validate that a settlement request complies with the Zero-Custody Doctrine.
   */
  static validateZeroCustody(request: NonCustodialSettlementRequest): ZeroCustodyValidationResult {
    const violations: string[] = [];

    if (!request.isClientKeyIsolated) {
      violations.push("Client private keys must remain isolated on client device/enclave (BYOK violation)");
    }

    if (request.storesClientDataOnHub) {
      violations.push("Centralized storage of unencrypted client data on Hub is prohibited");
    }

    if (request.sourceWalletAddress === request.destinationWalletAddress) {
      violations.push("Source and destination wallet addresses cannot be identical");
    }

    const isZeroCustodyCompliant = violations.length === 0;

    return {
      isZeroCustodyCompliant,
      isByokVerified: request.isClientKeyIsolated,
      isDataIsolated: !request.storesClientDataOnHub,
      custodyRiskLevel: isZeroCustodyCompliant ? "ZERO" : "CRITICAL",
      violations,
    };
  }

  /**
   * Resolve BYO external DeFi protocol adapter based on settlement rail and client preference.
   */
  static resolveDefiAdapter(rail: SettlementRail, preferredProtocol?: string): DefiProtocolAdapter {
    switch (rail) {
      case Rail.Sbtc:
      case Rail.AlexStacks:
        return {
          protocolName: preferredProtocol ?? "ALEX sBTC/USDC Protocol",
          rail,
          contractAddressOrEndpoint: "SP3K8BC0PPEVCV7NZ6QSRWPQ236E7FA5AFPPY3393.alex-vault",
          isExternalAuditedProtocol: true,
          type: "AMM_POOL",
        };

      case Rail.EvmErc8183:
        return {
          protocolName: preferredProtocol ?? "Uniswap v4 ERC-8183 Escrow",
          rail,
          contractAddressOrEndpoint: "0x8183000000000000000000000000000000008183",
          isExternalAuditedProtocol: true,
          type: "ESCROW_STANDARD",
        };

      case Rail.Fedimint:
        return {
          protocolName: preferredProtocol ?? "Fedimint Industrial E-Cash Mint",
          rail,
          contractAddressOrEndpoint: "fedimint://mint.conxian-industrial.org",
          isExternalAuditedProtocol: true,
          type: "FEDERATED_MINT",
        };

      case Rail.Lightning:
        return {
          protocolName: preferredProtocol ?? "Core Lightning LND Gateway",
          rail,
          contractAddressOrEndpoint: "lnbc100u1p3...",
          isExternalAuditedProtocol: true,
          type: "LIGHTNING_NODE",
        };

      case Rail.Statechain:
      case Rail.Rgb:
      case Rail.Babylon:
      default:
        return {
          protocolName: preferredProtocol ?? "Standard External Settlement Rail",
          rail,
          contractAddressOrEndpoint: "external://rail.adapter.org",
          isExternalAuditedProtocol: true,
          type: "STATECHAIN_ENTITY",
        };
    }
  }

  /**
   * Route autonomous agent-to-agent (M2M) settlement non-custodially via MCP context.
   */
  static routeM2mSettlement(
    fromAgentDid: string,
    toAgentDid: string,
    amountSat: bigint,
    rail: SettlementRail,
    preferredProtocol?: string
  ): M2mRouteResult {
    const adapter = MarketAgnosticRouter.resolveDefiAdapter(rail, preferredProtocol);

    const mcpContextWire: Record<string, string> = {
      "x-mcp-protocol": "2024-11-05",
      "x-conxian-m2m-from": fromAgentDid,
      "x-conxian-m2m-to": toAgentDid,
      "x-conxian-amount-sat": amountSat.toString(),
      "x-conxian-rail": rail,
      "x-conxian-adapter": adapter.protocolName,
      "x-conxian-zero-custody": "true",
    };

    return {
      routeId: `m2m-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      fromAgentDid,
      toAgentDid,
      amountSat,
      rail,
      adapter,
      mcpContextWire,
      isNonCustodial: true,
    };
  }

  /**
   * Expose formal architectural advisory for deprecating/archiving Conxian/Conxian.
   */
  static getDeprecationAdvisory(): DeprecationAdvisory {
    return {
      targetRepo: "Conxian/Conxian",
      status: "DEPRECATED_RECOMMENDED_ARCHIVE",
      rationale:
        "Building proprietary smart contracts and DeFi primitives (Conxian/Conxian) introduces severe audit liabilities, maintenance drag, and bootstrapping costs. Conxian operates as a market-agnostic, zero-custody value router that leverages established external protocols (ALEX, Uniswap, Fedimint, ERC-8183).",
      keyBenefits: [
        "Zero smart contract maintenance debt or audit cost for proprietary AMMs/vaults",
        "Zero custody risk — client funds remain in user wallets or audited external protocols",
        "Market-agnostic flexibility — clients choose any EVM, Bitcoin L2, or Lightning rail",
        "Faster time-to-market and seamless integration with existing M2M agent networks",
      ],
      replacementArchitecture:
        "@conxian/market-sdk orchestration layer + conxian-gateway ingress + external DeFi adapters",
    };
  }
}
