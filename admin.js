// Admin credentials (In production, use proper authentication)
const ADMIN_USERNAME = 'admin';
const ADMIN_PASSWORD = 'admin123';

// Telegram Bot Configuration
const TELEGRAM_BOT_TOKEN = '7930967027:AAG3AkEZrkKGxTFOyVHwN8VpA9HgusAdRmw';
const TELEGRAM_API = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}`;

// Global Variables
let isLoggedIn = false;
let allUsers = [];
let allDeposits = [];
let allWithdrawals = [];
let allTrades = [];
let allPlans = [];
let allTasks = [];
let allRedeemCodes = [];

// Login
function login(event) {
    event.preventDefault();
    
    const username = document.getElementById('loginUsername').value;
    const password = document.getElementById('loginPassword').value;
    
    if (username === ADMIN_USERNAME && password === ADMIN_PASSWORD) {
        isLoggedIn = true;
        document.getElementById('loginContainer').style.display = 'none';
        document.getElementById('adminPanel').classList.add('active');
        initAdmin();
    } else {
        showNotification('Invalid credentials', 'error');
    }
}

// Logout
function logout() {
    isLoggedIn = false;
    document.getElementById('loginContainer').style.display = 'flex';
    document.getElementById('adminPanel').classList.remove('active');
}

// Initialize Admin Panel
async function initAdmin() {
    await loadDashboardStats();
    await loadUsers();
    await loadDeposits();
    await loadWithdrawals();
    await loadTrades();
    await loadPlans();
    await loadTasks();
    await loadRedeemCodes();
    setupRealtimeListeners();
}

// Load Dashboard Stats
async function loadDashboardStats() {
    try {
        // Get all users
        const usersRef = window.dbRef(window.db, 'users');
        const usersSnapshot = await window.dbGet(usersRef);
        const users = usersSnapshot.exists() ? Object.values(usersSnapshot.val()) : [];
        
        // Get all deposits
        const depositsRef = window.dbRef(window.db, 'deposits');
        const depositsSnapshot = await window.dbGet(depositsRef);
        const deposits = depositsSnapshot.exists() ? Object.values(depositsSnapshot.val()) : [];
        
        // Calculate stats
        const totalUsers = users.length;
        const dailyUsers = users.filter(u => {
            const today = new Date().setHours(0, 0, 0, 0);
            return new Date(u.createdAt).setHours(0, 0, 0, 0) === today;
        }).length;
        
        const totalDeposit = deposits
            .filter(d => d.status === 'approved')
            .reduce((sum, d) => sum + d.amount, 0);
        
        const pendingDeposits = deposits.filter(d => d.status === 'pending').length;
        
        // Get withdrawals
        const withdrawalsRef = window.dbRef(window.db, 'withdrawals');
        const withdrawalsSnapshot = await window.dbGet(withdrawalsRef);
        const withdrawals = withdrawalsSnapshot.exists() ? Object.values(withdrawalsSnapshot.val()) : [];
        const pendingWithdrawals = withdrawals.filter(w => w.status === 'pending').length;
        
        // Render stats
        const statsGrid = document.getElementById('statsGrid');
        statsGrid.innerHTML = `
            <div class="stat-card">
                <div class="stat-icon"><i class="fas fa-users"></i></div>
                <div class="stat-value">${totalUsers}</div>
                <div class="stat-label">Total Users</div>
            </div>
            <div class="stat-card">
                <div class="stat-icon"><i class="fas fa-user-plus"></i></div>
                <div class="stat-value">${dailyUsers}</div>
                <div class="stat-label">Today's Users</div>
            </div>
            <div class="stat-card">
                <div class="stat-icon"><i class="fas fa-dollar-sign"></i></div>
                <div class="stat-value">$${totalDeposit.toFixed(2)}</div>
                <div class="stat-label">Total Deposits</div>
            </div>
            <div class="stat-card">
                <div class="stat-icon"><i class="fas fa-clock"></i></div>
                <div class="stat-value">${pendingDeposits}</div>
                <div class="stat-label">Pending Deposits</div>
            </div>
            <div class="stat-card">
                <div class="stat-icon"><i class="fas fa-arrow-up"></i></div>
                <div class="stat-value">${pendingWithdrawals}</div>
                <div class="stat-label">Pending Withdrawals</div>
            </div>
            <div class="stat-card">
                <div class="stat-icon"><i class="fas fa-chart-line"></i></div>
                <div class="stat-value">${users.reduce((sum, u) => sum + (u.balance || 0), 0).toFixed(2)}</div>
                <div class="stat-label">Total Balance</div>
            </div>
        `;
        
        // Load recent activities
        await loadRecentActivities();
        
    } catch (error) {
        console.error('Error loading dashboard stats:', error);
    }
}

// Load Recent Activities
async function loadRecentActivities() {
    try {
        const activitiesRef = window.dbRef(window.db, 'activities');
        const snapshot = await window.dbGet(activitiesRef);
        
        if (!snapshot.exists()) {
            document.getElementById('recentActivities').innerHTML = 
                '<tr><td colspan="4" style="text-align: center;">No activities yet</td></tr>';
            return;
        }
        
        const allActivities = [];
        snapshot.forEach(userSnapshot => {
            const userActivities = Object.values(userSnapshot.val());
            allActivities.push(...userActivities);
        });
        
        // Sort by timestamp and get last 10
        const recentActivities = allActivities
            .sort((a, b) => b.timestamp - a.timestamp)
            .slice(0, 10);
        
        const tbody = document.getElementById('recentActivities');
        tbody.innerHTML = '';
        
        for (const activity of recentActivities) {
            // Get user info
            const userRef = window.dbRef(window.db, `users/${activity.userId || 'Unknown'}`);
            const userSnapshot = await window.dbGet(userRef);
            const userName = userSnapshot.exists() ? userSnapshot.val().name : 'Unknown';
            
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${userName}</td>
                <td>${activity.type}</td>
                <td>${activity.details}</td>
                <td>${new Date(activity.timestamp).toLocaleString()}</td>
            `;
            tbody.appendChild(row);
        }
        
    } catch (error) {
        console.error('Error loading recent activities:', error);
    }
}

