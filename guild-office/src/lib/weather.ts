/**
 * 날씨 — 현위치(GPS) 기반 실제 날씨를 화면 효과로 바꾸기 위한 순수 함수들.
 *
 * 여기에는 네트워크 호출도, React 도 없다. 좌표·응답을 넣으면 값이 나오는
 * 함수만 둔다(테스트는 `weather.test.ts`).
 *
 * 날씨 제공처는 **Open-Meteo** 를 쓴다. 이유는 하나다 — API 키가 필요 없다.
 * 이 프로젝트는 "비밀값을 프론트엔드 번들에 넣지 않는다"를 원칙으로 하므로,
 * 키를 요구하는 서비스(OpenWeatherMap 등)는 백엔드 프록시가 생기기 전까지
 * 쓸 수 없다.
 */

/** 화면 효과로 구분해서 그릴 수 있는 최소 단위의 날씨 상태 */
export type WeatherCondition = 'clear' | 'cloudy' | 'fog' | 'rain' | 'snow' | 'thunder';

/** 값이 어디서 왔는가 — 화면에 그대로 밝혀 준다(가짜 데이터를 진짜처럼 보이지 않게). */
export type WeatherSource =
  /** GPS 좌표로 실제 관측값을 받아왔다 */
  | 'gps'
  /** 위치 권한이 없거나 실패해서 기본 좌표(서울)로 받아왔다 */
  | 'fallback'
  /** 사람이 직접 고른 값 (테스트용) */
  | 'manual'
  /** 아직 아무것도 못 받아온 초기 상태 */
  | 'none';

export interface WeatherReading {
  condition: WeatherCondition;
  /** 섭씨. 못 받아왔으면 null */
  temperatureC: number | null;
  /** 관측지 기준 낮/밤 */
  isDay: boolean;
  /** 관측지 좌표 (소수점 2자리로 반올림해서 보관한다 — 아래 roundCoord 참고) */
  coords: { lat: number; lon: number } | null;
  source: WeatherSource;
  /** 관측 시각(ms) */
  observedAt: number;
}

export const WEATHER_LABEL: Record<WeatherCondition, { ko: string; icon: string }> = {
  clear: { ko: '맑음', icon: '☀️' },
  cloudy: { ko: '흐림', icon: '☁️' },
  fog: { ko: '안개', icon: '🌫️' },
  rain: { ko: '비', icon: '🌧️' },
  snow: { ko: '눈', icon: '🌨️' },
  thunder: { ko: '뇌우', icon: '⛈️' },
};

/** 화면에서 고를 수 있는 순서 (수동 테스트 스위치용) */
export const WEATHER_CONDITIONS: WeatherCondition[] = ['clear', 'cloudy', 'fog', 'rain', 'snow', 'thunder'];

/**
 * 위치 권한이 거부되었을 때 쓰는 기본 좌표.
 * "위치를 모르면 날씨도 없음" 보다, 기본값으로라도 돌아가되 출처를 `fallback`
 * 으로 표시하는 편이 낫다고 판단했다.
 */
export const FALLBACK_COORDS = { lat: 37.5665, lon: 126.978, name: '서울' };

/**
 * 좌표를 소수점 2자리(약 1km)로 반올림한다.
 *
 * 정확한 GPS 좌표는 개인정보다. 날씨는 1km 단위면 충분히 같은 값이 나오므로,
 * 외부로 보내기 전에 여기서 정밀도를 깎는다. 저장할 때도 깎인 값만 쓴다.
 */
export function roundCoord(v: number): number {
  return Math.round(v * 100) / 100;
}

/**
 * WMO 날씨 코드 → 화면 효과용 상태.
 * 표: https://open-meteo.com/en/docs (Weather variable documentation)
 *
 * 세부 코드가 많지만 화면 효과는 6가지뿐이므로 과감히 묶는다.
 * 예: 이슬비·비·소나기·어는비는 전부 'rain' 이다 — 굵기 차이는 연출로 표현하지 않는다.
 */
export function wmoToCondition(code: number): WeatherCondition {
  if (code === 0 || code === 1) return 'clear';
  if (code === 2 || code === 3) return 'cloudy';
  if (code === 45 || code === 48) return 'fog';
  if (code >= 95) return 'thunder';
  // 71~77 눈, 85~86 소낙눈. 단 66~67(어는 비)은 비로 본다.
  if ((code >= 71 && code <= 77) || code === 85 || code === 86) return 'snow';
  if (code >= 51 && code <= 82) return 'rain';
  // 정의되지 않은 코드는 '흐림'으로 둔다 — 없는 효과를 지어내지 않는다.
  return 'cloudy';
}

/** Open-Meteo current 요청 URL. 키가 필요 없어 그대로 브라우저에서 부른다. */
export function buildForecastUrl(lat: number, lon: number): string {
  const params = new URLSearchParams({
    latitude: String(roundCoord(lat)),
    longitude: String(roundCoord(lon)),
    current: 'temperature_2m,is_day,weather_code',
    timezone: 'auto',
  });
  return `https://api.open-meteo.com/v1/forecast?${params.toString()}`;
}

/** Open-Meteo 응답에서 필요한 값만 꺼낸다. 형식이 어긋나면 null 을 돌려준다. */
export function parseForecast(
  json: unknown,
  coords: { lat: number; lon: number },
  source: WeatherSource,
  now = Date.now(),
): WeatherReading | null {
  if (typeof json !== 'object' || json === null) return null;
  const current = (json as { current?: unknown }).current;
  if (typeof current !== 'object' || current === null) return null;
  const c = current as Record<string, unknown>;
  const code = c.weather_code;
  if (typeof code !== 'number') return null;
  const temp = typeof c.temperature_2m === 'number' ? c.temperature_2m : null;
  return {
    condition: wmoToCondition(code),
    temperatureC: temp === null ? null : Math.round(temp * 10) / 10,
    // is_day 는 0/1 로 온다. 없으면 낮으로 본다(효과가 과하게 어두워지지 않도록).
    isDay: c.is_day === undefined ? true : Number(c.is_day) === 1,
    coords: { lat: roundCoord(coords.lat), lon: roundCoord(coords.lon) },
    source,
    observedAt: now,
  };
}

