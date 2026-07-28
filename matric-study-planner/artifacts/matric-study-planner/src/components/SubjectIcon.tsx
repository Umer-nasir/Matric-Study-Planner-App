import { Landmark } from 'lucide-react';
import { SUBJECT_ICONS } from '@/data/syllabus';

interface SubjectIconProps {
  subject: string;
  className?: string;
}

export function SubjectIcon({ subject, className = '' }: SubjectIconProps) {
  if (subject === 'Pakistan Studies') {
    return (
      <Landmark
        size={18}
        strokeWidth={2.4}
        className={className}
        aria-hidden="true"
      />
    );
  }

  return (
    <span className={`inline-flex items-center justify-center leading-none ${className}`} aria-hidden="true">
      {SUBJECT_ICONS[subject] || '📚'}
    </span>
  );
}