// Load Users
async function loadUsers() {
    try {
        const usersRef = window.dbRef(window.db, 'users');
        const snapshot = await window.dbGet(usersRef);
        
        if (!snapshot.exists()) {
            document.getElementById('usersTable').innerHTML = 
                '<tr><td colspan="6" style="text-align: center;">No users yet</td></tr>';
            return;
        }
        
        allUsers = Object.values(snapshot.val());
        renderUsers(allUsers);
        
    } catch (error) {
        console.error('Error loading users:', error);
    }
}

// Render Users
function renderUsers(users) {
    const tbody = document.getElementById('usersTable');
    tbody.innerHTML = '';
    
    users.forEach(user => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${user.id}</td>
            <td>${user.name}</td>
            <td>$${(user.balance || 0).toFixed(2)}</td>
            <td>$${(user.totalDeposit || 0).toFixed(2)}</td>
            <td>${user.referrals || 0}</td>
            <td>
                <button class="action-btn btn-edit" onclick="editUser('${user.id}')">
                    <i class="fas fa-edit"></i> Edit
                </button>
                <button class="action-btn btn-delete" onclick="banUser('${user.id}')">
                    <i class="fas fa-ban"></i> Ban
                </button>
            </td>
        `;
        tbody.appendChild(row);
    });
}

// Search Users
function searchUsers() {
    const searchTerm = document.getElementById('userSearch').value.toLowerCase();
    const filteredUsers = allUsers.filter(user => 
        user.name.toLowerCase().includes(searchTerm) ||
        user.id.toLowerCase().includes(searchTerm)
    );
    renderUsers(filteredUsers);
}

// Refresh Users
async function refreshUsers() {
    await loadUsers();
    showNotification('Users refreshed', 'success');
}

// Edit User
function editUser(userId) {
    const user = allUsers.find(u => u.id === userId);
    if (!user) return;
    
    document.getElementById('editUserId').value = user.id;
    document.getElementById('editUserBalance').value = user.balance || 0;
    document.getElementById('editUserModal').classList.add('active');
}

// Update User Balance
async function updateUserBalance() {
    const userId = document.getElementById('editUserId').value;
    const amount = parseFloat(document.getElementById('editUserBalance').value);
    const action = document.getElementById('editUserAction').value;
    
    try {
        const userRef = window.dbRef(window.db, `users/${userId}`);
        const snapshot = await window.dbGet(userRef);
        const user = snapshot.val();
        
        let newBalance;
        if (action === 'set') {
            newBalance = amount;
        } else if (action === 'add') {
            newBalance = (user.balance || 0) + amount;
        } else if (action === 'subtract') {
            newBalance = (user.balance || 0) - amount;
        }
        
        await window.dbUpdate(userRef, { balance: newBalance });
        
        // Send notification
        await sendTelegramNotification(
            userId,
            `💰 Balance Updated!\n\nYour balance has been updated by admin.\nNew Balance: $${newBalance.toFixed(2)}`
        );
        
        closeModal('editUserModal');
        await loadUsers();
        showNotification('User balance updated', 'success');
        
    } catch (error) {
        console.error('Error updating user balance:', error);
        showNotification('Error updating balance', 'error');
    }
}

// Ban User
async function banUser(userId) {
    if (!confirm('Are you sure you want to ban this user?')) return;
    
    try {
        const userRef = window.dbRef(window.db, `users/${userId}`);
        await window.dbUpdate(userRef, { banned: true, balance: 0 });
        
        await sendTelegramNotification(
            userId,
            '🚫 Account Banned\n\nYour account has been banned by admin. Contact support for more information.'
        );
        
        await loadUsers();
        showNotification('User banned', 'success');
        
    } catch (error) {
        console.error('Error banning user:', error);
        showNotification('Error banning user', 'error');
    }
}

// Load Deposits
async function loadDeposits() {
    try {
        const depositsRef = window.dbRef(window.db, 'deposits');
        const snapshot = await window.dbGet(depositsRef);
        
        if (!snapshot.exists()) {
            document.getElementById('depositsTable').innerHTML = 
                '<tr><td colspan="6" style="text-align: center;">No deposits yet</td></tr>';
            return;
        }
        
        allDeposits = Object.values(snapshot.val()).sort((a, b) => b.createdAt - a.createdAt);
        
        const tbody = document.getElementById('depositsTable');
        tbody.innerHTML = '';
        
        allDeposits.forEach(deposit => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${deposit.userName}</td>
                <td>$${deposit.amount.toFixed(2)}</td>
                <td>${deposit.txHash.substring(0, 20)}...</td>
                <td><span class="status-badge status-${deposit.status}">${deposit.status.toUpperCase()}</span></td>
                <td>${new Date(deposit.createdAt).toLocaleString()}</td>
                <td>
                    ${deposit.status === 'pending' ? `
                        <button class="action-btn btn-approve" onclick="approveDeposit('${deposit.id}')">
                            <i class="fas fa-check"></i> Approve
                        </button>
                        <button class="action-btn btn-reject" onclick="rejectDeposit('${deposit.id}')">
                            <i class="fas fa-times"></i> Reject
                        </button>
                    ` : '-'}
                </td>
            `;
            tbody.appendChild(row);
        });
        
    } catch (error) {
        console.error('Error loading deposits:', error);
    }
}

