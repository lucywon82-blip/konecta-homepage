# Claude Code 권한 설정 백업 (2026-09-10)

`~/.claude/settings.json` (전역, 이 컴퓨터의 모든 Claude Code 세션에 적용)의 백업본입니다.
`settings.json`이 실제 파일 내용이고, 아래는 왜 이렇게 설정했는지에 대한 메모입니다.

## 배경

`daily-instagram-content` 예약 작업(매일 아침 6시, 노션 블로그 글 기준으로 릴스 대본·카드뉴스·이미지를 만들어 노션에 저장)이
사람이 매번 승인 팝업을 눌러줘야만 끝까지 진행되는 문제가 있었습니다. 예약 작업은 사람이 잠들어 있어도 혼자 돌아가야 의미가 있는데,
기본 권한 모드에서는 파일 업로드(curl POST), 노션 페이지 수정 같은 쓰기 작업마다 확인을 기다리며 멈춰 있었습니다.

## 적용한 설정

- **`permissions.defaultMode: "bypassPermissions"`**: 모든 도구 호출을 승인 팝업 없이 자동 실행. 예약 작업이 사람 없이도 끝까지 완료되도록 하기 위함.
- **`permissions.allow`**: 자주 쓰는 읽기 전용 MCP 도구(노션 페이지/DB 조회, 브라우저 텍스트·콘솔·네트워크 읽기 등) 12개 — `bypassPermissions`와 별개로, 더 제한적인 모드로 되돌리더라도 이 목록은 계속 자동 승인되도록 남겨둠.
- **`permissions.ask`**: `bypassPermissions` 상태에서도 예외적으로 항상 확인을 받도록 지정한 위험 행동 목록.
  - 삭제: `rm`, `Remove-Item`, `git clean`, `git branch -D`, `git reset --hard`
  - 강제/공유 상태 변경: `git push`로 시작하는 모든 명령 (force 여부와 무관하게 전부 확인)
  - 시스템 설정 변경: 레지스트리 편집(`reg add/delete`, `Set-ItemProperty`, `Remove-ItemProperty`), 윈도우 서비스 제어(`Stop-Service`, `Set-Service`)
  - 이 설정 파일 자체(`~/.claude/settings.json`)를 다시 편집하는 것도 확인 필요

## 알려진 한계

- `permissions.ask`의 패턴은 명령어 문자열 **앞부분 접두사**만 매칭합니다. 예: `git push origin main --force`처럼 플래그가 뒤에 오는 경우도
  `git push*` 패턴에는 걸리지만(전체 push를 다 확인받도록 넓게 잡아서), 만약 더 세밀하게 "force 플래그가 있을 때만" 걸러내려는 규칙을 쓴다면
  플래그 위치에 따라 못 잡아낼 수 있습니다.
- 이 설정은 **이 컴퓨터의 전역 설정**이라, `daily-instagram-content` 예약 작업뿐 아니라 이 컴퓨터에서 여는 다른 모든 Claude Code 세션에도
  동일하게 적용됩니다.
- 컴퓨터/Claude 앱이 꺼져 있으면 예약 작업 자체가 실행되지 않습니다 (앱이 켜져 있을 때만 스케줄이 동작하고, 꺼져 있었다면 다음 실행 시점에 뒤늦게 1회 실행됨).

## 제외한 것

- 노션 파일 업로드 시 발급되는 1회용 업로드 URL/Bearer 토큰이 포함된 `Bash(curl ...)` 허용 항목들은 이 백업에서 의도적으로 제외했습니다.
  (세션별 `.claude/settings.local.json`에만 남아있고, 토큰은 짧은 시간 후 만료됩니다.)
