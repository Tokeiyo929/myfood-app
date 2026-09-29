import cgi
import json
import os
import uuid
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import parse_qs, urlparse

import psycopg
from PIL import ExifTags, Image
from pillow_heif import register_heif_opener
from psycopg.rows import dict_row
from qcloud_cos import CosConfig, CosS3Client

register_heif_opener()


ROOT = os.path.dirname(os.path.abspath(__file__))
with open(os.path.join(ROOT, 'config.json'), encoding='utf-8') as file:
    CONFIG = json.load(file)

schema_ready = False


def coordinate(value, ref):
    degrees, minutes, seconds = map(float, value)
    result = degrees + minutes / 60 + seconds / 3600
    return -result if ref in ('S', 'W') else result


def read_image_metadata(file):
    with Image.open(file) as image:
        exif = image.getexif()
        metadata = {}
        taken_at = exif.get_ifd(ExifTags.IFD.Exif).get(ExifTags.Base.DateTimeOriginal) or exif.get(ExifTags.Base.DateTime)
        if taken_at:
            metadata['taken_at'] = taken_at
        gps = exif.get_ifd(ExifTags.IFD.GPSInfo)
        latitude, latitude_ref = gps.get(ExifTags.GPS.GPSLatitude), gps.get(ExifTags.GPS.GPSLatitudeRef)
        if latitude and latitude_ref:
            metadata['latitude'] = coordinate(latitude, latitude_ref)
        longitude, longitude_ref = gps.get(ExifTags.GPS.GPSLongitude), gps.get(ExifTags.GPS.GPSLongitudeRef)
        if longitude and longitude_ref:
            metadata['longitude'] = coordinate(longitude, longitude_ref)
        return metadata


def db():
    global schema_ready
    conn = psycopg.connect(os.environ['DATABASE_URL'], row_factory=dict_row)
    conn.autocommit = True
    if not schema_ready:
        with conn.cursor() as cursor:
            cursor.execute("CREATE TABLE IF NOT EXISTS foods (id SERIAL PRIMARY KEY, name VARCHAR(255) NOT NULL, brand_name VARCHAR(255) NOT NULL DEFAULT '', price NUMERIC(10, 2), categories TEXT NOT NULL DEFAULT '[]', ingredients TEXT NOT NULL, flavors TEXT NOT NULL, preference VARCHAR(32) NOT NULL, reason VARCHAR(500) NOT NULL DEFAULT '', repurchase_count INTEGER NOT NULL DEFAULT 0, image_path VARCHAR(500) NOT NULL DEFAULT '', image_metadata TEXT NOT NULL DEFAULT '{}', client_key VARCHAR(64) NOT NULL DEFAULT '')")
            cursor.execute("ALTER TABLE foods ADD COLUMN IF NOT EXISTS client_key VARCHAR(64) NOT NULL DEFAULT ''")
            cursor.execute("UPDATE foods AS food SET client_key = '' WHERE client_key <> '' AND EXISTS (SELECT 1 FROM foods AS earlier WHERE earlier.client_key = food.client_key AND earlier.id < food.id)")
            cursor.execute("CREATE UNIQUE INDEX IF NOT EXISTS foods_client_key_unique ON foods (client_key) WHERE client_key <> ''")
            cursor.execute("CREATE TABLE IF NOT EXISTS categories (id SERIAL PRIMARY KEY, name VARCHAR(255) UNIQUE NOT NULL, parentcategories VARCHAR(255) NOT NULL DEFAULT '')")
            cursor.execute("CREATE TABLE IF NOT EXISTS ingredients (id SERIAL PRIMARY KEY, name VARCHAR(255) UNIQUE NOT NULL)")
        schema_ready = True
    return conn


