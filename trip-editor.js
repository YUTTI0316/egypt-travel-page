(() => {
  "use strict";

  const STORAGE_PREFIX = "travel-plan:editable-trip:v1:";
  let trip = null;
  let dialog = null;
  let activeTab = "itinerary";
  let activeDay = 0;

  const escapeHtml = (value = "") => String(value).replace(/[&<>"']/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;"
  })[character]);
  const storageKey = () => `${STORAGE_PREFIX}${encodeURIComponent(trip?.metadata?.tripId || "default")}`;

  function loadOverrides(data) {
    try {
      const saved = JSON.parse(localStorage.getItem(storageKey()) || "null");
      if (!saved || typeof saved !== "object") return;
      if (Array.isArray(saved.days)) data.days = saved.days;
      if (Array.isArray(saved.flights)) data.flights = saved.flights;
      if (Array.isArray(saved.flightJourneys)) data.flightJourneys = saved.flightJourneys;
      if (saved.groundTransport && typeof saved.groundTransport === "object") data.groundTransport = saved.groundTransport;
    } catch (error) {
      console.warn("无法读取本地行程修改", error);
    }
  }

  function save() {
    try {
      localStorage.setItem(storageKey(), JSON.stringify({
        days: trip.days,
        flights: trip.flights,
        flightJourneys: trip.flightJourneys,
        groundTransport: trip.groundTransport
      }));
      const status = document.querySelector("#trip-editor-status");
      if (status) status.textContent = "已保存到此浏览器";
      window.setTimeout(() => { if (status) status.textContent = "修改会自动保存到此浏览器"; }, 1600);
    } catch (error) {
      console.error("行程保存失败", error);
      const status = document.querySelector("#trip-editor-status");
      if (status) status.textContent = "保存失败：请检查浏览器存储空间或隐私设置";
    }
  }

  function ensureEditor() {
    if (dialog) return;
    const trigger = document.createElement("button");
    trigger.type = "button";
    trigger.className = "trip-editor-trigger";
    trigger.textContent = "编辑行程";
    trigger.setAttribute("aria-haspopup", "dialog");
    trigger.addEventListener("click", openEditor);
    const nav = document.querySelector(".primary-navigation");
    (nav || document.querySelector(".topbar")).append(trigger);

    dialog = document.createElement("dialog");
    dialog.className = "trip-editor-dialog";
    dialog.id = "trip-editor-dialog";
    dialog.setAttribute("aria-labelledby", "trip-editor-title");
    dialog.innerHTML = `
      <header class="trip-editor-header">
        <div><p>TRIP SETTINGS</p><h2 id="trip-editor-title">编辑旅行信息</h2></div>
        <button type="button" class="trip-editor-close" data-close-editor>关闭</button>
      </header>
      <p class="trip-editor-status" id="trip-editor-status" aria-live="polite">修改会自��保存到此浏览器</p>
      <nav class="trip-editor-tabs" aria-label="编辑类别">
        <button type="button" data-editor-tab="itinerary">每日行程</button>
        <button type="button" data-editor-tab="transport">交通</button>
        <button type="button" data-editor-tab="flights">航班</button>
      </nav>
      <div class="trip-editor-content" id="trip-editor-content"></div>
      <footer class="trip-editor-footer"><span>只保存在当前浏览器和设备，不会修改 GitHub 仓库内容。</span><button type="button" data-close-editor>完成</button></footer>`;
    document.body.append(dialog);
    dialog.addEventListener("click", handleClick);
    dialog.addEventListener("change", handleChange);
    dialog.addEventListener("submit", (event) => event.preventDefault());
    dialog.addEventListener("click", (event) => { if (event.target === dialog) dialog.close(); });
    renderEditor();
  }

  function openEditor() {
    ensureEditor();
    renderEditor();
    if (typeof dialog.showModal === "function") dialog.showModal();
    else dialog.setAttribute("open", "");
  }

  function field(label, path, value, options = {}) {
    const type = options.type || "text";
    const multiline = options.multiline;
    return `<label class="trip-editor-field${options.wide ? " is-wide" : ""}"><span>${escapeHtml(label)}</span>${multiline
      ? `<textarea data-path="${escapeHtml(path)}" rows="3">${escapeHtml(value ?? "")}</textarea>`
      : `<input type="${type}" data-path="${escapeHtml(path)}" value="${escapeHtml(value ?? "")}" ${options.placeholder ? `placeholder="${escapeHtml(options.placeholder)}"` : ""}>`}</label>`;
  }

  function itineraryEditor() {
    if (!trip.days?.length) return "<p>目前没有每日行程。</p>";
    activeDay = Math.min(activeDay, trip.days.length - 1);
    const day = trip.days[activeDay];
    return `<div class="trip-editor-day-picker">${trip.days.map((item, index) => `<button type="button" data-select-day="${index}" aria-pressed="${index === activeDay}">第${item.day || index + 1}天</button>`).join("")}</div>
      <section class="trip-editor-day">
        <h3>第${day.day || activeDay + 1}天 · ${escapeHtml(day.date || "")}</h3>
        <div class="trip-editor-grid">${field("当天标题", `days.${activeDay}.title`, day.title, { wide: true })}${field("地点（用逗号分隔）", `days.${activeDay}.locations`, (day.locations || []).join("，"), { wide: true })}</div>
        <h4>行程项目</h4>
        ${(day.schedule || []).map((item, index) => `<article class="trip-editor-card">
          <div class="trip-editor-grid">${field("时间", `days.${activeDay}.schedule.${index}.time`, item.time)}<label class="trip-editor-field"><span>类别</span><select data-path="days.${activeDay}.schedule.${index}.type">${["activity", "transport", "flight", "stay", "note"].map((type) => `<option value="${type}" ${item.type === type ? "selected" : ""}>${({activity:"活动",transport:"交通",flight:"航班",stay:"住宿",note:"备注"})[type]}</option>`).join("")}</select></label>${field("内容 / 地点", `days.${activeDay}.schedule.${index}.text`, item.text, { wide: true, multiline: true })}</div>
          <button type="button" class="trip-editor-delete" data-delete-schedule="${index}">删除此项目</button>
        </article>`).join("")}
        <button type="button" class="trip-editor-add" data-add-schedule>＋ 添加行程项目</button>
      </section>`;
  }

  function collectionEditor(collection, title) {
    const entries = Array.isArray(trip.groundTransport?.[collection]) ? trip.groundTransport[collection] : [];
    return `<section class="trip-editor-section"><h3>${title}</h3><p class="trip-editor-hint">编辑交通方式、路线、时间或备注；内容会自动保存。</p>
      ${entries.map((entry, index) => `<article class="trip-editor-card"><div class="trip-editor-grid">${field("交通方式", `groundTransport.${collection}.${index}.mode`, entry.mode || entry.type || "")}${field("时间", `groundTransport.${collection}.${index}.time`, entry.time || "")}${field("路线 / 备注", `groundTransport.${collection}.${index}.note`, entry.note || entry.text || entry.route || "", {wide:true,multiline:true})}</div><button type="button" class="trip-editor-delete" data-delete-transport="${collection}:${index}">删除此交通</button></article>`).join("")}
      <button type="button" class="trip-editor-add" data-add-transport="${collection}">＋ 添加交通</button></section>`;
  }

  function transportEditor() {
    if (!trip.groundTransport) trip.groundTransport = {};
    if (!Array.isArray(trip.groundTransport.plannedRoadLegs)) trip.groundTransport.plannedRoadLegs = [];
    if (!Array.isArray(trip.groundTransport.publicTransitAndRail)) trip.groundTransport.publicTransitAndRail = [];
    return collectionEditor("plannedRoadLegs", "包车 / 自驾 / 道路交通") + collectionEditor("publicTransitAndRail", "火车 / 公共交通");
  }

  function flightEditor() {
    return `<p class="trip-editor-hint">填写航司、航班号、起降时间和机场；预订编号可选。新增信息会同步更新航班卡片。</p>
      ${(trip.flightJourneys || []).map((journey, journeyIndex) => {
        let flights = trip.flights.filter((flight) => flight.journeyId === journey.id).sort((a,b) => a.sequence - b.sequence);
        return `<section class="trip-editor-section"><h3>${escapeHtml(journey.title || `航班行程 ${journeyIndex + 1}`)}</h3>${flights.length ? "" : `<button type="button" class="trip-editor-add" data-add-flight="${journeyIndex}">＋ 添加航班详情</button>`}
          ${flights.map((flight) => {
            const index = trip.flights.indexOf(flight);
            flight.departure ||= {}; flight.arrival ||= {}; flight.airline ||= {};
            return `<article class="trip-editor-card trip-editor-flight"><h4>航段 ${flight.sequence || 1}</h4><div class="trip-editor-grid">
              ${field("航空公司", `flights.${index}.airline.nameZh`, flight.airline.nameZh || flight.airline.name)}
              ${field("航班号", `flights.${index}.flightNumber`, flight.flightNumber)}
              ${field("预订编号", `flights.${index}.bookingReference`, flight.bookingReference || "")}
              ${field("出发机场代码", `flights.${index}.departure.airportCode`, flight.departure.airportCode)}
              ${field("出发城市", `flights.${index}.departure.city`, flight.departure.city)}
              ${field("起飞日期", `flights.${index}.departure.date`, flight.departure.date, {type:"date"})}
              ${field("起飞时间", `flights.${index}.departure.time`, flight.departure.time, {type:"time"})}
              ${field("抵达机场代码", `flights.${index}.arrival.airportCode`, flight.arrival.airportCode)}
              ${field("抵达城市", `flights.${index}.arrival.city`, flight.arrival.city)}
              ${field("抵达日期", `flights.${index}.arrival.date`, flight.arrival.date, {type:"date"})}
              ${field("抵达时间", `flights.${index}.arrival.time`, flight.arrival.time, {type:"time"})}
            </div></article>`;
          }).join("")}</section>`;
      }).join("")}`;
  }

  function renderEditor() {
    if (!dialog || !trip) return;
    dialog.querySelectorAll("[data-editor-tab]").forEach((button) => {
      button.setAttribute("aria-pressed", String(button.dataset.editorTab === activeTab));
    });
    const content = dialog.querySelector("#trip-editor-content");
    content.innerHTML = activeTab === "itinerary" ? itineraryEditor() : activeTab === "transport" ? transportEditor() : flightEditor();
  }

  function resolvePath(path) {
    const parts = path.split(".");
    const key = parts.pop();
    const target = parts.reduce((value, part) => value?.[/^\d+$/.test(part) ? Number(part) : part], trip);
    return { target, key: /^\d+$/.test(key) ? Number(key) : key };
  }

  function handleChange(event) {
    const input = event.target.closest("[data-path]");
    if (!input) return;
    const { target, key } = resolvePath(input.dataset.path);
    if (!target) return;
    let value = input.value;
    if (input.dataset.path.endsWith(".locations")) value = value.split(/[，,、]/).map((part) => part.trim()).filter(Boolean);
    target[key] = value;
    if (input.dataset.path.includes(".airline.nameZh")) {
      const flightIndex = Number(input.dataset.path.split(".")[1]);
      trip.flights[flightIndex].airline.name = value;
    }
    if (input.dataset.path.endsWith(".type") && value === "transport") {
      const parts = input.dataset.path.split(".");
      trip.days[Number(parts[1])].schedule[Number(parts[3])].type = value;
    }
    save();
    refreshPage();
  }

  function refreshPage() {
    if (typeof window.renderTimeline === "function" && trip.config?.modules?.itinerary !== false) window.renderTimeline();
    if (typeof window.renderFlights === "function" && trip.config?.modules?.flights !== false) window.renderFlights();
    if (typeof window.renderRental === "function" && trip.config?.modules?.driving !== false && trip.groundTransport?.rentalCar) window.renderRental();
  }

  function handleClick(event) {
    const close = event.target.closest("[data-close-editor]");
    if (close) { dialog.close?.(); dialog.removeAttribute("open"); return; }
    const tab = event.target.closest("[data-editor-tab]");
    if (tab) { activeTab = tab.dataset.editorTab; renderEditor(); return; }
    const day = event.target.closest("[data-select-day]");
    if (day) { activeDay = Number(day.dataset.selectDay); renderEditor(); return; }
    const removeItem = event.target.closest("[data-delete-schedule]");
    if (removeItem) {
      trip.days[activeDay].schedule.splice(Number(removeItem.dataset.deleteSchedule), 1);
      save(); renderEditor(); refreshPage(); return;
    }
    if (event.target.closest("[data-add-schedule]")) {
      trip.days[activeDay].schedule.push({ id: `item-${Date.now()}`, time: "", type: "activity", text: "新行程项目" });
      save(); renderEditor(); refreshPage(); return;
    }
    const deleteTransport = event.target.closest("[data-delete-transport]");
    if (deleteTransport) {
      const [collection, index] = deleteTransport.dataset.deleteTransport.split(":");
      trip.groundTransport[collection].splice(Number(index), 1); save(); renderEditor(); return;
    }
    const addTransport = event.target.closest("[data-add-transport]");
    if (addTransport) {
      trip.groundTransport[addTransport.dataset.addTransport].push({ id: `transport-${Date.now()}`, mode: "交通方式", time: "", note: "" });
      save(); renderEditor(); return;
    }
    const addFlight = event.target.closest("[data-add-flight]");
    if (addFlight) {
      const journey = trip.flightJourneys[Number(addFlight.dataset.addFlight)];
      journey.placeholder = false; journey.status = "planned";
      trip.flights.push({ id: `flight-${Date.now()}`, journeyId: journey.id, sequence: 1, airline: {name: "", nameZh: ""}, flightNumber: "", bookingReference: "", departure: {airportCode:"",city:"",date:trip.trip?.startDate || "",time:"00:00",utcOffset:"+00:00"}, arrival: {airportCode:"",city:"",date:trip.trip?.startDate || "",time:"00:00",utcOffset:"+00:00"} });
      save(); renderEditor(); refreshPage();
    }
  }

  function install() {
    const data = window.TRAVEL_PLAN_DATA;
    if (!data || trip === data) return;
    trip = data;
    loadOverrides(trip);
    ensureEditor();
    refreshPage();
  }

  document.addEventListener("travel-data-ready", install);
  if (window.TRAVEL_PLAN_DATA) install();
})();
