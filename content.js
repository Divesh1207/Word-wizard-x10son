let isEnabled = true;
let selectedLanguage = 'en-US';
let lastSelectedText = '';
let lastX = 0;
let lastY = 0;
let voicesLoaded = false;
let isSpeaking = false;

const cache = {
  getItem: (key) => {
    const item = localStorage.getItem(key);
    if (item) {
      const { value, expiry } = JSON.parse(item);
      if (expiry && expiry < Date.now()) {
        localStorage.removeItem(key);
        return null;
      }
      return value;
    }
    return null;
  },
  setItem: (key, value, ttl = 86400000) => {
    const item = {
      value: value,
      expiry: Date.now() + ttl
    };
    localStorage.setItem(key, JSON.stringify(item));
  }
};

document.addEventListener('mouseup', handleSelection);
document.addEventListener('mousedown', handleClickOutside);

function handleSelection(event) {
  if (!isEnabled) return;
  const selectedText = window.getSelection().toString().trim();
  if (selectedText.length > 0) {
    lastSelectedText = selectedText;
    lastX = event.clientX;
    lastY = event.clientY;
    fetchDefinition(selectedText, selectedLanguage, event.clientX, event.clientY);
  }
}

function handleClickOutside(event) {
  const popup = document.getElementById('definition-popup');
  const languageSelector = document.getElementById('languageSelector');
  if (popup && !popup.contains(event.target) && event.target !== languageSelector) {
    removeExistingPopup();
  }
  window.getSelection().removeAllRanges();
}

async function fetchDefinition(word, language, x, y) {
  const cacheKey = `${word}_${language}`;
  const cachedResult = cache.getItem(cacheKey);

  if (cachedResult) {
    showPopup(cachedResult.word, cachedResult.definition, x, y, cachedResult.synonyms, language);
    return;
  }

  try {
    const response = await fetch(`https://api.dictionaryapi.dev/api/v2/entries/en/${word}`);
    const data = await response.json();

    if (data.length > 0 && data[0].meanings.length > 0) {
      const definition = data[0].meanings[0].definitions[0].definition;
      const synonyms = data[0].meanings[0].synonyms || [];
      let result;

      if (language !== 'en-US') {
        const translatedWord = await translateText(word, 'en', language);
        const translatedDefinition = await translateText(definition, 'en', language);
        result = { word: translatedWord, definition: translatedDefinition, synonyms };
      } else {
        result = { word, definition, synonyms };
      }

      cache.setItem(cacheKey, result);
      showPopup(result.word, result.definition, x, y, result.synonyms, language);
    } else {
      showPopup(word, "No definition found", x, y, [], language);
    }
  } catch (error) {
    console.error('Error fetching definition:', error);
    showPopup(word, "Error fetching definition", x, y, [], language);
  }
}

