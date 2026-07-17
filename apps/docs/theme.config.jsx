import { ConnectButton } from '@mysten/dapp-kit-react';

export default {
  logo: <strong>PayStreamer SDK</strong>,
  project: {
    link: 'https://github.com/paystreamer/sdk'
  },
  navbar: {
    extra: <ConnectButton />
  },
  useNextSeoProps() {
    return {
      titleTemplate: '%s – PayStreamer SDK'
    }
  }
}
