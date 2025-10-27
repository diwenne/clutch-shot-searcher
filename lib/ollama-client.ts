export interface ShotFilter {
  shotType?: string[];
  player?: string[];
  zone?: string[];
  direction?: string[];
  courtSide?: 'top' | 'bot';
  minRating?: number;
  maxRating?: number;
  winnerError?: 'winner' | 'error';
  rallyLength?: { min?: number; max?: number };
}

export interface OllamaResponse {
  filter: ShotFilter;
  explanation?: string;
}

const SYSTEM_PROMPT = `You are a badminton shot search assistant. Your job is to convert natural language queries into structured filter objects.

Available shot types: serve, drive, volley, lob, overhead
Available zones: zone-0, zone-1, zone-2, zone-3, zone-4, zone-5
Available directions: cross/left, cross/right, straight
Available players: player-113, player-193, player-367 (and others in the dataset)
Court sides: top, bot
Winner/Error: winner (successful shot), error (mistake)
Shot rating: 0-13 (higher is better quality/difficulty)

Examples:
Query: "show me all winning overhead shots"
Response: {"shotType": ["overhead"], "winnerError": "winner"}

Query: "find cross-court drives by player 113"
Response: {"shotType": ["drive"], "direction": ["cross/left", "cross/right"], "player": ["player-113"]}

Query: "high quality shots with rating above 10"
Response: {"minRating": 10}

Query: "errors from the bottom player"
Response: {"winnerError": "error", "courtSide": "bot"}

Query: "serves landing in zone 4"
Response: {"shotType": ["serve"], "zone": ["zone-4"]}

Query: "long rallies with more than 10 shots"
Response: {"rallyLength": {"min": 10}}

Respond ONLY with a valid JSON object representing the filter. Do not include any explanation or additional text.`;

export async function parseNaturalLanguageQuery(
  query: string
): Promise<ShotFilter> {
  try {
    const response = await fetch('http://localhost:11434/api/generate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'qwen2.5:7b',
        prompt: `${SYSTEM_PROMPT}\n\nUser query: "${query}"\n\nJSON response:`,
        stream: false,
        options: {
          temperature: 0.1, // Low temperature for consistent, structured output
          top_p: 0.9,
        },
      }),
    });

    if (!response.ok) {
      throw new Error(`Ollama API error: ${response.statusText}`);
    }

    const data = await response.json();
    const generatedText = data.response.trim();

    // Try to extract JSON from the response
    // Sometimes the model might include extra text, so we need to extract the JSON part
    let jsonMatch = generatedText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      // If no JSON found, try to parse the whole response
      jsonMatch = [generatedText];
    }

    const filterObject = JSON.parse(jsonMatch[0]);
    return filterObject as ShotFilter;
  } catch (error) {
    console.error('Error parsing natural language query:', error);
    // Return an empty filter on error
    return {};
  }
}

export async function testOllamaConnection(): Promise<boolean> {
  try {
    const response = await fetch('http://localhost:11434/api/tags');
    return response.ok;
  } catch (error) {
    console.error('Ollama connection test failed:', error);
    return false;
  }
}
