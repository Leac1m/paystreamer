import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useCurrentAccount, useDAppKit } from "@mysten/dapp-kit-react";
import { Transaction } from "@mysten/sui/transactions";
import {
  Modal,
  ModalContent,
  ModalHeader,
  ModalTitle,
  ModalDescription,
  ModalFooter,
} from "../ui/modal";
import { Input } from "../ui/input";
import { Button } from "../ui/button";
import { V2_PACKAGE_ID, CLOCK_OBJECT_ID } from "../../constants";
import { getErrorMessage } from "../../lib/errors";

interface RegisterPlatformModalProps {
  open: boolean;
  onClose: () => void;
}

export function RegisterPlatformModal({ open, onClose }: RegisterPlatformModalProps) {
  const account = useCurrentAccount();
  const dAppKit = useDAppKit();
  const queryClient = useQueryClient();

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("Software");
  const [iconUrl, setIconUrl] = useState("");
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit() {
    if (!account || !name || !description || !category) {
      setError("Please fill in all required fields (Name, Description, Category)");
      return;
    }

    setIsPending(true);
    setError(null);

    const tx = new Transaction();

    tx.moveCall({
      target: `${V2_PACKAGE_ID}::platform::register_platform`,
      arguments: [
        tx.pure.string(name),
        tx.pure.string(description),
        tx.pure.string(category),
        tx.pure.option("string", iconUrl || null),
        tx.object(CLOCK_OBJECT_ID),
      ],
    });

    try {
      const result = await dAppKit.signAndExecuteTransaction({ transaction: tx });
      if (result.$kind === "FailedTransaction") {
        throw new Error(
          result.FailedTransaction.status.error?.message ?? "Transaction failed"
        );
      }
      await queryClient.invalidateQueries({ queryKey: ["owned-platforms", account.address] });
      onClose();
      resetForm();
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setIsPending(false);
    }
  }

  function resetForm() {
    setName("");
    setDescription("");
    setCategory("Software");
    setIconUrl("");
  }

  return (
    <Modal open={open} onOpenChange={(openValue) => !openValue && onClose()}>
      <ModalContent className="sm:max-w-lg mx-4">
        <ModalHeader>
          <ModalTitle>Register New Platform</ModalTitle>
          <ModalDescription>
            Register your platform on the Sui network to start accepting subscriptions.
          </ModalDescription>
        </ModalHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Platform Name *</label>
            <Input
              placeholder="e.g., Acme Corp"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Description *</label>
            <Input
              placeholder="Brief description of your platform"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Category *</label>
            <Input
              placeholder="e.g., Software, Media, AI"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Icon URL (Optional)</label>
            <Input
              placeholder="https://example.com/icon.png"
              value={iconUrl}
              onChange={(e) => setIconUrl(e.target.value)}
            />
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}
        </div>

        <ModalFooter>
          <Button variant="outline" onClick={onClose} disabled={isPending}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={!account || isPending} loading={isPending}>
            Register Platform
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}
