import SectionHeader from "./SectionHeader";

const activity = [
  {
    time: "09:14",
       title: "Engine 430 Apparatus Check Completed",
    user: "Capt. Smith",
  },
  {
    time: "08:51",
    title: "Training Hours Submitted",
    user: "FF Johnson",
  },
  {
    time: "08:23",
    title: "Inventory Updated",
    user: "Lt. Miller",
  },
  {
    time: "07:42",
    title: "Certification Approved",
    user: "Chief Brown",
  },
  {
    time: "07:18",
    title: "Grass 421 Inspection Completed",
    user: "FF Davis",
  },
];

export default function ActivityFeed() {
  return (
    <section className="overflow-hidden rounded-3xl border border-zinc-800 bg-[#111111]">
      <SectionHeader
        eyebrow="Live Feed"
        title="Department Activity"
        subtitle="Recent department activity"
      />

      <div className="divide-y divide-zinc-800">
        {activity.map((item) => (
          <div
            key={item.time + item.title}
            className="flex items-center justify-between px-6 py-5 transition hover:bg-white/[0.02]"
          >
            <div className="flex items-center gap-5">
              <div className="h-3 w-3 rounded-full bg-red-500" />

              <div>
                <h3 className="font-bold text-white">
                  {item.title}
                </h3>

                <p className="mt-1 text-sm text-zinc-500">
                  {item.user}
                </p>
              </div>
            </div>

            <div className="text-sm font-semibold text-zinc-500">
              {item.time}
            </div>
          </div>
        ))}
      </div>

      <div className="border-t border-zinc-800 px-6 py-5 text-center">
        <button className="rounded-xl border border-zinc-700 px-5 py-2 text-sm font-semibold text-white transition hover:border-red-500 hover:text-red-400">
          View All Activity
        </button>
      </div>
    </section>
  );
}