// Approve Deposit
async function approveDeposit(depositId) {
    try {
        const deposit = allDeposits.find(d => d.id === depositId);
        if (!deposit) return;
        
        // Update deposit status
        const depositRef = window.dbRef(window.db, `deposits/${depositId}`);
        await window.dbUpdate(depositRef, { status: 'approved' });
        
        // Update user balance
        const userRef = window.dbRef(window.db, `users/${deposit.userId}`);
        const userSnapshot = await window.dbGet(userRef);
        const user = userSnapshot.val();
        
        const newBalance = (user.balance || 0) + deposit.amount;
        const newTotalDeposit = (user.totalDeposit || 0) + deposit.amount;
        
        await window.dbUpdate(userRef, { 
            balance: newBalance,
            totalDeposit: newTotalDeposit,
            hasDeposited: true
        });
        
        // Update history
        const historyRef = window.dbRef(window.db, `history/${deposit.userId}`);
        const historySnapshot = await window.dbGet(historyRef);
        
        if (historySnapshot.exists()) {
            const history = Object.values(historySnapshot.val());
            const depositHistory = history.find(h => h.type === 'deposit' && h.amount === deposit.amount && h.status === 'pending');
            
            if (depositHistory) {
                const historyKeys = Object.keys(historySnapshot.val());
                const historyIndex = history.indexOf(depositHistory);
                const historyKey = historyKeys[historyIndex];
                
                const historyItemRef = window.dbRef(window.db, `history/${deposit.userId}/${historyKey}`);
                await window.dbUpdate(historyItemRef, { status: 'approved' });
            }
        }
        
        // Handle referral commission if first deposit
        if (!user.hasDeposited && user.referrerId) {
            const commission = deposit.amount * 0.20;
            const referrerRef = window.dbRef(window.db, `users/${user.referrerId}`);
            const referrerSnapshot = await window.dbGet(referrerRef);
            
            if (referrerSnapshot.exists()) {
                const referrer = referrerSnapshot.val();
                await window.dbUpdate(referrerRef, {
                    balance: (referrer.balance || 0) + commission,
                    referralEarnings: (referrer.referralEarnings || 0) + commission
                });
                
                // Update referral list
                const refListRef = window.dbRef(window.db, `referralList/${user.referrerId}/${deposit.userId}`);
                const refListSnapshot = await window.dbGet(refListRef);
                if (refListSnapshot.exists()) {
                    const refData = refListSnapshot.val();
                    await window.dbUpdate(refListRef, {
                        totalEarnings: (refData.totalEarnings || 0) + commission
                    });
                }
                
                await sendTelegramNotification(
                    user.referrerId,
                    `💵 Referral Commission!\n\nYou earned $${commission.toFixed(2)} from your referral's deposit!\nUser: ${user.name}`
                );
            }
        }
        
        // Send notification
        await sendTelegramNotification(
            deposit.userId,
            `✅ Deposit Approved!\n\nAmount: $${deposit.amount.toFixed(2)}\nNew Balance: $${newBalance.toFixed(2)}\n\nYou can now start trading!`
        );
        
        await loadDeposits();
        await loadDashboardStats();
        showNotification('Deposit approved', 'success');
        
    } catch (error) {
        console.error('Error approving deposit:', error);
        showNotification('Error approving deposit', 'error');
    }
}

