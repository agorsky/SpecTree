import * as React from "react";
import { Terminal } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

interface CliInstructionModalProps {
  children?: React.ReactNode;
}

export function CliInstructionModal({ children }: CliInstructionModalProps) {
  const [open, setOpen] = React.useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>{children}</Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Create a New Epic Request</DialogTitle>
          <DialogDescription>
            Use the CLI agent to submit your feature request
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="flex items-start gap-3">
            <Terminal className="h-5 w-5 text-muted-foreground mt-0.5" />
            <p className="text-sm text-muted-foreground">
              Use the <code className="px-1 py-0.5 rounded bg-muted font-mono text-xs">@request-formulator</code> CLI agent to create and submit epic requests directly from your terminal or IDE.
            </p>
          </div>

          <div className="space-y-2">
            <p className="text-sm font-medium">Command:</p>
            <div className="bg-muted p-4 rounded-md font-mono text-sm">
              @request-formulator "Your feature request"
            </div>
          </div>

          <div className="space-y-2">
            <p className="text-sm font-medium">Example:</p>
            <div className="bg-muted p-4 rounded-md font-mono text-sm text-muted-foreground">
              @request-formulator "Add user authentication with OAuth2"
            </div>
          </div>

          <p className="text-xs text-muted-foreground">
            The CLI agent will guide you through providing all necessary details for your epic request, including problem statement, proposed solution, and impact assessment.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
