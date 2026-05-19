import type { PersonalInfoContent } from '@/types/resume';

type PersonalInfoItemsOptions = {
  includeJobTitle?: boolean;
  includeLinks?: boolean;
};

function asText(value: string | number | null | undefined) {
  if (value === null || value === undefined) return '';
  return String(value).trim();
}

export function getPersonalInfoItems(
  personalInfo: PersonalInfoContent,
  options: PersonalInfoItemsOptions = {},
) {
  const { includeJobTitle = false, includeLinks = true } = options;
  const items = [
    includeJobTitle ? personalInfo.jobTitle : undefined,
    personalInfo.age,
    personalInfo.politicalStatus,
    personalInfo.gender,
    personalInfo.ethnicity,
    personalInfo.hometown,
    personalInfo.maritalStatus,
    personalInfo.yearsOfExperience,
    personalInfo.educationLevel,
    personalInfo.email,
    personalInfo.phone,
    personalInfo.wechat,
    personalInfo.location,
    personalInfo.website,
    includeLinks && personalInfo.linkedin ? `LinkedIn: ${personalInfo.linkedin}` : undefined,
    includeLinks && personalInfo.github ? `GitHub: ${personalInfo.github}` : undefined,
  ];

  return items.map(asText).filter(Boolean);
}
