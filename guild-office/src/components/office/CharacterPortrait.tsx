/**
 * 캐릭터 초상.
 *
 * `public/portraits/` 에 실사 PNG 가 있으면 그 이미지를, 없으면 SVG 스프라이트를 쓴다.
 * 이미지 로드 실패를 onError 로 잡아 조용히 되돌리므로, 파일을 넣기 전에도 화면이 깨지지 않는다.
 *
 * 큰 화면(소환 카드·면담·직원 패널)만 이 컴포넌트를 쓴다. 오피스를 돌아다니는 작은
 * 캐릭터는 상태별 애니메이션이 실제 업무 상태에 묶여 있어야 하므로 계속 SVG 를 쓴다.
 */
import { useState } from 'react';
import CharacterSprite from '@/components/office/CharacterSprite';
import { PORTRAITS, type AiEmployeeId } from '@/data/seed';
import type { AgentState, Employee } from '@/types';

interface Props {
  employee: Pick<Employee, 'id' | 'name' | 'palette' | 'sigil' | 'jobClass'>;
  /** 스프라이트로 대체될 때 사용할 상태 */
  state?: AgentState;
  className?: string;
}

export default function CharacterPortrait({ employee, state = 'idle', className = 'h-24 w-20' }: Props) {
  const src = PORTRAITS[employee.id as AiEmployeeId];
  const [failed, setFailed] = useState(false);

  if (src && !failed) {
    return (
      <img
        src={src}
        alt={employee.name}
        loading="lazy"
        onError={() => setFailed(true)}
        className={`${className} object-contain object-bottom`}
      />
    );
  }

  return (
    <svg viewBox="0 0 24 28" className={className}>
      <CharacterSprite
        palette={employee.palette}
        sigil={employee.sigil}
        state={state}
        jobClass={employee.jobClass}
      />
    </svg>
  );
}
