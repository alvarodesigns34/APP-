/**
 * Descarga un blob y suelta la url.
 *
 * Sin el `revokeObjectURL`, cada exportación deja una copia entera del estado
 * viva en memoria hasta que se recargue el documento — y esto es una PWA que
 * se queda abierta días. Con un histórico largo son varios MB por pulsación.
 *
 * Vive aquí y no en Ajustes porque exportar ya no pasa solo por ahí: la
 * tarjeta de copia de seguridad de Hoy descarga por su cuenta.
 */
export function download(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  // En el mismo turno el navegador aún no ha empezado a leer la url.
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

/** El nombre de fichero que usan todas las exportaciones. */
export function backupFilename(ext: "json" | "csv", now = new Date()): string {
  return `brio-${now.toISOString().slice(0, 10)}.${ext}`;
}
