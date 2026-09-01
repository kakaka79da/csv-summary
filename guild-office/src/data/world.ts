/**
 * 월드 상수. 격자는 도면에서 결정적으로 생성되므로 저장소에 넣지 않는다.
 * (Uint8Array 는 JSON 직렬화에 부적합하고, 어차피 매번 동일하게 재생성된다.)
 */
import { buildGrid } from '@/data/seed';
import type { Grid } from '@/types';

export const GRID: Grid = buildGrid();
