// Telegram Bot Configuration
const TELEGRAM_BOT_TOKEN = '7930967027:AAG3AkEZrkKGxTFOyVHwN8VpA9HgusAdRmw';
const TELEGRAM_API = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}`;

// Global Variables
let currentUser = null;
let userBalance = 0;
let tradingPlans = [];
let userTrades = [];
let depositTimer = null;

// Trading Plans Data
const defaultPlans = [
    { pair: 'BTC/USDT', price: 3000, dailyEarning: 300, duration: 30, minInvest: 40 },
    { pair: 'ETH/USDT', price: 2000, dailyEarning: 200, duration: 30, minInvest: 40 },
    { pair: 'BNB/USDT', price: 1500, dailyEarning: 150, duration: 25, minInvest: 40 },
    { pair: 'SOL/USDT', price: 1200, dailyEarning: 120, duration: 25, minInvest: 40 },
    { pair: 'ADA/USDT', price: 1000, dailyEarning: 100, duration: 20, minInvest: 40 },
    { pair: 'XRP/USDT', price: 900, dailyEarning: 90, duration: 20, minInvest: 40 },
    { pair: 'DOT/USDT', price: 800, dailyEarning: 80, duration: 20, minInvest: 40 },
    { pair: 'DOGE/USDT', price: 700, dailyEarning: 70, duration: 15, minInvest: 40 },
    { pair: 'AVAX/USDT', price: 650, dailyEarning: 65, duration: 15, minInvest: 40 },
    { pair: 'MATIC/USDT', price: 600, dailyEarning: 60, duration: 15, minInvest: 40 },
    { pair: 'LINK/USDT', price: 550, dailyEarning: 55, duration: 15, minInvest: 40 },
    { pair: 'UNI/USDT', price: 500, dailyEarning: 50, duration: 10, minInvest: 40 },
    { pair: 'ATOM/USDT', price: 450, dailyEarning: 45, duration: 10, minInvest: 40 },
    { pair: 'LTC/USDT', price: 400, dailyEarning: 40, duration: 10, minInvest: 40 },
    { pair: 'TRX/USDT', price: 350, dailyEarning: 35, duration: 10, minInvest: 40 },
    { pair: 'XLM/USDT', price: 300, dailyEarning: 30, duration: 7, minInvest: 40 },
    { pair: 'VET/USDT', price: 250, dailyEarning: 25, duration: 7, minInvest: 40 },
    { pair: 'FIL/USDT', price: 200, dailyEarning: 20, duration: 7, minInvest: 40 },
    { pair: 'ALGO/USDT', price: 150, dailyEarning: 15, duration: 5, minInvest: 40 },
    { pair: 'NEAR/USDT', price: 100, dailyEarning: 10, duration: 5, minInvest: 40 }
];

// Initialize App
async function initApp() {
    try {
        // Simulate Telegram WebApp initialization
        const urlParams = new URLSearchParams(window.location.search);
        const userId = urlParams.get('user_id') || generateUserId();
        const userName = urlParams.get('user_name') || 'User';
        const userPhoto = urlParams.get('user_photo') || 'https://via.placeholder.com/100';
        const referrerId = urlParams.get('ref');

        currentUser = {
            id: userId,
            name: userName,
            photo: userPhoto,
            referrerId: referrerId
        };

        // Initialize user in database
        await initializeUser();
        
        // Load user data
        await loadUserData();
        
        // Load trading plans
        await loadTradingPlans();
        
        // Load user trades
        await loadUserTrades();
        
        // Setup real-time listeners
        setupRealtimeListeners();
        
        // Hide loading screen
        setTimeout(() => {
            document.getElementById('loadingScreen').style.display = 'none';
        }, 1500);
        
    } catch (error) {
        console.error('Initialization error:', error);
        showNotification('Error initializing app', 'error');
    }
}

// Generate User ID
function generateUserId() {
    return 'USER_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
}

// Initialize User in Database
async function initializeUser() {
    const userRef = window.dbRef(window.db, `users/${currentUser.id}`);
    const snapshot = await window.dbGet(userRef);
    
    if (!snapshot.exists()) {
        const userData = {
            id: currentUser.id,
            name: currentUser.name,
            photo: currentUser.photo,
            balance: 0,
            totalDeposit: 0,
            totalWithdraw: 0,
            totalEarnings: 0,
            referralEarnings: 0,
            referrals: 0,
            referrerId: currentUser.referrerId || null,
            hasDeposited: false,
            createdAt: Date.now(),
            lastActive: Date.now()
        };
        
        await window.dbSet(userRef, userData);
        
        // Handle referral bonus
        if (currentUser.referrerId) {
            await handleReferralBonus(currentUser.referrerId);
        }
        
        // Send welcome notification
        await sendTelegramNotification(currentUser.id, '🎉 Welcome to Exotix Trading Platform!\n\nStart trading and earning today!');
    } else {
        // Update last active
        await window.dbUpdate(userRef, { lastActive: Date.now() });
    }
}

// Handle Referral Bonus
async function handleReferralBonus(referrerId) {
    const referrerRef = window.dbRef(window.db, `users/${referrerId}`);
    const snapshot = await window.dbGet(referrerRef);
    
    if (snapshot.exists()) {
        const referrerData = snapshot.val();
        const newBalance = (referrerData.balance || 0) + 0.20;
        const newReferrals = (referrerData.referrals || 0) + 1;
        const newReferralEarnings = (referrerData.referralEarnings || 0) + 0.20;
        
        await window.dbUpdate(referrerRef, {
            balance: newBalance,
            referrals: newReferrals,
            referralEarnings: newReferralEarnings
        });
        
        // Add to referral list
        const referralListRef = window.dbRef(window.db, `referralList/${referrerId}/${currentUser.id}`);
        await window.dbSet(referralListRef, {
            userId: currentUser.id,
            userName: currentUser.name,
            userPhoto: currentUser.photo,
            joinedAt: Date.now(),
            totalEarnings: 0.20
        });
        
        // Send notification to referrer
        await sendTelegramNotification(referrerId, `🎁 New Referral!\n\nYou earned $0.20 bonus!\nUser: ${currentUser.name}`);
    }
}

// Load User Data
async function loadUserData() {
    const userRef = window.dbRef(window.db, `users/${currentUser.id}`);
    const snapshot = await window.dbGet(userRef);
    
    if (snapshot.exists()) {
        const userData = snapshot.val();
        userBalance = userData.balance || 0;
        updateBalanceDisplay();
        
        // Update profile
        document.getElementById('profileName').textContent = userData.name;
        document.getElementById('profileUserId').textContent = userData.id;
        document.getElementById('profileAvatar').src = userData.photo;
        
        // Update referral stats
        document.getElementById('totalReferrals').textContent = userData.referrals || 0;
        document.getElementById('totalReferralEarnings').textContent = `$${(userData.referralEarnings || 0).toFixed(2)}`;
        
        // Update referral link
        const referralLink = `http://t.me/Exotix_Robot/myapp?ref=${userData.id}`;
        document.getElementById('referralLink').textContent = referralLink;
    }
}

