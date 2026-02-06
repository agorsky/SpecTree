/**
 * Activity Tracker
 *
 * Maps tool calls and AI messages to human-readable activity descriptions
 * for real-time progress display in the CLI.
 */

/**
 * Maps tool calls to user-friendly activity labels and extracts
 * brief reasoning excerpts from AI messages.
 */
export class ActivityTracker {
  /**
   * Convert a tool call into a human-readable activity description.
   *
   * @param toolName - The tool name from the SDK event
   * @param toolArgs - The tool arguments
   * @returns A user-friendly description of the activity
   */
  static mapToolToActivity(
    toolName: string,
    toolArgs: Record<string, unknown> = {}
  ): string {
    // Copilot built-in tools
    switch (toolName) {
      case "Read":
        return `Reading file: ${ActivityTracker.truncatePath(toolArgs.file_path as string)}`;
      case "Edit":
        return `Editing file: ${ActivityTracker.truncatePath(toolArgs.file_path as string)}`;
      case "Write":
        return `Creating file: ${ActivityTracker.truncatePath(toolArgs.file_path as string)}`;
      case "Bash":
        return `Running: ${ActivityTracker.truncateCommand(toolArgs.command as string)}`;
      case "Glob":
        return `Searching files: ${toolArgs.pattern ?? "..."}`;
      case "Grep":
        return `Searching code: ${toolArgs.pattern ?? "..."}`;
      case "Task":
        return "Running sub-agent...";
      case "WebFetch":
        return "Fetching web content...";
      case "WebSearch":
        return "Searching the web...";
    }

    // SpecTree MCP tools
    if (toolName.startsWith("log_progress")) return "Logging progress...";
    if (toolName.startsWith("log_decision")) return "Recording decision...";
    if (toolName.startsWith("link_code_file")) return "Linking code file...";
    if (toolName.startsWith("get_task_context")) return "Reading task context...";
    if (toolName.startsWith("get_code_context")) return "Reading code context...";
    if (toolName.startsWith("report_blocker")) return "Reporting blocker...";
    if (toolName.startsWith("run_validation") || toolName.startsWith("run_all_validations"))
      return "Running validations...";
    if (toolName.startsWith("get_")) return "Fetching context...";
    if (toolName.startsWith("append_")) return "Updating SpecTree...";

    return "Processing...";
  }

  /**
   * Extract a brief reasoning excerpt from an AI message.
   *
   * @param message - The full AI message content
   * @param maxLength - Maximum length of the excerpt (default: 100)
   * @returns A brief excerpt suitable for display
   */
  static extractReasoning(message: string, maxLength: number = 100): string {
    if (!message) return "";

    // Strip markdown formatting
    const cleaned = message
      .replace(/^#+\s+/gm, "")
      .replace(/\*\*/g, "")
      .replace(/`[^`]*`/g, "")
      .trim();

    if (cleaned.length <= maxLength) return cleaned;

    // Try to extract first sentence
    const firstSentence = cleaned.match(/^[^.!?]+[.!?]/);
    if (firstSentence && firstSentence[0].length <= maxLength) {
      return firstSentence[0];
    }

    // Truncate at word boundary
    const truncated = cleaned.substring(0, maxLength);
    const lastSpace = truncated.lastIndexOf(" ");
    return (lastSpace > maxLength * 0.5 ? truncated.substring(0, lastSpace) : truncated) + "...";
  }

  /**
   * Determine if a tool call represents a significant milestone worth logging.
   */
  static isMilestone(toolName: string): boolean {
    return ["Edit", "Write", "Bash", "log_progress", "log_decision", "link_code_file"].includes(
      toolName
    );
  }

  // ---------------------------------------------------------------------------
  // Private Helpers
  // ---------------------------------------------------------------------------

  private static truncatePath(path: string | undefined, maxLength: number = 50): string {
    if (!path) return "...";
    if (path.length <= maxLength) return path;
    // Show last part of path
    const parts = path.split("/");
    let result = parts[parts.length - 1] ?? path;
    if (parts.length > 1) {
      result = ".../" + result;
    }
    return result;
  }

  private static truncateCommand(command: string | undefined, maxLength: number = 50): string {
    if (!command) return "...";
    // Take first line only
    const firstLine = command.split("\n")[0] ?? command;
    if (firstLine.length <= maxLength) return firstLine;
    return firstLine.substring(0, maxLength - 3) + "...";
  }
}