/* ───────────────────────────── 로컬 시각 ───────────────────────────── */

/** 하루의 시간대 — 밤에는 화면을 어둡게 덮는다. */
export type DayPhase = 'dawn' | 'day' | 'dusk' | 'night';

/** 0~23시 → 시간대. 실제 일출/일몰이 아니라 보기 좋은 근사값이다. */
export function dayPhaseFromHour(hour: number): DayPhase {
  const h = ((Math.floor(hour) % 24) + 24) % 24;
  if (h >= 5 && h < 8) return 'dawn';
  if (h >= 8 && h < 17) return 'day';
  if (h >= 17 && h < 20) return 'dusk';
  return 'night';
}

/**
 * 로컬 시각과 관측지의 낮/밤을 함께 보고 시간대를 정한다.
 *
 * 시계만 믿으면 위도·계절에 따라 어긋난다(북유럽의 여름 밤 10시는 아직 밝다).
 * 그래서 둘이 어긋날 때는 극단(낮/밤)으로 가지 않고 해질녘으로 완충한다.
 */
export function resolvePhase(hour: number, isDay: boolean): DayPhase {
  const phase = dayPhaseFromHour(hour);
  if (!isDay && (phase === 'day' || phase === 'dawn')) return 'dusk';
  if (isDay && phase === 'night') return 'dusk';
  return phase;
}

/**
 * 화면에 실제로 쓸 시간대.
 *
 * 관측값이 없으면(`none`) 낮/밤도 모르는 것이므로 시계만 믿는다 — 기본값
 * `isDay: true` 를 관측인 척 섞으면 자정에 "해질녘"이 되는 이상한 결과가 나온다.
 * 수동 고정도 마찬가지로 시계만 본다(사람이 고른 것은 날씨이지 시각이 아니다).
 */
export function phaseFor(hour: number, isDay: boolean, source: WeatherSource): DayPhase {
  if (source === 'gps' || source === 'fallback') return resolvePhase(hour, isDay);
  return dayPhaseFromHour(hour);
}

export const DAY_PHASE_LABEL: Record<DayPhase, string> = {
  dawn: '새벽',
  day: '낮',
  dusk: '해질녘',
  night: '밤',
};

/** 로컬 시각 "14:32". 브라우저(=사용자 기기)의 시간대를 그대로 쓴다. */
export function formatLocalTime(ts: number): string {
  const d = new Date(ts);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

/** "2026년 9월 3일 (목)" 형태의 로컬 날짜 */
export function formatLocalDate(ts: number): string {
  const d = new Date(ts);
  const days = ['일', '월', '화', '수', '목', '금', '토'];
  return `${d.getMonth() + 1}월 ${d.getDate()}일 (${days[d.getDay()]})`;
}

/** 헤더 한 줄 요약: "🌧️ 비 12.4° · 14:32" */
export function weatherSummary(r: { condition: WeatherCondition; temperatureC: number | null }, ts: number): string {
  const label = WEATHER_LABEL[r.condition];
  const temp = r.temperatureC === null ? '' : ` ${r.temperatureC}°`;
  return `${label.icon} ${label.ko}${temp} · ${formatLocalTime(ts)}`;
}

/* ───────────────────────── 효과 강도 ───────────────────────── */

export interface EffectSpec {
  /** 떨어지는 입자 수 (0이면 안 그린다) */
  particles: number;
  /** 한 입자가 화면을 지나는 데 걸리는 기본 시간(초) */
  fallSeconds: number;
  /** 화면 전체를 덮는 어두운 막의 진하기 (0~1) */
  dim: number;
  /** 안개/구름 층을 그릴지 */
  haze: boolean;
  /** 번개 섬광 */
  lightning: boolean;
}

/**
 * 날씨 + 낮/밤 → 그릴 효과의 양.
 *
 * 입자 수를 여기서 정하는 이유: 컴포넌트가 아니라 값이라서 테스트할 수 있고,
 * "밤에는 눈을 더 적게" 같은 조정이 한 곳에서 끝난다.
 */
export function effectSpec(condition: WeatherCondition, phase: DayPhase): EffectSpec {
  const night = phase === 'night';
  const dimByPhase: Record<DayPhase, number> = { dawn: 0.16, day: 0, dusk: 0.2, night: 0.42 };
  const base: EffectSpec = {
    particles: 0,
    fallSeconds: 1,
    dim: dimByPhase[phase],
    haze: false,
    lightning: false,
  };
  switch (condition) {
    case 'clear':
      return base;
    case 'cloudy':
      return { ...base, dim: base.dim + 0.1, haze: true };
    case 'fog':
      return { ...base, dim: base.dim + 0.12, haze: true };
    case 'rain':
      return { ...base, particles: night ? 90 : 120, fallSeconds: 0.9, dim: base.dim + 0.2, haze: true };
    case 'snow':
      return { ...base, particles: night ? 70 : 90, fallSeconds: 7.5, dim: base.dim + 0.1, haze: true };
    case 'thunder':
      return {
        ...base,
        particles: night ? 110 : 140,
        fallSeconds: 0.75,
        dim: base.dim + 0.3,
        haze: true,
        lightning: true,
      };
  }
}
