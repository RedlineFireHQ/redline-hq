interface TaskCardProps {
  title: string;
  description: string;
  status: "due" | "complete";
  children?: React.ReactNode;
}

export default function TaskCard({
  title,
  description,
  status,
  children,
}: TaskCardProps) {
  return (
    <div className="rounded-xl border border-neutral-700 bg-neutral-900">
      <div className="flex items-center justify-between p-5">
        <div>
          <h3 className="text-lg font-bold text-white">
            {title}
          </h3>

          <p className="mt-1 text-sm text-neutral-400">
            {description}
          </p>
        </div>

        {status === "due" ? (
          <span className="rounded-full bg-yellow-500 px-3 py-1 text-sm font-bold text-black">
            Due Today
          </span>
        ) : (
          <span className="rounded-full bg-green-600 px-3 py-1 text-sm font-bold text-white">
            Complete
          </span>
        )}
      </div>

      {children && (
        <div className="border-t border-neutral-700 p-5">
          {children}
        </div>
      )}
    </div>
  );
}