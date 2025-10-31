import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import { ShotFilter, calculatePlayerStats, generateExplanation } from '@/lib/ollama-client';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const FILTER_SYSTEM_PROMPT = `You are a padel shot search assistant. Convert natural language queries into structured filter objects.

Available shot types: serve, drive, volley, lob, overhead
Available zones: zone-0, zone-1, zone-2, zone-3, zone-4, zone-5
Available directions: cross/left, cross/right, straight
Court sides: top, bot
Winner/Error: winner (successful shot), error (mistake)
Shot rating: 0-13 (higher is better quality/difficulty)

Respond ONLY with valid JSON. Examples:
"show me all winning overhead shots" → {"shotType": ["overhead"], "winnerError": "winner"}
"high quality shots with rating above 10" → {"minRating": 10}`;

export async function POST(request: NextRequest) {
  try {
    console.log('=== LLM Search API Called ===');

    // Check API key
    if (!process.env.OPENAI_API_KEY) {
      console.error('ERROR: OPENAI_API_KEY not found in environment');
      return NextResponse.json(
        { error: 'OpenAI API key not configured' },
        { status: 500 }
      );
    }
    console.log('✓ OpenAI API key found:', process.env.OPENAI_API_KEY.slice(0, 10) + '...');

    const body = await request.json();
    const { query, shots, selectedPlayer, playerDisplayName, allShots } = body;

    console.log('Query:', query);
    console.log('Shots count (player):', shots?.length || 0);
    console.log('Shots count (all):', allShots?.length || 0);
    console.log('Selected player:', selectedPlayer || 'everyone');
    console.log('Player display name:', playerDisplayName || 'N/A');

    if (!query || typeof query !== 'string') {
      return NextResponse.json(
        { error: 'Query parameter is required and must be a string' },
        { status: 400 }
      );
    }

    // First, classify the query type
    console.log('Calling OpenAI to classify query...');
    const classificationResponse = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: `Classify the user's query as either "filter" or "analysis".
Filter queries: requests to find/show specific shots (e.g., "show all smashes", "find winning shots")
Analysis queries: requests for improvement tips, statistics, or insights (e.g., "how can I improve", "where do I lose points", "what are my weaknesses")

Respond with ONLY one word: "filter" or "analysis"`
        },
        { role: 'user', content: query }
      ],
      temperature: 0.1,
      max_tokens: 10,
    });

    console.log('✓ Classification response:', classificationResponse.choices[0]?.message?.content);
    console.log('Tokens used (classification):', classificationResponse.usage);

    const queryType = classificationResponse.choices[0]?.message?.content?.trim().toLowerCase();
    console.log('Detected query type:', queryType);

    if (queryType === 'analysis' && shots && shots.length > 0) {
      console.log('Processing as ANALYSIS query...');
      console.log(`Analyzing ${shots.length} shots for ${playerDisplayName || selectedPlayer || 'everyone'}`);

      // Analysis query
      const stats = calculatePlayerStats(query, shots);

      if (!stats) {
        return NextResponse.json({
          type: 'analysis',
          analysis: 'No shots found for analysis. Please specify a valid player ID.',
          explanation: 'Unable to analyze',
          success: true
        });
      }

      // Prepare data summary with mixed stats
      const totalErrors = Object.entries(stats.shotTypeStats).reduce((sum, [_, data]: [string, any]) => sum + data.errors, 0);
      const totalWinners = Object.entries(stats.shotTypeStats).reduce((sum, [_, data]: [string, any]) => sum + (data.total - data.errors), 0);

      const playerName = playerDisplayName || stats.playerId;

      // Calculate overall stats for comparison (if player is selected)
      let comparisonStats = '';
      if (selectedPlayer && allShots && allShots.length > 0) {
        const overallStats = calculatePlayerStats('everyone', allShots);
        if (overallStats) {
          comparisonStats = `

📊 TEAM/OVERALL COMPARISON:
Overall error rate (all players): ${overallStats.errorRate}%
Overall winner rate (all players): ${overallStats.winnerRate}%
Overall avg rating (all players): ${overallStats.avgRating} out of 13

Your performance vs team average:
• Error rate: ${stats.errorRate}% vs ${overallStats.errorRate}% (${parseFloat(stats.errorRate) > parseFloat(overallStats.errorRate) ? 'WORSE ⚠️' : 'BETTER ✓'})
• Winner rate: ${stats.winnerRate}% vs ${overallStats.winnerRate}% (${parseFloat(stats.winnerRate) > parseFloat(overallStats.winnerRate) ? 'BETTER ✓' : 'WORSE ⚠️'})
• Avg rating: ${stats.avgRating} vs ${overallStats.avgRating} (${parseFloat(stats.avgRating) > parseFloat(overallStats.avgRating) ? 'BETTER ✓' : 'WORSE ⚠️'})
`;
        }
      }

      const dataSummary = `
PLAYER: ${playerName}${playerName !== stats.playerId ? ` (${stats.playerId})` : ''}
Total shots analyzed: ${stats.totalShots}
Errors: ${totalErrors} mistakes (${stats.errorRate}%)
Winners: ${totalWinners} successful shots (${stats.winnerRate}%)
Average shot difficulty/quality: ${stats.avgRating} out of 13

SHOT TYPE BREAKDOWN:
${Object.entries(stats.shotTypeStats).map(([type, data]: [string, any]) =>
  `• ${type.toUpperCase()}: ${data.errors} errors out of ${data.total} attempts (${((data.errors / data.total) * 100).toFixed(1)}%)`
).join('\n')}

DIRECTION ACCURACY:
${Object.entries(stats.directionStats).map(([dir, data]: [string, any]) =>
  `• ${dir}: ${data.errors}/${data.total} errors (${((data.errors / data.total) * 100).toFixed(1)}%)`
).join('\n')}

PROBLEM AREA: ${stats.mostErrorZone}
${comparisonStats}
`;

      // Get AI coaching tips AND suggested filters
      console.log('=== DATA BEING SENT TO AI ===');
      console.log(dataSummary);
      console.log('=== END OF AI DATA ===');

      // Determine if we're analyzing everyone or a specific player
      const isEveryone = !selectedPlayer || selectedPlayer === 'everyone';
      const pronounGuidance = isEveryone
        ? `CRITICAL: You are analyzing aggregate data for ALL players combined (not a single person). DO NOT use "you" or "your" pronouns. Instead, use "everyone", "the team", "players", or third-person language (e.g., "Players are making 15 out of 67 drive errors" NOT "You're making 15 out of 67 drive errors").`
        : `You are analyzing a specific player. Use "you" and "your" to address them directly.`;

      console.log('Calling OpenAI for analysis...');
      const analysisResponse = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: `You are an elite padel coach analyzing match performance data. Provide 3-5 specific, tactical improvement tips.

${pronounGuidance}

IMPORTANT FORMATTING RULES:
- Mix percentages AND raw numbers (e.g., "15 out of 67 drives" instead of just "22.4%")
- Vary your sentence structure - don't start every point the same way
- Include specific drills, tactical adjustments, or practice exercises
- Use diverse language - avoid repetitive phrases like "With a X% error rate"
- Reference the actual shot counts to give concrete context
- Be direct and conversational, not formulaic
- Focus on the TOP 2-3 weaknesses, not every stat
- If comparison data is provided, USE IT to contextualize performance
- Make comparisons motivating and actionable, not just stating facts

SMART FILTERING:
After your analysis, you can suggest a filter to show specific shots to review.
For example, if you identify overhead errors as a problem, suggest filtering for {"shotType": ["overhead"], "winnerError": "error"}

IMPORTANT: In your analysis text, EXPLICITLY TELL about the filtered shots!
Examples for specific player:
- "I've pulled up your 8 overhead errors - watch these to see the pattern..."
- "Check out the shot list - I filtered to show all 12 of your drive mistakes..."
Examples for everyone:
- "I've pulled up the 8 overhead errors everyone made - watch these to see the pattern..."
- "Check out the shot list - I filtered to show all 12 drive mistakes across all players..."

Make it conversational and clear that you're helping find specific examples to review.

Respond with JSON in this format:
{
  "analysis": "your coaching text here (mention the filtering!)...",
  "suggestedFilter": {"shotType": [...], "winnerError": "..."} or null,
  "filterReason": "brief explanation of why you're showing these shots" or null
}

Make it feel like a real coach talking, not a data report.`
          },
          {
            role: 'user',
            content: `Player asked: "${query}"\n\nPerformance Data:\n${dataSummary}\n\nGive me tactical coaching advice based on this data:`
          }
        ],
        temperature: 0.8,
        max_tokens: 700,
        response_format: { type: 'json_object' },
      });

      console.log('✓ Analysis response received');
      console.log('Tokens used (analysis):', analysisResponse.usage);

      const analysisData = JSON.parse(analysisResponse.choices[0]?.message?.content || '{}');
      console.log('Parsed analysis data:', analysisData);

      let filterExplanation = 'Analysis complete. See tips below.';
      if (analysisData.suggestedFilter && analysisData.filterReason) {
        filterExplanation = `${analysisData.filterReason} - Filtering shots to show you examples.`;
      }

      return NextResponse.json({
        type: 'analysis',
        analysis: analysisData.analysis || 'Unable to generate analysis.',
        filter: analysisData.suggestedFilter || {},
        explanation: filterExplanation,
        success: true
      });
    } else {
      console.log('Processing as FILTER query...');
      // Filter query
      const filterResponse = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: FILTER_SYSTEM_PROMPT },
          { role: 'user', content: query }
        ],
        temperature: 0.1,
        response_format: { type: 'json_object' },
      });

      console.log('✓ Filter response received');
      console.log('Tokens used (filter):', filterResponse.usage);

      const filterText = filterResponse.choices[0]?.message?.content || '{}';
      console.log('Filter JSON:', filterText);

      const filterObject = JSON.parse(filterText) as ShotFilter;
      const explanation = generateExplanation(query, filterObject);

      console.log('Generated explanation:', explanation);

      return NextResponse.json({
        type: 'filter',
        filter: filterObject,
        explanation,
        success: true
      });
    }
  } catch (error) {
    console.error('❌ Error in LLM search API:', error);
    console.error('Error details:', {
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
    });

    return NextResponse.json(
      {
        error: 'Failed to parse query',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json({
    message: 'LLM Search API is running. Use POST with a query parameter.',
    example: {
      method: 'POST',
      body: {
        query: 'show me all winning overhead shots',
      },
    },
  });
}
