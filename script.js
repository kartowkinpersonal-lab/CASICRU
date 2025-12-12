
// CasinoRu — full client logic: users, slots, admin messages, bonus, audio, neon effects
const FRUITS = ['🍒','🍋','🍇','🍊','🍉','⭐','7️⃣','😊'];
const STORAGE = 'casinoru_users_v3';
let users = JSON.parse(localStorage.getItem(STORAGE) || '{}');
let current = null;

// init default jackpot
if(!localStorage.getItem('casinoru_jackpot')) localStorage.setItem('casinoru_jackpot','5000');
document.getElementById('jackpot').textContent = localStorage.getItem('casinoru_jackpot');

function saveUsers(){ localStorage.setItem(STORAGE, JSON.stringify(users)); }
function getUser(name){
  if(!name) return null;
  if(!users[name]) users[name] = {balance:1000,banned:false,history:[],lastBonus:0};
  return users[name];
}
function setCurrent(name){
  current = name;
  const u = getUser(name);
  document.getElementById('balance').textContent = u.balance;
  renderHistory(u);
  showMessage('Вход: ' + name);
}
function renderHistory(u){
  const el = document.getElementById('history');
  el.innerHTML = '';
  (u.history||[]).slice().reverse().forEach(it=>{
    const d = document.createElement('div'); d.textContent = it; el.appendChild(d);
  });
}

// login
document.getElementById('loginBtn').addEventListener('click', ()=>{
  const name = document.getElementById('username').value.trim();
  if(!name){ alert('Введите ник'); return; }
  const u = getUser(name);
  if(u.banned){ alert('Пользователь заблокирован'); return; }
  setCurrent(name); saveUsers();
});
document.getElementById('guestBtn').addEventListener('click', ()=>{
  const g = 'guest_' + Math.floor(Math.random()*9000+1000);
  getUser(g); setCurrent(g); saveUsers(); alert('Вошли как ' + g);
});

// quick bet
document.querySelectorAll('.quick').forEach(b=> b.addEventListener('click', ()=> document.getElementById('bet').value = b.dataset.v));

// audio elements
const spinSound = document.getElementById('spinSound');
const winSound = document.getElementById('winSound');
const tickSound = document.getElementById('tickSound');
const bgMusic = document.getElementById('bgMusic');
let musicOn = false;
document.getElementById('musicToggle').addEventListener('click', ()=>{
  musicOn = !musicOn;
  if(musicOn){ bgMusic.play(); document.getElementById('musicToggle').textContent='🔊 Музыка'; }
  else { bgMusic.pause(); bgMusic.currentTime=0; document.getElementById('musicToggle').textContent='🔈 Музыка'; }
});

// helper random
function rand(){ return FRUITS[Math.floor(Math.random()*FRUITS.length)]; }
function showMessage(t){ const m = document.getElementById('message'); m.textContent = t; setTimeout(()=>{ if(m.textContent===t) m.textContent=''; },4000); }

