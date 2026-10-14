document.addEventListener('DOMContentLoaded', () => {
    const displayArea = document.getElementById('display-area');
    const blocksContainer = document.getElementById('blocks-container');
    const answerNumber = document.getElementById('answer-number');
    const durationDisplay = document.getElementById('duration-display');
    
    const btnFlash = document.getElementById('btn-flash');
    const btnReveal = document.getElementById('btn-reveal');
    const btnNext = document.getElementById('btn-next');

    const modeSelect = document.getElementById('mode-select');
    const btnDurationMinus = document.getElementById('btn-duration-minus');
    const btnDurationPlus = document.getElementById('btn-duration-plus');

    let currentNumber = 0;
    let currentDuration = 1.5;
    let flashTimeout = null;
    let isFlashing = false;
    let currentRandomMode = 'blocks';

    // 누르고 있기 관련 변수
    let isPressed = false;
    let pressStartTime = 0;

    // 오디오 관련 설정
    let soundEnabled = true;
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    let audioCtx;
    const btnSoundToggle = document.getElementById('btn-sound-toggle');
    const iconSoundOn = document.getElementById('icon-sound-on');
    const iconSoundOff = document.getElementById('icon-sound-off');

    if(btnSoundToggle) {
        btnSoundToggle.addEventListener('click', () => {
            soundEnabled = !soundEnabled;
            if (soundEnabled) {
                iconSoundOn.style.display = 'block';
                iconSoundOff.style.display = 'none';
            } else {
                iconSoundOn.style.display = 'none';
                iconSoundOff.style.display = 'block';
            }
        });
    }

    // 테마(라이트모드/다크모드) 설정
    const btnThemeToggle = document.getElementById('btn-theme-toggle');
    const iconMoon = document.getElementById('icon-moon');
    const iconSun = document.getElementById('icon-sun');
    let isLightMode = true;

    if(btnThemeToggle) {
        btnThemeToggle.addEventListener('click', () => {
            isLightMode = !isLightMode;
            if (isLightMode) {
                document.body.classList.add('light-mode');
                iconMoon.style.display = 'none';
                iconSun.style.display = 'block';
            } else {
                document.body.classList.remove('light-mode');
                iconMoon.style.display = 'block';
                iconSun.style.display = 'none';
            }
        });
    }

    function initAudio() {
        if (!audioCtx && soundEnabled) {
            audioCtx = new AudioContext();
        }
    }

    function playTone(freq, type, duration, vol=0.1) {
        if (!soundEnabled) return;
        initAudio();
        const oscillator = audioCtx.createOscillator();
        const gainNode = audioCtx.createGain();
        oscillator.type = type;
        oscillator.frequency.setValueAtTime(freq, audioCtx.currentTime);
        gainNode.gain.setValueAtTime(vol, audioCtx.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + duration);
        oscillator.connect(gainNode);
        gainNode.connect(audioCtx.destination);
        oscillator.start();
        oscillator.stop(audioCtx.currentTime + duration);
    }

    function playFlashSound() {
        playTone(400, 'triangle', 0.1, 0.15);
    }

    function playRevealSound() {
        playTone(523.25, 'sine', 0.5, 0.15);
        setTimeout(() => playTone(659.25, 'sine', 0.5, 0.15), 50);
        setTimeout(() => playTone(783.99, 'sine', 0.6, 0.15), 100);
    }

    function playNextSound() {
        playTone(600, 'sine', 0.1, 0.1);
        setTimeout(() => playTone(800, 'sine', 0.15, 0.1), 80);
    }

    // 인앱 브라우저 감지 및 처리
    function checkInAppBrowser() {
        const ua = navigator.userAgent.toLowerCase();
        const isKakao = ua.match(/kakaotalk/i);
        const isFacebook = ua.match(/fban|fbav/i);
        const isInstagram = ua.match(/instagram/i);
        const isLine = ua.match(/line/i);
        
        if (isKakao || isFacebook || isInstagram || isLine) {
            // 카카오톡의 경우 외부 브라우저 호출 스킴 시도
            if (isKakao) {
                location.href = 'kakaotalk://web/openExternal?url=' + encodeURIComponent(location.href);
            }
            
            // 안내창 표시
            const guide = document.getElementById('inapp-guide');
            if (guide) guide.style.display = 'flex';
        }
    }
    
    // 링크 복사 기능
    const btnCopyLink = document.getElementById('btn-copy-link');
    if(btnCopyLink) {
        btnCopyLink.addEventListener('click', () => {
            navigator.clipboard.writeText(location.href).then(() => {
                alert('링크가 복사되었습니다! Safari나 Chrome 등 인터넷 브라우저에 붙여넣기 해주세요.');
            }).catch(() => {
                alert('링크 복사에 실패했습니다. 주소창에서 직접 복사해주세요.');
            });
        });
    }

    // 실행
    // 인앱 브라우저 처리는 index.html 머리의 공통 스크립트가 맡음
    // checkInAppBrowser();

    // 우클릭 방지
    window.addEventListener('contextmenu', (e) => {
        e.preventDefault();
    });

    // 초기 설정
    initNewNumber();

    // 마우스/터치 누름 이벤트 (보여주기 시작)
    function handlePressStart(e) {
        if (e.cancelable) e.preventDefault(); // 더블 클릭 및 기본 동작 방지
        if (isFlashing || isPressed || btnFlash.disabled) return;
        
        isPressed = true;
        pressStartTime = Date.now();
        
        playFlashSound();
        
        // 보여주기 시작
        displayArea.className = 'show-state';
        
        // 다른 버튼 비활성화 (btnFlash는 mouseup을 받아야 하므로 제외)
        btnReveal.disabled = true;
        btnNext.disabled = true;
        btnDurationMinus.disabled = true;
        btnDurationPlus.disabled = true;
        modeSelect.disabled = true;
    }

    // 마우스/터치 뗌 이벤트 (보여주기 종료 처리)
    function handlePressEnd(e) {
        if (!isPressed) return;
        if (e && e.cancelable) e.preventDefault();
        
        isPressed = false;
        const elapsed = Date.now() - pressStartTime;
        const targetDuration = currentDuration * 1000;
        
        if (elapsed < targetDuration) {
            // 짧게 누른 경우: 설정된 시간(targetDuration)까지 유지한 뒤 숨김
            isFlashing = true;
            flashTimeout = setTimeout(() => {
                hideAndReset();
            }, targetDuration - elapsed);
        } else {
            // 길게 누른 경우: 떼자마자 바로 숨김
            hideAndReset();
        }
    }

    function hideAndReset() {
        displayArea.className = 'hidden-state';
        isFlashing = false;
        
        // 버튼 다시 활성화
        btnReveal.disabled = false;
        btnNext.disabled = false;
        btnDurationMinus.disabled = false;
        btnDurationPlus.disabled = false;
        modeSelect.disabled = false;
    }

    // 보여주기 버튼 이벤트 리스너 등록
    btnFlash.addEventListener('mousedown', handlePressStart);
    btnFlash.addEventListener('touchstart', handlePressStart, { passive: false });
    
    window.addEventListener('mouseup', handlePressEnd);
    window.addEventListener('touchend', handlePressEnd);
    window.addEventListener('touchcancel', handlePressEnd);

    // 정답 확인 버튼 클릭
    btnReveal.addEventListener('click', () => {
        if (isFlashing || isPressed) return;
        
        playRevealSound();
        
        answerNumber.textContent = currentNumber;
        displayArea.className = 'reveal-state';
        
        // 정답을 확인한 상태에서도 다시 보여주기를 할 수 있도록 정답 버튼만 비활성화
        btnReveal.disabled = true;
    });

    // 다음 문제 버튼 클릭
    btnNext.addEventListener('click', () => {
        if (isFlashing || isPressed) return;
        playNextSound();
        initNewNumber();
    });

    // 시간 증감 버튼
    btnDurationMinus.addEventListener('click', () => {
        if (currentDuration > 0.5) {
            currentDuration -= 0.5;
        } else if (currentDuration > 0.1) {
            currentDuration -= 0.1;
        } else if (currentDuration > 0.05) {
            currentDuration -= 0.05;
        }
        currentDuration = Math.round(currentDuration * 100) / 100; // 부동소수점 오차 방지
        updateDurationDisplay();
    });

    btnDurationPlus.addEventListener('click', () => {
        if (currentDuration >= 0.5) {
            currentDuration += 0.5;
        } else if (currentDuration >= 0.1) {
            currentDuration += 0.1;
        } else {
            currentDuration += 0.05;
        }
        currentDuration = Math.round(currentDuration * 100) / 100; // 부동소수점 오차 방지
        updateDurationDisplay();
    });

    // 모드 변경 이벤트
    modeSelect.addEventListener('change', () => {
        if (modeSelect.value === 'random') {
            pickRandomMode();
        }
        renderContent();
    });

    function pickRandomMode() {
        const modes = ['blocks', 'stones', 'frames', 'connect'];
        currentRandomMode = modes[Math.floor(Math.random() * modes.length)];
    }

    // 새로운 숫자 설정 및 초기화
    function initNewNumber() {
        // 11에서 50 사이의 무작위 숫자 생성
        currentNumber = Math.floor(Math.random() * 40) + 11;
        
        // 랜덤 모드일 경우 새로운 렌더링 모드 선택
        if (modeSelect.value === 'random') {
            pickRandomMode();
        }

        // 상태 초기화
        displayArea.className = 'hidden-state';
        btnFlash.disabled = false;
        btnReveal.disabled = false;
        
        renderContent();
    }

    // 컨텐츠 렌더링
    function renderContent() {
        blocksContainer.innerHTML = '';
        
        const tens = Math.floor(currentNumber / 10);
        const ones = currentNumber % 10;
        
        let mode = modeSelect.value;
        if (mode === 'random') {
            mode = currentRandomMode;
        }

        if (mode === 'blocks') {
            renderBlocksMode(tens, ones);
        } else if (mode === 'stones') {
            renderStonesMode(tens, ones);
        } else if (mode === 'frames') {
            renderFramesMode(tens, ones);
        } else if (mode === 'connect') {
            renderConnectCubesMode(tens, ones);
        }
        
        // 렌더링 후 화면 크기에 맞게 스케일 재조정
        setTimeout(updateResponsiveScale, 10);
    }

    // 반응형 스케일 자동 조절 기능
    function updateResponsiveScale() {
        if (!blocksContainer || blocksContainer.innerHTML === '') return;
        
        blocksContainer.style.setProperty('--responsive-scale', '1');
        
        const naturalWidth = blocksContainer.offsetWidth;
        const naturalHeight = blocksContainer.offsetHeight;
        
        if (naturalWidth === 0 || naturalHeight === 0) return;
        
        const displayRect = displayArea.getBoundingClientRect();
        const availableWidth = displayRect.width * 0.9;
        const availableHeight = displayRect.height * 0.9;
        
        const scaleX = availableWidth / naturalWidth;
        const scaleY = availableHeight / naturalHeight;
        
        // 화면 크기에 비례해서 줄이거나 최대 1.3배까지만 확대
        let scale = Math.min(scaleX, scaleY, 1.3);
        blocksContainer.style.setProperty('--responsive-scale', scale);
    }
    window.addEventListener('resize', updateResponsiveScale);

    // 1. 기존 수 막대 렌더링
    function renderBlocksMode(tens, ones) {
        const tensContainer = document.createElement('div');
        tensContainer.id = 'tens-container';
        for (let i = 0; i < tens; i++) {
            const tenBlock = document.createElement('div');
            tenBlock.className = 'ten-block';
            for (let j = 0; j < 10; j++) {
                const tenUnit = document.createElement('div');
                tenUnit.className = 'ten-unit';
                tenBlock.appendChild(tenUnit);
            }
            tensContainer.appendChild(tenBlock);
        }

        const onesContainer = document.createElement('div');
        onesContainer.id = 'ones-container';
        for (let i = 0; i < ones; i++) {
            const oneUnit = document.createElement('div');
            oneUnit.className = 'one-unit';
            onesContainer.appendChild(oneUnit);
        }

        blocksContainer.appendChild(tensContainer);
        blocksContainer.appendChild(onesContainer);
    }

    // 2. 바둑돌 렌더링
    function renderStonesMode(tens, ones) {
        const tensContainer = document.createElement('div');
        tensContainer.id = 'stones-tens';
        for (let i = 0; i < tens; i++) {
            const group = document.createElement('div');
            group.className = 'stone-group-10';
            for (let j = 0; j < 10; j++) {
                const stone = document.createElement('div');
                stone.className = 'stone black';
                group.appendChild(stone);
            }
            tensContainer.appendChild(group);
        }

        const onesContainer = document.createElement('div');
        onesContainer.className = 'stone-group-ones';
        for (let i = 0; i < ones; i++) {
            const stone = document.createElement('div');
            stone.className = 'stone white';
            onesContainer.appendChild(stone);
        }

        blocksContainer.appendChild(tensContainer);
        blocksContainer.appendChild(onesContainer);
    }

    // 3. 십 배열표 렌더링
    function renderFramesMode(tens, ones) {
        const framesContainer = document.createElement('div');
        framesContainer.id = 'frames-container';
        
        for (let i = 0; i < tens; i++) {
            const frame = createTenFrame(10);
            framesContainer.appendChild(frame);
        }
        if (ones > 0) {
            const frame = createTenFrame(ones);
            framesContainer.appendChild(frame);
        }
        blocksContainer.appendChild(framesContainer);
    }
    
    function createTenFrame(count) {
        const frame = document.createElement('div');
        frame.className = 'ten-frame';
        for (let j = 0; j < 10; j++) {
            const cell = document.createElement('div');
            cell.className = 'frame-cell';
            if (j < count) {
                const dot = document.createElement('div');
                dot.className = 'frame-dot';
                cell.appendChild(dot);
            }
            frame.appendChild(cell);
        }
        return frame;
    }

    // 4. 연결 막대(Snap Cubes) 렌더링
    function renderConnectCubesMode(tens, ones) {
        const tensContainer = document.createElement('div');
        tensContainer.id = 'connect-tens';
        
        // 연결 막대용 알록달록한 색상 목록
        const colors = ['#facc15', '#f97316', '#ef4444', '#22c55e', '#3b82f6', '#a855f7', '#64748b', '#ec4899', '#14b8a6', '#84cc16'];
        
        for (let i = 0; i < tens; i++) {
            const stick = document.createElement('div');
            stick.className = 'connect-stick';
            let color = colors[i % colors.length];
            
            for (let j = 0; j < 10; j++) {
                const cube = document.createElement('div');
                cube.className = 'connect-cube';
                cube.style.setProperty('--cube-color', color);
                stick.appendChild(cube);
            }
            tensContainer.appendChild(stick);
        }

        const onesContainer = document.createElement('div');
        onesContainer.id = 'connect-ones';
        const onesColor = '#06b6d4'; // 낱개는 구분을 위해 통일된 시안색
        
        for (let i = 0; i < ones; i++) {
            const cube = document.createElement('div');
            cube.className = 'connect-cube single-cube';
            cube.style.setProperty('--cube-color', onesColor);
            onesContainer.appendChild(cube);
        }

        blocksContainer.appendChild(tensContainer);
        blocksContainer.appendChild(onesContainer);
    }

    // 시간 표시 업데이트
    function updateDurationDisplay() {
        // 소수점 2자리까지 표기하되, 불필요한 0은 제거
        durationDisplay.textContent = Number(currentDuration.toFixed(2));
    }
});
