#!/usr/bin/env python3
"""
Logo PNG 优化脚本
使用 PIL/Pillow 进行无损和有损压缩
"""

import os
from PIL import Image
import sys

def optimize_png(input_path, output_path, quality=85):
    """
    优化 PNG 文件

    Args:
        input_path: 输入文件路径
        output_path: 输出文件路径
        quality: 质量 (1-100, 默认 85)
    """
    print(f"📂 读取文件: {input_path}")

    # 打开图片
    img = Image.open(input_path)

    # 获取原始大小
    original_size = os.path.getsize(input_path)
    print(f"📏 原始尺寸: {img.size[0]}x{img.size[1]}")
    print(f"📦 原始大小: {original_size / 1024:.1f} KB")

    # 确保是 RGBA 模式
    if img.mode != 'RGBA':
        img = img.convert('RGBA')

    # 保存优化后的图片
    print(f"🔄 正在优化 (质量: {quality})...")
    img.save(
        output_path,
        'PNG',
        optimize=True,
        compress_level=9,  # 最高压缩级别
    )

    # 获取新大小
    new_size = os.path.getsize(output_path)
    reduction = ((original_size - new_size) / original_size) * 100

    print(f"✅ 优化完成!")
    print(f"📦 新大小: {new_size / 1024:.1f} KB")
    print(f"💾 减少: {reduction:.1f}% ({(original_size - new_size) / 1024:.1f} KB)")

    return new_size

def create_smaller_sizes(input_path, output_dir):
    """
    创建多个尺寸的 logo
    """
    img = Image.open(input_path)

    sizes = [
        (512, 512, 'logo-512.png'),
        (256, 256, 'logo-256.png'),
        (128, 128, 'logo-128.png'),
        (64, 64, 'logo-64.png'),
    ]

    print(f"\n📐 创建不同尺寸...")

    for width, height, filename in sizes:
        output_path = os.path.join(output_dir, filename)
        resized = img.resize((width, height), Image.Resampling.LANCZOS)
        resized.save(output_path, 'PNG', optimize=True, compress_level=9)
        size = os.path.getsize(output_path)
        print(f"   ✓ {width}x{height}: {size / 1024:.1f} KB - {filename}")

if __name__ == '__main__':
    input_file = 'public/logo.png'
    output_file = 'public/logo-optimized.png'
    output_dir = 'public'

    if not os.path.exists(input_file):
        print(f"❌ 文件不存在: {input_file}")
        sys.exit(1)

    # 优化原始 logo
    optimize_png(input_file, output_file, quality=85)

    # 创建不同尺寸
    create_smaller_sizes(output_file, output_dir)

    print(f"\n✨ 所有文件已创建在: {output_dir}")
    print(f"\n💡 建议:")
    print(f"   1. 查看 {output_file} 确认质量")
    print(f"   2. 如果满意，运行: mv {output_file} {input_file}")
