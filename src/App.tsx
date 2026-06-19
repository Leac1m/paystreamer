import Router from "./router";
import { usePaymentNotifications } from "./hooks/usePaymentNotifications";

export default function App() {
  usePaymentNotifications();
  return <Router />;
}
