// 랭킹 영상 제작 JavaScript

class RankingVideoCreator {
    constructor() {
        this.rankingCount = 5; // 동적 랭킹 개수 (3-7)
        this.videos = new Array(this.rankingCount).fill(null);
        this.titles = new Array(this.rankingCount).fill('');
        this.videoDurations = new Array(this.rankingCount).fill(10); // 각 영상의 재생 시간 (초)
        this.playbackOrder = Array.from({length: this.rankingCount}, (_, i) => i + 1); // 재생 순서 배열
        this.titleSettings = {
            text1: '',
            text2: ''
            // fontSize, color, shadow는 하드코딩됨 (48px, #FFFFFF, strong)
        };
        this.userCredits = 0;

        this.projectId = new URLSearchParams(window.location.search).get('projectId') || null;
        this.currentDraftId = null;
        this.loadedDraftData = null;

        // 배경음악 설정
        this.backgroundMusic = null; // File 객체
        this.backgroundMusicUrl = null; // S3 URL
        this.backgroundMusicS3Key = null;
        this.backgroundMusicVolume = 0.3; // 0-1

        this.init();
    }

    isLocalFileMode() {
        return window.location.protocol === 'file:';
    }

    getSiblingFileUrl(fileName) {
        const path = window.location.pathname.replace(/\\/g, '/');
        const baseDir = path.slice(0, path.lastIndexOf('/') + 1);

        if (window.location.protocol === 'file:') {
            return `file://${baseDir}${fileName}`;
        }

        return `${window.location.origin}${baseDir}${fileName}`;
    }

    openVideoDraftDb() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open('shortsmaker-local-db', 1);
            request.onupgradeneeded = () => {
                const db = request.result;
                if (!db.objectStoreNames.contains('rankingVideos')) {
                    db.createObjectStore('rankingVideos', { keyPath: 'id' });
                }
            };
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    async saveVideosToDraftDb(draftId) {
        const db = await this.openVideoDraftDb();
        await Promise.all(
            this.videos.slice(0, this.rankingCount).map((videoFile, idx) => new Promise((resolve, reject) => {
                const key = `${draftId}_${idx + 1}`;
                const tx = db.transaction('rankingVideos', 'readwrite');
                const store = tx.objectStore('rankingVideos');

                if (videoFile) {
                    store.put({
                        id: key,
                        blob: videoFile,
                        fileName: videoFile.name || '',
                        mimeType: videoFile.type || 'video/mp4',
                        updatedAt: Date.now()
                    });
                } else {
                    store.delete(key);
                }

                tx.oncomplete = () => resolve();
                tx.onerror = () => reject(tx.error);
            }))
        );
        db.close();
    }

    async init() {
        await this.checkAuth();
        await this.loadUserCredits();
        this.setupEventListeners();
        this.setupCanvas();
        await this.loadProjectIfNeeded();
        this.initializeRankingCards(); // 초기 카드 생성
        if (this.loadedDraftData) this.applyDraftToUi(this.loadedDraftData);
        this.updatePreview();
    }

    async checkAuth() {
        if (this.isLocalFileMode()) {
            return;
        }

        try {
            const response = await fetch('/api/user');
            const data = await response.json();

            if (!data.user) {
                window.location.href = `/login.html?next=${encodeURIComponent(window.location.pathname + window.location.search)}`;
                return;
            }
        } catch (error) {
            console.error('Auth check failed:', error);
            if (!this.isLocalFileMode()) {
                window.location.href = `/login.html?next=${encodeURIComponent(window.location.pathname + window.location.search)}`;
            }
        }
    }

    async loadUserCredits() {
        try {
            const response = await fetch('/api/user/credits');
            const data = await response.json();

            this.userCredits = data.credits || 0;

            const creditElement = document.getElementById('userCredits');
            if (creditElement) {
                creditElement.textContent = this.userCredits;
            }
        } catch (error) {
            console.error('Failed to load credits:', error);
            this.userCredits = 0;

            const creditElement = document.getElementById('userCredits');
            if (creditElement) {
                creditElement.textContent = 0;
            }
        }
    }

