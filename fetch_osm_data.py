import requests
import csv
import os
import time
import json

def point_in_polygon(lon, lat, polygon):
    inside = False
    n = len(polygon)
    if n == 0: return False
    p1x, p1y = polygon[0]
    for i in range(1, n + 1):
        p2x, p2y = polygon[i % n]
        if lat > min(p1y, p2y):
            if lat <= max(p1y, p2y):
                if lon <= max(p1x, p2x):
                    if p1y != p2y:
                        xints = (lat - p1y) * (p2x - p1x) / (p2y - p1y) + p1x
                    if p1x == p2x or lon <= xints:
                        inside = not inside
        p1x, p1y = p2x, p2y
    return inside

def in_russian_territory(lat, lon, polygons):
    try:
        lat = float(lat)
        lon = float(lon)
    except (ValueError, TypeError):
        return False
    for poly in polygons:
        if point_in_polygon(lon, lat, poly[0]):
            return True
    return False

if os.path.exists('russian_polygons.json'):
    with open('russian_polygons.json', 'r', encoding='utf-8') as f:
        Russian_POLYGONS = json.load(f)
else:
    Russian_POLYGONS = []

OVERPASS_URL = "http://overpass-api.de/api/interpreter"

def get_osm_data(query_name, query_string, output_dir):
    try:
        headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:153.0) Gecko/20100101 Firefox/153.0"
        }
        proxies = {
            'http': 'socks5h://127.0.0.1:9853',
            'https': 'socks5h://127.0.0.1:9853'
        }
        max_retries = 10
        for attempt in range(max_retries):
            try:
                response = requests.post('https://overpass-api.de/api/interpreter', data=query_string.encode('utf-8'), headers=headers, proxies=proxies, timeout=910)
                if response.status_code == 200:
                    data = response.json()
                    break
                else:
                    print(f"[{query_name}]  {attempt + 1} Код: {response.status_code}. Текст: {response.text[:100].strip()}")
                    if attempt < max_retries - 1:
                        time.sleep(15)
            except Exception as e:
                print(f"[{query_name}]  {attempt + 1} {e}")
                if attempt < max_retries - 1:
                    time.sleep(15)
        else:
            print(f"[{query_name}] {max_retries} .")
            return
        
        output_file = os.path.join(output_dir, f"{query_name}.csv")
        with open(output_file, 'w', encoding='utf-8', newline='') as f:
            writer = csv.writer(f)
            writer.writerow(['osm_id', 'type', 'name', 'minlat', 'minlon', 'maxlat', 'maxlon', 'center_lat', 'center_lon', 'tags'])
            
            elements = data.get('elements', [])
            saved_count = 0
            for element in elements:
                osm_id = element.get('id')
                osm_type = element.get('type')
                
                minlat = minlon = maxlat = maxlon = center_lat = center_lon = ""
                
                if osm_type == 'node':
                    center_lat = element.get('lat', '')
                    center_lon = element.get('lon', '')
                    minlat, maxlat = center_lat, center_lat
                    minlon, maxlon = center_lon, center_lon
                else:
                    bounds = element.get('bounds', {})
                    minlat = bounds.get('minlat', '')
                    minlon = bounds.get('minlon', '')
                    maxlat = bounds.get('maxlat', '')
                    maxlon = bounds.get('maxlon', '')
                    
                    center_lat = element.get('center', {}).get('lat', '')
                    center_lon = element.get('center', {}).get('lon', '')
                    
                tags = element.get('tags', {})
                name = tags.get('name', tags.get('name:uk', tags.get('name:en', 'Unknown')))
                
                if in_russian_territory(center_lat, center_lon, Russian_POLYGONS):
                    continue
                
                writer.writerow([osm_id, osm_type, name, minlat, minlon, maxlat, maxlon, center_lat, center_lon, str(tags)])
                saved_count += 1
        
        print(f"[{query_name}]  {saved_count}  {output_file}")
        

        
    except requests.exceptions.RequestException as e:
        print(f"[{query_name}]  {e}")

if __name__ == "__main__":
    output_directory = ""
    os.makedirs(output_directory, exist_ok=True)
    
    base_query = '[out:json][timeout:900];area["ISO3166-1"="UA"][admin_level=2]->.searchArea;'
    
    queries = {
        "gas_stations": base_query + '(nwr["amenity"="fuel"](area.searchArea););out bb center;'
    }
    
    
    for name, q in queries.items():
        get_osm_data(name, q, output_directory)
        time.sleep(10)
    
