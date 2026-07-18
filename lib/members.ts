import { Member } from "./types";

export const members: Member[] = [
  {
    id: "1",
    firstName: "Adam",
    lastName: "Smith",
    rank: "Firefighter",
    email: "adam@example.com",
    phone: "(555) 555-1001",

    qualifications: [
      {
        id: "ff1",
        name: "Firefighter I",
        earnedDate: "2018-05-15",
      },
      {
        id: "hazmat-ops",
        name: "HazMat Operations",
        earnedDate: "2018-06-20",
      },
    ],

    certifications: [
      {
        id: "cpr",
        name: "CPR",
        earnedDate: "2025-03-15",
        expires: true,
        expirationDate: "2027-03-15",
        renewalPeriodMonths: 24,
        issuingAgency: "American Heart Association",
      },
      {
        id: "mask-fit",
        name: "Annual Mask Fit Test",
        earnedDate: "2026-01-10",
        expires: true,
        expirationDate: "2027-01-10",
        renewalPeriodMonths: 12,
      },
    ],

    apparatusAssignments: ["Engine 430"],

    active: true,
  },

  {
    id: "2",
    firstName: "John",
    lastName: "Doe",
    rank: "Captain",
    email: "john@example.com",
    phone: "(555) 555-1002",

    qualifications: [
      {
        id: "ff2",
        name: "Firefighter II",
        earnedDate: "2014-04-01",
      },
      {
        id: "officer1",
        name: "Officer I",
        earnedDate: "2017-09-12",
      },
    ],

    certifications: [
      {
        id: "emt",
        name: "EMT",
        earnedDate: "2025-08-01",
        expires: true,
        expirationDate: "2027-08-31",
        renewalPeriodMonths: 24,
      },
      {
        id: "cpr",
        name: "CPR",
        earnedDate: "2026-02-05",
        expires: true,
        expirationDate: "2028-02-05",
        renewalPeriodMonths: 24,
      },
    ],

    apparatusAssignments: ["Engine 432"],

    active: true,
  },

  {
    id: "3",
    firstName: "Jane",
    lastName: "Johnson",
    rank: "Lieutenant",
    email: "jane@example.com",
    phone: "(555) 555-1003",

    qualifications: [
      {
        id: "ff2",
        name: "Firefighter II",
        earnedDate: "2016-07-11",
      },
      {
        id: "driver",
        name: "Driver/Operator",
        earnedDate: "2018-10-20",
      },
    ],

    certifications: [
      {
        id: "cpr",
        name: "CPR",
        earnedDate: "2025-04-12",
        expires: true,
        expirationDate: "2027-04-12",
        renewalPeriodMonths: 24,
      },
    ],

    apparatusAssignments: ["Tanker 445"],

    active: true,
  },
];