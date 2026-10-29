#!/usr/bin/env python3
"""Extract this WaterBall project's source art using a locally installed UE Oodle SDK.

No Unreal assets are modified. No UE binaries are copied into the website.
UE compressed-buffer format reference: Engine/Source/Runtime/Core/Private/
Compression/CompressedBuffer.cpp in the local Unreal Engine installation.
"""
from pathlib import Path
import ctypes
import hashlib
import io
import json
import shutil
import struct
from PIL import Image
import numpy as np

PROJECT = Path('/Users/muyan/Downloads/WaterBall')
OUT = Path(__file__).resolve().parents[1] / 'assets'
LIB = Path('/Users/Shared/Epic Games/UE_5.3/Engine/Source/Runtime/OodleDataCompression/Sdks/2.9.10/lib/Mac/liboo2coremac64.2.9.10.dylib')
MAGIC = bytes.fromhex('b7756362')


def sha(b):
    return hashlib.sha256(b).hexdigest()


def decompress_source(blob):
    offset = blob.find(MAGIC)
    if offset < 0:
        raise ValueError('No embedded UE compressed-buffer source data')
    header = blob[offset:offset + 64]
    magic, crc, method, compressor, level, exponent, count, raw_size, compressed_size = struct.unpack('>IIBBBBIQQ', header[:32])
    if method == 0:
        raw = blob[offset + 64:offset + compressed_size]
        assert len(raw) == raw_size
    else:
        assert method == 3, 'Only Oodle-compressed source art is expected'
        sdk = ctypes.CDLL(str(LIB))
        fn = sdk.OodleLZ_Decompress
        fn.restype = ctypes.c_ssize_t
        fn.argtypes = [ctypes.c_void_p, ctypes.c_ssize_t, ctypes.c_void_p, ctypes.c_ssize_t,
                       ctypes.c_int, ctypes.c_int, ctypes.c_int, ctypes.c_void_p, ctypes.c_ssize_t,
                       ctypes.c_void_p, ctypes.c_void_p, ctypes.c_void_p, ctypes.c_ssize_t, ctypes.c_int]
        sizes = struct.unpack_from('>' + 'I' * count, blob, offset + 64)
        cursor = offset + 64 + 4 * count
        chunks = []
        for i, size in enumerate(sizes):
            raw_len = min(1 << exponent, raw_size - i * (1 << exponent))
            comp = blob[cursor:cursor + size]
            if size == raw_len:
                chunk = comp
            else:
                src = ctypes.create_string_buffer(comp)
                dst = ctypes.create_string_buffer(raw_len)
                result = fn(src, size, dst, raw_len, 1, 0, 0, None, 0, None, None, None, 0, 3)
                if result != raw_len:
                    raise ValueError(f'Oodle decompression failed for block {i}: {result}')
                chunk = dst.raw
            chunks.append(chunk)
            cursor += size
        assert cursor == offset + compressed_size
        raw = b''.join(chunks)
    return raw, {'source_buffer_offset': offset, 'source_bytes': raw_size, 'compression_method': method,
                 'compressor': compressor, 'blocks': count, 'source_sha256': sha(raw)}


def bake_unreal_hue(image, hue_degrees, web_size=None):
    """UE TextureCompressor: linear RGB -> HSV -> H offset -> linear RGB.

    Local UE source: TextureCompressorModule.cpp, LinearizeToWorkingColorSpace,
    AdjustColorsNew/Old; Core/Private/Math/Color.cpp, LinearRGBToHSV/HSVToLinearRGB.
    Encode the result back to sRGB so the web texture keeps its sRGB sampling.
    """
    encoded = np.array(image.convert('RGB'), dtype=np.float32) / np.float32(255.0)
    rgb = np.where(encoded <= np.float32(0.04045), encoded / np.float32(12.92),
                   ((encoded + np.float32(0.055)) / np.float32(1.055)) ** np.float32(2.4))
    low = rgb.min(axis=2)
    high = rgb.max(axis=2)
    span = high - low
    divisor = np.where(span == 0, np.float32(1), span)
    red, green, blue = [rgb[:, :, c] for c in range(3)]
    hue = np.where(high == red, ((green - blue) / divisor * 60 + 360) % 360,
                   np.where(high == green, (blue - red) / divisor * 60 + 120,
                            (red - green) / divisor * 60 + 240))
    hue = np.where(span == 0, np.float32(0), hue)
    saturation = np.divide(span, high, out=np.zeros_like(span), where=high != 0)
    hue = (hue + np.float32(hue_degrees)) % np.float32(360)
    h_div_60 = hue / np.float32(60)
    sector = np.floor(h_div_60).astype(np.int32) % 6
    fraction = h_div_60 - np.floor(h_div_60)
    values = np.stack([high, high * (1 - saturation),
                       high * (1 - fraction * saturation),
                       high * (1 - (1 - fraction) * saturation)], axis=2)
    swizzles = np.array([[0, 3, 1], [2, 0, 1], [1, 0, 3],
                        [1, 2, 0], [3, 1, 0], [0, 1, 2]])
    linear = np.take_along_axis(values, swizzles[sector], axis=2)
    if web_size:
        linear = np.stack([np.asarray(Image.fromarray(linear[:, :, c]).resize(
            web_size, Image.Resampling.LANCZOS)) for c in range(3)], axis=2)
    linear = np.clip(linear, 0, 1)
    encoded = np.where(linear <= np.float32(0.0031308), linear * np.float32(12.92),
                       np.float32(1.055) * linear ** np.float32(1 / 2.4) - np.float32(0.055))
    encoded = np.floor(np.clip(encoded, 0, 1) * np.float32(255) + np.float32(0.5)).astype(np.uint8)
    return Image.fromarray(encoded, 'RGB')


