import { NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// Helper function to detect conversation topic
function detectConversationTopic(userMessage, aiResponse) {
  const text = (userMessage + ' ' + aiResponse).toLowerCase();
  
  if (text.includes('academic') || text.includes('study') || text.includes('exam') || text.includes('grade')) {
    return 'academic_stress';
  } else if (text.includes('relationship') || text.includes('friend') || text.includes('family') || text.includes('partner')) {
    return 'relationships';
  } else if (text.includes('anxiety') || text.includes('worry') || text.includes('nervous')) {
    return 'anxiety';
  } else if (text.includes('depression') || text.includes('sad') || text.includes('lonely') || text.includes('hopeless')) {
    return 'depression';
  } else if (text.includes('sleep') || text.includes('tired') || text.includes('exhausted')) {
    return 'sleep_issues';
  } else if (text.includes('eating') || text.includes('appetite') || text.includes('food')) {
    return 'eating_concerns';
  } else if (text.includes('crisis') || text.includes('help') || text.includes('emergency')) {
    return 'crisis';
  }
  return 'general_wellness';
}

// Helper function to assess risk level
function assessRiskLevel(text) {
  const lowerText = text.toLowerCase();
  
  // High risk indicators
  if (lowerText.includes('suicide') || lowerText.includes('self-harm') || 
      lowerText.includes('crisis') || lowerText.includes('988') ||
      lowerText.includes('emergency')) {
    return 'high';
  }
  
  // Medium risk indicators  
  if (lowerText.includes('counselor') || lowerText.includes('therapy') || 
      lowerText.includes('professional help') || lowerText.includes('severe') ||
      lowerText.includes('overwhelming')) {
    return 'medium';
  }
  
  return 'low';
}

export async function POST(req) {
  try {
    // Check if API key is available
    if (!process.env.GEMINI_API_KEY) {
      console.error('GEMINI_API_KEY is not set in environment variables');
      return NextResponse.json({
        id: `msg-${Date.now()}`,
        role: 'assistant',
        content: "I'm sorry, but my AI service is not properly configured. Please contact support."
      });
    }

    const { messages, userContext } = await req.json();

    if (!messages || messages.length === 0) {
      return NextResponse.json(
        { error: 'Messages are required' },
        { status: 400 }
      );
    }

    // Get the latest user message
    const userMessage = messages[messages.length - 1].content;

    // Default userContext if not provided
    const context = {
      currentMood: userContext?.currentMood || 'unknown',
      recentActivity: userContext?.recentActivity || 'none',
      riskLevel: userContext?.riskLevel || 'low',
      preferences: userContext?.preferences || 'none',
      sessionId: userContext?.sessionId || `session-${Date.now()}`,
      conversationTopic: userContext?.conversationTopic || 'general',
      lastInteraction: userContext?.lastInteraction || new Date().toISOString()
    };

    // List of models to try (free tier compatible)
    const modelsToTry = [
      'gemini-1.5-flash',
      'gemini-1.5-flash-latest', 
      'gemini-pro',
      'models/gemini-1.5-flash'
    ];

    let result;
    let lastError;

    // Enhanced mental health focused prompt with smart routing
    const prompt = `You are a compassionate AI mental health companion for college students integrated into a comprehensive wellness platform.

CONTEXT AWARENESS:
- User's current mood: ${context.currentMood}
- Recent platform activity: ${context.recentActivity}
- Risk assessment: ${context.riskLevel}
- User preferences: ${context.preferences}
- Session ID: ${context.sessionId}
- Conversation topic: ${context.conversationTopic}

ENHANCED RESPONSIBILITIES:
- Provide emotional support and active listening
- Offer personalized coping strategies based on user context
- SMARTLY ROUTE users to other platform features when appropriate
- Suggest peer forum topics or professional booking based on conversation flow
- Track conversation sentiment for escalation triggers
- Recommend resources from the education hub when relevant

SMART ROUTING GUIDELINES:
- If user mentions academic stress: Suggest connecting with students in peer forum
- If conversation indicates moderate/high distress: Recommend professional counseling booking
- After providing coping strategies: Offer to save techniques to personal wellness plan
- If user shows interest in learning: Recommend education hub resources
- For social isolation: Suggest anonymous peer forums or group sessions
- For crisis indicators: Immediately provide crisis resources and professional help options

RESPONSE FORMAT:
Provide your caring response, then if contextually relevant, add suggested actions using this exact format:

SUGGESTED ACTIONS:
- [Action Name]: Brief description of what this action does
- [Another Action]: Brief description if relevant

IMPORTANT GUIDELINES:
- Always acknowledge the person's feelings as valid
- If someone mentions self-harm, suicide, or crisis, immediately provide crisis resources (988 Suicide & Crisis Lifeline)
- Keep responses conversational, warm, and under 250 words
- Suggest professional therapy or counseling when appropriate
- Don't diagnose or provide medical advice
- Focus on emotional support and evidence-based coping strategies
- Only suggest actions when they would genuinely help the user

Student message: "${userMessage}"
Current context: ${JSON.stringify(context)}

Respond as a caring mental health companion with smart routing:`;

    // Try different models until one works
    for (const modelName of modelsToTry) {
      try {
        console.log(`Trying model: ${modelName}`);
        const model = genAI.getGenerativeModel({ model: modelName });
        
        console.log('Calling Gemini API with user message:', userMessage);
        console.log('User context:', context);
        result = await model.generateContent(prompt);
        
        // If we get here, the model worked
        console.log('Successfully got response from model:', modelName);
        break;
        
      } catch (error) {
        console.log(`Model ${modelName} failed:`, error.message);
        lastError = error;
        continue;
      }
    }

    // If no model worked, throw the last error
    if (!result) {
      console.error('All models failed. Last error:', lastError);
      throw lastError || new Error('All models failed');
    }
    
    const response = await result.response;
    const text = response.text();

    console.log('Gemini API response received successfully:', text.substring(0, 100) + '...');

    // Parse AI response for suggested actions
    let suggestedActions = [];
    let cleanText = text;
    let contextualRouting = false;

    // Extract suggested actions if present
    if (text.includes('SUGGESTED ACTIONS:')) {
      const sections = text.split('SUGGESTED ACTIONS:');
      cleanText = sections[0].trim();
      const actionSection = sections[1];
      contextualRouting = true;
      
      // Parse suggested actions
      if (actionSection) {
        const actions = actionSection.split('\n').filter(line => line.trim().startsWith('-'));
        suggestedActions = actions.map(action => {
          const actionText = action.replace('- ', '').trim();
          const colonIndex = actionText.indexOf(': ');
          
          if (colonIndex > -1) {
            const title = actionText.substring(0, colonIndex).replace(/\[|\]/g, '').trim();
            const description = actionText.substring(colonIndex + 2).trim();
            return { 
              title, 
              description,
              action: title.toLowerCase().replace(/\s+/g, '_')
            };
          } else {
            return { 
              title: actionText.replace(/\[|\]/g, '').trim(), 
              description: '',
              action: actionText.toLowerCase().replace(/\s+/g, '_')
            };
          }
        }).filter(action => action.title.length > 0);
      }
    }

    // Detect conversation topic and risk level from response
    const detectedTopic = detectConversationTopic(userMessage, cleanText);
    const riskLevel = assessRiskLevel(cleanText);

    // Return enhanced response structure
    return NextResponse.json({
      id: `msg-${Date.now()}`,
      role: 'assistant',
      content: cleanText,
      suggestedActions: suggestedActions,
      contextualRouting: contextualRouting,
      metadata: {
        detectedTopic,
        riskLevel,
        sessionId: context.sessionId,
        timestamp: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('Detailed error calling Gemini API:', {
      message: error.message,
      stack: error.stack,
      name: error.name
    });
    
    // More specific fallback response based on error type
    let fallbackMessage = "I'm here to listen and support you. It seems I'm having trouble connecting right now, but please know that your feelings are important. If you're in crisis, please reach out to the 988 Suicide & Crisis Lifeline or contact emergency services.";
    
    if (error.message?.includes('API_KEY')) {
      fallbackMessage = "I'm experiencing a configuration issue. Please try again in a moment or contact support if the problem persists.";
    } else if (error.message?.includes('quota')) {
      fallbackMessage = "I'm temporarily unavailable due to high usage. Please try again in a few minutes.";
    }
    
    return NextResponse.json({
      id: `msg-${Date.now()}`,
      role: 'assistant', 
      content: fallbackMessage
    });
  }
}