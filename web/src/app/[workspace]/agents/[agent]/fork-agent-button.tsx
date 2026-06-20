"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";

import { forkAgentAction } from "./actions";

// Fork an agent into your own owner-namespaced copy (ryw.<base-slug>) and open
// it. The copy is yours (you become its owner) so it shows in your default
// "Mine + Starred" list and you can iterate without touching the original.
export function ForkAgentButton({
  workspaceSlug,
  agentName,
}: {
  workspaceSlug: string;
  agentName: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  return (
    <Button
      variant="ghost"
      disabled={pending}
      title="Make your own editable copy of this agent"
      onClick={() => {
        startTransition(async () => {
          const r = await forkAgentAction({ workspaceSlug, agentName });
          if (r.ok) {
            toast.success(`Forked as ${r.agentName}`);
            router.push(
              `/${workspaceSlug}/agents/${encodeURIComponent(r.agentName)}`,
            );
          } else {
            toast.error(r.error);
          }
        });
      }}
    >
      {pending ? "Forking…" : "Fork"}
    </Button>
  );
}
