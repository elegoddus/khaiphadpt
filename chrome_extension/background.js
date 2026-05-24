chrome.action.onClicked.addListener((tab) => {
  if (tab.id) {
    chrome.tabs.sendMessage(tab.id, { action: "TOGGLE_SIDEBAR" }, (response) => {
      if (chrome.runtime.lastError) {
        console.log("CS Assistant: Content script not ready.", chrome.runtime.lastError);
      }
    });
  }
});
