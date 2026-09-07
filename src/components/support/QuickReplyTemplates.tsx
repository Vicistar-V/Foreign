import { useState } from 'react';
import { ChevronDown, ChevronUp, MessageSquarePlus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface QuickReplyTemplatesProps {
  userName?: string;
  onSelectTemplate: (text: string) => void;
}

const TEMPLATES = [
  {
    id: 'greeting',
    label: 'Greeting',
    text: `Hi [NAME]! Thanks for reaching out to us. Let me help you with that.`,
  },
  {
    id: 'need_info',
    label: 'Need Info',
    text: `Thanks for contacting us! To help you better, could you please provide more details about your issue?`,
  },
  {
    id: 'checking',
    label: 'Checking',
    text: `Thanks for letting us know! I'm looking into this now and will get back to you shortly.`,
  },
  {
    id: 'money_fixed',
    label: 'Money Fixed',
    text: `Great news, [NAME]! The issue has been resolved. Please check your wallet now and let me know if everything looks correct.`,
  },
  {
    id: 'withdrawal_help',
    label: 'Withdrawal',
    text: `Hi [NAME]! I've checked your withdrawal. Everything looks good and it should arrive in your bank soon. If you have any questions, just let me know!`,
  },
  {
    id: 'tech_issue',
    label: 'Technical',
    text: `Thanks for reporting this! We're aware of the issue and our team is working on a fix. I'll update you as soon as it's resolved.`,
  },
  {
    id: 'resolved',
    label: 'Resolved',
    text: `Glad I could help! I'm marking this as resolved. If you need anything else, feel free to open a new request anytime. Have a great day!`,
  },
  {
    id: 'thanks',
    label: 'Thanks',
    text: `You're welcome, [NAME]! Is there anything else I can help you with today?`,
  },
];

export const QuickReplyTemplates = ({ userName, onSelectTemplate }: QuickReplyTemplatesProps) => {
  const [isExpanded, setIsExpanded] = useState(false);

  const resolveText = (template: typeof TEMPLATES[0]) => {
    const firstName = userName ? userName.split(' ')[0] : 'there';
    return template.text.replace(/\[NAME\]/g, firstName);
  };

  return (
    <div className="border-t bg-muted/20">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between px-4 py-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground hover:text-foreground transition-colors active:bg-muted/40"
      >
        <div className="flex items-center gap-1.5">
          <MessageSquarePlus className="h-3 w-3" />
          <span>Quick Replies</span>
          <span className="text-muted-foreground/70 normal-case tracking-normal font-medium">
            ({TEMPLATES.length} ready)
          </span>
        </div>
        {isExpanded ? <ChevronDown className="h-3 w-3" /> : <ChevronUp className="h-3 w-3" />}
      </button>

      {!isExpanded ? (
        <div className="px-3 pb-2.5 flex gap-1.5 overflow-x-auto no-scrollbar">
          {TEMPLATES.slice(0, 5).map((template) => (
            <Button
              key={template.id}
              variant="outline"
              size="sm"
              onClick={() => onSelectTemplate(resolveText(template))}
              className="h-7 px-2.5 text-[10px] font-medium bg-background hover:bg-primary/5 hover:text-primary hover:border-primary/30 transition-all rounded-lg shrink-0"
            >
              {template.label}
            </Button>
          ))}
          <button
            onClick={() => setIsExpanded(true)}
            className="text-[10px] font-medium text-primary px-2 whitespace-nowrap shrink-0"
          >
            +{TEMPLATES.length - 5} more
          </button>
        </div>
      ) : (
        <div className="px-3 pb-3 space-y-1.5 max-h-[40vh] overflow-y-auto">
          {TEMPLATES.map((template) => {
            const preview = resolveText(template);
            return (
              <button
                key={template.id}
                onClick={() => {
                  onSelectTemplate(preview);
                  setIsExpanded(false);
                }}
                className={cn(
                  'w-full text-left p-2.5 rounded-xl border bg-background',
                  'hover:bg-primary/5 hover:border-primary/40 active:scale-[0.99] transition-all',
                )}
              >
                <p className="text-[10px] font-bold uppercase tracking-wider text-primary mb-1">
                  {template.label}
                </p>
                <p className="text-xs text-muted-foreground leading-snug line-clamp-2">
                  {preview}
                </p>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};
