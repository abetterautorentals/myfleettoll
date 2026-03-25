import { createClientFromRequest } from 'npm:@base44/sdk@0.8.21';
import Anthropic from 'npm:@anthropic-ai/sdk@0.39.0';
import { PDFDocument } from 'npm:pdf-lib@1.17.1';

const anthropic = new Anthropic({ apiKey: Deno.env.get('ANTHROPIC_API_KEY') });

const PAGE_PROMPT = `You are analyzing ONE PAGE of a rental car contract document (SignNow, Turo, UpCar, RentCentric, DocuSign, or direct rental).

CRITICAL: If this page contains MULTIPLE date ranges (e.g. "Jun 12–Jul 12", "Jul 12–Aug 12", etc.), each date range is a SEPARATE contract — return one entry per date range.

Extract EVERY individual rental contract found on this page. Return null for fields not visible.

For EACH contract extract:
- renter_name: Full legal name of the renter (NOT the owner or company)
- renter_email: Email address
- renter_phone: Phone number
- license_plate: Vehicle plate — remove ALL spaces, uppercase (e.g. "9KWZ508")
- vehicle_make, vehicle_model, vehicle_year, vehicle_color
- start_date: ISO 8601 e.g. "2025-06-12T10:00:00" — look for "Pickup", "Start", "From", "Check-out", "Period Start"
- end_date: ISO 8601 e.g. "2025-07-12T10:00:00" — look for "Return", "End", "To", "Check-in", "Period End"
- platform: "turo" | "upcar" | "rentcentric" | "signnow" | "direct" | "docusign"
- reservation_id: Agreement, confirmation, or reservation number for THIS specific period
- signature_status: "signed" if any signature present, else "pending"
- insurance_company, insurance_policy, insurance_phone

Return ONLY valid JSON: {"contracts": [...], "total_found": N}
If no contract info on this page: {"contracts": [], "total_found": 0}`;

// Split a PDF into individual single-page PDFs and return as base64 strings
async function splitPdfIntoPages(pdfBuffer) {
  const srcDoc = await PDFDocument.load(pdfBuffer, { ignoreEncryption: true });
  const totalPages = srcDoc.getPageCount();
  const pages = [];

  for (let i = 0; i < totalPages; i++) {
    const singlePageDoc = await PDFDocument.create();
    const [copiedPage] = await singlePageDoc.copyPages(srcDoc, [i]);
    singlePageDoc.addPage(copiedPage);
    const pageBytes = await singlePageDoc.save();
    // Convert to base64
    let binary = '';
    const chunk = 8192;
    for (let j = 0; j < pageBytes.length; j += chunk) {
      binary += String.fromCharCode(...pageBytes.slice(j, j + chunk));
    }
    pages.push(btoa(binary));
  }

  return { totalPages, pages };
}

// Extract contracts from a single-page PDF (sent as PDF document to Claude)
async function extractFromPagePdf(base64PagePdf, pageNum, totalPages) {
  console.log(`[extractMultipleContracts] Reading page ${pageNum}/${totalPages}...`);

  const response = await anthropic.messages.create({
    model: 'claude-opus-4-5',
    max_tokens: 2048,
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'document',
            source: {
              type: 'base64',
              media_type: 'application/pdf',
              data: base64PagePdf,
            },
          },
          { type: 'text', text: PAGE_PROMPT },
        ],
      },
    ],
  });

  const rawText = response.content[0]?.text || '';
  try {
    const jsonMatch = rawText.match(/\{[\s\S]*\}/);
    if (jsonMatch) return JSON.parse(jsonMatch[0]);
  } catch (_) {}
  return { contracts: [], total_found: 0 };
}

