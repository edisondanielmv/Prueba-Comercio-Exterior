import { SheetPayload } from "../types";

// =========================================================================================
// CONFIGURACIÓN DE CONEXIÓN A GOOGLE SHEETS
// =========================================================================================
// URL proporcionada para el script de Google Apps
// =========================================================================================

const GOOGLE_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbzoiKC7FPoxRVTe5loAI8dx4_oA_96RhiulZ_WZkVN3s7p01k36wqoYt3k1v4IgWs2i/exec"; 

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

  // Check if the URL is properly configured
  if (!GOOGLE_SCRIPT_URL || GOOGLE_SCRIPT_URL.includes("PON_AQUI")) {
      console.warn("Google Sheet URL no configurada. Descargando respaldo local.");
      alert("ATENCIÓN: La conexión a la base de datos no está configurada.\n\nSe descargará un archivo CSV local con tu nota para que se lo envíes a tu profesor.");
      downloadLocalBackup(data);
      return new Promise(resolve => setTimeout(() => resolve(true), 1000));
  }

  // Real submission logic
  try {
      // Using no-cors mode for Google Apps Script Web App compatibility
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
      return true; 
  }
};