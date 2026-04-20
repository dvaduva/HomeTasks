#!/usr/bin/env python3
"""
Parser for Transport Public Ilfov bus schedule PDFs.
Converts PDF timetables into structured JSON files.

Usage:
    python parse_schedule_pdf.py <pdf_file> [output.json]

The script auto-detects route number, direction, stations and all departure times
for Lucru (workdays), Sambata (Saturday) and Duminica (Sunday).

Requirements:
    pip install pdfplumber
"""

import pdfplumber
import json
import sys
import re
import os


def parse_hours_row(header_row):
    """
    Parse the 'Ore' header row to extract hour labels.
    
    For Lucru tables, hours are individual: ['Ore', '4', '5', '6', ...]
    For Sambata/Duminica, hours may be grouped: ['Ore', '4 5 6', None, None, '7 8 9', ...]
    
    Returns a list of hour strings in order, matching the data columns.
    """
    hours = []
    for cell in header_row[1:]:  # skip 'Ore' label
        if cell is None:
            continue
        cell = cell.strip()
        if not cell:
            continue
        # Could be "4" or "4 5 6"
        parts = cell.split()
        hours.extend(parts)
    return hours


def parse_minutes_cell(cell):
    """
    Parse a minutes cell which contains newline-separated minute values.
    Returns a list of minute strings like ['05', '20', '35', '50'].
    Empty/None cells return empty list.
    """
    if not cell or not cell.strip():
        return []
    # Clean up: remove MINUTE label artifacts
    cleaned = cell.strip()
    # The first cell often contains "M\nI\nN\nU\nT\nE" - skip if so
    if cleaned.startswith('M\n') or cleaned == 'M':
        return []
    # Split by newline
    parts = cleaned.split('\n')
    minutes = []
    for p in parts:
        p = p.strip()
        # Filter out non-numeric artifacts (like 'M', 'I', 'N', 'U', 'T', 'E', 'ANI')
        if p and re.match(r'^\d{1,2}$', p):
            minutes.append(p.zfill(2))
    return minutes


def parse_schedule_table(table):
    """
    Parse a schedule table (Lucru, Sambata, or Duminica).

    Table structure:
      Row 0: Day type label (Lucru/Sambata/Duminica) - may have encoded chars
      Row 1: Hours header ['Ore', '4', '5', ...]
      Row 2..N: Minutes data. Each hour column may span multiple rows, one
                minute per cell. The first column of these rows usually holds
                the vertical 'MINUTE' label ('M','I','N','U','T','E').
                Example:
                    ['M', '00', '05', ...]
                    ['I', '10', '20', ...]
                    ['N', '24', '35', ...]
                    ...
                pdfplumber sometimes joins all minutes into a single cell with
                newlines; we handle both representations.

    Returns dict: { "5": ["00", "10", "24", ...], "6": ["05", "20", ...], ... }
    All minutes in an hour column are collected across every data row.
    """
    if len(table) < 3:
        return {}

    header_row = table[1]

    if not header_row or header_row[0] != 'Ore':
        return {}

    hours = parse_hours_row(header_row)

    # Accumulate minutes per hour, preserving hour order.
    acc = {hour: [] for hour in hours}

    for data_row in table[2:]:
        if not data_row:
            continue
        # Skip first column (vertical MINUTE label or padding).
        data_cells = data_row[1:]
        # Filter None cells so positions align with the flattened hours list.
        non_none_data = [c for c in data_cells if c is not None]
        for i, hour in enumerate(hours):
            if i < len(non_none_data):
                acc[hour].extend(parse_minutes_cell(non_none_data[i]))

    # Drop empty hours and dedupe while preserving order.
    schedule = {}
    for hour, mins in acc.items():
        if not mins:
            continue
        seen = set()
        unique = []
        for m in mins:
            if m not in seen:
                seen.add(m)
                unique.append(m)
        schedule[hour] = unique

    return schedule


def detect_day_type(table):
    """Detect if table is Lucru, Sambata or Duminica from first row."""
    if not table or len(table) < 1:
        return None
    label = str(table[0][0] or '') + str(table[0][1] or '')
    label_lower = label.lower()
    # The labels use special encoded fonts, so we check for patterns
    if 'lucr' in label_lower or '\uf075\uf063r\uf075' in label:
        return 'Lucru'
    elif 'mb' in label_lower or '\uf0e2' in label or 'samb' in label_lower or 'S\uf0e2' in label:
        return 'Sambata'
    elif 'umin' in label_lower or '\uf069\uf06e\uf069' in label or 'dumi' in label_lower or 'D\uf075\uf06d' in label:
        return 'Duminica'
    return None


