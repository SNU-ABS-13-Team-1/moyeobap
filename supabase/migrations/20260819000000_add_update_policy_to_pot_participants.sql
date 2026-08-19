-- pot_participants 에는 INSERT / SELECT / DELETE 정책만 있고 UPDATE 정책이 없었습니다.
-- savePot 의 참여자 저장이 insert 에서 upsert(ON CONFLICT DO UPDATE) 로 바뀌면서,
-- 기존 참여자가 포함된 배치는 UPDATE 경로를 타게 되고 RLS 에 막혀 문장 전체가 실패했습니다.
-- 그 결과 같은 배치에 있던 신규 참여자 행까지 롤백되어,
-- "참여했다고 뜨는데 실제로는 저장되지 않는" 증상이 발생했습니다.
--
-- pots 테이블에는 이미 동일한 형태의 공개 UPDATE 정책이 있으므로
-- 이 정책으로 권한 범위가 새로 넓어지지는 않습니다.

drop policy if exists "Allow public update pot_participants" on public.pot_participants;

create policy "Allow public update pot_participants"
on public.pot_participants for update
using (true)
with check (true);
