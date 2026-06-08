import { Section } from "@/components/section";

import { loadAgentContext } from "../agent-page-context";

export const dynamic = "force-dynamic";

// Definition tab — the raw agent spec and (when declared) its sidecar Python
// tools module, read-only. Edits go through Git / Chat-to-edit.

export default async function AgentDefinitionPage({
  params,
}: {
  params: Promise<{ workspace: string; agent: string }>;
}) {
  const { workspace: slug, agent: agentName } = await params;
  const { agent, raw, toolsModuleContent } = await loadAgentContext(
    slug,
    agentName,
  );

  const toolsModule =
    agent.ok && agent.spec.framework === "pydantic-agentspec"
      ? agent.spec.toolsModule
      : undefined;

  return (
    <>
      <Section
        title="Definition"
        description="Edits go through Git. Framework and model changes go through the same review path as any other change — never edited in a live console."
      >
        <pre className="bg-surface border-border text-foreground overflow-x-auto rounded-lg border p-4 font-mono text-sm leading-5">
          {raw}
        </pre>
      </Section>

      {toolsModule && (
        <Section
          title="Tools module"
          description={`Deterministic Python functions the model calls as tools, from ${toolsModule}. Runs in the agent's process with no token cost — the LLM supervises which functions to call.`}
        >
          {toolsModuleContent ? (
            <pre className="bg-surface border-border text-foreground overflow-x-auto rounded-lg border p-4 font-mono text-sm leading-5">
              {toolsModuleContent}
            </pre>
          ) : (
            <p className="text-sentiment-negative text-sm">
              The spec references{" "}
              <code className="font-mono">{toolsModule}</code> but it
              couldn&apos;t be read from the repo. Runs will fail until the file
              is added next to the agent.
            </p>
          )}
        </Section>
      )}
    </>
  );
}
