import { SheetPayload } from "../types";

// =========================================================================================
// URL DE GOOGLE APPS SCRIPT CONFIGURADA
// =========================================================================================

// 👇👇👇 URL CONFIGURADA 👇👇👇
const GOOGLE_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbx4R6rZfE1IvkiZNG6ritTqAacNT1bdm3lv9HD-jn8cAJ66fyvaaGRNmBH-vu9sqtPkjg/exec"; 

/**
 * Helper to download results as a local file if cloud upload is not configured or fails.
 */
const downloadLocalBackup = (data: SheetPayload) => {
    const csvContent = [
        ["Fecha", "Nombre", "Cédula", "Nota", "Total", "Detalles (JSON)"],
        [
            `"${data.timestamp}"`,
            `"${data.studentName}"`,
            `"${data.studentId}"`,
            data.score,
            data.total,
            `"${data.details.replace(/"/g, '""')}"` // Escape quotes for CSV
        ]
    ].map(e => e.join(",")).join("\n");

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", `Resultado_ComercioExterior_${data.studentName.replace(/\s/g, '_')}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
};

export const submitToGoogleSheets = async (data: SheetPayload): Promise<boolean> => {
  console.log("Procesando envío de datos...", data);

  // Check if the URL is still the placeholder or empty
  const isPlaceholderUrl = !GOOGLE_SCRIPT_URL || GOOGLE_SCRIPT_URL.includes("PON_AQUI");

  if (isPlaceholderUrl) {
      console.warn("Google Sheet URL no configurada. Descargando respaldo local.");
      // If the user hasn't set up the backend, we download the file locally
      downloadLocalBackup(data);
      return new Promise(resolve => setTimeout(() => resolve(true), 1500));
  }

  // Real submission logic
  try {
      // Note: Google Apps Script Web Apps often have CORS issues with fetch directly from browser.
      // Standard practice involves 'no-cors'. 
      // With 'no-cors', we can't read the response JSON to confirm success, but the request goes through opaque.
      await fetch(GOOGLE_SCRIPT_URL, {
        method: "POST",
        body: JSON.stringify(data),
        mode: "no-cors", 
        headers: {
            "Content-Type": "text/plain;charset=utf-8",
        },
      });
      console.log("Datos enviados correctamente a Google Sheets");
      return true;
  } catch (error) {
      console.error("Error submitting to Google Sheets", error);
      alert("Hubo un problema de conexión con el servidor de notas. Se descargará una copia local de respaldo.");
      // Fallback to local download if network fails
      downloadLocalBackup(data);
      return true; // We return true because we saved it locally
  }
};