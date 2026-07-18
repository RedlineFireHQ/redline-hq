export interface Qualification {
  id: string;
  name: string;
  earnedDate?: string;
}

export interface Certification {
  id: string;
  name: string;
  earnedDate: string;
  expires: boolean;
  expirationDate?: string;
  renewalPeriodMonths?: number;
  issuingAgency?: string;
  certificateNumber?: string;
}

export type DepartmentType =
  | "volunteer"
  | "combination"
  | "career";

export type ApparatusCheckFrequency =
  | "daily"
  | "weekly"
  | "monthly"
  | "every-shift"
  | "custom";

export interface DepartmentSettings {
  defaultApparatusCheckFrequency: ApparatusCheckFrequency;

  autoGenerateTasks: boolean;

  allowManualTasks: boolean;

  allowTaskAssignments: boolean;

  allowAnyoneToCompleteAssignedTasks: boolean;

  certificationWarningDays: number;
}

export interface Department {
  id: string;

  name: string;

  type: DepartmentType;

  state: string;

  timezone: string;

  settings: DepartmentSettings;
}

export type ApparatusType =
  | "engine"
  | "tanker"
  | "brush"
  | "rescue"
  | "ambulance"
  | "chief"
  | "utility"
  | "other";

export interface Apparatus {
  id: string;

  name: string;

  type: ApparatusType;

  inService: boolean;

  checkFrequency?: ApparatusCheckFrequency;
}

export type TaskCategory =
  | "apparatus"
  | "training"
  | "certification"
  | "maintenance"
  | "department";

export type TaskStatus =
  | "pending"
  | "completed"
  | "overdue";

export type TaskFrequency =
  | "once"
  | "daily"
  | "weekly"
  | "monthly"
  | "quarterly"
  | "annually";

export interface Task {
  id: string;

  title: string;

  category: TaskCategory;

  frequency: TaskFrequency;

  status: TaskStatus;

  dueDate?: string;

  assignedMemberId?: string;

  assignedApparatus?: string;
}

export interface Member {
  id: string;

  firstName: string;

  lastName: string;

  rank: string;

  email: string;

  phone: string;

  qualifications: Qualification[];

  certifications: Certification[];

  apparatusAssignments: string[];

  active: boolean;
}