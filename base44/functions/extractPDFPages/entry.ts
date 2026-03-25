import { createClientFromRequest } from 'npm:@base44/sdk@0.8.21';
import { getDocument } from 'npm:pdfjs-dist@4.0.269';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { file_url } = await req.json();
    if (!file_url) return Response.json({ error: 'Missing file_url' }, { status: 400 });

    console.log(`[extractPDFPages] Fetching PDF from ${file_url}`);

    // Fetch PDF as binary
    const pdfRes = await fetch(file_url);
    if (!pdfRes.ok) return Response.json({ error: 'Failed to fetch PDF' }, { status: 400 });

    const pdfBuffer = await pdfRes.arrayBuffer();
    console.log(`[extractPDFPages] PDF size: ${(pdfBuffer.byteLength / 1024 / 1024).toFixed(2)}MB`);

    // Load PDF
    const pdf = await getDocument({ data: new Uint8Array(pdfBuffer) }).promise;
    const pageCount = pdf.numPages;

    console.log(`[extractPDFPages] Total pages: ${pageCount}`);

    const pages = [];
    for (let i = 1; i <= pageCount; i++) {
      const page = await pdf.getPage(i);
      const viewport = page.getViewport({ scale: 1.5 }); // 150dpi equivalent

      // Render to canvas
      const canvas = new OffscreenCanvas(Math.floor(viewport.width), Math.floor(viewport.height));
      const context = canvas.getContext('2d');

      const renderContext = {
        canvasContext: context,
        viewport: viewport,
      };

      await page.render(renderContext).promise;

      // Convert canvas to JPEG blob (compressed)
      const blob = await canvas.convertToBlob({
        type: 'image/jpeg',
        quality: 0.75, // JPEG compression to keep under 500KB per page
      });

      // Convert blob to base64 data URL
      const arrayBuffer = await blob.arrayBuffer();
      const uint8Array = new Uint8Array(arrayBuffer);
      const binaryString = String.fromCharCode.apply(null, uint8Array);
      const base64 = btoa(binaryString);
      const dataUrl = `data:image/jpeg;base64,${base64}`;

      pages.push({
        page_num: i,
        total_pages: pageCount,
        size_kb: Math.round(blob.size / 1024),
        data_url: dataUrl,
      });

      console.log(`[extractPDFPages] Page ${i}/${pageCount} rendered - ${Math.round(blob.size / 1024)}KB`);
    }

    return Response.json({
      success: true,
      page_count: pageCount,
      pages: pages,
    });

  } catch (error) {
    console.error('[extractPDFPages] Error:', error);
    return Response.json({
      error: error.message || 'PDF extraction failed',
    }, { status: 500 });
  }
});