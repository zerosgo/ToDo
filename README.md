# ToDo App (Local Tasks)

개인 업무 효율성을 위한 로컬 할 일 관리 및 일정 캘린더 애플리케이션입니다.

## 🚀 새로운 PC에서 시작하기 (Setup Guide)

다른 컴퓨터(노트북 등)에서 이 프로젝트를 이어서 작업하려면 아래 순서대로 진행하세요.

### 1. 필수 프로그램 설치
먼저 다음 프로그램들이 설치되어 있어야 합니다.
- **Node.js**: [https://nodejs.org/](https://nodejs.org/) (LTS 버전 추천)
- **Git**: [https://git-scm.com/](https://git-scm.com/)

### 2. 프로젝트 가져오기 (Clone)
터미널(명령 프롬프트 또는 PowerShell)을 열고, 프로젝트를 저장할 폴더로 이동한 뒤 아래 명령어를 입력합니다.

```bash
git clone https://github.com/zeros79ya/ToDo.git
cd ToDo
```

### 3. 패키지 설치 (Install)
프로젝트 실행에 필요한 라이브러리들을 설치합니다.

```bash
npm install
```

### 4. 실행하기 (Run)
개발 서버를 실행합니다.

```bash
npm run dev
```

실행 후 브라우저에서 [http://localhost:3000](http://localhost:3000)으로 접속하여 사용합니다.

---

## ✨ 주요 기능
- **할 일 관리**: 카테고리별 할 일 추가/수정/삭제/완료
- **일정 관리**: 텍스트 붙여넣기를 통한 팀 일정 자동 파싱 및 캘린더 등록
- **데이터 저장**: LocalStorage를 사용하여 브라우저에 데이터 영구 저장 (로그인 불필요)
- **레이아웃**: 반응형 레이아웃, 사이드바 토글, 다크 모드 지원
