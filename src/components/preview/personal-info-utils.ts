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

export const PERSONAL_INFO_ICON_OPTIONS: Array<{ value: string; label: string; Icon: LucideIcon }> = [
  { value: 'briefcase', label: 'Briefcase', Icon: Briefcase },
  { value: 'mail', label: 'Mail', Icon: Mail },
  { value: 'phone', label: 'Phone', Icon: Phone },
  { value: 'map-pin', label: 'Location', Icon: MapPin },
  { value: 'globe', label: 'Website', Icon: Globe },
  { value: 'message-circle', label: 'Message', Icon: MessageCircle },
  { value: 'github', label: 'GitHub', Icon: Github },
  { value: 'linkedin', label: 'LinkedIn', Icon: Linkedin },
  { value: 'user', label: 'User', Icon: User },
  { value: 'users', label: 'Users', Icon: Users },
  { value: 'cake', label: 'Age', Icon: Cake },
  { value: 'flag', label: 'Flag', Icon: Flag },
  { value: 'home', label: 'Home', Icon: Home },
  { value: 'heart', label: 'Heart', Icon: Heart },
  { value: 'graduation-cap', label: 'Education', Icon: GraduationCap },
];

const iconByValue = new Map(PERSONAL_INFO_ICON_OPTIONS.map((item) => [item.value, item.Icon]));
const HiddenIcon = (() => null) as unknown as LucideIcon;

function iconFor(personalInfo: PersonalInfoContent, key: string, fallback: LucideIcon) {
  const customIcon = personalInfo.personalInfoIcons?.[key];
  if (customIcon === 'hidden') return HiddenIcon;
  return (customIcon && iconByValue.get(customIcon)) || fallback;
}

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
    { key: 'jobTitle', value: includeJobTitle ? personalInfo.jobTitle : undefined, Icon: iconFor(personalInfo, 'jobTitle', Briefcase) },
    { key: 'age', value: personalInfo.age, Icon: iconFor(personalInfo, 'age', Cake) },
    { key: 'politicalStatus', value: personalInfo.politicalStatus, Icon: iconFor(personalInfo, 'politicalStatus', Flag) },
    { key: 'gender', value: personalInfo.gender, Icon: iconFor(personalInfo, 'gender', User) },
    { key: 'ethnicity', value: personalInfo.ethnicity, Icon: iconFor(personalInfo, 'ethnicity', Users) },
    { key: 'hometown', value: personalInfo.hometown, Icon: iconFor(personalInfo, 'hometown', Home) },
    { key: 'maritalStatus', value: personalInfo.maritalStatus, Icon: iconFor(personalInfo, 'maritalStatus', Heart) },
    { key: 'yearsOfExperience', value: personalInfo.yearsOfExperience, Icon: iconFor(personalInfo, 'yearsOfExperience', Briefcase) },
    { key: 'educationLevel', value: personalInfo.educationLevel, Icon: iconFor(personalInfo, 'educationLevel', GraduationCap) },
    { key: 'email', value: personalInfo.email, Icon: iconFor(personalInfo, 'email', Mail) },
    { key: 'phone', value: personalInfo.phone, Icon: iconFor(personalInfo, 'phone', Phone) },
    { key: 'wechat', value: personalInfo.wechat, Icon: iconFor(personalInfo, 'wechat', MessageCircle) },
    { key: 'location', value: personalInfo.location, Icon: iconFor(personalInfo, 'location', MapPin) },
    { key: 'website', value: personalInfo.website, Icon: iconFor(personalInfo, 'website', Globe) },
    { key: 'linkedin', value: includeLinks ? personalInfo.linkedin : undefined, Icon: iconFor(personalInfo, 'linkedin', Linkedin) },
    { key: 'github', value: includeLinks ? personalInfo.github : undefined, Icon: iconFor(personalInfo, 'github', Github) },
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
