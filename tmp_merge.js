
async function mergeAndPrintPapers(pdfUrls, sessionName) {
    if (typeof Swal !== 'undefined') {
        Swal.fire({
            title: 'Hazırlanıyor...',
            text: 'Soru kağıtları birleştiriliyor, lütfen bekleyin.',
            allowOutsideClick: false,
            didOpen: () => { Swal.showLoading() }
        });
    }

    try {
        const { PDFLib, DataManager } = window;
        const mergedPdf = await PDFLib.PDFDocument.create();
        
        for (const item of pdfUrls) {
            try {
                const bytes = await DataManager.getFileBytes(item.url);
                if (!bytes) continue;
                const pdf = await PDFLib.PDFDocument.load(bytes);
                const copiedPages = await mergedPdf.copyPages(pdf, pdf.getPageIndices());
                copiedPages.forEach((page) => mergedPdf.addPage(page));
            } catch (err) {
                console.error("PDF load error:", item.url, err);
            }
        }

        const mergedPdfBytes = await mergedPdf.save();
        const blob = new Blob([mergedPdfBytes], { type: 'application/pdf' });
        const url = URL.createObjectURL(blob);
        
        if (typeof Swal !== 'undefined') Swal.close();
        
        if (window.openSafePdf) {
            window.openSafePdf(url, sessionName + ' - Soru Kağıtları');
        } else {
            window.open(url, '_blank');
        }
    } catch (err) {
        if (typeof Swal !== 'undefined') {
            Swal.close();
            Swal.fire('Hata', 'Soru kağıtları birleştirilemedi: ' + err.message, 'error');
        }
        console.error("Merge error:", err);
    }
}
