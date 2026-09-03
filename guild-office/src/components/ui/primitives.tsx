/** 공용 UI 조각. 도메인 로직은 넣지 않는다. */
import { useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { motion } from 'framer-motion';

/** 말풍선과 화면 가장자리 사이에 남겨 둘 여백(px) */
const TIP_GAP = 8;

/**
 * 마우스를 올리면 바로 뜨는 설명 말풍선.
 *
 * 브라우저 기본 `title` 속성은 1초 넘게 기다려야 뜨고 스타일도 없어서 "설명이
 * 안 나온다"고 느끼기 쉽다. 그래서 직접 그린다 — 비활성(disabled) 버튼 위에서도
 * 떠야 하므로 이벤트는 버튼이 아니라 감싸는 span 이 받는다.
 *
 * **말풍선은 body 로 옮겨서(portal) `position: fixed` 로 띄운다.** 예전에는 버튼
 * 옆에 absolute 로 붙였는데, 스크롤되는 칸(overflow-y-auto) 안에 있으면 그 칸이
 * 가로 방향으로도 잘라내기 때문에 오른쪽 끝 버튼의 설명이 잘려 보였다. body 로
 * 빼내면 어떤 칸도 자르지 못하고, 화면 밖으로 나가려 하면 아래에서 밀어 넣는다.
 */
export function Tooltip({
  text,
  placement = 'top',
  full,
  children,
}: {
  text?: string;
  placement?: 'top' | 'bottom';
  /** 감싸는 요소를 가로로 꽉 채운다 (full 버튼을 감쌀 때 레이아웃이 깨지지 않도록). */
  full?: boolean;
  children: ReactNode;
}) {
  const [show, setShow] = useState(false);
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null);
  const anchorRef = useRef<HTMLSpanElement>(null);
  const tipRef = useRef<HTMLSpanElement>(null);

  // 먼저 보이지 않게 한 번 그려 크기를 재고, 그 크기로 화면 안에 들어오는 자리를
  // 계산한다. useLayoutEffect 라 화면에 칠해지기 전에 끝나므로 깜빡이지 않는다.
  useLayoutEffect(() => {
    if (!show) {
      setPos(null);
      return;
    }
    const place = () => {
      const a = anchorRef.current?.getBoundingClientRect();
      const t = tipRef.current?.getBoundingClientRect();
      if (!a || !t) return;
      const maxLeft = window.innerWidth - t.width - TIP_GAP;
      const left = Math.min(Math.max(TIP_GAP, a.left + a.width / 2 - t.width / 2), Math.max(TIP_GAP, maxLeft));
      // 위쪽에 자리가 없으면 아래로, 아래가 없으면 위로 뒤집는다.
      const wantTop = placement === 'top';
      const fitsAbove = a.top - t.height - 6 >= TIP_GAP;
      const fitsBelow = a.bottom + t.height + 6 <= window.innerHeight - TIP_GAP;
      const above = wantTop ? fitsAbove || !fitsBelow : !fitsBelow && fitsAbove;
      setPos({ left, top: above ? a.top - t.height - 6 : a.bottom + 6 });
    };
    place();
    // 스크롤·크기 변경으로 버튼이 움직이면 말풍선도 따라간다.
    window.addEventListener('scroll', place, true);
    window.addEventListener('resize', place);
    return () => {
      window.removeEventListener('scroll', place, true);
      window.removeEventListener('resize', place);
    };
  }, [show, placement, text]);

  if (!text) return <>{children}</>;

  return (
    <span
      ref={anchorRef}
      className={`inline-flex ${full ? 'w-full' : ''}`}
      onMouseEnter={() => setShow(true)}
      onMouseLeave={() => setShow(false)}
      onFocusCapture={() => setShow(true)}
      onBlurCapture={() => setShow(false)}
    >
      {children}
      {show
        ? createPortal(
            <span
              ref={tipRef}
              role="tooltip"
              style={{
                left: pos?.left ?? 0,
                top: pos?.top ?? 0,
                // 자리를 재기 전에는 보이지 않게 둔다 (0,0 에서 번쩍이지 않도록).
                visibility: pos ? 'visible' : 'hidden',
              }}
              className="pointer-events-none fixed z-[200] w-max max-w-[16rem] whitespace-normal rounded-lg border border-stone-600 bg-stone-950/95 px-2.5 py-1.5 text-left text-[11px] font-normal leading-relaxed text-stone-200 shadow-rune"
            >
              {text}
            </span>,
            document.body,
          )
        : null}
    </span>
  );
}

