# Apparatus Panel Specification

## File

components/command-center-v3/ApparatusPanel.tsx

---

# Purpose

Displays the operational status of every apparatus in the department.

This panel should immediately identify which units are available, out of service, or require attention.

---

# Height

100%

---

# Border Radius

20px

---

# Padding

24px

---

# Background

#111111

Thin border

rgba(255,255,255,.08)

---

# Header

APPARATUS STATUS

14px

Uppercase

Letter spacing

1px

Color

#A1A1AA

Right Side

VIEW ALL →

---

# Layout

Vertical list of apparatus cards.

Gap

16px

---

# Apparatus Card

Height

88px

Rounded

16px

Dark background

Thin border

Horizontal layout

---

# Left Section

Apparatus photo

96px × 64px

Rounded corners

object-fit: cover

---

# Center Section

Apparatus Name

Example

Engine 430

Font

20px

Bold

White

Below

Unit Type

Last Inspection

Assigned Station

---

# Right Section

Large status badge

AVAILABLE

OUT OF SERVICE

IN MAINTENANCE

RESPONDING

Badge Colors

Available

#10B981

Responding

#3B82F6

Maintenance

#F59E0B

Out of Service

#EF2B2D

---

# Footer

Display

10 Apparatus

9 Ready

1 Out of Service

---

# Visual Style

Professional

Minimal

Enterprise software

Matches the approved Redline HQ Command Center mockup.

This should be one of the most important operational panels in the application.