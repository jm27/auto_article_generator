import { OpenAI } from "openai";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function handleGenerateContent(req, res) {
  try {
    console.log("Received request body:", req.body);
    const { synopsis, title, reviews } = req.body;
    if (!synopsis) {
      console.warn("No synopsis provided in request body.");
      return res.status(400).json({ error: "Synopsis is required" });
    }

    // use first review as context
    let reviewText = "";
    if (Array.isArray(reviews) && reviews.length > 0) {
      const review = reviews[0];
      if (review) {
        reviewText = `\n\nUser Review by ${review.author} (Rating: ${
          review.rating ?? "N/A"
        }):\n"${review.content}"`;
        console.log("Using review for context:", review);
      }
    } else {
      console.log("No reviews provided or reviews array is empty.");
    }

    const prompt = `Write a concise (100–150 word) spoiler‑free summary of the following movie "${title}" synopsis:\n\n"${synopsis}" \n\n use this review as additional context: ${reviewText}\n\nSummary:`;
    console.log("Prompt sent to OpenAI:", prompt);
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content:
            "You are a helpful assistant specializing in concise, spoiler-free movie summaries.",
        },
        { role: "user", content: prompt },
      ],
      temperature: 0.4,
    });
    console.log("OpenAI completion response:", completion);
    if (
      !completion?.choices?.length ||
      !completion?.choices[0]?.message?.content
    ) {
      console.error("No summary returned from OpenAI.");
      return res.status(500).json({ error: "No summary returned" });
    }
    const summary = completion?.choices[0]?.message?.content?.trim();
    if (!summary) {
      console.error("Failed to generate summary from OpenAI response.");
      return res.status(500).json({ error: "Failed to generate summary" });
    }
    console.log("Generated summary:", summary);
    return res.status(200).json({ summary });
  } catch (error) {
    console.error("Error generating content:", error);
    return res.status(500).json({ error: "Internal Server Error" });
  }
}
