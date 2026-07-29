export interface Task {
  id: string;
  title: string;
  apparatusId?: string;
  status: "pending" | "completed" | "overdue";
  priority: "low" | "medium" | "high";
  due: string;
}

export const tasks: Task[] = [
  {
    id: "1",
    title: "Complete Monthly Apparatus Check",
    apparatusId: "engine-430",
    status: "pending",
    priority: "high",
    due: "Today",
  },
  {
    id: "2",
    title: "Verify Fuel Level",
    apparatusId: "engine-430",
    status: "completed",
    priority: "medium",
    due: "Today",
  },
  {
    id: "3",
    title: "Inspect Battery Charger",
    apparatusId: "engine-430",
    status: "overdue",
    priority: "high",
    due: "Yesterday",
  },
  {
    id: "4",
    title: "Inspect Booster Line",
    apparatusId: "engine-432",
    status: "pending",
    priority: "medium",
    due: "Tomorrow",
  },
  {
    id: "5",
    title: "Inventory Medical Bag",
    apparatusId: "tanker-445",
    status: "completed",
    priority: "low",
    due: "Friday",
  },
];