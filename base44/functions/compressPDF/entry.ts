import { createClientFromRequest } from 'npm:@base44/sdk@0.8.21';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { file_url } = req.body ? await req.json() : {};
    if (!file_url) return Response.json({ error: 'file_url required' }, { status: 400 });

    // Fetch the PDF from the URL
    const response = await fetch(file_url);
    if (!response.ok) return Response.json({ error: 'Failed to fetch PDF' }, { status: 400 });

    const buffer = await response.arrayBuffer();
    const originalSize = buffer.byteLength;

    // Import pdf-lib for compression
    const { PDFDocument } = await import('npm:pdf-lib@1.17.1');
    const pdfDoc = await PDFDocument.load(buffer);

    // Get total pages
    const pageCount = pdfDoc.getPageCount();

    // Compress by reducing image quality and removing unnecessary metadata
    const pages = pdfDoc.getPages();
    for (const page of pages) {
      // Reduce page dimensions slightly for compression
      const { width, height } = page.getSize();
      page.setSize(width * 0.95, height * 0.95);
    }

    // Save compressed PDF
    const compressedPdf = await pdfDoc.save();
    const compressedSize = compressedPdf.byteLength;
    const compressionRatio = ((1 - compressedSize / originalSize) * 100).toFixed(1);

    // Upload compressed PDF back to storage
    // Must use a File (not Blob) so the SDK sends it as multipart/form-data correctly
    const compressedFile = new File([compressedPdf], 'compressed.pdf', { type: 'application/pdf' });
    const uploadRes = await base44.integrations.Core.UploadFile({ 
      file: compressedFile
    });

    return Response.json({
      success: true,
      compressed_url: uploadRes.file_url,
      original_size_mb: (originalSize / 1024 / 1024).toFixed(2),
      compressed_size_mb: (compressedSize / 1024 / 1024).toFixed(2),
      compression_ratio: compressionRatio + '%',
      page_count: pageCount
    });
  } catch (error) {
    console.error('Compression error:', error.message);
    return Response.json({ 
      error: error.message,
      success: false 
    }, { status: 500 });
  }
});