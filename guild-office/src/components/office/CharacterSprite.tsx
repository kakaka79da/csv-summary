/**
 * 캐릭터 스프라이트 (SVG, 24×28 로컬 좌표계).
 *
 * 특정 게임의 캐릭터·의상·로고를 복제하지 않는 독창적 도형으로만 구성한다.
 * 상태별 연출은 employee.state 하나에서만 파생되므로, 화면과 실제 상태가 어긋나지 않는다.
 */
import { motion } from 'framer-motion';
import type { AgentState } from '@/types';

interface Props {
  palette: { robe: string; trim: string; aura: string };
  sigil: string;
  state: AgentState;
}

/** 상태별 몸통 애니메이션 */
function bodyMotion(state: AgentState) {
  switch (state) {
    case 'walking':
      return { animate: { y: [0, -1.1, 0] }, transition: { duration: 0.42, repeat: Infinity } };
    case 'fighting':
      return { animate: { x: [0, 1.6, -1.2, 0], rotate: [0, 2, -2, 0] }, transition: { duration: 0.5, repeat: Infinity } };
    case 'writing':
    case 'collaborating':
      return { animate: { rotate: [0, 1.4, 0, -1.4, 0] }, transition: { duration: 1.6, repeat: Infinity } };
    case 'thinking':
      return { animate: { y: [0, -0.5, 0] }, transition: { duration: 2.2, repeat: Infinity } };
    case 'mailing':
      return { animate: { y: [0, -1.6, 0] }, transition: { duration: 0.6, repeat: Infinity } };
    case 'resting':
    case 'fishing':
      return { animate: { y: [0, -0.4, 0] }, transition: { duration: 2.8, repeat: Infinity } };
    case 'playing':
      return { animate: { rotate: [0, 6, -6, 0] }, transition: { duration: 1.1, repeat: Infinity } };
    case 'awaiting_approval':
      return { animate: { opacity: [1, 0.65, 1] }, transition: { duration: 1.4, repeat: Infinity } };
    case 'error':
      return { animate: { x: [0, 1, -1, 0] }, transition: { duration: 0.22, repeat: Infinity } };
    case 'on_leave':
      return { animate: { opacity: 0.35 }, transition: { duration: 0.4 } };
    default:
      return { animate: { y: [0, -0.6, 0] }, transition: { duration: 2.4, repeat: Infinity } };
  }
}

/** 상태를 한눈에 알리는 머리 위 표식 */
function overhead(state: AgentState): { glyph: string; color: string } | null {
  switch (state) {
    case 'thinking':
      return { glyph: '…', color: '#a99cf0' };
    case 'writing':
      return { glyph: '✎', color: '#f0cd85' };
    case 'mailing':
      return { glyph: '✉', color: '#8fc4f0' };
    case 'collaborating':
      return { glyph: '⇄', color: '#8fe0bb' };
    case 'fighting':
      return { glyph: '⚔', color: '#f0958a' };
    case 'awaiting_approval':
      return { glyph: '🔒', color: '#d9a441' };
    case 'resting':
      return { glyph: 'z', color: '#8fc4f0' };
    case 'fishing':
      return { glyph: '🎣', color: '#8fc4f0' };
    case 'playing':
      return { glyph: '♪', color: '#f0cd85' };
    case 'error':
      return { glyph: '!', color: '#d8604f' };
    case 'completed':
      return { glyph: '✔', color: '#4fbf8b' };
    case 'on_leave':
      return { glyph: '✈', color: '#7c7488' };
    default:
      return null;
  }
}

export default function CharacterSprite({ palette, sigil, state }: Props) {
  const m = bodyMotion(state);
  const mark = overhead(state);
  const auraActive = ['fighting', 'writing', 'thinking', 'collaborating', 'mailing', 'working'].includes(state);

  return (
    <g>
      {/* 그림자 */}
      <ellipse cx="12" cy="26.4" rx="5.4" ry="1.5" fill="#000" opacity="0.35" />

      {/* 작업 중 오라 — SVG 의 r 속성은 애니메이션 대상으로 쓰지 않는다
          (framer-motion 이 중간 프레임에서 undefined 를 넣어 경고가 발생한다) */}
      {auraActive ? (
        <motion.circle
          cx="12"
          cy="17"
          r="9"
          fill={palette.aura}
          style={{ transformOrigin: '12px 17px' }}
          animate={{ opacity: [0.05, 0.18, 0.05], scale: [0.92, 1.06, 0.92] }}
          transition={{ duration: 1.8, repeat: Infinity }}
        />
      ) : null}

      <motion.g animate={m.animate} transition={m.transition}>
        {/* 망토/로브 */}
        <path d="M12 9 L18.6 15.4 L17 25.4 L7 25.4 L5.4 15.4 Z" fill={palette.robe} />
        {/* 장식 띠 */}
        <path d="M12 9 L15.4 12.4 L12 25.4 L8.6 12.4 Z" fill={palette.trim} opacity="0.85" />
        {/* 어깨 */}
        <path d="M5.4 15.4 L3.6 13.2 L6 11 Z" fill={palette.trim} />
        <path d="M18.6 15.4 L20.4 13.2 L18 11 Z" fill={palette.trim} />
        {/* 머리 */}
        <circle cx="12" cy="6.4" r="4" fill="#e6dcc8" />
        {/* 두건 */}
        <path d="M8 6 A4 4 0 0 1 16 6 L16 4.6 A4 4 0 0 0 8 4.6 Z" fill={palette.robe} />
        {/* 문양 */}
        <text
          x="12"
          y="19.6"
          textAnchor="middle"
          fontSize="6"
          fill="#0d0b0f"
          opacity="0.55"
          style={{ pointerEvents: 'none' }}
        >
          {sigil}
        </text>
      </motion.g>

      {mark ? (
        <motion.text
          x="12"
          y="1.6"
          textAnchor="middle"
          fontSize="4.6"
          fill={mark.color}
          animate={{ y: [1.6, 0.4, 1.6], opacity: [0.7, 1, 0.7] }}
          transition={{ duration: 1.4, repeat: Infinity }}
          style={{ pointerEvents: 'none' }}
        >
          {mark.glyph}
        </motion.text>
      ) : null}
    </g>
  );
}
