/**
 * 캐릭터 스프라이트 (SVG, 24×28 로컬 좌표계).
 *
 * 제공받은 캐릭터 아트를 그대로 옮긴 도형 버전이다.
 *  - strategist    엘레나 · 전술 서기관   : 회로 무늬 네이비 수트 + 은빛 스카프 + 이어피스 + 홀로그램 결재판 + 레이스업 부츠
 *  - rune_engineer 카일 · 룬 마법공학자   : 시안 회로 롱코트 + AR 글래스 + 장갑 + 홀로그램 패널
 *  - sage          올리비아 · 공감의 현자 : 샴페인 실크 블라우스 + 블랙 펜슬 스커트 + 금색 펜 + 떠다니는 문서 + 구체형 드론
 *  - sovereign     대표                  : 금장 트림 예복 (창립 시 고른 외형 색을 따른다).
 *                                          남/여 두 실루엣 중 고를 수 있다 (gender prop).
 *
 * 행동 애니메이션은 employee.state 하나에서만 파생된다. 상태별 소품(홀로그램 키보드,
 * 데이터 큐브, 황금 방어막, 보고용 결과 상자)도 같은 값에서 켜지고 꺼지므로,
 * 화면에 보이는 동작과 실제 업무 상태가 어긋날 수 없다.
 *
 * 크게 보이는 자리(카드·면담·직원 패널)는 CharacterPortrait 가 실사 이미지로 대체한다.
 * 여기 SVG 는 오피스를 돌아다니는 작은 캐릭터와, 이미지가 없을 때의 대체본이다.
 */
import { motion } from 'framer-motion';
import type { AgentState, CeoGender, JobClass } from '@/types';

interface Props {
  palette: { robe: string; trim: string; aura: string };
  sigil: string;
  state: AgentState;
  jobClass: JobClass;
  /** jobClass 가 'sovereign' 일 때만 쓰인다. 기본값은 'male'. */
  gender?: CeoGender;
}

const SKIN = '#e8c9a8';
const SKIN_SHADE = '#d3ad89';

/* ───────────────────────── 상태별 몸 움직임 ───────────────────────── */

