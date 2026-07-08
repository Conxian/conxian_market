# Cross-Repo Structural Mapping: From Vision to Execution

## 1. The Tri-Layer Architecture
The Conxian Ecosystem is organized into three distinct layers, mirrored in our repository structure:

### A. The Governance Layer (The Rules)
- **Repository:** `conxian-business`
- **Role:** Defines the "Commercial Packaging Doctrine," "Operating Lane Boundaries," and "Trust Policies."
- **Connection:** PR 875 establishes the "sub-repo" pattern to ensure business rules are versioned alongside the code they govern.

### B. The State & Proof Layer (The Truth)
- **Repositories:** `conxian-nexus`, `lib-conxian-core`, `conxius-enclave-sdk`
- **Role:** Maintains the "Glass Node" observation, generates ZK-proofs of transactions, and handles hardware-secured attestation.
- **Connection:** This is where the "Institutional Rails" (ZK-KYC, Audits) identified in DD are implemented.

### C. The Settlement & Discovery Layer (The Value)
- **Repositories:** `conxian_market` (Current), `conxius-wallet`, `conxian-gateway`
- **Role:** Handles the 80/10/10 fee split, escrow management (ERC-8183), and agent discovery.
- **Connection:** This layer must be "Stub-Free" to ensure "Economic Vitality."

## 2. Analysis of the Sub-repo Pattern (PR 875)
PR 875 in `conxian-business` contains the marketplace as a sub-repo.
- **Pros:** Ensures that "Marketplace Features" are always compliant with "Business Doctrine."
- **Cons:** Can create deployment friction.
- **Recommendation:** Keep the sub-repo for *Development & Audit*, but use independent CI/CD for *Production Deployment* to maintain the "Multi-Dimensional Scaling" of our operations.

## 3. The "AI Office" Integration (DD)
Daemon-Dynamics (DD) acts as the **Controller** for these layers.
- **DD + Business:** DD reads the business rules to set agent constraints.
- **DD + Nexus:** DD uses Nexus to verify cross-chain state before a payout.
- **DD + Market:** DD is the interface where users "builder deploy" new logic modules.

## 4. Discard/Rebuild Map (High-Level)
| Repository | Task | Rationale |
| -- | -- | -- |
| `conxian-nexus` | REBUILD | Current "Glass Node" is too heavy; needs to move to "Recursive Proof" (BitVM3) to scale. |
| `conxian-gateway` | HARDEN | Must implement missing Fedimint/Citrea adapters to capture "Productive AI" revenue. |
| `conxian_market` | REBUILD | Must replace settlement stubs (CON-1427) with functional L402/ERC-8183 logic. |
