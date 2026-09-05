const ACTIVE_RUN_STATUSES = ["QUEUED", "RUNNING", "REVIEW_PENDING"];
const RUN_LABELS = {
  QUEUED: "等待生成", RUNNING: "正在生成", REVIEW_PENDING: "待负责人确认",
  APPROVED: "已采纳", REJECTED: "未采纳", FAILED: "生成失败", CANCELLED: "已取消",
};
const ERROR_LABELS = {
  AGENT_UNAVAILABLE: "当前服务尚未配置 AI，任务仍可由成员继续推进。",
  AGENT_RUN_IN_FLIGHT: "已有简报正在生成或等待确认，请先查看当前结果。",
  PLAN_NOT_CONFIRMED: "请先由全员确认共同计划。",
  AGENT_BUDGET_EXCEEDED: "项目今日 AI 额度已用完，请明天再试。",
  AGENT_TRIGGER_FORBIDDEN: "只有任务负责人可以发起调研。",
  AGENT_REVIEW_FORBIDDEN: "只有任务负责人可以确认这份简报。",
  AGENT_RUN_NOT_REVIEWABLE: "简报状态已变化，请刷新后查看。",
  AGENT_RUN_NOT_CANCELLABLE: "生成状态已变化，请刷新后查看。",
  LLM_TIMEOUT: "AI 生成超时，可重试；任务状态没有改变。",
  LLM_ERROR: "AI 暂时无法生成简报，请稍后重试。",
  SCHEMA_INVALID: "AI 返回的简报格式不完整，请重试。",
  REQUEST_TIMEOUT: "等待超时，服务端可能仍在生成。请刷新查看；重试会查询同一次请求。",
  NETWORK_ERROR: "网络连接中断，请刷新确认结果后再重试。",
};

function agentErrorMessage(error) {
  return ERROR_LABELS[error?.code] || error?.message || "操作未完成，请刷新后重试。";
}

function addAgentPresentation(room, currentUserId) {
  const runs = room.agent_runs || [];
  return {
    ...room,
    planSourceLabel: !room.starter_pack ? ""
      : room.starter_pack.generated_by === "AI" ? "来源：AI 生成"
        : room.starter_pack.generated_by === "TEMPLATE_FALLBACK" ? "来源：模板起步建议" : "来源：任务建议",
    hasPendingAgent: runs.some((run) => ["QUEUED", "RUNNING"].includes(run.status)),
    tasks: room.tasks.map((task) => {
      const taskRuns = runs.filter((run) => run.task_id === task.id);
      const isOwner = Boolean(currentUserId && task.confirmed_owner_id === currentUserId);
      return {
        ...task,
        agentHint: !["PROPOSED", "ACCEPTED", "IN_PROGRESS"].includes(task.status)
          ? "当前任务状态不可发起新的调研。"
          : !task.confirmed_owner_id ? "领取任务并由全员确认计划后，负责人可发起调研。"
            : !isOwner ? "由任务负责人发起调研，你可以在这里查看结果。"
              : "全员确认共同计划后，即可发起调研。",
        canRunAgent: isOwner && task.mode === "HUMAN_AGENT"
          && ["ACCEPTED", "IN_PROGRESS"].includes(task.status)
          && room.starter_pack?.status === "CONFIRMED"
          && !taskRuns.some((run) => ACTIVE_RUN_STATUSES.includes(run.status)),
        agentRuns: taskRuns.map((run) => ({
          ...run,
          statusLabel: RUN_LABELS[run.status] || "状态待刷新",
          failureMessage: run.status === "FAILED"
            ? agentErrorMessage({ code: run.error_code, message: "AI 生成失败，可稍后重试。" }) : "",
          canReview: isOwner && run.status === "REVIEW_PENDING",
          canCancel: Boolean(currentUserId) && ["QUEUED", "RUNNING"].includes(run.status)
            && (run.triggered_by === currentUserId || room.project.originator_id === currentUserId),
        })),
      };
    }),
  };
}

module.exports = { addAgentPresentation, agentErrorMessage };
