document.addEventListener('DOMContentLoaded', () => {
    const countDisplay = document.getElementById('water-count');
    const drinkBtn = document.getElementById('drink-btn');
    const removeBtn = document.getElementById('remove-btn');
    const statusMsg = document.getElementById('status-message');
    const waterFill = document.getElementById('water-fill');
    
    // New Elements
    const mainTitle = document.getElementById('main-title');
    const mainSubtitle = document.getElementById('main-subtitle');
    const backTodayBtn = document.getElementById('back-today-btn');
    const drinkBtnText = document.getElementById('drink-btn-text');
    const removeBtnText = document.getElementById('remove-btn-text');
    
    // Calendar Elements
    const calendarToggleBtn = document.getElementById('calendar-toggle-btn');
    const calendarModal = document.getElementById('calendar-modal');
    const closeModalBtn = document.getElementById('close-modal');
    const calendarGrid = document.getElementById('calendar-grid');
    const calendarMonthTitle = document.getElementById('calendar-month-title');
    const prevMonthBtn = document.getElementById('prev-month-btn');
    const nextMonthBtn = document.getElementById('next-month-btn');

    let currentCalendarDate = new Date();
    
    // Helper
    function getLocalToday() {
        const d = new Date();
        return `${d.getFullYear()}-${(d.getMonth() + 1).toString().padStart(2, '0')}-${d.getDate().toString().padStart(2, '0')}`;
    }
    
    let selectedDate = getLocalToday();

    // Load initial data
    fetchDailyCount(selectedDate);

    // Bind click event
    drinkBtn.addEventListener('click', recordDrink);
    removeBtn.addEventListener('click', removeDrink);
    calendarToggleBtn.addEventListener('click', openCalendar);
    closeModalBtn.addEventListener('click', closeCalendar);
    backTodayBtn.addEventListener('click', () => {
        selectDate(getLocalToday());
    });
    
    prevMonthBtn.addEventListener('click', () => {
        currentCalendarDate.setMonth(currentCalendarDate.getMonth() - 1);
        renderCalendar();
    });
    nextMonthBtn.addEventListener('click', () => {
        currentCalendarDate.setMonth(currentCalendarDate.getMonth() + 1);
        renderCalendar();
    });

    // Close modal when clicking outside
    window.addEventListener('click', (e) => {
        if (e.target === calendarModal) {
            closeCalendar();
        }
    });

    function fetchDailyCount(dateParam) {
        fetch(`/api/water/daily?date=${dateParam}`)
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

    function removeDrink() {
        removeBtn.classList.remove('btn-animate');
        void removeBtn.offsetWidth;
        removeBtn.classList.add('btn-animate');
        
        removeBtn.disabled = true;

        fetch('/api/water/remove', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ date: selectedDate })
        })
        .then(res => res.json())
        .then(data => {
            if (data.success) {
                updateDisplay(data.count, true);
                showStatus(selectedDate === getLocalToday() ? '沒事，已經幫您取消一筆紀錄了 🚱' : '已刪除歷史紀錄 🚱');
            } else {
                showStatus(data.error || '紀錄取消失敗，請再試一次', true);
            }
        })
        .catch(err => {
            console.error('Error removing drink:', err);
            showStatus('系統錯誤，請確認伺服器運作中', true);
        })
        .finally(() => {
            removeBtn.disabled = false;
        });
    }

    function recordDrink() {
        drinkBtn.classList.remove('btn-animate');
        void drinkBtn.offsetWidth;
        drinkBtn.classList.add('btn-animate');
        
        drinkBtn.disabled = true;

        fetch('/api/water/drink', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ date: selectedDate })
        })
        .then(res => res.json())
        .then(data => {
            if (data.success) {
                updateDisplay(data.count, true);
                showStatus(selectedDate === getLocalToday() ? '太棒了！已新增一筆紀錄 💧' : '太棒了！歷史補登成功 💧');
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
        
        // Update water fill (5 cups = 100%)
        let fillPercentage = Math.min((newCount / 5) * 100, 100);
        waterFill.style.height = `${fillPercentage}%`;
    }

    function showStatus(message, isError = false) {
        statusMsg.innerText = message;
        statusMsg.style.color = isError ? '#e53935' : 'var(--dark-blue)';
        statusMsg.classList.add('show');
        
        setTimeout(() => {
            statusMsg.classList.remove('show');
        }, 3000);
    }
    
    // Calendar Functions
    function openCalendar() {
        calendarModal.classList.add('show');
        currentCalendarDate = selectedDate ? new Date(selectedDate) : new Date(); 
        renderCalendar();
    }
    
    function closeCalendar() {
        calendarModal.classList.remove('show');
    }
    
    function selectDate(dateStr) {
        selectedDate = dateStr;
        closeCalendar();
        
        const todayStr = getLocalToday();
        if (dateStr === todayStr) {
            mainTitle.innerText = '今日飲水紀錄';
            mainSubtitle.innerText = '保持水分，保持健康';
            drinkBtnText.innerText = '喝了一杯水';
            removeBtnText.innerText = '減少一杯水';
            backTodayBtn.classList.remove('show');
        } else {
            const parts = dateStr.split('-');
            const m = parseInt(parts[1], 10);
            const d = parseInt(parts[2], 10);
            mainTitle.innerText = `${m} / ${d} 飲水紀錄`;
            mainSubtitle.innerText = '歷史補登模式';
            drinkBtnText.innerText = '補登一杯';
            removeBtnText.innerText = '取消補登';
            backTodayBtn.classList.add('show');
        }
        
        fetchDailyCount(selectedDate);
    }
    
    function renderCalendar() {
        const year = currentCalendarDate.getFullYear();
        const month = currentCalendarDate.getMonth() + 1; // 1-12
        calendarMonthTitle.innerText = `${year}年 ${month}月`;
        
        fetch(`/api/water/month?year=${year}&month=${month}`)
            .then(res => res.json())
            .then(data => {
                const records = {};
                if (Array.isArray(data)) {
                    data.forEach(item => {
                        records[item.date] = item.count;
                    });
                }
                buildCalendarGrid(year, month, records);
            })
            .catch(err => {
                console.error('Error fetching calendar data:', err);
                buildCalendarGrid(year, month, {});
            });
    }
    
    function buildCalendarGrid(year, month, records) {
        calendarGrid.innerHTML = '';
        
        const firstDay = new Date(year, month - 1, 1);
        const lastDay = new Date(year, month, 0);
        
        const startingDayOfWeek = firstDay.getDay(); 
        const totalDays = lastDay.getDate();
        
        const todayStr = getLocalToday();
        
        for (let i = 0; i < startingDayOfWeek; i++) {
            const emptyCell = document.createElement('div');
            emptyCell.className = 'calendar-day empty';
            calendarGrid.appendChild(emptyCell);
        }
        
        for (let i = 1; i <= totalDays; i++) {
            const dayCell = document.createElement('div');
            dayCell.className = 'calendar-day';
            
            const dateString = `${year}-${month.toString().padStart(2, '0')}-${i.toString().padStart(2, '0')}`;
            const count = records[dateString] || 0;
            
            if (count > 0) {
                dayCell.classList.add('has-record');
            }
            if (dateString === todayStr) {
                dayCell.classList.add('today');
            }
            if (dateString === selectedDate && selectedDate !== todayStr) {
                // optional style for selected past date
                dayCell.style.border = '2px dashed var(--primary-blue)';
            }
            
            dayCell.innerHTML = `
                <span class="day-num">${i}</span>
                <span class="drink-count">${count} 杯</span>
            `;
            
            dayCell.addEventListener('click', () => {
                selectDate(dateString);
            });
            
            calendarGrid.appendChild(dayCell);
        }
    }
});