class Handler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=ROOT, **kwargs)

    def end_headers(self):
        self.send_header('Cache-Control', 'no-store')
        super().end_headers()

    def send_json(self, value, status=200):
        body = json.dumps(value, ensure_ascii=False).encode()
        self.send_response(status)
        self.send_header('Content-Type', 'application/json; charset=utf-8')
        self.send_header('Content-Length', str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def cos_client(self):
        return CosS3Client(CosConfig(
            Region=os.environ['COS_REGION'],
            SecretId=os.environ['COS_SECRET_ID'],
            SecretKey=os.environ['COS_SECRET_KEY'],
        ))

    def signed_url(self, key):
        if not key:
            return ''
        return self.cos_client().get_presigned_download_url(
            Bucket=os.environ['COS_BUCKET'],
            Key=key,
            Expired=CONFIG['image']['signed_url_expiry'],
        )

    def do_GET(self):
        if self.path == '/api/config':
            self.send_json({key: CONFIG[key] for key in ('pagination', 'image', 'flavor_scale', 'preferences', 'flavors')})
            return
        parsed_path = urlparse(self.path)
        if parsed_path.path == '/api/foods':
            query = parse_qs(parsed_path.query)
            page = max(int(query.get('page', ['1'])[0]), 1)
            search = query.get('search', [''])[0].strip()
            category = query.get('category', [''])[0].strip()
            limit = min(
                max(int(query.get('limit', [CONFIG['pagination']['page_size']])[0]), 1),
                CONFIG['pagination']['max_page_size'],
            )
            offset = (page - 1) * limit
            conn = db()
            with conn.cursor() as cursor:
                category_filter = ' AND categories::jsonb ?| ARRAY(SELECT name FROM categories WHERE parentcategories = %s)' if category else ''
                # 兼容纯字符串（旧）与 {name, amount} 对象（新）两种 ingredients 元素
                search_filter = (
                    '(name ILIKE %s OR brand_name ILIKE %s'
                    ' OR EXISTS (SELECT 1 FROM jsonb_array_elements(ingredients::jsonb) AS ing'
                    '   WHERE (CASE WHEN jsonb_typeof(ing) = \'string\' THEN ing #>> \'{}\' ELSE ing->>\'name\' END) ILIKE %s))'
                )
                filter_params = [f'%{search}%'] * 3 + ([category] if category else [])
                cursor.execute(
                    f'SELECT COUNT(*) AS total FROM foods WHERE {search_filter}{category_filter}',
                    filter_params,
                )
                total = cursor.fetchone()['total']
                cursor.execute(
                    'SELECT id, name, brand_name, price, categories, ingredients, flavors, preference, reason, repurchase_count, image_path, image_metadata '
                    f'FROM foods WHERE {search_filter}{category_filter} '
                    'ORDER BY id DESC LIMIT %s OFFSET %s',
                    filter_params + [limit, offset],
                )
                rows = cursor.fetchall()
            conn.close()
            self.send_json({
                'items': [
                    {
                        **row,
                        'price': float(row['price']) if row['price'] is not None else None,
                        'ingredients': json.loads(row['ingredients']),
                        'flavors': json.loads(row['flavors']),
                        'categories': json.loads(row['categories']),
                        'image_path': self.signed_url(row['image_path']),
                        'image_metadata': json.loads(row['image_metadata']),
                    }
                    for row in rows
                ],
                'total': total,
            })
            return
        if self.path == '/api/categories':
            conn = db()
            with conn.cursor() as cursor:
                cursor.execute('SELECT id, name, parentcategories FROM categories ORDER BY id')
                rows = cursor.fetchall()
            conn.close()
            self.send_json({'items': rows})
            return
        if parsed_path.path == '/api/ingredients':
            query = parse_qs(parsed_path.query)
            search = query.get('search', [''])[0].strip()
            page = max(int(query.get('page', ['1'])[0]), 1)
            page_size = CONFIG['pagination']['ingredient_page_size']
            limit = min(max(int(query.get('limit', [page_size])[0]), 1), page_size)
            offset = (page - 1) * limit
            conn = db()
            with conn.cursor() as cursor:
                where = ' WHERE name ILIKE %s' if search else ''
                params = [f'%{search}%'] if search else []
                cursor.execute(f'SELECT COUNT(*) AS total FROM ingredients{where}', params)
                total = cursor.fetchone()['total']
                cursor.execute(f'SELECT id, name FROM ingredients{where} ORDER BY id LIMIT %s OFFSET %s', params + [limit, offset])
                rows = cursor.fetchall()
            conn.close()
            self.send_json({'items': rows, 'total': total, 'page': page, 'limit': limit})
            return
        super().do_GET()

    def do_POST(self):
        if self.path == '/api/ingredients':
            length = int(self.headers['Content-Length'])
            item = json.loads(self.rfile.read(length))
            name = item['name'].strip()
            conn = db()
            with conn.cursor() as cursor:
                cursor.execute(
                    'INSERT INTO ingredients (name) VALUES (%s) '
                    'ON CONFLICT (name) DO UPDATE SET name = EXCLUDED.name RETURNING id, name',
                    (name,)
                )
                row = cursor.fetchone()
            conn.close()
            self.send_json(row, 201)
            return
        if self.path == '/api/upload':
            form = cgi.FieldStorage(
                fp=self.rfile,
                headers=self.headers,
                environ={
                    'REQUEST_METHOD': 'POST',
                    'CONTENT_TYPE': self.headers['Content-Type'],
                    'CONTENT_LENGTH': self.headers['Content-Length'],
                },
            )
            item = form['image']
            metadata_item = form['metadata_image'] if 'metadata_image' in form else item
            try:
                metadata = read_image_metadata(metadata_item.file)
            except (OSError, ValueError, TypeError):
                metadata = {}
            metadata_item.file.seek(0)
            item.file.seek(0)
            extension = os.path.splitext(item.filename)[1].lower()
            key = f'myfood/{uuid.uuid4().hex}{extension}'
            self.cos_client().put_object(
                Bucket=os.environ['COS_BUCKET'],
                Body=item.file,
                Key=key,
                ContentType=item.type,
            )
            self.send_json({'path': key, 'metadata': metadata})
            return
        if self.path != '/api/foods':
            self.send_error(404)
            return
        item = json.loads(self.rfile.read(int(self.headers['Content-Length'])))
        client_key = item.get('client_key', '') or ''
        conn = db()
        with conn.cursor() as cursor:
            cursor.execute(
                'INSERT INTO foods (name, brand_name, price, categories, ingredients, flavors, preference, reason, image_path, image_metadata, client_key) '
                'VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s) '
                "ON CONFLICT (client_key) WHERE client_key <> '' DO NOTHING RETURNING id",
                (
                    item.get('name', ''),
                    item.get('brand_name', ''),
                    item.get('price'),
                    json.dumps(item.get('categories', []), ensure_ascii=False),
                    json.dumps(item.get('ingredients', []), ensure_ascii=False),
                    json.dumps(item.get('flavors', []), ensure_ascii=False),
                    item.get('preference', ''),
                    item.get('reason', ''),
                    item.get('image_path', ''),
                    json.dumps(item.get('image_metadata', {}), ensure_ascii=False),
                    client_key,
                ),
            )
            row = cursor.fetchone()
            if row is None:
                cursor.execute('SELECT id FROM foods WHERE client_key = %s', (client_key,))
                row = cursor.fetchone()
            new_id = row['id']
        conn.close()
        self.send_json({'id': new_id})

    def do_PATCH(self):
        food_id = int(self.path.rsplit('/', 1)[-1])
        item = json.loads(self.rfile.read(int(self.headers['Content-Length'])))
        conn = db()
        with conn.cursor() as cursor:
            cursor.execute(
                'UPDATE foods SET preference = %s, reason = %s, repurchase_count = repurchase_count + %s WHERE id = %s',
                (
                    item['preference'],
                    item['reason'],
                    1 if item['preference'] == CONFIG['preferences']['good']['value'] else 0,
                    food_id,
                ),
            )
        conn.close()
        self.send_json({'id': food_id})


if __name__ == '__main__':
    ThreadingHTTPServer(
        ('0.0.0.0', int(os.environ['PORT'])),
        Handler,
    ).serve_forever()
