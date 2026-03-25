import { createClientFromRequest } from 'npm:@base44/sdk@0.8.21';
import { jsPDF } from 'npm:jspdf@4.0.0';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { images } = await req.json();
    if (!images || !Array.isArray(images) || images.length === 0) {
      return Response.json({ error: 'No images provided' }, { status: 400 });
    }

    console.log(`[scannerBuildPDF] Building PDF with ${images.length} pages`);

    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'letter', compress: true });

    for (let i = 0; i < images.length; i++) {
      if (i > 0) doc.addPage();
      const dataUrl = images[i];
      // Strip prefix to get base64
      const base64 = dataUrl.includes(',') ? dataUrl.split(',')[1] : dataUrl;
      const format = dataUrl.startsWith('data:image/png') ? 'PNG' : 'JPEG';
      doc.addImage(base64, format, 0, 0, 215.9, 279.4); // letter size mm
    }

    const pdfBytes = doc.output('arraybuffer');
    const pdfBlob = new Blob([pdfBytes], { type: 'application/pdf' });

    const uploadRes = await base44.integrations.Core.UploadFile({ file: pdfBlob });
    console.log(`[scannerBuildPDF] PDF uploaded: ${uploadRes.file_url}`);

    return Response.json({ success: true, file_url: uploadRes.file_url });
  } catch (error) {
    console.error('[scannerBuildPDF] Error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});