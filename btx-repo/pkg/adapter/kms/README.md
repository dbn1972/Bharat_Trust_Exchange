# @btx/adapter-kms

Cloud-agnostic KMS adapter contract.

## Implementations

- stub: implemented against local kms-stub service
- aws: not-implemented (enabled after CT cloud certification)
- gcp: not-implemented (enabled after CT cloud certification)
- azure: not-implemented (enabled after CT cloud certification)

## Required Operations

- generateDataKey
- decryptDataKey
- sign
- verify
- publicKeyPem
- healthz
