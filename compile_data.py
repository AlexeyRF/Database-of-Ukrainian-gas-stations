import os
import csv
import json

old_data_path = 'stations_data.js'

datasets = {
    'lun_gas_stations': [],
    'osm_factories': [],
    'osm_railway_stations': [],
    'osm_substations': [],
    'osm_logistics': [],
    'osm_gas_stations': []
}

if os.path.exists(old_data_path):
    with open(old_data_path, 'r', encoding='utf-8') as f:
        content = f.read()
        start = content.find('const stationsData = "') + len('const stationsData = "')
        end = content.rfind('"')
        if start != -1 and end != -1:
            csv_str = content[start:end]
            csv_str = csv_str.replace('\\r\\n', '\n').replace('\\n', '\n')
            try:
                import ast
                full_str = content[content.find('=') + 1 : content.rfind(';')]
                csv_str = json.loads(full_str.strip())
            except:
                pass
                
            reader = csv.DictReader(csv_str.splitlines())
            for row in reader:
                try:
                    datasets['lun_gas_stations'].append({
                        'id': row.get('id', ''),
                        'name': row.get('name', ''),
                        'address': row.get('address', ''),
                        'lat': float(row.get('lat', 0)),
                        'lng': float(row.get('lng', 0))
                    })
                except:
                    pass

file_mapping = {
    'factories.csv': 'osm_factories',
    'railway_stations.csv': 'osm_railway_stations',
    'substations.csv': 'osm_substations',
    'logistics_and_warehouses.csv': 'osm_logistics',
    'gas_stations.csv': 'osm_gas_stations'
}

for filename, key in file_mapping.items():
    filepath = os.path.join(filename)
    if os.path.exists(filepath):
        with open(filepath, 'r', encoding='utf-8') as f:
            reader = csv.DictReader(f)
            for row in reader:
                try:
                    lat_str = row.get('center_lat')
                    lng_str = row.get('center_lon')
                    
                    if not lat_str or not lng_str:
                        lat_str = row.get('minlat')
                        lng_str = row.get('minlon')
                    
                    if not lat_str or not lng_str:
                        continue
                        
                    lat = float(lat_str)
                    lng = float(lng_str)
                    
                    datasets[key].append({
                        'id': row.get('osm_id', ''),
                        'name': row.get('name', 'Невідомо'),
                        'lat': lat,
                        'lng': lng
                    })
                except Exception as e:
                    pass

with open('compiled_datasets.js', 'w', encoding='utf-8') as f:
    f.write("const compiledDatasets = " + json.dumps(datasets) + ";\n")
print(f"Compiled {sum(len(v) for v in datasets.values())} total points.")
