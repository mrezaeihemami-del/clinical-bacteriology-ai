# Clinical validation plan

Software completion does not establish clinical performance.

Before clinical use:

1. Define intended use and prohibited use.
2. Create a representative, de-identified image dataset.
3. Obtain independent expert ground truth.
4. Freeze provider model, prompt version and response schema.
5. Pre-register metrics and acceptance thresholds.
6. Evaluate image-quality classification separately from growth-pattern
   observation.
7. Measure sensitivity, specificity, predictive values, calibration and
   abstention behaviour.
8. Analyse performance by specimen type, media, camera, lighting and laboratory.
9. Review hallucinations, especially organism identification and CFU claims.
10. Conduct human-factors testing with technologists and microbiologists.
11. Establish model-change, incident, rollback and revalidation procedures.
12. Complete legal, privacy, regulatory and information-security review.

The application deliberately records provider, model, prompt version, schema
version and input-image hash to support later evaluation.
