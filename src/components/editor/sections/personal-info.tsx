'use client';

import { useRef } from 'react';
import { useTranslations } from 'next-intl';
import {
  Briefcase,
  Cake,
  Camera,
  Circle,
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
  RectangleVertical,
  User,
  Users,
  X,
  EyeOff,
  type LucideIcon,
} from 'lucide-react';
import { EditableText } from '../fields/editable-text';
import { FieldWrapper } from '../fields/field-wrapper';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useResumeStore } from '@/stores/resume-store';
import { PERSONAL_INFO_ICON_OPTIONS } from '@/components/preview/personal-info-utils';
import type { ResumeSection, PersonalInfoContent } from '@/types/resume';

interface Props {
  section: ResumeSection;
  onUpdate: (content: Partial<PersonalInfoContent>) => void;
}

function resizeImage(file: File, maxSize: number): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let { width, height } = img;
        if (width > height) {
          if (width > maxSize) {
            height = Math.round((height * maxSize) / width);
            width = maxSize;
          }
        } else {
          if (height > maxSize) {
            width = Math.round((width * maxSize) / height);
            height = maxSize;
          }
        }
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d')!;
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', 0.85));
      };
      img.onerror = reject;
      img.src = e.target?.result as string;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function IconPicker({
  fieldKey,
  selected,
  fallbackIcon: FallbackIcon,
  defaultLabel,
  hiddenLabel,
  onChange,
}: {
  fieldKey: string;
  selected?: string;
  fallbackIcon: LucideIcon;
  defaultLabel: string;
  hiddenLabel: string;
  onChange: (key: string, icon: string) => void;
}) {
  const SelectedIcon = selected === 'hidden'
    ? EyeOff
    : PERSONAL_INFO_ICON_OPTIONS.find((item) => item.value === selected)?.Icon || FallbackIcon;
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="absolute left-2 top-1/2 z-10 flex h-5 w-5 -translate-y-1/2 cursor-pointer items-center justify-center rounded text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-brand dark:hover:bg-zinc-800"
          aria-label={defaultLabel}
        >
          <SelectedIcon className="h-3.5 w-3.5" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-64 p-2">
        <div className="grid grid-cols-5 gap-1">
          <button
            type="button"
            className="flex h-9 cursor-pointer items-center justify-center rounded-md border border-dashed border-zinc-200 text-xs text-zinc-400 hover:border-brand hover:text-brand dark:border-zinc-700"
            onClick={() => onChange(fieldKey, '')}
            title={defaultLabel}
          >
            {defaultLabel}
          </button>
          <button
            type="button"
            className={`flex h-9 cursor-pointer items-center justify-center rounded-md border text-xs transition-colors ${
              selected === 'hidden'
                ? 'border-brand bg-brand-muted text-brand'
                : 'border-transparent text-zinc-500 hover:border-zinc-200 hover:bg-zinc-50 dark:text-zinc-300 dark:hover:border-zinc-700 dark:hover:bg-zinc-800'
            }`}
            onClick={() => onChange(fieldKey, 'hidden')}
            title={hiddenLabel}
          >
            {hiddenLabel}
          </button>
          {PERSONAL_INFO_ICON_OPTIONS.map(({ value, label, Icon }) => (
            <button
              key={value}
              type="button"
              className={`flex h-9 cursor-pointer items-center justify-center rounded-md border transition-colors ${
                selected === value
                  ? 'border-brand bg-brand-muted text-brand'
                  : 'border-transparent text-zinc-500 hover:border-zinc-200 hover:bg-zinc-50 dark:text-zinc-300 dark:hover:border-zinc-700 dark:hover:bg-zinc-800'
              }`}
              onClick={() => onChange(fieldKey, value)}
              title={label}
            >
              <Icon className="h-4 w-4" />
            </button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}

function IconTextField({
  label,
  value,
  onChange,
  type,
  fieldKey,
  selectedIcon,
  fallbackIcon,
  defaultIconLabel,
  hiddenIconLabel,
  onIconChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  fieldKey: string;
  selectedIcon?: string;
  fallbackIcon: LucideIcon;
  defaultIconLabel: string;
  hiddenIconLabel: string;
  onIconChange: (key: string, icon: string) => void;
}) {
  return (
    <div className="space-y-1">
      <label className="text-xs font-medium text-zinc-500 dark:text-zinc-400">{label}</label>
      <div className="relative">
        <IconPicker
          fieldKey={fieldKey}
          selected={selectedIcon}
          fallbackIcon={fallbackIcon}
          defaultLabel={defaultIconLabel}
          hiddenLabel={hiddenIconLabel}
          onChange={onIconChange}
        />
        <Input
          type={type || 'text'}
          value={value || ''}
          onChange={(event) => onChange(event.target.value)}
          placeholder={label}
          className="h-8 pl-8 text-sm"
        />
      </div>
    </div>
  );
}

function IconSelectField({
  label,
  value,
  onChange,
  options,
  fieldKey,
  selectedIcon,
  fallbackIcon,
  defaultIconLabel,
  hiddenIconLabel,
  onIconChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: { label: string; value: string }[];
  fieldKey: string;
  selectedIcon?: string;
  fallbackIcon: LucideIcon;
  defaultIconLabel: string;
  hiddenIconLabel: string;
  onIconChange: (key: string, icon: string) => void;
}) {
  return (
    <div className="space-y-1">
      <label className="text-xs font-medium text-zinc-500 dark:text-zinc-400">{label}</label>
      <div className="relative">
        <IconPicker
          fieldKey={fieldKey}
          selected={selectedIcon}
          fallbackIcon={fallbackIcon}
          defaultLabel={defaultIconLabel}
          hiddenLabel={hiddenIconLabel}
          onChange={onIconChange}
        />
        <Select value={value || ''} onValueChange={onChange}>
          <SelectTrigger size="sm" className="w-full pl-8 text-sm">
            <SelectValue placeholder={label} />
          </SelectTrigger>
          <SelectContent>
            {options.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {value && (
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              onChange('');
            }}
            aria-label={label}
            className="absolute right-7 top-1/2 flex h-5 w-5 -translate-y-1/2 items-center justify-center rounded text-zinc-400 transition-colors hover:text-zinc-600 dark:hover:text-zinc-300"
          >
            <X className="h-3 w-3" />
          </button>
        )}
      </div>
    </div>
  );
}

export function PersonalInfoSection({ section, onUpdate }: Props) {
  const t = useTranslations('editor.fields');
  const tTheme = useTranslations('themeEditor');
  const content = section.content as PersonalInfoContent;
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { currentResume } = useResumeStore();
  const avatarStyle = currentResume?.themeConfig?.avatarStyle || 'oneInch';
  const defaultIconLabel = t('defaultIcon');
  const hiddenIconLabel = t('hideIcon');

  const updateFieldIcon = (key: string, icon: string) => {
    onUpdate({
      personalInfoIcons: {
        ...(content.personalInfoIcons || {}),
        [key]: icon,
      },
    });
  };

  const updateAvatarStyle = (style: 'circle' | 'oneInch') => {
    if (!currentResume) return;
    const newConfig = { ...currentResume.themeConfig, avatarStyle: style };
    useResumeStore.setState((state) => ({
      currentResume: state.currentResume
        ? { ...state.currentResume, themeConfig: newConfig }
        : null,
      isDirty: true,
    }));
    useResumeStore.getState()._scheduleSave();
  };

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const dataUrl = await resizeImage(file, 200);
    onUpdate({ avatar: dataUrl });
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <div className="space-y-3">
      {/* Avatar upload + style toggle */}
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="relative flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-full border-2 border-dashed border-zinc-300 bg-zinc-50 transition-colors hover:border-zinc-400 hover:bg-zinc-100 dark:border-zinc-600 dark:bg-zinc-800 dark:hover:border-zinc-500 dark:hover:bg-zinc-700"
        >
          {content.avatar ? (
            <img src={content.avatar} alt="Avatar" className="h-full w-full object-cover" />
          ) : (
            <Camera className="h-6 w-6 text-zinc-400" />
          )}
        </button>
        <div className="flex flex-col gap-2">
          {/* Segmented shape toggle */}
          <div className="inline-flex rounded-lg bg-zinc-100 p-0.5 dark:bg-zinc-800">
            {([
              { value: 'circle' as const, icon: Circle, label: tTheme('avatarCircle') },
              { value: 'oneInch' as const, icon: RectangleVertical, label: tTheme('avatarOneInch') },
            ]).map(({ value, icon: Icon, label }) => (
              <button
                key={value}
                type="button"
                onClick={() => updateAvatarStyle(value)}
                className={`inline-flex cursor-pointer items-center gap-1.5 rounded-md px-2.5 py-1 text-xs transition-all duration-200 ${
                  avatarStyle === value
                    ? 'bg-white font-medium text-zinc-900 shadow-sm dark:bg-zinc-700 dark:text-zinc-100'
                    : 'text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200'
                }`}
              >
                <Icon className="h-3 w-3" />
                {label}
              </button>
            ))}
          </div>
          {/* Remove avatar */}
          {content.avatar && (
            <button
              type="button"
              onClick={() => onUpdate({ avatar: '' })}
              className="inline-flex w-fit cursor-pointer items-center gap-1 rounded-md px-2 py-0.5 text-[11px] text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-zinc-600 dark:hover:bg-zinc-800 dark:hover:text-zinc-300"
            >
              <X className="h-3 w-3" />
              {t('clear')}
            </button>
          )}
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handleAvatarChange}
          className="hidden"
        />
      </div>

      <FieldWrapper>
        <EditableText label={t('fullName')} value={content.fullName} onChange={(v) => onUpdate({ fullName: v })} />
        <IconTextField
          label={t('jobTitle')}
          value={content.jobTitle}
          onChange={(v) => onUpdate({ jobTitle: v })}
          fieldKey="jobTitle"
          selectedIcon={content.personalInfoIcons?.jobTitle}
          fallbackIcon={Briefcase}
          defaultIconLabel={defaultIconLabel}
          hiddenIconLabel={hiddenIconLabel}
          onIconChange={updateFieldIcon}
        />
      </FieldWrapper>
      <FieldWrapper>
        <IconTextField
          label={t('age')}
          value={content.age || ''}
          onChange={(v) => onUpdate({ age: v })}
          fieldKey="age"
          selectedIcon={content.personalInfoIcons?.age}
          fallbackIcon={Cake}
          defaultIconLabel={defaultIconLabel}
          hiddenIconLabel={hiddenIconLabel}
          onIconChange={updateFieldIcon}
        />
        <IconSelectField
          label={t('gender')}
          value={content.gender || ''}
          onChange={(v) => onUpdate({ gender: v })}
          options={t('genderOptions').split(',').map((s) => ({ label: s, value: s }))}
          fieldKey="gender"
          selectedIcon={content.personalInfoIcons?.gender}
          fallbackIcon={User}
          defaultIconLabel={defaultIconLabel}
          hiddenIconLabel={hiddenIconLabel}
          onIconChange={updateFieldIcon}
        />
      </FieldWrapper>
      <FieldWrapper>
        <IconSelectField
          label={t('politicalStatus')}
          value={content.politicalStatus || ''}
          onChange={(v) => onUpdate({ politicalStatus: v })}
          options={t('politicalStatusOptions').split(',').map((s) => ({ label: s, value: s }))}
          fieldKey="politicalStatus"
          selectedIcon={content.personalInfoIcons?.politicalStatus}
          fallbackIcon={Flag}
          defaultIconLabel={defaultIconLabel}
          hiddenIconLabel={hiddenIconLabel}
          onIconChange={updateFieldIcon}
        />
        <IconSelectField
          label={t('ethnicity')}
          value={content.ethnicity || ''}
          onChange={(v) => onUpdate({ ethnicity: v })}
          options={t('ethnicityOptions').split(',').map((s) => ({ label: s, value: s }))}
          fieldKey="ethnicity"
          selectedIcon={content.personalInfoIcons?.ethnicity}
          fallbackIcon={Users}
          defaultIconLabel={defaultIconLabel}
          hiddenIconLabel={hiddenIconLabel}
          onIconChange={updateFieldIcon}
        />
      </FieldWrapper>
      <FieldWrapper>
        <IconTextField
          label={t('hometown')}
          value={content.hometown || ''}
          onChange={(v) => onUpdate({ hometown: v })}
          fieldKey="hometown"
          selectedIcon={content.personalInfoIcons?.hometown}
          fallbackIcon={Home}
          defaultIconLabel={defaultIconLabel}
          hiddenIconLabel={hiddenIconLabel}
          onIconChange={updateFieldIcon}
        />
        <IconSelectField
          label={t('maritalStatus')}
          value={content.maritalStatus || ''}
          onChange={(v) => onUpdate({ maritalStatus: v })}
          options={t('maritalStatusOptions').split(',').map((s) => ({ label: s, value: s }))}
          fieldKey="maritalStatus"
          selectedIcon={content.personalInfoIcons?.maritalStatus}
          fallbackIcon={Heart}
          defaultIconLabel={defaultIconLabel}
          hiddenIconLabel={hiddenIconLabel}
          onIconChange={updateFieldIcon}
        />
      </FieldWrapper>
      <FieldWrapper>
        <IconTextField
          label={t('yearsOfExperience')}
          value={content.yearsOfExperience || ''}
          onChange={(v) => onUpdate({ yearsOfExperience: v })}
          fieldKey="yearsOfExperience"
          selectedIcon={content.personalInfoIcons?.yearsOfExperience}
          fallbackIcon={Briefcase}
          defaultIconLabel={defaultIconLabel}
          hiddenIconLabel={hiddenIconLabel}
          onIconChange={updateFieldIcon}
        />
        <IconSelectField
          label={t('educationLevel')}
          value={content.educationLevel || ''}
          onChange={(v) => onUpdate({ educationLevel: v })}
          options={t('educationLevelOptions').split(',').map((s) => ({ label: s, value: s }))}
          fieldKey="educationLevel"
          selectedIcon={content.personalInfoIcons?.educationLevel}
          fallbackIcon={GraduationCap}
          defaultIconLabel={defaultIconLabel}
          hiddenIconLabel={hiddenIconLabel}
          onIconChange={updateFieldIcon}
        />
      </FieldWrapper>
      <FieldWrapper>
        <IconTextField
          label={t('email')}
          value={content.email}
          onChange={(v) => onUpdate({ email: v })}
          type="email"
          fieldKey="email"
          selectedIcon={content.personalInfoIcons?.email}
          fallbackIcon={Mail}
          defaultIconLabel={defaultIconLabel}
          hiddenIconLabel={hiddenIconLabel}
          onIconChange={updateFieldIcon}
        />
        <IconTextField
          label={t('phone')}
          value={content.phone}
          onChange={(v) => onUpdate({ phone: v })}
          type="tel"
          fieldKey="phone"
          selectedIcon={content.personalInfoIcons?.phone}
          fallbackIcon={Phone}
          defaultIconLabel={defaultIconLabel}
          hiddenIconLabel={hiddenIconLabel}
          onIconChange={updateFieldIcon}
        />
      </FieldWrapper>
      <FieldWrapper>
        <IconTextField
          label={t('wechat')}
          value={content.wechat || ''}
          onChange={(v) => onUpdate({ wechat: v })}
          fieldKey="wechat"
          selectedIcon={content.personalInfoIcons?.wechat}
          fallbackIcon={MessageCircle}
          defaultIconLabel={defaultIconLabel}
          hiddenIconLabel={hiddenIconLabel}
          onIconChange={updateFieldIcon}
        />
        <IconTextField
          label={t('location')}
          value={content.location}
          onChange={(v) => onUpdate({ location: v })}
          fieldKey="location"
          selectedIcon={content.personalInfoIcons?.location}
          fallbackIcon={MapPin}
          defaultIconLabel={defaultIconLabel}
          hiddenIconLabel={hiddenIconLabel}
          onIconChange={updateFieldIcon}
        />
      </FieldWrapper>
      <FieldWrapper>
        <IconTextField
          label={t('website')}
          value={content.website || ''}
          onChange={(v) => onUpdate({ website: v })}
          fieldKey="website"
          selectedIcon={content.personalInfoIcons?.website}
          fallbackIcon={Globe}
          defaultIconLabel={defaultIconLabel}
          hiddenIconLabel={hiddenIconLabel}
          onIconChange={updateFieldIcon}
        />
        <IconTextField
          label="LinkedIn"
          value={content.linkedin || ''}
          onChange={(v) => onUpdate({ linkedin: v })}
          fieldKey="linkedin"
          selectedIcon={content.personalInfoIcons?.linkedin}
          fallbackIcon={Linkedin}
          defaultIconLabel={defaultIconLabel}
          hiddenIconLabel={hiddenIconLabel}
          onIconChange={updateFieldIcon}
        />
      </FieldWrapper>
      <FieldWrapper>
        <IconTextField
          label="GitHub"
          value={content.github || ''}
          onChange={(v) => onUpdate({ github: v })}
          fieldKey="github"
          selectedIcon={content.personalInfoIcons?.github}
          fallbackIcon={Github}
          defaultIconLabel={defaultIconLabel}
          hiddenIconLabel={hiddenIconLabel}
          onIconChange={updateFieldIcon}
        />
      </FieldWrapper>
    </div>
  );
}
