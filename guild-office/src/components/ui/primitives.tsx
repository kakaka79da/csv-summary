/** 공용 UI 조각. 도메인 로직은 넣지 않는다. */
import type { ReactNode } from 'react';
import { motion } from 'framer-motion';

export function Button({
  children,
  onClick,
  variant = 'primary',
  disabled,
  full,
  size = 'md',
  title,
}: {
  children: ReactNode;
  onClick?: () => void;
  variant?: 'primary' | 'ghost' | 'danger' | 'quiet';
  disabled?: boolean;
  full?: boolean;
  size?: 'sm' | 'md';
  title?: string;
}) {
  const base =
    'inline-flex items-center justify-center gap-1.5 rounded-lg font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-40';
  const sizes = { sm: 'px-2.5 py-1 text-xs', md: 'px-4 py-2 text-sm' }[size];
  const variants = {
    primary: 'bg-gold text-stone-950 hover:bg-gold-soft',
    ghost: 'border border-stone-600 text-stone-200 hover:border-gold hover:text-gold',
    danger: 'bg-ember text-stone-950 hover:bg-ember-soft',
    quiet: 'text-stone-400 hover:text-stone-100',
  }[variant];
  return (
    <button
      type="button"
      title={title}
      disabled={disabled}
      onClick={onClick}
      className={`${base} ${sizes} ${variants} ${full ? 'w-full' : ''}`}
    >
      {children}
    </button>
  );
}

export function Badge({
  children,
  tone = 'neutral',
}: {
  children: ReactNode;
  tone?: 'neutral' | 'gold' | 'vital' | 'ember' | 'arcane';
}) {
  const tones = {
    neutral: 'border-stone-600 text-stone-300',
    gold: 'border-gold/60 text-gold',
    vital: 'border-vital/60 text-vital',
    ember: 'border-ember/60 text-ember',
    arcane: 'border-arcane/60 text-arcane-soft',
  }[tone];
  return (
    <span className={`inline-block rounded border px-1.5 py-0.5 text-[10px] leading-none ${tones}`}>
      {children}
    </span>
  );
}

export function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-stone-400">{label}</span>
      {children}
      {hint ? <span className="mt-1 block text-[11px] text-stone-500">{hint}</span> : null}
    </label>
  );
}

const inputClass =
  'w-full rounded-lg border border-stone-700 bg-stone-950/70 px-3 py-2 text-sm text-stone-100 outline-none focus:border-gold';

export function TextInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={inputClass} />;
}

export function TextArea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...props} className={`${inputClass} resize-none`} />;
}

export function Select(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...props} className={inputClass} />;
}

/** 실제 수치와 연출을 함께 보여주는 막대. */
export function StatBar({
  value,
  max = 100,
  tone = 'gold',
  label,
  realText,
}: {
  value: number;
  max?: number;
  tone?: 'gold' | 'vital' | 'arcane' | 'ember';
  label: string;
  realText: string;
}) {
  const pct = max === 0 ? 0 : Math.max(0, Math.min(100, (value / max) * 100));
  const colors = { gold: 'bg-gold', vital: 'bg-vital', arcane: 'bg-arcane', ember: 'bg-ember' }[tone];
  return (
    <div>
      <div className="mb-1 flex items-baseline justify-between text-[11px]">
        <span className="text-stone-400">{label}</span>
        <span className="tabular-nums text-stone-300">{realText}</span>
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-stone-800">
        <motion.div
          className={`h-full ${colors}`}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.25 }}
        />
      </div>
    </div>
  );
}

export function Modal({
  title,
  subtitle,
  children,
  onClose,
  wide,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
  onClose?: () => void;
  wide?: boolean;
}) {
  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/70 p-4">
      <motion.div
        initial={{ opacity: 0, y: 16, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ type: 'spring', stiffness: 260, damping: 24 }}
        className={`panel flex max-h-[90vh] w-full flex-col ${wide ? 'max-w-4xl' : 'max-w-xl'}`}
      >
        <header className="flex items-start justify-between gap-4 border-b border-stone-700/70 px-5 py-4">
          <div>
            <h2 className="rune-title text-lg">{title}</h2>
            {subtitle ? <p className="mt-0.5 text-xs text-stone-400">{subtitle}</p> : null}
          </div>
          {onClose ? (
            <Button variant="quiet" size="sm" onClick={onClose}>
              닫기 ✕
            </Button>
          ) : null}
        </header>
        <div className="scroll-thin overflow-y-auto px-5 py-4">{children}</div>
      </motion.div>
    </div>
  );
}

/** 게임 표현과 실제 의미를 나란히 보여주는 라벨. 오해 방지용. */
export function DualLabel({ game, real }: { game: string; real: string }) {
  return (
    <span className="inline-flex items-baseline gap-1.5">
      <span className="text-stone-100">{game}</span>
      <span className="text-[11px] text-stone-500">· {real}</span>
    </span>
  );
}

export function Notice({ children, tone = 'info' }: { children: ReactNode; tone?: 'info' | 'warn' }) {
  const t =
    tone === 'warn'
      ? 'border-ember/40 bg-ember/10 text-ember-soft'
      : 'border-arcane/40 bg-arcane/10 text-arcane-soft';
  return <div className={`rounded-lg border px-3 py-2 text-xs leading-relaxed ${t}`}>{children}</div>;
}

export function SectionTitle({ children }: { children: ReactNode }) {
  return <h3 className="mb-2 text-xs font-semibold uppercase tracking-widest text-stone-500">{children}</h3>;
}
