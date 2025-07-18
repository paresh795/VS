import { db } from "@/db";
import { apiTests } from "@/db/schema";
import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import Replicate from "replicate";

const replicate = new Replicate({
  auth: process.env.REPLICATE_API_TOKEN!,
});

export async function POST(req: NextRequest) {
  const { userId } = auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { imageUrl, prompt, model } = await req.json();
  const startTime = performance.now();

  try {
    const prediction = await replicate.run(
      (model ||
        "stability-ai/sdxl:39ed52f2a78e934b3ba6e2a89f5b1c712de7dfea535525255b1aa35c5565e08b") as `${string}/${string}:${string}`,
      {
        input: {
          image: imageUrl,
          prompt: prompt,
        },
      }
    );

    const endTime = performance.now();
    const processingTime = endTime - startTime;

    await db.insert(apiTests).values({
      userId: userId,
      provider: "replicate",
      model: model || "stability-ai/sdxl",
      inputImageUrl: imageUrl,
      prompt: prompt,
      outputImageUrl: (prediction as any).output,
      processingTime,
      status: "success",
    });

    return NextResponse.json({
      success: true,
      result: (prediction as any).output,
      processingTime,
      provider: "replicate",
    });
  } catch (error: any) {
    const endTime = performance.now();
    const processingTime = endTime - startTime;

    await db.insert(apiTests).values({
      userId: userId,
      provider: "replicate",
      model: model || "stability-ai/sdxl",
      inputImageUrl: imageUrl,
      prompt: prompt,
      processingTime,
      status: "error",
      errorMessage: error.message,
    });

    return NextResponse.json(
      {
        success: false,
        error: error.message,
        processingTime,
        provider: "replicate",
      },
      { status: 500 }
    );
  }
} 