// Load Trading Plans
async function loadTradingPlans() {
    const plansRef = window.dbRef(window.db, 'tradingPlans');
    const snapshot = await window.dbGet(plansRef);
    
    if (snapshot.exists()) {
        tradingPlans = Object.values(snapshot.val());
    } else {
        // Initialize default plans
        for (const plan of defaultPlans) {
            const planRef = window.dbPush(window.dbRef(window.db, 'tradingPlans'));
            await window.dbSet(planRef, {
                id: planRef.key,
                ...plan,
                active: true
            });
        }
        tradingPlans = defaultPlans;
    }
    
    renderTradingPlans();
}

// Render Trading Plans
function renderTradingPlans() {
    const plansGrid = document.getElementById('plansGrid');
    plansGrid.innerHTML = '';
    
    tradingPlans.forEach(plan => {
        if (!plan.active) return;
        
        const planCard = document.createElement('div');
        planCard.className = 'plan-card';
        
        // Check if user already purchased this plan
        const isPurchased = userTrades.some(trade => trade.planId === plan.id);
        
        planCard.innerHTML = `
            <div class="plan-header">
                <div class="plan-pair">${plan.pair}</div>
                <div class="plan-badge">Active</div>
            </div>
            <div class="plan-chart">
                <div class="chart-placeholder">
                    <i class="fas fa-chart-line" style="font-size: 3rem; opacity: 0.3;"></i>
                </div>
            </div>
            <div class="plan-details">
                <div class="plan-detail">
                    <div class="plan-detail-label">Daily Earning</div>
                    <div class="plan-detail-value">$${plan.dailyEarning}</div>
                </div>
                <div class="plan-detail">
                    <div class="plan-detail-label">Duration</div>
                    <div class="plan-detail-value">${plan.duration} Days</div>
                </div>
            </div>
            <div class="plan-price">$${plan.price}</div>
            <button class="plan-button" onclick="buyPlan('${plan.id}')" ${isPurchased ? 'disabled' : ''}>
                ${isPurchased ? 'Purchased' : 'Buy Now'}
            </button>
        `;
        
        plansGrid.appendChild(planCard);
    });
}

