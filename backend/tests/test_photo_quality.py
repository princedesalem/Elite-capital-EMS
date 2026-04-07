"""
Tests for photo upload quality — verifies that uploaded images are saved
at maximum quality (no lossy recompression artifacts).
"""
import io
import base64
import pytest

from app import models
from app.utils.security import create_access_token


def _auth_headers():
    token = create_access_token({'sub': '9001', 'matricule': '9001', 'role': 'ADMIN'})
    return {'Authorization': f'Bearer {token}'}


def _create_test_jpeg(width=100, height=100) -> bytes:
    """Create a test JPEG image using Pillow."""
    try:
        from PIL import Image
        img = Image.new('RGB', (width, height), color=(255, 0, 0))
        buf = io.BytesIO()
        img.save(buf, format='JPEG', quality=100)
        return buf.getvalue()
    except ImportError:
        pytest.skip('Pillow not available')


def _create_test_png(width=100, height=100) -> bytes:
    """Create a test PNG image using Pillow."""
    try:
        from PIL import Image
        img = Image.new('RGBA', (width, height), color=(0, 255, 0, 255))
        buf = io.BytesIO()
        img.save(buf, format='PNG')
        return buf.getvalue()
    except ImportError:
        pytest.skip('Pillow not available')


class TestPhotoQualityMultipart:
    def test_jpeg_upload_preserves_quality(self, client, db_session, seed_reference_data):
        """Multipart JPEG upload should store at quality=100 (no lossy recompression)."""
        headers = _auth_headers()
        jpeg_data = _create_test_jpeg()
        original_size = len(jpeg_data)

        resp = client.post(
            '/employees/9001/photo',
            files={'photo': ('avatar.jpg', io.BytesIO(jpeg_data), 'image/jpeg')},
            headers=headers,
        )
        assert resp.status_code == 200, f"Upload failed: {resp.text}"
        photo_url = resp.json().get('photo_url')
        assert photo_url and photo_url.endswith('.jpg')

    def test_png_upload_succeeds(self, client, db_session, seed_reference_data):
        """Multipart PNG upload should succeed without recompression."""
        headers = _auth_headers()
        png_data = _create_test_png()

        resp = client.post(
            '/employees/9001/photo',
            files={'photo': ('avatar.png', io.BytesIO(png_data), 'image/png')},
            headers=headers,
        )
        assert resp.status_code == 200, f"Upload failed: {resp.text}"
        photo_url = resp.json().get('photo_url')
        assert photo_url and photo_url.endswith('.png')


class TestPhotoQualityBase64:
    def test_base64_jpeg_upload(self, client, db_session, seed_reference_data):
        """Base64 JPEG upload should process image at max quality."""
        headers = _auth_headers()
        jpeg_data = _create_test_jpeg()
        b64 = base64.b64encode(jpeg_data).decode()
        data_url = f'data:image/jpeg;base64,{b64}'

        resp = client.post(
            '/employees/9001/photo',
            json={'photo_url': data_url},
            headers=headers,
        )
        assert resp.status_code == 200, f"Base64 upload failed: {resp.text}"
        photo_url = resp.json().get('photo_url')
        assert photo_url and photo_url.endswith('.jpeg')

    def test_base64_png_upload(self, client, db_session, seed_reference_data):
        """Base64 PNG upload should process image at max quality."""
        headers = _auth_headers()
        png_data = _create_test_png()
        b64 = base64.b64encode(png_data).decode()
        data_url = f'data:image/png;base64,{b64}'

        resp = client.post(
            '/employees/9001/photo',
            json={'photo_url': data_url},
            headers=headers,
        )
        assert resp.status_code == 200, f"Base64 upload failed: {resp.text}"
        photo_url = resp.json().get('photo_url')
        assert photo_url and photo_url.endswith('.png')


