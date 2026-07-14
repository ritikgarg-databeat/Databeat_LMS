# Questions Module

Flat, top-level question bank (Prompt 6) — reusable questions independent of any specific
assessment. Trainer/Super-Admin manage everything; Trainees have no access to this module at
all (they only ever see assessment content through the attempts flow). An assessment references
a bank question via a separate `AssessmentQuestion` snapshot (owned by the assessments module),
so deleting or editing a bank question never changes an assessment that already added it.

Layering: `questions.routes.ts` → `questions.controller.ts` → `questions.service.ts` →
`questions.repository.ts` (see ARCHITECTURE.md §3.1). `questions.dto.ts` defines request/response
shapes, `questions.types.ts` defines internal domain shapes, `questions.interfaces.ts` defines
the contracts controllers/services depend on, and `questions.validation.ts` holds the
express-validator chains for this module's routes.

`QuestionsRepository.findByIdWithOptions(id)` is a stable cross-module contract consumed
directly by the assessments module to snapshot a bank question's current content — keep its
name/signature/return shape stable.
