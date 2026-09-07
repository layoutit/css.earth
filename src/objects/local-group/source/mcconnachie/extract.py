#!/usr/bin/env python3
"""Reproduce the plain-text membership input from the unchanged author PDF."""
import hashlib
from pathlib import Path
from pypdf import PdfReader
import pypdf

root = Path(__file__).resolve().parent
original = root / 'table1_OCT2019.pdf'
assert pypdf.__version__ == '5.9.0', 'Use the pinned pypdf 5.9.0 extractor.'
assert hashlib.sha256(original.read_bytes()).hexdigest() == '4430d15db2b425265a1becd20d0009cbc884b707bc6fd137e71d7505e006ea16'
text = '\n'.join(page.extract_text() for page in PdfReader(original).pages[:7])
assert text.encode() == (root / 'table1_OCT2019.txt').read_bytes(), 'Membership transcription differs from the original PDF.'
print('ORIGINAL MEMBERSHIP EXTRACTION VERIFIED: October 2019 Table 1, seven pages')
