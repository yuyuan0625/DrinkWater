document.addEventListener('DOMContentLoaded', () => {
    // === AUTHENTICATION LOGIC ===
    const token = localStorage.getItem('token');
    const username = localStorage.getItem('username');
    const userAuthBtn = document.getElementById('user-auth-btn');

    // Force login check
    if (!token || !username) {
        window.location.href = '/login.html';
        return;
    }

    userAuthBtn.innerHTML = `<span>👤 ${username}</span> (登出)`;
    userAuthBtn.addEventListener('click', () => {
        if(confirm(`準備要登出帳號 ${username} 嗎？`)) {
            localStorage.removeItem('token');
            localStorage.removeItem('username');
            window.location.href = '/login.html';
        }
    });

    const headers = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
    };

    function handleApiError(res) {
        if (res.status === 401 || res.status === 403) {
            localStorage.removeItem('token');
            localStorage.removeItem('username');
            window.location.href = '/login.html';
            throw new Error('Unauthorized');
        }
        return res;
    }

    // === EXISTING DOM ELEMENTS ===
    const countDisplay = document.getElementById('water-count');
    const drinkBtn = document.getElementById('drink-btn');
    const removeBtn = document.getElementById('remove-btn');
    const statusMsg = document.getElementById('status-message');
    const waterFill = document.getElementById('water-fill');
    
    const mainTitle = document.getElementById('main-title');
    const mainSubtitle = document.getElementById('main-subtitle');
    const backTodayBtn = document.getElementById('back-today-btn');
    const drinkBtnText = document.getElementById('drink-btn-text');
    const removeBtnText = document.getElementById('remove-btn-text');
    
    const calendarToggleBtn = document.getElementById('calendar-toggle-btn');
    const calendarModal = document.getElementById('calendar-modal');
    const closeModalBtn = document.getElementById('close-modal');
    const calendarGrid = document.getElementById('calendar-grid');
    const calendarMonthTitle = document.getElementById('calendar-month-title');
    const prevMonthBtn = document.getElementById('prev-month-btn');
    const nextMonthBtn = document.getElementById('next-month-btn');

    const adminToggleBtn = document.getElementById('admin-toggle-btn');
    const adminModal = document.getElementById('admin-modal');
    const closeAdminModal = document.getElementById('close-admin-modal');
    const adminUserList = document.getElementById('admin-user-list');

    let currentCalendarDate = new Date();
    
    function getLocalToday() {
        const d = new Date();
        return `${d.getFullYear()}-${(d.getMonth() + 1).toString().padStart(2, '0')}-${d.getDate().toString().padStart(2, '0')}`;
    }
    
    let selectedDate = getLocalToday();

    // Load initial data for logged-in user
    fetchDailyCount(selectedDate);

    // Bind click events
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

    if (username === 'admin') {
        adminToggleBtn.style.display = 'flex';
    }

    adminToggleBtn.addEventListener('click', () => {
        adminModal.classList.add('show');
        loadAdminUsers();
    });

    closeAdminModal.addEventListener('click', () => {
        adminModal.classList.remove('show');
    });

    window.addEventListener('click', (e) => {
        if (e.target === calendarModal) {
            closeCalendar();
        }
        if (e.target === adminModal) {
            adminModal.classList.remove('show');
        }
    });

    // === API CALLS ===
    function fetchDailyCount(dateParam) {
        fetch(`/api/water/daily?date=${dateParam}`, { headers })
            .then(handleApiError)
            .then(res => res.json())
            .then(data => {
                if (data.count !== undefined) {
                    updateDisplay(data.count, false);
                }
            })
            .catch(err => {
                console.error('Error fetching today count:', err);
                if(err.message !== 'Unauthorized') showStatus('無法取得紀錄', true);
            });
    }

    function removeDrink() {
        removeBtn.classList.remove('btn-animate');
        void removeBtn.offsetWidth;
        removeBtn.classList.add('btn-animate');
        removeBtn.disabled = true;

        fetch('/api/water/remove', {
            method: 'POST',
            headers,
            body: JSON.stringify({ date: selectedDate })
        })
        .then(handleApiError)
        .then(res => res.json())
        .then(data => {
            if (data.success) {
                updateDisplay(data.count, true);
                showStatus(selectedDate === getLocalToday() ? '沒事，已取消該紀錄 🚱' : '已刪除歷史紀錄 🚱');
            } else {
                showStatus(data.error || '取消失敗', true);
            }
        })
        .catch(err => {
            if(err.message !== 'Unauthorized') showStatus('系統錯誤', true);
        })
        .finally(() => { removeBtn.disabled = false; });
    }

    function recordDrink() {
        drinkBtn.classList.remove('btn-animate');
        void drinkBtn.offsetWidth;
        drinkBtn.classList.add('btn-animate');
        drinkBtn.disabled = true;

        fetch('/api/water/drink', {
            method: 'POST',
            headers,
            body: JSON.stringify({ date: selectedDate })
        })
        .then(handleApiError)
        .then(res => res.json())
        .then(data => {
            if (data.success) {
                updateDisplay(data.count, true);
                showStatus(selectedDate === getLocalToday() ? '太棒了！已新增紀錄 💧' : '歷史補登成功 💧');
            } else {
                showStatus('紀錄失敗', true);
            }
        })
        .catch(err => {
            if(err.message !== 'Unauthorized') showStatus('系統錯誤', true);
        })
        .finally(() => { drinkBtn.disabled = false; });
    }

    // === UI UPDATES ===
    function updateDisplay(newCount, animate = false) {
        if (animate && countDisplay.innerText !== newCount.toString()) {
            countDisplay.classList.remove('count-update');
            void countDisplay.offsetWidth; 
            countDisplay.classList.add('count-update');
        }
        countDisplay.innerText = newCount;
        
        let fillPercentage = Math.min((newCount / 5) * 100, 100);
        waterFill.style.height = `${fillPercentage}%`;
    }

    function showStatus(message, isError = false) {
        statusMsg.innerText = message;
        statusMsg.style.color = isError ? '#e53935' : 'var(--dark-blue)';
        statusMsg.classList.add('show');
        setTimeout(() => { statusMsg.classList.remove('show'); }, 3000);
    }
    
    // === CALENDAR LOGIC ===
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
        const month = currentCalendarDate.getMonth() + 1;
        calendarMonthTitle.innerText = `${year}年 ${month}月`;
        
        fetch(`/api/water/month?year=${year}&month=${month}`, { headers })
            .then(handleApiError)
            .then(res => res.json())
            .then(data => {
                const records = {};
                if (Array.isArray(data)) {
                    data.forEach(item => { records[item.date] = item.count; });
                }
                buildCalendarGrid(year, month, records);
            })
            .catch(err => {
                if(err.message !== 'Unauthorized') buildCalendarGrid(year, month, {});
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
            
            if (count > 0) dayCell.classList.add('has-record');
            if (dateString === todayStr) dayCell.classList.add('today');
            if (dateString === selectedDate && selectedDate !== todayStr) {
                dayCell.style.border = '2px dashed var(--primary-blue)';
            }
            
            dayCell.innerHTML = `
                <span class="day-num">${i}</span>
                <span class="drink-count">${count} 杯</span>
            `;
            
            dayCell.addEventListener('click', () => { selectDate(dateString); });
            calendarGrid.appendChild(dayCell);
        }
    }
    
    // === ADMIN LOGIC ===
    function loadAdminUsers() {
        adminUserList.innerHTML = '<li style="text-align:center; padding: 20px; color: var(--text-sub);">讀取中...</li>';
        fetch('/api/admin/users', { headers })
            .then(handleApiError)
            .then(res => res.json())
            .then(users => {
                adminUserList.innerHTML = '';
                if (users.length === 0) {
                    adminUserList.innerHTML = '<li style="text-align:center; padding: 20px; color: var(--text-sub);">系統目前無其他註冊使用者。</li>';
                    return;
                }
                users.forEach(u => {
                    const li = document.createElement('li');
                    li.className = 'admin-user-item';
                    li.innerHTML = `
                        <span class="admin-user-name">👤 ${u.username}</span>
                        <button class="delete-user-btn" data-id="${u.id}" data-name="${u.username}">刪除 🗑️</button>
                    `;
                    adminUserList.appendChild(li);
                });

                document.querySelectorAll('.delete-user-btn').forEach(btn => {
                    btn.addEventListener('click', (e) => {
                        const uid = e.target.getAttribute('data-id');
                        const uname = e.target.getAttribute('data-name');
                        // 簡單防呆設計 Option A
                        if (confirm(`確定要永久刪除使用者 '${uname}' 與他所有的飲水紀錄嗎？此動作無法復原！`)) {
                            e.target.disabled = true;
                            e.target.innerText = '刪除中...';
                            
                            fetch(`/api/admin/users/${uid}`, { method: 'DELETE', headers })
                                .then(handleApiError)
                                .then(res => res.json())
                                .then(data => {
                                    if(data.success) {
                                        loadAdminUsers();
                                    } else {
                                        alert(data.error || '刪除失敗');
                                        e.target.disabled = false;
                                        e.target.innerText = '刪除 🗑️';
                                    }
                                })
                                .catch(err => {
                                    if(err.message !== 'Unauthorized') alert('發生錯誤');
                                });
                        }
                    });
                });
            })
            .catch(err => {
                if(err.message !== 'Unauthorized') adminUserList.innerHTML = '<li style="text-align:center; padding: 20px; color: #ff5f6d;">系統錯誤或權限不足</li>';
            });
    }
});