// Reject Deposit
async function rejectDeposit(depositId) {
    if (!confirm('Are you sure you want to reject this deposit?')) return;
    
    try {
        const deposit = allDeposits.find(d => d.id === depositId);
        if (!deposit) return;
        
        // Update deposit status
        const depositRef = window.dbRef(window.db, `deposits/${depositId}`);
        await window.dbUpdate(depositRef, { status: 'rejected' });
        
        // Update history
        const historyRef = window.dbRef(window.db, `history/${deposit.userId}`);
        const historySnapshot = await window.dbGet(historyRef);
        
        if (historySnapshot.exists()) {
            const history = Object.values(historySnapshot.val());
            const depositHistory = history.find(h => h.type === 'deposit' && h.amount === deposit.amount && h.status === 'pending');
            
            if (depositHistory) {
                const historyKeys = Object.keys(historySnapshot.val());
                const historyIndex = history.indexOf(depositHistory);
                const historyKey = historyKeys[historyIndex];
                
                const historyItemRef = window.dbRef(window.db, `history/${deposit.userId}/${historyKey}`);
                await window.dbUpdate(historyItemRef, { status: 'rejected' });
            }
        }
        
        // Send notification
        await sendTelegramNotification(
            deposit.userId,
            `❌ Deposit Rejected\n\nAmount: $${deposit.amount.toFixed(2)}\n\nYour deposit has been rejected. Please contact support for more information.`
        );
        
        await loadDeposits();
        showNotification('Deposit rejected', 'success');
        
    } catch (error) {
        console.error('Error rejecting deposit:', error);
        showNotification('Error rejecting deposit', 'error');
    }
}

