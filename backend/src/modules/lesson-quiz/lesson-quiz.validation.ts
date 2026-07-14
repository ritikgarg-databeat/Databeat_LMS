import { body } from 'express-validator';

export const lessonQuizValidation = {
  submit: [
    body('answers').isArray({ min: 1 }).withMessage('answers must be a non-empty array.'),
    body('answers.*.questionId').isString().notEmpty().withMessage('answers[].questionId is required.'),
    body('answers.*.selectedOptionId').isString().notEmpty().withMessage('answers[].selectedOptionId is required.'),
  ],
};