    setupEventListeners() {
        if (this.isLocalFileMode()) {
            document.querySelectorAll('a[href="./dashboard.html"]').forEach((a) => {
                a.href = this.getSiblingFileUrl('dashboard.html');
            });
            document.querySelectorAll('a[href="./ranking-create.html"]').forEach((a) => {
                a.href = this.getSiblingFileUrl('ranking-create.html');
            });
            document.querySelectorAll('a[href="./index.html"]').forEach((a) => {
                a.href = this.getSiblingFileUrl('index.html');
            });
        }

        // 로그아웃 버튼
        document.getElementById('logoutBtn')?.addEventListener('click', () => {
            if (this.isLocalFileMode()) {
                window.location.href = this.getSiblingFileUrl('dashboard.html');
                return;
            }
            window.location.href = '/logout';
        });

        document.getElementById('backToDashboardBtn')?.addEventListener('click', () => {
            if (this.isLocalFileMode()) {
                window.location.href = this.getSiblingFileUrl('dashboard.html');
                return;
            }
            history.back();
        });

        document.getElementById('saveProjectBtn')?.addEventListener('click', async () => {
            await this.saveProject();
        });

        document.getElementById('projectNameInput')?.addEventListener('input', () => {
            this.updateSaveStatus('');
        });

        // 타이틀 설정
        document.getElementById('titleLine1')?.addEventListener('input', (e) => {
            this.titleSettings.text1 = e.target.value;
            this.updatePreview();
        });

        document.getElementById('titleLine2')?.addEventListener('input', (e) => {
            this.titleSettings.text2 = e.target.value;
            this.updatePreview();
        });

        // 랭킹 개수 선택
        document.getElementById('rankingCount')?.addEventListener('change', (e) => {
            this.rankingCount = parseInt(e.target.value);
            this.updateRankingCards();
        });

        // 미리보기 새로고침
        document.getElementById('refreshPreview')?.addEventListener('click', () => {
            this.updatePreview();
        });

        // 생성 버튼 - 프리뷰 페이지로 이동
        document.getElementById('generateBtn')?.addEventListener('click', () => {
            this.goToPreview();
        });

        // 새 영상 만들기
        document.getElementById('createNewBtn')?.addEventListener('click', () => {
            this.resetForm();
        });

        // 배경음악 업로드
        document.getElementById('backgroundMusic')?.addEventListener('change', (e) => {
            if (e.target.files.length > 0) {
                this.handleMusicUpload(e.target.files[0]);
            }
        });

        // 배경음악 제거
        document.getElementById('removeMusicBtn')?.addEventListener('click', () => {
            this.removeMusic();
        });

        // 음악 볼륨 조절
        document.getElementById('musicVolume')?.addEventListener('input', (e) => {
            this.backgroundMusicVolume = parseInt(e.target.value) / 100;
            document.getElementById('volumeValue').textContent = `${e.target.value}%`;

            // 프리뷰 플레이어 볼륨 업데이트
            const musicPlayer = document.getElementById('musicPlayer');
            if (musicPlayer) {
                musicPlayer.volume = this.backgroundMusicVolume;
            }
        });

    }

    // 초기 랭킹 카드 생성
    updateSaveStatus(message) {
        const el = document.getElementById('saveStatus');
        if (!el) return;
        el.textContent = message || '';
    }

    getProjectNameFallback() {
        const inputVal = (document.getElementById('projectNameInput')?.value || '').trim();
        if (inputVal) return inputVal;
        const t2 = (document.getElementById('titleLine2')?.value || '').trim();
        const t1 = (document.getElementById('titleLine1')?.value || '').trim();
        return t2 || t1 || '랭킹 프로젝트';
    }

    collectDraftData(draftId) {
        const rankingItems = Array.from({ length: this.rankingCount }, (_, i) => ({
            rank: i + 1,
            title: (this.titles[i] || `Rank ${i + 1}`).trim(),
            duration: this.videoDurations[i] || 10,
            playOrder: this.playbackOrder[i] || i + 1,
            fileName: this.videos[i]?.name || '',
            videoKey: `${draftId}_${i + 1}`
        }));

        return {
            draftId,
            titleSettings: {
                text1: (this.titleSettings.text1 || '').trim(),
                text2: (this.titleSettings.text2 || '').trim()
            },
            rankingCount: this.rankingCount,
            rankingItems,
            savedAt: Date.now()
        };
    }