// Buy Plan
async function buyPlan(planId) {
    const plan = tradingPlans.find(p => p.id === planId);
    if (!plan) return;
    
    if (userBalance < plan.price) {
        showNotification('Insufficient balance!', 'error');
        return;
    }
    
    // Check if already purchased
    const isPurchased = userTrades.some(trade => trade.planId === planId);
    if (isPurchased) {
        showNotification('You already purchased this plan!', 'warning');
        return;
    }
    
    try {
        // Deduct balance
        const newBalance = userBalance - plan.price;
        const userRef = window.dbRef(window.db, `users/${currentUser.id}`);
        await window.dbUpdate(userRef, { balance: newBalance });
        
        // Create trade
        const tradeRef = window.dbPush(window.dbRef(window.db, `trades/${currentUser.id}`));
        const tradeData = {
            id: tradeRef.key,
            userId: currentUser.id,
            planId: plan.id,
            planPair: plan.pair,
            investAmount: plan.price,
            dailyEarning: plan.dailyEarning,
            duration: plan.duration,
            daysRemaining: plan.duration,
            totalEarned: 0,
            lastClaimTime: Date.now(),
            nextClaimTime: Date.now() + (24 * 60 * 60 * 1000),
            purchasedAt: Date.now(),
            status: 'active'
        };
        await window.dbSet(tradeRef, tradeData);
        
        // Add activity
        await addActivity('Plan Purchase', `Purchased ${plan.pair} plan for $${plan.price}`);
        
        // Update balance
        userBalance = newBalance;
        updateBalanceDisplay();
        
        // Reload data
        await loadUserTrades();
        renderTradingPlans();
        
        // Send Telegram notification
        await sendTelegramNotification(
            currentUser.id,
            `✅ Plan Purchased Successfully!\n\n` +
            `Plan: ${plan.pair}\n` +
            `Investment: $${plan.price}\n` +
            `Daily Earning: $${plan.dailyEarning}\n` +
            `Duration: ${plan.duration} days\n\n` +
            `Start earning now!`
        );
        
        showNotification('Plan purchased successfully!', 'success');
        
    } catch (error) {
        console.error('Error buying plan:', error);
        showNotification('Error purchasing plan', 'error');
    }
}

// Load User Trades
async function loadUserTrades() {
    const tradesRef = window.dbRef(window.db, `trades/${currentUser.id}`);
    const snapshot = await window.dbGet(tradesRef);
    
    userTrades = [];
    if (snapshot.exists()) {
        userTrades = Object.values(snapshot.val()).filter(trade => trade.status === 'active');
    }
    
    renderUserTrades();
}

// Render User Trades
function renderUserTrades() {
    const tradesContainer = document.getElementById('tradesContainer');
    
    if (userTrades.length === 0) {
        tradesContainer.innerHTML = `
            <div class="empty-state">
                <div class="empty-icon"><i class="fas fa-briefcase"></i></div>
                <div class="empty-text">No active trades yet</div>
            </div>
        `;
        return;
    }
    
    tradesContainer.innerHTML = '';
    
    userTrades.forEach(trade => {
        const tradeCard = document.createElement('div');
        tradeCard.className = 'trade-card';
        
        const now = Date.now();
        const timeUntilClaim = trade.nextClaimTime - now;
        const canClaim = timeUntilClaim <= 0;
        const progress = canClaim ? 100 : ((24 * 60 * 60 * 1000 - timeUntilClaim) / (24 * 60 * 60 * 1000)) * 100;
        
        tradeCard.innerHTML = `
            <div class="trade-header">
                <div>
                    <h3>${trade.planPair}</h3>
                    <p style="color: var(--text-secondary);">Investment: $${trade.investAmount}</p>
                </div>
                <div style="text-align: right;">
                    <div style="color: var(--success); font-weight: bold;">$${trade.dailyEarning}/day</div>
                    <div style="color: var(--text-secondary); font-size: 0.9rem;">${trade.daysRemaining} days left</div>
                </div>
            </div>
            <div class="countdown-container">
                <div class="countdown-bar">
                    <div class="countdown-fill" style="width: ${progress}%">
                        ${canClaim ? 'Ready to Claim!' : formatTimeRemaining(timeUntilClaim)}
                    </div>
                </div>
            </div>
            <button class="claim-button" onclick="claimEarnings('${trade.id}')" ${!canClaim ? 'disabled' : ''}>
                ${canClaim ? 'Claim $' + trade.dailyEarning : 'Claim Available in ' + formatTimeRemaining(timeUntilClaim)}
            </button>
            <div style="margin-top: 1rem; text-align: center; color: var(--text-secondary);">
                Total Earned: $${trade.totalEarned.toFixed(2)}
            </div>
        `;
        
        tradesContainer.appendChild(tradeCard);
    });
    
    // Update countdowns every second
    setTimeout(() => renderUserTrades(), 1000);
}