// Load Withdrawals
async function loadWithdrawals() {
    try {
        const withdrawalsRef = window.dbRef(window.db, 'withdrawals');
        const snapshot = await window.dbGet(withdrawalsRef);
        
        if (!snapshot.exists()) {
            document.getElementById('withdrawalsTable').innerHTML = 
                '<tr><td colspan="6" style="text-align: center;">No withdrawals yet</td></tr>';
            return;
        }
        
        allWithdrawals = Object.values(snapshot.val()).sort((a, b) => b.createdAt - a.createdAt);
        
        const tbody = document.getElementById('withdrawalsTable');
        tbody.innerHTML = '';
        
        allWithdrawals.forEach(withdrawal => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${withdrawal.userName}</td>
                <td>$${withdrawal.amount.toFixed(2)}</td>
                <td>${withdrawal.address.substring(0, 20)}...</td>
                <td><span class="status-badge status-${withdrawal.status}">${withdrawal.status.toUpperCase()}</span></td>
                <td>${new Date(withdrawal.createdAt).toLocaleString()}</td>
                <td>
                    ${withdrawal.status === 'pending' ? `
                        <button class="action-btn btn-approve" onclick="approveWithdrawal('${withdrawal.id}')">
                            <i class="fas fa-check"></i> Approve
                        </button>
                        <button class="action-btn btn-reject" onclick="rejectWithdrawal('${withdrawal.id}')">
                            <i class="fas fa-times"></i> Reject
                        </button>
                    ` : '-'}
                </td>
            `;
            tbody.appendChild(row);
        });
        
    } catch (error) {
        console.error('Error loading withdrawals:', error);
    }
}

// Approve Withdrawal
async function approveWithdrawal(withdrawalId) {
    try {
        const withdrawal = allWithdrawals.find(w => w.id === withdrawalId);
        if (!withdrawal) return;
        
        // Update withdrawal status
        const withdrawalRef = window.dbRef(window.db, `withdrawals/${withdrawalId}`);
        await window.dbUpdate(withdrawalRef, { status: 'approved' });
        
        // Update history
        const historyRef = window.dbRef(window.db, `history/${withdrawal.userId}`);
        const historySnapshot = await window.dbGet(historyRef);
        
        if (historySnapshot.exists()) {
            const history = Object.values(historySnapshot.val());
            const withdrawalHistory = history.find(h => h.type === 'withdraw' && h.amount === withdrawal.amount && h.status === 'pending');
            
            if (withdrawalHistory) {
                const historyKeys = Object.keys(historySnapshot.val());
                const historyIndex = history.indexOf(withdrawalHistory);
                const historyKey = historyKeys[historyIndex];
                
                const historyItemRef = window.dbRef(window.db, `history/${withdrawal.userId}/${historyKey}`);
                await window.dbUpdate(historyItemRef, { status: 'approved' });
            }
        }
        
        // Send notification
        await sendTelegramNotification(
            withdrawal.userId,
            `✅ Withdrawal Approved!\n\nAmount: $${withdrawal.amount.toFixed(2)}\nAddress: ${withdrawal.address}\n\nYour withdrawal has been processed!`
        );
        
        await loadWithdrawals();
        await loadDashboardStats();
        showNotification('Withdrawal approved', 'success');
        
    } catch (error) {
        console.error('Error approving withdrawal:', error);
        showNotification('Error approving withdrawal', 'error');
    }
}

// Reject Withdrawal
async function rejectWithdrawal(withdrawalId) {
    if (!confirm('Are you sure you want to reject this withdrawal?')) return;
    
    try {
        const withdrawal = allWithdrawals.find(w => w.id === withdrawalId);
        if (!withdrawal) return;
        
        // Update withdrawal status
        const withdrawalRef = window.dbRef(window.db, `withdrawals/${withdrawalId}`);
        await window.dbUpdate(withdrawalRef, { status: 'rejected' });
        
        // Refund balance
        const userRef = window.dbRef(window.db, `users/${withdrawal.userId}`);
        const userSnapshot = await window.dbGet(userRef);
        const user = userSnapshot.val();
        
        const newBalance = (user.balance || 0) + withdrawal.amount;
        await window.dbUpdate(userRef, { balance: newBalance });
        
        // Update history
        const historyRef = window.dbRef(window.db, `history/${withdrawal.userId}`);
        const historySnapshot = await window.dbGet(historyRef);
        
        if (historySnapshot.exists()) {
            const history = Object.values(historySnapshot.val());
            const withdrawalHistory = history.find(h => h.type === 'withdraw' && h.amount === withdrawal.amount && h.status === 'pending');
            
            if (withdrawalHistory) {
                const historyKeys = Object.keys(historySnapshot.val());
                const historyIndex = history.indexOf(withdrawalHistory);
                const historyKey = historyKeys[historyIndex];
                
                const historyItemRef = window.dbRef(window.db, `history/${withdrawal.userId}/${historyKey}`);
                await window.dbUpdate(historyItemRef, { status: 'rejected' });
            }
        }
        
        // Send notification
        await sendTelegramNotification(
            withdrawal.userId,
            `❌ Withdrawal Rejected\n\nAmount: $${withdrawal.amount.toFixed(2)}\n\nYour withdrawal has been rejected and the amount has been refunded to your balance.\nNew Balance: $${newBalance.toFixed(2)}`
        );
        
        await loadWithdrawals();
        showNotification('Withdrawal rejected and refunded', 'success');
        
    } catch (error) {
        console.error('Error rejecting withdrawal:', error);
        showNotification('Error rejecting withdrawal', 'error');
    }
}

// Load Trades
async function loadTrades() {
    try {
        const tradesRef = window.dbRef(window.db, 'trades');
        const snapshot = await window.dbGet(tradesRef);
        
        if (!snapshot.exists()) {
            document.getElementById('tradesTable').innerHTML = 
                '<tr><td colspan="7" style="text-align: center;">No trades yet</td></tr>';
            return;
        }
        
        allTrades = [];
        snapshot.forEach(userSnapshot => {
            const userTrades = Object.values(userSnapshot.val());
            allTrades.push(...userTrades);
        });
        
        const tbody = document.getElementById('tradesTable');
        tbody.innerHTML = '';
        
        for (const trade of allTrades) {
            const userRef = window.dbRef(window.db, `users/${trade.userId}`);
            const userSnapshot = await window.dbGet(userRef);
            const userName = userSnapshot.exists() ? userSnapshot.val().name : 'Unknown';
            
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${userName}</td>
                <td>${trade.planPair}</td>
                <td>$${trade.investAmount.toFixed(2)}</td>
                <td>$${trade.dailyEarning.toFixed(2)}</td>
                <td>${trade.daysRemaining}</td>
                <td>$${trade.totalEarned.toFixed(2)}</td>
                <td><span class="status-badge status-${trade.status}">${trade.status.toUpperCase()}</span></td>
            `;
            tbody.appendChild(row);
        }
        
    } catch (error) {
        console.error('Error loading trades:', error);
    }
}

