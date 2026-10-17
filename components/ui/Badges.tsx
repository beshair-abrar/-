import { CheckCircle2, CircleDashed, FlaskConical, Loader } from "lucide-react";
import { ProjectStatus, STATUS_LABELS } from "@/lib/projects/types";

const ICONS = { completed: CheckCircle2, in_progress: Loader, draft: CircleDashed };

export function StatusBadge({ status }: { status: ProjectStatus }) {
  const Icon = ICONS[status];
  return (
    <span className={`badge badge-${status}`}>
      <Icon size={13} aria-hidden />
      {STATUS_LABELS[status]}
    </span>
  );
}

export function DemoBadge() {
  return (
    <span className="badge badge-demo" title="بيانات تجريبية للاستعراض وليست بيانات فعلية">
      <FlaskConical size={13} aria-hidden />
      تجريبي
    </span>
  );
}