def parse_page(page):
    """
    Parse a single PDF page.
    
    Returns:
        station_name: str
        schedules: dict with keys 'Lucru', 'Sambata', 'Duminica'
    """
    text = page.extract_text() or ''
    
    # Station name is the first line
    lines = text.strip().split('\n')
    station_name = lines[0].strip() if lines else 'UNKNOWN'
    
    # Extract tables
    tables = page.extract_tables()
    
    if len(tables) < 2:
        return station_name, {}
    
    schedules = {}
    
    # Tables 1, 2, 3 are Lucru, Sambata, Duminica respectively
    for table in tables[1:]:  # skip header table (table 0)
        if len(table) < 3:
            continue
        day_type = detect_day_type(table)
        if day_type:
            schedule = parse_schedule_table(table)
            if schedule:
                schedules[day_type] = schedule
    
    return station_name, schedules


def extract_route_info(pdf_path):
    """Extract route number and direction from the first page."""
    with pdfplumber.open(pdf_path) as pdf:
        if not pdf.pages:
            return None, None, None
        
        text = pdf.pages[0].extract_text() or ''
        lines = text.strip().split('\n')
        
        # Route number is typically on the same line or near "Plecari spre"
        route_number = None
        direction = None
        
        for line in lines[:5]:
            # Look for route number (3-digit number alone on a line)
            num_match = re.match(r'^(\d{3})$', line.strip())
            if num_match:
                route_number = int(num_match.group(1))
            
            # Look for direction
            if 'Plecari spre' in line:
                direction = line.replace('Plecari spre', '').strip()
        
        # First line is typically the starting station
        start_station = lines[0].strip() if lines else None
        
        return route_number, direction, start_station


def parse_pdf(pdf_path):
    """
    Parse an entire bus schedule PDF file.
    
    Returns a structured dict ready for JSON serialization.
    """
    route_number, direction, start_station = extract_route_info(pdf_path)

    all_stations = []
    all_departures = {}

    # All departures from a given station on this route go to the same final
    # destination (the direction extracted from page 1). Wrap each day's
    # schedule under that key so the consumer (transport UI) can iterate
    # destinations uniformly across routes.
    destination = direction or 'UNKNOWN'

    with pdfplumber.open(pdf_path) as pdf:
        for page_num, page in enumerate(pdf.pages):
            station_name, schedules = parse_page(page)

            if station_name and station_name not in all_stations:
                all_stations.append(station_name)

            if schedules:
                all_departures[station_name] = {
                    day_type: {destination: sched}
                    for day_type, sched in schedules.items()
                }
    
    # Build direction string
    if direction and start_station:
        dir_str = f"{start_station} -> {direction}"
    else:
        dir_str = direction or "UNKNOWN"
    
    result = {
        "route": route_number,
        "direction": dir_str,
        "operator": "Transport Public Ilfov",
        "note": "Datele au caracter orientativ: respectarea orelor afisate depinde de conditiile de trafic de pe traseu.",
        "stations_order": all_stations,
        "departures": all_departures
    }
    
    return result


def main():
    if len(sys.argv) < 2:
        print("Usage: python parse_schedule_pdf.py <pdf_file> [output.json]")
        print("  Parses a Transport Public Ilfov bus schedule PDF into JSON.")
        sys.exit(1)
    
    pdf_path = sys.argv[1]
    
    if not os.path.exists(pdf_path):
        print(f"Error: File not found: {pdf_path}")
        sys.exit(1)
    
    # Default output name based on PDF name
    if len(sys.argv) >= 3:
        output_path = sys.argv[2]
    else:
        base = os.path.splitext(os.path.basename(pdf_path))[0]
        output_path = f"{base}.json"
    
    print(f"Parsing: {pdf_path}")
    result = parse_pdf(pdf_path)
    
    print(f"Route: {result['route']}")
    print(f"Direction: {result['direction']}")
    print(f"Stations found: {len(result['stations_order'])}")
    
    # Count total departure entries across stations / days / destinations.
    total_entries = 0
    for schedules in result['departures'].values():
        for dests in schedules.values():
            for hours in dests.values():
                for minutes in hours.values():
                    total_entries += len(minutes)
    print(f"Total departure entries: {total_entries}")
    
    with open(output_path, 'w', encoding='utf-8') as f:
        json.dump(result, f, ensure_ascii=False, indent=2)
    
    print(f"Output saved to: {output_path}")


if __name__ == '__main__':
    main()
