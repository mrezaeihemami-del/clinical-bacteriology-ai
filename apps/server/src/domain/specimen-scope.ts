import { SpecimenType } from "@prisma/client";

export const supportedAiSpecimens = new Set<SpecimenType>([
  SpecimenType.URINE,
  SpecimenType.STERILE_SITE,
]);

export function isSupportedAiSpecimen(
  specimenType: SpecimenType,
): boolean {
  return supportedAiSpecimens.has(specimenType);
}