// spin all logic
document.getElementById('spinAllBtn').addEventListener('click', async ()=>{
  if(!current){ alert('Войдите'); return; }
  const user = getUser(current);
  if(user.banned){ alert('Заблокирован'); return; }
  const bet = Math.max(1, Math.floor(Number(document.getElementById('bet').value) || 1));
  const totalBet = bet; // one bet covers all three slots
  if(user.balance < totalBet){ alert('Недостаточно средств'); return; }

  // debit
  user.balance -= totalBet;
  user.history.push(new Date().toLocaleString() + ` Ставка ${totalBet}₽ (3 слота)`);
  saveUsers(); updateUI();

  // neon active
  document.querySelectorAll('.slotbox').forEach(el=>el.classList.add('active'));

  // play spin sound loop
  try{ spinSound.currentTime=0; spinSound.play(); }catch(e){}

  // animate reels (simultaneous, vertical feel)
  const reels = [
    ['s1r1','s1r2','s1r3'],
    ['s2r1','s2r2','s2r3'],
    ['s3r1','s3r2','s3r3']
  ];
  const finals = [
    [rand(),rand(),rand()],
    [rand(),rand(),rand()],
    [rand(),rand(),rand(),]
  ];

  // quick flicker then final drop with stagger
  const loops = 24;
  for(let t=0;t<loops;t++){
    reels.forEach(r=> r.forEach(id=> document.getElementById(id).textContent = rand() ));
    await sleep(35 + Math.floor(t*2));
  }

  // stop spinSound
  try{ spinSound.pause(); spinSound.currentTime=0; }catch(e){}

  // show finals with staggered vertical animation
  for(let i=0;i<reels.length;i++){
    const r = reels[i];
    document.getElementById(r[0]).textContent = finals[i][0];
    document.getElementById(r[1]).textContent = finals[i][1];
    document.getElementById(r[2]).textContent = finals[i][2];
    // small tick
    try{ tickSound.currentTime=0; tickSound.play(); }catch(e){}
    await sleep(220 + i*160);
  }

  // evaluate wins per slot
  let totalWin = 0;
  finals.forEach(slot => {
    let win = 0;
    if(slot[0]===slot[1] && slot[1]===slot[2]){
      if(slot[0]==='7️⃣') win = bet*50;
      else if(slot[0]==='⭐') win = bet*20;
      else win = bet*5;
    } else if(slot[0]===slot[1] || slot[1]===slot[2] || slot[0]===slot[2]){
      win = Math.floor(bet*1.5);
    }
    if(win>0){
      totalWin += win;
    }
  });

  if(totalWin>0){
    user.balance += totalWin;
    user.history.push(new Date().toLocaleString() + ` Выигрыш ${totalWin}₽`);
    try{ winSound.currentTime=0; winSound.play(); }catch(e){}
    showMessage('Вы выиграли ' + totalWin + ' ₽!');
  } else {
    user.history.push(new Date().toLocaleString() + ` Проигрыш ${totalBet}₽`);
    showMessage('Нет совпадений, попробуй ещё');
  }

  // contribute to jackpot
  let jackpot = Number(localStorage.getItem('casinoru_jackpot') || 5000);
  jackpot += Math.ceil(totalBet*0.1);
  localStorage.setItem('casinoru_jackpot', jackpot);
  document.getElementById('jackpot').textContent = jackpot;

  // remove neon
  document.querySelectorAll('.slotbox').forEach(el=>el.classList.remove('active'));

  saveUsers(); updateUI();
});

// bonus (once per hour)
document.getElementById('bonusBtn').addEventListener('click', ()=>{
  if(!current){ alert('Войдите'); return; }
  const user = getUser(current);
  const now = Date.now();
  const HOUR = 60*60*1000;
  if(user.lastBonus && now - user.lastBonus < HOUR){
    const mins = Math.ceil((HOUR - (now - user.lastBonus))/60000);
    alert('Пополнение доступно через ' + mins + ' минут');
    return;
  }
  const amount = Math.floor(Math.random()* (10000-100+1) ) + 100; // 100..10000
  user.balance += amount;
  user.lastBonus = now;
  user.history.push(new Date().toLocaleString() + ` Пополнение +${amount}₽`);
  saveUsers(); updateUI();
  showMessage('Пополнение: +' + amount + ' ₽');
});

function updateUI(){
  if(current && users[current]) document.getElementById('balance').textContent = users[current].balance;
  document.getElementById('bigjack').textContent = localStorage.getItem('casinoru_jackpot') || 5000;
  document.getElementById('smalljack').textContent = localStorage.getItem('casinoru_smalljack') || 1000;
  renderHistory(getUser(current));
}

// sleep helper
function sleep(ms){ return new Promise(res=>setTimeout(res, ms)); }

// admin message listener (admin.html can use postMessage)
window.addEventListener('message', (ev)=>{
  if(!ev.data || ev.data.origin !== 'casinoru_admin') return;
  const p = ev.data;
  // actions: addFunds, setJackpot, ban, unban, setBalance, exportUsers
  if(p.action === 'addFunds'){
    const u = getUser(p.user); u.balance += Number(p.amount||0); u.history.push(new Date().toLocaleString() + ` Админ +${p.amount}₽`); saveUsers();
  } else if(p.action === 'setJackpot'){
    localStorage.setItem('casinoru_jackpot', Number(p.amount||0)); document.getElementById('jackpot').textContent = Number(p.amount||0);
  } else if(p.action === 'banUser'){
    const u = getUser(p.user); u.banned = true; saveUsers();
  } else if(p.action === 'unbanUser'){
    const u = getUser(p.user); u.banned = false; saveUsers();
  } else if(p.action === 'setBalance'){
    const u = getUser(p.user); u.balance = Number(p.amount||0); saveUsers();
  }
  updateUI();
});

// init show
updateUI();
saveUsers();

// Expose helper for admin to read users
window._casinoru_getUsers = ()=> JSON.parse(localStorage.getItem(STORAGE) || '{}');
