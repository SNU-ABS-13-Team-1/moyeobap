/**
 * SWR을 쓰는 곳에서 공통으로 쓰는 fetcher입니다. 응답이 실패(4xx/5xx)여도
 * `res.json()`은 별문제 없이 값을 돌려줄 수 있어서, 상태 코드를 확인하지 않으면
 * 일시적인 서버 오류를 "정상적인 빈 데이터"로 착각해 화면이 잠깐 0개로 보이는
 * 문제가 생깁니다. 여기서 throw하면 SWR이 이전에 받아온 데이터를 화면에 그대로
 * 유지한 채 백그라운드에서 재시도합니다.
 */
export async function fetcher<T>(url: string): Promise<T> {
  const res = await fetch(url, { cache: 'no-store' });
  if (!res.ok) {
    throw new Error(`요청에 실패했어요: ${url} (${res.status})`);
  }
  return res.json();
}
