import type { Metadata } from "next";
import { LoginView } from "./login-view";

export const metadata: Metadata = { title: "Login Administrator" };

export default function LoginPage() {
  return <LoginView />;
}
