/**
 * 현위치 날씨를 받아와 스토어에 넣는 훅.
 *
 * 흐름: 브라우저 위치 권한 → 좌표(소수점 2자리로 깎음) → Open-Meteo 호출 →
 *       스토어의 weather 갱신 → 오피스 화면이 비/눈 효과로 그린다.
 *
 * 솔직하게 밝혀 둘 제약:
 *  - 위치 권한은 **사용자가 허용해야만** 얻어진다. 거부하면 서울 좌표로 대신
 *    받아오고, 화면에는 "기본 위치(서울)" 라고 그대로 표시한다.
 *  - 위치 API 는 보안 컨텍스트(HTTPS 또는 localhost)에서만 동작한다.
 *  - claude.ai 아티팩트 미리보기처럼 샌드박스가 위치·외부 통신을 막는 곳에서는
 *    실제 날씨를 받아올 수 없다. 그때는 안내 문구를 남기고, 사람이 헤더에서
 *    날씨를 직접 골라(수동 고정) 효과를 확인할 수 있게 해 둔다.
 */
import { useCallback, useEffect, useRef } from 'react';
import { useWorld } from '@/state/store';
import { FALLBACK_COORDS, buildForecastUrl, parseForecast, type WeatherSource } from '@/lib/weather';

/** 관측값 갱신 주기. 날씨는 자주 바뀌지 않으므로 10분이면 충분하다. */
const REFRESH_MS = 10 * 60 * 1000;
/** 위치 권한 응답을 기다리는 시간 */
const GEO_TIMEOUT_MS = 8000;
/** 날씨 API 응답을 기다리는 시간 */
const FETCH_TIMEOUT_MS = 8000;

function getCoords(): Promise<{ coords: { lat: number; lon: number }; source: WeatherSource; note: string | null }> {
  const fallback = {
    coords: { lat: FALLBACK_COORDS.lat, lon: FALLBACK_COORDS.lon },
    source: 'fallback' as WeatherSource,
  };
  if (typeof navigator === 'undefined' || !navigator.geolocation) {
    return Promise.resolve({ ...fallback, note: '이 브라우저에서는 위치를 쓸 수 없어 기본 위치(서울)로 표시합니다.' });
  }
  return new Promise((resolve) => {
    // 브라우저가 옵션의 timeout 을 지키지 않고 두 콜백 중 아무것도 부르지 않는
    // 경우가 실제로 있다(권한 창이 뜨지 않는 샌드박스 등). 그러면 날씨가 영영
    // 로딩 중으로 남으므로, 여기서 직접 시간을 재고 끊는다.
    let settled = false;
    const done = (v: Awaited<ReturnType<typeof getCoords>>) => {
      if (settled) return;
      settled = true;
      resolve(v);
    };
    const guard = setTimeout(
      () => done({ ...fallback, note: '위치 응답이 없어 기본 위치(서울)의 날씨를 표시합니다.' }),
      GEO_TIMEOUT_MS,
    );
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        clearTimeout(guard);
        done({
          coords: { lat: pos.coords.latitude, lon: pos.coords.longitude },
          source: 'gps',
          note: null,
        });
      },
      (err) => {
        clearTimeout(guard);
        const why =
          err.code === err.PERMISSION_DENIED
            ? '위치 권한이 거부되어'
            : err.code === err.TIMEOUT
              ? '위치를 찾는 데 시간이 너무 걸려'
              : '위치를 가져오지 못해';
        done({ ...fallback, note: `${why} 기본 위치(서울)의 날씨를 표시합니다.` });
      },
      { enableHighAccuracy: false, timeout: GEO_TIMEOUT_MS, maximumAge: 10 * 60 * 1000 },
    );
  });
}

export function useWeather(enabled: boolean) {
  const applyWeather = useWorld((s) => s.applyWeather);
  const setWeatherNote = useWorld((s) => s.setWeatherNote);
  /** 좌표는 한 번만 물어보고 재사용한다 — 갱신마다 권한 창을 띄우지 않기 위해. */
  const cached = useRef<{ coords: { lat: number; lon: number }; source: WeatherSource } | null>(null);
  const busy = useRef(false);

  const refresh = useCallback(async () => {
    if (busy.current) return;
    busy.current = true;
    try {
      if (!cached.current) {
        const got = await getCoords();
        cached.current = { coords: got.coords, source: got.source };
        if (got.note) setWeatherNote(got.note);
      }
      const { coords, source } = cached.current;
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
      try {
        const res = await fetch(buildForecastUrl(coords.lat, coords.lon), { signal: controller.signal });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const reading = parseForecast(await res.json(), coords, source);
        if (!reading) throw new Error('응답 형식이 예상과 다릅니다');
        applyWeather(reading);
      } finally {
        clearTimeout(timer);
      }
    } catch {
      // 실패했다고 아무 날씨나 지어내지 않는다. 문구만 남기고 화면은 그대로 둔다.
      setWeatherNote('날씨를 받아오지 못했습니다. 네트워크가 막혀 있으면 아래에서 직접 골라 효과를 볼 수 있습니다.');
    } finally {
      busy.current = false;
    }
  }, [applyWeather, setWeatherNote]);

  useEffect(() => {
    if (!enabled) return;
    void refresh();
    const id = setInterval(() => void refresh(), REFRESH_MS);
    return () => clearInterval(id);
  }, [enabled, refresh]);

  return refresh;
}
