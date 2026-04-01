document.addEventListener('DOMContentLoaded', () => {
    const countDisplay = document.getElementById('water-count');
    const drinkBtn = document.getElementById('drink-btn');
    const statusMsg = document.getElementById('status-message');

    // Load initial data
    fetchTodayCount();

    // Bind click event
    drinkBtn.addEventListener('click', recordDrink);

    function fetchTodayCount() {
        fetch('/api/water/today')
            .then(res => res.json())
            .then(data => {
                if (data.count !== undefined) {
                    updateDisplay(data.count, false);
                }
            })
            .catch(err => {
                console.error('Error fetching today count:', err);
                showStatus('無法取得紀錄，請檢查網路連線', true);
            });
    }

    function recordDrink() {
        // Add click animation
        drinkBtn.classList.remove('btn-animate');
        // trigger reflow
        void drinkBtn.offsetWidth;
        drinkBtn.classList.add('btn-animate');
        
        drinkBtn.disabled = true;

        fetch('/api/water/drink', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            }
        })
        .then(res => res.json())
        .then(data => {
            if (data.success) {
                updateDisplay(data.count, true);
                showStatus('太棒了！已新增一筆紀錄 💧');
            } else {
                showStatus('紀錄失敗，請再試一次', true);
            }
        })
        .catch(err => {
            console.error('Error recording drink:', err);
            showStatus('系統錯誤，請確認伺服器運作中', true);
        })
        .finally(() => {
            drinkBtn.disabled = false;
        });
    }

    function updateDisplay(newCount, animate = false) {
        if (animate && countDisplay.innerText !== newCount.toString()) {
            countDisplay.classList.remove('count-update');
            void countDisplay.offsetWidth; // trigger reflow
            countDisplay.classList.add('count-update');
        }
        countDisplay.innerText = newCount;
    }

    function showStatus(message, isError = false) {
        statusMsg.innerText = message;
        statusMsg.style.color = isError ? '#e53935' : 'var(--dark-blue)';
        statusMsg.classList.add('show');
        
        // Hide after 3 seconds
        setTimeout(() => {
            statusMsg.classList.remove('show');
        }, 3000);
    }
});
