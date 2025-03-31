// Helper functions for storing tests

export const getAccuracy = (keyStrokes, prompt) => {
    const promptKeys = prompt.split('');
    
    let offset = 0;
    let correct = 0;
    let error = 0;
    for (let i = 0; i < keyStrokes.length; i++) {
      if (keyStrokes[i] === 'Backspace') {
        offset -= 2;
        continue;
      }
      if (keyStrokes[i] === promptKeys[i + offset]) {
        correct++;
      } else {
        error++;
      }
    }

    return Math.floor((correct / (correct + error)) * 100) || 0; // Returns percentage
};

export const getWPM = (keyStrokes, duration) => {
  const filteredKeystrokes = keyStrokes.filter(k => k !== 'Backspace');

  const wordsTyped = filteredKeystrokes.length / 5;
  const minutes = duration / 60;

  return minutes > 0 ? Math.floor(wordsTyped / minutes) : 0;
}

export const getAWPM = (keyStrokes, prompt, duration) => {
  const promptKeys = prompt.split('');

  let offset = 0;
  let correct = 0;
  let error = 0;
  for (let i = 0; i < keyStrokes.length; i++) {
    if (keyStrokes[i] === 'Backspace') {
      offset -= 2;
      continue;
    }
    if (keyStrokes[i] === promptKeys[i + offset]) {
      correct++;
    } else {
      error++;
    }
  }

  return Math.floor((correct / (5 * duration)) * 60);
};


