# CBAI v7

Version: 2.0.3-v7

Observed defect fixed:

- Case creation returned only `Request validation failed` when `caseCode`
  contained fewer than three characters.
- The create form now validates and trims the case code before submission.
- The API now returns the first invalid field and its specific validation message.
- A regression integration test covers a two-character case code.
