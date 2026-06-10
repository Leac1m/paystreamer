export const ERROR_MESSAGES: Record<string, string> = {
  "0x01001": "This account cap doesn't match your account. Try refreshing the page.",
  "0x01003": "This account is closed. Create a new account to continue.",
  "0x01005": "Insufficient balance. Deposit more funds to continue.",
  "0x01006": "This token type isn't supported. Contact support.",
  "0x06003": "You're already subscribed to this platform.",
  "0x06004": "This subscription is not active.",
  "0x06006": "Your account is paused. Resume it to continue.",
  "0x08002": "This tier doesn't exist or has been deactivated.",
  "0x09001": "This subscription isn't due for billing yet.",
  "0x09003": "Insufficient balance for this payment.",
  "0x0A001": "Payment processing is temporarily paused. Try again in a few minutes.",
  "0x0A002": "Payments are paused by the administrator.",
};

export function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    const match = error.message.match(/0x[0-9A-Fa-f]+/);
    if (match) {
      const code = match[0].toUpperCase();
      // Check uppercase or lowercase
      if (ERROR_MESSAGES[code]) {
        return ERROR_MESSAGES[code];
      }
      const lowerCode = match[0].toLowerCase();
      if (ERROR_MESSAGES[lowerCode]) {
        return ERROR_MESSAGES[lowerCode];
      }
    }
    if (error.message.includes("Insufficient balance")) {
      return ERROR_MESSAGES["0x01005"];
    }
    if (error.message.includes("already subscribed")) {
      return ERROR_MESSAGES["0x06003"];
    }
  }
  return "Something went wrong. Please try again.";
}

export function parseMoveError(error: unknown): string {
  if (error instanceof Error) {
    const message = getErrorMessage(error);
    if (message !== "Something went wrong. Please try again.") {
      return message;
    }

    if (error.message.includes("Insufficient coin balance")) {
      return "InsufficientBalance: Not enough SUI for this transaction";
    }
    if (error.message.includes("move_call")) {
      return "Transaction failed: Invalid move call";
    }
    if (error.message.includes("type argument mismatch")) {
      return "Transaction failed: Type argument mismatch";
    }
    
    // Return original message for debugging if not mapped
    return error.message;
  }
  
  return "Something went wrong. Please try again.";
}