# Redline HQ Project Guide
Version: 1.0
Status: Approved
Last Updated: July 29, 2026

---

# Purpose

This document defines the official architecture of Redline HQ.

Its purpose is to ensure the project remains organized, scalable, and easy to maintain.

If future work conflicts with this document, update this document first before changing the architecture.

---

# Project Philosophy

Redline HQ is a firefighter operations platform.

The software should always prioritize:

- Simplicity
- Speed
- Professional appearance
- Real firefighter workflows
- Minimal clicks
- Mobile-first thinking
- Scalability for departments of every size

---

# Project Structure

There are two separate projects inside this workspace.

## 1. Bible

Purpose:

Business planning.

Contains:

- Vision
- Discovery interviews
- Product ideas
- Roadmaps
- Company information
- Customer feedback
- Meeting notes

No application code belongs here.

---

## 2. redline-hq

Purpose:

The actual software.

Everything that runs belongs here.

---

# Official Folder Structure

app/

Application pages and routing.

---

components/

Reusable UI components.

---

lib/

Shared data, helpers, utilities and database access.

---

public/

Images, logos and static assets.

---

supabase/

Database migrations and Supabase configuration.

---

docs/

Technical documentation.

---

# Official Layout

Official Application Layout:

components/layout/PageLayout.tsx

Only one application layout should exist.

---

# Official Sidebar

components/command-center-v3/Sidebar.tsx

(Current official version)

Future versions improve this file.

Do not create duplicate sidebars.

---

# Official Header

components/command-center-v3/Header.tsx

(Current official version)

Future versions improve this file.

Do not create duplicate headers.

---

# Official Command Center

components/command-center-v3/

This is the official dashboard.

Future improvements happen here.

Do not create command-center-v4.

When Version 3 is complete it will simply become:

components/command-center/

---

# Official Design Documents

All UI decisions belong inside:

docs/design-system/

Each major panel should have its own specification document.

---

# Official Images

Department photos:

public/departments/

Brand assets:

public/branding/

General UI graphics:

public/images/

---

# Official Naming

The platform is:

Redline HQ

The customer is:

A Fire Department

Example:

Elliott Fire Department

Never hardcode a department name unless intentionally creating demo data.

---

# Official Terminology

Use firefighter terminology whenever possible.

Preferred terms:

Inventory

Apparatus

Personnel

Training

Readiness

Deficiencies

Maintenance

Avoid replacing firefighter terminology with generic software terminology.

---

# Development Rules

Before modifying code:

1. Inspect the existing file.

2. Understand the current implementation.

3. Make the smallest reasonable change.

4. Test.

5. Commit.

Never create duplicate components because it is easier than improving the existing one.

---

# Architecture Rule

There should only ever be ONE official version of:

Header

Sidebar

Layout

Command Center

Navigation

If replacements are ever required, replace the existing component rather than creating permanent duplicates.

---

# MVP Goal

The current objective is NOT to build every feature.

The objective is to successfully onboard Elliott Fire Department for pilot testing.

Every development decision should support that goal.

---

# Long-Term Vision

Build the best firefighter operations platform available.

Every design decision should answer one question:

"Does this make life easier for firefighters?"
# Official Layout Components

Shared application layout components live in:

components/layout/

Official files:

- PageLayout.tsx
- Sidebar.tsx
- TopBar.tsx

These components provide the application shell used throughout Redline HQ.