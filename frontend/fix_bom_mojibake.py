#!/usr/bin/env python3
"""Fix BOM + mojibake UTF-8/Windows-1252 in JSX/JS source files."""
import os, sys

SRC_DIR = '/app/src'
EXTS = {'.js', '.jsx', '.ts', '.tsx'}
SKIP = {'encoding.test.js', 'scan_encoding.js', 'fix_encoding.js', 'fix_bom_mojibake.py'}

def fix_file(path):
    with open(path, 'rb') as f:
        data = f.read()
    # Strip BOM
    if data[:3] == b'\xef\xbb\xbf':
        data = data[3:]
    text = data.decode('utf-8')
    # Fix mojibake: latin-1 re-interpreted as UTF-8
    try:
        fixed = text.encode('latin-1').decode('utf-8')
    except (UnicodeEncodeError, UnicodeDecodeError):
        return False, 'encode_error'
    if fixed == text:
        return False, 'no_change'
    with open(path, 'w', encoding='utf-8', newline='\n') as f:
        f.write(fixed)
    return True, 'fixed'

total_fixed = 0
for root, dirs, files in os.walk(SRC_DIR):
    dirs[:] = [d for d in dirs if d not in {'node_modules', '.vite', 'dist', 'coverage'}]
    for fname in files:
        if fname in SKIP:
            continue
        ext = os.path.splitext(fname)[1].lower()
        if ext not in EXTS:
            continue
        path = os.path.join(root, fname)
        changed, reason = fix_file(path)
        if changed:
            print(f'Fixed: {path.replace(SRC_DIR, "src/")}')
            total_fixed += 1

print(f'Total fixed: {total_fixed}')
