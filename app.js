// Telegram WebApp Initialization
const tg = window.Telegram.WebApp;
tg.expand();
tg.ready();

// Firebase Configuration
const firebaseConfig = {
  apiKey: "AIzaSyBfR97veh6idxb81mH6N5_Gq8-CpW2D7bE",
  authDomain: "jbhigfi.firebaseapp.com",
  databaseURL: "https://jbhigfi-default-rtdb.firebaseio.com",
  projectId: "jbhigfi",
  storageBucket: "jbhigfi.firebasestorage.app",
  messagingSenderId: "736760492095",
  appId: "1:736760492095:web:47b94412495e21c561c88a",
  measurementId: "G-ZZMHC9RTVT"
};

firebase.initializeApp(firebaseConfig);
const db = firebase.database();

// Telegram Bot API
const BOT_TOKEN = '8237387201:AAFI98932KS3M5uJDLaTbu27FCFOJ40wwxI';
const TELEGRAM_API = `https://api.telegram.org/bot${BOT_TOKEN}`;

// Global State
let userId = null;
let userName = null;
let userAvatar = null;
let userData = null;
let energyTimer = null;
let incomeTimer = null;
let balanceListener = null;
let adStats = { 
  today: 0, 
  yesterday: 0, 
  thisWeek: 0, 
  thisMonth: 0, 
  lifetime: 0,
  lastAdDate: null,
  lastWeekReset: null,
  lastMonthReset: null
};
let booster = {
  energy: 1200,
  maxEnergy: 1200,
  multiTap: 1,
  incomeBooster: false,
  multiTapCount: 0,
  maxEnergyUpCount: 0
};
let coinsEarned = 0;
let adLoading = false;
let profileSections = [];
let rankingListener = null;
let referralCount = 0;
let referralListener = null;
let pendingTaskRewards = {};
let totalReferralCommission = 0;
let lastActivityTime = null;
let incomeActive = true;
let activityCheckTimer = null;
const ACTIVITY_TIMEOUT = 3 * 60 * 60;

// Wallet State
let usdtBalance = 0;
let tradingPlans = [];
let activeTrades = [];
let depositHistory = [];
let withdrawHistory = [];

// Utility Functions
function now() {
  return Math.floor(Date.now() / 1000);
}

