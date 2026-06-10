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
      const code = match[0].toLowerCase();
      if (ERROR_MESSAGES[code]) {
        return ERROR_MESSAGES[code];
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
  const message = getErrorMessage(error);

  const abortCodePatterns = [
    { code: 0x9001, label: "ENotDue", detail: "Payment is not yet due" },
    { code: 0x9002, label: "EInvalidPolicy", detail: "Invalid spending policy" },
    { code: 0x9003, label: "EInsufficientBalance", detail: "Insufficient account balance" },
    { code: 0x9004, label: "EMinBalanceExceeded", detail: "Would drop below minimum balance" },
    { code: 0x9005, label: "EMaxWithdrawalExceeded", detail: "Would exceed maximum withdrawal limit" },
    { code: 0x9006, label: "EFrequencyTooSoon", detail: "Too soon since last payment" },
    { code: 0x9007, label: "EInvalidDenomination", detail: "Invalid coin denomination" },
    { code: 0x9008, label: "EAccountNotFound", detail: "Account not found" },
    { code: 0x9009, label: "ESubscriptionNotFound", detail: "Subscription not found" },
    { code: 0x900A, label: "EPlatformNotFound", detail: "Platform not found" },
    { code: 0x900B, label: "EUnauthorized", detail: "Unauthorized operation" },
    { code: 0x900C, label: "EAccountPaused", detail: "Account is paused" },
    { code: 0x900D, label: "EAccountClosed", detail: "Account is closed" },
    { code: 0x900E, label: "ESubscriptionPaused", detail: "Subscription is paused" },
    { code: 0x900F, label: "ESubscriptionCancelled", detail: "Subscription is cancelled" },
    { code: 0x9010, label: "ETierNotFound", detail: "Tier not found" },
    { code: 0x9011, label: "EInvalidTier", detail: "Invalid tier configuration" },
    { code: 0x9012, label: "EAlreadyRegistered", detail: "Already registered" },
    { code: 0x9013, label: "EInvalidAmount", detail: "Invalid amount" },
    { code: 0x9014, label: "EGasCoinNotFound", detail: "Gas coin not found" },
  ];

  for (const { code, label, detail } of abortCodePatterns) {
    if (message.includes(String(code))) {
      return `${label}: ${detail}`;
    }
  }

  if (message.includes("Insufficient coin balance")) {
    return "InsufficientBalance: Not enough SUI for this transaction";
  }
  if (message.includes("move_call")) {
    return "Transaction failed: Invalid move call";
  }
  if (message.includes("type argument mismatch")) {
    return "Transaction failed: Type argument mismatch";
  }

  return message;
}