"""Local PDF-only worker. Structured results go to stdout."""
import json
import sys
from pathlib import Path
from docling.document_converter import DocumentConverter, PdfFormatOption
from docling.datamodel.base_models import InputFormat
from docling.datamodel.pipeline_options import PdfPipelineOptions

path = Path(sys.argv[1]).resolve(strict=True)
if path.suffix.lower() != '.pdf':
    raise ValueError('Only local PDF files are accepted')
options = PdfPipelineOptions()
options.do_ocr = True
options.do_table_structure = True
options.enable_remote_services = False
options.document_timeout = 180
converter = DocumentConverter(allowed_formats=[InputFormat.PDF], format_options={InputFormat.PDF: PdfFormatOption(pipeline_options=options)})
result = converter.convert(path)
data = result.document.export_to_dict()
records = []
for item in data.get('texts', []):
    for prov in item.get('prov', []):
        records.append({'page': prov['page_no'], 'text': item.get('text', '')[:4000], 'label': item.get('label', 'text'), 'bbox': prov.get('bbox')})
for table in data.get('tables', []):
    for prov in table.get('prov', []):
        for cell in table.get('data', {}).get('table_cells', []):
            records.append({'page': prov['page_no'], 'text': cell.get('text', '')[:1000], 'label': 'table-cell', 'row': cell.get('start_row_offset_idx'), 'column': cell.get('start_col_offset_idx'), 'bbox': cell.get('bbox')})
print(json.dumps({'engine': 'docling', 'status': str(result.status), 'records': records[:20000]}))
