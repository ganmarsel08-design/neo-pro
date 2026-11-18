/* Если телефон не смог сохранить данные (память браузера заполнена), врач должен узнать об этом сразу,
   а не после перезагрузки, когда записи уже пропали. */
window.__neoSaveErr = function (err, key) {
  try {
    console.error("НеоДневник: не сохранено", key, err);
  } catch (e) {}
  var now = Date.now();
  if (window.__neoSaveErrAt && now - window.__neoSaveErrAt < 15000) return;
  window.__neoSaveErrAt = now;
  var full = err && (err.name === "QuotaExceededError" || err.code === 22 || /quota/i.test(String(err.message || "")));
  alert(
    (full ? "Память браузера заполнена. " : "Ошибка сохранения. ") +
      "Последнее изменение НЕ сохранено на этом телефоне. Не закрывайте приложение: перепишите важное в историю, затем удалите выписанных детей или передайте их коллеге и повторите сохранение.",
  );
};
