import { Section } from "@/components/section";
import {
  detectAgentSpecLanguage,
  highlightAgentSpec,
  type AgentSpecHighlightKind,
} from "@/lib/agent-spec-highlight";

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
  const specLanguage = detectAgentSpecLanguage(
    raw,
    agent.ok ? agent.spec.framework : undefined,
  );

  return (
    <>
      <Section
        title="Definition"
        description="Edits go through Git. Framework and model changes go through the same review path as any other change — never edited in a live console."
      >
        <HighlightedCodeBlock source={raw} language={specLanguage} />
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

const tokenClasses: Partial<Record<AgentSpecHighlightKind, string>> = {
  key: "text-foreground-category-blue font-semibold",
  string: "text-foreground-category-green",
  number: "text-foreground-category-purple",
  literal: "text-foreground-category-orange",
  comment: "text-foreground-muted",
  punctuation: "text-foreground-weak",
};

function HighlightedCodeBlock({
  source,
  language,
}: {
  source: string;
  language: "yaml" | "json";
}) {
  const tokens = highlightAgentSpec(source, language);

  return (
    <pre className="bg-surface border-border text-foreground overflow-x-auto rounded-lg border p-4 font-mono text-sm leading-5">
      <code>
        {tokens.map((token, index) => {
          const className = tokenClasses[token.kind];
          return className ? (
            <span key={index} className={className}>
              {token.text}
            </span>
          ) : (
            token.text
          );
        })}
      </code>
    </pre>
  );
}
