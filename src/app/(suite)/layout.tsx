import { SuiteHeader } from "@/components/suite-header";

/** The frame every signed-in screen shares: the header, then the page. */
export default function SuiteLayout({ children }: LayoutProps<"/">) {
  return (
    <>
      <SuiteHeader />
      <main className="mx-auto w-full max-w-6xl flex-1 px-6 py-8">{children}</main>
    </>
  );
}