// Merge contracts found across all pages.
// Same renter+plate with DIFFERENT start_date = separate contracts (extensions/multiple periods).
// Same renter+plate+start_date = same contract, fill in missing fields.
function mergeContracts(allPageResults) {
  const merged = [];
  for (const result of allPageResults) {
    for (const c of (result.contracts || [])) {
      if (!c.renter_name && !c.license_plate && !c.start_date) continue;
      // Match only if same renter/plate AND same start date (same contract, different pages)
      const existing = merged.find(m =>
        m.start_date && c.start_date &&
        m.start_date.slice(0, 10) === c.start_date.slice(0, 10) &&
        (
          (m.renter_name && c.renter_name && m.renter_name === c.renter_name) ||
          (m.license_plate && c.license_plate && m.license_plate === c.license_plate)
        )
      );
      if (existing) {
        // Same contract split across pages — fill in missing fields
        for (const key of Object.keys(c)) {
          if (!existing[key] && c[key]) existing[key] = c[key];
        }
      } else {
        // Different date range = new separate contract
        merged.push({ ...c });
      }
    }
  }
  return merged;
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { file_url } = await req.json();
    if (!file_url) return Response.json({ error: 'file_url required' }, { status: 400 });

    const debugInfo = { method: 'split_pages_pdf', pageCount: null, fileSizeMB: null, error: null };

    // Fetch PDF
    console.log(`[extractMultipleContracts] Fetching: ${file_url}`);
    const pdfRes = await fetch(file_url);
    if (!pdfRes.ok) {
      return Response.json({
        contracts: [], total_found: 0,
        debug: { ...debugInfo, error: `Fetch failed: ${pdfRes.status}` }
      });
    }

    const pdfBuffer = await pdfRes.arrayBuffer();
    const fileSizeMB = parseFloat((pdfBuffer.byteLength / 1024 / 1024).toFixed(2));
    debugInfo.fileSizeMB = fileSizeMB;
    console.log(`[extractMultipleContracts] File size: ${fileSizeMB}MB`);

    // Split into individual page PDFs
    console.log(`[extractMultipleContracts] Splitting PDF into pages...`);
    const { totalPages, pages } = await splitPdfIntoPages(pdfBuffer);
    debugInfo.pageCount = totalPages;
    console.log(`[extractMultipleContracts] ${totalPages} page(s) found`);

    // Process each page individually — never sends the full PDF at once
    const allPageResults = [];
    for (let i = 0; i < pages.length; i++) {
      const pageNum = i + 1;
      const pageSizeMB = (pages[i].length * 0.75 / 1024 / 1024).toFixed(2);
      console.log(`[extractMultipleContracts] Converting page ${pageNum}/${totalPages} to image... (${pageSizeMB}MB)`);
      try {
        const result = await extractFromPagePdf(pages[i], pageNum, totalPages);
        allPageResults.push(result);
      } catch (pageErr) {
        console.error(`[extractMultipleContracts] Page ${pageNum} error:`, pageErr.message);
        // Continue with next page
      }
    }

    // Merge all page results
    console.log(`[extractMultipleContracts] Combining results...`);
    const contracts = mergeContracts(allPageResults).map(normalizeContract);
    console.log(`[extractMultipleContracts] Done! Found ${contracts.length} contract(s)`);

    return Response.json({ contracts, total_found: contracts.length, debug: debugInfo });

  } catch (outerErr) {
    console.error('[extractMultipleContracts] Error:', outerErr.message);
    return Response.json({
      contracts: [],
      total_found: 0,
      debug: { error: outerErr.message, method: 'failed', pageCount: null, fileSizeMB: null }
    }, { status: 500 });
  }
});

function normalizeContract(c) {
  return {
    ...c,
    license_plate: c.license_plate ? c.license_plate.replace(/\s+/g, '').toUpperCase() : '',
    start_date: c.start_date ? c.start_date.slice(0, 16) : '',
    end_date: c.end_date ? c.end_date.slice(0, 16) : '',
    signature_status: c.signature_status || 'signed',
    platform: c.platform || 'signnow',
  };
}