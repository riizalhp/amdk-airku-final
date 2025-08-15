
const { GoogleGenAI, Type } = require("@google/genai");

if (!process.env.API_KEY) {
  throw new Error("API_KEY environment variable not set");
}

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

async function classifyStoreRegion(storeLocation) {
  const pdamKulonProgoLongitude = 110.1486773;

  const prompt = `
    You are a geographical data analyst for KU AIRKU, a water distributor in Kulon Progo Regency, Yogyakarta, Indonesia.
    Your task is to classify a new store location into one of our two sales territories: 'Timur' (East) or 'Barat' (West), or determine if it's outside our service area.

    Here are the rules:
    1.  Our service area is strictly within Kulon Progo Regency. A very rough bounding box for Kulon Progo is between latitudes -7.67 to -8.00 and longitudes 110.00 to 110.30.
    2.  The dividing line for our territories is the longitude of our main office, PDAM Tirta Binangun, which is at longitude ${pdamKulonProgoLongitude}.
    3.  Any location east of this longitude is 'Timur'.
    4.  Any location west of this longitude is 'Barat'.
    5.  Any location outside the Kulon Progo bounding box is 'Bukan di Kulon Progo'.

    A new store has been added at this location:
    ${JSON.stringify(storeLocation)}

    Follow these steps:
    1.  Check if the new store's latitude is between -7.67 and -8.00 AND its longitude is between 110.00 and 110.30.
    2.  If it is NOT within this bounding box, classify it as 'Bukan di Kulon Progo'.
    3.  If it IS within the bounding box, compare its longitude to the dividing line (${pdamKulonProgoLongitude}).
    4.  If the store's longitude is greater than ${pdamKulonProgoLongitude}, classify it as 'Timur'.
    5.  If the store's longitude is less than or equal to ${pdamKulonProgoLongitude}, classify it as 'Barat'.

    Return a JSON object with a single key "region" and the classified territory name as its value (either 'Timur', 'Barat', or 'Bukan di Kulon Progo').
  `;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            region: { type: Type.STRING },
          },
        },
      },
    });
    
    // The response.text is a string containing JSON, so we parse it.
    return JSON.parse(response.text);
  } catch (error) {
    console.error("Error classifying store region from Gemini Service:", error);
    // Rethrow a more generic error to not expose implementation details to the client
    throw new Error("Failed to communicate with the AI service.");
  }
}


module.exports = {
    classifyStoreRegion,
};