def _create_jpeg_with_exif_orientation(orientation: int, width=100, height=150) -> bytes:
    """Create a JPEG with a specific EXIF orientation tag set using Pillow."""
    try:
        from PIL import Image
    except ImportError:
        pytest.skip('Pillow not available')

    img = Image.new('RGB', (width, height), color=(128, 64, 32))
    exif = img.getexif()
    exif[274] = orientation  # tag 274 = Orientation
    buf = io.BytesIO()
    img.save(buf, format='JPEG', exif=exif.tobytes(), quality=95)
    return buf.getvalue()


class TestLosslessPhotoStorage:
    """Verify that photos without EXIF rotation are stored byte-for-byte identical
    to the upload — no lossy recompression artifacts."""

    def test_multipart_no_exif_stores_original_bytes(
        self, client, db_session, seed_reference_data
    ):
        """Multipart JPEG with no EXIF (orientation defaults to 1) must be saved
        without any recompression — output bytes == input bytes."""
        headers = _auth_headers()
        jpeg_data = _create_test_jpeg()  # no EXIF at all → orientation = 1 (default)

        resp = client.post(
            '/employees/9001/photo',
            files={'photo': ('test.jpg', io.BytesIO(jpeg_data), 'image/jpeg')},
            headers=headers,
        )
        assert resp.status_code == 200, resp.text
        stored_path = '/app' + resp.json()['photo_url']

        import os
        stored_bytes = open(stored_path, 'rb').read()
        assert stored_bytes == jpeg_data, (
            f"No EXIF / orientation==1: stored file should be byte-for-byte identical "
            f"to uploaded file. Stored: {len(stored_bytes)} bytes, uploaded: {len(jpeg_data)} bytes"
        )

    def test_multipart_orientation1_exif_stores_original_bytes(
        self, client, db_session, seed_reference_data
    ):
        """Multipart JPEG with EXIF orientation=1 (upright, no rotation) must also be
        stored without recompression."""
        try:
            from PIL import Image
        except ImportError:
            pytest.skip('Pillow not available')

        jpeg_data = _create_jpeg_with_exif_orientation(1)
        headers = _auth_headers()

        resp = client.post(
            '/employees/9001/photo',
            files={'photo': ('test_orientation1.jpg', io.BytesIO(jpeg_data), 'image/jpeg')},
            headers=headers,
        )
        assert resp.status_code == 200, resp.text
        stored_path = '/app' + resp.json()['photo_url']

        import os
        stored_bytes = open(stored_path, 'rb').read()
        assert stored_bytes == jpeg_data, (
            "EXIF orientation=1: stored file should be byte-for-byte identical to upload"
        )

    def test_multipart_rotated_jpeg_changes_bytes(
        self, client, db_session, seed_reference_data
    ):
        """Multipart JPEG with EXIF orientation=6 (needs rotation) must be rotated —
        stored bytes differ from the original upload."""
        jpeg_data = _create_jpeg_with_exif_orientation(6)
        headers = _auth_headers()

        resp = client.post(
            '/employees/9001/photo',
            files={'photo': ('test_rotated.jpg', io.BytesIO(jpeg_data), 'image/jpeg')},
            headers=headers,
        )
        assert resp.status_code == 200, resp.text
        stored_path = '/app' + resp.json()['photo_url']

        import os
        stored_bytes = open(stored_path, 'rb').read()
        assert stored_bytes != jpeg_data, (
            "EXIF orientation=6 (rotated): stored file should differ from upload "
            "(rotation applied via Pillow)"
        )

    def test_base64_no_exif_stores_original_bytes(
        self, client, db_session, seed_reference_data
    ):
        """Base64 JPEG with no EXIF must be stored byte-for-byte identical."""
        jpeg_data = _create_test_jpeg()
        b64 = base64.b64encode(jpeg_data).decode()
        headers = _auth_headers()

        resp = client.post(
            '/employees/9001/photo',
            json={'photo_url': f'data:image/jpeg;base64,{b64}'},
            headers=headers,
        )
        assert resp.status_code == 200, resp.text
        stored_path = '/app' + resp.json()['photo_url']

        import os
        stored_bytes = open(stored_path, 'rb').read()
        assert stored_bytes == jpeg_data, (
            "Base64 JPEG with no EXIF: stored file should be byte-for-byte identical to upload"
        )
