import 'dotenv/config'
import { GoogleGenerativeAI } from '@google/generative-ai';
import Joi from 'joi';
import lang from './lang/en.js';
import sql from './db.js';

export async function generateTestPrompt(req, res) {
  const response = {
    result: 0,
    data: {},
    message: '',
    error: '',
    received: req.body
  };

  const preamble = `
    You are an assitant to a typing speed test application. I will give you a theme and a difficulty, 
    and your job is to generate a story based on that theme. The story should around 350 words Please 
    do not respond with any text other than the story itself. Here is how you should interpret the 
    difficulty levels:

    easy: the story should contain minimal punctuation, no numbers, and minimal capitalization.
    medium: the story should be structured much like a normal story. Some numbers are fine, only if they make sense.
    hard: The story should contain more symbols and capitalization than you might normally see in a story.
    expert: You should go out of the way add extra symbols, numbers, and capitalization to make it difficult.

    The theme and difficulty will be sent to you in JSON format like so:

    {
      "theme": some-theme-here,
      "difficulty": some-difficulty-here
    }
  `;

  // input validation
  const schema = Joi.object({
    theme: Joi.string()
      .max(30)
      .required(),

    difficulty: Joi.string()
      .valid('easy', 'medium', 'hard', 'expert')
      .required(),
  });
  const validation = schema.validate(req.body);
  if (validation.error !== undefined) {
    response.result = 1;
    response.message = lang("BadRequest");
    response.error = validation.error.details;
    res.status(400).json(response);
    return;
  }

  // make call to gemini
  try {
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY)
    const model = genAI.getGenerativeModel({
      model: "gemini-2.0-flash",
      systemInstruction: preamble,
    });
    const result = await model.generateContent(JSON.stringify(req.body));
    const text = result.response.candidates[0].content.parts[0].text;
//     const text = `The vast ocean stretched endlessly before her, its deep blue waves shimmering under the golden sun.\n
// Seagulls called above as she took a deep breath of the salty air.\n
// Each crashing wave told a different story, whispering secrets of the past.\n
// She closed her eyes, feeling the cool breeze against her face, and imagined distant lands beyond the horizon.\n
// The rhythmic sound of the tide was calming, a reminder that nature moves at its own pace.\n
// No rush, no urgency—just the endless cycle of the sea, carrying dreams and mysteries with every ebb and flow.
// `;
//     const fake_prompt_id = 1;
    
    // decrement users api tokens
    await sql`
      UPDATE ai_usage
      SET remaining_tokens = CASE
          WHEN remaining_tokens > 0 THEN remaining_tokens - 1
          ELSE 0
      END
      WHERE userid = ${req.userid};    
    `;

    // store prompt in db
    const [{ promptid }] = await sql`
      INSERT INTO prompts (userid, text, theme, difficulty)
      VALUES(${req.userid}, ${text}, ${req.body.theme}, ${req.body.difficulty})
      RETURNING promptid;
    `;

    response.data.text = text;
    response.data.promptid = promptid;
  } catch (error) {
    console.error(error);
    response.result = 1;
    response.error = error;
    response.message = lang("InternalServerError");
    res.status(500).json(response);
    return;
  }

  res.json(response);
}