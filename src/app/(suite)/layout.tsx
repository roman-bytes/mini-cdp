import { AppSidebar } from "@/components/app-sidebar";
import { Separator } from "@/components/ui/separator";
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";

/** The frame every signed-in screen shares: navigation on the left, the page on the right. */
export default function SuiteLayout({ children }: LayoutProps<"/">) {
  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
        <header className="flex h-12 shrink-0 items-center gap-2 border-b px-4">
          <SidebarTrigger />
          <Separator orientation="vertical" className="h-4" />
          <span className="text-sm text-muted-foreground">Customer data platform</span>
        </header>
        <div className="mx-auto w-full max-w-7xl flex-1 px-6 py-8">{children}</div>
      </SidebarInset>
    </SidebarProvider>
  );
}
