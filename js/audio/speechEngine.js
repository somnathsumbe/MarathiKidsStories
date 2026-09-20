(() => {
  const sentencePattern = /[^।!?\n]+[।!?]?/g;
  const voiceHints = /male|man|पुरुष|वक्ता/i;

  function split(text) {
    return (String(text).match(sentencePattern) || [String(text)])
      .map((sentence) => sentence.trim())
      .filter(Boolean);
  }

  function findVoice(voices, preferredName) {
    const marathi = voices.filter((voice) => (voice.lang || '').toLowerCase().startsWith('mr'));
    const maleMarathi = marathi.filter((voice) => voiceHints.test(`${voice.name} ${voice.voiceURI}`));
    const indian = voices.filter((voice) => /^(hi|en|gu|kn|ta|te)-in/i.test(voice.lang || ''));
    return {
      voice: voices.find((voice) => voice.name === preferredName) || maleMarathi[0] || marathi[0] || indian[0] || voices[0] || null,
      hasMarathiVoice: marathi.length > 0
    };
  }

  window.MarathiSpeechEngine = { split, findVoice };
})();