    async loadProjectIfNeeded() {
        if (this.isLocalFileMode()) return;
        if (!this.projectId) return;

        try {
            const res = await fetch(`/api/ranking/project/${encodeURIComponent(this.projectId)}`);
            if (!res.ok) return;
            const data = await res.json();
            const project = data.project;
            if (!project) return;

            const nameEl = document.getElementById('projectNameInput');
            if (nameEl) nameEl.value = project.project_name || '';

            const draftData = project.data || null;
            if (draftData && draftData.draftId) this.currentDraftId = draftData.draftId;
            if (draftData && draftData.rankingCount) {
                this.rankingCount = parseInt(draftData.rankingCount, 10) || this.rankingCount;
                const sel = document.getElementById('rankingCount');
                if (sel) sel.value = String(this.rankingCount);
            }

            if (draftData && draftData.titleSettings) {
                this.titleSettings.text1 = (draftData.titleSettings.text1 || '').trim();
                this.titleSettings.text2 = (draftData.titleSettings.text2 || '').trim();
            }

            this.loadedDraftData = draftData;
            this.updateSaveStatus('불러왔습니다.');
        } catch (e) {
            console.error('Failed to load project:', e);
        }
    }

    applyDraftToUi(draftData) {
        if (!draftData) return;

        const title1 = (draftData.titleSettings?.text1 || '').trim();
        const title2 = (draftData.titleSettings?.text2 || '').trim();

        const title1El = document.getElementById('titleLine1');
        const title2El = document.getElementById('titleLine2');
        if (title1El) title1El.value = title1;
        if (title2El) title2El.value = title2;

        this.titleSettings.text1 = title1;
        this.titleSettings.text2 = title2;

        const items = Array.isArray(draftData.rankingItems) ? draftData.rankingItems : [];
        items.forEach((it, idx) => {
            this.titles[idx] = String(it.title || '').trim();
            this.videoDurations[idx] = parseInt(it.duration, 10) || 10;
            this.playbackOrder[idx] = parseInt(it.playOrder, 10) || (idx + 1);
        });

        document.querySelectorAll('.ranking-item').forEach((item, idx) => {
            const titleInput = item.querySelector('.rank-title');
            if (titleInput) titleInput.value = this.titles[idx] || '';

            const durationInput = item.querySelector('.duration-input');
            if (durationInput) durationInput.value = String(this.videoDurations[idx] || 10);

            const playbackSelect = item.querySelector('.playback-order-select');
            if (playbackSelect) playbackSelect.value = String(this.playbackOrder[idx] || (idx + 1));
        });
    }

