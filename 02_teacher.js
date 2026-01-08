
/* =========================================================
   TEACHER DASHBOARD (chạy khi đăng nhập giáo viên)
   Lưu ý: Dữ liệu nằm trong LocalStorage của trình duyệt hiện tại.
   ========================================================= */
if(window.__TEACHER){
  const teacher = window.__TEACHER;

  const LESSON_META = [
    {id:"A1", title:"A1 — In lời chào"},
    {id:"A2", title:"A2 — Tổng 2 số"},
    {id:"A4", title:"A4 — Phân loại học lực"},
    {id:"A5", title:"A5 — Tổng 1..n"},
    {id:"A9", title:"A9 — Số nguyên tố"},
  ];

  const ASSIGN_KEY = "py10:assignments";
  const SESSION_KEY = "py10:session";

  const $ = (id)=>document.getElementById(id);
  function nowISO(){ return new Date().toISOString(); }
  function loadAssign(){
    try{ return JSON.parse(localStorage.getItem(ASSIGN_KEY) || "[]") || []; }catch{ return []; }
  }
  function saveAssign(arr){ localStorage.setItem(ASSIGN_KEY, JSON.stringify(arr)); }

  function loadJSON(key, fallback){ try{ return JSON.parse(localStorage.getItem(key)||"") || fallback; }catch{ return fallback; } }
  function progKey(sid){ return `py10:progress:${sid}`; }
  function logKey(sid){ return `py10:log:${sid}`; }

  function getStudentCode(sid, lessonId){
    return localStorage.getItem(`py10:${sid}:${lessonId}`)
        || localStorage.getItem(`py10:draft:${sid}:${lessonId}`)
        || "";
  }

  function analyzeChecklistForLesson(code, lessonId){
    const c = code || "";
    const meta = LESSON_META.find(x=>x.id===lessonId) || {title:""};
    const title = meta.title || "";
    const needInput = (lessonId !== "A1");
    const needLoop = /A5|A9/.test(lessonId);
    const needIf = /A4|A9/.test(lessonId);

    const hasInput = /input\s*\(/.test(c);
    const hasParse = /map\(|int\(|float\(|split\(/.test(c);
    const hasIf = /\bif\b/.test(c);
    const hasLoop = /\bfor\b|\bwhile\b/.test(c);
    const hasPrint = /print\s*\(/.test(c);

    const items = [
      {ok: !needInput || hasInput, title:"Đọc input"},
      {ok: !needInput || hasParse, title:"Ép kiểu/tách dữ liệu"},
      {ok: (!needIf || hasIf) && (!needLoop || hasLoop || hasIf), title:"Thuật toán (if/loop)"},
      {ok: hasPrint, title:"In kết quả"}
    ];
    const ok = items.filter(x=>x.ok).length;
    return { ok, total: items.length };
  }

  function lastActivityFromLogs(logData){
    if(!logData || !Array.isArray(logData.events) || !logData.events.length) return "";
    const t = logData.events[logData.events.length-1].t || "";
    return t;
  }

  function fmtDate(iso){
    if(!iso) return "";
    const d = new Date(iso);
    if(isNaN(d)) return String(iso);
    const dd = String(d.getDate()).padStart(2,"0");
    const mm = String(d.getMonth()+1).padStart(2,"0");
    const yyyy = d.getFullYear();
    return `${dd}/${mm}/${yyyy}`;
  }

  function initAssignUI(){
    // dropdown
    const sel = $("asLesson");
    sel.innerHTML = "";
    LESSON_META.forEach(l=>{
      const o = document.createElement("option");
      o.value = l.id;
      o.textContent = `${l.id} — ${l.title.replace(/^A\d+\s—\s/,"")}`;
      sel.appendChild(o);
    });
    // default due = +7 days
    const d = new Date(); d.setDate(d.getDate()+7);
    $("asDue").value = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;

    $("btnAssign").onclick = ()=>{
      const lessonId = $("asLesson").value;
      const due = $("asDue").value || "";
      const title = ($("asTitle").value || "").trim();
      const note = ($("asNote").value || "").trim();

      const arr = loadAssign();
      arr.unshift({
        id: "as_" + Date.now(),
        lessonId,
        title: title || ("Bài " + lessonId),
        note,
        due: due ? due : "",
        created: nowISO(),
        createdBy: teacher.id,
        target: "all",
        active: true
      });
      saveAssign(arr);
      $("asTitle").value = "";
      $("asNote").value = "";
      renderAssignList();
      refreshAll();
      alert("Đã giao bài cho cả lớp!");
    };

    $("btnTeacherLogout").onclick = ()=>{
      localStorage.removeItem(SESSION_KEY);
      location.reload();
    };
    $("btnRefreshTeacher").onclick = refreshAll;
    $("btnExportTeacherCSV").onclick = exportTeacherCSV;
  }

  function renderAssignList(){
    const box = $("asList");
    const arr = loadAssign().filter(a=>a && a.active !== false);
    box.innerHTML = "";
    if(!arr.length){
      box.innerHTML = '<span class="muted">Chưa giao bài nào.</span>';
      return;
    }
    arr.slice(0,20).forEach(a=>{
      const chip = document.createElement("div");
      chip.className = "chip";
      const due = a.due ? (" • hạn " + fmtDate(a.due)) : "";
      chip.innerHTML = `<b>${a.lessonId}</b>: ${(a.title||"")}${due} &nbsp; <button class="btn" style="padding:6px 10px; border-radius:999px; font-size:12px;">Xoá</button>`;
      chip.querySelector("button").onclick = ()=>{
        const arr2 = loadAssign();
        const ix = arr2.findIndex(x=>x.id===a.id);
        if(ix>=0) arr2[ix].active = false;
        saveAssign(arr2);
        renderAssignList();
        refreshAll();
      };
      box.appendChild(chip);
    });
  }

  function computeKPIs(assigns){
    let activeStudents = 0;
    let totalDone = 0;
    let totalNeed = 0;

    STUDENTS.forEach(st=>{
      const prog = loadJSON(progKey(st.id), {unlocked:{}, passed:{}, passCount:0});
      const hasAny = Object.keys(prog.passed||{}).length > 0;
      if(hasAny) activeStudents++;

      assigns.forEach(a=>{
        totalNeed++;
        if(prog.passed && prog.passed[a.lessonId]) totalDone++;
      });
    });

    return {
      activeStudents,
      assigns: assigns.length,
      done: totalDone,
      need: totalNeed,
      rate: totalNeed ? Math.round(totalDone*100/totalNeed) : 0
    };
  }

  function renderMonitor(){
    const assigns = loadAssign().filter(a=>a && a.active !== false).slice(0,8);
    // header
    const head = $("tbHead");
    head.innerHTML = "";
    const cols = [
      "Mã HS", "Họ tên", "Hoạt động gần nhất"
    ];
    cols.forEach(t=>{ const th=document.createElement("th"); th.textContent=t; head.appendChild(th); });
    assigns.forEach(a=>{
      const th=document.createElement("th");
      const due = a.due ? (" (hạn "+fmtDate(a.due)+")") : "";
      th.textContent = (a.lessonId + due);
      head.appendChild(th);
    });

    // body
    const body = $("tbBody");
    body.innerHTML = "";
    STUDENTS.forEach(st=>{
      const tr = document.createElement("tr");
      const prog = loadJSON(progKey(st.id), {unlocked:{}, passed:{}, passCount:0});
      const logs = loadJSON(logKey(st.id), {events:[]});
      const last = lastActivityFromLogs(logs);

      const tdId = document.createElement("td"); tdId.textContent = st.id;
      const tdName = document.createElement("td"); tdName.textContent = st.name || "";
      const tdLast = document.createElement("td"); tdLast.textContent = last ? last.replace("T"," ").replace("Z","") : "";

      tr.appendChild(tdId); tr.appendChild(tdName); tr.appendChild(tdLast);

      assigns.forEach(a=>{
        const td = document.createElement("td");
        const done = !!(prog.passed && prog.passed[a.lessonId]);
        if(done){
          td.innerHTML = '<span class="chip" style="background:rgba(34,197,94,.12);border-color:rgba(34,197,94,.28);color:#14532d;">Hoàn thành</span>';
        } else {
          const code = getStudentCode(st.id, a.lessonId);
          const ck = analyzeChecklistForLesson(code, a.lessonId);
          const pct = Math.round(ck.ok*100/ck.total);
          td.innerHTML = '<span class="chip" style="background:rgba(245,158,11,.12);border-color:rgba(245,158,11,.28);color:#7c2d12;">Chưa</span>'
                       + ` <span class="muted">(${pct}%)</span>`;
        }
        tr.appendChild(td);
      });
      body.appendChild(tr);
    });

    // KPI
    const kpi = computeKPIs(assigns);
    const kpiBox = $("kpiBox");
    kpiBox.innerHTML = "";
    const chips = [
      `Bài đang giao: <b>${kpi.assigns}</b>`,
      `HS có hoạt động: <b>${kpi.activeStudents}/${STUDENTS.length}</b>`,
      `Hoàn thành nhiệm vụ: <b>${kpi.done}/${kpi.need}</b>`,
      `Tỉ lệ hoàn thành: <b>${kpi.rate}%</b>`
    ];
    chips.forEach(t=>{ const s=document.createElement("span"); s.className="chip"; s.innerHTML=t; kpiBox.appendChild(s); });
  }

  function renderErrorStats(){
    const days = 7;
    const since = Date.now() - days*24*3600*1000;
    const counts = new Map();

    STUDENTS.forEach(st=>{
      const logs = loadJSON(logKey(st.id), {events:[]});
      (logs.events||[]).forEach(e=>{
        const t = new Date(e.t||"").getTime();
        if(!t || t < since) return;
        if(e.type === "run" && e.ok === false){
          const et = (e.errorType || "Lỗi khác").toString();
          counts.set(et, (counts.get(et)||0) + 1);
        }
      });
    });

    const arr = [...counts.entries()].sort((a,b)=>b[1]-a[1]).slice(0,10);
    const box = $("errStats");
    box.innerHTML = "";
    if(!arr.length){ box.innerHTML = '<span class="muted">Chưa có dữ liệu lỗi trong 7 ngày gần nhất.</span>'; return; }
    arr.forEach(([k,v])=>{
      const s=document.createElement("span");
      s.className="chip";
      s.innerHTML = `<b>${k}</b> • ${v} lần`;
      box.appendChild(s);
    });
  }

  
  function renderWeekly(){
    const days = 7;
    const since = Date.now() - days*24*3600*1000;

    let classPass = 0, classRun=0, classTest=0, classPoints=0;

    const body = $("tbWeekBody");
    body.innerHTML = "";

    STUDENTS.forEach(st=>{
      const logs = loadJSON(logKey(st.id), {events:[]});
      const rub = (typeof loadRubric === "function") ? loadRubric(st.id) : {};
      const grp = (typeof groupOfStudentId === "function") ? groupOfStudentId(st.id) : "";

      let run=0, test=0, hint=0, ghost=0;
      let lastTs = 0;
      const passLessons = new Set();
      const attemptedLessons = new Set();

      // metrics for paste & rubric avg
      let pasteSum=0, pasteN=0, pasteMax=0;
      let rubricSum=0, rubricN=0;
      let pasteWarn = false;

      (logs.events||[]).forEach(e=>{
        const t = new Date(e.t||"").getTime();
        if(!t) return;
        if(t>lastTs) lastTs = t;

        if(t > since){
          if(e.type==="run"){ run++; attemptedLessons.add(e.lesson); }
          if(e.type==="test"){
            test++; attemptedLessons.add(e.lesson);
            const pr = Number(e.pasteRatio||0);
            if(Number.isFinite(pr)){
              pasteSum += pr; pasteN += 1; pasteMax = Math.max(pasteMax, pr);
              if(pr >= 0.70) pasteWarn = true;
            }
            const rr = Number(e.rubric||0);
            if(Number.isFinite(rr) && rr>0){ rubricSum += rr; rubricN += 1; }
          }
          if(e.type==="hint") hint++;
          if(e.type==="ghost_accept") ghost++;
          if(e.type==="pass"){ passLessons.add(e.lesson); }
        }
      });

      // PASS theo bài (distinct trong 7 ngày)
      const passCount = passLessons.size;

      // Điểm 7 ngày: cộng điểm tốt nhất của các bài PASS trong 7 ngày (theo rubric store)
      let points7 = 0;
      try{
        passLessons.forEach(lessonId=>{
          const it = rub && rub[lessonId];
          if(it && it.pass && (it.ts||0) > since){
            points7 += Number(it.score||0) || 0;
          } else {
            // fallback: nếu có rubric trong log pass
            const best = (logs.events||[]).filter(e=>e.type==="pass" && e.lesson===lessonId).map(e=>Number(e.rubric||0)||0).reduce((a,b)=>Math.max(a,b),0);
            if(best>0) points7 += best;
          }
        });
      }catch{}

      // Bài đã làm: distinct bài có run/test trong 7 ngày
      const attemptedCount = attemptedLessons.size;

      const pasteAvg = pasteN ? Math.round((pasteSum/pasteN)*100) : 0;
      const rubricAvg = rubricN ? Math.round((rubricSum/rubricN)) : 0;

      // cảnh báo tổng hợp
      let warn = "";
      if(pasteWarn) warn += "Dán nhiều; ";
      if(ghost >= 5) warn += "Dùng hoàn thiện dòng nhiều; ";
      warn = warn.trim();
      if(warn.endsWith(";")) warn = warn.slice(0,-1);

      classPass += passCount; classRun += run; classTest += test; classPoints += points7;

      const tr=document.createElement("tr");
      tr.innerHTML = `
        <td>${st.id}</td>
        <td>${(st.name||"")}</td>
        <td>${st.class || ""}</td>
        <td>${grp ? ("Nhóm "+grp) : ""}</td>
        <td><b>${passCount}</b></td>
        <td><b>${points7}</b></td>
        <td>${attemptedCount}</td>
        <td>${run}</td>
        <td>${test}</td>
        <td>${pasteN ? (pasteAvg + "%") : "—"}</td>
        <td>${warn || "—"}</td>
        <td>${rubricN ? (rubricAvg + "/100") : "—"}</td>
        <td>${hint}</td>
        <td>${ghost}</td>
        <td>${lastTs ? (new Date(lastTs).toISOString().replace("T"," ").replace("Z","")) : ""}</td>
      `;
      body.appendChild(tr);
    });

    $("weekNote").innerHTML = `Tổng lớp (7 ngày): <b>${classPass}</b> bài PASS • <b>${classPoints}</b> điểm • <b>${classRun}</b> lần Run • <b>${classTest}</b> lần Test.`;
  }

  function exportTeacherCSV(){
    // Giữ nguyên nút/luồng cũ, nhưng xuất file Excel (.xls) để mở trực tiếp bằng Excel.
    const assigns = loadAssign().filter(a=>a && a.active !== false).slice(0,8);
    const header = ["student_id","student_name","last_activity", ...assigns.map(a=>a.lessonId)];
    const rows = [];

    STUDENTS.forEach(st=>{
      const prog = loadJSON(progKey(st.id), {unlocked:{}, passed:{}, passCount:0});
      const logs = loadJSON(logKey(st.id), {events:[]});
      const last = lastActivityFromLogs(logs);
      const cols = assigns.map(a=> (prog.passed && prog.passed[a.lessonId]) ? "DONE" : "NOT");
      rows.push([st.id, st.name||"", last||"", ...cols].map(x=>String(x ?? "")));
    });

    function esc(s){
      return String(s ?? "")
        .replace(/&/g,"&amp;")
        .replace(/</g,"&lt;")
        .replace(/>/g,"&gt;")
        .replace(/"/g,"&quot;");
    }
    function tr(cells, tag){
      return "<tr>" + cells.map(c=>`<${tag}>${esc(c)}</${tag}>`).join("") + "</tr>";
    }

    const sheetName = "BaoCao";
    let html = `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40"><head><meta charset="UTF-8">`;
    html += `<!--[if gte mso 9]><xml><x:ExcelWorkbook><x:ExcelWorksheets><x:ExcelWorksheet><x:Name>${esc(sheetName)}</x:Name><x:WorksheetOptions><x:DisplayGridlines/></x:WorksheetOptions></x:ExcelWorksheet></x:ExcelWorksheets></x:ExcelWorkbook></xml><![endif]-->`;
    html += `</head><body><table border="1">`;
    html += tr(header, "th");
    rows.forEach(r=>{ html += tr(r, "td"); });
    html += `</table></body></html>`;

    const blob = new Blob(["\ufeff", html], {type:"application/vnd.ms-excel;charset=utf-8"});
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "bao_cao_giao_bai.xls";
    a.click();
    setTimeout(()=>{ try{ URL.revokeObjectURL(url); }catch{} }, 1000);
  }


/* =========================================================
   PATCH V4 — Quy trình 4 bước • Bài hôm nay • So sánh Output • Thi 15' • Giao theo lớp/nhóm
   (giữ nguyên các tính năng cũ)
   ========================================================= */
(function(){
  // --------- helpers ---------
  const $ = (id)=>document.getElementById(id);
  const safeJSON = (k, fb)=>{ try{ return JSON.parse(localStorage.getItem(k)||"") || fb; }catch{ return fb; } };
  const setJSON  = (k, v)=> localStorage.setItem(k, JSON.stringify(v));
  const todayKey = ()=>{ const d=new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; };

  // --------- assignment matching (backward compatible) ---------
  window.assignmentMatchesStudent = function(a, u){
    try{
      if(!a || !u) return false;
      // legacy
      if(a.target === "all") return true;
      if(Array.isArray(a.targets) && a.targets.includes(u.id)) return true;

      // new format
      const tType = a.targetType || "";
      const tVal  = a.targetValue || a.target || "";
      const cls = u.class || u.className || "";
      const gid = (function(){
        const n = parseInt(String(u.id).replace(/\D/g,''),10);
        if(!Number.isFinite(n)) return "";
        return String(((n-1)%4)+1); // nhóm 1-4
      })();

      if(tType === "all") return true;
      if(tType === "class") return String(tVal) === String(cls);
      if(tType === "group") return String(tVal) === String(gid);
      if(tType === "student"){
        if(Array.isArray(a.targets)) return a.targets.includes(u.id);
        if(typeof tVal === "string") return tVal.split(",").map(s=>s.trim()).filter(Boolean).includes(u.id);
        return false;
      }

      // encoded legacy-like string
      if(typeof tVal === "string" && tVal.startsWith("class:")) return tVal.slice(6) === String(cls);
      if(typeof tVal === "string" && tVal.startsWith("group:")) return tVal.slice(6) === String(gid);
      return false;
    }catch{ return false; }
  };

  // --------- Daily default lesson ---------
  function pickTodayLessonId(){
    try{
      // ưu tiên bài chưa PASS gần nhất (để bám lộ trình)
      for(const l of LESSONS){
        if(isUnlocked(l.id) && !progress.passed[l.id]) return l.id;
      }
      // xoay vòng theo ngày trên các bài đã mở
      const opened = LESSONS.filter(l=>isUnlocked(l.id));
      if(!opened.length) return (LESSONS[0] && LESSONS[0].id) || "A1";
      const key = todayKey();
      let h=0; for(let i=0;i<key.length;i++) h=(h*31 + key.charCodeAt(i))>>>0;
      return opened[h % opened.length].id;
    }catch{
      return (LESSONS[0] && LESSONS[0].id) || "A1";
    }
  }

  // Patch renderStudentTodo to show "bài hôm nay" when no assignment
  const __renderStudentTodo0 = window.renderStudentTodo;
  if(typeof __renderStudentTodo0 === "function"){
    window.renderStudentTodo = function(){
      __renderStudentTodo0();
      // nếu đang ở nhánh "mặc định", đổi lời dẫn + lessonId theo ngày
      const list = $("todoList");
      const box = $("todoBox");
      if(!list || !box) return;
      const all = getAssignments().filter(a => a && a.active !== false);
      const mine = all.filter(a => assignmentMatchesStudent(a, user));
      const pending = mine.filter(a=>!isDoneForAssignment(a));
      if(pending.length) return;

      const todayId = pickTodayLessonId();
      const l = LESSONS.find(x=>x.id===todayId) || current || LESSONS[0];
      // rewrite a simple card if the old text doesn't include card button
      const hadAssigned = mine.length > 0;
      const head = hadAssigned
        ? "✅ Bạn đã hoàn thành hết bài giáo viên giao. <b>Bài luyện hôm nay:</b>"
        : "<b>Bài luyện hôm nay:</b>";
      const due = "";
      const note = "Làm theo quy trình: Đọc đề → Ý tưởng → Code → Test.";
      const card = (lessonId, title)=>`
        <div style="padding:10px 12px; border:1px solid var(--line); border-radius:14px; background: rgba(255,255,255,.78); margin-top:8px;">
          <b>${title}</b>
          <span class="pill" style="margin-left:8px;">${lessonId}</span>${due}
          <br><span class='muted' style='color:#0b3b7a'>Ghi chú: ${note}</span>
          <div style="margin-top:8px;">
            <button class="btn primary" style="padding:8px 10px; border-radius:999px; font-size:12px;"
              onclick="window.__openLesson && window.__openLesson('${lessonId}')">Làm ngay</button>
          </div>
        </div>`;
      list.innerHTML = head + card(l.id, l.title || ("Bài "+l.id));
      box.style.display = "block";
    }
  }

  // --------- Quy trình 4 bước ---------
  function flowKey(lessonId){ return `py10:flow:${user.id}:${lessonId}`; }
  function getFlow(lessonId){
    const fb = { read:false, idea:"", ideaOk:false, codeOk:false, tested:false, updatedAt:0 };
    return safeJSON(flowKey(lessonId), fb);
  }
  function setFlow(lessonId, st){ st.updatedAt = Date.now(); setJSON(flowKey(lessonId), st); }

  function applyFlowLocks(){
    const st = getFlow(current.id);
    const readBtn = $("stepRead"), ideaBtn=$("stepIdea"), codeBtn=$("stepCode"), testBtn=$("stepTest");
    const idea = $("ideaText");
    const codeEl = $("codeEditor") || $("code"); // codeEditor is CodeMirror? fallback textarea
    const btnRun = $("btnRun"), btnTest = $("btnTest");

    if(!readBtn||!ideaBtn||!codeBtn||!testBtn||!idea||!btnRun||!btnTest) return;

    // status styles
    const setDone = (btn, done)=>{ btn.classList.toggle("primary", !!done); btn.classList.toggle("ok", !!done); };
    setDone(readBtn, st.read);
    setDone(ideaBtn, st.ideaOk);
    setDone(codeBtn, st.codeOk);
    setDone(testBtn, st.tested);

    // enable chain
    ideaBtn.disabled = !st.read;
    idea.disabled = !st.read;
    if(st.read && !idea.value) idea.value = st.idea || "";
    // idea ok rule: >= 20 chars
    const ideaOkNow = (idea.value || "").trim().length >= 20;
    if(ideaOkNow && !st.ideaOk){ st.ideaOk = true; setFlow(current.id, st); }

    codeBtn.disabled = !st.ideaOk;
    // lock editor (soft lock using overlay via disabled class)
    const editorWrap = document.querySelector(".editor-wrap");
    if(editorWrap){
      editorWrap.style.opacity = st.ideaOk ? "1" : ".55";
      editorWrap.style.pointerEvents = st.ideaOk ? "auto" : "none";
    }

    testBtn.disabled = !st.codeOk;
    btnTest.disabled = !pyReady || !st.codeOk;
    btnRun.disabled  = !pyReady || (!st.ideaOk);

    // flow hint
    const hint = $("flowHint");
    if(hint){
      if(!st.read) hint.innerHTML = 'Bắt đầu bằng việc bấm <b>1) Đã đọc đề</b>.';
      else if(!st.ideaOk) hint.innerHTML = 'Viết <b>ý tưởng</b> (ít nhất 20 ký tự) rồi bấm <b>2) Đã viết ý tưởng</b>.';
      else if(!st.codeOk) hint.innerHTML = 'Viết code xong rồi bấm <b>3) Đã viết code</b> để mở <b>Test</b>.';
      else if(!st.tested) hint.innerHTML = 'Bấm <b>Test</b> để kiểm tra và hoàn tất quy trình.';
      else hint.innerHTML = '✅ Quy trình hoàn tất. Có thể tiếp tục cải thiện hoặc làm bài tiếp theo.';
    }
  }

  function isExamLocked(){
    const st = safeJSON(`py10:exam:${user.id}`, null);
    return !!(st && st.active);
  }

  function initFlowUI(){
    const readBtn = $("stepRead"), ideaBtn=$("stepIdea"), codeBtn=$("stepCode"), testBtn=$("stepTest");
    const idea = $("ideaText");
    if(!readBtn||!ideaBtn||!codeBtn||!testBtn||!idea) return;

    // load
    const st = getFlow(current.id);
    idea.value = st.idea || "";

    readBtn.onclick = ()=>{
      const s=getFlow(current.id);
      s.read = true;
      setFlow(current.id, s);
      applyFlowLocks();
    };
    idea.oninput = ()=>{
      const s=getFlow(current.id);
      s.idea = idea.value;
      s.ideaOk = (idea.value||"").trim().length >= 20;
      setFlow(current.id, s);
      applyFlowLocks();
    };
    ideaBtn.onclick = ()=>{
      const s=getFlow(current.id);
      s.read = true;
      s.ideaOk = (idea.value||"").trim().length >= 20;
      setFlow(current.id, s);
      applyFlowLocks();
    };
    codeBtn.onclick = ()=>{
      const s=getFlow(current.id);
      s.codeOk = true;
      setFlow(current.id, s);
      applyFlowLocks();
    };
    testBtn.onclick = ()=>{
      const s=getFlow(current.id);
      s.tested = true;
      setFlow(current.id, s);
      applyFlowLocks();
    };

    // auto tick "code ok" when code changed enough
    const editor = $("codeEditor") || $("code");
    if(editor && !editor.__flowBound){
      editor.__flowBound = true;
      editor.addEventListener("input", ()=>{
        const s=getFlow(current.id);
        const v = String(editor.value||"");
        const base = String(current.scaffold||"");
        if(!s.codeOk && v.trim().length >= 10 && v.trim() !== base.trim()){
          // don't auto-finish; just enable codeBtn gently
          codeBtn.disabled = false;
        }
        applyFlowLocks();
      });
    }

    applyFlowLocks();
  }

  // Hook into renderTask to init flow UI every lesson change
  const __renderTask0 = window.renderTask;
  if(typeof __renderTask0 === "function"){
    window.renderTask = function(){
      __renderTask0();
      initFlowUI();
    };
  }

  // Hook into __openLesson too (for "Làm ngay")
  const __open0 = window.__openLesson;
  if(typeof __open0 === "function"){
    window.__openLesson = function(lessonId){
      __open0(lessonId);
      initFlowUI();
    }
  }

  // --------- So sánh Output ---------
  function visible(s){
    return String(s)
      .replace(/ /g,"·")
      .replace(/\t/g,"⇥")
      .replace(/\r/g,"")
      .replace(/\n/g,"↵\n");
  }
  window.__lastRun = {stdout:"", stdin:"", expected:null, mode:"run", lessonId:""};
  function findExpectedFor(stdin){
    const inp = String(stdin ?? "");
    // exact match tests
    for(const tc of (current.tests||[])){
      if(String(tc.stdin??"") === inp) return String(tc.expected??"");
    }
    // sample
    if(String(current.sampleIn??"") === inp) return String(current.sampleOut??"");
    return null;
  }
  const btnCompare = $("btnCompare");
  if(btnCompare){
    btnCompare.onclick = ()=>{
      const last = window.__lastRun;
      const exp = (last.lessonId === current.id) ? (last.expected ?? findExpectedFor(last.stdin)) : findExpectedFor($("stdin")?.value||"");
      const out = (last.lessonId === current.id) ? (last.stdout ?? "") : ($("console")?.textContent||"");
      if(exp == null){
        toast("ℹ️ Không có đáp án mẫu cho input hiện tại. Hãy dùng input ví dụ hoặc Test.");
        return;
      }
      const ok = (normalize(String(out)) === normalize(String(exp)));
      const msg = (ok ? "✅ Output khớp đáp án mẫu." : "❌ Output chưa khớp (xem chi tiết).");
      // show a simple modal-like toast box in output area
      const panel = $("console");
      if(panel){
        panel.textContent =
          msg + "\n\n" +
          "OUTPUT (hiển thị ký tự ẩn):\n" + visible(String(out)) + "\n\n" +
          "EXPECTED (hiển thị ký tự ẩn):\n" + visible(String(exp)) + "\n";
      }
      toast(ok ? "✅ Khớp đáp án mẫu" : "❌ Chưa khớp — xem phần Output/Lỗi");
    };
  }

  // --------- Thi 15 phút ---------
  function examKey(){ return `py10:exam:${user.id}`; }
  function getExam(){ return safeJSON(examKey(), null); }
  function setExam(st){ setJSON(examKey(), st); }

  function startExam(){
    const pool = LESSONS.filter(l=>isUnlocked(l.id));
    const pick = [];
    const shuffled = pool.slice().sort(()=>Math.random()-0.5);
    for(const l of shuffled){
      if(pick.length>=5) break;
      pick.push({ lessonId:l.id, passed:false, attempts:0 });
    }
    if(!pick.length){ toast("Chưa có bài nào để thi."); return; }
    const startTs = Date.now();
    const st = { active:true, startTs, endTs: startTs + 15*60*1000, items: pick, idx:0, score:0, finished:false };
    setExam(st);
    $("examTotal").textContent = String(st.items.length);
    $("examIdx").textContent = String(st.idx+1);
    $("examScore").textContent = String(st.score);
    $("examBar").style.display = "block";
    // lock gợi ý
    try{
      if($("togHint")) $("togHint").checked = false;
      if($("togThink")) $("togThink").checked = true; // giữ tư duy
      guardStage = 1;
      updateGuard();
      updateCoach();
    }catch{}
    toast("⏱️ Bắt đầu thi 15 phút. Gợi ý bị khóa.");
    // khóa UI gợi ý trong lúc thi
    try{
      if($("togHint")) $("togHint").disabled = true;
      if($("levelSel")) $("levelSel").disabled = true;
      document.querySelectorAll(".guard .btn").forEach(b=>b.classList.add("disabled"));
      document.querySelectorAll(".snip").forEach(x=>{ x.style.pointerEvents="none"; x.style.opacity=".6"; });
    }catch{}
    // jump to first
    window.__openLesson(st.items[0].lessonId);
    tickExam();
    applyFlowLocks();
  }

  function finishExam(reason){
    const st = getExam();
    if(!st || !st.active) return;
    st.active = false;
    st.finished = true;
    st.finishedAt = Date.now();
    st.reason = reason || "submit";
    setExam(st);
    $("examBar").style.display = "none";
    logEvent("exam_finish", { score: st.score, total: st.items.length, reason: st.reason });
    toast(`🏁 Kết thúc: ${st.score} điểm / ${st.items.length*2} (mỗi câu 2đ).`);
    try{
      if($("togHint")) $("togHint").disabled = false;
      if($("levelSel")) $("levelSel").disabled = false;
      document.querySelectorAll(".guard .btn").forEach(b=>b.classList.remove("disabled"));
      document.querySelectorAll(".snip").forEach(x=>{ x.style.pointerEvents="auto"; x.style.opacity="1"; });
    }catch{}
    applyFlowLocks();
  }

  function tickExam(){
    const st = getExam();
    if(!st || !st.active) return;
    const left = Math.max(0, st.endTs - Date.now());
    const mm = String(Math.floor(left/60000)).padStart(2,"0");
    const ss = String(Math.floor((left%60000)/1000)).padStart(2,"0");
    $("examTimer").textContent = `${mm}:${ss}`;
    if(left<=0){
      finishExam("timeout");
      return;
    }
    setTimeout(tickExam, 250);
  }

  const btnExam = $("btnExam");
  if(btnExam){
    btnExam.onclick = ()=>{
      const st = getExam();
      if(st && st.active){ toast("Bạn đang ở chế độ thi."); return; }
      startExam();
    };
  }
  const btnSubmit = $("btnSubmitExam");
  if(btnSubmit) btnSubmit.onclick = ()=> finishExam("submit");
  const btnExit = $("btnExitExam");
  if(btnExit) btnExit.onclick = ()=>{
    const st = getExam();
    if(st && st.active){
      if(confirm("Thoát chế độ thi? (bài làm vẫn được lưu, nhưng sẽ kết thúc lượt thi)")){
        finishExam("exit");
      }
    }
  };

  // When PASS in test, auto advance exam
  const __markPassed0 = window.markPassed;
  if(typeof __markPassed0 === "function"){
    window.markPassed = function(id){
      __markPassed0(id);
      const st = getExam();
      if(st && st.active){
        const curItem = st.items[st.idx];
        if(curItem && curItem.lessonId === id && !curItem.passed){
          curItem.passed = true;
          st.score += 2;
          st.idx = Math.min(st.idx+1, st.items.length-1);
          setExam(st);
          $("examScore").textContent = String(st.score);
          $("examIdx").textContent = String(st.idx+1);
          if(curItem && st.idx < st.items.length){
            const next = st.items[st.idx];
            if(next && next.lessonId){
              setTimeout(()=>window.__openLesson(next.lessonId), 350);
            }
          }
          // finish if all passed or last reached and passed
          if(st.items.every(x=>x.passed)){
            finishExam("all_passed");
          }
        }
      }
    }
  }

  // --------- Anti copy/paste (soft flag) ---------
  (function(){
    const editor = $("codeEditor") || $("code");
    if(!editor) return;
    if(editor.__pasteBound) return;
    editor.__pasteBound = true;
    editor.__typedChars = 0;
    editor.__pastedChars = 0;
    editor.addEventListener("beforeinput", (e)=>{
      if(e.inputType === "insertFromPaste"){
        const data = (e.dataTransfer && e.dataTransfer.getData("text/plain")) || "";
        editor.__pastedChars += (data||"").length;
      } else if(e.data){
        editor.__typedChars += String(e.data||"").length;
      }
    });
    // also count paste event for browsers not firing beforeinput
    editor.addEventListener("paste", (e)=>{
      const data = (e.clipboardData && e.clipboardData.getData("text/plain")) || "";
      editor.__pastedChars += (data||"").length;
    });
    window.__pasteRatio = ()=> {
      const t = (editor.__typedChars||0) + (editor.__pastedChars||0);
      return t ? (editor.__pastedChars / t) : 0;
    };
  })();

  // --------- Teacher: target selector population + assign handler enhancement ---------
  function uniq(arr){ return Array.from(new Set(arr.filter(Boolean))); }

  function refreshTargetUI(){
    const typeSel = $("asTargetType");
    const valSel  = $("asTargetValue");
    const inpTargets = $("asTargets");
    if(!typeSel || !valSel) return;

    const classes = uniq(STUDENTS.map(s=>s.class));
    valSel.innerHTML = "";
    if(typeSel.value === "all"){
      valSel.style.display = "none";
      if(inpTargets) inpTargets.style.display="none";
      return;
    }
    valSel.style.display = "inline-block";

    if(typeSel.value === "class"){
      for(const c of classes){
        const opt=document.createElement("option");
        opt.value=c; opt.textContent=c;
        valSel.appendChild(opt);
      }
      if(inpTargets) inpTargets.style.display="none";
    } else if(typeSel.value === "group"){
      for(const g of ["1","2","3","4"]){
        const opt=document.createElement("option");
        opt.value=g; opt.textContent="Nhóm " + g;
        valSel.appendChild(opt);
      }
      if(inpTargets) inpTargets.style.display="none";
    } else if(typeSel.value === "student"){
      valSel.style.display="none";
      if(inpTargets){ inpTargets.style.display="inline-block"; }
    }
  }

  if($("asTargetType")){
    $("asTargetType").addEventListener("change", refreshTargetUI);
    refreshTargetUI();
  }

  // Patch btnAssign click (if teacher screen)
  const btnAssign = $("btnAssign");
  if(btnAssign && !btnAssign.__patched){
    btnAssign.__patched = true;
    btnAssign.addEventListener("click", (e)=>{ e.preventDefault(); e.stopImmediatePropagation();
      try{
        const lessonId = $("asLesson").value;
        const due = $("asDue").value ? new Date($("asDue").value).toISOString() : "";
        const title = ($("asTitle").value||"").trim();
        const note  = ($("asNote").value||"").trim();

        const typeSel = $("asTargetType");
        const valSel  = $("asTargetValue");
        const inpTargets = $("asTargets");
        const tType = typeSel ? typeSel.value : "all";
        let tValue = valSel ? valSel.value : "";
        let targets = [];

        if(tType === "student"){
          targets = String(inpTargets ? inpTargets.value : "")
            .split(",").map(s=>s.trim()).filter(Boolean);
          if(!targets.length){ toast("Nhập mã HS (VD: hs1, hs2)"); return; }
        }
        if(tType === "all"){ tValue = "all"; }

        const all = getAssignments();
        all.unshift({
          id: "as_"+Math.random().toString(16).slice(2),
          lessonId,
          due,
          title,
          note,
          active:true,
          targetType: tType,
          targetValue: (tType==="all" ? "" : tValue),
          targets: targets
        });
        localStorage.setItem("py10:assignments", JSON.stringify(all));
        toast("✅ Đã giao bài.");
        // refresh teacher tables if exists
        if(typeof refreshTeacher === "function") refreshTeacher();
      }catch(e){
        console.error(e);
        toast("❌ Không giao được bài (xem Console).");
      }
    }, {capture:true});
  }

  // --------- Ensure flow locks after py loaded ---------
  const __loadPyodide0 = window.loadPyodide;
  // can't patch external; instead observe ready via interval
  (function waitReady(){
    if(typeof pyReady !== "undefined" && pyReady){
      applyFlowLocks();
      return;
    }
    setTimeout(waitReady, 250);
  })();

  // --------- Track last stdout for compare button ---------
  // Patch btnRun and btnTest to store last stdout/expected
  const btnRun = $("btnRun");
  if(btnRun && !btnRun.__patched){
    btnRun.__patched=true;
    btnRun.addEventListener("click", async ()=>{
      // defer: wait a tick for original handler to update console, then capture
      setTimeout(()=>{
        try{
          const stdin = ($("stdin") && $("stdin").value) || "";
          window.__lastRun.lessonId = current.id;
          window.__lastRun.stdin = stdin;
          window.__lastRun.stdout = ($("console") && $("console").textContent) ? $("console").textContent : "";
          window.__lastRun.expected = findExpectedFor(stdin);
          window.__lastRun.mode = "run";
        }catch{}
      }, 50);
    }, {capture:true});
  }
  const btnTest = $("btnTest");
  if(btnTest && !btnTest.__patched){
    btnTest.__patched=true;
    btnTest.addEventListener("click", ()=>{
      setTimeout(()=>{
        try{
          window.__lastRun.lessonId = current.id;
          window.__lastRun.stdin = "";
          window.__lastRun.stdout = ($("console") && $("console").textContent) ? $("console").textContent : "";
          window.__lastRun.expected = null;
          window.__lastRun.mode = "test";
          try{ const st=getFlow(current.id); st.tested=true; setFlow(current.id, st); applyFlowLocks(); }catch{}
        }catch{}
      }, 50);
    }, {capture:true});
  }

})();

