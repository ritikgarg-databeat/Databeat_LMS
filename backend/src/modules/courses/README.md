# Courses Module

Owns the top-level Course → Module → Lesson hierarchy, publish lifecycle, group assignment,
trainer scoping, duplication, and course deletion.

Trainers can manage courses they created or courses assigned to their active groups; Super Admins
have organization-wide access. Trainee reads require a published, non-deleted course assigned
through an active group membership, and only published modules/lessons are returned.

`POST /:id/duplicate` deep-copies modules and lessons into a new unassigned `DRAFT`. Resources are
included by default and can be excluded with `includeResources: false`; file resources receive
independent physical copies so deleting either course cannot break the other. A failed duplicate
cleans up any files already copied.

Course deletion is a database soft delete for history, but active descendant resource files are
collected first and removed from storage after the database update. Storage cleanup failures are
logged with the owning course and path for manual retry.
