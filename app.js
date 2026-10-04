// Firebase config (public web config — safe in client code by design)
  var firebaseConfig = {
    apiKey: "AIzaSyCtCTVs9uJNouoCQb7dK1eYBwdJzxxjxZs",
    authDomain: "htc-website-d19cb.firebaseapp.com",
    projectId: "htc-website-d19cb",
    storageBucket: "htc-website-d19cb.firebasestorage.app",
    messagingSenderId: "810140004160",
    appId: "1:810140004160:web:657248939f35928a1ad4a5"
  };
  firebase.initializeApp(firebaseConfig);
  var auth = firebase.auth();
  var db = firebase.firestore();

  var currentUser = null;
  var unsubscribe = null;
  var typingUnsub = null;
  var seenIds = {};
  var typingActive = false;
  var typingTimer = null;

  // status pill helpers (visual only — state still readable via connStatus)
  function setStatus(state) {
    var pill = document.getElementById('connStatus');
    var txt = document.getElementById('connText');
    pill.classList.remove('err', 'conn');
    if (state === 'error') { pill.classList.add('err'); txt.textContent = 'error'; }
    else if (state === 'connecting') { pill.classList.add('conn'); txt.textContent = 'connecting…'; }
    else { txt.textContent = 'live'; }
  }

  function showError(msg) {
    document.getElementById('authError').textContent = msg;
  }

  function signInWithGoogle() {
    showError("");
    document.getElementById('googleBtn').disabled = true;
    var provider = new firebase.auth.GoogleAuthProvider();
    auth.signInWithPopup(provider).catch(function(err) {
      document.getElementById('googleBtn').disabled = false;
      showError("Sign-in failed: " + (err.message || err.code));
    });
  }

  function signOut() {
    setTyping(false);
    clearTimeout(typingTimer);
    if (unsubscribe) { unsubscribe(); unsubscribe = null; }
    if (typingUnsub) { typingUnsub(); typingUnsub = null; }
    hideTyping();
    auth.signOut();
  }

  function addDateChip() {
    var box = document.getElementById('messages');
    var chip = document.createElement('div');
    chip.className = 'date-chip';
    chip.textContent = 'Today';
    box.appendChild(chip);
  }

  // React to auth state
  auth.onAuthStateChanged(function(user) {
    if (user) {
      currentUser = user;
      document.getElementById('joinScreen').style.display = 'none';
      document.getElementById('chatScreen').style.display = 'flex';
      document.getElementById('myName').textContent = user.displayName || user.email;
      document.getElementById('myAvatar').src = user.photoURL || '';
      document.getElementById('msgInput').disabled = false;
      document.getElementById('sendBtn').disabled = false;
      document.getElementById('messages').innerHTML = '';
      addDateChip();
      startListener();
      startTypingListener();
    } else {
      currentUser = null;
      typingActive = false;
      clearTimeout(typingTimer);
      if (unsubscribe) { unsubscribe(); unsubscribe = null; }
      if (typingUnsub) { typingUnsub(); typingUnsub = null; }
      seenIds = {};
      hideTyping();
      document.getElementById('messages').innerHTML = '';
      document.getElementById('chatScreen').style.display = 'none';
      document.getElementById('joinScreen').style.display = 'flex';
      document.getElementById('googleBtn').disabled = false;
    }
  });

  // Real-time listener — instant delivery, no polling
  function startListener() {
    if (unsubscribe) unsubscribe();
    setStatus('connecting');
    unsubscribe = db.collection("livechat_messages")
      .orderBy("createdAt", "asc")
      .limitToLast(100)
      .onSnapshot(function(snapshot) {
        setStatus('live');
        var box = document.getElementById('messages');
        snapshot.docChanges().forEach(function(change) {
          if (change.type !== "added") return;
          var id = change.doc.id;
          if (seenIds[id]) return;
          seenIds[id] = true;
          appendMessage(change.doc.data());
        });
        box.scrollTop = box.scrollHeight;
      }, function(err) {
        setStatus('error');
        console.error("Listener error:", err);
      });
  }

  // ---- Real typing indicator via Firestore ----
  function startTypingListener() {
    if (typingUnsub) typingUnsub();
    typingUnsub = db.collection("livechat_typing").onSnapshot(function(snap) {
      var names = [];
      var now = Date.now();
      snap.forEach(function(doc) {
        var d = doc.data();
        if (!d || d.typing !== true) return;
        if (currentUser && d.uid === currentUser.uid) return; // ignore self
        var ts = now;
        try { ts = d.updatedAt && d.updatedAt.toDate ? d.updatedAt.toDate().getTime() : now; } catch (e) { ts = now; }
        if (now - ts > 5000) return; // auto-expire stale entries
        if (d.name) names.push(String(d.name));
      });
      renderTyping(names);
    }, function(err) {
      console.error("Typing listener error:", err);
    });
  }

  function renderTyping(names) {
    var el = document.getElementById('typingIndicator');
    if (!names.length) { hideTyping(); return; }
    var label;
    if (names.length === 1) label = escapeHtml(names[0]) + ' is typing';
    else if (names.length === 2) label = escapeHtml(names[0]) + ' and ' + escapeHtml(names[1]) + ' are typing';
    else label = 'Several people are typing';
    el.innerHTML = '<span class="t-name">' + label + '</span><span class="t-dots"><span></span><span></span><span></span></span>';
    el.classList.add('show');
  }

  function hideTyping() {
    var el = document.getElementById('typingIndicator');
    el.classList.remove('show');
    el.innerHTML = '';
  }

  function setTyping(active) {
    if (!currentUser) return;
    typingActive = active;
    db.collection("livechat_typing").doc(currentUser.uid).set({
      uid: currentUser.uid,
      name: currentUser.displayName || currentUser.email || "Unknown",
      typing: active,
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    }, { merge: true }).catch(function(e) {
      console.error("Typing write failed:", e);
    });
  }

  function onComposerInput() {
    var has = document.getElementById('msgInput').value.trim().length > 0;
    if (has && !typingActive) setTyping(true);
    clearTimeout(typingTimer);
    if (has) {
      typingTimer = setTimeout(function() { setTyping(false); }, 2500);
    } else if (typingActive) {
      setTyping(false);
    }
  }

  function appendMessage(m) {
    var box = document.getElementById('messages');
    var div = document.createElement('div');
    var mine = currentUser && m.uid === currentUser.uid;
    div.className = 'msg' + (mine ? ' mine' : '');
    var av = m.photo ? '<img class="av" src="' + escapeAttr(m.photo) + '" alt="">' : '';
    var t = "";
    try {
      var d = m.createdAt && m.createdAt.toDate ? m.createdAt.toDate() : new Date();
      t = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch (e) {}
    div.innerHTML = av + '<div class="bubble"><div class="uname">' + escapeHtml(m.name || "Unknown") +
      '</div><div class="txt">' + escapeHtml(m.text || "") + '</div><div class="tm">' + t + '</div></div>';
    box.appendChild(div);
    while (box.children.length > 100) box.removeChild(box.firstChild);
  }

  // Send on Enter
  document.getElementById('msgInput').addEventListener('keypress', function(e) {
    if (e.key === 'Enter') sendMessage();
  });
  // Typing detection (debounced)
  document.getElementById('msgInput').addEventListener('input', onComposerInput);

  function sendMessage() {
    var input = document.getElementById('msgInput');
    var text = input.value.trim();
    if (!text || !currentUser) return;
    input.value = "";
    input.disabled = true;
    clearTimeout(typingTimer);
    setTyping(false);
    db.collection("livechat_messages").add({
      uid: currentUser.uid,
      name: currentUser.displayName || currentUser.email || "Unknown",
      photo: currentUser.photoURL || "",
      text: text.slice(0, 500),
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    }).then(function() {
      input.disabled = false;
      input.focus();
    }).catch(function(err) {
      input.disabled = false;
      console.error("Send failed:", err);
      alert("Message failed to send. Please try again.");
    });
  }

  function escapeHtml(s) {
    return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }
  function escapeAttr(s) {
    return String(s).replace(/"/g, "&quot;");
  }
