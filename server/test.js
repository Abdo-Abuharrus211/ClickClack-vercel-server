import sql from "./db.js";
import lang from "./lang/en.js";
import { getAccuracy, getWPM, getAWPM } from "./utils/save_test.js";

export async function getPreviousPrompts(req, res) {
  const response = {
    result: 0,
    data: {},
    message: '',
    error: '',
    received: req.body
  };

  try {
    const result = await sql`
      SELECT *
      FROM (
        SELECT DISTINCT ON (prompts.promptid)
          prompts.promptid,
          prompts.text,
          prompts.difficulty,
          prompts.theme,
          tests.date
        FROM prompts
        JOIN tests ON prompts.promptid = tests.promptid
        WHERE tests.userid = ${req.userid}
        ORDER BY prompts.promptid, tests.date DESC, prompts.promptid DESC
      ) AS latest_prompts
      ORDER BY date DESC, promptid DESC;
    `;
    response.data = result;
  } catch (error) {
    response.result = 1;
    response.message = lang("PromptsRetrievalFailure");
    res.status(500).json(response);
    return;
  }
  res.json(response);
}

export async function saveTest(req, res) {
  const response = {
    result: 0,
    data: {},
    message: '',
    error: '',
    received: req.body
  };

  try {
    const { keyStrokes, prompt, duration, promptid } = req.body;

    if (!keyStrokes || !prompt || !duration) {
      response.result = 1;
      response.message = "Missing required fields."
      return res.status(400).json(response);
    }

    const accuracy = getAccuracy(keyStrokes, prompt);
    const wpm = getWPM(keyStrokes, duration);
    const awpm = getAWPM(keyStrokes, prompt, duration);
    const date = new Date().toISOString(); 
    const userid = req.userid;

    await sql`
      INSERT INTO tests (promptid, userid, wpm, awpm, accuracy, date)
      VALUES (${promptid}, ${userid}, ${wpm}, ${awpm}, ${accuracy}, ${date});
    `;

    response.data.accuracy = accuracy;
    response.data.wpm = wpm;
    response.data.awpm = awpm;

    res.json(response);
  } catch (error) {
    console.error("Error processing test:", error);
    response.message = "Internal server error."
    res.status(500).json(response);
  }
}

export async function getTests(req, res) {
  const response = {
    result: 0,
    data: {},
    message: '',
    error: '',
    received: ''
  };

  try {
    const userid = req.userid;

    const tests = await sql`
      SELECT DISTINCT 
      tests.testid, 
      tests.promptid, 
      tests.wpm, 
      tests.awpm, 
      tests.accuracy, 
      tests.date, 
      prompts.text, 
      prompts.theme, 
      prompts.difficulty
      FROM tests
      JOIN prompts ON tests.promptid = prompts.promptid
      WHERE tests.userid = ${userid}
      ORDER BY tests.date DESC;
    `;

    response.data.tests = tests;
    response.message = "Tests retrieved successfully.";
    res.json(response);
  } catch (error) {
    console.error("Error retrieving tests:", error);
    response.result = 1;
    response.message = "Failed to retrieve tests.";
    response.error = error;
    res.status(500).json(response);
  }
}

export async function removePrompt(req, res) {
  const response = {
    result: 0,
    data: {},
    message: '',
    error: '',
    received: ''
  };

  try {
    await sql`
      DELETE FROM prompts
      WHERE promptid = ${req.body.promptid} AND userid = ${req.userid};
    `;
    response.message = "Prompt successfully removed.";
  } catch (error) {
    console.log(error);
    response.result = 1;
    response.message = "Failed to remove prompt.";
    response.error = error;
    res.status(500).json(response);
    return
  }
  res.json(response);
}