function bodyMotion(state: AgentState) {
  switch (state) {
    case 'walking':
      // 등뼈를 세우고 당당하게 — 위아래 반동만 주고 기울이지 않는다
      return { animate: { y: [0, -1.1, 0] }, transition: { duration: 0.42, repeat: Infinity } };
    case 'fighting':
      return {
        animate: { x: [0, 1.4, -1, 0], rotate: [0, 1.6, -1.6, 0] },
        transition: { duration: 0.5, repeat: Infinity },
      };
    case 'writing':
    case 'collaborating':
      return { animate: { rotate: [0, 1.4, 0, -1.4, 0] }, transition: { duration: 1.6, repeat: Infinity } };
    case 'thinking':
      return { animate: { y: [0, -0.5, 0] }, transition: { duration: 2.2, repeat: Infinity } };
    case 'mailing':
      // 보고 — 가볍게 목례한다
      return { animate: { rotate: [0, 6, 0] }, transition: { duration: 2, repeat: Infinity } };
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

interface BodyProps {
  state: AgentState;
  working: boolean;
}

/* ─────────── 엘레나 · 전술 서기관 (총무 매니저, 여성) ─────────── */

function StrategistBody({ state, working }: BodyProps) {
  const NAVY = '#22345f';
  const NAVY_D = '#182848';
  const CIRCUIT = '#4a76c4';
  const SCARF = '#9aa9bb';
  const reporting = state === 'mailing';

  return (
    <g>
      {/* 다리 + 레이스업 부츠 */}
      <rect x="9.4" y="17.6" width="2.2" height="6.4" fill={NAVY_D} />
      <rect x="12.4" y="17.6" width="2.2" height="6.4" fill={NAVY} />
      <rect x="9.1" y="23.4" width="2.8" height="2.7" rx="0.5" fill="#191a1e" />
      <rect x="12.2" y="23.4" width="2.8" height="2.7" rx="0.5" fill="#191a1e" />
      <path d="M9.4 24.2 H11.6 M9.4 25 H11.6 M12.5 24.2 H14.7 M12.5 25 H14.7" stroke="#3a3c42" strokeWidth="0.18" />

      {/* 수트 재킷 */}
      <path d="M12 9.4 L17.4 11.6 L17.9 18.6 L6.1 18.6 L6.6 11.6 Z" fill={NAVY} />
      {/* 원단에 짜여 있는 회로 무늬 */}
      <g stroke={CIRCUIT} strokeWidth="0.18" fill="none" opacity="0.85">
        <path d="M7.6 12.6 L7.6 14.6 L9 15.6 L9 17.8" />
        <path d="M16.4 12.4 L16.4 14.2 L15.1 15.2 L15.1 18" />
        <path d="M8.8 12 L10 12.9" />
        <path d="M10.2 19.4 L10.2 22 M13.8 19.6 L13.8 22.4" />
      </g>
      <circle cx="9" cy="15.6" r="0.24" fill={CIRCUIT} />
      <circle cx="15.1" cy="15.2" r="0.22" fill={CIRCUIT} />
      {/* 셔츠 + 얇은 실크 스카프 (넥타이 대신) */}
      <path d="M12 9.4 L14.4 10.6 L12 16.6 L9.6 10.6 Z" fill={NAVY_D} />
      <path d="M10.3 9.5 Q12 11.3 13.7 9.5 L13.4 10.9 Q12 12.2 10.6 10.9 Z" fill={SCARF} />
      <path d="M11.4 11.9 L12.7 11.7 L12.4 15 L11.8 15 Z" fill={SCARF} opacity="0.92" />
      {/* 라펠 */}
      <path d="M12 9.4 L13.2 12.4 L12 13.4 L10.8 12.4 Z" fill={NAVY_D} opacity="0.6" />

      {/* 팔 */}
      {reporting ? (
        // 보고 자세 — 한쪽 손을 가슴에 얹는다
        <>
          <rect x="5.4" y="11.4" width="2.3" height="6.6" rx="1" fill={NAVY_D} />
          <circle cx="6.5" cy="18.4" r="1.1" fill={SKIN_SHADE} />
          <path d="M17.4 11.8 Q18.6 14 15.4 14.6" stroke={NAVY_D} strokeWidth="2.1" fill="none" strokeLinecap="round" />
          <circle cx="14.6" cy="14.6" r="1.05" fill={SKIN} />
        </>
      ) : (
        <>
          <rect x="5.4" y="11.4" width="2.3" height="6.6" rx="1" fill={NAVY_D} />
          <rect x="16.3" y="11.4" width="2.3" height="5.2" rx="1" fill={NAVY_D} />
          <circle cx="6.5" cy="18.4" r="1.1" fill={SKIN_SHADE} />
          <circle cx="17.5" cy="17.2" r="1.1" fill={SKIN} />
        </>
      )}

      {/* 로우번 (머리보다 먼저 그려 뒤쪽에 놓는다) */}
      <ellipse cx="15.4" cy="7.9" rx="1.5" ry="1.35" fill="#38281d" />
      {/* 머리 */}
      <circle cx="12" cy="6.2" r="3.7" fill={SKIN} />
      <path d="M8.3 6.4 Q8.4 2.5 12 2.4 Q15.6 2.5 15.7 6.4 Q14.9 4.1 12 4.3 Q9.1 4.1 8.3 6.4 Z" fill="#3f2c1f" />
      <path d="M9 5.2 Q11 3.4 13.4 4" stroke="#54402f" strokeWidth="0.35" fill="none" strokeLinecap="round" />
      {/* 귀에 꽂은 은빛 홀로그램 이어피스 */}
      <path d="M14.6 5.5 L15.3 7.3 L14.75 7.5 L14.3 5.7 Z" fill="#e8eef4" />
      <motion.circle
        cx="14.5"
        cy="5.5"
        r="0.45"
        fill="#bfe9ff"
        animate={{ opacity: [0.55, 1, 0.55] }}
        transition={{ duration: 1.6, repeat: Infinity }}
      />

      {/* 데이터가 흐르는 투명 결재판 */}
      <motion.g
        initial={false}
        animate={working ? { y: [0, -0.5, 0], opacity: [0.9, 1, 0.9] } : { opacity: 0.8 }}
        transition={{ duration: 2.2, repeat: Infinity }}
      >
        <rect x="17.3" y="11.8" width="5.8" height="4.6" rx="0.35" fill="#7fd6f5" opacity="0.26" />
        <rect x="17.3" y="11.8" width="5.8" height="4.6" rx="0.35" fill="none" stroke="#9fe6ff" strokeWidth="0.18" />
        {/* 결재판 집게 */}
        <rect x="19" y="11.4" width="2.4" height="0.7" rx="0.2" fill="#cfe7f2" />
        <rect x="18" y="13" width="0.8" height="1.5" fill="#cdf1ff" />
        <rect x="19.2" y="12.3" width="0.8" height="2.2" fill="#cdf1ff" />
        <rect x="20.4" y="12.8" width="0.8" height="1.7" fill="#cdf1ff" />
        <rect x="21.6" y="12" width="0.8" height="2.5" fill="#cdf1ff" />
        <ellipse cx="19.4" cy="15.5" rx="1.5" ry="0.7" fill="none" stroke="#9fe6ff" strokeWidth="0.14" />
        <motion.rect
          x="17.5"
          y="12.1"
          width="5.4"
          height="0.14"
          fill="#e6faff"
          initial={{ y: 12.1, opacity: 0 }}
          animate={{ y: [12.1, 16.1, 12.1], opacity: [0, 0.9, 0] }}
          transition={{ duration: 2.4, repeat: Infinity }}
        />
      </motion.g>

      {/* 작업 중 — 허공의 결재 서류를 손가락으로 스와이프해 분류한다 */}
      {state === 'collaborating' || state === 'thinking' ? (
        <motion.g
          animate={{ x: [0, 1.2, 0], opacity: [0.5, 0.95, 0.5] }}
          transition={{ duration: 1.5, repeat: Infinity }}
        >
          <rect x="0.4" y="11.4" width="3.4" height="4.2" rx="0.3" fill="#bfe9ff" opacity="0.35" />
          <rect x="1.2" y="10.4" width="3.4" height="4.2" rx="0.3" fill="#bfe9ff" opacity="0.55" />
        </motion.g>
      ) : null}

      {/* 보고 — 빛나는 결과 상자를 건넨다 */}
      {reporting ? (
        <motion.g animate={{ y: [0, -0.5, 0] }} transition={{ duration: 1.2, repeat: Infinity }}>
          <motion.circle
            cx="18.3"
            cy="18"
            r="2.4"
            fill="#ffe6a8"
            animate={{ opacity: [0.12, 0.35, 0.12] }}
            transition={{ duration: 1.4, repeat: Infinity }}
          />
          <rect x="16.6" y="16.6" width="3.4" height="2.8" rx="0.3" fill="#f0cd85" />
          <rect x="16.6" y="17.6" width="3.4" height="0.5" fill="#c79a3e" />
          <rect x="17.9" y="16.6" width="0.8" height="2.8" fill="#c79a3e" opacity="0.8" />
        </motion.g>
      ) : null}
    </g>
  );
}

/* ────────── 카일 · 룬 마법공학자 (수석 연구 엔지니어, 남성) ────────── */

function EngineerBody({ state, working }: BodyProps) {
  const COAT = '#232937';
  const COAT_D = '#161a24';
  const SHIRT = '#20242e';
  const GLOVE = '#2c4150';
  const CYAN = '#3fd2e8';
  const fighting = state === 'fighting';
  const handing = state === 'collaborating';

  return (
    <g>
      {/* 다리 */}
      <rect x="9.6" y="18" width="2.2" height="6.6" fill="#2a2f3a" />
      <rect x="12.2" y="18" width="2.2" height="6.6" fill="#22262f" />
      <rect x="8.9" y="24.2" width="3.2" height="1.9" rx="0.6" fill="#0c0d11" />
      <rect x="12" y="24.2" width="3.2" height="1.9" rx="0.6" fill="#0c0d11" />

      {/* 안에 입은 지퍼 테크웨어 */}
      <path d="M12 9.2 L15.6 10.8 L15.6 17.4 L8.4 17.4 L8.4 10.8 Z" fill={SHIRT} />
      <path d="M12 9.6 L12 17.2" stroke="#3a4150" strokeWidth="0.2" />
      <rect x="9.4" y="12.4" width="1.6" height="1.1" rx="0.15" fill="#2a3040" />
      <rect x="13" y="12.4" width="1.6" height="1.1" rx="0.15" fill="#2a3040" />
      {/* 벨트 */}
      <rect x="8.6" y="16.4" width="6.8" height="0.9" fill="#1b1f28" />
      <rect x="11.2" y="16.3" width="1.6" height="1.1" rx="0.14" fill="#9aa3ae" />

      {/* 롱코트 */}
      <path d="M12 9 L17.8 11.6 L18.6 23.4 L14.6 23.4 L13.4 12.6 Z" fill={COAT} />
      <path d="M12 9 L6.2 11.6 L5.4 23.4 L9.4 23.4 L10.6 12.6 Z" fill={COAT} />
      <path d="M12 9 L13.4 12.6 L14.6 23.4 L14 23.4 L12.8 12.4 Z" fill={COAT_D} />
      {/* 코트 외곽 하이라이트 — 어두운 배경에서도 실루엣이 보이게 */}
      <path
        d="M12 9 L17.8 11.6 L18.6 23.4 M12 9 L6.2 11.6 L5.4 23.4"
        stroke="#5c6779"
        strokeWidth="0.28"
        fill="none"
        opacity="0.9"
      />
      {/* 세운 깃 */}
      <path d="M9.4 9.6 L12 9 L14.6 9.6 L14.2 11.6 L9.8 11.6 Z" fill="#2e3547" />
      {/* 시안 회로 라인 */}
      <g stroke={CYAN} strokeWidth="0.22" fill="none" opacity="0.95">
        <path d="M7.6 13 L7.6 16.6 L9 17.8 L9 21.8" />
        <path d="M16.4 12.8 L16.4 15.4 L15 16.6 L15 21.2" />
        <path d="M6.4 18.6 L7.4 19.6" opacity="0.7" />
      </g>
      <circle cx="7.6" cy="16.6" r="0.32" fill={CYAN} />
      <circle cx="15" cy="16.6" r="0.28" fill={CYAN} />
      {/* 카고 포켓 */}
      <rect x="6.4" y="14.4" width="1.9" height="1.5" rx="0.2" fill={COAT_D} />
      <rect x="15.8" y="14.4" width="1.9" height="1.5" rx="0.2" fill={COAT_D} />

      {/* 팔 + 장갑 */}
      {fighting ? (
        // 전투 — 양손을 홀로그램 키보드 위로 올린다
        <>
          <path d="M6.6 11.8 Q5.2 15.4 8.2 17.6" stroke={COAT_D} strokeWidth="2.2" fill="none" strokeLinecap="round" />
          <path d="M17.4 11.8 Q18.8 15.4 15.8 17.6" stroke={COAT_D} strokeWidth="2.2" fill="none" strokeLinecap="round" />
          <circle cx="8.6" cy="18" r="1.05" fill={GLOVE} />
          <circle cx="15.4" cy="18" r="1.05" fill={GLOVE} />
        </>
      ) : (
        <>
          <rect x="5.1" y="11.6" width="2.4" height="6.4" rx="1" fill={COAT_D} />
          {/* 한 손은 안경테를 매만진다 */}
          <path d="M17.2 11.8 Q19.4 9.6 16.4 7.2" stroke={COAT_D} strokeWidth="2.2" fill="none" strokeLinecap="round" />
          <circle cx="6.3" cy="18.4" r="1.05" fill={GLOVE} />
          <circle cx="16" cy="6.6" r="1.05" fill={GLOVE} />
        </>
      )}

      {/* 머리 — 헝클어진 진갈색 짧은 머리 */}
      <circle cx="12" cy="6.2" r="3.7" fill={SKIN} />
      <path
        d="M8.4 5 Q9.2 1.8 12 2.1 Q14.9 1.8 15.6 5.2 Q14.7 3.9 13.5 4.4 Q12.6 3.1 11.5 4.3 Q10.1 3.5 8.4 5 Z"
        fill="#4a3323"
      />
      <path d="M9.2 3.7 L10.2 2.5 M11.5 3.2 L12.3 2.1 M13.5 3.7 L14.4 2.6" stroke="#5d422e" strokeWidth="0.32" strokeLinecap="round" />
      {/* 가벼운 턱수염 흔적 */}
      <path d="M9.5 7.4 Q12 9.5 14.5 7.4 Q12 8.5 9.5 7.4 Z" fill="#8a6a4c" opacity="0.5" />
      {/* AR 스마트 글래스 — 렌즈 위로 코드가 흘러내린다 */}
      <rect x="9" y="5.7" width="6" height="1" rx="0.45" fill="#16242c" />
      <rect x="9.25" y="5.9" width="5.5" height="0.6" rx="0.3" fill={CYAN} opacity="0.9" />
      <motion.rect
        x="9.25"
        y="5.9"
        width="1.1"
        height="0.6"
        fill="#e6feff"
        initial={{ x: 9.25, opacity: 0 }}
        animate={{ x: [9.25, 13.65, 9.25], opacity: [0, 0.9, 0] }}
        transition={{ duration: 1.8, repeat: Infinity }}
      />
      <rect x="15" y="5.9" width="1" height="0.28" rx="0.14" fill="#16242c" />

      {/* 관자놀이 옆 작은 HUD */}
      {!fighting ? (
        <motion.g animate={{ opacity: [0.4, 0.85, 0.4] }} transition={{ duration: 2.2, repeat: Infinity }}>
          <rect x="2.6" y="3.6" width="4.6" height="2.8" rx="0.3" fill={CYAN} opacity="0.2" />
          <rect x="2.6" y="3.6" width="4.6" height="2.8" rx="0.3" fill="none" stroke={CYAN} strokeWidth="0.14" />
          <path d="M3.4 5.4 q0.6 -0.9 1.4 0 q0.6 -0.6 1.4 0" stroke="#cdf6ff" strokeWidth="0.16" fill="none" />
        </motion.g>
      ) : null}

      {/* 홀로그램 패널 (기본) */}
      {!fighting && !handing ? (
        <motion.g
          initial={false}
          animate={working ? { y: [0, -0.6, 0], opacity: [0.85, 1, 0.85] } : { opacity: 0.75 }}
          transition={{ duration: 1.8, repeat: Infinity }}
        >
          <path d="M0.4 12.2 L6 10.6 L6 15.6 L0.4 17.2 Z" fill={CYAN} opacity="0.24" />
          <path d="M0.4 12.2 L6 10.6 L6 15.6 L0.4 17.2 Z" fill="none" stroke={CYAN} strokeWidth="0.18" />
          <circle cx="2.4" cy="14.4" r="0.85" fill="none" stroke="#cdf6ff" strokeWidth="0.18" />
          <circle cx="2.4" cy="14.4" r="0.3" fill="#cdf6ff" />
          <path d="M4 12.6 L5.6 12.2 M4 13.6 L5.2 13.3 M4 15.4 L5.6 15" stroke="#cdf6ff" strokeWidth="0.16" />
        </motion.g>
      ) : null}

      {/* 전투 — 홀로그램 키보드를 두드려 푸른 에너지를 발사한다 */}
      {fighting ? (
        <g>
          <rect x="6.6" y="18.8" width="10.8" height="2.2" rx="0.3" fill={CYAN} opacity="0.2" />
          <rect x="6.6" y="18.8" width="10.8" height="2.2" rx="0.3" fill="none" stroke={CYAN} strokeWidth="0.16" />
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <motion.rect
              key={i}
              x={7.1 + i * 1.7}
              y={19.2}
              width="1.3"
              height="1.4"
              rx="0.16"
              fill="#cdf6ff"
              animate={{ opacity: [0.25, 0.95, 0.25] }}
              transition={{ duration: 0.5, repeat: Infinity, delay: i * 0.07 }}
            />
          ))}
          <motion.g animate={{ x: [0, 7, 14], opacity: [1, 0.9, 0] }} transition={{ duration: 0.7, repeat: Infinity }}>
            <ellipse cx="18.4" cy="13.4" rx="1.5" ry="0.5" fill="#8ff0ff" />
            <ellipse cx="17" cy="13.4" rx="2.2" ry="0.24" fill="#8ff0ff" opacity="0.6" />
          </motion.g>
        </g>
      ) : null}

      {/* 협업 — 분석 데이터를 빛나는 큐브로 뭉쳐 넘긴다 */}
      {handing ? (
        <motion.g
          animate={{ x: [0, 4.5, 9], y: [0, -1.6, 0], opacity: [1, 1, 0] }}
          transition={{ duration: 1.6, repeat: Infinity }}
        >
          <path d="M17.6 12.4 L19.6 11.4 L21.6 12.4 L21.6 14.8 L19.6 15.8 L17.6 14.8 Z" fill={CYAN} opacity="0.45" />
          <path d="M17.6 12.4 L19.6 13.4 L21.6 12.4 M19.6 13.4 L19.6 15.8" stroke="#e6feff" strokeWidth="0.16" fill="none" />
        </motion.g>
      ) : null}
    </g>
  );
}

