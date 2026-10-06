export async function extractMeterReading(base64Image: string): Promise<number | null> {
  try {
    const response = await fetch('/api/gemini/extract-meter', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ base64Image }),
    });
    
    if (!response.ok) throw new Error('Failed to extract reading');
    
    const { reading } = await response.json();
    return reading;
  } catch (error) {
    console.error("OCR Error:", error);
    return null;
  }
}