function getToday() {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function getYesterday() {
  const date = new Date();
  date.setDate(date.getDate() - 1);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function getWeekStart() {
  const date = new Date();
  const day = date.getDay();
  const diff = date.getDate() - day + (day === 0 ? -6 : 1);
  date.setDate(diff);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function getMonthStart() {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-01`;
}

function updateLoadingProgress(text) {
  const progressEl = document.getElementById('loadingProgress');
  if (progressEl) {
    progressEl.textContent = text;
  }
}

function notify(message, duration = 2500) {
  const notification = document.createElement('div');
  notification.className = 'notification';
  notification.textContent = message;
  document.body.appendChild(notification);
  
  setTimeout(() => {
    notification.remove();
  }, duration);
}

function getTelegramUserData() {
  updateLoadingProgress('Getting Telegram user data...');
  
  const user = tg.initDataUnsafe?.user;
  
  if (user && user.id) {
    userId = user.id.toString();
    userName = user.first_name + (user.last_name ? ' ' + user.last_name : '');
    
    if (user.photo_url) {
      userAvatar = user.photo_url;
    } else {
      userAvatar = "https://github.com/akhterefti-del/Shark/blob/76091d5ce35c6707100f0269223352d0b5c1a163/Gemini_Generated_Image_ad2lr0ad2lr0ad2l.png?raw=true";
    }
    
    console.log('Telegram User ID:', userId);
    console.log('Telegram User Name:', userName);
    return true;
  }
  
  console.warn('Running outside Telegram environment - using test user');
  userId = 'test_' + Math.floor(10000 + Math.random() * 89999).toString();
  userName = 'Test User';
  userAvatar = "https://github.com/akhterefti-del/Shark/blob/76091d5ce35c6707100f0269223352d0b5c1a163/Gemini_Generated_Image_ad2lr0ad2lr0ad2l.png?raw=true";
  return true;
}

// Activity Tracking
function updateActivity() {
  lastActivityTime = now();
  
  if (userId) {
    db.ref('users/' + userId).update({
      lastActivityTime: lastActivityTime
    });
  }
  
  if (booster.incomeBooster && !incomeActive) {
    incomeActive = true;
    notify('✅ Passive income resumed! Welcome back!', 3000);
    setupIncomeBooster();
    
    const activeTab = document.querySelector('.nav-btn.active');
    if (activeTab && activeTab.dataset.tab === 'home') {
      renderHome();
    }
  }
}

function checkActivityStatus() {
  if (!booster.incomeBooster) return true;
  
  const currentTime = now();
  const timeSinceActivity = currentTime - lastActivityTime;
  
  if (timeSinceActivity >= ACTIVITY_TIMEOUT) {
    if (incomeActive) {
      incomeActive = false;
      
      if (incomeTimer) {
        clearInterval(incomeTimer);
        incomeTimer = null;
      }
      
      notify('⚠️ Passive income paused! Please be online every 3 hours.', 4000);
      
      const activeTab = document.querySelector('.nav-btn.active');
      if (activeTab && activeTab.dataset.tab === 'home') {
        renderHome();
      }
    }
    return false;
  }
  
  return true;
}

function setupActivityMonitoring() {
  document.addEventListener('click', updateActivity);
  document.addEventListener('touchstart', updateActivity);
  document.addEventListener('keydown', updateActivity);
  
  if (activityCheckTimer) clearInterval(activityCheckTimer);
  activityCheckTimer = setInterval(checkActivityStatus, 60000);
}

// Referral Commission
function awardReferralCommission(earnedAmount, type = 'ad_earning') {
  if (!userData.referredBy) {
    console.log('No referrer for this user');
    return;
  }
  
  const commission = Math.floor(earnedAmount * 0.2);
  const referrerId = userData.referredBy;
  
  console.log(`Awarding ${commission} commission to referrer ${referrerId} for ${earnedAmount} earned`);
  
  const referrerBalanceRef = db.ref('users/' + referrerId + '/usdtBalance');
  const referrerCommissionRef = db.ref('users/' + referrerId + '/referralCommissions/' + userId);
  const referrerTotalCommissionRef = db.ref('users/' + referrerId + '/totalReferralCommission');
  
  referrerBalanceRef.transaction((currentBalance) => {
    return (currentBalance || 0) + commission;
  }).then(() => {
    console.log(`Referrer balance updated successfully`);
    
    referrerCommissionRef.transaction((currentCommission) => {
      return (currentCommission || 0) + commission;
    });
    
    referrerTotalCommissionRef.transaction((totalCommission) => {
      return (totalCommission || 0) + commission;
    });
    
    db.ref('users/' + referrerId).update({
      lastUpdated: now()
    });
    
    db.ref('admin/commissionLog').push({
      referrerId: referrerId,
      referredUserId: userId,
      amount: commission,
      earnedAmount: earnedAmount,
      timestamp: now(),
      type: type
    });
    
    sendTelegramNotification(referrerId, `💰 You earned $${commission.toFixed(2)} commission from your referral!`);
  }).catch((error) => {
    console.error('Error awarding commission:', error);
  });
}

// Telegram Notifications
async function sendTelegramNotification(userId, message) {
  try {
    await fetch(`${TELEGRAM_API}/sendMessage`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        chat_id: userId,
        text: message,
        parse_mode: 'HTML'
      })
    });
  } catch (error) {
    console.error('Error sending Telegram notification:', error);
  }
}

function showReferralWelcome(referrerId) {
  return new Promise((resolve) => {
    db.ref('users/' + referrerId).once('value').then(snap => {
      if (snap.exists()) {
        const referrerData = snap.val();
        
        document.getElementById('referrerAvatar').src = referrerData.avatar || userAvatar;
        document.getElementById('referrerName').textContent = referrerData.name || 'Unknown';
        document.getElementById('referrerId').textContent = 'ID: ' + referrerId;
        
        document.getElementById('referral-welcome').style.display = 'flex';
        
        let countdown = 5;
        const countdownEl = document.getElementById('welcomeCountdown');
        
        const countdownInterval = setInterval(() => {
          countdown--;
          if (countdown > 0) {
            countdownEl.textContent = `Starting in ${countdown} seconds...`;
          } else {
            clearInterval(countdownInterval);
            document.getElementById('referral-welcome').style.display = 'none';
            resolve();
          }
        }, 1000);
      } else {
        resolve();
      }
    });
  });
}

function processReferral() {
  return new Promise((resolve) => {
    updateLoadingProgress('Processing referral...');
    
    const startParam = tg.initDataUnsafe?.start_param;
    console.log('Start Param:', startParam);
    
    if (startParam) {
      let referrerId = startParam;
      
      console.log('Referrer ID:', referrerId);
      console.log('Current User ID:', userId);
      
      if (referrerId && referrerId !== userId) {
        db.ref('users/' + userId + '/referredBy').once('value').then(snap => {
          if (!snap.exists()) {
            console.log('Processing new referral...');
            
            db.ref('users/' + referrerId).once('value').then(refSnap => {
              if (refSnap.exists()) {
                console.log('Referrer found in database');
                
                showReferralWelcome(referrerId).then(() => {
                  const referrerData = refSnap.val();
                  const signupBonus = 0.20;
                  const newBalance = (referrerData.usdtBalance || 0) + signupBonus;
                  
                  db.ref('users/' + referrerId).update({
                    usdtBalance: newBalance,
                    lastUpdated: now()
                  }).then(() => {
                    console.log('Referrer balance updated with signup bonus');
                  });
                  
                  db.ref('users/' + userId).update({
                    referredBy: referrerId,
                    referredAt: now()
                  }).then(() => {
                    console.log('Referral link saved for user');
                    
                    db.ref('admin/notifications').push({
                      type: 'new_referral',
                      referrerId: referrerId,
                      referrerName: referrerData.name || 'Unknown',
                      newUserId: userId,
                      newUserName: userName,
                      timestamp: now(),
                      reward: signupBonus
                    });
                    
                    sendTelegramNotification(referrerId, `🎉 New referral! ${userName} joined using your link. You earned $${signupBonus.toFixed(2)}!`);
                    
                    notify('Welcome! Your referrer earned $0.20!', 3000);
                    resolve();
                  });
                });
              } else {
                console.log('Referrer not found in database');
                resolve();
              }
            });
          } else {
            console.log('User was already referred by:', snap.val());
            resolve();
          }
        });
      } else {
        resolve();
      }
    } else {
      console.log('No referral parameter found');
      resolve();
    }
  });
}

function saveLastSeenData() {
  if (userData) {
    db.ref('users/' + userId).update({
      lastSeen: now(),
      lastBalance: coinsEarned,
      lastEnergy: booster.energy,
      lastActivityTime: lastActivityTime,
      usdtBalance: usdtBalance
    });
  }
}

window.addEventListener('beforeunload', saveLastSeenData);
window.addEventListener('unload', saveLastSeenData);

setInterval(saveLastSeenData, 30000);

function getOfflineTime(snap) {
  const lastSeen = snap.val() && snap.val().lastSeen;
  if (!lastSeen) return 0;
  const timeDiff = now() - lastSeen;
  return timeDiff > 0 ? timeDiff : 0;
}

function resetAdStatsIfNeeded() {
  const today = getToday();
  const weekStart = getWeekStart();
  const monthStart = getMonthStart();
  
  if (adStats.lastAdDate !== today) {
    adStats.yesterday = adStats.today;
    adStats.today = 0;
    adStats.lastAdDate = today;
  }
  
  if (adStats.lastWeekReset !== weekStart) {
    adStats.thisWeek = 0;
    adStats.lastWeekReset = weekStart;
  }
  
  if (adStats.lastMonthReset !== monthStart) {
    adStats.thisMonth = 0;
    adStats.lastMonthReset = monthStart;
  }
}

function setupReferralListener() {
  if (referralListener) {
    referralListener.off();
  }
  
  referralListener = db.ref('users')
    .orderByChild('referredBy')
    .equalTo(userId);
  
  referralListener.on('value', (snapshot) => {
    const count = snapshot.numChildren();
    referralCount = count;
    
    let totalCommission = 0;
    snapshot.forEach(child => {
      const referredUser = child.val();
      if (userData.referralCommissions && userData.referralCommissions[child.key]) {
        totalCommission += userData.referralCommissions[child.key];
      }
    });
    totalReferralCommission = totalCommission;
    
    console.log('Real-time referral count updated:', count);
    console.log('Total referral commission:', totalCommission);
  });
}

function setupBalanceListener() {
  if (balanceListener) {
    balanceListener.off();
  }
  
  balanceListener = db.ref('users/' + userId + '/balance');
  
  balanceListener.on('value', (snapshot) => {
    const newBalance = snapshot.val();
    if (newBalance !== null && newBalance !== coinsEarned) {
      console.log('Balance updated from Firebase:', newBalance);
      coinsEarned = newBalance;
      
      const balanceEl = document.getElementById('homeBalance');
      if (balanceEl) {
        balanceEl.textContent = coinsEarned;
      }
    }
  });
  
  // USDT Balance Listener
  db.ref('users/' + userId + '/usdtBalance').on('value', (snapshot) => {
    const newUsdtBalance = snapshot.val();
    if (newUsdtBalance !== null) {
      usdtBalance = newUsdtBalance;
      
      const usdtBalanceEl = document.getElementById('usdtBalanceAmount');
      if (usdtBalanceEl) {
        usdtBalanceEl.textContent = usdtBalance.toFixed(2);
      }
    }
  });
}

function getMilestoneStatus(lifetimeAds) {
  const adsInCurrentCycle = lifetimeAds % 500;
  
  return {
    milestone100: adsInCurrentCycle >= 100,
    milestone200: adsInCurrentCycle >= 200,
    milestone500: adsInCurrentCycle >= 500
  };
}

// Initialize Trading Plans
function initializeTradingPlans() {
  const plans = [
    { pair: 'BTC/USDT', price: 95000, dailyEarning: 300, duration: 30, icon: '₿' },
    { pair: 'ETH/USDT', price: 3500, dailyEarning: 200, duration: 30, icon: 'Ξ' },
    { pair: 'BNB/USDT', price: 600, dailyEarning: 150, duration: 30, icon: '🔶' },
    { pair: 'SOL/USDT', price: 180, dailyEarning: 120, duration: 30, icon: '◎' },
    { pair: 'XRP/USDT', price: 2.5, dailyEarning: 100, duration: 30, icon: '✕' },
    { pair: 'ADA/USDT', price: 1.2, dailyEarning: 90, duration: 30, icon: '₳' },
    { pair: 'DOGE/USDT', price: 0.35, dailyEarning: 80, duration: 30, icon: 'Ð' },
    { pair: 'DOT/USDT', price: 25, dailyEarning: 110, duration: 30, icon: '●' },
    { pair: 'MATIC/USDT', price: 1.8, dailyEarning: 95, duration: 30, icon: '⬡' },
    { pair: 'AVAX/USDT', price: 40, dailyEarning: 105, duration: 30, icon: '🔺' },
    { pair: 'LINK/USDT', price: 18, dailyEarning: 85, duration: 30, icon: '🔗' },
    { pair: 'UNI/USDT', price: 12, dailyEarning: 75, duration: 30, icon: '🦄' },
    { pair: 'LTC/USDT', price: 100, dailyEarning: 70, duration: 30, icon: 'Ł' },
    { pair: 'ATOM/USDT', price: 15, dailyEarning: 65, duration: 30, icon: '⚛' },
    { pair: 'TRX/USDT', price: 0.25, dailyEarning: 60, duration: 30, icon: '◬' },
    { pair: 'APT/USDT', price: 12, dailyEarning: 55, duration: 30, icon: '🅰' },
    { pair: 'ARB/USDT', price: 2.5, dailyEarning: 50, duration: 30, icon: '🔷' },
    { pair: 'OP/USDT', price: 3.5, dailyEarning: 48, duration: 30, icon: '🔴' },
    { pair: 'FIL/USDT', price: 8, dailyEarning: 45, duration: 30, icon: '📁' },
    { pair: 'SHIB/USDT', price: 0.00003, dailyEarning: 40, duration: 30, icon: '🐕' }
  ];
  
  db.ref('tradingPlans').once('value').then(snap => {
    if (!snap.exists()) {
      plans.forEach((plan, index) => {
        db.ref('tradingPlans/' + index).set(plan);
      });
    }
  });
}

function loadUserData() {
  updateLoadingProgress('Loading your data...');
  
  db.ref('users/' + userId).once('value').then(snap => {
    const offlineTime = getOfflineTime(snap);
    
    if (snap.exists()) {
      userData = snap.val();
      console.log('Existing user data loaded');
    } else {
      userData = {
        balance: 0,
        usdtBalance: 0,
        energy: 1200,
        maxEnergy: 1200,
        multiTap: 1,
        incomeBooster: false,
        multiTapCount: 0,
        maxEnergyUpCount: 0,
        ton: "",
        avatar: userAvatar,
        name: userName,
        referrals: 0,
        eject: 0,
        completedTasks: {},
        adStats: { 
          today: 0, 
          yesterday: 0, 
          thisWeek: 0, 
          thisMonth: 0, 
          lifetime: 0,
          lastAdDate: getToday(),
          lastWeekReset: getWeekStart(),
          lastMonthReset: getMonthStart()
        },
        milestones: {
          milestone100Claimed: false,
          milestone200Claimed: false,
          milestone500Claimed: false
        },
        referralCommissions: {},
        totalReferralCommission: 0,
        activeTrades: {},
        purchasedPlans: {},
        depositHistory: [],
        withdrawHistory: [],
        lastSeen: now(),
        lastBalance: 0,
        lastEnergy: 1200,
        lastActivityTime: now(),
        createdAt: now()
      };
      db.ref('users/' + userId).set(userData);
      console.log('New user created');
    }
    
    if (userData.name !== userName || userData.avatar !== userAvatar) {
      db.ref('users/' + userId).update({
        name: userName,
        avatar: userAvatar
      });
      userData.name = userName;
      userData.avatar = userAvatar;
    }
    
    let energy = userData.energy || 1200;
    const maxEnergy = userData.maxEnergy || 1200;
    const offlineEnergy = Math.min(energy + offlineTime * 0.5, maxEnergy);
    
    let balance = userData.balance || 0;
    const incomeBooster = userData.incomeBooster || false;
    
    lastActivityTime = userData.lastActivityTime || now();
    const timeSinceActivity = now() - lastActivityTime;
    
    if (incomeBooster) {
      if (timeSinceActivity < ACTIVITY_TIMEOUT) {
        const offlineIncome = Math.floor(offlineTime / 10);
        balance += offlineIncome;
        if (offlineIncome > 0) {
          notify(`Earned ${offlineIncome} SHB while offline!`);
        }
        incomeActive = true;
      } else {
        incomeActive = false;
        notify('⚠️ Passive income paused! Please be online every 3 hours.', 4000);
      }
    }
    
    userData.energy = Math.round(offlineEnergy);
    userData.balance = balance;
    coinsEarned = balance;
    usdtBalance = userData.usdtBalance || 0;
    booster.energy = userData.energy;
    booster.maxEnergy = userData.maxEnergy || 1200;
    booster.multiTap = userData.multiTap || 1;
    booster.incomeBooster = incomeBooster;
    booster.multiTapCount = userData.multiTapCount || 0;
    booster.maxEnergyUpCount = userData.maxEnergyUpCount || 0;
    
    if (userData.adStats) {
      adStats = {
        today: userData.adStats.today || 0,
        yesterday: userData.adStats.yesterday || 0,
        thisWeek: userData.adStats.thisWeek || 0,
        thisMonth: userData.adStats.thisMonth || 0,
        lifetime: userData.adStats.lifetime || 0,
        lastAdDate: userData.adStats.lastAdDate || getToday(),
        lastWeekReset: userData.adStats.lastWeekReset || getWeekStart(),
        lastMonthReset: userData.adStats.lastMonthReset || getMonthStart()
      };
    }
    
    if (!userData.milestones) {
      userData.milestones = {
        milestone100Claimed: false,
        milestone200Claimed: false,
        milestone500Claimed: false
      };
    }
    
    if (!userData.referralCommissions) {
      userData.referralCommissions = {};
    }
    if (!userData.totalReferralCommission) {
      userData.totalReferralCommission = 0;
    }
    totalReferralCommission = userData.totalReferralCommission;
    
    if (!userData.activeTrades) {
      userData.activeTrades = {};
    }
    if (!userData.purchasedPlans) {
      userData.purchasedPlans = {};
    }
    
    resetAdStatsIfNeeded();
    
    setupReferralListener();
    setupBalanceListener();
    setupActivityMonitoring();
    updateActivity();
    
    db.ref('users/' + userId).update({
      energy: userData.energy,
      balance: balance,
      usdtBalance: usdtBalance,
      lastSeen: now(),
      lastBalance: balance,
      lastEnergy: userData.energy,
      lastActivityTime: lastActivityTime,
      adStats: adStats
    });
    
    initializeTradingPlans();
    
    processReferral().then(() => {
      updateLoadingProgress('Starting app...');
      
      setTimeout(() => {
        document.getElementById('loading-screen').style.display = 'none';
        document.getElementById('app').style.display = 'block';
      }, 1000);
      
      showTab('home');
      setupIncomeBooster();
      checkActiveTrades();
    });
  });
}

function updateUserData(newData) {
  Object.assign(userData, newData);
  db.ref('users/' + userId).update(newData);
  
  if (newData.balance !== undefined) coinsEarned = newData.balance;
  if (newData.usdtBalance !== undefined) usdtBalance = newData.usdtBalance;
  if (newData.energy !== undefined) booster.energy = newData.energy;
  if (newData.maxEnergy !== undefined) booster.maxEnergy = newData.maxEnergy;
  if (newData.multiTap !== undefined) booster.multiTap = newData.multiTap;
  if (newData.incomeBooster !== undefined) booster.incomeBooster = newData.incomeBooster;
  if (newData.multiTapCount !== undefined) booster.multiTapCount = newData.multiTapCount;
  if (newData.maxEnergyUpCount !== undefined) booster.maxEnergyUpCount = newData.maxEnergyUpCount;
  if (newData.adStats !== undefined) adStats = newData.adStats;
  if (newData.referrals !== undefined) referralCount = newData.referrals;
}

function showTab(tab) {
  document.querySelectorAll('.nav-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.tab === tab);
  });
  
  if (tab === 'home') renderHome();
  if (tab === 'booster') renderBooster();
  if (tab === 'earn') renderEarn();
  if (tab === 'profile') renderProfile();
  if (tab === 'ranking') renderRanking();
}

// HOME SECTION
function renderHome() {
  const profit = booster.incomeBooster ? Math.floor(coinsEarned / 3600) : 0;
  
  let warningHTML = '';
  if (booster.incomeBooster) {
    const timeSinceActivity = now() - lastActivityTime;
    const timeRemaining = ACTIVITY_TIMEOUT - timeSinceActivity;
    
    if (!incomeActive) {
      warningHTML = `
        <div class="income-status-warning">
          <div class="income-status-icon">⚠️</div>
          <div class="income-status-title">Passive Income Paused</div>
          <div class="income-status-message">
            You've been inactive for more than 3 hours. Your passive income has been paused. 
            Tap anywhere to resume earning!
          </div>
        </div>
      `;
    } else if (timeRemaining < 1800) {
      const minutesRemaining = Math.floor(timeRemaining / 60);
      warningHTML = `
        <div class="income-status-warning">
          <div class="income-status-icon">⏰</div>
          <div class="income-status-title">Activity Required Soon</div>
          <div class="income-status-message">
            Your passive income will pause in ${minutesRemaining} minutes. Stay active to keep earning!
          </div>
        </div>
      `;
    }
  }
  
  const html = `
    <div class="home-main">
      <div class="balance-card">
        <div class="balance-label">Your Balance</div>
        <div class="balance-amount" id="homeBalance">${coinsEarned}</div>
        <div class="balance-currency">SHB</div>
      </div>
      
      ${warningHTML}
      
      <div class="coin-container">
        <div class="coin-glow"></div>
        <img src="https://github.com/akhterefti-del/Shark/blob/eec9a5de183800435c0f781a44b5da5722479f20/sharkcoin.png?raw=true" 
             class="coin-image" 
             id="coinImage" 
             alt="Shark Coin" />
        <div class="tap-indicator" id="tapIndicator">+1</div>
      </div>
      
      <div class="stats-grid">
        <div class="stat-card">
          <div class="stat-label">Energy</div>
          <div class="stat-value" id="energyValue">${Math.floor(booster.energy)}</div>
          <div class="stat-desc">/ ${booster.maxEnergy}</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">Multi-Tap</div>
          <div class="stat-value" id="multiTapValue">${booster.multiTap}</div>
          <div class="stat-desc">fingers</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">Profit</div>
          <div class="stat-value" id="profitValue">${profit}</div>
          <div class="stat-desc">per hour</div>
        </div>
      </div>
    </div>
  `;
  
  document.getElementById('main-content').innerHTML = html;
  setupCoinTapping();
  setupEnergyRecovery();
}

function setupCoinTapping() {
  const coin = document.getElementById('coinImage');
  const indicator = document.getElementById('tapIndicator');
  
  if (!coin) return;
  
  function handleTap(tapCount) {
    if (booster.energy < tapCount) {
      notify('Not enough energy!');
      indicator.textContent = 'Low Energy';
      indicator.classList.add('show');
      setTimeout(() => indicator.classList.remove('show'), 500);
      return;
    }
    
    booster.energy -= tapCount;
    coinsEarned += tapCount;
    
    updateUserData({
      balance: coinsEarned,
      energy: booster.energy
    });
    
    indicator.textContent = '+' + tapCount;
    indicator.classList.add('show');
    setTimeout(() => indicator.classList.remove('show'), 400);
    
    updateEnergyDisplay();
    document.getElementById('homeBalance').textContent = coinsEarned;
    
    updateActivity();
  }
  
  coin.addEventListener('click', (e) => {
    e.preventDefault();
    handleTap(booster.multiTap);
  });
  
  coin.addEventListener('touchstart', (e) => {
    e.preventDefault();
    const touches = e.touches.length;
    const tapCount = Math.min(touches, booster.multiTap);
    handleTap(tapCount);
  });
}

function updateEnergyDisplay() {
  const energyEl = document.getElementById('energyValue');
  if (energyEl) {
    energyEl.textContent = Math.floor(booster.energy);
  }
}

function updateStatsDisplay() {
  const multiTapEl = document.getElementById('multiTapValue');
  const profitEl = document.getElementById('profitValue');
  
  if (multiTapEl) multiTapEl.textContent = booster.multiTap;
  if (profitEl) {
    const profit = booster.incomeBooster ? Math.floor(coinsEarned / 3600) : 0;
    profitEl.textContent = profit;
  }
}

function setupEnergyRecovery() {
  if (energyTimer) clearInterval(energyTimer);
  
  energyTimer = setInterval(() => {
    if (booster.energy < booster.maxEnergy) {
      booster.energy += 0.5;
      booster.energy = Math.min(booster.energy, booster.maxEnergy);
      
      updateUserData({ energy: Math.round(booster.energy) });
      updateEnergyDisplay();
    }
  }, 1000);
}

function setupIncomeBooster() {
  if (incomeTimer) clearInterval(incomeTimer);
  
  if (booster.incomeBooster && incomeActive) {
    incomeTimer = setInterval(() => {
      if (checkActivityStatus()) {
        coinsEarned++;
        
        updateUserData({ balance: coinsEarned });
        
        const balanceEl = document.getElementById('homeBalance');
        if (balanceEl) balanceEl.textContent = coinsEarned;
        
        updateStatsDisplay();
      }
    }, 10000);
  }
}

// BOOSTER SECTION
function renderBooster() {
  const maxEnergyDisabled = (booster.maxEnergyUpCount || 0) >= 10;
  const multiTapDisabled = (booster.multiTapCount || 0) >= 3;
  const incomeDisabled = booster.incomeBooster;
  
  const html = `
    <div class="booster-main">
      <div class="section-header">
        <div class="section-title">Boosters</div>
        <div class="section-subtitle">Upgrade your earning power</div>
      </div>
      
      <div class="booster-card" style="background-image: url('https://github.com/akhterefti-del/Shark/blob/7799e462d86dda9a2cd8c175f882b9ed36892998/incomebtbt.png?raw=true');">
        <div class="booster-header">
          <div class="booster-icon">⚡</div>
          <div class="booster-info">
            <div class="booster-title">Max Energy</div>
            <div class="booster-price">10,000 SHB</div>
          </div>
        </div>
        <div class="booster-desc">
          Increase your maximum energy capacity by 500 points. More energy means more tapping power!
        </div>
        <div class="booster-progress">
          Remaining: ${10 - (booster.maxEnergyUpCount || 0)} / 10
        </div>
        <button class="btn-primary" id="buyEnergy" ${coinsEarned < 10000 || maxEnergyDisabled ? 'disabled' : ''}>
          ${maxEnergyDisabled ? 'Max Level' : 'Upgrade'}
        </button>
      </div>
      
      <div class="booster-card" style="background-image: url('https://github.com/akhterefti-del/Shark/blob/7799e462d86dda9a2cd8c175f882b9ed36892998/multitapbt.png?raw=true');">
        <div class="booster-header">
          <div class="booster-icon">👆</div>
          <div class="booster-info">
            <div class="booster-title">Multi-Tap</div>
            <div class="booster-price">15,000 SHB</div>
          </div>
        </div>
        <div class="booster-desc">
          Unlock multi-finger tapping! Each upgrade adds one more finger (up to 4 total).
        </div>
        <div class="booster-progress">
          Current: ${booster.multiTap} fingers | Remaining: ${3 - (booster.multiTapCount || 0)} / 3
        </div>
        <button class="btn-primary" id="buyMultiTap" ${coinsEarned < 15000 || multiTapDisabled ? 'disabled' : ''}>
          ${multiTapDisabled ? 'Max Level' : 'Upgrade'}
        </button>
      </div>
      
      <div class="booster-card" style="background-image: url('https://github.com/akhterefti-del/Shark/blob/7799e462d86dda9a2cd8c175f882b9ed36892998/incomebt.png?raw=true');">
        <div class="booster-header">
          <div class="booster-icon">💲</div>
          <div class="booster-info">
            <div class="booster-title">Passive Income</div>
            <div class="booster-price">100,000 SHB</div>
          </div>
        </div>
        <div class="booster-desc">
          Earn 1 SHB every 10 seconds automatically! ⚠️ Requires being online every 3 hours to keep earning.
        </div>
        <div class="booster-progress">
          ${incomeDisabled ? 'Active' : 'Not Purchased'}
        </div>
        <button class="btn-primary" id="buyIncome" ${coinsEarned < 100000 || incomeDisabled ? 'disabled' : ''}>
          ${incomeDisabled ? 'Activated' : 'Purchase'}
        </button>
      </div>
    </div>
  `;
  
  document.getElementById('main-content').innerHTML = html;
  
  document.getElementById('buyEnergy').addEventListener('click', () => {
    if (coinsEarned < 10000 || maxEnergyDisabled) {
      notify('Cannot purchase this upgrade!');
      return;
    }
    
    coinsEarned -= 10000;
    booster.maxEnergy += 500;
    booster.energy = booster.maxEnergy;
    booster.maxEnergyUpCount = (booster.maxEnergyUpCount || 0) + 1;
    
    updateUserData({
      balance: coinsEarned,
      maxEnergy: booster.maxEnergy,
      energy: booster.maxEnergy,
      maxEnergyUpCount: booster.maxEnergyUpCount
    });
    
    notify('Max energy increased by 500!');
    renderBooster();
  });
  
  document.getElementById('buyMultiTap').addEventListener('click', () => {
    if (coinsEarned < 15000 || multiTapDisabled) {
      notify('Cannot purchase this upgrade!');
      return;
    }
    
    coinsEarned -= 15000;
    const nextTap = booster.multiTap === 1 ? 2 : (booster.multiTap === 2 ? 3 : 4);
    booster.multiTap = nextTap;
    booster.multiTapCount = (booster.multiTapCount || 0) + 1;
    
    updateUserData({
      balance: coinsEarned,
      multiTap: nextTap,
      multiTapCount: booster.multiTapCount
    });
    
    notify(`Multi-tap upgraded to ${nextTap} fingers!`);
    renderBooster();
    updateStatsDisplay();
  });
  
  document.getElementById('buyIncome').addEventListener('click', () => {
    if (coinsEarned < 100000 || incomeDisabled) {
      notify('Cannot purchase this upgrade!');
      return;
    }
    
    coinsEarned -= 100000;
    booster.incomeBooster = true;
    incomeActive = true;
    
    updateUserData({
      balance: coinsEarned,
      incomeBooster: true,
      lastActivityTime: now()
    });
    
    notify('Passive income activated! Remember to be online every 3 hours!', 4000);
    setupIncomeBooster();
    renderBooster();
    updateStatsDisplay();
  });
}

// EARN SECTION (Continued in next part due to length)
function renderEarn() {
  resetAdStatsIfNeeded();
  
  const lifetimeAds = adStats.lifetime;
  const adsInCurrentCycle = lifetimeAds % 500;
  
  const milestoneStatus = getMilestoneStatus(lifetimeAds);
  const milestone100Unlocked = milestoneStatus.milestone100;
  const milestone200Unlocked = milestoneStatus.milestone200;
  const milestone500Unlocked = milestoneStatus.milestone500;
  
  const milestone100Claimed = userData.milestones?.milestone100Claimed || false;
  const milestone200Claimed = userData.milestones?.milestone200Claimed || false;
  const milestone500Claimed = userData.milestones?.milestone500Claimed || false;
  
  const html = `
    <div class="earn-main">
      <div class="section-header">
        <div class="section-title">Earn More</div>
      </div>
      
      <div class="chart-card">
        <div class="chart-title">Ad Statistics</div>
        <canvas id="adChart" width="400" height="200"></canvas>
      </div>
      
      <div class="stats-row">
        <div class="stat-box">
          <div class="stat-box-label">Today</div>
          <div class="stat-box-value">${adStats.today || 0}</div>
        </div>
        <div class="stat-box">
          <div class="stat-box-label">Yesterday</div>
          <div class="stat-box-value">${adStats.yesterday || 0}</div>
        </div>
        <div class="stat-box">
          <div class="stat-box-label">This Week</div>
          <div class="stat-box-value">${adStats.thisWeek || 0}</div>
        </div>
        <div class="stat-box">
          <div class="stat-box-label">This Month</div>
          <div class="stat-box-value">${adStats.thisMonth || 0}</div>
        </div>
      </div>
      
      <div class="ad-card">
        <div class="ad-title">Watch Advertisement</div>
        <div class="ad-reward">Earn 500 SHB per ad</div>
        <button class="btn-primary" id="showAdBtn">
          ${adLoading ? 'Loading...' : 'Watch Ad'}
        </button>
      </div>
      
      <!-- TRADING PLATFORM SECTION -->
      <div class="section-header">
        <div class="section-title">💹 Trading Platform</div>
        <div class="section-subtitle">Invest in crypto and earn daily</div>
      </div>
      
      <div class="wallet-balance-header">
        <img src="https://i.postimg.cc/kG1SJTf9/Screenshot-2025-10-09-23-39-32-878-com-ton-keeper-edit.jpg" 
             class="usdt-icon" 
             alt="USDT" />
        <div class="wallet-balance-info">
          <div class="wallet-balance-label">USDT Balance</div>
          <div class="wallet-balance-amount" id="usdtBalanceAmount">${usdtBalance.toFixed(2)}</div>
        </div>
      </div>
      
      <div style="display: flex; gap: 12px; margin-bottom: 20px;">
        <button class="btn-primary" id="showTradesBtn" style="flex: 1;">📊 Trade</button>
        <button class="btn-primary" id="showMyTradesBtn" style="flex: 1;">💼 My Trades</button>
        <button class="btn-primary" id="showWalletBtn" style="flex: 1;">💰 Wallet</button>
      </div>
      
      <div id="tradingContent"></div>
      
      <div class="milestone-card">
        <div class="milestone-title">
          <span class="milestone-icon">🏆</span>
          <span>Milestone Rewards</span>
        </div>
        
        <div class="milestone-item ${milestone100Unlocked && !milestone100Claimed ? 'unlocked' : 'locked'}">
          <div class="milestone-info">
            <div class="milestone-target">100 Ads Milestone</div>
            <div class="milestone-reward">Reward: 5,000 SHB</div>
            <div class="milestone-progress">${adsInCurrentCycle}/100 ads in current cycle</div>
          </div>
          <button class="milestone-btn ${milestone100Unlocked && !milestone100Claimed ? 'unlocked' : ''}" 
                  id="claim100" 
                  ${!milestone100Unlocked || milestone100Claimed ? 'disabled' : ''}>
            ${milestone100Claimed ? 'Claimed' : (milestone100Unlocked ? 'Claim Now!' : 'Locked')}
          </button>
        </div>
        
        <div class="milestone-item ${milestone200Unlocked && !milestone200Claimed ? 'unlocked' : 'locked'}">
          <div class="milestone-info">
            <div class="milestone-target">200 Ads Milestone</div>
            <div class="milestone-reward">Reward: 10,000 SHB</div>
            <div class="milestone-progress">${adsInCurrentCycle}/200 ads in current cycle</div>
          </div>
          <button class="milestone-btn ${milestone200Unlocked && !milestone200Claimed ? 'unlocked' : ''}" 
                  id="claim200" 
                  ${!milestone200Unlocked || milestone200Claimed ? 'disabled' : ''}>
            ${milestone200Claimed ? 'Claimed' : (milestone200Unlocked ? 'Claim Now!' : 'Locked')}
          </button>
        </div>
        
        <div class="milestone-item ${milestone500Unlocked && !milestone500Claimed ? 'unlocked' : 'locked'}">
          <div class="milestone-info">
            <div class="milestone-target">500 Ads Milestone</div>
            <div class="milestone-reward">Reward: 20,000 SHB</div>
            <div class="milestone-progress">${adsInCurrentCycle}/500 ads in current cycle</div>
          </div>
          <button class="milestone-btn ${milestone500Unlocked && !milestone500Claimed ? 'unlocked' : ''}" 
                  id="claim500" 
                  ${!milestone500Unlocked || milestone500Claimed ? 'disabled' : ''}>
            ${milestone500Claimed ? 'Claimed' : (milestone500Unlocked ? 'Claim Now!' : 'Locked')}
          </button>
        </div>
      </div>
      
      <div id="tasksList"></div>
    </div>
  `;
  
  document.getElementById('main-content').innerHTML = html;
  
  // Ad watching
  document.getElementById('showAdBtn').addEventListener('click', () => {
    if (adLoading) return;
    
    adLoading = true;
    document.getElementById('showAdBtn').textContent = 'Loading...';
    
    if (typeof show_9970324 === 'function') {
      show_9970324().then(() => {
        adLoading = false;
        document.getElementById('showAdBtn').textContent = 'Watch Ad';
        
        const adReward = 500;
        coinsEarned += adReward;
        
        awardReferralCommission(adReward);
        
        adStats.today++;
        adStats.thisWeek++;
        adStats.thisMonth++;
        adStats.lifetime++;
        adStats.lastAdDate = getToday();
        
        const newAdsInCycle = adStats.lifetime % 500;
        
        if (newAdsInCycle === 0 && adStats.lifetime > 0) {
          userData.milestones = {
            milestone100Claimed: false,
            milestone200Claimed: false,
            milestone500Claimed: false
          };
          
          notify('New milestone cycle started! All rewards reset!', 3000);
        }
        
        updateUserData({
          balance: coinsEarned,
          adStats: adStats,
          milestones: userData.milestones
        });
        
        notify('Earned 500 SHB for watching ad!');
        renderEarn();
      }).catch(() => {
        adLoading = false;
        document.getElementById('showAdBtn').textContent = 'Watch Ad';
        notify('Ad failed to load. Please try again.');
      });
    } else {
      adLoading = false;
      document.getElementById('showAdBtn').textContent = 'Watch Ad';
      notify('Ad service not available.');
    }
  });
  
  // Trading buttons
  document.getElementById('showTradesBtn').addEventListener('click', showTradingPlans);
  document.getElementById('showMyTradesBtn').addEventListener('click', showMyTrades);
  document.getElementById('showWalletBtn').addEventListener('click', showWallet);
  
  // Milestone claims
  document.getElementById('claim100').addEventListener('click', () => {
    if (milestone100Unlocked && !milestone100Claimed) {
      coinsEarned += 5000;
      userData.milestones.milestone100Claimed = true;
      updateUserData({ balance: coinsEarned, milestones: userData.milestones });
      notify('Claimed 5,000 SHB milestone reward!');
      renderEarn();
    }
  });
  
  document.getElementById('claim200').addEventListener('click', () => {
    if (milestone200Unlocked && !milestone200Claimed) {
      coinsEarned += 10000;
      userData.milestones.milestone200Claimed = true;
      updateUserData({ balance: coinsEarned, milestones: userData.milestones });
      notify('Claimed 10,000 SHB milestone reward!');
      renderEarn();
    }
  });
  
  document.getElementById('claim500').addEventListener('click', () => {
    if (milestone500Unlocked && !milestone500Claimed) {
      coinsEarned += 20000;
      userData.milestones.milestone500Claimed = true;
      updateUserData({ balance: coinsEarned, milestones: userData.milestones });
      notify('Claimed 20,000 SHB milestone reward!');
      
      setTimeout(() => {
        userData.milestones = {
          milestone100Claimed: false,
          milestone200Claimed: false,
          milestone500Claimed: false
        };
        updateUserData({ milestones: userData.milestones });
        notify('Milestone cycle completed! Starting new cycle...', 3000);
        renderEarn();
      }, 2000);
    }
  });
  
  loadTasks();
  
  setTimeout(() => {
    const ctx = document.getElementById('adChart').getContext('2d');
    new Chart(ctx, {
      type: 'bar',
      data: {
        labels: ['Today', 'Yesterday', 'This Week', 'This Month'],
        datasets: [{
          label: 'Ads Watched',
          data: [
            adStats.today || 0,
            adStats.yesterday || 0,
            adStats.thisWeek || 0,
            adStats.thisMonth || 0
          ],
          backgroundColor: [
            'rgba(79, 172, 254, 0.8)',
            'rgba(102, 126, 234, 0.8)',
            'rgba(118, 75, 162, 0.8)',
            'rgba(245, 87, 108, 0.8)'
          ],
          borderColor: [
            'rgba(79, 172, 254, 1)',
            'rgba(102, 126, 234, 1)',
            'rgba(118, 75, 162, 1)',
            'rgba(245, 87, 108, 1)'
          ],
          borderWidth: 2,
          borderRadius: 8
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: true,
        plugins: {
          legend: {
            display: false
          }
        },
        scales: {
          y: {
            beginAtZero: true,
            ticks: {
              color: 'rgba(255, 255, 255, 0.7)'
            },
            grid: {
              color: 'rgba(255, 255, 255, 0.1)'
            }
          },
          x: {
            ticks: {
              color: 'rgba(255, 255, 255, 0.7)'
            },
            grid: {
              display: false
            }
          }
        }
      }
    });
  }, 100);
}

function loadTasks() {
  db.ref('tasks').once('value').then(snap => {
    const tasks = snap.val() || {};
    let html = '';
    
    Object.keys(tasks).forEach(taskId => {
      const task = tasks[taskId];
      const completed = userData.completedTasks && userData.completedTasks[taskId];
      
      html += `
        <div class="task-card">
          <img src="${task.photo}" class="task-image" alt="${task.name}" />
          <div class="task-info">
            <div class="task-name">${task.name}</div>
            <div class="task-reward">+${task.amount} SHB</div>
          </div>
          <button class="task-btn ${completed ? 'completed' : ''}" data-task-id="${taskId}">
            ${completed ? 'Done' : 'Start'}
          </button>
        </div>
      `;
    });
    
    document.getElementById('tasksList').innerHTML = html;
    
    document.querySelectorAll('.task-btn').forEach(btn => {
      btn.addEventListener('click', function() {
        const taskId = this.dataset.taskId;
        const task = tasks[taskId];
        
        if (userData.completedTasks && userData.completedTasks[taskId]) {
          window.open(task.link, '_blank');
          return;
        }
        
        if (pendingTaskRewards[taskId]) {
          notify('Task reward is already being processed!');
          return;
        }
        
        this.disabled = true;
        this.textContent = 'Processing...';
        
        pendingTaskRewards[taskId] = true;
        
        window.open(task.link, '_blank');
        
        notify('Complete the task. Reward will be added in 10 seconds...', 3000);
        
        setTimeout(() => {
          if (userData.completedTasks && userData.completedTasks[taskId]) {
            delete pendingTaskRewards[taskId];
            return;
          }
          
          const taskAmount = parseInt(task.amount);
          coinsEarned += taskAmount;
          
          if (!userData.completedTasks) userData.completedTasks = {};
          userData.completedTasks[taskId] = true;
          
          updateUserData({
            balance: coinsEarned,
            completedTasks: userData.completedTasks
          });
          
          delete pendingTaskRewards[taskId];
          
          notify(`Earned ${task.amount} SHB!`);
          
          renderEarn();
        }, 10000);
      });
    });
  });
}

// TRADING PLATFORM FUNCTIONS
function showTradingPlans() {
  db.ref('tradingPlans').once('value').then(snap => {
    const plans = snap.val() || {};
    let html = '';
    
    Object.keys(plans).forEach(planId => {
      const plan = plans[planId];
      const isPurchased = userData.purchasedPlans && userData.purchasedPlans[planId];
      
      html += `
        <div class="trading-plan-card">
          <div class="trading-plan-header">
            <div class="trading-pair">${plan.icon} ${plan.pair}</div>
            <div class="plan-badge">Premium</div>
          </div>
          
          <div class="trading-chart-mini" id="chart-${planId}"></div>
          
          <div class="plan-details">
            <div class="plan-detail-item">
              <div class="plan-detail-label">Current Price</div>
              <div class="plan-detail-value">$${plan.price.toFixed(2)}</div>
            </div>
            <div class="plan-detail-item">
              <div class="plan-detail-label">Daily Earning</div>
              <div class="plan-detail-value">$${plan.dailyEarning}</div>
            </div>
            <div class="plan-detail-item">
              <div class="plan-detail-label">Duration</div>
              <div class="plan-detail-value">${plan.duration} Days</div>
            </div>
            <div class="plan-detail-item">
              <div class="plan-detail-label">Total Return</div>
              <div class="plan-detail-value">$${plan.dailyEarning * plan.duration}</div>
            </div>
          </div>
          
          <div class="plan-price-tag">
            <div class="plan-price-label">Investment Amount</div>
            <div class="plan-price-amount">$${plan.price.toFixed(2)}</div>
          </div>
          
          <button class="btn-buy-plan ${isPurchased ? 'purchased' : ''}" 
                  data-plan-id="${planId}" 
                  ${isPurchased ? 'disabled' : ''}>
            ${isPurchased ? '✓ Purchased' : 'Buy Plan'}
          </button>
        </div>
      `;
    });
    
    document.getElementById('tradingContent').innerHTML = html;
    
    // Initialize mini charts
    Object.keys(plans).forEach(planId => {
      initMiniChart(planId, plans[planId].pair);
    });
    
    // Buy plan buttons
    document.querySelectorAll('.btn-buy-plan').forEach(btn => {
      btn.addEventListener('click', function() {
        const planId = this.dataset.planId;
        buyTradingPlan(planId, plans[planId]);
      });
    });
  });
}

function initMiniChart(planId, pair) {
  const chartDiv = document.getElementById(`chart-${planId}`);
  if (!chartDiv) return;
  
  // Simple price simulation
  const canvas = document.createElement('canvas');
  canvas.width = chartDiv.offsetWidth;
  canvas.height = 120;
  chartDiv.appendChild(canvas);
  
  const ctx = canvas.getContext('2d');
  const data = [];
  for (let i = 0; i < 50; i++) {
    data.push(Math.random() * 100);
  }
  
  ctx.strokeStyle = '#00ff88';
  ctx.lineWidth = 2;
  ctx.beginPath();
  
  data.forEach((value, index) => {
    const x = (index / data.length) * canvas.width;
    const y = canvas.height - (value / 100) * canvas.height;
    
    if (index === 0) {
      ctx.moveTo(x, y);
    } else {
      ctx.lineTo(x, y);
    }
  });
  
  ctx.stroke();
}

function buyTradingPlan(planId, plan) {
  if (usdtBalance < plan.price) {
    notify('Insufficient USDT balance!');
    return;
  }
  
  if (userData.purchasedPlans && userData.purchasedPlans[planId]) {
    notify('You already purchased this plan!');
    return;
  }
  
  // Deduct balance
  usdtBalance -= plan.price;
  
  // Create active trade
  const tradeId = Date.now().toString();
  const trade = {
    planId: planId,
    pair: plan.pair,
    icon: plan.icon,
    investmentAmount: plan.price,
    dailyEarning: plan.dailyEarning,
    duration: plan.duration,
    startTime: now(),
    lastClaimTime: now(),
    totalEarned: 0,
    daysCompleted: 0
  };
  
  if (!userData.activeTrades) userData.activeTrades = {};
  userData.activeTrades[tradeId] = trade;
  
  if (!userData.purchasedPlans) userData.purchasedPlans = {};
  userData.purchasedPlans[planId] = true;
  
  updateUserData({
    usdtBalance: usdtBalance,
    activeTrades: userData.activeTrades,
    purchasedPlans: userData.purchasedPlans
  });
  
  // Award referral commission for deposit
  awardReferralCommission(plan.price, 'trade_purchase');
  
  // Log to admin
  db.ref('admin/tradePurchases').push({
    userId: userId,
    userName: userName,
    planId: planId,
    pair: plan.pair,
    amount: plan.price,
    timestamp: now()
  });
  
  notify(`Successfully purchased ${plan.pair} trading plan!`);
  showTradingPlans();
}

function showMyTrades() {
  if (!userData.activeTrades || Object.keys(userData.activeTrades).length === 0) {
    document.getElementById('tradingContent').innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">📊</div>
        <div class="empty-state-text">No Active Trades</div>
        <div class="empty-state-subtext">Purchase a trading plan to start earning</div>
      </div>
    `;
    return;
  }
  
  let html = '';
  
  Object.keys(userData.activeTrades).forEach(tradeId => {
    const trade = userData.activeTrades[tradeId];
    const currentTime = now();
    const timeSinceLastClaim = currentTime - trade.lastClaimTime;
    const canClaim = timeSinceLastClaim >= 86400; // 24 hours
    const timeUntilClaim = canClaim ? 0 : 86400 - timeSinceLastClaim;
    
    const hoursLeft = Math.floor(timeUntilClaim / 3600);
    const minutesLeft = Math.floor((timeUntilClaim % 3600) / 60);
    const secondsLeft = timeUntilClaim % 60;
    
    const progress = (trade.daysCompleted / trade.duration) * 100;
    
    html += `
      <div class="active-trade-card">
        <div class="trade-header">
          <div class="trade-pair-name">${trade.icon} ${trade.pair}</div>
          <div class="trade-status">Active</div>
        </div>
        
        <div class="trade-progress-bar">
          <div class="trade-progress-fill" style="width: ${progress}%"></div>
          <div class="trade-progress-text">${trade.daysCompleted} / ${trade.duration} Days</div>
        </div>
        
        <div class="trade-stats">
          <div class="trade-stat-box">
            <div class="trade-stat-label">Investment</div>
            <div class="trade-stat-value">$${trade.investmentAmount.toFixed(2)}</div>
          </div>
          <div class="trade-stat-box">
            <div class="trade-stat-label">Daily Earning</div>
            <div class="trade-stat-value">$${trade.dailyEarning}</div>
          </div>
          <div class="trade-stat-box">
            <div class="trade-stat-label">Total Earned</div>
            <div class="trade-stat-value">$${trade.totalEarned.toFixed(2)}</div>
          </div>
          <div class="trade-stat-box">
            <div class="trade-stat-label">Next Claim</div>
            <div class="trade-stat-value" id="timer-${tradeId}">
              ${canClaim ? 'Ready!' : `${hoursLeft}h ${minutesLeft}m`}
            </div>
          </div>
        </div>
        
        <button class="btn-claim-earnings" 
                data-trade-id="${tradeId}" 
                ${!canClaim ? 'disabled' : ''}>
          ${canClaim ? 'Claim $' + trade.dailyEarning : 'Claim in ' + hoursLeft + 'h ' + minutesLeft + 'm'}
        </button>
      </div>
    `;
  });
  
  document.getElementById('tradingContent').innerHTML = html;
  
  // Claim buttons
  document.querySelectorAll('.btn-claim-earnings').forEach(btn => {
    btn.addEventListener('click', function() {
      const tradeId = this.dataset.tradeId;
      claimTradeEarnings(tradeId);
    });
  });
  
  // Update timers
  setInterval(() => {
    Object.keys(userData.activeTrades).forEach(tradeId => {
      const trade = userData.activeTrades[tradeId];
      const currentTime = now();
      const timeSinceLastClaim = currentTime - trade.lastClaimTime;
      const canClaim = timeSinceLastClaim >= 86400;
      const timeUntilClaim = canClaim ? 0 : 86400 - timeSinceLastClaim;
      
      const hoursLeft = Math.floor(timeUntilClaim / 3600);
      const minutesLeft = Math.floor((timeUntilClaim % 3600) / 60);
      
      const timerEl = document.getElementById(`timer-${tradeId}`);
      if (timerEl) {
        timerEl.textContent = canClaim ? 'Ready!' : `${hoursLeft}h ${minutesLeft}m`;
      }
    });
  }, 1000);
}

function claimTradeEarnings(tradeId) {
  const trade = userData.activeTrades[tradeId];
  if (!trade) return;
  
  const currentTime = now();
  const timeSinceLastClaim = currentTime - trade.lastClaimTime;
  
  if (timeSinceLastClaim < 86400) {
    notify('You can only claim once every 24 hours!');
    return;
  }
  
  // Add earnings
  usdtBalance += trade.dailyEarning;
  trade.totalEarned += trade.dailyEarning;
  trade.daysCompleted++;
  trade.lastClaimTime = currentTime;
  
  // Check if trade is completed
  if (trade.daysCompleted >= trade.duration) {
    delete userData.activeTrades[tradeId];
    notify(`Trade completed! Total earned: $${trade.totalEarned.toFixed(2)}`);
  } else {
    userData.activeTrades[tradeId] = trade;
    notify(`Claimed $${trade.dailyEarning}! Next claim in 24 hours.`);
  }
  
  updateUserData({
    usdtBalance: usdtBalance,
    activeTrades: userData.activeTrades
  });
  
  // Award referral commission
  awardReferralCommission(trade.dailyEarning, 'trade_earning');
  
  // Log to admin
  db.ref('admin/tradeClaims').push({
    userId: userId,
    userName: userName,
    tradeId: tradeId,
    pair: trade.pair,
    amount: trade.dailyEarning,
    timestamp: now()
  });
  
  showMyTrades();
}

function checkActiveTrades() {
  if (!userData.activeTrades) return;
  
  Object.keys(userData.activeTrades).forEach(tradeId => {
    const trade = userData.activeTrades[tradeId];
    const currentTime = now();
    const timeSinceLastClaim = currentTime - trade.lastClaimTime;
    
    if (timeSinceLastClaim >= 86400) {
      sendTelegramNotification(userId, `💰 Your ${trade.pair} trade earnings are ready to claim!`);
    }
  });
}

// WALLET FUNCTIONS
function showWallet() {
  const html = `
    <div class="wallet-action-grid">
      <div class="wallet-action-btn" id="depositBtn">
        <div class="wallet-action-icon">💳</div>
        <div class="wallet-action-label">Deposit</div>
      </div>
      <div class="wallet-action-btn" id="withdrawBtn">
        <div class="wallet-action-icon">💸</div>
        <div class="wallet-action-label">Withdraw</div>
      </div>
      <div class="wallet-action-btn" id="historyBtn">
        <div class="wallet-action-icon">📜</div>
        <div class="wallet-action-label">History</div>
      </div>
      <div class="wallet-action-btn" id="activityBtn">
        <div class="wallet-action-icon">📊</div>
        <div class="wallet-action-label">Activity</div>
      </div>
    </div>
  `;
  
  document.getElementById('tradingContent').innerHTML = html;
  
  document.getElementById('depositBtn').addEventListener('click', showDepositForm);
  document.getElementById('withdrawBtn').addEventListener('click', showWithdrawForm);
  document.getElementById('historyBtn').addEventListener('click', showTransactionHistory);
  document.getElementById('activityBtn').addEventListener('click', showActivity);
}

function showDepositForm() {
  document.getElementById('depositModal').style.display = 'flex';
  
  const html = `
    <div class="transaction-form">
      <div class="form-group">
        <label class="form-label">Deposit Amount (Min: $30)</label>
        <input type="number" 
               class="form-input" 
               id="depositAmount" 
               placeholder="Enter amount in USD" 
               min="30" 
               step="0.01" />
      </div>
      <button class="btn-primary" id="confirmDepositBtn">Confirm Deposit</button>
    </div>
  `;
  
  document.getElementById('depositContent').innerHTML = html;
  
  document.getElementById('confirmDepositBtn').addEventListener('click', () => {
    const amount = parseFloat(document.getElementById('depositAmount').value);
    
    if (!amount || amount < 30) {
      notify('Minimum deposit amount is $30!');
      return;
    }
    
    showDepositDetails(amount);
  });
}

function showDepositDetails(amount) {
  const depositAddress = 'UQBWOgFgB4B8qBCo8CNjDUNAtvUSosw4v7v9gkt0GVOaNLSz';
  const memo = `ExotixDP_${userId}`;
  
  // Generate QR Code
  const qrCanvas = document.createElement('canvas');
  QRCode.toCanvas(qrCanvas, depositAddress, { width: 250 }, (error) => {
    if (error) console.error(error);
  });
  
  // Start 15-minute timer
  let timeLeft = 900; // 15 minutes in seconds
  
  const html = `
    <div class="timer-box">
      <div class="timer-label">Complete deposit within</div>
      <div class="timer-value" id="depositTimer">15:00</div>
    </div>
    
    <div class="qr-code-container">
      ${qrCanvas.outerHTML}
    </div>
    
    <div class="deposit-info-box">
      <div class="deposit-info-row">
        <div class="deposit-info-label">Amount:</div>
        <div class="deposit-info-value">
          $${amount.toFixed(2)}
          <img src="https://github.com/akhterefti-del/Shark/blob/414f316d45b382764893e66646e983d101310c2e/Gemini_Generated_Image_c5nuk1c5nuk1c5nu.png?raw=true" 
               class="copy-btn" 
               onclick="navigator.clipboard.writeText('${amount.toFixed(2)}'); notify('Amount copied!');" />
        </div>
      </div>
      <div class="deposit-info-row">
        <div class="deposit-info-label">Network:</div>
        <div class="deposit-info-value">TON</div>
      </div>
      <div class="deposit-info-row">
        <div class="deposit-info-label">Address:</div>
        <div class="deposit-info-value" style="font-size: 11px; word-break: break-all;">
          ${depositAddress}
          <img src="https://github.com/akhterefti-del/Shark/blob/414f316d45b382764893e66646e983d101310c2e/Gemini_Generated_Image_c5nuk1c5nuk1c5nu.png?raw=true" 
               class="copy-btn" 
               onclick="navigator.clipboard.writeText('${depositAddress}'); notify('Address copied!');" />
        </div>
      </div>
      <div class="deposit-info-row">
        <div class="deposit-info-label">Memo/Comment:</div>
        <div class="deposit-info-value">
          ${memo}
          <img src="https://github.com/akhterefti-del/Shark/blob/414f316d45b382764893e66646e983d101310c2e/Gemini_Generated_Image_c5nuk1c5nuk1c5nu.png?raw=true" 
               class="copy-btn" 
               onclick="navigator.clipboard.writeText('${memo}'); notify('Memo copied!');" />
        </div>
      </div>
    </div>
    
    <div class="form-group">
      <label class="form-label">Transaction Hash</label>
      <input type="text" 
             class="form-input" 
             id="txHash" 
             placeholder="Enter transaction hash after payment" />
    </div>
    
    <button class="btn-primary" id="submitDepositBtn">Submit Deposit</button>
  `;
  
  document.getElementById('depositContent').innerHTML = html;
  
  // Update timer
  const timerInterval = setInterval(() => {
    timeLeft--;
    const minutes = Math.floor(timeLeft / 60);
    const seconds = timeLeft % 60;
    
    const timerEl = document.getElementById('depositTimer');
    if (timerEl) {
      timerEl.textContent = `${minutes}:${seconds.toString().padStart(2, '0')}`;
    }
    
    if (timeLeft <= 0) {
      clearInterval(timerInterval);
      notify('Deposit time expired. Please start a new deposit.');
      document.getElementById('depositModal').style.display = 'none';
    }
  }, 1000);
  
  document.getElementById('submitDepositBtn').addEventListener('click', () => {
    const txHash = document.getElementById('txHash').value.trim();
    
    if (!txHash) {
      notify('Please enter transaction hash!');
      return;
    }
    
    // Submit deposit request
    const depositRequest = {
      userId: userId,
      userName: userName,
      amount: amount,
      address: depositAddress,
      memo: memo,
      txHash: txHash,
      status: 'pending',
      timestamp: now()
    };
    
    db.ref('admin/depositRequests').push(depositRequest);
    
    // Add to user's deposit history
    if (!userData.depositHistory) userData.depositHistory = [];
    userData.depositHistory.push(depositRequest);
    
    updateUserData({
      depositHistory: userData.depositHistory
    });
    
    clearInterval(timerInterval);
    notify('Deposit request submitted! Waiting for admin approval.');
    document.getElementById('depositModal').style.display = 'none';
  });
}

function showWithdrawForm() {
  document.getElementById('withdrawModal').style.display = 'flex';
  
  const html = `
    <div class="transaction-form">
      <div class="form-group">
        <label class="form-label">USDT TON Address *</label>
        <input type="text" 
               class="form-input" 
               id="withdrawAddress" 
               placeholder="Enter your USDT TON address" 
               required />
      </div>
      
      <div class="form-group">
        <label class="form-label">Amount (Min: $0.10) *</label>
        <input type="number" 
               class="form-input" 
               id="withdrawAmount" 
               placeholder="Enter amount in USD" 
               min="0.10" 
               step="0.01" 
               max="${usdtBalance}" 
               required />
      </div>
      
      <div class="form-group">
        <label class="form-label">Memo/Comment (Optional)</label>
        <input type="text" 
               class="form-input" 
               id="withdrawMemo" 
               placeholder="Enter memo if needed" />
      </div>
      
      <button class="btn-primary" id="confirmWithdrawBtn">Confirm Withdrawal</button>
    </div>
  `;
  
  document.getElementById('withdrawContent').innerHTML = html;
  
  document.getElementById('confirmWithdrawBtn').addEventListener('click', () => {
    const address = document.getElementById('withdrawAddress').value.trim();
    const amount = parseFloat(document.getElementById('withdrawAmount').value);
    const memo = document.getElementById('withdrawMemo').value.trim();
    
    if (!address) {
      notify('Please enter withdrawal address!');
      return;
    }
    
    if (!amount || amount < 0.10) {
      notify('Minimum withdrawal amount is $0.10!');
      return;
    }
    
    if (amount > usdtBalance) {
      notify('Insufficient balance!');
      return;
    }
    
    // Submit withdrawal request
    const withdrawRequest = {
      userId: userId,
      userName: userName,
      amount: amount,
      address: address,
      memo: memo,
      status: 'pending',
      timestamp: now()
    };
    
    db.ref('admin/withdrawRequests').push(withdrawRequest);
    
    // Add to user's withdraw history
    if (!userData.withdrawHistory) userData.withdrawHistory = [];
    userData.withdrawHistory.push(withdrawRequest);
    
    updateUserData({
      withdrawHistory: userData.withdrawHistory
    });
    
    notify('Withdrawal request submitted! Waiting for admin approval.');
    document.getElementById('withdrawModal').style.display = 'none';
  });
}

function showTransactionHistory() {
  let html = '<div class="section-header"><div class="section-title">Transaction History</div></div>';
  
  const allTransactions = [];
  
  if (userData.depositHistory) {
    userData.depositHistory.forEach(tx => {
      allTransactions.push({ ...tx, type: 'Deposit' });
    });
  }
  
  if (userData.withdrawHistory) {
    userData.withdrawHistory.forEach(tx => {
      allTransactions.push({ ...tx, type: 'Withdrawal' });
    });
  }
  
  allTransactions.sort((a, b) => b.timestamp - a.timestamp);
  
  if (allTransactions.length === 0) {
    html += `
      <div class="empty-state">
        <div class="empty-state-icon">📜</div>
        <div class="empty-state-text">No Transaction History</div>
        <div class="empty-state-subtext">Your deposits and withdrawals will appear here</div>
      </div>
    `;
  } else {
    allTransactions.forEach(tx => {
      const date = new Date(tx.timestamp * 1000).toLocaleString();
      
      html += `
        <div class="history-card">
          <div class="history-header">
            <div class="history-type">${tx.type}</div>
            <div class="history-status ${tx.status}">${tx.status.toUpperCase()}</div>
          </div>
          <div class="history-details">
            <div class="history-detail-item">
              <span class="history-detail-label">Amount:</span>
              <span class="history-detail-value">$${tx.amount.toFixed(2)}</span>
            </div>
            <div class="history-detail-item">
              <span class="history-detail-label">Date:</span>
              <span class="history-detail-value">${date}</span>
            </div>
            ${tx.address ? `
              <div class="history-detail-item" style="grid-column: 1 / -1;">
                <span class="history-detail-label">Address:</span>
                <span class="history-detail-value" style="font-size: 10px; word-break: break-all;">${tx.address}</span>
              </div>
            ` : ''}
          </div>
        </div>
      `;
    });
  }
  
  document.getElementById('tradingContent').innerHTML = html;
}

function showActivity() {
  let html = '<div class="section-header"><div class="section-title">Account Activity</div></div>';
  
  // Get all activities
  const activities = [];
  
  if (userData.activeTrades) {
    Object.keys(userData.activeTrades).forEach(tradeId => {
      const trade = userData.activeTrades[tradeId];
      activities.push({
        type: 'Trade Purchase',
        description: `Purchased ${trade.pair} trading plan`,
        amount: trade.investmentAmount,
        timestamp: trade.startTime
      });
    });
  }
  
  activities.sort((a, b) => b.timestamp - a.timestamp);
  
  if (activities.length === 0) {
    html += `
      <div class="empty-state">
        <div class="empty-state-icon">📊</div>
        <div class="empty-state-text">No Activity Yet</div>
        <div class="empty-state-subtext">Your account activities will appear here</div>
      </div>
    `;
  } else {
    activities.forEach(activity => {
      const date = new Date(activity.timestamp * 1000).toLocaleString();
      
      html += `
        <div class="history-card">
          <div class="history-header">
            <div class="history-type">${activity.type}</div>
          </div>
          <div class="history-details">
            <div class="history-detail-item" style="grid-column: 1 / -1;">
              <span class="history-detail-value">${activity.description}</span>
            </div>
            <div class="history-detail-item">
              <span class="history-detail-label">Amount:</span>
              <span class="history-detail-value">$${activity.amount.toFixed(2)}</span>
            </div>
            <div class="history-detail-item">
              <span class="history-detail-label">Date:</span>
              <span class="history-detail-value">${date}</span>
            </div>
          </div>
        </div>
      `;
    });
  }
  
  document.getElementById('tradingContent').innerHTML = html;
}

// PROFILE SECTION
function renderProfile() {
  loadProfileSections().then(() => {
    let sectionsHTML = '';
    profileSections.forEach(section => {
      sectionsHTML += `
        <div class="section-link-card" onclick="window.open('${section.link}', '_blank')">
          <img src="${section.image}" class="section-link-image" alt="${section.name}" />
          <div class="section-link-title">${section.name}</div>
        </div>
      `;
    });
    
    const signupBonus = referralCount * 0.20;
    const totalEarnings = signupBonus + totalReferralCommission;
    
    const html = `
      <div class="profile-main">
        <div class="profile-header">
          <div class="avatar-container">
            <div class="avatar-glow"></div>
            <img src="${userData.avatar}" class="avatar-image" alt="Avatar" />
          </div>
          <div class="user-info-box">
            <div class="user-name">${userData.name}</div>
            <div class="user-id-row">
              <span class="user-id-label">ID:</span>
              <span class="user-id-value">${userId}</span>
              <img src="https://github.com/akhterefti-del/Shark/blob/414f316d45b382764893e66646e983d101310c2e/Gemini_Generated_Image_c5nuk1c5nuk1c5nu.png?raw=true" 
                   class="copy-icon" 
                   id="copyUserId" 
                   alt="Copy" />
            </div>
          </div>
        </div>
        
        <!-- Referral Section -->
        <div class="profile-card">
          <div class="card-title">🎁 Referral Program</div>
          
          <div class="referral-rules-card">
            <div class="referral-rule-item">
              <div class="referral-rule-icon">💰</div>
              <div class="referral-rule-text">Earn $0.20 for each friend who joins using your link</div>
            </div>
            <div class="referral-rule-item">
              <div class="referral-rule-icon">📈</div>
              <div class="referral-rule-text">Get 20% commission on all your referrals' deposits and trades</div>
            </div>
            <div class="referral-rule-item">
              <div class="referral-rule-icon">🔄</div>
              <div class="referral-rule-text">Commissions are added to your USDT balance in real-time</div>
            </div>
          </div>
          
          <div class="referral-link-box">
            <span class="referral-link-text" id="referralLink">http://t.me/SharkBountybot/myapp?startapp=${userId}</span>
            <img src="https://github.com/akhterefti-del/Shark/blob/414f316d45b382764893e66646e983d101310c2e/Gemini_Generated_Image_c5nuk1c5nuk1c5nu.png?raw=true" 
                 class="copy-btn" 
                 id="copyReferralLink" 
                 alt="Copy" />
          </div>
          
          <div class="referral-stats-grid">
            <div class="referral-stat-card">
              <div class="referral-stat-label">Total Referrals</div>
              <div class="referral-stat-value">${referralCount}</div>
            </div>
            <div class="referral-stat-card">
              <div class="referral-stat-label">Total Earnings</div>
              <div class="referral-stat-value">$${totalEarnings.toFixed(2)}</div>
            </div>
          </div>
          
          <button class="btn-primary" id="viewReferralsBtn" style="margin-bottom: 12px;">
            👥 Show My Referrals
          </button>
          
          <button class="btn-share-telegram" id="shareTelegramBtn">
            <span>✈️</span>
            <span>Share on Telegram</span>
          </button>
        </div>
        
        ${sectionsHTML}
        
        <div class="profile-card">
          <div class="card-title">Redeem Code</div>
          <div class="redeem-form-group">
            <input type="text" 
                   class="redeem-input" 
                   id="redeemCode" 
                   placeholder="Enter 8-digit code" 
                   maxlength="8" />
            <button class="btn-secondary" id="redeemBtn">Redeem</button>
          </div>
        </div>
      </div>
    `;
    
    document.getElementById('main-content').innerHTML = html;
    
    document.getElementById('copyUserId').addEventListener('click', () => {
      navigator.clipboard.writeText(userId).then(() => {
        notify('User ID copied to clipboard!');
      });
    });
    
    document.getElementById('copyReferralLink').addEventListener('click', () => {
      const link = document.getElementById('referralLink').textContent;
      navigator.clipboard.writeText(link).then(() => {
        notify('Referral link copied to clipboard!');
      });
    });
    
    document.getElementById('viewReferralsBtn').addEventListener('click', () => {
      showReferralList();
    });
    
    document.getElementById('shareTelegramBtn').addEventListener('click', () => {
      const link = `http://t.me/SharkBountybot/myapp?startapp=${userId}`;
      const text = `Join me on Exotix and start earning! 💰\n\n🎁 Get $0.20 signup bonus\n📈 Trade crypto and earn daily\n💸 Withdraw anytime\n\nJoin now: ${link}`;
      
      const telegramUrl = `https://t.me/share/url?url=${encodeURIComponent(link)}&text=${encodeURIComponent(text)}`;
      window.open(telegramUrl, '_blank');
    });
    
    document.getElementById('redeemBtn').addEventListener('click', () => {
      const code = document.getElementById('redeemCode').value.trim().toUpperCase();
      if (code.length !== 8) {
        notify('Please enter a valid 8-digit code!');
        return;
      }
      
      db.ref('redeemCodes/' + code).once('value').then(snap => {
        if (snap.exists()) {
          const codeData = snap.val();
          const amount = codeData.amount || (Math.random() * (1.00 - 0.10) + 0.10);
          
          usdtBalance += amount;
          
          updateUserData({ usdtBalance: usdtBalance });
          db.ref('redeemCodes/' + code).remove();
          
          db.ref('admin/redeemLog').push({
            userId: userId,
            userName: userName,
            code: code,
            amount: amount,
            timestamp: now()
          });
          
          notify(`Redeemed $${amount.toFixed(2)} USDT successfully!`);
          document.getElementById('redeemCode').value = '';
        } else {
          notify('Invalid or already used code!');
        }
      });
    });
  });
}

function loadProfileSections() {
  return db.ref('profileSections').once('value').then(snap => {
    const sections = snap.val() || {};
    profileSections = [];
    
    Object.keys(sections).forEach(sectionId => {
      profileSections.push({
        id: sectionId,
        name: sections[sectionId].name,
        image: sections[sectionId].image,
        link: sections[sectionId].link
      });
    });
  });
}

function showReferralList() {
  const modal = document.getElementById('referralModal');
  const content = document.getElementById('referralListContent');
  
  db.ref('users')
    .orderByChild('referredBy')
    .equalTo(userId)
    .once('value')
    .then(snapshot => {
      if (snapshot.numChildren() === 0) {
        content.innerHTML = '<div class="empty-state"><div class="empty-state-icon">👥</div><div class="empty-state-text">No Referrals Yet</div><div class="empty-state-subtext">Share your referral link to start earning!</div></div>';
      } else {
        let html = '';
        snapshot.forEach(child => {
          const referredUser = child.val();
          const referredUserId = child.key;
          
          const commissionFromUser = userData.referralCommissions && userData.referralCommissions[referredUserId] 
            ? userData.referralCommissions[referredUserId] 
            : 0;
          
          html += `
            <div class="referral-list-card">
              <img src="${referredUser.avatar || userAvatar}" class="referral-user-avatar" alt="${referredUser.name}" />
              <div class="referral-user-info">
                <div class="referral-user-name">${referredUser.name || 'Unknown'}</div>
                <div class="referral-user-balance">Balance: ${referredUser.balance || 0} SHB</div>
                <div class="referral-commission-earned">💰 Commission: $${commissionFromUser.toFixed(2)}</div>
              </div>
            </div>
          `;
        });
        content.innerHTML = html;
      }
      
      modal.style.display = 'flex';
    });
}

// RANKING SECTION
function renderRanking() {
  const html = `
    <div class="ranking-main">
      <div class="section-header">
        <div class="section-title">Leaderboard</div>
      </div>
      
      <div class="ranking-position">
        <div class="ranking-position-label">Your Position</div>
        <div class="ranking-position-value" id="myPosition">Loading...</div>
      </div>
      
      <div id="rankingList"></div>
    </div>
  `;
  
  document.getElementById('main-content').innerHTML = html;
  
  if (rankingListener) rankingListener.off();
  
  const usersRef = db.ref('users');
  
  function updateRankingList(snap) {
    const users = [];
    
    snap.forEach(child => {
      const userData = child.val();
      users.push({
        id: child.key,
        name: userData.name || 'Unknown',
        avatar: userData.avatar || 'https://github.com/akhterefti-del/Shark/blob/76091d5ce35c6707100f0269223352d0b5c1a163/Gemini_Generated_Image_ad2lr0ad2lr0ad2l.png?raw=true',
        balance: userData.balance || 0
      });
    });
    
    users.sort((a, b) => b.balance - a.balance);
    
    const myPosition = users.findIndex(u => u.id === userId) + 1;
    const top200 = users.slice(0, 200);
    
    let html = '';
    top200.forEach((user, index) => {
      const position = index + 1;
      const isTop3 = position <= 3;
      
      html += `
        <div class="ranking-row">
          <div class="ranking-position-num ${isTop3 ? 'top3' : ''}">${position}</div>
          <img src="${user.avatar}" class="ranking-avatar" alt="${user.name}" />
          <div class="ranking-user-info">
            <div class="ranking-user-name">${user.name}</div>
            <div class="ranking-user-id">ID: ${user.id}</div>
          </div>
          <div class="ranking-balance">${user.balance} SHB</div>
        </div>
      `;
    });
    
    document.getElementById('rankingList').innerHTML = html;
    document.getElementById('myPosition').textContent = myPosition > 0 ? `#${myPosition}` : 'Unranked';
  }
  
  usersRef.on('value', updateRankingList);
  rankingListener = usersRef;
}

// NAVIGATION
document.querySelectorAll('.nav-btn').forEach(btn => {
  btn.addEventListener('click', function() {
    showTab(this.dataset.tab);
  });
});

// MODAL CLOSE BUTTONS
document.getElementById('closeReferralModal').addEventListener('click', () => {
  document.getElementById('referralModal').style.display = 'none';
});

document.getElementById('closeDepositModal').addEventListener('click', () => {
  document.getElementById('depositModal').style.display = 'none';
});

document.getElementById('closeWithdrawModal').addEventListener('click', () => {
  document.getElementById('withdrawModal').style.display = 'none';
});

document.querySelectorAll('.modal-overlay').forEach(modal => {
  modal.addEventListener('click', (e) => {
    if (e.target.classList.contains('modal-overlay')) {
      modal.style.display = 'none';
    }
  });
});

// INITIALIZE APP
if (getTelegramUserData()) {
  loadUserData();
} else {
  notify('Failed to initialize Telegram user data');
}
