import { describe, expect, it } from 'vitest';
import {
  buildForecastUrl,
  dayPhaseFromHour,
  effectSpec,
  formatLocalTime,
  parseForecast,
  phaseFor,
  resolvePhase,
  roundCoord,
  weatherSummary,
  wmoToCondition,
} from '@/lib/weather';

describe('wmoToCondition', () => {
  it('맑음/구름을 나눈다', () => {
    expect(wmoToCondition(0)).toBe('clear');
    expect(wmoToCondition(1)).toBe('clear');
    expect(wmoToCondition(2)).toBe('cloudy');
    expect(wmoToCondition(3)).toBe('cloudy');
  });

  it('안개는 45/48 뿐이다', () => {
    expect(wmoToCondition(45)).toBe('fog');
    expect(wmoToCondition(48)).toBe('fog');
  });

  it('이슬비·비·소나기는 모두 비로 묶는다', () => {
    for (const code of [51, 53, 55, 61, 63, 65, 66, 67, 80, 81, 82]) {
      expect(wmoToCondition(code)).toBe('rain');
    }
  });

  it('눈과 소낙눈은 눈으로 묶는다', () => {
    for (const code of [71, 73, 75, 77, 85, 86]) {
      expect(wmoToCondition(code)).toBe('snow');
    }
  });

  it('95 이상은 뇌우다', () => {
    expect(wmoToCondition(95)).toBe('thunder');
    expect(wmoToCondition(99)).toBe('thunder');
  });

  it('모르는 코드는 지어내지 않고 흐림으로 둔다', () => {
    expect(wmoToCondition(4)).toBe('cloudy');
    expect(wmoToCondition(-1)).toBe('cloudy');
  });
});

describe('roundCoord', () => {
  it('소수점 2자리로 깎아 정밀한 위치를 보내지 않는다', () => {
    expect(roundCoord(37.566535)).toBe(37.57);
    expect(roundCoord(-122.41941)).toBe(-122.42);
  });
});

describe('buildForecastUrl', () => {
  it('키 없이 부를 수 있는 Open-Meteo URL 을 만든다', () => {
    const url = buildForecastUrl(37.566535, 126.9779692);
    expect(url.startsWith('https://api.open-meteo.com/v1/forecast?')).toBe(true);
    expect(url).toContain('latitude=37.57');
    expect(url).toContain('longitude=126.98');
    expect(url).toContain('weather_code');
    // 어떤 비밀값도 붙지 않는다
    expect(url.toLowerCase()).not.toContain('key');
  });
});

describe('parseForecast', () => {
  const coords = { lat: 37.566535, lon: 126.9779692 };

  it('필요한 값만 꺼낸다', () => {
    const r = parseForecast(
      { current: { temperature_2m: 12.44, is_day: 0, weather_code: 71 } },
      coords,
      'gps',
      1000,
    );
    expect(r).toEqual({
      condition: 'snow',
      temperatureC: 12.4,
      isDay: false,
      coords: { lat: 37.57, lon: 126.98 },
      source: 'gps',
      observedAt: 1000,
    });
  });

  it('is_day 가 없으면 낮으로 본다', () => {
    const r = parseForecast({ current: { weather_code: 0 } }, coords, 'fallback');
    expect(r?.isDay).toBe(true);
    expect(r?.temperatureC).toBe(null);
  });

  it('형식이 어긋나면 null 을 준다 — 억지로 값을 만들지 않는다', () => {
    expect(parseForecast(null, coords, 'gps')).toBe(null);
    expect(parseForecast({}, coords, 'gps')).toBe(null);
    expect(parseForecast({ current: {} }, coords, 'gps')).toBe(null);
    expect(parseForecast({ current: { weather_code: 'rain' } }, coords, 'gps')).toBe(null);
  });
});

describe('dayPhaseFromHour', () => {
  it('시각을 4개 구간으로 나눈다', () => {
    expect(dayPhaseFromHour(6)).toBe('dawn');
    expect(dayPhaseFromHour(12)).toBe('day');
    expect(dayPhaseFromHour(18)).toBe('dusk');
    expect(dayPhaseFromHour(23)).toBe('night');
    expect(dayPhaseFromHour(3)).toBe('night');
  });

  it('24를 넘거나 음수여도 안전하다', () => {
    expect(dayPhaseFromHour(25)).toBe('night');
    expect(dayPhaseFromHour(-1)).toBe('night');
  });
});

describe('resolvePhase', () => {
  it('시계와 관측이 맞으면 그대로 쓴다', () => {
    expect(resolvePhase(12, true)).toBe('day');
    expect(resolvePhase(23, false)).toBe('night');
  });

  it('어긋나면 극단으로 가지 않고 해질녘으로 완충한다', () => {
    expect(resolvePhase(12, false)).toBe('dusk');
    expect(resolvePhase(23, true)).toBe('dusk');
  });
});

describe('phaseFor', () => {
  it('관측값이 없으면 시계만 믿는다', () => {
    // 기본값 isDay=true 를 관측인 척 섞으면 자정이 "해질녘"이 되어 버린다.
    expect(phaseFor(0, true, 'none')).toBe('night');
    expect(phaseFor(12, false, 'manual')).toBe('day');
  });

  it('실제 관측이 있으면 낮/밤을 함께 본다', () => {
    expect(phaseFor(0, true, 'gps')).toBe('dusk');
    expect(phaseFor(12, true, 'fallback')).toBe('day');
  });
});

describe('effectSpec', () => {
  it('맑은 낮에는 아무 효과도 그리지 않는다', () => {
    const s = effectSpec('clear', 'day');
    expect(s.particles).toBe(0);
    expect(s.dim).toBe(0);
    expect(s.haze).toBe(false);
  });

  it('밤은 언제나 화면을 덮는다', () => {
    expect(effectSpec('clear', 'night').dim).toBeGreaterThan(0);
  });

  it('눈은 비보다 훨씬 천천히 떨어진다', () => {
    expect(effectSpec('snow', 'day').fallSeconds).toBeGreaterThan(effectSpec('rain', 'day').fallSeconds);
  });

  it('번개는 뇌우에서만 친다', () => {
    expect(effectSpec('thunder', 'day').lightning).toBe(true);
    expect(effectSpec('rain', 'day').lightning).toBe(false);
  });

  it('밤에는 입자를 줄인다 (어두운 화면에서 과해지지 않도록)', () => {
    expect(effectSpec('rain', 'night').particles).toBeLessThan(effectSpec('rain', 'day').particles);
  });
});

describe('formatLocalTime / weatherSummary', () => {
  it('로컬 시각을 두 자리로 맞춘다', () => {
    const d = new Date(2026, 8, 3, 9, 5);
    expect(formatLocalTime(d.getTime())).toBe('09:05');
  });

  it('요약 문구에 아이콘·이름·온도·시각이 들어간다', () => {
    const d = new Date(2026, 8, 3, 14, 32);
    const text = weatherSummary({ condition: 'rain', temperatureC: 12.4 }, d.getTime());
    expect(text).toContain('비');
    expect(text).toContain('12.4°');
    expect(text).toContain('14:32');
  });

  it('온도를 못 받아왔으면 온도 자리를 비운다', () => {
    const text = weatherSummary({ condition: 'clear', temperatureC: null }, Date.now());
    expect(text).not.toContain('°');
  });
});
