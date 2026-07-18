import { Department } from "./types";

export const department: Department = {
  id: "elliott-fire-and-rescue-association",

  name: "Elliott Fire and Rescue Association",

  type: "volunteer",

  state: "Iowa",

  timezone: "America/Chicago",

  settings: {
    defaultApparatusCheckFrequency: "monthly",

    autoGenerateTasks: true,

    allowManualTasks: true,

    allowTaskAssignments: true,

    allowAnyoneToCompleteAssignedTasks: true,

    certificationWarningDays: 30,
  },
};