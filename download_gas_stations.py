import requests
import csv
import concurrent.futures
import io
import json

PROXIES = {
    'http': 'socks5h://127.0.0.1:9853',
    'https': 'socks5h://127.0.0.1:9853'
}

def get_details(point):
    point_id = point['id']
    try:
        url = f'https://misto.lun.ua/api/v1/svitlo/points/{point_id}'
        resp = requests.get(url, proxies=PROXIES, timeout=15)
        data = resp.json().get('data', {})
        
        return {
            'id': point_id,
            'name': data.get('name', 'Неизвестная АЗС'),
            'address': data.get('address', 'Адрес не указан'),
            'lat': point['lat'],
            'lng': point['lng']
        }
    except Exception as e:
        pass
    return None

def main():
    print("Загрузка общего списка точек...")
    url = 'https://misto.lun.ua/api/v1/svitlo/points'
    try:
        resp = requests.get(url, proxies=PROXIES, timeout=15)
        all_points = resp.json().get('data', [])
    except Exception as e:
        print("Ошибка загрузки основной карты:", e)
        return

    azs_points = [p for p in all_points if p.get('category') == 9]
    print(f"Найдено {len(azs_points)} АЗС на карте. Скачиваем их данные (займет около минуты)...")

    gas_stations = []
    with concurrent.futures.ThreadPoolExecutor(max_workers=10) as executor:
        results = executor.map(get_details, azs_points)
        for res in results:
            if res:
                gas_stations.append(res)

    print(f"Успешно загружено {len(gas_stations)} заправок.")
    

    output = io.StringIO()
    writer = csv.DictWriter(output, fieldnames=['id', 'name', 'address', 'lat', 'lng'])
    writer.writeheader()
    writer.writerows(gas_stations)
    
    csv_string = output.getvalue()
    
    filename = 'stations_data.js'
    with open(filename, 'w', encoding='utf-8') as f:

        js_content = f"const stationsData = {json.dumps(csv_string)};\n"
        f.write(js_content)
        
    print(f"База данных успешно сохранена в файл {filename}")

if __name__ == "__main__":
    main()