async function translateText(text, sourceLanguage, targetLanguage) {
  const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=${sourceLanguage}|${targetLanguage}`;

  try {
    const response = await fetch(url);
    const data = await response.json();
    return data.responseData.translatedText;
  } catch (error) {
    console.error('Error translating text:', error);
    return "Error translating text";
  }
}

function showPopup(word, definition, x, y, synonyms, language) {
  removeExistingPopup();

  const popup = document.createElement('div');
  popup.id = 'definition-popup';
  popup.innerHTML = `
    <div class="popup-header">
      <strong>${word}</strong>
      <div>
        <button id="speak-word" title="Speak word">🔊</button>
        <button id="speak-definition" title="Speak definition">📢</button>
        <button id="close-popup" title="Close">✖</button>
      </div>
    </div>
    <div class="popup-content">
      <p class="definition">${definition}</p>
      ${synonyms.length > 0 ? `
        <div class="synonyms">
          <strong>Similar:</strong>
          <div class="synonym-list">${synonyms.slice(0, 5).map(s => `<span class="synonym">${s}</span>`).join('')}</div>
        </div>
      ` : ''}
    </div>
    <div class="popup-footer">
      <div class="enable-extension">
        <label class="switch">
          <input type="checkbox" id="enableExtension" ${isEnabled ? 'checked' : ''}>
          <span class="slider round"></span>
        </label>
        <span>Enable Extension</span>
      </div>
      <select id="languageSelector">
        <option value="en-US">English</option>
        <option value="hi-IN">Hindi</option>
        <option value="fr-FR">French</option>
        <option value="es-ES">Spanish</option>
        <option value="de-DE">German</option>
        <option value="ja-JP">Japanese</option>
        <option value="ko-KR">Korean</option>
        <option value="ru-RU">Russian</option>
        <option value="zh-CN">Chinese (Simplified)</option>
      </select>
    </div>
  `;

  document.body.appendChild(popup);

  const closeButton = popup.querySelector('#close-popup');
  closeButton.addEventListener('click', removeExistingPopup);

  const speakWordButton = popup.querySelector('#speak-word');
  speakWordButton.addEventListener('click', async () => {
    try {
      await speak(word, selectedLanguage);
      showSweetMessage("Word pronounced successfully!");
    } catch (error) {
      console.error('Error speaking word:', error);
      showSweetMessage("Sorry, couldn't pronounce the word. Please try again or check your browser settings.");
    }
  });

  const speakDefinitionButton = popup.querySelector('#speak-definition');
  speakDefinitionButton.addEventListener('click', async () => {
    try {
      await speak(definition, selectedLanguage);
      showSweetMessage("Definition pronounced successfully!");
    } catch (error) {
      console.error('Error speaking definition:', error);
      showSweetMessage("Sorry, couldn't pronounce the definition. Please try again or check your browser settings.");
    }
  });

  const enableCheckbox = popup.querySelector('#enableExtension');
  enableCheckbox.addEventListener('change', function () {
    isEnabled = this.checked;
    if (isEnabled) {
      showSweetMessage("Extension enabled! Happy learning!");
    } else {
      removeExistingPopup();
      showSweetMessage("Extension disabled. We'll miss you! Refresh the page to enable it again.");
    }
  });

  const languageSelector = popup.querySelector('#languageSelector');
  languageSelector.value = selectedLanguage;
  languageSelector.addEventListener('change', async function () {
    selectedLanguage = this.value;
    if (lastSelectedText) {
      fetchDefinition(lastSelectedText, selectedLanguage, lastX, lastY);
    }
  });

  const rect = popup.getBoundingClientRect();
  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;

  let left = x;
  let top = y + 10;

  if (left + rect.width > viewportWidth) {
    left = viewportWidth - rect.width - 10;
  }

  if (top + rect.height > viewportHeight) {
    top = y - rect.height - 10;
  }

  left = Math.max(10, Math.min(left, viewportWidth - rect.width - 10));
  top = Math.max(10, Math.min(top, viewportHeight - rect.height - 10));

  popup.style.left = `${left}px`;
  popup.style.top = `${top}px`;
}

function removeExistingPopup() {
  const popup = document.getElementById('definition-popup');
  if (popup) {
    popup.remove();
  }
}

function loadVoices() {
  return new Promise((resolve) => {
    if (voicesLoaded) {
      resolve(speechSynthesis.getVoices());
    } else {
      speechSynthesis.onvoiceschanged = () => {
        voicesLoaded = true;
        resolve(speechSynthesis.getVoices());
      };
      // Trigger voice loading in Firefox
      speechSynthesis.getVoices();
    }
  });
}

function getBestVoice(language) {
  const voices = speechSynthesis.getVoices();

  // Try to find an exact match
  let voice = voices.find(v => v.lang.toLowerCase() === language.toLowerCase());

  // If no exact match, try to find a voice that starts with the language code
  if (!voice) {
    voice = voices.find(v => v.lang.toLowerCase().startsWith(language.toLowerCase()));
  }

  // If still no match, fall back to any voice in the same language family
  if (!voice) {
    const langFamily = language.split('-')[0];
    voice = voices.find(v => v.lang.toLowerCase().startsWith(langFamily));
  }

  // If all else fails, use the first available voice
  return voice || voices[0];
}

async function speak(text, language) {
  return new Promise((resolve, reject) => {
    if (speechSynthesis.speaking) {
      speechSynthesis.cancel();
    }

    const utterance = new SpeechSynthesisUtterance(text);
    const selectedVoice = getBestVoice(language);

    if (!selectedVoice) {
      reject(new Error('No suitable voice found'));
      return;
    }

    utterance.voice = selectedVoice;
    utterance.lang = language;
    utterance.rate = 1;
    utterance.pitch = 1;
    utterance.volume = 1;

    utterance.onstart = () => {
      isSpeaking = true;
    };

    utterance.onend = () => {
      isSpeaking = false;
      resolve();
    };

    utterance.onerror = (event) => {
      isSpeaking = false;
      reject(new Error(`Speech synthesis error: ${event.error}`));
    };

    speechSynthesis.speak(utterance);
  });
}

function showSweetMessage(message) {
  const messageElement = document.createElement('div');
  messageElement.id = 'sweet-message';
  messageElement.innerText = message;
  document.body.appendChild(messageElement);

  setTimeout(() => {
    messageElement.remove();
  }, 3000);
}

function logAvailableVoices() {
  const voices = speechSynthesis.getVoices();
  console.log('Available voices:');
  voices.forEach(voice => {
    console.log(`Name: ${voice.name}, Lang: ${voice.lang}`);
  });
}

function keepSpeechSynthesisAlive() {
  if (speechSynthesis.speaking) {
    speechSynthesis.pause();
    speechSynthesis.resume();
  }
}

window.addEventListener('resize', () => {
  const popup = document.getElementById('definition-popup');
  if (popup) {
    const rect = popup.getBoundingClientRect();
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;

    let left = parseInt(popup.style.left);
    let top = parseInt(popup.style.top);

    left = Math.max(10, Math.min(left, viewportWidth - rect.width - 10));
    top = Math.max(10, Math.min(top, viewportHeight - rect.height - 10));

    popup.style.left = `${left}px`;
    popup.style.top = `${top}px`;
  }
});

// Load voices when the script starts
loadVoices().then(() => {
  logAvailableVoices();
  console.log('Voices loaded and logged');
});

// Call this function every 5 seconds
setInterval(keepSpeechSynthesisAlive, 5000);