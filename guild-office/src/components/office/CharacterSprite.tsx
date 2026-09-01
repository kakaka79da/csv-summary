/**
 * 캐릭터 스프라이트 (SVG, 24×28 로컬 좌표계).
 *
 * 직군별로 완전히 다른 실루엣을 쓴다.
 *  - strategist    총무 매니저 : 네이비 정장 + 이어피스 + 홀로그램 태블릿
 *  - rune_engineer 연구 엔지니어: 회로 무늬가 빛나는 롱코트 + 스마트 글래스
 *  - sage          심리학 교수 : 실크 블라우스 + 펜슬 스커트 + 떠다니는 문서와 빛 구슬
 *  - sovereign     대표       : 금장 트림의 예복 (외형 선택에 따라 색이 바뀐다)
 *
 * 특정 게임·작품의 캐릭터를 복제하지 않고 도형만으로 새로 구성했다.
 * 상태별 연출은 employee.state 하나에서만 파생되므로 화면과 실제 상태가 어긋나지 않는다.
 */
import { motion } from 'framer-motion';
import type { AgentState, JobClass } from '@/types';

interface Props {
  palette: { robe: string; trim: string; aura: string };
  sigil: string;
  state: AgentState;
  jobClass: JobClass;
}

const SKIN = '#e8c9a8';
const SKIN_SHADE = '#d3ad89';

/* ───────────────────────── 상태별 연출 ───────────────────────── */