// Claim Earnings
async function claimEarnings(tradeId) {
    const trade = userTrades.find(t => t.id === tradeId);
    if (!trade) return;
    
    const now = Date.now();
    if (now < trade.nextClaimTime) {
        showNotification('Claim not available yet!', 'warning');
        return;
    }
    
    try {
        // Update trade
        const newTotalEarned = trade.totalEarned + trade.dailyEarning;
        const newDaysRemaining = trade.daysRemaining - 1;
        const newNextClaimTime = now + (24 * 60 * 60 * 1000);
        const newStatus = newDaysRemaining <= 0 ? 'completed' : 'active';
        
        const tradeRef = window.dbRef(window.db, `trades/${currentUser.id}/${tradeId}`);
        await window.dbUpdate(tradeRef, {
            totalEarned: newTotalEarned,
            daysRemaining: newDaysRemaining,
            lastClaimTime: now,
            nextClaimTime: newNextClaimTime,
            status: newStatus
        });
        
        // Update user balance
        const newBalance = userBalance + trade.dailyEarning;
        const userRef = window.dbRef(window.db, `users/${currentUser.id}`);
        await window.dbUpdate(userRef, { 
            balance: newBalance,
            totalEarnings: (await window.dbGet(userRef)).val().totalEarnings + trade.dailyEarning
        });
        
        // Handle referral commission (20%)
        if (currentUser.referrerId) {
            await handleReferralCommission(currentUser.referrerId, trade.dailyEarning * 0.20);
        }
        
        // Add activity
        await addActivity('Earnings Claimed', `Claimed $${trade.dailyEarning} from ${trade.planPair}`);
        
        // Update balance
        userBalance = newBalance;
        updateBalanceDisplay();
        
        // Reload trades
        await loadUserTrades();
        
        // Send Telegram notification
        await sendTelegramNotification(
            currentUser.id,
            `💰 Earnings Claimed!\n\n` +
            `Amount: $${trade.dailyEarning}\n` +
            `Plan: ${trade.planPair}\n` +
            `New Balance: $${newBalance.toFixed(2)}\n\n` +
            (newDaysRemaining > 0 ? `Next claim in 24 hours` : `Plan completed!`)
        );
        
        showNotification(`Claimed $${trade.dailyEarning} successfully!`, 'success');
        
    } catch (error) {
        console.error('Error claiming earnings:', error);
        showNotification('Error claiming earnings', 'error');
    }
}

// Handle Referral Commission
async function handleReferralCommission(referrerId, amount) {
    const referrerRef = window.dbRef(window.db, `users/${referrerId}`);
    const snapshot = await window.dbGet(referrerRef);
    
    if (snapshot.exists()) {
        const referrerData = snapshot.val();
        const newBalance = (referrerData.balance || 0) + amount;
        const newReferralEarnings = (referrerData.referralEarnings || 0) + amount;
        
        await window.dbUpdate(referrerRef, {
            balance: newBalance,
            referralEarnings: newReferralEarnings
        });
        
        // Update referral list earnings
        const referralListRef = window.dbRef(window.db, `referralList/${referrerId}/${currentUser.id}`);
        const refSnapshot = await window.dbGet(referralListRef);
        if (refSnapshot.exists()) {
            const refData = refSnapshot.val();
            await window.dbUpdate(referralListRef, {
                totalEarnings: (refData.totalEarnings || 0) + amount
            });
        }
        
        // Send notification
        await sendTelegramNotification(
            referrerId,
            `💵 Referral Commission!\n\n` +
            `You earned $${amount.toFixed(2)} from your referral's earnings!\n` +
            `User: ${currentUser.name}`
        );
    }
}

