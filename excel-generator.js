import ExcelJS from 'exceljs';

const DIGITAL_STATUS_LABELS = {
  web_y_redes: 'Web Propia + Redes',
  solo_web: 'Solo Sitio Web',
  solo_redes: 'Solo Redes Sociales (Sin Web)',
  sin_web: 'Sin Sitio Web (Solo Maps)'
};

/**
 * Creates and styles a worksheet inside the workbook.
 */
function createStyledSheet(workbook, sheetName, list, headerColorHex) {
  const worksheet = workbook.addWorksheet(sheetName, {
    views: [{ showGridLines: true, state: 'frozen', ySplit: 1 }]
  });

  worksheet.columns = [
    { header: 'Comercio / Negocio', key: 'name', width: 28 },
    { header: 'Rubro / Categoría', key: 'category', width: 20 },
    { header: 'Lugar / Dirección', key: 'address', width: 35 },
    { header: 'Número de Contacto', key: 'phone', width: 20 },
    { header: 'Link WhatsApp', key: 'whatsapp', width: 26 },
    { header: 'Página Web', key: 'website', width: 28 },
    { header: 'Instagram', key: 'instagram', width: 26 },
    { header: 'Facebook', key: 'facebook', width: 26 },
    { header: 'TikTok / LinkedIn', key: 'otherSocial', width: 24 },
    { header: 'Email', key: 'email', width: 26 },
    { header: 'Presencia Digital', key: 'digitalStatus', width: 24 },
    { header: 'Rating', key: 'rating', width: 10 },
    { header: 'Reseñas', key: 'reviews', width: 12 },
    { header: 'Ubicación Google Maps', key: 'mapsUrl', width: 26 },
    { header: 'Estado WhatsApp', key: 'contactStatus', width: 16 },
    { header: 'Fecha Extracción', key: 'date', width: 16 }
  ];

  list.forEach(item => {
    const otherSocial = item.tiktok || item.linkedin || item.twitter || '';
    worksheet.addRow({
      name: item.name || '',
      category: item.category || 'Comercio',
      address: item.address || '',
      phone: item.phone || '',
      whatsapp: item.whatsapp || (item.whatsappPhone ? `https://wa.me/${item.whatsappPhone}` : ''),
      website: item.website || '',
      instagram: item.instagram || '',
      facebook: item.facebook || '',
      otherSocial,
      email: Array.isArray(item.email) ? item.email.join(', ') : (item.email || ''),
      digitalStatus: DIGITAL_STATUS_LABELS[item.digitalStatus] || 'Solo Maps',
      rating: item.rating ? Number(item.rating) : '',
      reviews: item.reviews ? Number(item.reviews) : '',
      mapsUrl: item.mapsUrl || '',
      contactStatus: item.contacted ? 'Contactado' : 'Pendiente',
      date: item.createdAt ? new Date(item.createdAt).toLocaleDateString('es-AR') : new Date().toLocaleDateString('es-AR')
    });
  });

  // Style header row
  const headerRow = worksheet.getRow(1);
  headerRow.height = 28;
  headerRow.eachCell((cell) => {
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: headerColorHex }
    };
    cell.font = {
      name: 'Segoe UI',
      bold: true,
      color: { argb: 'FFFFFFFF' },
      size: 11
    };
    cell.alignment = {
      vertical: 'middle',
      horizontal: 'center',
      wrapText: true
    };
    cell.border = {
      top: { style: 'thin', color: { argb: 'FF475569' } },
      left: { style: 'thin', color: { argb: 'FF475569' } },
      bottom: { style: 'medium', color: { argb: 'FF0F172A' } },
      right: { style: 'thin', color: { argb: 'FF475569' } }
    };
  });

  // Style data rows
  worksheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return;

    row.height = 22;
    const isEven = rowNumber % 2 === 0;

    row.eachCell((cell) => {
      cell.font = {
        name: 'Segoe UI',
        size: 10,
        color: { argb: 'FF1E293B' }
      };

      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: isEven ? 'FFF8FAFC' : 'FFFFFFFF' }
      };

      cell.border = {
        top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        right: { style: 'thin', color: { argb: 'FFE2E8F0' } }
      };

      cell.alignment = {
        vertical: 'middle',
        horizontal: 'left'
      };

      const valStr = cell.value ? cell.value.toString().trim() : '';
      if (valStr.startsWith('http://') || valStr.startsWith('https://')) {
        cell.value = {
          text: valStr,
          hyperlink: valStr
        };
        cell.font = {
          name: 'Segoe UI',
          size: 10,
          color: { argb: 'FF2563EB' },
          underline: true
        };
      }
    });
  });

  // Auto-fit columns
  worksheet.columns.forEach((column) => {
    let maxLength = 12;
    column.eachCell({ includeEmpty: true }, (cell) => {
      let cellLength = 0;
      if (cell.value) {
        if (typeof cell.value === 'object' && cell.value.text) {
          cellLength = cell.value.text.toString().length;
        } else {
          cellLength = cell.value.toString().length;
        }
      }
      if (cellLength > maxLength) {
        maxLength = cellLength;
      }
    });
    column.width = Math.min(48, Math.max(maxLength + 4, column.width || 14));
  });
}

/**
 * Generates a multi-sheet styled Excel report for general Google Maps businesses.
 */
export async function generateExcel(data, filePath) {
  const workbook = new ExcelJS.Workbook();

  const allItems = data || [];
  const withWhatsApp = allItems.filter(item => Boolean(item.whatsappPhone || item.phone || item.whatsapp));
  const withOwnWeb = allItems.filter(item => item.digitalStatus === 'web_y_redes' || item.digitalStatus === 'solo_web');
  const withoutOwnWeb = allItems.filter(item => item.digitalStatus === 'solo_redes' || item.digitalStatus === 'sin_web');

  createStyledSheet(workbook, 'Todos los Comercios', allItems, 'FF4F46E5');       // Indigo
  createStyledSheet(workbook, 'Con WhatsApp y Teléfono', withWhatsApp, 'FF059669'); // Emerald
  createStyledSheet(workbook, 'Con Sitio Web Propio', withOwnWeb, 'FF0284C7');      // Sky Blue
  createStyledSheet(workbook, 'Sin Sitio Web (Oportunidad)', withoutOwnWeb, 'FFD97706'); // Amber

  await workbook.xlsx.writeFile(filePath);
}
