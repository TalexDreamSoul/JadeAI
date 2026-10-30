import { describe, expect, it } from 'vitest';
import { TEMPLATES } from '@/lib/constants';
import { RESUME_TEMPLATE_COMPONENTS } from './template-registry';

describe('resume template registry', () => {
  it('provides one lazy component for every supported template', () => {
    expect(Object.keys(RESUME_TEMPLATE_COMPONENTS)).toEqual([...TEMPLATES]);
  });
});