// Format Time Remaining
function formatTimeRemaining(ms) {
    if (ms <= 0) return 'Ready!';
    
    const hours = Math.floor(ms / (1000 * 60 * 60));
    const minutes = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((ms % (1000 * 60)) / 1000);
    
    return `${hours}h ${minutes}m ${seconds}s`;
}

// Show Deposit
function showDeposit() {
    showSection('depositSection');
    document.getElementById('depositForm').style.display = 'block';
    document.getElementById('depositQRContainer').style.display = 'none';
}

// Show Deposit QR
function showDepositQR() {
    const amount = parseFloat(document.getElementById('depositAmount').value);
    
    if (!amount || amount < 30) {
        showNotification('Minimum deposit is $30', 'error');
        return;
    }
    
    document.getElementById('depositForm').style.display = 'none';
    document.getElementById('depositQRContainer').style.display = 'block';
    document.getElementById('depositAmountDisplay').textContent = `Amount: $${amount.toFixed(2)}`;
    document.getElementById('depositMemo').textContent = `Memo: ExotixDP_${currentUser.id}`;
    
    // Start 15 minute timer
    let timeLeft = 15 * 60;
    clearInterval(depositTimer);
    depositTimer = setInterval(() => {
        timeLeft--;
        const minutes = Math.floor(timeLeft / 60);
        const seconds = timeLeft % 60;
        document.getElementById('depositTimer').textContent = 
            `${minutes}:${seconds.toString().padStart(2, '0')}`;
        
        if (timeLeft <= 0) {
            clearInterval(depositTimer);
            showNotification('Deposit time expired. Please try again.', 'warning');
            showDeposit();
        }
    }, 1000);
}

// Submit Deposit
async function submitDeposit() {
    const amount = parseFloat(document.getElementById('depositAmount').value);
    const txHash = document.getElementById('depositTxHash').value.trim();
    
    if (!txHash) {
        showNotification('Please enter transaction hash', 'error');
        return;
    }
    
    try {
        // Create deposit request
        const depositRef = window.dbPush(window.dbRef(window.db, 'deposits'));
        const depositData = {
            id: depositRef.key,
            userId: currentUser.id,
            userName: currentUser.name,
            amount: amount,
            txHash: txHash,
            address: 'UQBWOgFgB4B8qBCo8CNjDUNAtvUSosw4v7v9gkt0GVOaNLSz',
            memo: `ExotixDP_${currentUser.id}`,
            status: 'pending',
            createdAt: Date.now()
        };
        await window.dbSet(depositRef, depositData);
        
        // Add to history
        await addHistory('deposit', amount, 'pending');
        
        // Add activity
        await addActivity('Deposit Request', `Deposit request of $${amount} submitted`);
        
        clearInterval(depositTimer);
        showNotification('Deposit request submitted! Waiting for approval.', 'success');
        showSection('walletSection');
        
        // Reset form
        document.getElementById('depositAmount').value = '';
        document.getElementById('depositTxHash').value = '';
        
    } catch (error) {
        console.error('Error submitting deposit:', error);
        showNotification('Error submitting deposit', 'error');
    }
}

// Show Withdraw
function showWithdraw() {
    showSection('withdrawSection');
}

// Submit Withdraw
async function submitWithdraw() {
    const address = document.getElementById('withdrawAddress').value.trim();
    const amount = parseFloat(document.getElementById('withdrawAmount').value);
    const memo = document.getElementById('withdrawMemo').value.trim();
    
    if (!address) {
        showNotification('Please enter withdrawal address', 'error');
        return;
    }
    
    if (!amount || amount < 0.10) {
        showNotification('Minimum withdrawal is $0.10', 'error');
        return;
    }
    
    // Check if user has deposited
    const userRef = window.dbRef(window.db, `users/${currentUser.id}`);
    const snapshot = await window.dbGet(userRef);
    const userData = snapshot.val();
    
    if (!userData.hasDeposited) {
        showNotification('First time deposit required to withdraw', 'error');
        return;
    }
    
    if (userBalance < amount) {
        showNotification('Insufficient balance!', 'error');
        return;
    }
    
    try {
        // Create withdrawal request
        const withdrawRef = window.dbPush(window.dbRef(window.db, 'withdrawals'));
        const withdrawData = {
            id: withdrawRef.key,
            userId: currentUser.id,
            userName: currentUser.name,
            amount: amount,
            address: address,
            memo: memo,
            status: 'pending',
            createdAt: Date.now()
        };
        await window.dbSet(withdrawRef, withdrawData);
        
        // Deduct balance temporarily
        const newBalance = userBalance - amount;
        await window.dbUpdate(userRef, { balance: newBalance });
        userBalance = newBalance;
        updateBalanceDisplay();
        
        // Add to history
        await addHistory('withdraw', amount, 'pending');
        
        // Add activity
        await addActivity('Withdrawal Request', `Withdrawal request of $${amount} submitted`);
        
        showNotification('Withdrawal request submitted! Waiting for approval.', 'success');
        showSection('walletSection');
        
        // Reset form
        document.getElementById('withdrawAddress').value = '';
        document.getElementById('withdrawAmount').value = '';
        document.getElementById('withdrawMemo').value = '';
        
    } catch (error) {
        console.error('Error submitting withdrawal:', error);
        showNotification('Error submitting withdrawal', 'error');
    }
}

