import { assertRunWieldAgentName } from "./custom-agent.ts";

export interface AgyCliRunRequest {
    agentName: string;
    model: string;
    userRequest: string;
    effort?: "low" | "medium" | "high";
}

export interface PreparedAgyCliCommand {
    command: "agy";
    args: string[];
    env: Record<string, string>;
}

export function prepareAgyCliStreamCommand(request: AgyCliRunRequest): PreparedAgyCliCommand {
    assertRunWieldAgentName(request.agentName);
    if (!request.userRequest) throw new Error("Agy user request is required");
    const model = request.model.trim();
    if (!model) throw new Error("Agy model selector is required");
    const args = ["-p", request.userRequest, "--model", model];
    args.push("--agent", request.agentName, "--output-format", "stream-json", "--disable-slash-commands");
    if (request.effort) args.push("--effort", request.effort);
    return {
        command: "agy",
        args,
        env: {},
    };
}

export function prepareAgyCliAgentsCommand(): PreparedAgyCliCommand {
    return { command: "agy", args: ["-p", "/agents", "--output-format", "json"], env: {} };
}
