import SignInForm from "@/components/auth/SignInForm";
import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Giriş Yap - Kocumnet Admin",
  description: "Kocumnet Admin Paneline Giriş Yapın",
};

export default function SignIn() {
  return <SignInForm />;
}