// Show History
async function showHistory() {
    showSection('historySection');
    await loadHistory();
}

// Load History
async function loadHistory() {
    const historyRef = window.dbRef(window.db, `history/${currentUser.id}`);
    const snapshot = await window.dbGet(historyRef);
    
    const historyTableBody = document.getElementById('historyTableBody');
    historyTableBody.innerHTML = '';
    
    if (!snapshot.exists()) {
        historyTableBody.innerHTML = '<tr><td colspan="4" style="text-align: center;">No transactions yet</td></tr>';
        return;
    }
    
    const history = Object.values(snapshot.val()).sort((a, b) => b.timestamp - a.timestamp);
    
    history.forEach(item => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${item.type.toUpperCase()}</td>
            <td>$${item.amount.toFixed(2)}</td>
            <td><span class="status-badge status-${item.status}">${item.status.toUpperCase()}</span></td>
            <td>${new Date(item.timestamp).toLocaleString()}</td>
        `;
        historyTableBody.appendChild(row);
    });
}

// Add History
async function addHistory(type, amount, status) {
    const historyRef = window.dbPush(window.dbRef(window.db, `history/${currentUser.id}`));
    await window.dbSet(historyRef, {
        type: type,
        amount: amount,
        status: status,
        timestamp: Date.now()
    });
}

// Show Activities
async function showActivities() {
    showSection('activitiesSection');
    await loadActivities();
}

// Load Activities
async function loadActivities() {
    const activitiesRef = window.dbRef(window.db, `activities/${currentUser.id}`);
    const snapshot = await window.dbGet(activitiesRef);
    
    const activitiesTableBody = document.getElementById('activitiesTableBody');
    activitiesTableBody.innerHTML = '';
    
    if (!snapshot.exists()) {
        activitiesTableBody.innerHTML = '<tr><td colspan="3" style="text-align: center;">No activities yet</td></tr>';
        return;
    }
    
    const activities = Object.values(snapshot.val()).sort((a, b) => b.timestamp - a.timestamp);
    
    activities.forEach(activity => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${activity.type}</td>
            <td>${activity.details}</td>
            <td>${new Date(activity.timestamp).toLocaleString()}</td>
        `;
        activitiesTableBody.appendChild(row);
    });
}

// Add Activity
async function addActivity(type, details) {
    const activityRef = window.dbPush(window.dbRef(window.db, `activities/${currentUser.id}`));
    await window.dbSet(activityRef, {
        type: type,
        details: details,
        timestamp: Date.now()
    });
}

// Show Referral List
async function showReferralList() {
    const referralListDiv = document.getElementById('referralList');
    const referralListRef = window.dbRef(window.db, `referralList/${currentUser.id}`);
    const snapshot = await window.dbGet(referralListRef);
    
    if (!snapshot.exists()) {
        referralListDiv.innerHTML = `
            <div class="empty-state">
                <div class="empty-icon"><i class="fas fa-users"></i></div>
                <div class="empty-text">No referrals yet</div>
            </div>
        `;
        referralListDiv.style.display = 'block';
        return;
    }
    
    const referrals = Object.values(snapshot.val());
    referralListDiv.innerHTML = '';
    
    referrals.forEach(ref => {
        const refItem = document.createElement('div');
        refItem.className = 'referral-item';
        refItem.innerHTML = `
            <img src="${ref.userPhoto}" alt="${ref.userName}" class="referral-avatar">
            <div class="referral-info">
                <div class="referral-name">${ref.userName}</div>
                <div class="referral-earnings">Earned: $${ref.totalEarnings.toFixed(2)}</div>
            </div>
        `;
        referralListDiv.appendChild(refItem);
    });
    
    referralListDiv.style.display = 'block';
}