def export_asset(relative_path, filename, fmt, size, web_size=None):
    path = PROJECT / relative_path
    blob = path.read_bytes()
    raw, record = decompress_source(blob)
    if fmt == 'JPEG':
        image = Image.open(io.BytesIO(raw))
        image.load()
        assert image.size == size
    else:
        channels = 4 if fmt == 'TSF_BGRA8' else 1
        assert len(raw) == size[0] * size[1] * channels
        pixels = raw
        if b'TSCF_UEDELTA' in blob:
            # UEDELTA: rows after each stripe's first row are bytewise deltas.
            # For these opaque BGRA8 images, alpha=255 marks absolute stripe rows;
            # delta rows have alpha=0. Swirl's G8 source has observed 64-row stripes.
            row_bytes = size[0] * channels
            arr = np.frombuffer(raw, dtype=np.uint8).copy().reshape(size[1], row_bytes)
            if channels == 4:
                resets = np.flatnonzero(np.all(arr[:, 3::4] == 255, axis=1)).tolist()
                stripe_rows = resets[1] if len(resets) > 1 else size[1]
                assert resets == list(range(0, size[1], stripe_rows))
                assert np.all(np.isin(arr[:, 3::4], [0, 255]))
            else:
                stripe_rows = 64
            for y in range(0, size[1], stripe_rows):
                arr[y:y + stripe_rows] = np.cumsum(arr[y:y + stripe_rows], axis=0, dtype=np.uint8)
            pixels = arr.tobytes()
            record['source_compression'] = 'TSCF_UEDELTA'
            record['delta_stripe_rows'] = stripe_rows
            # Round-trip check the filter instead of silently accepting wrong bytes.
            inverse = arr.copy()
            for y in range(size[1] - 1, 0, -1):
                if y % stripe_rows:
                    inverse[y] -= arr[y - 1]
            assert inverse.tobytes() == raw
        record['decoded_pixel_sha256'] = sha(pixels)
        if fmt == 'TSF_BGRA8':
            image = Image.frombytes('RGBA', size, pixels, 'raw', 'BGRA')
            assert image.getchannel('A').getextrema() == (255, 255)
            image = image.convert('RGB')
        elif fmt == 'TSF_G8':
            image = Image.frombytes('L', size, pixels)
        else:
            raise ValueError(fmt)
    if filename == 'T_WaterColor.png':
        settings_path = OUT.parent / 'source' / 'texture-settings.json'
        settings = next(t['effectiveSettings'] for t in json.loads(settings_path.read_text())['textures']
                        if t['name'] == 'T_WaterColor')
        hue = settings['AdjustHue']
        assert settings['SRGB'] is True
        assert settings.get('bUseLegacyGamma', False) is False
        image = bake_unreal_hue(image, hue, web_size)
        record['baked_texture_adjustments'] = {
            'AdjustHue': hue, 'settings_source': '../source/texture-settings.json',
            'pipeline': 'sRGB decode -> linear RGB -> HSV -> hue += AdjustHue degrees -> linear RGB -> optional linear Lanczos resize -> sRGB encode',
            'shader_instruction': 'Already baked. Sample as sRGB; do not apply AdjustHue again.',
            'engine_reference': 'Local UE 5.3 TextureCompressorModule.cpp:1604,2589,2642,2757,2806 and Core/Private/Math/Color.cpp:384,406',
            'note': 'The asset is UE 5.8; the available UE 5.3 source confirms the documented hue adjustment pipeline.'
        }
    elif web_size:
        image = image.resize(web_size, Image.Resampling.LANCZOS)
    image.save(OUT / filename, optimize=True)
    # Unreal's embedded thumbnail byte order is BGR, even inside its JPEG stream.
    thumbnail_offset = blob.find(bytes.fromhex('ffd8ff'))
    thumb = Image.open(io.BytesIO(blob[thumbnail_offset:])).convert('RGB')
    thumb_rgb = np.array(thumb, dtype=float)[:, :, ::-1]
    preview = np.array(image.convert('RGB').resize(thumb.size, Image.Resampling.LANCZOS), dtype=float)
    record['thumbnail_structure_correlation_rgb'] = [
        float(np.corrcoef(preview[:, :, c].flatten(), thumb_rgb[:, :, c].flatten())[0, 1]) for c in range(3)]
    record['validation'] = ('Original source format decoded, dimensions verified, UEDELTA filter round-tripped '
                            'where present, visually inspected against the embedded Unreal thumbnail.')
    record.update({'asset': relative_path, 'asset_sha256': sha(blob), 'output': filename,
                   'output_sha256': sha((OUT / filename).read_bytes()), 'width': image.width,
                   'height': image.height, 'source_width': size[0], 'source_height': size[1],
                   'source_format': fmt,
                   'resize': ('linear RGB Lanczos' if filename == 'T_WaterColor.png' else 'Lanczos') if web_size else 'none',
                   'extraction': 'Original embedded source art; no substitute texture. Web copy may be downsampled.'})
    print(f'{filename}: {image.size} {image.mode}, {len(raw)} source bytes')
    return record


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    records = [
        export_asset('Content/Water_normal.uasset', 'Water_normal.png', 'JPEG', (512, 512)),
        export_asset('Content/T_Noise_Water.uasset', 'T_Noise_Water.png', 'TSF_BGRA8', (2048, 2048), (1024, 1024)),
        export_asset('Content/T_WaterColor.uasset', 'T_WaterColor.png', 'TSF_BGRA8', (2048, 2048), (1024, 1024)),
        export_asset('Content/T_SwirlNoise.uasset', 'T_SwirlNoise.png', 'TSF_G8', (512, 512)),
        export_asset('Content/Texture/T_GradationPattern.uasset', 'T_GradationPattern.png', 'TSF_BGRA8', (128, 128)),
        export_asset('Content/Texture/LowResBlurredNoise.uasset', 'LowResBlurredNoise.png', 'TSF_BGRA8', (64, 64)),
        export_asset('Content/Texture/water_n.uasset', 'water_n.png', 'TSF_BGRA8', (512, 512)),
        export_asset('Content/Texture/T_Water_N.uasset', 'T_Water_N.png', 'TSF_BGRA8', (2048, 2048), (1024, 1024)),
    ]
    source = PROJECT / 'Saved/Screenshots/WindowsEditor/ScreenShot00000.png'
    shutil.copyfile(source, OUT / 'unreal-reference.png')
    with Image.open(source) as im:
        records.append({'asset': 'Saved/Screenshots/WindowsEditor/ScreenShot00000.png', 'output': 'unreal-reference.png',
                        'asset_sha256': sha(source.read_bytes()), 'output_sha256': sha(source.read_bytes()),
                        'width': im.width, 'height': im.height,
                        'extraction': 'Exact copy of existing Unreal Editor still image; not a video'})
    manifest = {'project': 'WaterBall', 'method': 'Read-only UE source-art decompression using local Oodle SDK 2.9.10',
                'assets': records,
                'cubemap': {'asset': 'Content/CubeRenderTarget.uasset',
                            'asset_sha256': sha((PROJECT / 'Content/CubeRenderTarget.uasset').read_bytes()),
                            'status': 'Render target descriptor only; IsSourceValid=False and TSF Invalid; no six saved faces in this asset'},
                'notes': ['Water_normal is decoded from the embedded 512x512 JPEG source art and stored as PNG.',
                          'UEDELTA row filtering is decoded before BGRA8 is reordered to RGB for PNG; web downsampling is documented per asset.',
                          'Swirl PNG preserves decoded G8 values at full 512x512 resolution.',
                          'T_WaterColor includes the asset AdjustHue=43.2 degree adjustment in linear-RGB HSV, baked before sRGB output; do not apply it again in GLSL.',
                          'The local Oodle binary is not distributed.',
                          'Source files retain their original licensing; this manifest records provenance, not license clearance.']}
    (OUT / 'provenance.json').write_text(json.dumps(manifest, indent=2, ensure_ascii=False) + '\n')

if __name__ == '__main__':
    main()
