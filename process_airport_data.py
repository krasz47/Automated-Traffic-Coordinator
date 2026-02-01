import re
import json
import os

def parse_coordinate(coord_str):
    # Format: N051.53.05.169 or E000.13.50.011
    # Regex: ([NSEW])(\d{3})\.(\d{2})\.(\d{2})\.(\d{3})
    match = re.match(r'([NSEW])(\d{3})\.(\d{2})\.(\d{2})\.(\d{3})', coord_str)
    if not match:
        return None
    
    direction, deg, mun, sec, ms = match.groups()
    val = float(deg) + float(mun)/60.0 + (float(sec) + float(ms)/1000.0)/3600.0
    
    if direction in ['S', 'W']:
        val = -val
        
    return val

def parse_geo_file(filepath):
    taxiways = {}
    current_name = None
    collecting = False
    
    with open(filepath, 'r', encoding='latin-1') as f:
        lines = f.readlines()
        
    for line in lines:
        line = line.strip()
        if not line:
            continue
            
        if line.startswith(';Taxiway Centrelines'):
            collecting = True
            continue
            
        if collecting:
            if line.startswith('; - '):
                raw_name = line[4:].strip()
                if "Taxiway_Centrelines" in raw_name:
                    parts = raw_name.split('_-_')
                    if len(parts) > 1:
                        current_name = parts[-1]
                    else:
                        current_name = raw_name
                else:
                    current_name = raw_name
                
                if current_name not in taxiways:
                    taxiways[current_name] = []
                continue
                
            parts = line.split()
            if len(parts) >= 4 and parts[0].startswith(('N', 'S')) and parts[1].startswith(('E', 'W')):
                lat1 = parse_coordinate(parts[0])
                lon1 = parse_coordinate(parts[1])
                lat2 = parse_coordinate(parts[2])
                lon2 = parse_coordinate(parts[3])
                
                if current_name and lat1 is not None:
                    taxiways[current_name].append([ [lat1, lon1], [lat2, lon2] ])
                    
    return taxiways

def parse_labels_file(filepath):
    holds = []
    stands = []
    
    current_section = None # 'holds' or 'stands'
    
    with open(filepath, 'r', encoding='latin-1') as f:
        lines = f.readlines()
        
    for line in lines:
        line = line.strip()
        if not line:
            continue
            
        if line.startswith(';Holding Points'):
            current_section = 'holds'
            continue
        elif line.startswith(';Stands'):
            current_section = 'stands'
            continue
            
        # Format: "Label" N... E... type
        # "F1" N051.53.08.300 E000.13.50.000 smrStandHold
        match = re.match(r'"([^"]+)"\s+([NSEW]\d{3}\.\d{2}\.\d{2}\.\d{3})\s+([NSEW]\d{3}\.\d{2}\.\d{2}\.\d{3})', line)
        if match:
            label, lat_str, lon_str = match.groups()
            lat = parse_coordinate(lat_str)
            lon = parse_coordinate(lon_str)
            
            if lat is not None and lon is not None:
                item = {"name": label, "lat": lat, "lon": lon}
                if current_section == 'holds':
                    holds.append(item)
                elif current_section == 'stands':
                    stands.append(item)
                    
    return holds, stands

def main():
    base_dir = '/home/akra/Dev/Automated-Traffic-Coordinator/AirportData/EGSS'
    geo_path = os.path.join(base_dir, 'Geo.txt')
    labels_path = os.path.join(base_dir, 'Labels.txt')
    
    output_path = '/home/akra/Dev/Automated-Traffic-Coordinator/frontend/src/airport_data.json'
    
    taxiways_raw = parse_geo_file(geo_path)
    holds, stands = parse_labels_file(labels_path)
    
    # Format for JSON
    output_data = {
        "EGSS": {
            "taxiways": [],
            "holds": holds,
            "stands": stands,
            "runways": [ # Hardcoded for now based on known EGSS data or extracted if needed
                {"name": "22", "threshold": [51.895, 0.250], "heading": 224},
                {"name": "04", "threshold": [51.875, 0.220], "heading": 44}
            ]
        }
    }
    
    for name, segments in taxiways_raw.items():
        output_data["EGSS"]["taxiways"].append({
            "name": name,
            "type": "Taxiway",
            "coordinates": segments
        })

    with open(output_path, 'w') as f:
        json.dump(output_data, f, indent=4)
        
    print(f"Processed {len(output_data['EGSS']['taxiways'])} taxiways, {len(holds)} holds, {len(stands)} stands.")

if __name__ == "__main__":
    main()
