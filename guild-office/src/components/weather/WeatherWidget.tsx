/**
 * 헤더의 "로컬 시각 + 현위치 날씨" 배지.
 *
 * 눌러서 여는 작은 패널에서 다시 불러오기 / 효과 끄기 / 수동 고정을 할 수 있다.
 * 수동 고정을 둔 이유는 하나다 — 위치 권한이나 외부 통신이 막힌 환경
 * (claude.ai 아티팩트 미리보기 등)에서는 실제 날씨를 받아올 수 없는데,
 * 그렇다고 화면 효과를 확인조차 못 하면 곤란하기 때문이다.
 * 고정 중에는 화면 어디서나 "실제 값 아님"이라고 함께 표시한다.
 */
import { useEffect, useState } from 'react';
import { useWorld } from '@/state/store';
import { useWeather } from '@/hooks/useWeather';
import { Tooltip } from '@/components/ui/primitives';
import {
  DAY_PHASE_LABEL,
  WEATHER_CONDITIONS,
  WEATHER_LABEL,
  formatLocalDate,
  formatLocalTime,
  phaseFor,
} from '@/lib/weather';

const SOURCE_LABEL: Record<string, string> = {
  gps: '현위치(GPS) 실제 관측값',
  fallback: '기본 위치(서울) 관측값 — 위치 권한 없음',
  manual: '수동 고정 — 실제 관측값이 아닙니다',
  none: '아직 받아오지 못했습니다',
};

export default function WeatherWidget() {
  const weather = useWorld((s) => s.weather);
  const setManual = useWorld((s) => s.setWeatherManual);
  const setEffects = useWorld((s) => s.setWeatherEffects);
  const refresh = useWeather(true);
  const [open, setOpen] = useState(false);

  // 시계는 1분마다만 다시 그린다 — 초 단위로 돌릴 이유가 없다.
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 20_000);
    return () => clearInterval(id);
  }, []);

  const label = WEATHER_LABEL[weather.condition];
  const phase = phaseFor(new Date(now).getHours(), weather.isDay, weather.source);
  const temp = weather.temperatureC === null ? '' : ` ${weather.temperatureC}°`;

  return (
    <span className="relative">
      <Tooltip
        text="이 기기의 로컬 시각과 현위치 날씨입니다. 눌러서 다시 불러오거나, 화면 효과를 끄거나, 날씨를 직접 골라 볼 수 있습니다."
        placement="bottom"
      >
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className={`rounded-lg border px-2 py-1 text-[11px] transition-colors ${
            open ? 'border-gold text-gold' : 'border-stone-700 text-stone-300 hover:border-stone-500'
          }`}
        >
          <span className="mr-1">{label.icon}</span>
          {formatLocalTime(now)}
          <span className="ml-1 text-stone-500">
            {label.ko}
            {temp}
          </span>
          {weather.manual ? <span className="ml-1 text-arcane-soft">🧪</span> : null}
        </button>
      </Tooltip>

      {open ? (
        <div className="absolute right-0 top-full z-50 mt-1.5 w-72 rounded-xl border border-stone-700 bg-stone-950/97 p-3 text-left shadow-rune">
          <div className="text-xs text-stone-200">
            {formatLocalDate(now)} {formatLocalTime(now)} · {DAY_PHASE_LABEL[phase]}
          </div>
          <div className="mt-1 text-[11px] text-stone-400">
            {label.icon} {label.ko}
            {temp} — {SOURCE_LABEL[weather.source] ?? weather.source}
          </div>
          {weather.coords ? (
            <div className="mt-0.5 text-[10px] text-stone-600">
              위도 {weather.coords.lat} · 경도 {weather.coords.lon}
              <span className="ml-1">(약 1km 단위로 반올림해 보관합니다)</span>
            </div>
          ) : null}
          {weather.note ? (
            <div className="mt-2 rounded-lg border border-stone-700 bg-stone-900/70 px-2 py-1.5 text-[10px] leading-relaxed text-stone-400">
              {weather.note}
            </div>
          ) : null}

          <div className="mt-2.5 flex flex-wrap gap-1.5">
            <button
              type="button"
              onClick={() => void refresh()}
              className="rounded-md border border-stone-600 px-2 py-1 text-[11px] text-stone-300 hover:border-gold hover:text-gold"
            >
              다시 불러오기
            </button>
            <button
              type="button"
              onClick={() => setEffects(!weather.effects)}
              className="rounded-md border border-stone-600 px-2 py-1 text-[11px] text-stone-300 hover:border-gold hover:text-gold"
            >
              화면 효과 {weather.effects ? '끄기' : '켜기'}
            </button>
          </div>

          <div className="mt-3 border-t border-stone-800 pt-2">
            <div className="text-[10px] text-stone-500">
              날씨 직접 고르기 (테스트용 — 고르면 자동 갱신이 덮어쓰지 않습니다)
            </div>
            <div className="mt-1.5 flex flex-wrap gap-1">
              <button
                type="button"
                onClick={() => {
                  setManual(null);
                  void refresh();
                }}
                className={`rounded-md border px-2 py-1 text-[11px] ${
                  weather.manual === null
                    ? 'border-gold text-gold'
                    : 'border-stone-700 text-stone-400 hover:border-stone-500'
                }`}
              >
                자동
              </button>
              {WEATHER_CONDITIONS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setManual(c)}
                  className={`rounded-md border px-2 py-1 text-[11px] ${
                    weather.manual === c
                      ? 'border-gold text-gold'
                      : 'border-stone-700 text-stone-400 hover:border-stone-500'
                  }`}
                >
                  {WEATHER_LABEL[c].icon} {WEATHER_LABEL[c].ko}
                </button>
              ))}
            </div>
          </div>
        </div>
      ) : null}
    </span>
  );
}
