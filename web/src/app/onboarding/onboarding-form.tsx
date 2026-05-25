"use client";

import { useActionState } from "react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import {
  createWorkspaceAction,
  type OnboardingFormState,
} from "./actions";

const INITIAL_STATE: OnboardingFormState = {};

export function OnboardingForm({ isFirst = true }: { isFirst?: boolean }) {
  const [state, formAction, pending] = useActionState(
    createWorkspaceAction,
    INITIAL_STATE,
  );

  return (
    <Card className="w-full max-w-md p-3">
      <CardHeader className="px-1 pb-3 pt-1">
        <CardTitle className="text-foreground-title text-base">
          {isFirst ? "Create your first workspace" : "New workspace"}
        </CardTitle>
      </CardHeader>
      <CardContent className="px-1 pb-1">
        <form action={formAction} className="flex flex-col gap-3">
          <div className="grid gap-1.5">
            <Label htmlFor="name" className="text-sm">
              Workspace name
            </Label>
            <Input
              id="name"
              name="name"
              type="text"
              placeholder="Acme Platform"
              autoComplete="off"
              required
              disabled={pending}
            />
            <p className="text-foreground-muted text-xs">
              We&apos;ll use this to derive your workspace URL (e.g.{" "}
              <code className="bg-surface rounded px-1 py-0.5">acme-platform</code>
              ). You can change it later.
            </p>
          </div>

          {state.error && (
            <p className="text-sentiment-negative text-sm" role="alert">
              {state.error}
            </p>
          )}

          <Button
            type="submit"
            variant="primary"
            disabled={pending}
            className="mt-1 w-full"
          >
            {pending ? "Creating…" : "Create workspace"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
