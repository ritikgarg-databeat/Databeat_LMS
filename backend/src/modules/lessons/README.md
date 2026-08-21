# Lessons Module

Owns lesson metadata/content, nested resources, learner progress mounting, quiz mounting, trainer
scope, publication, ordering, and deletion.

`Lesson.contentVersion` is the learning contract version. Meaningful lesson edits increment it;
resource creation/deletion does the same in the resources module. Learner completion records keep
`completedContentVersion`, so stale completion becomes `IN_PROGRESS`/`hasNewContent` and requires
the current version's quiz before completion can be restored.

Deleting a lesson first records descendant file pointers, deletes the lesson hierarchy from the
database, and then removes those physical uploads. Trainees can read only published lessons inside
published modules/courses assigned through active groups. Staff preview remains available within
their authorized trainer scope.
