export * from './chain';
export * from './formatters';
export * from './transactions';

// seal.ts, deepbook.ts, and walrus.ts are deliberately NOT re-exported
// here. Each wraps an optional peerDependency, and an unconditional
// `export *` would make every consumer of '@paystreamer/sdk' or
// '@paystreamer/sdk/core' — even ones that never touch Seal/DeepBook/
// Walrus — statically import those packages too. Verified live: this
// broke Next.js/Turbopack dev builds outright (Walrus's WASM loader
// throws ENOENT trying to resolve a bundler-virtualized path even when
// unused, from *any* page that imports the SDK's root/core barrel), and
// caused apps that don't depend on these packages at all (e.g. the
// portal, via Vite's dependency pre-bundling) to resolve and bundle them
// anyway. Import these three directly from their own subpaths instead:
// '@paystreamer/sdk/core/seal', '.../core/deepbook', '.../core/walrus'.
