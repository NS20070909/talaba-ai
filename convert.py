from pdf2docx import Converter
import sys

pdf_file = sys.argv[1]
docx_file = sys.argv[2]

cv = Converter(pdf_file)
cv.convert(docx_file)
cv.close()

print("PDF converted to DOCX successfully")