// Load Plans
async function loadPlans() {
    try {
        const plansRef = window.dbRef(window.db, 'tradingPlans');
        const snapshot = await window.dbGet(plansRef);
        
        if (!snapshot.exists()) {
            document.getElementById('plansTable').innerHTML = 
                '<tr><td colspan="6" style="text-align: center;">No plans yet</td></tr>';
            return;
        }
        
        allPlans = Object.values(snapshot.val());
        
        const tbody = document.getElementById('plansTable');
        tbody.innerHTML = '';
        
        allPlans.forEach(plan => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${plan.pair}</td>
                <td>$${plan.price.toFixed(2)}</td>
                <td>$${plan.dailyEarning.toFixed(2)}</td>
                <td>${plan.duration} days</td>
                <td><span class="status-badge status-${plan.active ? 'active' : 'rejected'}">${plan.active ? 'ACTIVE' : 'INACTIVE'}</span></td>
                <td>
                    <button class="action-btn btn-edit" onclick="togglePlan('${plan.id}', ${!plan.active})">
                        <i class="fas fa-${plan.active ? 'pause' : 'play'}"></i> ${plan.active ? 'Deactivate' : 'Activate'}
                    </button>
                    <button class="action-btn btn-delete" onclick="deletePlan('${plan.id}')">
                        <i class="fas fa-trash"></i> Delete
                    </button>
                </td>
            `;
            tbody.appendChild(row);
        });
        
    } catch (error) {
        console.error('Error loading plans:', error);
    }
}

// Show Add Plan Modal
function showAddPlanModal() {
    document.getElementById('addPlanModal').classList.add('active');
}

// Add Plan
async function addPlan() {
    const pair = document.getElementById('planPair').value.trim();
    const price = parseFloat(document.getElementById('planPrice').value);
    const dailyEarning = parseFloat(document.getElementById('planDailyEarning').value);
    const duration = parseInt(document.getElementById('planDuration').value);
    
    if (!pair || !price || !dailyEarning || !duration) {
        showNotification('Please fill all fields', 'error');
        return;
    }
    
    try {
        const planRef = window.dbPush(window.dbRef(window.db, 'tradingPlans'));
        await window.dbSet(planRef, {
            id: planRef.key,
            pair: pair,
            price: price,
            dailyEarning: dailyEarning,
            duration: duration,
            minInvest: 40,
            active: true,
            createdAt: Date.now()
        });
        
        closeModal('addPlanModal');
        await loadPlans();
        showNotification('Plan added successfully', 'success');
        
        // Clear form
        document.getElementById('planPair').value = '';
        document.getElementById('planPrice').value = '';
        document.getElementById('planDailyEarning').value = '';
        document.getElementById('planDuration').value = '';
        
    } catch (error) {
        console.error('Error adding plan:', error);
        showNotification('Error adding plan', 'error');
    }
}

// Toggle Plan
async function togglePlan(planId, active) {
    try {
        const planRef = window.dbRef(window.db, `tradingPlans/${planId}`);
        await window.dbUpdate(planRef, { active: active });
        
        await loadPlans();
        showNotification(`Plan ${active ? 'activated' : 'deactivated'}`, 'success');
        
    } catch (error) {
        console.error('Error toggling plan:', error);
        showNotification('Error updating plan', 'error');
    }
}

// Delete Plan
async function deletePlan(planId) {
    if (!confirm('Are you sure you want to delete this plan?')) return;
    
    try {
        const planRef = window.dbRef(window.db, `tradingPlans/${planId}`);
        await window.dbRemove(planRef);
        
        await loadPlans();
        showNotification('Plan deleted', 'success');
        
    } catch (error) {
        console.error('Error deleting plan:', error);
        showNotification('Error deleting plan', 'error');
    }
}

// Load Tasks
async function loadTasks() {
    try {
        const tasksRef = window.dbRef(window.db, 'tasks');
        const snapshot = await window.dbGet(tasksRef);
        
        if (!snapshot.exists()) {
            document.getElementById('tasksTable').innerHTML = 
                '<tr><td colspan="6" style="text-align: center;">No tasks yet</td></tr>';
            return;
        }
        
        allTasks = Object.values(snapshot.val());
        
        const tbody = document.getElementById('tasksTable');
        tbody.innerHTML = '';
        
        allTasks.forEach(task => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${task.title}</td>
                <td>${task.description}</td>
                <td>$${task.reward.toFixed(2)}</td>
                <td><a href="${task.link}" target="_blank">Link</a></td>
                <td><span class="status-badge status-${task.active ? 'active' : 'rejected'}">${task.active ? 'ACTIVE' : 'INACTIVE'}</span></td>
                <td>
                    <button class="action-btn btn-edit" onclick="toggleTask('${task.id}', ${!task.active})">
                        <i class="fas fa-${task.active ? 'pause' : 'play'}"></i> ${task.active ? 'Deactivate' : 'Activate'}
                    </button>
                    <button class="action-btn btn-delete" onclick="deleteTask('${task.id}')">
                        <i class="fas fa-trash"></i> Delete
                    </button>
                </td>
            `;
            tbody.appendChild(row);
        });
        
    } catch (error) {
        console.error('Error loading tasks:', error);
    }
}

