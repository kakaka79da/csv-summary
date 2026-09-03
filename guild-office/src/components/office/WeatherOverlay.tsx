/**
 * 오피스 화면 위에 그리는 날씨 효과 (SVG).
 *
 * 원칙 두 가지:
 *  1) 움직임은 전부 CSS 애니메이션이다(`src/index.css` 의 wx-* 키프레임).
 *     시뮬레이션 tick 이 매 프레임 돌고 있으므로, 입자까지 React 상태로 움직이면
 *     프레임마다 수백 개 노드를 다시 만들게 된다. CSS 로 넘기면 렌더는 한 번뿐이다.
 *  2) 입자 배치는 시드 기반이라 다시 그려도 흔들리지 않는다(배경 소품과 같은 방식).
 *
 * 좌표는 오피스 viewBox 와 같은 타일 단위다. SVG 요소의 CSS transform 에서 px 는
 * user unit 으로 해석되므로, 낙하 거리 역시 타일 수를 그대로 쓴다.
 */
import { useMemo } from 'react';
import { effectSpec, type DayPhase, type WeatherCondition } from '@/lib/weather';

interface Bounds {
  x: number;
  y: number;
  w: number;
  h: number;
}

function rng(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

/** 입자 하나의 배치·속도. 컨디션마다 시드를 달리해서 비와 눈의 배열이 겹치지 않게 한다. */
interface Particle {
  x: number;
  y: number;
  len: number;
  dx: number;
  dur: number;
  delay: number;
  opacity: number;
}

function buildParticles(count: number, b: Bounds, fallSeconds: number, seed: number): Particle[] {
  const r = rng(seed);
  const out: Particle[] = [];
  for (let i = 0; i < count; i++) {
    // 낙하 시작점은 화면 위쪽 바깥. 아래로 (높이 + 여유) 만큼 내려가며 화면을 지난다.
    const dur = fallSeconds * (0.75 + r() * 0.5);
    out.push({
      // 바람에 밀려 왼쪽으로 흐르므로 오른쪽 바깥에서도 시작한다.
      x: b.x + r() * (b.w + 6) - 3,
      y: b.y - 2 - r() * 2,
      len: 0.5 + r() * 0.5,
      dx: -(1 + r() * 2),
      dur,
      // 음수 지연 — 화면이 열리자마자 이미 흩어져 내리는 상태로 보인다.
      delay: -r() * dur,
      opacity: 0.3 + r() * 0.5,
    });
  }
  return out;
}

export default function WeatherOverlay({
  condition,
  phase,
  bounds,
}: {
  condition: WeatherCondition;
  phase: DayPhase;
  bounds: Bounds;
}) {
  const spec = effectSpec(condition, phase);
  const dist = bounds.h + 4;

  const seed = condition === 'snow' ? 20260903 : condition === 'thunder' ? 77123 : 4242;
  const particles = useMemo(
    () => buildParticles(spec.particles, bounds, spec.fallSeconds, seed),
    // 입자는 개수·속도·화면 크기가 바뀔 때만 다시 만든다.
    [spec.particles, spec.fallSeconds, bounds.x, bounds.y, bounds.w, bounds.h, seed],
  );

  const isSnow = condition === 'snow';
  const nothingToDraw = spec.particles === 0 && spec.dim === 0 && !spec.haze && !spec.lightning;
  if (nothingToDraw) return null;

  return (
    <g pointerEvents="none" aria-hidden="true">
      {/* 안개·구름 층 — 흐림/안개/비/눈에서 공통으로 화면을 부옇게 만든다. */}
      {spec.haze ? (
        <g opacity={condition === 'fog' ? 0.5 : 0.26}>
          {[0, 1, 2].map((i) => (
            <ellipse
              key={`haze-${i}`}
              className="wx-drift"
              style={{ animationDuration: `${26 + i * 9}s`, animationDelay: `${-i * 5}s` }}
              cx={bounds.x + bounds.w * (0.25 + i * 0.28)}
              cy={bounds.y + bounds.h * (0.16 + i * 0.3)}
              rx={bounds.w * 0.42}
              ry={bounds.h * (condition === 'fog' ? 0.3 : 0.17)}
              fill={condition === 'fog' ? '#cfd6dd' : '#9fb0c2'}
              opacity={0.4}
            />
          ))}
        </g>
      ) : null}

      {/* 밤·궂은 날의 어두운 막 */}
      {spec.dim > 0 ? (
        <rect
          x={bounds.x}
          y={bounds.y}
          width={bounds.w}
          height={bounds.h}
          fill={phase === 'night' ? '#0b1024' : phase === 'dusk' ? '#2a1a2e' : '#131a24'}
          opacity={Math.min(0.62, spec.dim)}
        />
      ) : null}

      {/* 떨어지는 입자 — 비는 선, 눈은 원 */}
      {particles.map((p, i) => {
        const style = {
          animationDuration: `${p.dur}s`,
          animationDelay: `${p.delay}s`,
          ['--wx-dist' as string]: `${dist}px`,
          ['--wx-dx' as string]: `${isSnow ? p.dx * 0.5 : p.dx * 3}px`,
        } as React.CSSProperties;
        return (
          <g key={`wx-${i}`} className="wx-fall" style={style}>
            {isSnow ? (
              <g
                className="wx-sway"
                style={{ animationDuration: `${1.6 + (i % 5) * 0.4}s` }}
              >
                <circle cx={p.x} cy={p.y} r={p.len * 0.16} fill="#ffffff" opacity={p.opacity} />
              </g>
            ) : (
              <line
                x1={p.x}
                y1={p.y}
                x2={p.x - p.len * 0.28}
                y2={p.y + p.len}
                stroke="#bcd4e8"
                strokeWidth={0.07}
                strokeLinecap="round"
                opacity={p.opacity}
              />
            )}
          </g>
        );
      })}

      {/* 번개 섬광 */}
      {spec.lightning ? (
        <rect
          className="wx-flash"
          style={{ animationDuration: '7s' }}
          x={bounds.x}
          y={bounds.y}
          width={bounds.w}
          height={bounds.h}
          fill="#e8f0ff"
        />
      ) : null}
    </g>
  );
}
