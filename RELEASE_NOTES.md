# eQc 1.8.7

This patch fixes eQc failing to open on Intel Macs after installation.

- **Correct Intel Mac database component:** the v1.8.6 Intel installer included an Apple Silicon SQLite binary. Intel and Apple Silicon installers now build separately on matching-architecture Mac runners.
- **Packaged Mac startup checks:** verify the architecture of the actual app executable and every unpacked native component, then start the packaged Electron runtime and exercise SQLite in memory before creating the installer. A mismatched component blocks the release.
- **Verified Mac update information:** check both disk-image sizes and SHA-512 checksums and combine their update metadata so both Intel and Apple Silicon downloads remain represented.
- **Installation guidance:** Intel Core i5/i7/i9 Macs use `eQc-Setup-1.8.7-x64.dmg`; Apple M-series Macs use `eQc-Setup-1.8.7-arm64.dmg`. Open the disk image, drag eQc into Applications and replace the older app. Existing project/profile data does not need to be removed.

The research workflows and other features introduced in v1.8.6 remain available. Windows, Intel/Apple Silicon macOS and Linux x64 AppImage/deb packages are provided.

The v1.8.6 release and its archived DOI remain unchanged. Zenodo citation automation will update the repository citation and README when this new release is archived.
