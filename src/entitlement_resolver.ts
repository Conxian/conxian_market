/**
 * Server-side entitlement resolution for the managed subscription lane.
 *
 * `client_onboarding.ts` deliberately returns an UNVERIFIED ObserverOnly license
 * because no entitlement issuer/verifier is configured locally — a configuration
 * or caller override is not a purchase receipt. This module defines the missing
 * resolver contract: a caller holding an *independently verified* purchase
 * reference resolves a bounded, expiring entitlement from a provider.
 *
 * Fail-closed: with no resolver, or an unverified/expired/mismatched result, the
 * caller receives the unverified ObserverOnly baseline — never a self-asserted
 * Managed/Strict license. The resolver is an authority boundary, so a VERIFIED
 * result is returned as-is; durable issuance and provider acceptance remain
 * external (Market #159 / Business #1343).
 */
import {
  TrustTier,
  type ClientEntitlementLicense,
  type SettlementRail,
} from "./core_types.js";

export const ENTITLEMENT_RESOLVER_PROFILE = "conxian-entitlement-resolver/1" as const;

/** Independently verified purchase reference (e.g. a provider-settled invoice). */
export interface EntitlementPurchaseReference {
  /** Subscription/payment pointer that was purchased. */
  paymentPointer: string;
  /** Client DID the purchase is bound to. */
  clientDid: string;
  /** Provider-settled transaction identifier. */
  transactionId: string;
}

/** Resolves a purchased entitlement from a provider. May be absent/unconfigured. */
export interface EntitlementResolver {
  resolve(reference: EntitlementPurchaseReference): Promise<ClientEntitlementLicense | null>;
}

/** The fail-closed baseline: no execution, no rails, no active job cards. */
export function unverifiedObserverLicense(clientDid: string): ClientEntitlementLicense {
  return {
    verificationStatus: "UNVERIFIED",
    licenseId: "",
    clientDid: clientDid || "did:conxian:anonymous",
    tier: TrustTier.ObserverOnly,
    allowedRails: [] as SettlementRail[],
    maxActiveJobCards: 0,
    agentExecutionEnabled: false,
  };
}

/**
 * A resolved license is usable only when it is explicitly VERIFIED, bound to the
 * expected client DID, and unexpired. Anything else degrades to the baseline.
 */
export function isUsableEntitlement(
  license: ClientEntitlementLicense | null,
  expectedClientDid: string,
  nowMs: number = Date.now(),
): boolean {
  if (!license || license.verificationStatus !== "VERIFIED") return false;
  if (!license.clientDid || license.clientDid !== expectedClientDid) return false;
  if (license.expiresAtIso !== undefined) {
    const expiresAt = Date.parse(license.expiresAtIso);
    if (!Number.isFinite(expiresAt) || expiresAt <= nowMs) return false;
  }
  return true;
}

/**
 * Resolve an entitlement through an optional resolver, failing closed to the
 * unverified baseline when the resolver is absent, throws, returns null, or
 * yields a license that is not VERIFIED, DID-bound and unexpired.
 */
export async function resolveClientEntitlement(
  resolver: EntitlementResolver | undefined,
  reference: EntitlementPurchaseReference,
  nowMs: number = Date.now(),
): Promise<ClientEntitlementLicense> {
  const baseline = unverifiedObserverLicense(reference.clientDid);
  if (!resolver) return baseline;
  let resolved: ClientEntitlementLicense | null;
  try {
    resolved = await resolver.resolve(reference);
  } catch {
    return baseline;
  }
  return isUsableEntitlement(resolved, reference.clientDid, nowMs) ? (resolved as ClientEntitlementLicense) : baseline;
}
