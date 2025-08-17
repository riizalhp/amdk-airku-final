const { GoogleGenerativeAI } = require("@google/genai");

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

async function classifyRegionFromCoords(location) {
    const model = genAI.getGenerativeModel({ model: "gemini-pro" });
    const prompt = `
        Berdasarkan koordinat latitude ${location.lat} dan longitude ${location.lng}, 
        dan mengetahui bahwa kantor pusat PDAM Tirta Binangun Kulon Progo ada di longitude 110.1486773, 
        klasifikasikan apakah lokasi tersebut masuk ke wilayah "Timur" atau "Barat". 
        Jika lokasi berada di luar kabupaten Kulon Progo, DIY, Indonesia, klasifikasikan sebagai "Bukan di Kulon Progo".
        Hanya berikan satu jawaban: "Timur", "Barat", atau "Bukan di Kulon Progo".
    `;

    try {
        const result = await model.generateContent(prompt);
        const response = await result.response;
        const text = response.text().trim();
        return text;
    } catch (error) {
        console.error("Error calling Gemini API:", error);
        throw new Error("Gagal berkomunikasi dengan layanan klasifikasi wilayah.");
    }
}

module.exports = { classifyRegionFromCoords };