// Copy Referral Link
function copyReferralLink() {
    const link = document.getElementById('referralLink').textContent;
    copyText(link);
}

// Share on Telegram
function shareOnTelegram() {
    const link = document.getElementById('referralLink').textContent;
    const text = `🚀 Join Exotix Trading Platform!\n\n💰 Earn $0.20 for each referral\n📈 Get 20% commission on all deposits & earnings\n\nJoin now: ${link}`;
    const url = `https://t.me/share/url?url=${encodeURIComponent(link)}&text=${encodeURIComponent(text)}`;
    window.open(url, '_blank');
}

// Share on Twitter
function shareOnTwitter() {
    const link = document.getElementById('referralLink').textContent;
    const text = `🚀 Join Exotix Trading Platform! 💰 Earn $0.20 for each referral 📈 Get 20% commission on all deposits & earnings`;
    const url = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(link)}`;
    window.open(url, '_blank');
}

// Load Tasks
async function loadTasks() {
    const tasksRef = window.dbRef(window.db, 'tasks');
    const snapshot = await window.dbGet(tasksRef);
    
    const tasksGrid = document.getElementById('tasksGrid');
    tasksGrid.innerHTML = '';
    
    if (!snapshot.exists()) {
        tasksGrid.innerHTML = `
            <div class="empty-state">
                <div class="empty-icon"><i class="fas fa-tasks"></i></div>
                <div class="empty-text">No tasks available</div>
            </div>
        `;
        return;
    }
    
    const tasks = Object.values(snapshot.val()).filter(task => task.active);
    
    // Get completed tasks
    const completedTasksRef = window.dbRef(window.db, `completedTasks/${currentUser.id}`);
    const completedSnapshot = await window.dbGet(completedTasksRef);
    const completedTasks = completedSnapshot.exists() ? Object.keys(completedSnapshot.val()) : [];
    
    tasks.forEach(task => {
        const isCompleted = completedTasks.includes(task.id);
        
        const taskCard = document.createElement('div');
        taskCard.className = 'task-card';
        taskCard.innerHTML = `
            <img src="${task.logo || 'https://via.placeholder.com/60'}" alt="${task.title}" class="task-icon">
            <div class="task-content">
                <div class="task-title">${task.title}</div>
                <div class="task-description">${task.description}</div>
                <div class="task-reward">Reward: $${task.reward}</div>
            </div>
            <button class="task-button" onclick="completeTask('${task.id}', '${task.link}')" ${isCompleted ? 'disabled' : ''}>
                ${isCompleted ? 'Completed' : 'Start'}
            </button>
        `;
        tasksGrid.appendChild(taskCard);
    });
}

// Complete Task
async function completeTask(taskId, taskLink) {
    // Open task link
    window.open(taskLink, '_blank');
    
    // Wait for user confirmation
    setTimeout(async () => {
        const confirmed = confirm('Have you completed the task?');
        if (!confirmed) return;
        
        try {
            // Get task details
            const taskRef = window.dbRef(window.db, `tasks/${taskId}`);
            const snapshot = await window.dbGet(taskRef);
            const task = snapshot.val();
            
            // Mark as completed
            const completedRef = window.dbRef(window.db, `completedTasks/${currentUser.id}/${taskId}`);
            await window.dbSet(completedRef, {
                taskId: taskId,
                completedAt: Date.now()
            });
            
            // Add reward to balance
            const newBalance = userBalance + task.reward;
            const userRef = window.dbRef(window.db, `users/${currentUser.id}`);
            await window.dbUpdate(userRef, { balance: newBalance });
            userBalance = newBalance;
            updateBalanceDisplay();
            
            // Add activity
            await addActivity('Task Completed', `Completed "${task.title}" and earned $${task.reward}`);
            
            // Send notification
            await sendTelegramNotification(
                currentUser.id,
                `✅ Task Completed!\n\n` +
                `Task: ${task.title}\n` +
                `Reward: $${task.reward}\n` +
                `New Balance: $${newBalance.toFixed(2)}`
            );
            
            showNotification(`Task completed! Earned $${task.reward}`, 'success');
            await loadTasks();
            
        } catch (error) {
            console.error('Error completing task:', error);
            showNotification('Error completing task', 'error');
        }
    }, 3000);
}

// Redeem Code
async function redeemCode() {
    const code = document.getElementById('redeemCode').value.trim().toUpperCase();
    
    if (!code || code.length !== 8) {
        showNotification('Please enter a valid 8-digit code', 'error');
        return;
    }
    
    try {
        // Check if code exists
        const codesRef = window.dbRef(window.db, 'redeemCodes');
        const snapshot = await window.dbGet(codesRef);
        
        if (!snapshot.exists()) {
            showNotification('Invalid code', 'error');
            return;
        }
        
        const codes = snapshot.val();
        const codeData = Object.values(codes).find(c => c.code === code);
        
        if (!codeData) {
            showNotification('Invalid code', 'error');
            return;
        }
        
        if (codeData.used >= codeData.maxUses) {
            showNotification('Code has been fully redeemed', 'error');
            return;
        }
        
        // Check if user already used this code
        const userCodesRef = window.dbRef(window.db, `userRedeemCodes/${currentUser.id}/${codeData.id}`);
        const userCodeSnapshot = await window.dbGet(userCodesRef);
        
        if (userCodeSnapshot.exists()) {
            showNotification('You already used this code', 'error');
            return;
        }
        
        // Calculate random reward
        const minReward = codeData.minReward || 0.10;
        const maxReward = codeData.maxReward || 1.00;
        const reward = Math.random() * (maxReward - minReward) + minReward;
        const roundedReward = Math.round(reward * 100) / 100;
        
        // Add reward to balance
        const newBalance = userBalance + roundedReward;
        const userRef = window.dbRef(window.db, `users/${currentUser.id}`);
        await window.dbUpdate(userRef, { balance: newBalance });
        userBalance = newBalance;
        updateBalanceDisplay();
        
        // Mark code as used
        const codeRef = window.dbRef(window.db, `redeemCodes/${codeData.id}`);
        await window.dbUpdate(codeRef, { used: codeData.used + 1 });
        
        // Mark user as used
        await window.dbSet(userCodesRef, {
            codeId: codeData.id,
            code: code,
            reward: roundedReward,
            redeemedAt: Date.now()
        });
        
        // Add activity
        await addActivity('Code Redeemed', `Redeemed code "${code}" and earned $${roundedReward.toFixed(2)}`);
        
        // Send notification
        await sendTelegramNotification(
            currentUser.id,
            `🎁 Code Redeemed!\n\n` +
            `Code: ${code}\n` +
            `Reward: $${roundedReward.toFixed(2)}\n` +
            `New Balance: $${newBalance.toFixed(2)}`
        );
        
        showNotification(`Code redeemed! Earned $${roundedReward.toFixed(2)}`, 'success');
        document.getElementById('redeemCode').value = '';
        
    } catch (error) {
        console.error('Error redeeming code:', error);
        showNotification('Error redeeming code', 'error');
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
    // Listen for balance updates
    const userRef = window.dbRef(window.db, `users/${currentUser.id}`);
    window.dbOnValue(userRef, (snapshot) => {
        if (snapshot.exists()) {
            const userData = snapshot.val();
            userBalance = userData.balance || 0;
            updateBalanceDisplay();
        }
    });
    
    // Listen for new tasks
    const tasksRef = window.dbRef(window.db, 'tasks');
    window.dbOnValue(tasksRef, () => {
        if (document.getElementById('tasksSection').classList.contains('active')) {
            loadTasks();
        }
    });
}

// Update Balance Display
function updateBalanceDisplay() {
    document.getElementById('balanceDisplay').textContent = userBalance.toFixed(2);
}

// Show Section
function showSection(sectionId) {
    // Hide all sections
    document.querySelectorAll('.section').forEach(section => {
        section.classList.remove('active');
    });
    
    // Show selected section
    document.getElementById(sectionId).classList.add('active');
    
    // Update navigation
    document.querySelectorAll('.nav-item').forEach(item => {
        item.classList.remove('active');
    });
    
    const navMap = {
        'tradeSection': 0,
        'myTradesSection': 1,
        'walletSection': 2,
        'referralsSection': 3,
        'tasksSection': 4,
        'profileSection': 5
    };
    
    if (navMap[sectionId] !== undefined) {
        document.querySelectorAll('.nav-item')[navMap[sectionId]].classList.add('active');
    }
    
    // Load section-specific data
    if (sectionId === 'tasksSection') {
        loadTasks();
    }
}

// Copy Text
function copyText(text) {
    navigator.clipboard.writeText(text).then(() => {
        showNotification('Copied to clipboard!', 'success');
    }).catch(() => {
        showNotification('Failed to copy', 'error');
    });
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

// Initialize app when DOM is loaded
document.addEventListener('DOMContentLoaded', initApp);