/* ────────── 올리비아 · 공감의 현자 (행동 심리학 교수, 여성) ────────── */

function SageBody({ state, working }: BodyProps) {
  const BLOUSE = '#e9dcc2';
  const BLOUSE_S = '#cdbc9c';
  const SKIRT = '#2f2c33';
  const GOLD = '#f0b957';
  const writing = state === 'writing';
  const defending = state === 'fighting';

  return (
    <g>
      {/* 다리 + 하이힐 */}
      <rect x="10" y="20.8" width="1.8" height="4.2" fill={SKIN_SHADE} />
      <rect x="12.3" y="20.8" width="1.8" height="4.2" fill={SKIN} />
      <path d="M9.8 25 L11.9 25 L11.6 26.2 L10.4 26.2 Z" fill="#26232a" />
      <path d="M10.9 26.2 L11.4 26.2 L11.3 26.9 L11 26.9 Z" fill="#26232a" />
      <path d="M12.3 25 L14.4 25 L14.1 26.2 L12.9 26.2 Z" fill="#26232a" />
      <path d="M13.4 26.2 L13.9 26.2 L13.8 26.9 L13.5 26.9 Z" fill="#26232a" />

      {/* 무릎 아래로 내려오는 H라인 펜슬 스커트 */}
      <path d="M7.9 16.2 L16.1 16.2 L15.2 21.6 L8.8 21.6 Z" fill={SKIRT} />
      <path d="M7.9 16.2 L16.1 16.2 L15.95 17.3 L8.05 17.3 Z" fill="#3c3841" />
      <path d="M12 17.5 L12 21.4" stroke="#413d47" strokeWidth="0.16" opacity="0.8" />

      {/* 샴페인 실크 블라우스 */}
      <path d="M12 9.4 L16.9 11.4 L16.4 16.6 L7.6 16.6 L7.1 11.4 Z" fill={BLOUSE} />
      <path d="M12 9.4 L13.4 11 L12 15.4 L10.6 11 Z" fill={BLOUSE_S} opacity="0.55" />
      {/* 셔츠 칼라 */}
      <path d="M10.3 9.6 L12 11.6 L13.7 9.6 L13.2 11.4 L12 12.6 L10.8 11.4 Z" fill={BLOUSE_S} opacity="0.85" />
      <circle cx="12" cy="13.4" r="0.2" fill={BLOUSE_S} />
      <circle cx="12" cy="14.8" r="0.2" fill={BLOUSE_S} />
      {/* 금 목걸이 */}
      <path d="M10.7 10.6 Q12 12.1 13.3 10.6" stroke={GOLD} strokeWidth="0.2" fill="none" />
      <circle cx="12" cy="11.9" r="0.28" fill={GOLD} />

      {/* 팔 — 작성 중에는 지휘하듯 손을 들고 금색 펜을 쥔다 */}
      <rect x="6" y="11.4" width="2.2" height="5.6" rx="1" fill={BLOUSE} />
      <circle cx="7.1" cy="17.4" r="1.05" fill={SKIN} />
      {writing ? (
        <motion.g
          animate={{ rotate: [-6, 8, -6] }}
          transition={{ duration: 2.4, repeat: Infinity }}
          style={{ transformOrigin: '16px 12px' }}
        >
          <path d="M16 11.6 Q18.6 11 19.4 9" stroke={BLOUSE} strokeWidth="2" fill="none" strokeLinecap="round" />
          <circle cx="19.7" cy="8.6" r="1.05" fill={SKIN} />
          <path d="M19.2 8 L21.4 6.4" stroke={GOLD} strokeWidth="0.34" strokeLinecap="round" />
        </motion.g>
      ) : (
        <>
          <path d="M16 11.6 Q18.2 12.6 17.4 14.8" stroke={BLOUSE} strokeWidth="2" fill="none" strokeLinecap="round" />
          <circle cx="17.3" cy="15.4" r="1.05" fill={SKIN} />
        </>
      )}

      {/* 굵은 웨이브 금발 — 한쪽 어깨로 늘어뜨린다 */}
      <path
        d="M15.6 5.4 Q18.4 9.4 17.4 14.2 Q16.6 17.4 14.5 17.9 Q16.1 15 15.9 12.6 Q15.7 9.4 14.6 6.6 Z"
        fill="#dcb768"
      />
      <path d="M16.7 7.6 Q17.8 11 16.7 14.4" stroke="#f2d795" strokeWidth="0.28" fill="none" opacity="0.9" />
      <path d="M8.5 5.8 Q7.1 8.6 8 11.4" fill="none" stroke="#d0aa5c" strokeWidth="1" strokeLinecap="round" />
      <circle cx="12" cy="6.2" r="3.7" fill={SKIN} />
      <path d="M8.3 6.6 Q8.1 2.3 12 2.2 Q15.9 2.3 15.7 6.6 Q14.6 4 12 4.2 Q9.4 4 8.3 6.6 Z" fill="#e6c477" />
      <path d="M9.4 5 Q11.6 3.2 14.2 4.2" stroke="#f4dda2" strokeWidth="0.3" fill="none" strokeLinecap="round" />
      {/* 귀걸이 */}
      <circle cx="8.7" cy="7.4" r="0.28" fill={GOLD} />

      {/* 허공에 떠 있는 반투명 문서 */}
      {!defending ? (
        <motion.g
          initial={false}
          animate={working ? { y: [0, -0.7, 0], opacity: [0.85, 1, 0.85] } : { opacity: 0.68 }}
          transition={{ duration: 2.6, repeat: Infinity }}
        >
          <g transform="rotate(-9 20 13)">
            <rect x="17.6" y="10.8" width="4.6" height="5.6" rx="0.3" fill="#fdf9ee" />
            <rect x="17.6" y="10.8" width="4.6" height="5.6" rx="0.3" fill="none" stroke={GOLD} strokeWidth="0.14" opacity="0.75" />
            {/* 막대 그래프 */}
            <rect x="18.3" y="13.6" width="0.5" height="1.4" fill="#b9a887" />
            <rect x="19.1" y="12.9" width="0.5" height="2.1" fill="#b9a887" />
            <rect x="19.9" y="13.3" width="0.5" height="1.7" fill="#b9a887" />
            <path d="M18.3 12.2 H21.6" stroke="#a08f72" strokeWidth="0.2" />
            <motion.path
              d="M18.3 15.8 H21.6"
              stroke="#a08f72"
              strokeWidth="0.2"
              animate={writing ? { pathLength: [0, 1, 0] } : { pathLength: 1 }}
              transition={{ duration: 2.4, repeat: Infinity }}
            />
          </g>
          <g transform="rotate(13 21 11.4)">
            <rect x="19.4" y="9.2" width="3.6" height="4.4" rx="0.3" fill="#fdf9ee" opacity="0.92" />
            <rect x="19.4" y="9.2" width="3.6" height="4.4" rx="0.3" fill="none" stroke={GOLD} strokeWidth="0.12" opacity="0.6" />
            <circle cx="21.2" cy="11.4" r="0.9" fill="none" stroke="#b9a887" strokeWidth="0.22" />
            <path d="M21.2 10.5 V11.4 L22 11.7" stroke="#b9a887" strokeWidth="0.18" fill="none" />
          </g>
        </motion.g>
      ) : null}

      {/* 협상 — 붉은 공격을 황금 방어막으로 튕겨낸다 */}
      {defending ? (
        <g>
          <motion.path
            d="M17.4 8.4 A 6 6 0 0 1 17.4 19.6"
            stroke={GOLD}
            strokeWidth="0.7"
            fill="none"
            strokeLinecap="round"
            animate={{ opacity: [0.4, 1, 0.4] }}
            transition={{ duration: 0.9, repeat: Infinity }}
          />
          <motion.path
            d="M18.6 9.6 A 5 5 0 0 1 18.6 18.4"
            stroke="#ffe6a8"
            strokeWidth="0.3"
            fill="none"
            animate={{ opacity: [0.15, 0.7, 0.15] }}
            transition={{ duration: 0.9, repeat: Infinity, delay: 0.15 }}
          />
          <motion.circle
            cx="22"
            cy="14"
            r="0.7"
            fill="#e0503f"
            animate={{ cx: [24, 19.2, 24], opacity: [0.9, 0.2, 0.9] }}
            transition={{ duration: 1.1, repeat: Infinity }}
          />
        </g>
      ) : null}

      {/* 심리 분석용 구체형 AI 드론 — 결정 뿔이 달린 빛나는 구체 */}
      <motion.g
        animate={{ y: [0, -0.9, 0] }}
        transition={{ duration: 2.8, repeat: Infinity }}
      >
        <motion.circle
          cx="3.4"
          cy="8.6"
          r="1.9"
          fill={GOLD}
          animate={{ opacity: [0.14, 0.3, 0.14] }}
          transition={{ duration: 2, repeat: Infinity }}
        />
        {[0, 60, 120, 180, 240, 300].map((deg) => (
          <path
            key={deg}
            d="M3.4 6.9 L3.75 7.7 L3.4 8.1 L3.05 7.7 Z"
            fill="#f6e3b4"
            transform={`rotate(${deg} 3.4 8.6)`}
          />
        ))}
        <circle cx="3.4" cy="8.6" r="0.8" fill="#c98a2c" />
        <circle cx="3.4" cy="8.6" r="0.5" fill="#ffdf9a" />
        <circle cx="3.2" cy="8.4" r="0.18" fill="#fffaf0" />
      </motion.g>
    </g>
  );
}

