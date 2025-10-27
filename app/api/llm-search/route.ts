import { NextRequest, NextResponse } from 'next/server';
import { parseNaturalLanguageQuery } from '@/lib/ollama-client';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { query } = body;

    if (!query || typeof query !== 'string') {
      return NextResponse.json(
        { error: 'Query parameter is required and must be a string' },
        { status: 400 }
      );
    }

    // Parse the natural language query using Ollama
    const filter = await parseNaturalLanguageQuery(query);

    return NextResponse.json({ filter, success: true });
  } catch (error) {
    console.error('Error in LLM search API:', error);
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
