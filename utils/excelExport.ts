import ExcelJS from 'exceljs';

const ELETROMIDIA_ORANGE = 'FF5500';
const HEADER_TEXT_COLOR = 'FFFFFF';
const ALTERNATE_ROW_COLOR = 'FFF5EE';

/**
 * Creates a workbook with Eletromidia styling and a logo header
 */
export async function createEletromidiaWorkbook(title: string, sheetName: string, partnerLogoUrl?: string | null) {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet(sheetName);

    // 1. Add Eletromidia Logo (Left)
    try {
        const logoUrl = '/assets/logo_full.png';
        const response = await fetch(logoUrl);
        const buffer = await response.arrayBuffer();

        const logoId = workbook.addImage({
            buffer: buffer,
            extension: 'png',
        });

        worksheet.addImage(logoId, {
            tl: { col: 0.2, row: 0.2 },
            ext: { width: 140, height: 35 }
        });
    } catch (error) {
        console.warn('Could not load Eletromidia logo:', error);
    }

    // 2. Add Partner Logo (Right) - If provided
    if (partnerLogoUrl) {
        try {
            const response = await fetch(partnerLogoUrl);
            const buffer = await response.arrayBuffer();

            const partnerLogoId = workbook.addImage({
                buffer: buffer,
                extension: 'png',
            });

            // Position at column H (approx)
            worksheet.addImage(partnerLogoId, {
                tl: { col: 6.5, row: 0.2 },
                ext: { width: 100, height: 35 }
            });
        } catch (error) {
            console.warn('Could not load Partner logo:', error);
        }
    }

    // Set Title in row 2, column C 
    const titleCell = worksheet.getCell('C2');
    titleCell.value = title.toUpperCase();
    titleCell.font = {
        name: 'Arial',
        family: 2,
        size: 16,
        bold: true,
        color: { argb: '333333' }
    };
    titleCell.alignment = { vertical: 'middle', horizontal: 'left' };

    // Add Generation Date in row 3, column C
    const dateCell = worksheet.getCell('C3');
    dateCell.value = `Gerado em: ${new Date().toLocaleString('pt-BR')}`;
    dateCell.font = { name: 'Arial', size: 10, italic: true, color: { argb: '666666' } };

    // Add visual separator (Orange Line)
    worksheet.mergeCells('A5:G5');
    const separator = worksheet.getCell('A5');
    separator.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: ELETROMIDIA_ORANGE }
    };

    return { workbook, worksheet, startRow: 7 };
}

/**
 * Applies Eletromidia style to a table header row
 */
export function styleHeaderRow(row: ExcelJS.Row) {
    row.eachCell((cell) => {
        cell.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: ELETROMIDIA_ORANGE }
        };
        cell.font = {
            color: { argb: HEADER_TEXT_COLOR },
            bold: true,
            name: 'Arial',
            size: 11
        };
        cell.alignment = { vertical: 'middle', horizontal: 'center' };
        cell.border = {
            top: { style: 'thin', color: { argb: 'CC4400' } },
            left: { style: 'thin', color: { argb: 'CC4400' } },
            bottom: { style: 'thin', color: { argb: 'CC4400' } },
            right: { style: 'thin', color: { argb: 'CC4400' } }
        };
    });
    row.height = 25;
}

/**
 * Styles data rows with alternating colors and borders
 */
export function styleDataRows(worksheet: ExcelJS.Worksheet, startRow: number) {
    worksheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
        if (rowNumber < startRow) return;

        const isHeader = rowNumber === startRow;
        if (isHeader) {
            styleHeaderRow(row);
            return;
        }

        row.eachCell((cell) => {
            cell.font = { name: 'Arial', size: 10 };
            cell.border = {
                top: { style: 'thin', color: { argb: 'EEEEEE' } },
                left: { style: 'thin', color: { argb: 'EEEEEE' } },
                bottom: { style: 'thin', color: { argb: 'EEEEEE' } },
                right: { style: 'thin', color: { argb: 'EEEEEE' } }
            };

            if (rowNumber % 2 !== 0) {
                cell.fill = {
                    type: 'pattern',
                    pattern: 'solid',
                    fgColor: { argb: ALTERNATE_ROW_COLOR }
                };
            }
        });
    });
}

/**
 * Auto-fits columns based on content
 */
export function autoFitColumns(worksheet: ExcelJS.Worksheet) {
    worksheet.columns.forEach(column => {
        let maxColumnLength = 0;
        column.eachCell?.({ includeEmpty: true }, (cell) => {
            const columnLength = cell.value ? cell.value.toString().length : 10;
            if (columnLength > maxColumnLength) {
                maxColumnLength = columnLength;
            }
        });
        column.width = Math.min(Math.max(10, maxColumnLength + 2), 50);
    });
}

/**
 * Finalizes and triggers download of the workbook
 */
export async function saveWorkbook(workbook: ExcelJS.Workbook, fileName: string) {
    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url = window.URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = fileName.endsWith('.xlsx') ? fileName : `${fileName}.xlsx`;
    anchor.click();
    window.URL.revokeObjectURL(url);
}
