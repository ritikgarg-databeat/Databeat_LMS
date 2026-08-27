# Databeat LMS Business Feature Guide

This document describes the currently implemented platform in business terms. Technical setup,
deployment, and detailed architecture remain in `README.md`, `DEPLOYMENT.md`, and
`ARCHITECTURE.md`.

## Business value

- One platform for workforce learning, mandatory training, assessments, knowledge support, and
  management reporting.
- AI-assisted explanations and short lesson videos use assigned learning context and reject
  unrelated questions instead of acting as an unrestricted general chatbot.
- Executive and manager views turn learning activity into adoption, completion, capability,
  compliance, and at-risk-employee signals.
- Current-version progress evidence prevents edited training material from retaining stale
  completion status.
- The platform is designed for approximately 3,000 employees, subject to production load testing
  and infrastructure sizing before company-wide rollout.

## Super Admin experience

- Provision trainers, departments, groups, users, courses, and platform settings.
- Review organization-wide Executive Learning Analysis with 7, 30, and 90-day filters.
- View workforce reach, active adoption, learning hours, assessment outcomes, mandatory
  compliance, integrity events, and employees needing attention.
- Export live progress, assessment, group, course, and mandatory-compliance CSV evidence.
- Review immutable audit events and operate maintenance mode.

## Trainer and manager experience

- Author and publish courses, modules, lessons, resources, grounded quizzes, and AI lesson videos.
- Assign content and assessments to owned groups.
- Use Team Performance as a manager view; every KPI and export is restricted to active owned
  groups and assigned courses.
- Send announcements, review attempts, grade subjective answers, respond to Q&A, and inspect
  course/group/employee drill-down analytics.
- Configure allowed trainee AI-video usage through existing settings.

## Trainee experience

- Follow assigned optional or mandatory learning on desktop, tablet, mobile, or installed PWA.
- Mandatory courses enforce ordered lessons, active resource review, sequential video coverage,
  and a current passing quiz before completion.
- Ask lesson-grounded or learning-domain AI questions and choose the answer language.
- Generate short, private lesson explanation videos where enabled.
- Take protected assessments with server-authoritative timing and autosave.
- Review course completion summaries and download a certificate after completing all current
  published lessons.

## Mandatory training and compliance

- Published courses form a reusable organization-wide pool: trainers assign existing learning
  material to their own groups without rebuilding it.
- Shared master content is read-only for non-owners; trainers can duplicate a shared course when
  they need a separately editable version.
- Mandatory/optional is selected independently for every course-to-group assignment. A master
  course may define the default for new assignments without changing existing group delivery.
- Mandatory publication validates readable quiz evidence.
- Learners cannot skip ahead; direct API access uses the same lock rules as the interface.
- Resource completion is versioned, and changed/new content reopens only the required learning
  evidence while requiring a new current-version quiz.
- A worker sends incomplete learners no more than one reminder per course per seven days.
- Compliance export statuses are `COMPLIANT`, `IN_PROGRESS`, and `NOT_STARTED` and use current
  lesson versions.

## Executive impact metrics

The Executive Analysis displays a potential annual LMS saving using a visible benchmark of
₹3,000 per learner/year. This is an estimate, not measured ROI. Use Impact Metrics to record
timing observations and validate productivity claims before presenting them as realized savings.

## Protection boundaries

Browser assessment protection is best-effort. The platform records fullscreen exits, tab hiding,
window blur, screenshot-key attempts, and print attempts; it warns twice and submits on the third
counted violation. A normal web browser cannot prevent external cameras, operating-system capture
tools, virtual machines, or capture hardware. Higher-stakes exams require managed devices or a
secure examination browser.

Certificates are downloadable visual artifacts generated from live completion status. They are
not digitally signed, persisted credentials and do not provide a public verification URL.

The PWA caches only static application assets. Authentication, learner progress, analytics, and
all API data still require a working connection to the backend.
