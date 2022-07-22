![Contracts](tetu_contracts.svg)
## Tetu implementation of Rebalancig relayer asset manager for the balancer protocol

Main idea is to allow Asset manager to invest funds available in pool and earn extra rewards.
### Relayer
Realyer acts as proxy for user deposit and withdraw operations. It allows handling big withdraws.
Also, relayer can rebalance assets during the deposit and withdraw operations.

### Asset Manager
This contract encapsulate investment and reward claiming logic. In particular implementation ERC4626AssetManager is able to invest into ERC4626 vaults (tetuVaultV2) 

### Tetu Stable pool
Current balancer's stable pool didn't allow using asset managers. We updated implementation to support asset managers.

### Info
[Detailed modifications of StablePool](docs/solution.md)

[![codecov](https://codecov.io/gh/tetu-io/tetu-balancer-asset-manager/branch/main/graph/badge.svg?token=H2eWt1GKMb)](https://codecov.io/gh/tetu-io/tetu-balancer-asset-manager)

## Links

Web: https://tetu.io/

Docs: https://docs.tetu.io/

Discord: https://discord.gg/DSUKVEYuax

Twitter: https://twitter.com/tetu_io
