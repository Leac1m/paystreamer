[🏠 Root](../README.md) > 📦 Apps

# PayStreamer Applications & Services (`/apps`)

This directory contains the user-facing frontend applications, the backend worker, and the API services that power the PayStreamer ecosystem. 

All of these applications are built to seamlessly integrate with the shared `@paystreamer/sdk` package, which abstracts away direct smart contract interactions and Sui network details.

## Directory Map

* 🔗 **[Portal (`/apps/portal`)](./portal/README.md)**: The primary decentralized application (DApp) for end-users to manage their subscriptions, and for creators/businesses to register and manage their platforms.
* 🔗 **[Checkout (`/apps/checkout`)](./checkout/README.md)**: A lightweight, embeddable checkout flow designed to be integrated into third-party websites or shown in an iframe.
* 🔗 **[Docs (`/apps/docs`)](./docs/README.md)**: The comprehensive developer documentation site detailing SDK usage, protocol integration, and architecture.
* 🔗 **[Example (`/apps/example`)](./example/README.md)**: A minimal scaffolding implementation demonstrating exactly how third-party developers should integrate the PayStreamer SDK into their own Vite + React dApps.
* 🔗 **[Scheduler (`/apps/scheduler`)](./scheduler/README.md)**: A permissionless, automated backend worker script that listens for due payments and triggers the smart contract to pull funds.
* 🔗 **[Sponsor (`/apps/sponsor`)](./sponsor/README.md)**: The gas station API service. It sponsors user transactions with testnet Sui gas, ensuring a frictionless onboarding experience where users don't need native gas tokens to interact with the protocol.