/* ───────────────── 대표 · 길드 마스터 (최종 승인권자) ───────────────── */

/**
 * 금장 자수가 들어간 예장 롱코트, 조끼가 보이는 스리피스, 금장 지팡이.
 * 코트와 자수 색은 창립 시 고른 외형(palette)을 따르므로 4가지 변형이 모두 유지된다.
 */
function SovereignBody({ palette, sigil }: { palette: Props['palette']; sigil: string }) {
  const COAT = palette.robe;
  const GOLD = palette.trim;
  const LINING = '#e6dcc4';

  return (
    <g>
      {/* 다리 + 광택 구두 */}
      <rect x="9.6" y="17.8" width="2.3" height="6.8" fill="#2a2d48" />
      <rect x="12.2" y="17.8" width="2.3" height="6.8" fill="#232640" />
      <path d="M8.8 24.4 L12 24.4 L12 26.1 L9.2 26.1 Z" fill="#17141c" />
      <path d="M12.1 24.4 L15.3 24.4 L15.1 26.1 L12.1 26.1 Z" fill="#17141c" />
      <path d="M9.4 25.6 H11.7 M12.6 25.6 H14.9" stroke={GOLD} strokeWidth="0.16" opacity="0.8" />

      {/* 코트 안감이 보이는 갈라진 자락 */}
      <path d="M8.6 12.4 L10.4 12.4 L9.8 23.4 L7.2 23.4 Z" fill={LINING} />
      <path d="M13.6 12.4 L15.4 12.4 L16.8 23.4 L14.2 23.4 Z" fill={LINING} />

      {/* 셔츠 + 넥타이 + 조끼 */}
      <path d="M12 8.9 L14.1 10.2 L13.6 16.4 L10.4 16.4 L9.9 10.2 Z" fill="#eef0f4" />
      <path d="M11.5 9.6 L12.5 9.6 L12.3 13.4 L11.7 13.4 Z" fill="#232640" />
      <path d="M10.3 10.6 L13.7 10.6 L13.4 16.6 L10.6 16.6 Z" fill="#2b2f52" />
      {[11.4, 12.4, 13.4, 14.4, 15.4].map((cy) => (
        <circle key={cy} cx="12" cy={cy} r="0.24" fill={GOLD} />
      ))}

      {/* 예장 롱코트 */}
      <path d="M12 8.8 L17.9 11.4 L18.4 23.4 L14.4 23.4 L13.5 12 Z" fill={COAT} />
      <path d="M12 8.8 L6.1 11.4 L5.6 23.4 L9.6 23.4 L10.5 12 Z" fill={COAT} />
      {/* 넓은 라펠 */}
      <path d="M12 8.8 L9.4 9.8 L10.5 13.4 L11.7 10.4 Z" fill={GOLD} opacity="0.35" />
      <path d="M12 8.8 L14.6 9.8 L13.5 13.4 L12.3 10.4 Z" fill={GOLD} opacity="0.35" />
      {/* 금장 자수 — 자락과 소맷단 */}
      <g stroke={GOLD} strokeWidth="0.26" fill="none" opacity="0.95">
        <path d="M6.6 19.4 Q8 20.4 7.4 22.2 Q7 21 6.2 21.4" />
        <path d="M17.4 19.4 Q16 20.4 16.6 22.2 Q17 21 17.8 21.4" />
        <path d="M6.4 16.4 H8.6 M15.4 16.4 H17.6" opacity="0.7" />
      </g>
      {/* 금장 벨트와 문장 */}
      <rect x="9.5" y="15.6" width="5" height="1" rx="0.2" fill={GOLD} />
      <circle cx="12" cy="16.1" r="0.85" fill="#1c1f38" />
      <text x="12" y="16.5" textAnchor="middle" fontSize="1.3" fill={GOLD}>
        {sigil}
      </text>

      {/* 견장 + 술 장식 */}
      <path d="M5.6 11.6 L4 9.2 L7.2 7.8 L8 10.4 Z" fill={GOLD} />
      <path d="M18.4 11.6 L20 9.2 L16.8 7.8 L16 10.4 Z" fill={GOLD} />
      <path d="M4.6 10.2 L4 13.4 M5.2 10.6 L4.9 13.6" stroke={GOLD} strokeWidth="0.22" />
      <path d="M19.4 10.2 L20 13.4 M18.8 10.6 L19.1 13.6" stroke={GOLD} strokeWidth="0.22" />

      {/* 팔 — 한 손은 장갑을 끼고 지팡이, 다른 손은 주머니에 */}
      <rect x="5.4" y="11.4" width="2.3" height="5.6" rx="1" fill={COAT} />
      <rect x="16.3" y="11.4" width="2.3" height="5" rx="1" fill={COAT} />
      <circle cx="6.5" cy="17.4" r="1.05" fill="#1e2030" />
      <circle cx="17.4" cy="17" r="1" fill={COAT} />

      {/* 금장 지팡이 */}
      <rect x="4.9" y="12.8" width="0.34" height="12.4" fill={GOLD} />
      <circle cx="5.06" cy="12.4" r="0.72" fill={GOLD} />
      <circle cx="5.06" cy="12.4" r="0.32" fill="#fff2cf" />
      <rect x="4.7" y="24.8" width="0.75" height="0.7" rx="0.15" fill={GOLD} />

      {/* 머리 — 물결지는 짙은 갈색 */}
      <circle cx="12" cy="6" r="3.6" fill={SKIN} />
      <path
        d="M8.4 6.2 Q8 2 12 2 Q16 2 15.6 6.2 Q15 4.6 13.6 4.6 Q12.6 3.2 11.2 4.4 Q9.6 4 8.4 6.2 Z"
        fill="#2f2620"
      />
      <path d="M9 3.8 Q10.6 2.4 12.4 3 M13 3 Q14.2 2.6 15 3.6" stroke="#463a30" strokeWidth="0.3" fill="none" strokeLinecap="round" />
    </g>
  );
}

