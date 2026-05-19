import type { PersonalInfoContent } from '@/types/resume';
import {
  Briefcase,
  Cake,
  Flag,
  Github,
  Globe,
  GraduationCap,
  Heart,
  Home,
  Linkedin,
  Mail,
  MapPin,
  MessageCircle,
  Phone,
  User,
  Users,
  type LucideIcon,
} from 'lucide-react';

type PersonalInfoItemsOptions = {
  includeJobTitle?: boolean;
  includeLinks?: boolean;
};

export type PersonalInfoPreviewItem = {
  key: string;
  value: string;
  Icon: LucideIcon;
};

function asText(value: string | number | null | undefined) {
  if (value === null || value === undefined) return '';
  return String(value).trim();
}

export function getPersonalInfoPreviewItems(
  personalInfo: PersonalInfoContent,
  options: PersonalInfoItemsOptions = {},
) {
  const { includeJobTitle = false, includeLinks = true } = options;
  const items: Array<Omit<PersonalInfoPreviewItem, 'value'> & { value?: string | number | null }> = [
    { key: 'jobTitle', value: includeJobTitle ? personalInfo.jobTitle : undefined, Icon: Briefcase },
    { key: 'age', value: personalInfo.age, Icon: Cake },
    { key: 'politicalStatus', value: personalInfo.politicalStatus, Icon: Flag },
    { key: 'gender', value: personalInfo.gender, Icon: User },
    { key: 'ethnicity', value: personalInfo.ethnicity, Icon: Users },
    { key: 'hometown', value: personalInfo.hometown, Icon: Home },
    { key: 'maritalStatus', value: personalInfo.maritalStatus, Icon: Heart },
    { key: 'yearsOfExperience', value: personalInfo.yearsOfExperience, Icon: Briefcase },
    { key: 'educationLevel', value: personalInfo.educationLevel, Icon: GraduationCap },
    { key: 'email', value: personalInfo.email, Icon: Mail },
    { key: 'phone', value: personalInfo.phone, Icon: Phone },
    { key: 'wechat', value: personalInfo.wechat, Icon: MessageCircle },
    { key: 'location', value: personalInfo.location, Icon: MapPin },
    { key: 'website', value: personalInfo.website, Icon: Globe },
    { key: 'linkedin', value: includeLinks ? personalInfo.linkedin : undefined, Icon: Linkedin },
    { key: 'github', value: includeLinks ? personalInfo.github : undefined, Icon: Github },
  ];

  return items
    .map((item) => ({ ...item, value: asText(item.value) }))
    .filter((item): item is PersonalInfoPreviewItem => Boolean(item.value));
}

export function getPersonalInfoItems(
  personalInfo: PersonalInfoContent,
  options: PersonalInfoItemsOptions = {},
) {
  return getPersonalInfoPreviewItems(personalInfo, options).map((item) => {
    if (item.key === 'linkedin') return `LinkedIn: ${item.value}`;
    if (item.key === 'github') return `GitHub: ${item.value}`;
    return item.value;
  });
}
