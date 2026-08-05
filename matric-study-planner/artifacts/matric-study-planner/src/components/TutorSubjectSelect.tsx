import { BookOpen, Sparkles } from "lucide-react";
import { SubjectIcon } from "@/components/SubjectIcon";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { subjectDisplayName } from "@/lib/subjectLanguage";

interface TutorSubjectSelectProps {
  value: string;
  options: string[];
  profileSubjects?: readonly string[];
  isClassifying: boolean;
  onValueChange: (subject: string) => void;
}

function SubjectOption({ subject }: { subject: string }) {
  const isGeneral = subject === "General";

  return (
    <SelectItem
      value={subject}
      className="min-h-12 rounded-xl py-2 pl-2 pr-9 font-semibold data-[state=checked]:bg-primary/10 data-[state=checked]:text-primary"
    >
      <span className="flex items-center gap-3">
        <span
          className={`flex h-9 w-9 items-center justify-center rounded-xl text-lg ${
            isGeneral ? "bg-primary/10 text-primary" : "bg-secondary"
          }`}
        >
          {isGeneral ? (
            <Sparkles size={17} />
          ) : (
            <SubjectIcon subject={subject} />
          )}
        </span>
        <span>{isGeneral ? "General" : subjectDisplayName(subject)}</span>
      </span>
    </SelectItem>
  );
}

export function TutorSubjectSelect({
  value,
  options,
  profileSubjects = [],
  isClassifying,
  onValueChange,
}: TutorSubjectSelectProps) {
  const selectedProfileSubjects = options.filter(
    (subject) => subject !== "General" && profileSubjects.includes(subject),
  );
  const additionalSubjects = options.filter(
    (subject) =>
      subject !== "General" && !selectedProfileSubjects.includes(subject),
  );

  return (
    <div className="mt-4 flex items-center justify-between gap-3">
      <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground">
        <BookOpen size={14} />
        <span>Ask about</span>
        {isClassifying && (
          <span
            className="inline-flex items-center gap-1 text-primary"
            aria-live="polite"
          >
            <Sparkles size={11} className="animate-pulse" /> AI choosing
          </span>
        )}
      </div>

      <Select
        value={value}
        disabled={isClassifying}
        onValueChange={onValueChange}
      >
        <SelectTrigger
          className="h-12 w-[min(58vw,220px)] rounded-2xl border-primary/25 bg-background/90 px-3 text-sm font-bold text-foreground shadow-[0_8px_24px_rgba(91,75,231,0.10)] transition-all hover:border-primary/45 hover:bg-background focus:ring-2 focus:ring-primary/25 data-[state=open]:border-primary data-[state=open]:ring-4 data-[state=open]:ring-primary/10 disabled:cursor-wait disabled:opacity-70"
          aria-label="Select tutor subject"
        >
          <div className="flex min-w-0 items-center gap-2.5">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
              {value === "General" ? (
                <Sparkles size={16} />
              ) : (
                <SubjectIcon subject={value} className="text-base" />
              )}
            </span>
            <SelectValue>
              {value === "General" ? "General" : subjectDisplayName(value)}
            </SelectValue>
          </div>
        </SelectTrigger>

        <SelectContent
          position="popper"
          align="end"
          sideOffset={8}
          className="z-[100] max-h-[min(62dvh,430px)] w-[min(88vw,270px)] rounded-[1.35rem] border border-white/80 bg-card/95 p-1.5 shadow-[0_24px_70px_rgba(38,32,78,0.22)] backdrop-blur-xl"
        >
          <SubjectOption subject="General" />

          {selectedProfileSubjects.length > 0 && (
            <>
              <SelectSeparator className="my-1.5 bg-border/70" />
              <SelectGroup>
                <SelectLabel className="px-3 pb-1 pt-2 text-[10px] font-extrabold uppercase tracking-[0.14em] text-muted-foreground">
                  Your subjects
                </SelectLabel>
                {selectedProfileSubjects.map((subject) => (
                  <SubjectOption key={subject} subject={subject} />
                ))}
              </SelectGroup>
            </>
          )}

          {additionalSubjects.length > 0 && (
            <>
              <SelectSeparator className="my-1.5 bg-border/70" />
              <SelectGroup>
                <SelectLabel className="px-3 pb-1 pt-2 text-[10px] font-extrabold uppercase tracking-[0.14em] text-muted-foreground">
                  More subjects
                </SelectLabel>
                {additionalSubjects.map((subject) => (
                  <SubjectOption key={subject} subject={subject} />
                ))}
              </SelectGroup>
            </>
          )}
        </SelectContent>
      </Select>
    </div>
  );
}
