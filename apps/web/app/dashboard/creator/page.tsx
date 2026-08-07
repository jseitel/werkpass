import { redirect } from "next/navigation";

export default function CreatorRedirectPage() {
  redirect("/dashboard/customers");
}
