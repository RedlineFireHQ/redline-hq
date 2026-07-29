export default function ActivityFeed() {
  const activity = [
    {
      time: "8:15 AM",
      title: "Engine 430 Daily Inspection Completed",
      user: "A. Smith",
    },
    {
      time: "7:42 AM",
      title: "July EMS Training Logged",
      user: "J. Doe",
    },
    {
      time: "Yesterday",
      title: "New Department Alert Created",
      user: "Chief Miller",
    },
    {
      time: "Yesterday",
      title: "Inventory Updated",
      user: "Captain Jones",
    },
    {
      time: "2 Days Ago",
      title: "Member Certification Renewed",
      user: "Training Officer",
    },
  ];

  return (
    <div className="rounded-2xl border border-neutral-800 bg-neutral-950 p-6 shadow-xl">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.25em] text-red-500">
            Activity Feed
          </p>

          <h2 className="mt-3 text-3xl font-bold text-white">
            Recent Activity
          </h2>

          <p className="mt-2 text-sm text-neutral-400">
            Latest department activity.
          </p>
        </div>
      </div>

      <div className="mt-6 space-y-3">
        {activity.map((item) => (
          <div
            key={`${item.time}-${item.title}`}
            className="flex items-center justify-between rounded-xl bg-neutral-900 px-4 py-3"
          >
            <div>
              <p className="font-medium text-white">{item.title}</p>
              <p className="text-sm text-neutral-400">{item.user}</p>
            </div>

            <span className="text-sm text-neutral-500">
              {item.time}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}