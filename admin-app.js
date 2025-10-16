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

// Admin Password (Change this to your secure password)
const ADMIN_PASSWORD = 'exotix2025admin';

// Telegram Bot Configuration
const TELEGRAM_BOT_TOKEN = '8237387201:AAFI98932KS3M5uJDLaTbu27FCFOJ40wwxI';
const TELEGRAM_API_URL = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}`;

// Global State
let isLoggedIn = false;
let currentTab = 'deposits';

// Utility Functions
function notify(message, duration = 2500) {
  const notification = document.createElement('div');
  notification.className = 'notification';
  notification.textContent = message;
  document.body.appendChild(notification);
  
  setTimeout(() => {
    notification.remove();
  }, duration);
}

function now() {
  return Math.floor(Date.now() / 1000);
}

// Send Telegram Notification
async function sendTelegramNotification(telegramUserId, message) {
  try {
    const response = await fetch(`${TELEGRAM_API_URL}/sendMessage`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        chat_id: telegramUserId,
        text: message,
        parse_mode: 'HTML'
      })
    });
    
    if (response.ok) {
      console.log('Telegram notification sent successfully');
    }
  } catch (error) {
    console.error('Error sending Telegram notification:', error);
  }
}

// Login
function login() {
  const password = document.getElementById('adminPassword').value;
  
  if (password === ADMIN_PASSWORD) {
    isLoggedIn = true;
    document.getElementById('loginScreen').style.display = 'none';
    document.getElementById('adminPanel').style.display = 'block';
    loadDashboard();
    showTab('deposits');
  } else {
    notify('Invalid password!');
  }
}

// Logout
function logout() {
  isLoggedIn = false;
  document.getElementById('loginScreen').style.display = 'flex';
  document.getElementById('adminPanel').style.display = 'none';
  document.getElementById('adminPassword').value = '';
}

// Load Dashboard Stats
function loadDashboard() {
  // Total Users
  db.ref('users').once('value').then(snap => {
    document.getElementById('totalUsers').textContent = snap.numChildren();
  });
  
  // Total Deposits
  db.ref('admin/deposits').once('value').then(snap => {
    let total = 0;
    snap.forEach(child => {
      const deposit = child.val();
      if (deposit.status === 'approved') {
        total += deposit.amount;
      }
    });
    document.getElementById('totalDeposits').textContent = '$' + total.toFixed(2);
  });
  
  // Total Withdrawals
  db.ref('admin/withdrawals').once('value').then(snap => {
    let total = 0;
    snap.forEach(child => {
      const withdrawal = child.val();
      if (withdrawal.status === 'approved') {
        total += withdrawal.amount;
      }
    });
    document.getElementById('totalWithdrawals').textContent = '$' + total.toFixed(2);
  });
  
  // Active Trades
  db.ref('users').once('value').then(snap => {
    let totalTrades = 0;
    snap.forEach(child => {
      const user = child.val();
      if (user.activeTrades) {
        totalTrades += Object.keys(user.activeTrades).filter(key => 
          user.activeTrades[key].status === 'active'
        ).length;
      }
    });
    document.getElementById('activeTrades').textContent = totalTrades;
  });
}

// Show Tab
function showTab(tab) {
  currentTab = tab;
  
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.classList.remove('active');
  });
  
  event.target.classList.add('active');
  
  if (tab === 'deposits') showDeposits();
  if (tab === 'withdrawals') showWithdrawals();
  if (tab === 'users') showUsers();
  if (tab === 'trades') showTrades();
  if (tab === 'codes') showRedeemCodes();
}

// Show Deposits
function showDeposits() {
  db.ref('admin/deposits').once('value').then(snap => {
    const deposits = [];
    
    snap.forEach(child => {
      deposits.push({ id: child.key, ...child.val() });
    });
    
    deposits.sort((a, b) => b.timestamp - a.timestamp);
    
    let html = `
      <div class="content-card">
        <div class="card-title">Deposit Requests</div>
        <div class="table">
          <table>
            <thead>
              <tr>
                <th>User</th>
                <th>Amount</th>
                <th>TxHash</th>
                <th>Memo</th>
                <th>Date</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
    `;
    
    if (deposits.length === 0) {
      html += '<tr><td colspan="7" style="text-align: center; padding: 40px;">No deposits yet</td></tr>';
    } else {
      deposits.forEach(deposit => {
        const date = new Date(deposit.timestamp * 1000).toLocaleString();
        const statusClass = deposit.status === 'approved' ? 'status-approved' : 
                           (deposit.status === 'rejected' ? 'status-rejected' : 'status-pending');
        
        html += `
          <tr>
            <td>${deposit.userName}<br><small>${deposit.userId}</small></td>
            <td>$${deposit.amount.toFixed(2)}</td>
            <td><small>${deposit.txHash ? deposit.txHash.substring(0, 10) + '...' : 'N/A'}</small></td>
            <td><small>${deposit.memo}</small></td>
            <td><small>${date}</small></td>
            <td><span class="status-badge ${statusClass}">${deposit.status}</span></td>
            <td>
              ${deposit.status === 'pending' ? `
                <button class="btn-approve" onclick="approveDeposit('${deposit.id}', '${deposit.userId}', ${deposit.amount})">Approve</button>
                <button class="btn-reject" onclick="rejectDeposit('${deposit.id}', '${deposit.userId}')">Reject</button>
              ` : '-'}
            </td>
          </tr>
        `;
      });
    }
    
    html += `
            </tbody>
          </table>
        </div>
      </div>
    `;
    
    document.getElementById('tabContent').innerHTML = html;
  });
}

// Approve Deposit
window.approveDeposit = function(depositId, userId, amount) {
  if (!confirm(`Approve deposit of $${amount} for user ${userId}?`)) return;
  
  db.ref('admin/deposits/' + depositId).update({
    status: 'approved',
    approvedAt: now()
  });
  
  db.ref('users/' + userId + '/walletBalance').transaction((currentBalance) => {
    return (currentBalance || 0) + amount;
  }).then(() => {
    notify('Deposit approved successfully!');
    sendTelegramNotification(userId, `✅ Your deposit of $${amount} USDT has been approved and added to your wallet!`);
    showDeposits();
    loadDashboard();
  });
};

// Reject Deposit
window.rejectDeposit = function(depositId, userId) {
  if (!confirm('Reject this deposit?')) return;
  
  db.ref('admin/deposits/' + depositId).update({
    status: 'rejected',
    rejectedAt: now()
  }).then(() => {
    notify('Deposit rejected!');
    sendTelegramNotification(userId, '❌ Your deposit request has been rejected. Please contact support for more information.');
    showDeposits();
  });
};

// Show Withdrawals
function showWithdrawals() {
  db.ref('admin/withdrawals').once('value').then(snap => {
    const withdrawals = [];
    
    snap.forEach(child => {
      withdrawals.push({ id: child.key, ...child.val() });
    });
    
    withdrawals.sort((a, b) => b.timestamp - a.timestamp);
    
    let html = `
      <div class="content-card">
        <div class="card-title">Withdrawal Requests</div>
        <div class="table">
          <table>
            <thead>
              <tr>
                <th>User</th>
                <th>Amount</th>
                <th>Address</th>
                <th>Memo</th>
                <th>Date</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
    `;
    
    if (withdrawals.length === 0) {
      html += '<tr><td colspan="7" style="text-align: center; padding: 40px;">No withdrawals yet</td></tr>';
    } else {
      withdrawals.forEach(withdrawal => {
        const date = new Date(withdrawal.timestamp * 1000).toLocaleString();
        const statusClass = withdrawal.status === 'approved' ? 'status-approved' : 
                           (withdrawal.status === 'rejected' ? 'status-rejected' : 'status-pending');
        
        html += `
          <tr>
            <td>${withdrawal.userName}<br><small>${withdrawal.userId}</small></td>
            <td>$${withdrawal.amount.toFixed(2)}</td>
            <td><small>${withdrawal.address ? withdrawal.address.substring(0, 10) + '...' : 'N/A'}</small></td>
            <td><small>${withdrawal.memo || 'N/A'}</small></td>
            <td><small>${date}</small></td>
            <td><span class="status-badge ${statusClass}">${withdrawal.status}</span></td>
            <td>
              ${withdrawal.status === 'pending' ? `
                <button class="btn-approve" onclick="approveWithdrawal('${withdrawal.id}', '${withdrawal.userId}', ${withdrawal.amount})">Approve</button>
                <button class="btn-reject" onclick="rejectWithdrawal('${withdrawal.id}', '${withdrawal.userId}', ${withdrawal.amount})">Reject</button>
              ` : '-'}
            </td>
          </tr>
        `;
      });
    }
    
    html += `
            </tbody>
          </table>
        </div>
      </div>
    `;
    
    document.getElementById('tabContent').innerHTML = html;
  });
}

// Approve Withdrawal
window.approveWithdrawal = function(withdrawalId, userId, amount) {
  if (!confirm(`Approve withdrawal of $${amount} for user ${userId}?`)) return;
  
  db.ref('users/' + userId + '/walletBalance').once('value').then(snap => {
    const currentBalance = snap.val() || 0;
    
    if (currentBalance < amount) {
      notify('User has insufficient balance!');
      return;
    }
    
    db.ref('admin/withdrawals/' + withdrawalId).update({
      status: 'approved',
      approvedAt: now()
    });
    
    db.ref('users/' + userId + '/walletBalance').transaction((balance) => {
      return (balance || 0) - amount;
    }).then(() => {
      notify('Withdrawal approved successfully!');
      sendTelegramNotification(userId, `✅ Your withdrawal of $${amount} USDT has been approved and processed!`);
      showWithdrawals();
      loadDashboard();
    });
  });
};

// Reject Withdrawal
window.rejectWithdrawal = function(withdrawalId, userId, amount) {
  if (!confirm('Reject this withdrawal?')) return;
  
  db.ref('admin/withdrawals/' + withdrawalId).update({
    status: 'rejected',
    rejectedAt: now()
  }).then(() => {
    notify('Withdrawal rejected!');
    sendTelegramNotification(userId, '❌ Your withdrawal request has been rejected. Please contact support for more information.');
    showWithdrawals();
  });
};

// Show Users
function showUsers() {
  db.ref('users').once('value').then(snap => {
    const users = [];
    
    snap.forEach(child => {
      users.push({ id: child.key, ...child.val() });
    });
    
    users.sort((a, b) => (b.walletBalance || 0) - (a.walletBalance || 0));
    
    let html = `
      <div class="content-card">
        <div class="card-title">All Users</div>
        <div class="table">
          <table>
            <thead>
              <tr>
                <th>User ID</th>
                <th>Name</th>
                <th>Wallet Balance</th>
                <th>SHB Balance</th>
                <th>Active Trades</th>
                <th>Referrals</th>
                <th>Joined</th>
              </tr>
            </thead>
            <tbody>
    `;
    
    users.forEach(user => {
      const joinDate = new Date(user.createdAt * 1000).toLocaleDateString();
      const activeTrades = user.activeTrades ? Object.keys(user.activeTrades).filter(key => 
        user.activeTrades[key].status === 'active'
      ).length : 0;
      
      html += `
        <tr>
          <td><small>${user.id || 'N/A'}</small></td>
          <td>${user.name || 'Unknown'}</td>
          <td>$${(user.walletBalance || 0).toFixed(2)}</td>
          <td>${user.balance || 0} SHB</td>
          <td>${activeTrades}</td>
          <td>${user.referrals || 0}</td>
          <td><small>${joinDate}</small></td>
        </tr>
      `;
    });
    
    html += `
            </tbody>
          </table>
        </div>
      </div>
    `;
    
    document.getElementById('tabContent').innerHTML = html;
  });
}

// Show Trades
function showTrades() {
  db.ref('admin/tradeHistory').once('value').then(snap => {
    const trades = [];
    
    snap.forEach(child => {
      trades.push({ id: child.key, ...child.val() });
    });
    
    trades.sort((a, b) => b.timestamp - a.timestamp);
    
    let html = `
      <div class="content-card">
        <div class="card-title">Trade History</div>
        <div class="table">
          <table>
            <thead>
              <tr>
                <th>User</th>
                <th>Action</th>
                <th>Pair</th>
                <th>Amount</th>
                <th>Date</th>
              </tr>
            </thead>
            <tbody>
    `;
    
    if (trades.length === 0) {
      html += '<tr><td colspan="5" style="text-align: center; padding: 40px;">No trades yet</td></tr>';
    } else {
      trades.forEach(trade => {
        const date = new Date(trade.timestamp * 1000).toLocaleString();
        const icon = trade.action === 'purchase' ? '🛒' : '💰';
        
        html += `
          <tr>
            <td>${trade.userName}<br><small>${trade.userId}</small></td>
            <td>${icon} ${trade.action}</td>
            <td>${trade.pair}</td>
            <td>$${trade.amount.toFixed(2)}</td>
            <td><small>${date}</small></td>
          </tr>
        `;
      });
    }
    
    html += `
            </tbody>
          </table>
        </div>
      </div>
    `;
    
    document.getElementById('tabContent').innerHTML = html;
  });
}

// Show Redeem Codes
function showRedeemCodes() {
  db.ref('redeemCodes').once('value').then(snap => {
    const codes = [];
    
    snap.forEach(child => {
      codes.push({ code: child.key, ...child.val() });
    });
    
    codes.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
    
    let html = `
      <div class="content-card">
        <div class="card-title">Generate Redeem Code</div>
        <div class="code-generator">
          <div class="form-group">
            <label class="form-label">Amount (USD)</label>
            <input type="number" class="form-input" id="codeAmount" placeholder="0.10 - 1.00" min="0.10" max="1.00" step="0.01" />
          </div>
          <div class="form-group">
            <label class="form-label">Max Uses</label>
            <input type="number" class="form-input" id="codeMaxUses" placeholder="1" min="1" value="1" />
          </div>
        </div>
        <button class="btn-generate" onclick="generateCode()">Generate Code</button>
      </div>
      
      <div class="content-card">
        <div class="card-title">Active Codes</div>
        <div class="code-list">
    `;
    
    if (codes.length === 0) {
      html += '<div style="text-align: center; padding: 40px; color: var(--text-secondary);">No codes generated yet</div>';
    } else {
      codes.forEach(code => {
        const createdDate = code.createdAt ? new Date(code.createdAt * 1000).toLocaleString() : 'N/A';
        const usedText = code.used ? `Used by ${code.usedBy}` : 'Not used';
        
        html += `
          <div class="code-item">
            <div class="code-info">
              <div class="code-value">${code.code}</div>
              <div class="code-amount">Amount: $${code.amount.toFixed(2)} | ${usedText}</div>
              <div class="code-amount"><small>Created: ${createdDate}</small></div>
            </div>
            ${!code.used ? `<button class="btn-reject" onclick="deleteCode('${code.code}')">Delete</button>` : ''}
          </div>
        `;
      });
    }
    
    html += `
        </div>
      </div>
    `;
    
    document.getElementById('tabContent').innerHTML = html;
  });
}

// Generate Code
window.generateCode = function() {
  const amount = parseFloat(document.getElementById('codeAmount').value);
  const maxUses = parseInt(document.getElementById('codeMaxUses').value) || 1;
  
  if (!amount || amount < 0.10 || amount > 1.00) {
    notify('Amount must be between $0.10 and $1.00!');
    return;
  }
  
  // Generate random 8-character code
  const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let code = '';
  for (let i = 0; i < 8; i++) {
    code += characters.charAt(Math.floor(Math.random() * characters.length));
  }
  
  const codeData = {
    code: code,
    amount: amount,
    maxUses: maxUses,
    currentUses: 0,
    used: false,
    createdAt: now()
  };
  
  db.ref('redeemCodes/' + code).set(codeData).then(() => {
    notify(`Code ${code} generated successfully!`);
    document.getElementById('codeAmount').value = '';
    document.getElementById('codeMaxUses').value = '1';
    showRedeemCodes();
  });
};

// Delete Code
window.deleteCode = function(code) {
  if (!confirm(`Delete code ${code}?`)) return;
  
  db.ref('redeemCodes/' + code).remove().then(() => {
    notify('Code deleted!');
    showRedeemCodes();
  });
};

// Auto-refresh dashboard every 30 seconds
setInterval(() => {
  if (isLoggedIn) {
    loadDashboard();
  }
}, 30000);