export function Button({
  children,
  onClick,
  variant = 'primary',
  disabled,
  full,
  size = 'md',
  title,
  hint,
  hintPlacement = 'top',
}: {
  children: ReactNode;
  onClick?: () => void;
  variant?: 'primary' | 'ghost' | 'danger' | 'quiet';
  disabled?: boolean;
  full?: boolean;
  size?: 'sm' | 'md';
  title?: string;
  /** 마우스를 올리면 뜨는 설명. title 과 달리 바로 뜨고 앱 스타일을 따른다. */
  hint?: string;
  hintPlacement?: 'top' | 'bottom';
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
  const button = (
    <button
      type="button"
      title={hint ? undefined : title}
      disabled={disabled}
      onClick={onClick}
      className={`${base} ${sizes} ${variants} ${full ? 'w-full' : ''}`}
    >
      {children}
    </button>
  );
  if (!hint) return button;
  return (
    <Tooltip text={hint} placement={hintPlacement} full={full}>
      {button}
    </Tooltip>
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

/**
 * 클릭하면 기기의 기본 메일 앱이 열리는 이메일 링크.
 *
 * 이 앱에는 서버가 없어서 메일을 직접 보낼 수는 없다. 대신 `mailto:` 로 사용자의
 * 메일 앱에 받는 사람(과 제목)을 채워서 넘긴다 — 실제 발송은 그 앱이 한다.
 * 그래서 "보낸 메일" 기록도 이 앱에는 남지 않는다.
 *
 * ⚠️ 미리보기 샌드박스(claude.ai 아티팩트 등)는 바깥으로 나가는 이동을 막으므로
 * 링크가 아무 반응이 없을 수 있다. 그때를 위해 주소 복사 버튼을 함께 둔다.
 */
export function MailLink({
  email,
  subject,
  className = '',
}: {
  email: string;
  /** 메일 앱 제목 줄에 미리 채울 문구 */
  subject?: string;
  className?: string;
}) {
  const href = `mailto:${email}${subject ? `?subject=${encodeURIComponent(subject)}` : ''}`;
  return (
    <a
      href={href}
      className={`underline decoration-stone-600 underline-offset-2 transition-colors hover:text-gold hover:decoration-gold ${className}`}
      title={`${email} — 클릭하면 기본 메일 앱이 열립니다`}
    >
      {email}
    </a>
  );
}

/** 클립보드에 문자열을 복사하는 작은 버튼. 복사 결과를 그 자리에서 알려 준다. */
export function CopyButton({ value, label = '복사' }: { value: string; label?: string }) {
  const [state, setState] = useState<'idle' | 'done' | 'failed'>('idle');
  return (
    <Tooltip text={`${value} 를 클립보드에 복사합니다.`}>
      <button
        type="button"
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(value);
            setState('done');
          } catch {
            // 브라우저가 클립보드 접근을 막는 경우가 있다. 성공한 척하지 않는다.
            setState('failed');
          }
          setTimeout(() => setState('idle'), 1800);
        }}
        className="rounded-md border border-stone-700 px-1.5 py-0.5 text-[10px] text-stone-400 transition-colors hover:border-gold hover:text-gold"
      >
        {state === 'done' ? '복사됨' : state === 'failed' ? '복사 실패' : label}
      </button>
    </Tooltip>
  );
}

export function Notice({ children, tone = 'info' }: { children: ReactNode; tone?: 'info' | 'warn' }) {
  const t =
    tone === 'warn'
      ? 'border-ember/40 bg-ember/10 text-ember-soft'
      : 'border-arcane/40 bg-arcane/10 text-arcane-soft';
  return <div className={`rounded-lg border px-3 py-2 text-xs leading-relaxed ${t}`}>{children}</div>;
}

export function SectionTitle({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <h3 className={`mb-2 text-xs font-semibold uppercase tracking-widest text-stone-500 ${className}`}>
      {children}
    </h3>
  );
}
