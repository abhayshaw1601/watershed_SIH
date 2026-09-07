import type { Alert } from "@/lib/watershed-data";
import { cn } from "@/lib/cn";
import { WarningOctagon, Lightbulb, Info, CheckCircle } from "@phosphor-icons/react";

const SEVERITY_CONFIG: Record<
  Alert["severity"],
  { border: string; text: string; label: string; Icon: typeof WarningOctagon }
> = {
  ALERT: {
    border: "border-l-rose-500",
    text: "text-rose-500",
    label: "Action Required",
    Icon: WarningOctagon,
  },
  RECOMMEND: {
    border: "border-l-amber-500",
    text: "text-amber-500",
    label: "Recommendation",
    Icon: Lightbulb,
  },
  INFO: {
    border: "border-l-teal-500",
    text: "text-teal-500",
    label: "Observation",
    Icon: Info,
  },
  VERIFIED: {
    border: "border-l-sage",
    text: "text-sage",
    label: "Field Verified",
    Icon: CheckCircle,
  },
};

export default function AlertCard({ alert }: { alert: Alert }) {
  const config = SEVERITY_CONFIG[alert.severity] || SEVERITY_CONFIG.INFO;
  const Icon = config.Icon;

  return (
    <div className={cn("border-l-4 rounded-r-xl border border-foreground/10 bg-foreground/[0.02] p-4", config.border)}>
      <div className="flex items-center justify-between">
        <span className={cn("font-mono text-xs uppercase tracking-wider font-semibold flex items-center gap-1.5", config.text)}>
          <Icon size={14} weight="bold" />
          <span>{config.label}</span>
        </span>
        {alert.area_ha !== null && (
          <span className="font-mono text-xs text-muted-foreground">{alert.area_ha} ha affected</span>
        )}
      </div>
      <p className="mt-2 text-xs leading-relaxed text-foreground/90">{alert.message}</p>
      {alert.evidence && alert.evidence.length > 0 && (
        <div className="mt-3 pt-2.5 border-t border-dashed border-foreground/10">
          <div className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground mb-1.5">
            Satellite Evidence
          </div>
          <ul className="list-disc pl-4 space-y-1 text-xs text-muted-foreground">
            {alert.evidence.map((ev, i) => (
              <li key={i}>{ev}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

