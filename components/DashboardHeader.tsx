export default function DashboardHeader() {
  const today = new Date().toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });

  return (
    <header className="bg-red-700 text-white rounded-xl p-6 shadow-lg">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-4xl font-bold">🚒 Redline HQ</h1>
          <p className="text-red-100 mt-1">
            Elliott Volunteer Fire Department
          </p>
        </div>

        <div className="text-right">
          <p className="text-red-100 text-sm">Today's Mission</p>
          <h2 className="text-xl font-semibold">
            Stay Ready.
          </h2>
          <p className="text-red-200 text-sm mt-2">
            {today}
          </p>
        </div>
      </div>
    </header>
  );
}