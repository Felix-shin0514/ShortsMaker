(function () {
  const STORAGE_KEY = "site_lang";

  const pageTranslations = {
    login: {
      title: { ko: "ShortsMaker - AI 쇼츠 자동 제작 플랫폼", en: "ShortsMaker - AI shorts automation platform" },
      texts: {
        '.landing-nav a[href="./pricing.html"]': { ko: '요금제', en: 'Pricing' },
        '.landing-nav a[href="./terms.html"]': { ko: '이용약관', en: 'Terms' },
        '.landing-nav a[href="./support.html"]': { ko: '고객센터', en: 'Support' },
        '#headerLoginBtn': { ko: '로그인', en: 'Login' },
        '.hero-line:nth-of-type(1)': { ko: '쇼츠 제작 시간을 줄이고', en: 'Cut your shorts production time' },
        '.hero-line:nth-of-type(2)': { ko: '바로 업로드 가능한', en: 'Create videos ready to upload' },
        '.hero-line:nth-of-type(3)': { ko: '영상까지 만듭니다', en: 'in just a few clicks' },
        '.hero-copy p': { ko: '랭킹형 쇼츠, 바이럴 클립, 자막 합성까지 한 번에 처리합니다.<br>구글 로그인만 하면 바로 제작을 시작할 수 있습니다.', en: 'Create ranking shorts, viral clips, and captioned videos in one workflow.<br>Sign in with Google and start producing immediately.' },
        '#heroLoginBtn': { ko: '무료로 시작하기', en: 'Start Free' },
        '.hero-secondary': { ko: '요금제 보기', en: 'View Pricing' },
        '.stat-card:nth-child(1) strong': { ko: '10분 이내', en: 'Within 10 min' },
        '.stat-card:nth-child(1) span': { ko: '초안 완성', en: 'Draft ready' },
        '.stat-card:nth-child(2) span': { ko: '화질 선택', en: 'Quality options' },
        '.stat-card:nth-child(3) strong': { ko: '고객센터 내장', en: 'Built-in support' },
        '.stat-card:nth-child(3) span': { ko: '문의 관리', en: 'Ticket management' },
        '.feature-card:nth-child(1) h2': { ko: '템플릿 기반 제작', en: 'Template-based production' },
        '.feature-card:nth-child(1) p': { ko: '랭킹형 쇼츠 템플릿으로 제목, 순위, 자막 배치를 빠르게 조정합니다.', en: 'Use ranking-focused templates to arrange titles, order, and captions quickly.' },
        '.feature-card:nth-child(2) h2': { ko: '화질별 크레딧 차등', en: 'Quality-based credits' },
        '.feature-card:nth-child(2) p': { ko: 'Standard / Premium 두 가지 화질로 운영하고 크레딧 정책을 분리합니다.', en: 'Offer Standard and Premium quality tiers with separate credit policies.' },
        '.feature-card:nth-child(3) h2': { ko: '운영 기능 내장', en: 'Built-in operations' },
        '.feature-card:nth-child(3) p': { ko: '관리자 크레딧 지급, 고객센터 문의 관리, 플랜 반영 구조까지 포함합니다.', en: 'Includes admin credit controls, support ticket management, and plan handling.' },
        '.cta-card h2': { ko: '로그인하면 바로 대시보드로 이동합니다', en: 'Go straight to your dashboard after login' },
        '.cta-card p': { ko: '구글 계정으로 로그인하면 작업 공간과 고객센터가 즉시 생성됩니다.', en: 'Your workspace and support center are prepared instantly after Google sign-in.' },
        '#ctaLoginBtn': { ko: '구글로 시작하기', en: 'Continue with Google' },
        '.login-title': { ko: '<span class="brand-accent">Shorts</span>Maker에 오신 것을 환영합니다!', en: '<span class="brand-accent">Shorts</span>Maker welcomes you!' },
        '.login-subtitle': { ko: 'Google 계정으로 간편하게 시작하세요', en: 'Start quickly with your Google account' },
        '.login-checkbox span': { ko: '(선택) 신규 기능, 프로모션 등 마케팅 정보 수신에 동의합니다', en: '(Optional) I agree to receive updates and promotional marketing messages' },
        '#googleLoginBtn': { ko: 'Google로 로그인/회원가입', en: 'Continue with Google' },
        '.login-legal': { ko: '계속하면 이용약관 및 개인정보처리방침에 동의하는 것으로 간주됩니다.', en: 'By continuing, you agree to the Terms of Service and Privacy Policy.' }
      }
    },
    dashboard: {
      title: { ko: 'Dashboard - ShortsMaker', en: 'Dashboard - ShortsMaker' },
      texts: {
        '.dash-nav-center a[href="./dashboard.html"]': { ko: '대시보드', en: 'Dashboard' },
        '#nav-main-work': { ko: '메인 작업', en: 'Editor' },
        '.dash-nav-center a[href="./index.html"]': { ko: '에뮬레이터', en: 'Emulator' },
        '#nav-admin': { ko: '관리자', en: 'Admin' },
        '.dash-nav-center a[href="./pricing.html"]': { ko: '요금제', en: 'Pricing' },
        '.dash-nav-center a[href="./support.html"]': { ko: '고객센터', en: 'Support' },
        '#logout-btn': { ko: '로그아웃', en: 'Logout' },
        '.dashboard-header h1': { ko: '대시보드', en: 'Dashboard' },
        '.stat-card:nth-child(1) .stat-label': { ko: '남은 크레딧', en: 'Credits left' },
        '.stat-card:nth-child(2) .stat-label': { ko: '제작 영상', en: 'Videos made' },
        '.stat-card:nth-child(3) .stat-label': { ko: '현재 플랜', en: 'Current plan' },
        '.create-title': { ko: '새 영상 만들기', en: 'Create a new video' },
        '.create-subtitle': { ko: '다양한 템플릿으로 바이럴 숏폼을 제작해보세요', en: 'Build viral short-form videos with ready-made templates.' },
        '.card-title': { ko: '랭킹 영상', en: 'Ranking video' },
        '.pv-box:nth-child(1) .pv-header h3': { ko: '저장된 프로젝트', en: 'Saved projects' },
        '.pv-box:nth-child(2) .pv-header h3': { ko: '내가 만든 영상', en: 'My exported videos' },
        '.account-danger-card h2': { ko: '회원 탈퇴', en: 'Delete account' },
        '.account-danger-card p': { ko: '탈퇴하면 계정, 프로젝트, 문의 내역이 함께 삭제되며 복구되지 않습니다.', en: 'Deleting your account removes your profile, projects, and support history permanently.' },
        '#delete-account-btn': { ko: '회원 탈퇴', en: 'Delete account' },
        '.dash-footer a[href="./terms.html"]': { ko: '이용약관', en: 'Terms' },
        '.dash-footer a[href="./privacy.html"]': { ko: '개인정보처리방침', en: 'Privacy' },
        '.dash-footer a[href="./refund.html"]': { ko: '환불정책', en: 'Refunds' },
        '.dash-footer a[href="./marketing.html"]': { ko: '광고수신동의 철회', en: 'Marketing opt-out' }
      },
      custom(lang) {
        const welcome = document.querySelector('.welcome-message');
        const userName = document.getElementById('user-name');
        if (welcome && userName) {
          const name = userName.textContent || 'User';
          welcome.innerHTML = `<span id="user-name">${name}</span>${lang === 'ko' ? '님 환영합니다' : ', welcome back'}`;
        }
      }
    },
    pricing: {
      title: { ko: '요금제 - ShortsMaker', en: 'Pricing - ShortsMaker' },
      texts: {
        '.dash-nav-center a[href="./dashboard.html"]': { ko: '대시보드', en: 'Dashboard' },
        '.dash-nav-center a[href="./ranking-create.html"]': { ko: '메인 작업', en: 'Editor' },
        '.dash-nav-center a[href="./index.html"]': { ko: '에뮬레이터', en: 'Emulator' },
        '#nav-admin': { ko: '관리자', en: 'Admin' },
        '.dash-nav-center a[href="./pricing.html"]': { ko: '요금제', en: 'Pricing' },
        '.dash-nav-center a[href="./support.html"]': { ko: '고객센터', en: 'Support' },
        '#logout-btn': { ko: '로그아웃', en: 'Logout' },
        '#login-link': { ko: '로그인', en: 'Login' },
        '.pricing-hero h1': { ko: '남들이 쇼츠를 시청할때 수익을 창출해보세요!', en: 'Turn your shorts workflow into revenue.' },
        '.pricing-sub': { ko: '지금까지 쇼츠로 시간만 날리셨죠? 이제 크리에이터가 되세요!', en: 'Stop wasting time on shorts and start creating with a system.' },
        '.pricing-cancel': { ko: '언제든지 취소 가능합니다!', en: 'Cancel anytime.' },
        '.plan-card:nth-child(1) h2': { ko: '무료', en: 'Free' },
        '.plan-card:nth-child(2) h2': { ko: '베이직', en: 'Basic' },
        '.plan-card:nth-child(3) h2': { ko: '프로', en: 'Pro' },
        '.plan-card:nth-child(4) h2': { ko: '크리에이터', en: 'Creator' },
        '.plan-card:nth-child(1) .plan-cta': { ko: '시작하기', en: 'Start Free' },
        '.plan-card:nth-child(2) .plan-cta': { ko: '시작하기', en: 'Choose Basic' },
        '.plan-card:nth-child(3) .plan-cta': { ko: '시작하기', en: 'Choose Pro' },
        '.plan-card:nth-child(4) .plan-cta': { ko: '시작하기', en: 'Choose Creator' },
        '.plan-card:nth-child(1) .plan-credit': { ko: '월 <b>200</b> 크레딧 제공<br><small>소진 시 광고 시청 후 다운로드</small>', en: '<b>200</b> Credits / month<br><small>Watch ad to download after exhaust</small>' },
        '.plan-card:nth-child(1) .plan-features li:nth-child(1)': { ko: '가볍게 시작하는 무료 플랜', en: 'Free plan to get started' },
        '.plan-card:nth-child(1) .plan-features li:nth-child(2)': { ko: '기본 처리 속도', en: 'Standard processing speed' },
        '.plan-card:nth-child(1) .plan-features li:nth-child(3)': { ko: 'Standard 화질로 효율적 제작', en: 'Efficient production in Standard quality' },
        '.plan-card:nth-child(1) .plan-trial': { ko: '✓ 평생 무료', en: '✓ Free forever' },
        '.plan-card:nth-child(1) .plan-note': { ko: '가입 즉시 무료 이용', en: 'Free to use upon sign-up' },
        '.plan-card:nth-child(2) .plan-credit': { ko: '월 <b>1,000</b> 크레딧<br><small>월 1분 영상 약 10개 제작 가능</small>', en: '<b>1,000</b> Credits / month<br><small>Approx. 10 1-min videos</small>' },
        '.plan-card:nth-child(2) .plan-features li:nth-child(1)': { ko: '입문자용 플랜 (필수 기능 제공)', en: 'Beginner plan (Essential features)' },
        '.plan-card:nth-child(2) .plan-features li:nth-child(2)': { ko: '기본 처리 속도', en: 'Standard processing speed' },
        '.plan-card:nth-child(2) .plan-features li:nth-child(3)': { ko: 'Standard 화질로 효율적 제작', en: 'Efficient production in Standard quality' },
        '.plan-card:nth-child(2) .plan-trial': { ko: '✓ 언제든지 취소 가능', en: '✓ Cancel anytime' },
        '.plan-card:nth-child(2) .plan-note': { ko: '결제 연동 준비중', en: 'Billing setup in progress' },
        '.plan-card:nth-child(3) .plan-badge': { ko: '인기', en: 'Popular' },
        '.plan-card:nth-child(3) .plan-credit': { ko: '월 <b>2,000</b> 크레딧<br><small>월 1분 영상 약 20개 제작 가능</small>', en: '<b>2,000</b> Credits / month<br><small>Approx. 20 1-min videos</small>' },
        '.plan-card:nth-child(3) .plan-features li:nth-child(1)': { ko: '성장용 추천 플랜', en: 'Recommended plan for growth' },
        '.plan-card:nth-child(3) .plan-features li:nth-child(2)': { ko: '우선 처리 (대기 시간 단축)', en: 'Priority processing (Reduced wait)' },
        '.plan-card:nth-child(3) .plan-features li:nth-child(3)': { ko: 'Premium 화질 선택 가능', en: 'Premium quality available' },
        '.plan-card:nth-child(3) .plan-features li:nth-child(4)': { ko: '신기능 우선 적용 (예정)', en: 'Early access to new features' },
        '.plan-card:nth-child(3) .plan-trial': { ko: '✓ 언제든지 취소 가능', en: '✓ Cancel anytime' },
        '.plan-card:nth-child(3) .plan-note': { ko: '결제 연동 준비중', en: 'Billing setup in progress' },
        '.plan-card:nth-child(4) .plan-credit': { ko: '월 <b>4,000</b> 크레딧<br><small>월 1분 영상 약 40개 제작 가능</small>', en: '<b>4,000</b> Credits / month<br><small>Approx. 40 1-min videos</small>' },
        '.plan-card:nth-child(4) .plan-features li:nth-child(1)': { ko: '전업/대량 제작용 플랜', en: 'Plan for professional/bulk production' },
        '.plan-card:nth-child(4) .plan-features li:nth-child(2)': { ko: '최우선 처리 (가장 빠른 렌더링)', en: 'Top priority processing (Fastest rendering)' },
        '.plan-card:nth-child(4) .plan-features li:nth-child(3)': { ko: '우선 지원 (예정)', en: 'Priority support (Coming soon)' },
        '.plan-card:nth-child(4) .plan-features li:nth-child(4)': { ko: '기업/팀 기능 우선 제공 (예정)', en: 'Enterprise/Team features (Coming soon)' },
        '.plan-card:nth-child(4) .plan-trial': { ko: '✓ 언제든지 취소 가능', en: '✓ Cancel anytime' },
        '.plan-card:nth-child(4) .plan-note': { ko: '결제 연동 준비중', en: 'Billing setup in progress' },
        '.cancel-btn': { ko: '구독 취소하기', en: 'Cancel Subscription' },
        '.cancel-shell h3': { ko: '언제든지 쉽게 취소하세요!', en: 'Cancel easily anytime!' },
        '.cancel-link': { ko: '크레딧이 더 필요하신가요?', en: 'Need more credits?' },
        '.credit-card h2': { ko: '크레딧 계산기', en: 'Credit Calculator' },
        '.credit-sub': { ko: '제작하려는 영상 길이와 개수를 입력하면 필요한 크레딧을 계산해드립니다.', en: 'Enter the length and quantity of videos you want to create, and we will calculate the required credits.' },
        'label[for="avgSecondsInput"]': { ko: '평균 영상 길이 (초)', en: 'Average video length (sec)' },
        'label[for="monthlyCountInput"]': { ko: '월간 제작 개수', en: 'Monthly production count' },
        '.credit-box:nth-child(1) .credit-k': { ko: '필요한 크레딧', en: 'Needed Credits' },
        '.credit-box:nth-child(2) .credit-k': { ko: '추천 플랜', en: 'Recommended Plan' },
        '.faq-head h2': { ko: '자주 묻는 질문', en: 'Frequently Asked Questions' },
        '.faq-card:nth-child(1) h3': { ko: '크레딧은 어떻게 사용되나요?', en: 'How are credits used?' },
        '.faq-card:nth-child(1) p': { ko: '1분 영상 제작 시 100 크레딧이 소모됩니다. 30초 영상은 50 크레딧, 2분 영상은 200 크레딧이 필요합니다.', en: '100 credits are consumed for a 1-minute video. A 30-second video requires 50 credits, and a 2-minute video requires 200 credits.' },
        '.faq-card:nth-child(2) h3': { ko: '남은 크레딧은 이월되나요?', en: 'Do remaining credits roll over?' },
        '.faq-card:nth-child(2) p': { ko: '사용하지 않은 크레딧은 다음 달로 이월되지 않습니다. 매월 새로운 크레딧이 지급됩니다.', en: 'Unused credits do not roll over to the next month. New credits are issued every month.' },
        '.faq-card:nth-child(3) h3': { ko: '플랜 변경은 어떻게 하나요?', en: 'How do I change my plan?' },
        '.faq-card:nth-child(3) p': { ko: '언제든지 상위 플랜으로 업그레이드 가능합니다. 다운그레이드는 다음 결제일부터 적용됩니다.', en: 'You can upgrade to a higher plan at any time. Downgrades take effect on the next billing date.' },
        '.faq-card:nth-child(4) h3': { ko: '환불 정책은 어떻게 되나요?', en: 'What is the refund policy?' },
        '.faq-card:nth-child(4) p': { ko: '구독 후 7일 이내 환불이 가능합니다. 자세한 기준은 환불정책을 확인해주세요.', en: 'Refunds are available within 7 days of subscription. Please check the refund policy for details.' },
        '.pricing-foot p:nth-child(1)': { ko: '언제든지 취소 가능 · VAT 포함가 · 다음 결제일부터 자동결제', en: 'Cancel anytime · VAT included · Auto-renewal from the next billing date' },
        '.pricing-foot p:nth-child(2) a[href="./terms.html"]': { ko: '이용약관', en: 'Terms' },
        '.pricing-foot p:nth-child(2) a[href="./privacy.html"]': { ko: '개인정보처리방침', en: 'Privacy Policy' },
        '.pricing-foot p:nth-child(2) a[href="./refund.html"]': { ko: '환불정책', en: 'Refund Policy' },
        '.pricing-foot p:nth-child(2) a[href="./marketing.html"]': { ko: '광고수신동의 철회', en: 'Marketing Opt-out' }
      }
    },
    support: {
      title: { ko: '고객센터 - ShortsMaker', en: 'Support - ShortsMaker' },
      texts: {
        '.dash-nav-center a[href="./dashboard.html"]': { ko: '대시보드', en: 'Dashboard' },
        '.dash-nav-center a[href="./ranking-create.html"]': { ko: '메인 작업', en: 'Editor' },
        '.dash-nav-center a[href="./index.html"]': { ko: '에뮬레이터', en: 'Emulator' },
        '#nav-admin': { ko: '관리자', en: 'Admin' },
        '.dash-nav-center a[href="./pricing.html"]': { ko: '요금제', en: 'Pricing' },
        '.dash-nav-center a[href="./support.html"]': { ko: '고객센터', en: 'Support' },
        '#logout-btn': { ko: '로그아웃', en: 'Logout' },
        '.support-hero h1': { ko: '고객센터', en: 'Support Center' },
        '.support-hero p.support-desc': { ko: '문의 내용을 남기면 계정 기준으로 접수되고, 관리자 화면에서 확인할 수 있습니다.', en: 'Submit your issue under your account, and the admin can review it from the management panel.' },
        '.support-hero p.support-email-text': { ko: '직접 이메일 문의: <a href="mailto:help@getshortsmaker.com" style="color:#ff6b00;text-decoration:none;font-weight:bold;">help@getshortsmaker.com</a>', en: 'Direct email support: <a href="mailto:help@getshortsmaker.com" style="color:#ff6b00;text-decoration:none;font-weight:bold;">help@getshortsmaker.com</a>' },
        '.support-card:nth-child(1) h2': { ko: '문의 남기기', en: 'Create a ticket' },
        'label[for="subject-input"]': { ko: '제목', en: 'Subject' },
        'label[for="message-input"]': { ko: '문의 내용', en: 'Message' },
        '#submit-btn': { ko: '문의 접수', en: 'Submit' },
        '.support-card:nth-child(2) h2': { ko: '내 문의 내역', en: 'My tickets' },
        '#refresh-btn': { ko: '새로고침', en: 'Refresh' },
        '#admin-inquiry-section h2': { ko: '전체 문의 관리', en: 'All tickets' },
        '.support-admin-badge': { ko: '관리자', en: 'Admin' }
      },
      placeholders: {
        '#subject-input': { ko: '예: 결제 문의 / 기능 오류 / 환불 요청', en: 'e.g. billing issue / feature bug / refund request' },
        '#message-input': { ko: '상황을 자세히 적어주세요. 오류가 난 화면, 작업 순서, 기대한 결과를 같이 적으면 처리 속도가 빨라집니다.', en: 'Describe the issue clearly. Include the screen, steps taken, and expected result for faster handling.' }
      }
    },
    admin: {
      title: { ko: '관리자 - 사용자 관리', en: 'Admin - User Management' },
      texts: {
        '.dash-nav-center a[href="./dashboard.html"]': { ko: '대시보드', en: 'Dashboard' },
        '.dash-nav-center a[href="./ranking-create.html"]': { ko: '메인 작업', en: 'Editor' },
        '.dash-nav-center a[href="./index.html"]': { ko: '에뮬레이터', en: 'Emulator' },
        '.dash-nav-center a[href="./admin.html"]': { ko: '관리자', en: 'Admin' },
        '.dash-nav-center a[href="./pricing.html"]': { ko: '요금제', en: 'Pricing' },
        '.dash-nav-center a[href="./support.html"]': { ko: '고객센터', en: 'Support' },
        '#logout-btn': { ko: '로그아웃', en: 'Logout' },
        '.dashboard-header h1': { ko: '사용자 관리', en: 'User management' },
        '.welcome-message': { ko: '가입된 사용자 목록을 확인하고 크레딧을 조정할 수 있습니다.', en: 'Review registered users and manage their credits.' },
        '#refreshBtn': { ko: '새로고침', en: 'Refresh' },
        '.admin-table thead th:nth-child(1)': { ko: '이름', en: 'Name' },
        '.admin-table thead th:nth-child(2)': { ko: '이메일', en: 'Email' },
        '.admin-table thead th:nth-child(3)': { ko: '크레딧', en: 'Credits' },
        '.admin-table thead th:nth-child(4)': { ko: '조정', en: 'Actions' },
        '.admin-table thead th:nth-child(5)': { ko: '탈퇴', en: 'Delete' },
        '.admin-table thead th:nth-child(6)': { ko: '가입일', en: 'Joined' },
        '.admin-table thead th:nth-child(7)': { ko: '최근활동', en: 'Last active' }
      },
      placeholders: {
        '#searchInput': { ko: '이메일/이름 검색', en: 'Search by email/name' }
      }
    },
    emulator: {
      title: { ko: '랭킹 에뮬레이터 - ShortsMaker', en: 'Ranking Emulator - ShortsMaker' },
      texts: {
        '#nav-dashboard-link': { ko: '대시보드', en: 'Dashboard' },
        '#nav-main-work-link': { ko: '메인 작업', en: 'Editor' },
        '.sc-nav a[href="./index.html"]': { ko: '에뮬레이터', en: 'Emulator' },
        '#project-settings-title': { ko: '프로젝트 설정', en: 'Project settings' },
        '#ranking-video-label': { ko: '랭킹 영상', en: 'Ranking video' },
        '#title-settings-title': { ko: '타이틀 설정', en: 'Title settings' },
        '#title-line-1-label': { ko: '첫 번째 줄', en: 'First line' },
        '#title-line-2-label': { ko: '두 번째 줄', en: 'Second line' },
        '#title-x-offset-label': { ko: '제목 X 위치', en: 'Title X position' },
        '#title-y-offset-label': { ko: '제목 Y 위치', en: 'Title Y position' },
        '#title-line1-font-size-label': { ko: '첫 번째 줄 크기', en: 'First line size' },
        '#title-line2-font-size-label': { ko: '두 번째 줄 크기', en: 'Second line size' },
        '#title-font-weight-label': { ko: '제목 굵기', en: 'Title weight' },
        '#title-line1-color-label': { ko: '첫 번째 줄 색상', en: 'First line color' },
        '#title-line2-color-label': { ko: '두 번째 줄 색상', en: 'Second line color' },
        '#layout-controls-title': { ko: '레이아웃 위치 조절', en: 'Layout controls' },
        '#ranking-list-settings-title': { ko: '랭킹 목록 설정', en: 'Ranking list settings' },
        '#background-music-title': { ko: '배경음악', en: 'Background music' },
        '#transition-black-title': { ko: '전환 검은 화면', en: 'Black transition screen' },
        '#background-color-title': { ko: '배경 색상', en: 'Background color' },
        '#caption-settings-title': { ko: '자막 설정', en: 'Caption settings' },
        '#ranking-items-title': { ko: '랭킹 아이템', en: 'Ranking items' },
        '#ranking-item-count': { ko: '5개의 비디오 클립', en: '5 video clips' },
        '#timeline-label': { ko: '자막', en: 'Captions' },
        '#timeline-add-btn': { ko: '+ 자막 추가', en: '+ Add caption' },
        '#preview-video-empty': { ko: '선택한 랭킹 영상이 여기서 재생됩니다', en: 'The selected ranking clip will play here' },
        '#back-to-create-btn': { ko: '← 이전', en: '← Back' },
        '#generate-video-btn': { ko: '영상 생성', en: 'Generate video' },
        '#ranking-list-x-label': { ko: '목록 X 위치', en: 'List X position' },
        '#ranking-list-y-label': { ko: '목록 Y 위치', en: 'List Y position' },
        '#ranking-list-font-size-label': { ko: '글자 크기', en: 'Text size' },
        '#ranking-list-font-weight-label': { ko: '글자 굵기', en: 'Text weight' },
        '#ranking-list-color-label': { ko: '기본 색상', en: 'Base color' },
        '#ranking-list-active-color-label': { ko: '활성 색상', en: 'Active color' },
        '#bgm-volume-label': { ko: '볼륨', en: 'Volume' },
        '#transition-black-enabled-text': { ko: '사용', en: 'Enable' },
        '#subtitle-position-label': { ko: '위치', en: 'Position' },
        '#subtitle-y-offset-label': { ko: '세로 위치 조정', en: 'Vertical offset' },
        '#subtitle-font-size-label': { ko: '자막 폰트 크기', en: 'Caption font size' },
        '#subtitle-font-weight-label': { ko: '폰트 굵기', en: 'Font weight' },
        '#subtitle-text-color-label': { ko: '자막 색상', en: 'Caption color' },
        '#subtitle-bg-color-label': { ko: '자막 배경색', en: 'Caption background' },
        '#subtitle-bg-opacity-label': { ko: '배경 투명도', en: 'Background opacity' },
        '#subtitle-shadow-enabled-text': { ko: '텍스트 그림자', en: 'Text shadow' }
      },
      custom(lang) {
        const setOptions = (selector, values) => {
          const select = document.querySelector(selector);
          if (!select) return;
          Array.from(select.options).forEach((option, index) => {
            if (values[index]) option.textContent = values[index];
          });
        };
        const setLabelWithValue = (labelId, text) => {
          const label = document.getElementById(labelId);
          if (!label) return;
          const valueSpan = label.querySelector('span');
          const valueHtml = valueSpan ? valueSpan.outerHTML : '';
          label.innerHTML = valueHtml ? `${text} ${valueHtml}` : text;
        };

        setOptions('#title-font-weight', lang === 'en'
          ? ['Bold (600)', 'Bolder (700)', 'Strong (800)', 'Max (900)']
          : ['굵게 (600)', '더 굵게 (700)', '강하게 (800)', '최대 (900)']);
        setOptions('#ranking-list-font-weight', lang === 'en'
          ? ['Bold (600)', 'Bolder (700)', 'Strong (800)', 'Max (900)']
          : ['굵게 (600)', '더 굵게 (700)', '강하게 (800)', '최대 (900)']);
        setOptions('#subtitle-style-position', lang === 'en'
          ? ['Bottom', 'Middle', 'Top']
          : ['하단', '중앙', '상단']);
        setOptions('#subtitle-position-select', lang === 'en'
          ? ['Bottom', 'Middle', 'Top']
          : ['하단', '중앙', '상단']);
        setOptions('#subtitle-font-weight', lang === 'en'
          ? ['Regular (500)', 'Bold (600)', 'Bolder (700)', 'Strong (800)', 'Max (900)']
          : ['보통 (500)', '굵게 (600)', '더 굵게 (700)', '강하게 (800)', '최대 (900)']);
        setLabelWithValue('layout-top-padding-label', lang === 'en' ? 'Top padding' : '상단 여백');
        setLabelWithValue('video-scale-label', lang === 'en' ? 'Video scale' : '영상 크기');
        setLabelWithValue('video-y-offset-label', lang === 'en' ? 'Video Y position' : '영상 Y 위치');

        if (typeof window.translateEmulatorUI === 'function') {
          window.translateEmulatorUI();
        }
      }
    },
    editor: {
      title: { ko: '메인 작업 - ShortsMaker', en: 'Editor - ShortsMaker' },
      texts: {
        '.sc-nav a[href="./dashboard.html"]': { ko: 'Dashboard', en: 'Dashboard' },
        '.sc-nav a[href="./ranking-create.html"]': { ko: '메인 작업', en: 'Editor' },
        '.sc-nav a[href="./index.html"]': { ko: '에뮬레이터', en: 'Emulator' },
        '#backToDashboardBtn': { ko: '← 뒤로가기', en: '← Back' },
        '.settings-panel .setting-section:nth-of-type(1) h3': { ko: '프로젝트', en: 'Project' },
        'label[for="projectNameInput"]': { ko: '프로젝트 이름', en: 'Project name' },
        '#saveProjectBtn': { ko: '프로젝트 저장', en: 'Save project' },
        '.settings-panel .setting-section:nth-of-type(2) h3': { ko: '상단 타이틀 설정', en: 'Header title' },
        'label[for="titleLine1"]': { ko: '첫 번째 줄', en: 'First line' },
        'label[for="titleLine2"]': { ko: '두 번째 줄', en: 'Second line' },
        '.settings-panel .setting-section:nth-of-type(3) h3': { ko: '랭킹 영상 설정', en: 'Ranking setup' },
        'label[for="rankingCount"]': { ko: '랭킹 개수', en: 'Ranking count' },
        '.settings-panel .setting-section:nth-of-type(4) h3': { ko: '배경음악', en: 'Background music' },
        '#removeMusicBtn': { ko: '음악 제거', en: 'Remove audio' },
        'label[for="musicVolume"]': { ko: '음악 볼륨', en: 'Music volume' },
        '.settings-panel .setting-section:nth-of-type(5) h3': { ko: '계정', en: 'Account' },
        '#logoutBtn': { ko: '로그아웃', en: 'Logout' },
        '.content-editor .editor-section h3': { ko: '랭킹 아이템', en: 'Ranking items' },
        '.preview-panel .editor-section h3': { ko: '미리보기', en: 'Preview' },
        '#refreshPreview': { ko: '미리보기 새로고침', en: 'Refresh preview' },
        '#generateBtn': { ko: '다음 →', en: 'Next →' },
        '#createNewBtn': { ko: '새 영상 만들기', en: 'New video' }
      },
      placeholders: {
        '#projectNameInput': { ko: '예: 동물 레전드 TOP 5', en: 'e.g. Animal Legends TOP 5' },
        '#titleLine1': { ko: '2026년 최고의', en: 'Best of 2026' },
        '#titleLine2': { ko: '동물 레전드 TOP 5', en: 'Animal Legends TOP 5' }
      }
    }
  };

  function getCurrentLang() {
    const saved = (localStorage.getItem(STORAGE_KEY) || 'ko').toLowerCase();
    return saved === 'en' ? 'en' : 'ko';
  }

  function setText(selector, text) {
    const elements = document.querySelectorAll(selector);
    if (!elements.length || typeof text !== 'string') return;
    elements.forEach((element) => {
      if (text.includes('<')) {
        element.innerHTML = text;
      } else {
        element.textContent = text;
      }
    });
  }

  function applyPageTranslations(lang) {
    const pageKey = document.body?.dataset?.page || '';
    const page = pageTranslations[pageKey];
    if (!page) return;

    if (page.title) document.title = page.title[lang];

    Object.entries(page.texts || {}).forEach(([selector, values]) => {
      setText(selector, values[lang]);
    });

    Object.entries(page.placeholders || {}).forEach(([selector, values]) => {
      const element = document.querySelector(selector);
      if (element) element.setAttribute('placeholder', values[lang]);
    });

    if (typeof page.custom === 'function') {
      page.custom(lang);
    }
  }

  function applyLanguage(lang) {
    document.documentElement.lang = lang;
    document.querySelectorAll('[data-lang-option]').forEach((btn) => {
      btn.classList.toggle('is-active', btn.getAttribute('data-lang-option') === lang);
    });
    applyPageTranslations(lang);
    document.dispatchEvent(new CustomEvent('site-language-change', { detail: { lang } }));
  }

  function setCurrentLang(lang) {
    const next = lang === 'en' ? 'en' : 'ko';
    localStorage.setItem(STORAGE_KEY, next);
    applyLanguage(next);
  }

  function initLanguageSwitch() {
    const current = getCurrentLang();
    document.querySelectorAll('[data-lang-option]').forEach((btn) => {
      btn.addEventListener('click', () => setCurrentLang(btn.getAttribute('data-lang-option')));
    });
    applyLanguage(current);
  }

  window.getSiteLang = getCurrentLang;
  window.setSiteLang = setCurrentLang;

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initLanguageSwitch);
  } else {
    initLanguageSwitch();
  }
})();
