import DesktopShell from "@/components/DesktopShell";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return <DesktopShell>{children}</DesktopShell>;
}
