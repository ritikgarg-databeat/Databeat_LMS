# Courses Module

Owns the top-level Course → Module → Lesson hierarchy, publish lifecycle, group assignment,
trainer scoping, duplication, and course deletion.

Published courses form an organization-wide catalogue visible to every Trainer. Trainers can
assign any published course to their own active groups and can duplicate it into an independent
draft, but may change master course/module/lesson/resource content only when they created the
course. Super Admins can manage all master content. Trainer assignment lists/counts are restricted
to the Trainer's own groups. Trainee reads require a published, non-deleted course assigned
through an active group membership, and only published modules/lessons are returned.

`CourseGroupAssignment.isMandatory` is the effective delivery rule. The same course may be
mandatory for one group and optional for another; if a trainee belongs to both, mandatory wins.
`Course.isMandatory` remains only as the default used when a new assignment does not specify a
rule. Changing the default never silently changes existing assignments.

`POST /:id/duplicate` deep-copies modules and lessons into a new unassigned `DRAFT`. Resources are
included by default and can be excluded with `includeResources: false`; file resources receive
independent physical copies so deleting either course cannot break the other. A failed duplicate
cleans up any files already copied.

Course deletion permanently removes the database hierarchy after active descendant resource files
are collected, then removes those files from storage. Storage cleanup failures are
logged with the owning course and path for manual retry.
