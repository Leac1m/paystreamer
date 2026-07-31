import { useState, useRef } from "react";
import { ConnectModal } from "@mysten/dapp-kit-react/ui";
import { SetupSubscriptionModal } from "@paystreamer/sdk/ui";
import { useCurrentAccount } from "@mysten/dapp-kit-react";

// The demo platform id seeded on localnet or testnet
const PLATFORM_ID = "0xc4a19391ab1a1bd3307da2dc3ce0130dbd5c36fa3c2858eb5b62e49c7163c4c9";

function App() {
  const [modalOpen, setModalOpen] = useState(false);
  const account = useCurrentAccount();
  const modalRef = useRef<any>(null);

  return (
    <div className="app-container">
      <header className="header">
        <div className="header-logo">
          <span>Acme</span>Corp
        </div>
        <div>
          <button className="dapp-kit-connect-btn" onClick={() => modalRef.current?.open()}>
            {account ? `${account.address.slice(0, 6)}...${account.address.slice(-4)}` : "Connect Wallet"}
          </button>
          <ConnectModal ref={modalRef} />
        </div>
      </header>

      <main className="main-content">
        <div className="showcase-card">
          <div className="showcase-icon">✨</div>
          <h2>Premium Plan</h2>
          <p>
            Unlock all advanced features, dedicated support, and unlimited usage with our premium subscription plan.
          </p>

          <button 
            className="dapp-kit-connect-btn ps-button-primary" 
            style={{ width: '100%', fontSize: '1.1rem', padding: '0.75rem 1.5rem' }} 
            onClick={() => {
              if (!account) {
                alert("Please connect your wallet first!");
                return;
              }
              setModalOpen(true);
            }}
          >
            Subscribe with Sui
          </button>

          <div className="integration-wrapper">
            {/* PayStreamer Drop-in Modal */}
            <SetupSubscriptionModal
              isOpen={modalOpen}
              onClose={() => setModalOpen(false)}
              platformId={PLATFORM_ID}
              tierIndex={0}
              onSuccess={() => {
                alert("Successfully subscribed to AcmeCorp Premium!");
                setModalOpen(false);
              }}
            />
          </div>
        </div>
      </main>
    </div>
  );
}

export default App;
