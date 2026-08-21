const withNextra = require('nextra')({
  theme: 'nextra-theme-docs',
  themeConfig: './theme.config.jsx'
})

module.exports = withNextra({
  reactStrictMode: true,
  transpilePackages: ['@paystreamer/sdk', 'mermaid', '@theguild/remark-mermaid'],
  experimental: {
    esmExternals: 'loose'
  },
  // The generated TypeDoc site lives under public/typedoc as static HTML
  // with relative asset links (assets/style.css, etc.), which only resolve
  // correctly when the browser is actually at .../typedoc/index.html — not
  // at a directory path like /typedoc or /typedoc/. A rewrite serves the
  // right bytes but leaves the address bar (and therefore relative-link
  // resolution) at the wrong URL, so this redirects to the real file
  // instead of rewriting to it.
  async redirects() {
    return [
      { source: '/typedoc', destination: '/typedoc/index.html', permanent: false },
      { source: '/typedoc/', destination: '/typedoc/index.html', permanent: false },
    ]
  },
})
