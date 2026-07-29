interface StatusBadgeProps {
  status: "success" | "warning" | "danger" | "info";
  children: React.ReactNode;
}

export default function StatusBadge({
  status,
  children,
}: StatusBadgeProps) {
  const styles = {
    success:
      "bg-green-500/15 text-green-400 border border-green-500/20",

    warning:
      "bg-amber-500/15 text-amber-400 border border-amber-500/20",

    danger:
      "bg-red-500/15 text-red-400 border border-red-500/20",

    info:
      "bg-blue-500/15 text-blue-400 border border-blue-500/20",
  };

  return (
    <span
      className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-bold uppercase tracking-wider ${styles[status]}`}
    >
      {children}
    </span>
  );
}