    async saveProject() {
        if (this.isLocalFileMode()) {
            this.updateSaveStatus('로컬 모드에서는 서버 저장을 지원하지 않습니다.');
            return;
        }

        const draftId = this.currentDraftId || `draft_${Date.now()}`;
        this.currentDraftId = draftId;
        const projectName = this.getProjectNameFallback();
        const draftData = this.collectDraftData(draftId);

        this.updateSaveStatus('저장 중...');

        try {
            let res;
            if (this.projectId) {
                res = await fetch(`/api/ranking/project/${encodeURIComponent(this.projectId)}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ project_name: projectName, data: draftData })
                });
            } else {
                res = await fetch('/api/ranking/project', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ project_name: projectName, data: draftData })
                });
            }

            if (!res.ok) throw new Error('Save failed');
            const data = await res.json();
            const savedId = data?.project?.id;
            if (savedId && !this.projectId) {
                this.projectId = savedId;
                const u = new URL(window.location.href);
                u.searchParams.set('projectId', savedId);
                window.history.replaceState({}, '', u.toString());
            }

            this.updateSaveStatus('저장 완료');
        } catch (e) {
            console.error('Failed to save project:', e);
            this.updateSaveStatus('저장 실패');
        }
    }

    initializeRankingCards() {
        this.updateRankingCards();
    }

    // 랭킹 개수 변경 시 카드 동적 생성
    updateRankingCards() {
        const container = document.getElementById('rankingItemsContainer');
        container.innerHTML = '';

        // 배열 초기화
        this.videos = new Array(this.rankingCount).fill(null);
        this.titles = new Array(this.rankingCount).fill('');
        this.videoDurations = new Array(this.rankingCount).fill(10);
        this.playbackOrder = Array.from({length: this.rankingCount}, (_, i) => i + 1);

        // 카드 동적 생성
        for (let i = 0; i < this.rankingCount; i++) {
            const cardHTML = this.createRankingCard(i + 1);
            container.insertAdjacentHTML('beforeend', cardHTML);
        }

        // 이벤트 리스너 재바인딩
        this.bindRankingCardListeners();
        this.updatePreview();
    }

    createRankingCard(rank) {
        const index = rank - 1;
        return `
        <div class="ranking-item" data-rank="${rank}">
            <div class="rank-number">${rank}.</div>
            <div class="rank-content">
                <input type="text" class="rank-title" data-index="${index}" placeholder="${rank}위 제목 입력" maxlength="50">

                <div class="playback-order">
                    <label>재생 순서:</label>
                    <select class="playback-order-select" data-rank="${rank}">
                        ${this.generateOrderOptions(rank)}
                    </select>
                </div>

                <div class="video-duration" style="margin-top: 10px;">
                    <label>재생 시간:</label>
                    <input type="number" class="duration-input" data-rank="${rank}" min="1" max="60" value="10" step="1" style="width: 80px; padding: 5px; margin-right: 5px;">
                    <span>초</span>
                </div>

                <div class="video-upload-box">
                    <input type="file" class="video-input" accept="video/*" id="video${rank}" data-index="${index}">
                    <label for="video${rank}" class="upload-label">
                        <i class="fas fa-cloud-upload-alt"></i>
                        <span>영상 업로드</span>
                    </label>
                    <div class="video-preview" style="display:none;">
                        <video controls></video>
                        <button class="remove-video" type="button">제거</button>
                    </div>
                </div>
            </div>
        </div>`;
    }

    generateOrderOptions(currentRank) {
        let options = '';
        for (let i = 1; i <= this.rankingCount; i++) {
            const selected = i === currentRank ? 'selected' : '';
            options += `<option value="${i}" ${selected}>${i}번째로 재생</option>`;
        }
        return options;
    }

    bindRankingCardListeners() {
        // 모든 랭킹 아이템에 이벤트 리스너 추가
        document.querySelectorAll('.ranking-item').forEach((item, index) => {
            // 제목 입력
            const titleInput = item.querySelector('.rank-title');
            titleInput.addEventListener('input', (e) => {
                this.titles[index] = e.target.value;
                this.updatePreview();
            });

            // 재생 순서 선택
            const playbackSelect = item.querySelector('.playback-order-select');
            playbackSelect.addEventListener('change', (e) => {
                this.handlePlaybackOrderChange(index, parseInt(e.target.value));
            });

            // 재생 시간 설정
            const durationInput = item.querySelector('.duration-input');
            if (durationInput) {
                durationInput.addEventListener('change', (e) => {
                    const duration = parseInt(e.target.value) || 10;
                    this.videoDurations[index] = Math.min(Math.max(duration, 1), 60); // 1-60초 범위
                    e.target.value = this.videoDurations[index];
                });
            }

            // 비디오 업로드
            const videoInput = item.querySelector('.video-input');
            const uploadLabel = item.querySelector('.upload-label');
            const videoPreview = item.querySelector('.video-preview');
            const removeBtn = item.querySelector('.remove-video');

            // 드래그 앤 드롭 지원
            uploadLabel.addEventListener('dragover', (e) => {
                e.preventDefault();
                uploadLabel.style.borderColor = '#ff6b00';
                uploadLabel.style.background = '#fff5f0';
            });

            uploadLabel.addEventListener('dragleave', (e) => {
                uploadLabel.style.borderColor = '#e0e0e0';
                uploadLabel.style.background = 'white';
            });

            uploadLabel.addEventListener('drop', (e) => {
                e.preventDefault();
                uploadLabel.style.borderColor = '#e0e0e0';
                uploadLabel.style.background = 'white';

                const files = e.dataTransfer.files;
                if (files.length > 0 && files[0].type.startsWith('video/')) {
                    this.handleVideoUpload(files[0], index);
                }
            });

            videoInput.addEventListener('change', (e) => {
                if (e.target.files.length > 0) {
                    this.handleVideoUpload(e.target.files[0], index);
                }
            });

            removeBtn.addEventListener('click', () => {
                this.removeVideo(index);
            });
        });
    }

    handleVideoUpload(file, index) {
        if (!file.type.startsWith('video/')) {
            alert('비디오 파일만 업로드 가능합니다.');
            return;
        }

        if (file.size > 150 * 1024 * 1024) { // 150MB 제한
            alert('파일 크기는 150MB를 초과할 수 없습니다.');
            return;
        }

        this.videos[index] = file;

        // 미리보기 업데이트
        const item = document.querySelectorAll('.ranking-item')[index];
        const uploadLabel = item.querySelector('.upload-label');
        const videoPreview = item.querySelector('.video-preview');
        const previewVideo = item.querySelector('.video-preview video');

        uploadLabel.style.display = 'none';
        videoPreview.style.display = 'block';

        const url = URL.createObjectURL(file);
        previewVideo.src = url;

        this.updatePreview();
    }

    removeVideo(index) {
        this.videos[index] = null;

        const item = document.querySelectorAll('.ranking-item')[index];
        const uploadLabel = item.querySelector('.upload-label');
        const videoPreview = item.querySelector('.video-preview');
        const previewVideo = item.querySelector('.video-preview video');

        // Blob URL 해제 (메모리 누수 방지)
        if (previewVideo.src && previewVideo.src.startsWith('blob:')) {
            URL.revokeObjectURL(previewVideo.src);
        }

        uploadLabel.style.display = 'flex';
        videoPreview.style.display = 'none';
        previewVideo.src = '';

        this.updatePreview();
    }

    // 배경음악 업로드 처리
    handleMusicUpload(file) {
        // 파일 형식 검사
        if (!file.type.startsWith('audio/')) {
            alert('오디오 파일만 업로드 가능합니다. (MP3, WAV, OGG)');
            return;
        }

        // 파일 크기 검사 (20MB)
        if (file.size > 20 * 1024 * 1024) {
            alert('파일 크기는 20MB를 초과할 수 없습니다.');
            return;
        }

        this.backgroundMusic = file;

        // UI 업데이트
        const uploadLabel = document.getElementById('musicUploadLabel');
        const musicPreview = document.getElementById('musicPreview');
        const musicFileName = document.getElementById('musicFileName');
        const musicPlayer = document.getElementById('musicPlayer');

        if (uploadLabel) uploadLabel.style.display = 'none';
        if (musicPreview) musicPreview.style.display = 'block';
        if (musicFileName) musicFileName.textContent = file.name;

        // 오디오 미리듣기 설정
        if (musicPlayer) {
            const url = URL.createObjectURL(file);
            musicPlayer.src = url;
            musicPlayer.volume = this.backgroundMusicVolume;
        }

    }

    // 배경음악 제거
    removeMusic() {
        this.backgroundMusic = null;
        this.backgroundMusicUrl = null;
        this.backgroundMusicS3Key = null;

        // UI 업데이트
        const uploadLabel = document.getElementById('musicUploadLabel');
        const musicPreview = document.getElementById('musicPreview');
        const musicPlayer = document.getElementById('musicPlayer');
        const musicInput = document.getElementById('backgroundMusic');

        if (uploadLabel) uploadLabel.style.display = 'flex';
        if (musicPreview) musicPreview.style.display = 'none';
        if (musicPlayer) {
            // Blob URL 해제 (메모리 누수 방지)
            if (musicPlayer.src && musicPlayer.src.startsWith('blob:')) {
                URL.revokeObjectURL(musicPlayer.src);
            }
            musicPlayer.pause();
            musicPlayer.src = '';
        }
        if (musicInput) musicInput.value = '';

    }

    setupCanvas() {
        this.canvas = document.getElementById('previewCanvas');
        if (!this.canvas) {
            return;
        }
        this.ctx = this.canvas.getContext('2d');
    }

    handlePlaybackOrderChange(rankIndex, newOrder) {
        const oldOrder = this.playbackOrder[rankIndex];

        // 이미 해당 순서를 사용 중인 랭킹 찾기
        const conflictIndex = this.playbackOrder.findIndex((order, idx) =>
            order === newOrder && idx !== rankIndex
        );

        if (conflictIndex !== -1) {
            // 충돌하는 랭킹과 순서 교환
            this.playbackOrder[conflictIndex] = oldOrder;

            // UI 업데이트
            const conflictSelect = document.querySelectorAll('.playback-order-select')[conflictIndex];
            conflictSelect.value = oldOrder;
        }

        // 새 순서 설정
        this.playbackOrder[rankIndex] = newOrder;
        this.updatePreview();
    }

    updatePreview() {
        if (!this.ctx || !this.canvas) {
            return;
        }
        const ctx = this.ctx;
        const canvas = this.canvas;

        // 검은 배경
        ctx.fillStyle = '#000000';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // 상단 타이틀 영역 (15%)
        const titleAreaHeight = canvas.height * 0.15;
        ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
        ctx.fillRect(0, 0, canvas.width, titleAreaHeight);

        // 타이틀 텍스트 (하드코딩: 48px, #FFFFFF, strong shadow)
        ctx.fillStyle = '#FFFFFF';
        ctx.font = `bold 48px 'Pretendard', 'Noto Sans KR', sans-serif`;
        ctx.textAlign = 'center';

        // 그림자 효과 (하드코딩: strong)
        ctx.shadowBlur = 10;
        ctx.shadowColor = 'rgba(0, 0, 0, 0.8)';
        ctx.shadowOffsetX = 3;
        ctx.shadowOffsetY = 3;

        // 첫 번째 줄
        if (this.titleSettings.text1) {
            ctx.fillText(this.titleSettings.text1, canvas.width / 2, titleAreaHeight * 0.4);
        }

        // 두 번째 줄
        if (this.titleSettings.text2) {
            ctx.fillText(this.titleSettings.text2, canvas.width / 2, titleAreaHeight * 0.7);
        }

        // 그림자 리셋
        ctx.shadowBlur = 0;
        ctx.shadowOffsetX = 0;
        ctx.shadowOffsetY = 0;

        // 랭킹 영역 (80%)
        const rankingAreaTop = titleAreaHeight;
        const rankingAreaHeight = canvas.height * 0.8;
        const itemHeight = rankingAreaHeight / this.rankingCount;

        // 왼쪽 정렬로 랭킹 표시
        ctx.textAlign = 'left';
        ctx.font = 'bold 36px Pretendard, sans-serif';
        ctx.fillStyle = '#FFFFFF';
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = 3;

        // 순위대로 표시 (재생 순서와 무관하게 카드는 고정)
        for (let rank = 1; rank <= this.rankingCount; rank++) {
            const i = rank - 1; // 배열 인덱스
            const y = rankingAreaTop + (itemHeight * i) + itemHeight / 2;
            const x = canvas.width * 0.05;

            // 이 랭킹의 재생 순서 찾기
            const playbackPosition = this.playbackOrder[i];

            let text = `${rank}위`;
            if (this.titles[i]) {
                text += ` ${this.titles[i]}`;
            }

            // 텍스트 테두리
            ctx.strokeText(text, x, y);
            // 텍스트 채우기
            ctx.fillText(text, x, y);

            // 재생 순서 표시 (작은 글씨로)
            ctx.font = '20px Pretendard, sans-serif';
            const orderText = `(${playbackPosition}번째 재생)`;
            const orderX = x + ctx.measureText(text).width + 20;
            ctx.strokeText(orderText, orderX, y);
            ctx.fillText(orderText, orderX, y);
            ctx.font = 'bold 36px Pretendard, sans-serif'; // 원래 폰트로 복구

            // 비디오가 업로드된 경우 썸네일 표시
            if (this.videos[i]) {
                ctx.fillStyle = 'rgba(100, 200, 100, 0.3)';
                ctx.fillRect(canvas.width * 0.05, rankingAreaTop + (itemHeight * i), canvas.width * 0.9, itemHeight - 5);
                ctx.fillStyle = '#FFFFFF';
            }
        }
    }

    validateForm() {
        // 최소 2개 이상의 비디오 필요
        const uploadedVideos = this.videos.filter(v => v !== null).length;
        if (uploadedVideos < 2) {
            alert('최소 2개 이상의 영상을 업로드해주세요.');
            return false;
        }

        // 각 업로드된 비디오에 대한 제목 확인
        for (let i = 0; i < this.rankingCount; i++) {
            if (this.videos[i] && !this.titles[i]) {
                alert(`${i + 1}위 영상의 제목을 입력해주세요.`);
                return false;
            }
        }

        // 타이틀 확인
        if (!this.titleSettings.text1 && !this.titleSettings.text2) {
            alert('상단 타이틀을 최소 한 줄 이상 입력해주세요.');
            return false;
        }

        return true;
    }

    resetForm() {
        // 폼 초기화
        this.videos = new Array(this.rankingCount).fill(null);
        this.titles = new Array(this.rankingCount).fill('');
        this.playbackOrder = Array.from({length: this.rankingCount}, (_, i) => i + 1);

        // 배경음악 초기화
        this.removeMusic();

        // UI 초기화
        document.querySelectorAll('.ranking-item').forEach((item, index) => {
            const uploadLabel = item.querySelector('.upload-label');
            const videoPreview = item.querySelector('.video-preview');
            const titleInput = item.querySelector('.rank-title');
            const playbackSelect = item.querySelector('.playback-order-select');

            uploadLabel.style.display = 'flex';
            videoPreview.style.display = 'none';
            titleInput.value = '';
            playbackSelect.value = index + 1;
        });

        document.getElementById('titleLine1').value = '';
        document.getElementById('titleLine2').value = '';

        // 볼륨 초기화
        const volumeSlider = document.getElementById('musicVolume');
        if (volumeSlider) {
            volumeSlider.value = 30;
            document.getElementById('volumeValue').textContent = '30%';
            this.backgroundMusicVolume = 0.3;
        }

        document.getElementById('resultSection').style.display = 'none';
        document.getElementById('generateBtn').disabled = false;

        this.updatePreview();
    }

    // 진행률 바 표시
    showUploadProgress() {
        const progressContainer = document.getElementById('uploadProgressContainer');
        if (progressContainer) {
            progressContainer.style.display = 'block';
        }
        // 생성 버튼 비활성화
        const generateBtn = document.getElementById('generateBtn');
        if (generateBtn) {
            generateBtn.disabled = true;
            generateBtn.textContent = '업로드 중...';
        }
    }

    // 진행률 업데이트
    updateUploadProgress(current, total, itemName) {
        const progressFill = document.getElementById('uploadProgressFill');
        const progressText = document.getElementById('uploadProgressText');

        const percent = Math.round((current / total) * 100);

        if (progressFill) {
            progressFill.style.width = `${percent}%`;
        }
        if (progressText) {
            progressText.textContent = `${itemName} 업로드 중... ${percent}%`;
        }
    }

    // 진행률 바 숨기기
    hideUploadProgress() {
        const progressContainer = document.getElementById('uploadProgressContainer');
        if (progressContainer) {
            progressContainer.style.display = 'none';
        }
        // 생성 버튼 복원
        const generateBtn = document.getElementById('generateBtn');
        if (generateBtn) {
            generateBtn.disabled = false;
            generateBtn.textContent = '다음으로 →';
        }
    }

    // 업로드 실패 표시
    showUploadErrors(failures) {
        const items = failures.map(f => `${f.rank}위 영상`).join(', ');
        alert(`다음 영상 업로드에 실패했습니다:\n${items}\n\n다시 시도해주세요.`);

        // 실패한 항목 하이라이트
        failures.forEach(f => {
            const item = document.querySelector(`.ranking-item[data-rank="${f.rank}"]`);
            if (item) {
                item.classList.add('upload-failed');
                item.style.border = '2px solid #ef4444';
                item.style.background = 'rgba(239, 68, 68, 0.1)';
            }
        });

        // 3초 후 하이라이트 제거
        setTimeout(() => {
            failures.forEach(f => {
                const item = document.querySelector(`.ranking-item[data-rank="${f.rank}"]`);
                if (item) {
                    item.classList.remove('upload-failed');
                    item.style.border = '';
                    item.style.background = '';
                }
            });
        }, 5000);
    }

    // 프로젝트 저장 후 프리뷰 페이지로 이동
    async goToPreview() {
        const hasAnyMainTitle = Boolean((this.titleSettings.text1 || '').trim() || (this.titleSettings.text2 || '').trim());
        const hasAnyRankTitle = this.titles.some((t) => Boolean((t || '').trim()));

        if (!hasAnyMainTitle && !hasAnyRankTitle) {
            alert('Please enter at least one title.');
            return;
        }

        const draftId = this.currentDraftId || `draft_${Date.now()}`;
        this.currentDraftId = draftId;
        await this.saveVideosToDraftDb(draftId);
        const draftData = this.collectDraftData(draftId);

        localStorage.setItem('rankingDraft', JSON.stringify(draftData));

        // Best-effort server save (metadata only)
        try {
            await this.saveProject();
        } catch {
            // ignore
        }
        window.location.href = this.getSiblingFileUrl('index.html');
    }
}

// 페이지 로드 시 초기화
document.addEventListener('DOMContentLoaded', () => {
    new RankingVideoCreator();
});
