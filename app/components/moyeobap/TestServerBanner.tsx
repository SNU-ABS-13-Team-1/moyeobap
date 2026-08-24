// 테스트 서버에만 뜨는 알림 띠. 운영과 테스트가 Vercel 프로젝트 두 개로
// 나뉘어 있고 코드는 같아서, 테스트 프로젝트에만 NEXT_PUBLIC_APP_ENV=test 를
// 넣어 구분합니다. 변수가 없으면(=운영) 아무것도 그리지 않습니다.
//
// 주소만 보고는 어느 쪽에 들어왔는지 알기 어려워서, 여기가 테스트라는 것과
// 진짜 쓸 곳이 어디인지를 함께 알려주고 바로 건너갈 수 있게 합니다.
const MAIN_SERVER_HOST = "moyeobap.vercel.app";

export function TestServerBanner() {
  if (process.env.NEXT_PUBLIC_APP_ENV !== "test") return null;

  return (
    <div className="test-banner" role="status">
      <span aria-hidden="true">🚧</span>
      <span>
        테스트 서버입니다. 메인 서버는{" "}
        <a className="test-banner__link" href={`https://${MAIN_SERVER_HOST}`}>
          {MAIN_SERVER_HOST}
        </a>
        {" "}입니다.
      </span>
    </div>
  );
}
