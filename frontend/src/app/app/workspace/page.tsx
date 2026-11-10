import type { Metadata } from "next";
import WorkspaceSettings from "@/components/WorkspaceSettings";

export const metadata: Metadata = { title: "MiB — Workspace" };

export default function WorkspacePage() {
  return <WorkspaceSettings />;
}
