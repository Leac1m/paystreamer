import { LiveModeToggle } from './components/LiveModeToggle';

export default {
  logo: (
    <div className="flex items-center gap-4">
      <strong>PayStreamer SDK</strong>
      <LiveModeToggle />
    </div>
  ),
  project: {
    link: 'https://github.com/paystreamer/sdk'
  },
  useNextSeoProps() {
    return {
      titleTemplate: '%s – PayStreamer SDK'
    }
  }
}
