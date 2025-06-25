export type AgentTask = {
  name: string;
  payload: any;
};

export async function agentRouter(task: AgentTask) {
  switch (task.name) {
    case "generatePost":
      // TODO: call content generation agent
      console.log("Generating post with payload:", task.payload);
      return { status: "success", result: "Post generated successfully" };
    default:
      throw new Error(`Unknown agent task: ${task.name}`);
  }
}
