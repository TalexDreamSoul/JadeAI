import { NextRequest, NextResponse } from 'next/server';
import { getServerImageAIConfig } from '@/lib/ai/server-config';
import { getUserIdFromRequest, resolveUser } from '@/lib/auth/helpers';
import { AIUsageInsufficientCreditsError, withMeteredAIUsage } from '@/lib/commercial/ai-route-metering';
import { storeDataUrlObject } from '@/lib/storage/object-storage';

export const maxDuration = 60;

class LinkedInPhotoError extends Error {
  constructor(
    public readonly payload: Record<string, unknown>,
    public readonly status: number
  ) {
    super(String(payload.error || 'generate_failed'));
    this.name = 'LinkedInPhotoError';
  }
}

async function tryStoreGeneratedImage(input: {
  userId: string;
  image: string;
}) {
  try {
    return await storeDataUrlObject({
      key: `linkedin-photo/${input.userId}/${crypto.randomUUID()}`,
      dataUrl: input.image,
      fileNameBase: 'linkedin-photo',
    });
  } catch (error) {
    console.warn('Qiniu upload failed for LinkedIn photo; returning data URL only:', error);
    return null;
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await resolveUser(getUserIdFromRequest(request));
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { image, prompt, requirements, aspectRatio } = await request.json();
    const serverImageAI = getServerImageAIConfig();

    if (!serverImageAI.apiKey) {
      return NextResponse.json(
        { error: 'Cloud image AI is not configured' },
        { status: 400 }
      );
    }

    if (!image || typeof image !== 'string') {
      return NextResponse.json(
        { error: 'Image is required' },
        { status: 400 }
      );
    }

    // Build final prompt with aspect ratio and requirements
    let finalPrompt = prompt;
    if (aspectRatio && aspectRatio !== '1:1') {
      finalPrompt += `\n\nOutput image aspect ratio: ${aspectRatio} (width:height).`;
    }
    if (requirements) {
      finalPrompt += `\n\nAdditional requirements: ${requirements}`;
    }

    // Extract base64 data and mime type from data URL
    const dataUrlMatch = image.match(/^data:(image\/[\w+]+);base64,([\s\S]+)$/);
    const mimeType = dataUrlMatch ? dataUrlMatch[1] : 'image/jpeg';
    const base64Data = dataUrlMatch ? dataUrlMatch[2] : image;

    // Gemini REST API accepts both camelCase and snake_case in requests,
    // but we use camelCase to match the canonical proto-JSON format.
    const endpoint = `${serverImageAI.baseURL.replace(/\/$/, '')}/models/${serverImageAI.model}:generateContent`;
    const result = await withMeteredAIUsage({
      userId: user.id,
      aiConfig: {
        provider: 'gemini',
        model: serverImageAI.model,
        mode: 'server',
      },
      feature: 'linkedin_photo.generate',
      metadata: { aspectRatio: aspectRatio || '1:1', mimeType },
      run: async () => {
        const res = await fetch(`${endpoint}?key=${encodeURIComponent(serverImageAI.apiKey)}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [
              {
                parts: [
                  { text: finalPrompt },
                  {
                    inlineData: {
                      mimeType,
                      data: base64Data,
                    },
                  },
                ],
              },
            ],
            generationConfig: {
              responseModalities: ['TEXT', 'IMAGE'],
            },
          }),
        });

        if (!res.ok) {
          const errBody = await res.text();
          console.error('Gemini API error:', res.status, errBody);

          if (res.status === 400 || res.status === 403) {
            throw new LinkedInPhotoError({ error: 'invalid_key', detail: errBody }, 400);
          }

          throw new LinkedInPhotoError({ error: 'generate_failed', detail: errBody }, res.status);
        }

        const data = await res.json();
        const parts = data?.candidates?.[0]?.content?.parts;

        if (!parts || parts.length === 0) {
          // Check for safety filtering (handle both camelCase and snake_case)
          const candidate = data?.candidates?.[0];
          const finishReason = candidate?.finishReason ?? candidate?.finish_reason;
          if (finishReason === 'SAFETY') {
            throw new LinkedInPhotoError({ error: 'safety_filtered' }, 400);
          }
          console.error('Gemini empty response:', JSON.stringify(data).slice(0, 500));
          throw new LinkedInPhotoError({ error: 'generate_failed', detail: 'No content in response' }, 500);
        }

        // Extract image and text from parts
        // Handle both camelCase (inlineData/mimeType) and snake_case (inline_data/mime_type)
        let resultImage: string | null = null;
        let resultText: string | null = null;

        for (const part of parts) {
          const inlineData = part.inlineData ?? part.inline_data;
          if (inlineData) {
            const mime = inlineData.mimeType ?? inlineData.mime_type ?? 'image/png';
            resultImage = `data:${mime};base64,${inlineData.data}`;
          }
          if (part.text) {
            resultText = part.text;
          }
        }

        if (!resultImage) {
          console.error('Gemini no image in parts:', JSON.stringify(parts.map((p: Record<string, unknown>) => Object.keys(p))));
          throw new LinkedInPhotoError({ error: 'generate_failed', detail: 'No image in response' }, 500);
        }

        const storedImage = await tryStoreGeneratedImage({
          userId: user.id,
          image: resultImage,
        });

        return {
          value: {
            image: resultImage,
            imageUrl: storedImage?.publicRead === false ? null : storedImage?.url || null,
            storage: storedImage ? {
              provider: storedImage.provider,
              size: storedImage.size,
              mimeType: storedImage.mimeType,
              uploadedAt: storedImage.uploadedAt,
            } : null,
            text: resultText,
          },
          metadata: {
            outputMimeType: resultImage.match(/^data:([^;]+);/)?.[1] || null,
            storedIn: storedImage?.provider || 'response',
          },
        };
      },
    });

    return NextResponse.json(result);
  } catch (err) {
    if (err instanceof LinkedInPhotoError) {
      return NextResponse.json(err.payload, { status: err.status });
    }
    if (err instanceof AIUsageInsufficientCreditsError) {
      return NextResponse.json({ error: err.message }, { status: 402 });
    }
    console.error('LinkedIn photo generation error:', err);
    return NextResponse.json(
      { error: 'generate_failed', detail: String(err) },
      { status: 500 }
    );
  }
}