/** 여성 대표 실루엣 — 같은 금장 예복 컨셉을 긴 코트드레스 + 흐르는 머리로 표현한다. */
function SovereignBodyFemale({ palette, sigil }: { palette: Props['palette']; sigil: string }) {
  const COAT = palette.robe;
  const GOLD = palette.trim;
  const LINING = '#e6dcc4';

  return (
    <g>
      {/* 발 — 트럼펫 스커트 아래로 살짝 보이는 구두 코 */}
      <path d="M9.4 25.6 L12 25.6 L12 26.3 L9.1 26.3 Z" fill="#17141c" />
      <path d="M12.1 25.6 L14.7 25.6 L14.9 26.3 L12.1 26.3 Z" fill="#17141c" />

      {/* 트럼펫 스커트 — 허리에서 발치까지 넓어지는 코트드레스 */}
      <path d="M9.2 15.6 L14.8 15.6 L17.4 25.2 L6.6 25.2 Z" fill={COAT} />
      <path d="M9.6 15.6 L11.6 15.6 L10.6 25.2 L7.6 25.2 Z" fill={LINING} opacity="0.55" />
      <path d="M12.4 15.6 L14.4 15.6 L16.4 25.2 L13.4 25.2 Z" fill={LINING} opacity="0.4" />
      {/* 자락 금장 자수 */}
      <g stroke={GOLD} strokeWidth="0.24" fill="none" opacity="0.9">
        <path d="M7.4 23.4 Q9 24 8.6 25.4" />
        <path d="M16.6 23.4 Q15 24 15.4 25.4" />
        <path d="M8.2 19.4 H15.8" opacity="0.6" />
      </g>

      {/* 허리 라인을 강조하는 코르셋 벨트 + 문장 */}
      <path d="M9.6 13.8 L14.4 13.8 L14.9 15.8 L9.1 15.8 Z" fill={COAT} />
      <rect x="9.7" y="14.6" width="4.6" height="0.8" rx="0.18" fill={GOLD} />
      <circle cx="12" cy="15" r="0.72" fill="#1c1f38" />
      <text x="12" y="15.35" textAnchor="middle" fontSize="1.05" fill={GOLD}>
        {sigil}
      </text>

      {/* 몸판 — 곧게 뻗은 하이넥 보디스 */}
      <path d="M10 8.9 L14 8.9 L14.3 14 L9.7 14 Z" fill={COAT} />
      <path d="M10.8 9.4 L13.2 9.4 L13.4 13.6 L10.6 13.6 Z" fill="#eef0f4" opacity="0.9" />
      {[10.2, 11.1, 12, 12.9].map((cy) => (
        <circle key={cy} cx="12" cy={cy} r="0.2" fill={GOLD} />
      ))}
      {/* 라펠 + 견장 술 장식(작게) */}
      <path d="M10 8.9 L8.7 9.6 L9.7 12 L10.6 10 Z" fill={GOLD} opacity="0.35" />
      <path d="M14 8.9 L15.3 9.6 L14.3 12 L13.4 10 Z" fill={GOLD} opacity="0.35" />
      <path d="M8.9 9.4 L7.6 8.6 L9 7.8 L9.6 9 Z" fill={GOLD} />
      <path d="M15.1 9.4 L16.4 8.6 L15 7.8 L14.4 9 Z" fill={GOLD} />

      {/* 팔 — 한 손엔 장갑 낀 지팡이, 반대 손은 스커트 자락을 가볍게 쥔다 */}
      <rect x="7.7" y="9.6" width="1.9" height="5.2" rx="0.9" fill={COAT} />
      <rect x="14.4" y="9.6" width="1.9" height="4.6" rx="0.9" fill={COAT} />
      <circle cx="8.6" cy="15.1" r="0.9" fill="#1e2030" />
      <circle cx="15.3" cy="14.5" r="0.85" fill={COAT} />

      {/* 금장 지팡이 */}
      <rect x="8.2" y="10.6" width="0.3" height="11.6" fill={GOLD} />
      <circle cx="8.35" cy="10.2" r="0.62" fill={GOLD} />
      <circle cx="8.35" cy="10.2" r="0.26" fill="#fff2cf" />

      {/* 머리 — 어깨 아래로 흐르는 긴 머리 + 작은 티아라 */}
      <circle cx="12" cy="6.1" r="3.5" fill={SKIN} />
      <path
        d="M8.5 6.4 Q7.8 12.6 9.4 16.6 Q9.9 12 9.6 6.6 Q8.9 3.6 12 2.6 Q15.1 3.6 14.4 6.6 Q14.1 12 14.6 16.6 Q16.2 12.6 15.5 6.4 Q15.2 2 12 2 Q8.8 2 8.5 6.4 Z"
        fill="#3a2a22"
      />
      <path d="M9.2 5.4 Q10.6 3.8 12 4.4 Q13.4 3.8 14.8 5.4" stroke="#54402f" strokeWidth="0.24" fill="none" strokeLinecap="round" />
      <path d="M9.3 3.3 Q12 2 14.7 3.3" stroke={GOLD} strokeWidth="0.3" fill="none" />
      <circle cx="12" cy="2.7" r="0.28" fill={GOLD} />
    </g>
  );
}

/* ────────────────────────────── 본체 ────────────────────────────── */

export default function CharacterSprite({ palette, sigil, state, jobClass, gender = 'male' }: Props) {
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

      <motion.g animate={m.animate} transition={m.transition} style={{ transformOrigin: '12px 26px' }}>
        {jobClass === 'strategist' ? <StrategistBody state={state} working={working} /> : null}
        {jobClass === 'rune_engineer' ? <EngineerBody state={state} working={working} /> : null}
        {jobClass === 'sage' ? <SageBody state={state} working={working} /> : null}
        {jobClass === 'sovereign' && gender === 'female' ? <SovereignBodyFemale palette={palette} sigil={sigil} /> : null}
        {jobClass === 'sovereign' && gender !== 'female' ? <SovereignBody palette={palette} sigil={sigil} /> : null}
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