// Show Add Task Modal
function showAddTaskModal() {
    document.getElementById('addTaskModal').classList.add('active');
}

// Add Task
async function addTask() {
    const title = document.getElementById('taskTitle').value.trim();
    const description = document.getElementById('taskDescription').value.trim();
    const reward = parseFloat(document.getElementById('taskReward').value);
    const link = document.getElementById('taskLink').value.trim();
    const logo = document.getElementById('taskLogo').value.trim();
    
    if (!title || !description || !reward || !link) {
        showNotification('Please fill all required fields', 'error');
        return;
    }
    
    try {
        const taskRef = window.dbPush(window.dbRef(window.db, 'tasks'));
        await window.dbSet(taskRef, {
            id: taskRef.key,
            title: title,
            description: description,
            reward: reward,
            link: link,
            logo: logo || 'https://via.placeholder.com/60',
            active: true,
            createdAt: Date.now()
        });
        
        closeModal('addTaskModal');
        await loadTasks();
        showNotification('Task added successfully', 'success');
        
        // Clear form
        document.getElementById('taskTitle').value = '';
        document.getElementById('taskDescription').value = '';
        document.getElementById('taskReward').value = '';
        document.getElementById('taskLink').value = '';
        document.getElementById('taskLogo').value = '';
        
    } catch (error) {
        console.error('Error adding task:', error);
        showNotification('Error adding task', 'error');
    }
}

// Toggle Task
async function toggleTask(taskId, active) {
    try {
        const taskRef = window.dbRef(window.db, `tasks/${taskId}`);
        await window.dbUpdate(taskRef, { active: active });
        
        await loadTasks();
        showNotification(`Task ${active ? 'activated' : 'deactivated'}`, 'success');
        
    } catch (error) {
        console.error('Error toggling task:', error);
        showNotification('Error updating task', 'error');
    }
}

// Delete Task
async function deleteTask(taskId) {
    if (!confirm('Are you sure you want to delete this task?')) return;
    
    try {
        const taskRef = window.dbRef(window.db, `tasks/${taskId}`);
        await window.dbRemove(taskRef);
        
        await loadTasks();
        showNotification('Task deleted', 'success');
        
    } catch (error) {
        console.error('Error deleting task:', error);
        showNotification('Error deleting task', 'error');
    }
}

