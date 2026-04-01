document.addEventListener('DOMContentLoaded', () => {
    const countDisplay = document.getElementById('water-count');
    const drinkBtn = document.getElementById('drink-btn');
    const removeBtn = document.getElementById('remove-btn');
    const statusMsg = document.getElementById('status-message');
    const waterFill = document.getElementById('water-fill');
    
    // Calendar Elements
    const calendarToggleBtn = document.getElementById('calendar-toggle-btn');
    const calendarModal = document.getElementById('calendar-modal');
    const closeModalBtn = document.getElementById('close-modal');
    const calendarGrid = document.getElementById('calendar-grid');
    const calendarMonthTitle = document.getElementById('calendar-month-title');
    const prevMonthBtn = document.getElementById('prev-month-btn');
    const nextMonthBtn = document.getElementById('next-month-btn');

    let currentCalendarDate = new Date();

    // Load initial data
    fetchTodayCount();

    // Bind click event
    drinkBtn.addEventListener('click', recordDrink);
    removeBtn.addEventListener('click', removeDrink);
    calendarToggleBtn.addEventListener('click', openCalendar);
    closeModalBtn.addEventListener('click', closeCalendar);
    
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

    function removeDrink() {
        // Add click animation
        removeBtn.classList.remove('btn-animate');
        // trigger reflow
        void removeBtn.offsetWidth;
        removeBtn.classList.add('btn-animate');
        
        removeBtn.disabled = true;

        fetch('/api/water/remove', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            }
        })
        .then(res => res.json())
        .then(data => {
            if (data.success) {
                updateDisplay(data.count, true);
                showStatus('沒事，已經幫您取消一筆紀錄了 🚱');
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
        
        // Update water fill (5 cups = 100%)
        let fillPercentage = Math.min((newCount / 5) * 100, 100);
        waterFill.style.height = `${fillPercentage}%`;
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
    
    // Calendar Functions
    function openCalendar() {
        calendarModal.classList.add('show');
        currentCalendarDate = new Date(); // reload as current month when opening
        renderCalendar();
    }
    
    function closeCalendar() {
        calendarModal.classList.remove('show');
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
        
        const today = new Date();
        const isCurrentMonth = today.getFullYear() === year && (today.getMonth() + 1) === month;
        const currentDayNum = today.getDate();
        
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
            if (isCurrentMonth && i === currentDayNum) {
                dayCell.classList.add('today');
            }
            
            dayCell.innerHTML = `
                <span class="day-num">${i}</span>
                <span class="drink-count">${count} 杯</span>
            `;
            
            calendarGrid.appendChild(dayCell);
        }
    }
});
