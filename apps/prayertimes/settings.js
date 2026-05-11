(function(back) {
  const Storage = require("Storage");
  const FILE = "prayertimes.settings.json";
  const methods = ["MWL", "ISNA", "Egypt", "Makkah", "Karachi"];
  let settings = Storage.readJSON(FILE, 1) || {};
  if (!settings.method) settings.method = "MWL";
  if (!settings.asr) settings.asr = 1;

  function save() {
    Storage.writeJSON(FILE, settings);
  }

  function showMenu() {
    E.showMenu({
      "": { title: /*LANG*/"Prayer Times" },
      /*LANG*/"< Back": back,
      /*LANG*/"Method": {
        value: Math.max(0, methods.indexOf(settings.method)),
        min: 0,
        max: methods.length - 1,
        format: v => methods[v],
        onchange: v => {
          settings.method = methods[v];
          save();
        }
      },
      /*LANG*/"Asr": {
        value: settings.asr === 2 ? 1 : 0,
        min: 0,
        max: 1,
        format: v => v ? "Hanafi" : "Standard",
        onchange: v => {
          settings.asr = v ? 2 : 1;
          save();
        }
      },
      /*LANG*/"Location": () => {
        E.showMessage(/*LANG*/"Install/use My Location to set latitude and longitude.", /*LANG*/"Prayer Times");
        setTimeout(showMenu, 2500);
      }
    });
  }

  showMenu();
})