function bodyMotion(state: AgentState) {
  switch (state) {
    case 'walking':
      return { animate: { y: [0, -1.1, 0] }, transition: { duration: 0.42, repeat: Infinity } };
    case 'fighting':
      return {
        animate: { x: [0, 1.6, -1.2, 0], rotate: [0, 2, -2, 0] },
        transition: { duration: 0.5, repeat: Infinity },
      };
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

/* ─────────────────────────── 직군별 몸체 ─────────────────────────── */

/** 총무 매니저 — 네이비 정장, 낮은 시뇽, 이어피스, 홀로그램 태블릿 */
function StrategistBody({ working }: { working: boolean }) {
  const NAVY = '#22335c';
  const NAVY_D = '#182644';
  const SHIRT = '#c8d3e2';
  return (
    <g>
      {/* 다리 */}
      <rect x="9.4" y="17.6" width="2.2" height="7.4" fill={NAVY_D} />
      <rect x="12.4" y="17.6" width="2.2" height="7.4" fill={NAVY} />
      <rect x="8.9" y="24.6" width="3.1" height="1.5" rx="0.6" fill="#1b1b20" />
      <rect x="12.1" y="24.6" width="3.1" height="1.5" rx="0.6" fill="#1b1b20" />
      {/* 재킷 */}
      <path d="M12 9.4 L17.4 11.6 L17.9 18.6 L6.1 18.6 L6.6 11.6 Z" fill={NAVY} />
      <path d="M12 9.4 L14.4 10.6 L12 17.4 L9.6 10.6 Z" fill={SHIRT} />
      <path d="M12 9.4 L13.1 12.2 L12 13.6 L10.9 12.2 Z" fill="#7d8ea6" />
      {/* 회로 무늬 */}
      <path d="M7.6 12.6 L7.6 15 L9.2 15 M16.4 12.4 L16.4 16.2" stroke="#5f86c4" strokeWidth="0.22" fill="none" opacity="0.9" />
      {/* 팔 */}
      <rect x="5.4" y="11.4" width="2.3" height="6.6" rx="1" fill={NAVY_D} />
      <rect x="16.3" y="11.4" width="2.3" height="5.2" rx="1" fill={NAVY_D} />
      <circle cx="17.5" cy="17.2" r="1.1" fill={SKIN} />
      <circle cx="6.5" cy="18.4" r="1.1" fill={SKIN_SHADE} />
      {/* 시뇽 (머리보다 먼저 그려 뒤쪽에 놓는다) */}
      <circle cx="15.6" cy="7.6" r="1.45" fill="#33241b" />
      {/* 머리 */}
      <circle cx="12" cy="6.2" r="3.7" fill={SKIN} />
      <path d="M8.3 6.4 Q8.4 2.5 12 2.4 Q15.6 2.5 15.7 6.4 Q14.9 4.1 12 4.3 Q9.1 4.1 8.3 6.4 Z" fill="#4a3527" />
      <path d="M9 5.2 Q11 3.4 13.4 4" stroke="#5d4433" strokeWidth="0.35" fill="none" strokeLinecap="round" />
      {/* 이어피스 */}
      <circle cx="14.8" cy="6.5" r="0.5" fill="#7fd6f5" />
      <rect x="14.4" y="5.6" width="0.34" height="1" rx="0.17" fill="#2c3a48" />
      {/* 홀로그램 태블릿 */}
      <motion.g
        animate={working ? { y: [0, -0.5, 0], opacity: [0.85, 1, 0.85] } : { opacity: 0.75 }}
        transition={{ duration: 2.2, repeat: Infinity }}
      >
        <rect x="17.4" y="12.2" width="5.6" height="4.2" rx="0.4" fill="#7fd6f5" opacity="0.28" />
        <rect x="17.4" y="12.2" width="5.6" height="4.2" rx="0.4" fill="none" stroke="#9fe6ff" strokeWidth="0.18" />
        <rect x="18.1" y="14.4" width="0.8" height="1.4" fill="#cdf1ff" />
        <rect x="19.3" y="13.5" width="0.8" height="2.3" fill="#cdf1ff" />
        <rect x="20.5" y="14" width="0.8" height="1.8" fill="#cdf1ff" />
        <rect x="21.7" y="13" width="0.8" height="2.8" fill="#cdf1ff" />
      </motion.g>
    </g>
  );
}

/** 연구 엔지니어 — 회로가 빛나는 롱코트, 스마트 글래스, 장갑 */
function EngineerBody({ working }: { working: boolean }) {
  const COAT = '#242a37';
  const COAT_D = '#171b25';
  const CYAN = '#3fd2e8';
  return (
    <g>
      {/* 다리 */}
      <rect x="9.6" y="18" width="2.2" height="7" fill="#22252e" />
      <rect x="12.2" y="18" width="2.2" height="7" fill="#1a1d24" />
      <rect x="8.9" y="24.6" width="3.2" height="1.5" rx="0.6" fill="#0c0d11" />
      <rect x="12" y="24.6" width="3.2" height="1.5" rx="0.6" fill="#0c0d11" />
      {/* 롱코트 */}
      <path d="M12 9 L17.8 11.6 L18.6 23.4 L5.4 23.4 L6.2 11.6 Z" fill={COAT} />
      <path d="M12 9 L13.9 10.8 L12 22.6 L10.1 10.8 Z" fill={COAT_D} />
      {/* 코트 외곽 하이라이트 — 어두운 배경에서 실루엣이 묻히지 않게 */}
      <path d="M12 9 L17.8 11.6 L18.6 23.4 M12 9 L6.2 11.6 L5.4 23.4" stroke="#5c6779" strokeWidth="0.28" fill="none" opacity="0.85" />
      {/* 세운 깃 */}
      <path d="M9.4 9.6 L12 9 L14.6 9.6 L14.2 11.4 L9.8 11.4 Z" fill="#2e3547" />
      {/* 회로 라인 */}
      <g stroke={CYAN} strokeWidth="0.22" fill="none" opacity="0.95">
        <path d="M8.2 12.6 L8.2 16.4 L9.8 17.6 L9.8 21.4" />
        <path d="M15.8 12.2 L15.8 15 L14.4 16.2 L14.4 20.6" />
        <path d="M12 14 L12 18" opacity="0.5" />
      </g>
      <circle cx="8.2" cy="16.4" r="0.34" fill={CYAN} />
      <circle cx="14.4" cy="16.2" r="0.3" fill={CYAN} />
      {/* 벨트 */}
      <rect x="7.6" y="16.4" width="8.8" height="0.9" fill="#2b303c" />
      {/* 팔 + 장갑 */}
      <rect x="5.1" y="11.6" width="2.4" height="6.4" rx="1" fill={COAT_D} />
      <rect x="16.5" y="11.6" width="2.4" height="5" rx="1" fill={COAT_D} />
      <circle cx="6.3" cy="18.4" r="1.1" fill="#3a3f4b" />
      <circle cx="17.7" cy="17.2" r="1.1" fill="#3a3f4b" />
      {/* 머리 */}
      <circle cx="12" cy="6.2" r="3.7" fill={SKIN} />
      <path d="M8.4 5 Q9.4 1.9 12 2.2 Q14.8 1.9 15.6 5.2 Q14.6 4 13.4 4.4 Q12.6 3.2 11.6 4.3 Q10.2 3.6 8.4 5 Z" fill="#4a3323" />
      <path d="M9.1 3.9 L10.1 2.7 M11.4 3.4 L12.2 2.3 M13.4 3.8 L14.2 2.8" stroke="#5d422e" strokeWidth="0.3" strokeLinecap="round" />
      {/* 스마트 글래스 — 눈높이에만 얇게 */}
      <rect x="9.1" y="5.9" width="5.8" height="0.95" rx="0.45" fill="#16242c" />
      <rect x="9.35" y="6.1" width="5.3" height="0.55" rx="0.27" fill={CYAN} opacity="0.9" />
      <rect x="14.9" y="6.1" width="0.9" height="0.28" rx="0.14" fill="#16242c" />
      {/* 턱선 그림자 */}
      <path d="M10.2 8.8 Q12 9.4 13.8 8.8" stroke={SKIN_SHADE} strokeWidth="0.3" fill="none" opacity="0.6" />
      {/* 홀로그램 패널 */}
      <motion.g
        animate={working ? { y: [0, -0.6, 0], opacity: [0.8, 1, 0.8] } : { opacity: 0.7 }}
        transition={{ duration: 1.8, repeat: Infinity }}
      >
        <path d="M0.6 11.6 L5.6 10.4 L5.6 15.4 L0.6 16.6 Z" fill={CYAN} opacity="0.22" />
        <path d="M0.6 11.6 L5.6 10.4 L5.6 15.4 L0.6 16.6 Z" fill="none" stroke={CYAN} strokeWidth="0.18" />
        <path d="M1.4 13 L4.8 12.2 M1.4 14.2 L4 13.6 M1.4 15.4 L4.6 14.6" stroke="#cdf6ff" strokeWidth="0.16" />
      </motion.g>
    </g>
  );
}

/** 심리학 교수 — 실크 블라우스, 펜슬 스커트, 떠다니는 문서와 빛 구슬 */
function SageBody({ working }: { working: boolean }) {
  const BLOUSE = '#efe2c6';
  const BLOUSE_S = '#d9c9a6';
  const SKIRT = '#4b4756';
  const GOLD = '#f0b957';
  return (
    <g>
      {/* 다리 */}
      <rect x="10" y="20.4" width="1.8" height="4.6" fill={SKIN_SHADE} />
      <rect x="12.3" y="20.4" width="1.8" height="4.6" fill={SKIN} />
      <path d="M9.7 25 L11.9 25 L11.5 26.4 L10.2 26.4 Z" fill="#26232a" />
      <path d="M12.2 25 L14.4 25 L14.1 26.4 L12.7 26.4 Z" fill="#26232a" />
      {/* 펜슬 스커트 */}
      <path d="M7.7 16.2 L16.3 16.2 L15.2 21 L8.8 21 Z" fill={SKIRT} />
      <path d="M7.7 16.2 L16.3 16.2 L16.1 17.2 L7.9 17.2 Z" fill="#2c2a32" />
      {/* 블라우스 */}
      <path d="M12 9.4 L16.9 11.4 L16.4 16.6 L7.6 16.6 L7.1 11.4 Z" fill={BLOUSE} />
      <path d="M12 9.4 L13.4 11 L12 15.4 L10.6 11 Z" fill={BLOUSE_S} opacity="0.7" />
      <circle cx="12" cy="12.4" r="0.22" fill={BLOUSE_S} />
      <circle cx="12" cy="13.8" r="0.22" fill={BLOUSE_S} />
      {/* 목걸이 */}
      <path d="M10.6 10.4 Q12 12 13.4 10.4" stroke={GOLD} strokeWidth="0.2" fill="none" />
      <circle cx="12" cy="11.6" r="0.3" fill={GOLD} />
      {/* 팔 */}
      <rect x="6" y="11.4" width="2.2" height="5.6" rx="1" fill={BLOUSE} />
      <rect x="15.8" y="11.4" width="2.2" height="4.4" rx="1" fill={BLOUSE} />
      <circle cx="7.1" cy="17.4" r="1.05" fill={SKIN} />
      <circle cx="16.9" cy="16.2" r="1.05" fill={SKIN} />
      {/* 머리 + 긴 웨이브 금발 */}
      <path d="M8.2 5.6 Q6.3 10.4 7.6 14.8 Q8.5 12.6 8.4 11 Q7.9 8.2 9.1 6.4 Z" fill="#d8b25f" />
      <path d="M15.8 5.6 Q17.7 10.4 16.4 14.8 Q15.5 12.6 15.6 11 Q16.1 8.2 14.9 6.4 Z" fill="#e0bd70" />
      <path d="M8 7.4 Q7.2 10.6 7.9 13.2" stroke="#f0d493" strokeWidth="0.22" fill="none" opacity="0.8" />
      <path d="M16 7.4 Q16.8 10.6 16.1 13.2" stroke="#f0d493" strokeWidth="0.22" fill="none" opacity="0.8" />
      <circle cx="12" cy="6.2" r="3.7" fill={SKIN} />
      <path d="M8.3 6.6 Q8.1 2.3 12 2.2 Q15.9 2.3 15.7 6.6 Q14.6 4 12 4.2 Q9.4 4 8.3 6.6 Z" fill="#e6c477" />
      <path d="M9.4 5 Q11.6 3.2 14.2 4.2" stroke="#f4dda2" strokeWidth="0.3" fill="none" strokeLinecap="round" />
      {/* 떠다니는 문서 */}
      <motion.g
        animate={working ? { y: [0, -0.7, 0], opacity: [0.75, 1, 0.75] } : { opacity: 0.6 }}
        transition={{ duration: 2.6, repeat: Infinity }}
      >
        <g transform="rotate(-9 20 13)">
          <rect x="17.8" y="11.2" width="4.4" height="5.4" rx="0.3" fill="#fdf9ee" />
          <rect x="17.8" y="11.2" width="4.4" height="5.4" rx="0.3" fill="none" stroke={GOLD} strokeWidth="0.14" opacity="0.7" />
          <path d="M18.5 12.6 H21.5 M18.5 13.8 H21.2 M18.5 15 H21.5" stroke="#a08f72" strokeWidth="0.2" />
        </g>
        <g transform="rotate(12 21 11.8)">
          <rect x="19.2" y="9.6" width="3.6" height="4.4" rx="0.3" fill="#fdf9ee" opacity="0.92" />
          <rect x="19.2" y="9.6" width="3.6" height="4.4" rx="0.3" fill="none" stroke={GOLD} strokeWidth="0.12" opacity="0.55" />
          <path d="M19.9 10.8 H22.2 M19.9 11.9 H21.8" stroke="#a08f72" strokeWidth="0.18" />
        </g>
      </motion.g>
      {/* 빛 구슬 */}
      <motion.g
        animate={{ opacity: [0.55, 1, 0.55], scale: [0.94, 1.08, 0.94] }}
        transition={{ duration: 2.4, repeat: Infinity }}
        style={{ transformOrigin: '3.4px 9.4px' }}
      >
        <circle cx="3.4" cy="9.4" r="1.5" fill={GOLD} opacity="0.28" />
        <circle cx="3.4" cy="9.4" r="0.75" fill="#ffdf9a" />
        <path d="M3.4 7.3 V8.2 M3.4 10.6 V11.5 M1.3 9.4 H2.2 M4.6 9.4 H5.5" stroke={GOLD} strokeWidth="0.2" />
      </motion.g>
    </g>
  );
}

/** 대표 — 외형 선택 색을 그대로 쓰는 예복 */
function SovereignBody({ palette, sigil }: { palette: Props['palette']; sigil: string }) {
  return (
    <g>
      <rect x="9.5" y="18" width="2.2" height="7" fill="#2a2530" />
      <rect x="12.3" y="18" width="2.2" height="7" fill="#221e28" />
      <rect x="8.9" y="24.6" width="3.2" height="1.5" rx="0.6" fill="#15121a" />
      <rect x="12" y="24.6" width="3.2" height="1.5" rx="0.6" fill="#15121a" />
      {/* 예복 */}
      <path d="M12 9 L18 11.8 L18.8 23.6 L5.2 23.6 L6 11.8 Z" fill={palette.robe} />
      <path d="M12 9 L14.2 11 L12 23 L9.8 11 Z" fill={palette.trim} opacity="0.9" />
      {/* 어깨 장식 */}
      <path d="M6 11.8 L4 9.4 L6.8 7.6 Z" fill={palette.trim} />
      <path d="M18 11.8 L20 9.4 L17.2 7.6 Z" fill={palette.trim} />
      {/* 벨트 */}
      <rect x="7.4" y="16.2" width="9.2" height="1" fill="#d9a441" />
      <circle cx="12" cy="16.7" r="0.7" fill="#f0cd85" />
      {/* 머리 */}
      <circle cx="12" cy="6.2" r="3.7" fill={SKIN} />
      <path d="M8.3 5.6 Q9.4 2.4 12 2.4 Q14.6 2.4 15.7 5.6 Q13.9 4.2 12 4.5 Q10.1 4.2 8.3 5.6 Z" fill="#3a2a1e" />
      {/* 서클릿 */}
      <path d="M8.6 5 L12 3.6 L15.4 5" stroke="#f0cd85" strokeWidth="0.4" fill="none" />
      <circle cx="12" cy="3.6" r="0.55" fill="#ffe6a8" />
      <text x="12" y="21" textAnchor="middle" fontSize="4.4" fill="#0d0b0f" opacity="0.45">
        {sigil}
      </text>
    </g>
  );
}

/* ────────────────────────────── 본체 ────────────────────────────── */

export default function CharacterSprite({ palette, sigil, state, jobClass }: Props) {
  const m = bodyMotion(state);
  const mark = overhead(state);
  const working = ['fighting', 'writing', 'thinking', 'collaborating', 'mailing', 'working'].includes(state);

  return (
    <g>
      {/* 그림자 */}
      <ellipse cx="12" cy="26.6" rx="5.2" ry="1.4" fill="#000" opacity="0.32" />

      {/* 작업 중 오라 — SVG 의 r 속성은 애니메이션 대상으로 쓰지 않는다
          (framer-motion 이 중간 프레임에서 undefined 를 넣어 경고가 발생한다) */}
      {working ? (
        <motion.circle
          cx="12"
          cy="17"
          r="9.4"
          fill={palette.aura}
          style={{ transformOrigin: '12px 17px' }}
          animate={{ opacity: [0.05, 0.2, 0.05], scale: [0.92, 1.06, 0.92] }}
          transition={{ duration: 1.8, repeat: Infinity }}
        />
      ) : null}

      <motion.g animate={m.animate} transition={m.transition}>
        {jobClass === 'strategist' ? <StrategistBody working={working} /> : null}
        {jobClass === 'rune_engineer' ? <EngineerBody working={working} /> : null}
        {jobClass === 'sage' ? <SageBody working={working} /> : null}
        {jobClass === 'sovereign' ? <SovereignBody palette={palette} sigil={sigil} /> : null}
      </motion.g>

      {mark ? (
        <motion.text
          x="12"
          y="1.4"
          textAnchor="middle"
          fontSize="4.4"
          fill={mark.color}
          animate={{ y: [1.4, 0.3, 1.4], opacity: [0.7, 1, 0.7] }}
          transition={{ duration: 1.4, repeat: Infinity }}
          style={{ pointerEvents: 'none' }}
        >
          {mark.glyph}
        </motion.text>
      ) : null}
    </g>
  );
}