// Load Redeem Codes
async function loadRedeemCodes() {
    try {
        const codesRef = window.dbRef(window.db, 'redeemCodes');
        const snapshot = await window.dbGet(codesRef);
        
        if (!snapshot.exists()) {
            document.getElementById('redeemCodesTable').innerHTML = 
                '<tr><td colspan="7" style="text-align: center;">No codes yet</td></tr>';
            return;
        }
        
        allRedeemCodes = Object.values(snapshot.val());
        
        const tbody = document.getElementById('redeemCodesTable');
        tbody.innerHTML = '';
        
        allRedeemCodes.forEach(code => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td><strong>${code.code}</strong></td>
                <td>$${code.minReward.toFixed(2)}</td>
                <td>$${code.maxReward.toFixed(2)}</td>
                <td>${code.maxUses}</td>
                <td>${code.used || 0}</td>
                <td>${new Date(code.createdAt).toLocaleString()}</td>
                <td>
                    <button class="action-btn btn-delete" onclick="deleteRedeemCode('${code.id}')">
                        <i class="fas fa-trash"></i> Delete
                    </button>
                </td>
            `;
            tbody.appendChild(row);
        });
        
    } catch (error) {
        console.error('Error loading redeem codes:', error);
    }
}

// Show Generate Code Modal
function showGenerateCodeModal() {
    document.getElementById('generateCodeModal').classList.add('active');
}

// Generate Redeem Code
async function generateRedeemCode() {
    const minReward = parseFloat(document.getElementById('codeMinReward').value);
    const maxReward = parseFloat(document.getElementById('codeMaxReward').value);
    const maxUses = parseInt(document.getElementById('codeMaxUses').value);
    
    if (!minReward || !maxReward || !maxUses) {
        showNotification('Please fill all fields', 'error');
        return;
    }
    
    if (minReward > maxReward) {
        showNotification('Min reward cannot be greater than max reward', 'error');
        return;
    }
    
    try {
        // Generate random 8-character code
        const code = Math.random().toString(36).substring(2, 10).toUpperCase();
        
        const codeRef = window.dbPush(window.dbRef(window.db, 'redeemCodes'));
        await window.dbSet(codeRef, {
            id: codeRef.key,
            code: code,
            minReward: minReward,
            maxReward: maxReward,
            maxUses: maxUses,
            used: 0,
            createdAt: Date.now()
        });
        
        closeModal('generateCodeModal');
        await loadRedeemCodes();
        showNotification(`Code generated: ${code}`, 'success');
        
    } catch (error) {
        console.error('Error generating code:', error);
        showNotification('Error generating code', 'error');
    }
}

// Delete Redeem Code
async function deleteRedeemCode(codeId) {
    if (!confirm('Are you sure you want to delete this code?')) return;
    
    try {
        const codeRef = window.dbRef(window.db, `redeemCodes/${codeId}`);
        await window.dbRemove(codeRef);
        
        await loadRedeemCodes();
        showNotification('Code deleted', 'success');
        
    } catch (error) {
        console.error('Error deleting code:', error);
        showNotification('Error deleting code', 'error');
    }
}

// Save Settings
async function saveSettings() {
    const platformName = document.getElementById('platformName').value;
    const minDeposit = parseFloat(document.getElementById('minDeposit').value);
    const minWithdrawal = parseFloat(document.getElementById('minWithdrawal').value);
    const referralBonus = parseFloat(document.getElementById('referralBonus').value);
    const referralCommission = parseFloat(document.getElementById('referralCommission').value);
    
    try {
        const settingsRef = window.dbRef(window.db, 'settings');
        await window.dbSet(settingsRef, {
            platformName: platformName,
            minDeposit: minDeposit,
            minWithdrawal: minWithdrawal,
            referralBonus: referralBonus,
            referralCommission: referralCommission,
            updatedAt: Date.now()
        });
        
        showNotification('Settings saved successfully', 'success');
        
    } catch (error) {
        console.error('Error saving settings:', error);
        showNotification('Error saving settings', 'error');
    }
}

// Send Telegram Notification
async function sendTelegramNotification(userId, message) {
    try {
        await fetch(`${TELEGRAM_API}/sendMessage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                chat_id: userId,
                text: message,
                parse_mode: 'HTML'
            })
        });
    } catch (error) {
        console.error('Error sending notification:', error);
    }
}

// Setup Realtime Listeners
function setupRealtimeListeners() {
    // Listen for new deposits
    const depositsRef = window.dbRef(window.db, 'deposits');
    window.dbOnValue(depositsRef, () => {
        if (document.getElementById('deposits').classList.contains('active')) {
            loadDeposits();
        }
        loadDashboardStats();
    });
    
    // Listen for new withdrawals
    const withdrawalsRef = window.dbRef(window.db, 'withdrawals');
    window.dbOnValue(withdrawalsRef, () => {
        if (document.getElementById('withdrawals').classList.contains('active')) {
            loadWithdrawals();
        }
        loadDashboardStats();
    });
    
    // Listen for user changes
    const usersRef = window.dbRef(window.db, 'users');
    window.dbOnValue(usersRef, () => {
        if (document.getElementById('users').classList.contains('active')) {
            loadUsers();
        }
        loadDashboardStats();
    });
}

// Show Admin Section
function showAdminSection(sectionId) {
    // Hide all sections
    document.querySelectorAll('.section').forEach(section => {
        section.classList.remove('active');
    });
    
    // Show selected section
    document.getElementById(sectionId).classList.add('active');
    
    // Update sidebar
    document.querySelectorAll('.sidebar-item').forEach(item => {
        item.classList.remove('active');
    });
    event.target.closest('.sidebar-item').classList.add('active');
}

// Close Modal
function closeModal(modalId) {
    document.getElementById(modalId).classList.remove('active');
}

// Show Notification
function showNotification(message, type = 'success') {
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.innerHTML = `
        <i class="fas fa-${type === 'success' ? 'check-circle' : type === 'error' ? 'exclamation-circle' : 'info-circle'}"></i>
        <span style="margin-left: 0.5rem;">${message}</span>
    `;
    
    document.body.appendChild(notification);
    
    setTimeout(() => {
        notification.remove();
    }, 3000);
}

// Close modals when clicking outside
window.onclick = function(event) {
    if (event.target.classList.contains('modal')) {
        event.target.classList.remove('active');
    }
}
