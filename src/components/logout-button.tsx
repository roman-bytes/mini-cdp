import { LogOut } from "lucide-react";

import { logoutAction } from "@/app/login/actions";
import { Button } from "@/components/ui/button";

/** Signs the current browser out. Sits in the top bar beside the theme toggle. */
export function LogoutButton() {
  return (
    <form action={logoutAction}>
      <Button type="submit" variant="ghost" size="icon-sm" aria-label="Sign out">
        <LogOut aria-hidden="true" />
      </Button>
    </form>
  );
}
