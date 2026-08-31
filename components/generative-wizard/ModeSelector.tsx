import React from 'react';
import {
  ChevronDown,
  Edit3,
  Globe,
  MessageSquare,
  ScanLine,
  Sparkles,
  Wand2,
  Zap,
  type LucideIcon,
} from 'lucide-react';
import type { GenerativeWizardMode } from './types';

interface ModeDefinition {
  mode: GenerativeWizardMode;
  label: string;
  icon: LucideIcon;
  accent: 'blue' | 'emerald';
}

const MODES: ModeDefinition[] = [
  { mode: 'auto-plan', label: 'Auto Plan', icon: Wand2, accent: 'blue' },
  { mode: 'chat', label: 'Text', icon: MessageSquare, accent: 'blue' },
  { mode: 'chat-v2', label: 'Text 2.0', icon: MessageSquare, accent: 'blue' },
  { mode: 'chat-v3', label: 'Text 3.0', icon: MessageSquare, accent: 'blue' },
  { mode: 'chat-v4', label: 'Text 4.0', icon: MessageSquare, accent: 'blue' },
  { mode: 'chat-v4a', label: 'Text 4.0 A', icon: MessageSquare, accent: 'blue' },
  { mode: 'chat-v4b', label: 'Text 4.0 B', icon: MessageSquare, accent: 'blue' },
  { mode: 'chat-v4c', label: 'Text 4.0 C', icon: MessageSquare, accent: 'blue' },
  { mode: 'chat-v4d', label: 'Text 4.0 D', icon: MessageSquare, accent: 'blue' },
  { mode: 'chat-v4e', label: 'Text 4.0 E', icon: MessageSquare, accent: 'blue' },
  { mode: 'chat-v4f', label: 'Text 4.0 F', icon: MessageSquare, accent: 'blue' },
  { mode: 'chat-v4g', label: 'Text 4.0 G', icon: MessageSquare, accent: 'blue' },
  { mode: 'chat-v4h', label: 'AutoPlan', icon: MessageSquare, accent: 'blue' },
  { mode: 'chat-v4j', label: 'Text 4.0 J', icon: MessageSquare, accent: 'blue' },
  { mode: 'text2plan', label: 'Text2Plan', icon: Sparkles, accent: 'blue' },
  { mode: 'smart-text2plan', label: 'Smart', icon: Sparkles, accent: 'emerald' },
  { mode: 'fusion', label: 'Fusion 3.0', icon: Globe, accent: 'blue' },
  { mode: 'tracer', label: 'Tracer', icon: Zap, accent: 'blue' },
  { mode: 'redraw-v2', label: 'Redraw 2.0', icon: ScanLine, accent: 'blue' },
  { mode: 'digitizer', label: 'Digitizer', icon: Edit3, accent: 'blue' },
  { mode: 'ai-rendering', label: 'Render Canvas', icon: Sparkles, accent: 'blue' },
];

interface ModeSelectorProps {
  mode: GenerativeWizardMode;
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  onModeChange: (mode: GenerativeWizardMode) => void;
}

const ModeSelector: React.FC<ModeSelectorProps> = ({ mode, isOpen, onOpenChange, onModeChange }) => {
  const current = MODES.find(item => item.mode === mode);
  const CurrentIcon = current?.icon;

  return (
    <div className="relative">
      <button
        onClick={() => onOpenChange(!isOpen)}
        className="flex items-center gap-2 px-3 py-1.5 text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors border border-slate-200"
      >
        {current && CurrentIcon && (
          <>
            <CurrentIcon size={14} className={current.accent === 'emerald' ? 'text-emerald-600' : 'text-blue-600'} />
            {current.label}
          </>
        )}
        <ChevronDown size={14} className="text-slate-400 ml-1" />
      </button>

      {isOpen && (
        <div className="absolute top-full left-0 mt-2 w-48 bg-white border border-slate-200 rounded-xl shadow-xl z-50 overflow-hidden py-1 animate-in fade-in zoom-in-95 duration-200">
          {MODES.filter(item => item.mode !== 'ai-rendering' && item.mode !== 'digitizer').map(item => {
            const Icon = item.icon;
            const isActive = item.mode === mode;
            const activeClasses = item.accent === 'emerald'
              ? 'bg-emerald-50 text-emerald-700'
              : 'bg-blue-50 text-blue-700';
            const hoverClasses = item.accent === 'emerald'
              ? 'text-slate-700 hover:bg-slate-50 hover:text-emerald-600'
              : 'text-slate-700 hover:bg-slate-50 hover:text-blue-600';
            const iconClass = isActive
              ? item.accent === 'emerald' ? 'text-emerald-600' : 'text-blue-600'
              : 'text-slate-400';
            return (
              <button
                key={item.mode}
                onClick={() => {
                  onModeChange(item.mode);
                  onOpenChange(false);
                }}
                className={`w-full text-left px-4 py-2.5 text-xs font-bold flex items-center gap-3 transition-colors ${isActive ? activeClasses : hoverClasses}`}
              >
                <Icon size={14} className={iconClass} /> {item.label}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default ModeSelector;
